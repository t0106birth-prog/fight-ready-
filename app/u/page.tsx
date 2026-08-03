import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { UserTabbar, Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPtTrialAction } from "@/app/u/actions";
import {
  todosDone, currentWeight,
  activeWaterCut, latestWaterCutLog, waterCutPhase,
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
  const todos = todosDone(db, user.id);
  const verdict = dailyVerdict(db, user);
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
  // 一般会員は「スタートから −◯kg」を主役に（締切プレッシャーの「目標日まで」は出さない）
  const firstWeight = db.dailyCheckins.filter((c) => c.userId === user.id && c.weight != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.weight;
  const startW = user.startWeight ?? firstWeight ?? null;
  const lost = startW != null && cw != null ? round1(startW - cw) : null;

  // 計量目標は「進行中の水抜き期間の目標」を最優先。user.targetWeight は一般目標欄で、
  // プロの計量目標（＝WaterCutPeriod.targetWeight）と混同しやすい（役割切替後の残存にも注意）。
  const weighInTarget = isPro && wcPeriod ? wcPeriod.targetWeight : user.targetWeight ?? null;
  // ゴールの基準体重（これより軽ければ減量ゴール）。プロの水抜きは開始体重、それ以外はスタート体重。
  const goalRef = isPro && wcPeriod ? wcPeriod.baselineWeight : startW;
  const goalIsLoss = weighInTarget != null && goalRef != null ? weighInTarget <= goalRef : true;
  // 「目標到達」は“到達方向”に達したときだけ。目標が現在より重い等の不整合データで誤って到達表示しない。
  const goalReached = weighInTarget != null && cw != null
    ? (goalIsLoss ? cw <= weighInTarget : cw >= weighInTarget)
    : false;
  const goalToGo = weighInTarget != null && cw != null ? round1(Math.abs(cw - weighInTarget)) : null;

  const todoList = [
    { key: "morning", label: "朝のチェック", href: "/u/record/morning", done: todos.morning },
    { key: "activity", label: "運動記録", href: "/u/record/activity", done: todos.activity },
    { key: "nutrition", label: "食事達成度", href: "/u/record/nutrition", done: todos.nutrition },
    { key: "night", label: "夜の回復チェック", href: "/u/record/rest", done: todos.night },
  ];
  const completedTodos = todoList.filter((t) => t.done).length;
  const nextTodo = todoList.find((t) => !t.done);

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
            <Link href={nextTodo?.href ?? "/u/record"} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="row">
                <div>
                  <span className="meta" style={{ display: "block", marginBottom: 3 }}>{nextTodo ? "次の記録" : "今日の記録"}</span>
                  <b style={{ fontSize: "1.15rem" }}>{nextTodo?.label ?? "すべて完了しました"}</b>
                </div>
                <span className="btn btn-primary btn-sm">{nextTodo ? "記録する →" : "確認する →"}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {todoList.map((t) => (
                  <span key={t.key} title={t.label} style={{ flex: 1, height: 6, borderRadius: 3, background: t.done ? "var(--green)" : "var(--line)" }} />
                ))}
              </div>
              <p className="meta" style={{ margin: "8px 0 0" }}>
                今日 {completedTodos}/{todoList.length} 完了{nextTodo ? " ・ 約20秒" : " ・ おつかれさまでした"}
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
          {isPro && !user.weighInAt && targetDays != null && (
            <div className="progress-row"><span>目標日まで</span><b>{targetDays}日</b></div>
          )}
          {!isPro && lost != null && lost > 0 && (
            <div className="progress-row"><span>スタートから</span><b style={{ color: "var(--green-bright)" }}>−{lost}<span className="unit">kg</span></b></div>
          )}
          {cw != null && <div className="progress-row"><span>現在体重</span><b>{round1(cw)}<span className="unit">kg</span></b></div>}
          {goalToGo != null && (
            <div className="progress-row">
              <span>{isPro ? "計量目標まで" : "目標まで"}</span>
              {goalReached
                ? <b style={{ color: "var(--green-bright)" }}>目標到達</b>
                : <b>あと {goalToGo}<span className="unit">kg</span></b>}
            </div>
          )}
        </div>
        <Link href="/u/mypage" className={user.targetWeight == null ? "btn btn-accent" : "btn btn-ghost"} style={{ marginTop: 4 }}>
          🎯 {user.targetWeight == null ? "目標体重を設定する" : "目標・設定を変更する"}
        </Link>

        {/* 進行中だけ再開入口を出す。未開始時は記録画面から開始する。 */}
        {isPro && (() => {
          const period = activeWaterCut(db, user.id);
          if (period) {
            const wlog = latestWaterCutLog(db, user.id, period.id);
            const cur = wlog?.currentWeight ?? period.baselineWeight;
            const { pct } = acuteLoss(period.baselineWeight, cur);
            const tone = pct >= 5 ? "red" : pct >= 2 ? "yellow" : "blue";
            const rem = round1(cur - period.targetWeight);
            const phase = waterCutPhase(period);
            return (
              <>
                <p className="kicker">計量準備</p>
                <Link href="/u/watercut" className="card" style={{ display: "block", color: "var(--ink)", borderColor: tone === "red" ? "var(--red)" : tone === "yellow" ? "var(--amber)" : "var(--blue)", padding: "14px 16px" }}>
                  <div className="row" style={{ alignItems: "center" }}>
                    <div>
                      <b>計量準備・{phase === "loading" ? "ローディング中" : phase === "cut" ? "水抜き中" : phase === "weighin" ? "計量中" : "リカバリー中"}</b>
                      <p className="small" style={{ margin: "5px 0 0" }}>計量まで {untilLabel(period.weighInDatetime)} ・ 開始から −{pct}%</p>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: "1.35rem" }}>›</span>
                  </div>
                  {period.targetWeight < period.baselineWeight && rem <= 0 && <p className="small" style={{ margin: "8px 0 0", color: "var(--green-bright)" }}>計量目標に到達しています</p>}
                </Link>
              </>
            );
          }
          return null;
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
