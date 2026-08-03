import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { UserTabbar, Hero } from "@/components/Nav";
import { StatusTile } from "@/components/StatusTile";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPtTrialAction } from "@/app/u/actions";
import {
  statusTiles, todosDone, streakDays, weeklyActivityCount, currentWeight,
  activeWaterCut, latestWaterCutLog,
} from "@/lib/derive";
import { dailyVerdict, acuteLoss } from "@/lib/judge";
import { daysUntil, round1, untilLabel, businessDate, fmtDate } from "@/lib/calc";

export default async function UserHome({ searchParams }: { searchParams: Promise<{ rolechanged?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login/user");
  if (user.role === "staff") redirect("/staff");
  const db = await getDb();

  const isPro = user.role === "pro";
  const tiles = statusTiles(db, user);
  const todos = todosDone(db, user.id);
  const verdict = dailyVerdict(db, user);
  const streak = streakDays(db, user.id);
  const week = weeklyActivityCount(db, user.id);
  const cw = currentWeight(db, user);
  const inquiry = db.ptInquiries.find((i) => i.userId === user.id && (i.status === "wanted" || i.status === "contacted"));
  const camp = db.camps.find((c) => c.userId === user.id && c.status === "active");
  // 試合当日は記録オフ（リカバリーだけ）。ホームでも案内する。
  const wcPeriod = activeWaterCut(db, user.id);
  const fightAt = wcPeriod?.fightDatetime ?? user.fightAt;
  const isFightDay = isPro && !!fightAt && businessDate(new Date(fightAt)) === businessDate();
  // スタッフが確認した足跡（見守られている実感）
  const lastAck = db.history
    .filter((h) => h.action === "staff_ack" && h.resource === user.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  const targetDays = daysUntil(user.targetDate);
  const remain = user.targetWeight != null && cw != null ? round1(cw - user.targetWeight) : null;
  // 一般会員は「スタートから −◯kg」を主役に（締切プレッシャーの「目標日まで」は出さない）
  const firstWeight = db.dailyCheckins.filter((c) => c.userId === user.id && c.weight != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.weight;
  const startW = user.startWeight ?? firstWeight ?? null;
  const lost = startW != null && cw != null ? round1(startW - cw) : null;

  const todoList = [
    { key: "morning", label: "朝のチェック", href: "/u/record/morning", done: todos.morning },
    { key: "activity", label: "運動記録", href: "/u/record/activity", done: todos.activity },
    { key: "nutrition", label: "食事達成度", href: "/u/record/nutrition", done: todos.nutrition },
    { key: "night", label: "夜の回復チェック", href: "/u/record/rest", done: todos.night },
  ];

  return (
    <>
      <Hero title={`${user.name} さん`} sub={isPro ? "ATHLETE" : "MEMBER"} backHref="/u" />
      <div className="shell">
        {sp.error === "switched" && (
          <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}>
            <b>別のアカウントに切り替わっていたため保存しませんでした</b> — 画面を開き直してから、もう一度入力してください（他の人のデータに保存されないための安全機能です）。
          </div>
        )}
        {sp.error === "notpro" && (
          <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}>
            <b>水抜きの記録は選手のみ利用できます</b> — 試合に出る場合は「目標・設定」から選手に切り替えてください。
          </div>
        )}
        {sp.rolechanged === "pro" && (
          <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
            <b>🥊 選手モードに切り替わりました</b> — 計量・水抜きモニタリングが使えます。<Link href="/u/mypage" style={{ textDecoration: "underline" }}>計量日などを設定</Link>
          </div>
        )}
        {sp.rolechanged === "member" && (
          <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
            <b>一般会員（フィットネス）に切り替わりました</b> — 健康的な体づくりを続けましょう。
          </div>
        )}
        {lastAck && (
          <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
            <b>👀 チームが見守っています</b> — {fmtDate(lastAck.createdAt)} にスタッフがあなたの記録を確認しました。
          </div>
        )}

        {isFightDay ? (
          /* 試合当日：記録オフの案内。今日やることは出さない */
          <div className="alert-band alert-red">
            <div className="at">🥊 今日は試合当日</div>
            今日は試合に集中してください。<b>毎日の記録はお休みでOK</b>。入れるのは<b>計量後のリカバリー体重だけ</b>で大丈夫です。<br />
            <Link href="/u/watercut/recovery" style={{ color: "#ffd9d5", textDecoration: "underline" }}>→ リカバリー体重を記録する</Link>
          </div>
        ) : (
          <>
            {/* 13-1 今日のメッセージ */}
            <div className="card">
              <p className="mt0" style={{ fontWeight: 700 }}>おはようございます。今日の身体の状態を記録しましょう。</p>
              <p className="meta" style={{ marginBottom: 0 }}>
                {verdict.reasons.slice(0, 2).join("。")}。
              </p>
            </div>

            {/* 13-2 今日の記録（ホームはサマリーだけ。入力は「記録」タブへ集約して差別化） */}
            <p className="kicker">今日の記録</p>
            <Link href="/u/record" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="row">
                <b>{todoList.filter((t) => t.done).length}/{todoList.length} 完了</b>
                <span className="btn btn-primary btn-sm">記録する →</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {todoList.map((t) => (
                  <span key={t.key} title={t.label} style={{ flex: 1, height: 6, borderRadius: 3, background: t.done ? "var(--green)" : "var(--line)" }} />
                ))}
              </div>
              <p className="meta" style={{ margin: "8px 0 0" }}>
                {todoList.every((t) => t.done)
                  ? "今日の記録は完了です。おつかれさまでした。"
                  : `残り：${todoList.filter((t) => !t.done).map((t) => t.label).join("・")}`}
              </p>
            </Link>
          </>
        )}

        {/* 13-3 現在の進捗 */}
        <p className="kicker">現在の進捗</p>
        <div className="card">
          {isPro && user.weighInAt && (
            <div className="progress-row"><span>計量まで</span><b>{untilLabel(user.weighInAt)}</b></div>
          )}
          {/* 締切「目標日まで」はプロのみ（一般会員には出さない） */}
          {isPro && targetDays != null && (
            <div className="progress-row"><span>目標日まで</span><b>{targetDays}日</b></div>
          )}
          {!isPro && lost != null && lost > 0 && (
            <div className="progress-row"><span>スタートから</span><b style={{ color: "var(--green-bright)" }}>−{lost}<span className="unit">kg</span></b></div>
          )}
          {cw != null && <div className="progress-row"><span>現在体重</span><b>{round1(cw)}<span className="unit">kg</span></b></div>}
          {user.targetWeight != null && <div className="progress-row"><span>目標体重</span><b>{user.targetWeight}<span className="unit">kg</span></b></div>}
          {remain != null && <div className="progress-row"><span>{isPro ? "残り体重" : "目標まであと"}</span><b>{remain > 0 ? remain : 0}<span className="unit">kg</span></b></div>}
          <div className="progress-row"><span>今週の運動回数</span><b>{week}<span className="unit">回</span></b></div>
          <div className="progress-row"><span>連続記録日数</span><b>{streak}<span className="unit">日</span></b></div>
        </div>
        <Link href="/u/mypage" className={user.targetWeight == null ? "btn btn-accent" : "btn btn-ghost"} style={{ marginTop: 4 }}>
          🎯 {user.targetWeight == null ? "目標体重を設定する" : "目標・設定を変更する"}
        </Link>

        {/* 13-4 今日の状態 */}
        <p className="kicker">今日の状態</p>
        <div className="status-grid">
          {tiles.map((t) => <StatusTile key={t.lbl} tile={t} />)}
        </div>

        {/* 水抜き（WATER CUT / HYDRO）— プロは常にホームからカードで開ける */}
        {isPro && (() => {
          const period = activeWaterCut(db, user.id);
          if (period) {
            const wlog = latestWaterCutLog(db, user.id, period.id);
            const cur = wlog?.currentWeight ?? period.baselineWeight;
            const { pct } = acuteLoss(period.baselineWeight, cur);
            const tone = pct >= 5 ? "red" : pct >= 2 ? "yellow" : "blue";
            const rem = round1(cur - period.targetWeight);
            return (
              <>
                <p className="kicker">水抜き（WATER CUT / HYDRO）</p>
                <Link href="/u/watercut" className="card" style={{ display: "block", color: "var(--ink)", borderColor: "var(--blue)" }}>
                  <div className="row"><b>WATER CUT / HYDRO</b><span className={`sig sig-${tone}`}>開始から −{pct}%</span></div>
                  <div className="progress-row"><span>計量まで残り</span><b>あと {rem > 0 ? rem : 0}kg</b></div>
                  <div className="progress-row"><span>計量まで</span><b>{untilLabel(period.weighInDatetime)}</b></div>
                  <p className="small" style={{ marginBottom: 0, color: "var(--blue)" }}>水抜き・HYDROを開く ›</p>
                </Link>
              </>
            );
          }
          return (
            <>
              <p className="kicker">水抜き（WATER CUT / HYDRO）</p>
              <Link href="/u/watercut" className="card" style={{ display: "block", color: "var(--ink)", borderColor: "var(--blue)" }}>
                <b>💧 WATER CUT / HYDRO</b>
                <p className="meta mt0">計量に向けた水抜き・尿比重(HYDRO)のモニタリング。ここから開始・記録できます。</p>
                <p className="small" style={{ marginBottom: 0, color: "var(--blue)" }}>水抜きを開く ›</p>
              </Link>
            </>
          );
        })()}

        {/* 一般会員：パーソナルは「体験希望」ボタンだけ（プラン管理はしない） */}
        {!isPro && !inquiry && (
          <div className="card">
            <b>プロと同じ管理で、さらに身体を仕上げる</b>
            <p className="meta">パーソナルトレーニング体験（ジムスタッフがご案内します）</p>
            <form action={requestPtTrialAction}>
              <SubmitButton className="btn btn-green btn-sm" style={{ width: "100%" }} pendingLabel="送信中…">体験に興味がある</SubmitButton>
            </form>
          </div>
        )}
        {!isPro && inquiry && (
          <div className="card"><div className="alert-band alert-blue" style={{ margin: 0 }}>パーソナル体験の希望を受付済みです。ジムスタッフからご案内します。</div></div>
        )}

        {camp && (
          <div className="card">
            <b>FIGHT CAMP</b>
            <p className="meta mt0">{camp.name}</p>
            <Link href="/u/personal" className="small">キャンプの進捗を見る ›</Link>
          </div>
        )}

        <Link href="/u/weekly" className="btn btn-ghost" style={{ marginTop: 14 }}>今週の振り返りを見る</Link>
      </div>
      <UserTabbar active="home" />
    </>
  );
}
