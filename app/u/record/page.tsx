import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { UserTabbar, Hero } from "@/components/Nav";
import { activeWaterCut, todosDone, inWaterCutWindow, waterCutPhase, latestWaterCutLog } from "@/lib/derive";
import { businessDate, untilLabel } from "@/lib/calc";
import { acuteLoss } from "@/lib/judge";

const PHASE_LABEL: Record<string, string> = { loading: "ローディング期", cut: "水抜き期", weighin: "計量", recovery: "リカバリー", done: "" };

export default async function RecordHub({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  const todos = todosDone(db, user.id);
  const isPro = user.role === "pro";
  const waterCut = activeWaterCut(db, user.id);
  // 試合当日は記録オフ（メンタルを試合に集中させる）。入れられるのはリカバリーだけ。
  const fightAt = waterCut?.fightDatetime ?? user.fightAt;
  const isFightDay = isPro && !!fightAt && businessDate(new Date(fightAt)) === businessDate();
  const saved = {
    morning: "朝のチェックを保存しました",
    activity: "運動記録を保存しました",
    running: "ランニングを保存しました",
    rest: "休養日・回復チェックを保存しました",
    nutrition: "食事の記録を保存しました",
  }[sp.saved ?? ""];

  const items = [
    {
      href: "/u/record/morning",
      ico: "🌅",
      label: "朝のチェック",
      desc: waterCut ? "体重・睡眠・疲労・痛み（体重は水抜きにも自動で反映）" : "体重・睡眠・疲労・だるさ・痛み",
      done: todos.morning,
    },
    { href: "/u/record/activity", ico: "🥊", label: "運動・休養の記録", desc: "練習した日も、しなかった日（休養日）も", done: todos.activity },
    { href: "/u/record/nutrition", ico: "🍽️", label: "食事達成度", desc: "今日の食事目標", done: todos.nutrition },
    { href: "/u/record/rest", ico: "🌙", label: "夜の回復チェック", desc: "一日の終わりに回復・痛みの変化を確認", done: todos.night },
  ];

  return (
    <>
      <Hero title="毎日の記録" sub="10〜20秒で完了" />
      <div className="shell">
        {saved && <div className="alert-band alert-green"><b>✓</b> {saved}</div>}

        {/* 試合当日：毎日の記録はオフ。入れられるのはリカバリーだけ */}
        {isFightDay ? (
          <>
            <div className="alert-band alert-red">
              <div className="at">🥊 今日は試合当日</div>
              今日は試合に集中してください。<b>毎日の記録はお休みでOK</b>です。入れるのは<b>計量後のリカバリー体重だけ</b>で大丈夫（他の記録は明日以降でかまいません）。
            </div>
            <Link href="/u/watercut/recovery" className="todo-item" style={{ borderColor: "var(--green)" }}>
              <span className="tk" style={{ fontSize: 18 }}>🥊</span>
              <span className="tt">計量後のリカバリー<br /><span className="meta" style={{ fontWeight: 400 }}>戻した体重を入れるだけ。今回の準備データにまとまります</span></span>
              <span className="ta">›</span>
            </Link>
            <Link href="/u/watercut" className="todo-item" style={{ opacity: 0.85 }}>
              <span className="tk" style={{ fontSize: 18 }}>💧</span>
              <span className="tt">計量準備（確認のみ）<br /><span className="meta" style={{ fontWeight: 400 }}>これまでの記録を見る</span></span>
              <span className="ta">›</span>
            </Link>
            <Link href="/u/history" className="todo-item">
              <span className="tk" style={{ fontSize: 18 }}>📚</span>
              <span className="tt">過去の水抜き・試合準備<br /><span className="meta" style={{ fontWeight: 400 }}>これまでの準備を見返す</span></span>
              <span className="ta">›</span>
            </Link>
          </>
        ) : (
        <>
        <p className="kicker">今日の記録</p>
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`todo-item ${it.done ? "done" : ""}`}>
            <span className="tk" style={{ fontSize: 18 }}>{it.done ? "✓" : it.ico}</span>
            <span className="tt">{it.label}<br /><span className="meta" style={{ fontWeight: 400 }}>{it.desc}</span></span>
            <span className={`sig ${it.done ? "sig-green" : "sig-blue"}`}>{it.done ? "完了" : "未記録"}</span>
          </Link>
        ))}
        <Link href="/u/record/running" className="btn btn-ghost" style={{ margin: "2px 0 14px" }}>
          🏃 ランニングの詳細を記録
        </Link>
        {/* 水抜きはプロ選手なら常に開ける（7日前からは自動で強調表示） */}
        {isPro && (
          <>
            <p className="kicker">計量準備</p>
            {waterCut ? (() => {
              const log = latestWaterCutLog(db, user.id, waterCut.id);
              const current = log?.currentWeight ?? waterCut.baselineWeight;
              const { pct } = acuteLoss(waterCut.baselineWeight, current);
              const borderColor = pct >= 5 ? "var(--red)" : pct >= 2 ? "var(--amber)" : "var(--blue)";
              return (
                <Link href="/u/watercut" className="card" style={{ display: "block", color: "var(--ink)", borderColor, padding: "14px 16px" }}>
                  <div className="row" style={{ alignItems: "center" }}>
                    <div>
                      <b>{PHASE_LABEL[waterCutPhase(waterCut)]}</b>
                      <p className="small" style={{ margin: "5px 0 0" }}>計量まで {untilLabel(waterCut.weighInDatetime)} ・ 開始から −{pct}%</p>
                    </div>
                    <span className="ta">›</span>
                  </div>
                </Link>
              );
            })() : (
              <Link href="/u/watercut" className={inWaterCutWindow(user) ? "btn btn-accent" : "btn btn-ghost"}>
                💧 計量準備を始める
              </Link>
            )}
            {/* 計量後のリカバリー体重（準備中は常に表示。計量日を過ぎたら入力可） */}
            {waterCut && (() => {
              const weighInPassed = new Date(waterCut.weighInDatetime).getTime() <= Date.now();
              if (weighInPassed) {
                return (
                  <Link href="/u/watercut/recovery" className="todo-item" style={{ borderColor: "var(--green)" }}>
                    <span className="tk" style={{ fontSize: 18 }}>🥊</span>
                    <span className="tt">計量後のリカバリー<br /><span className="meta" style={{ fontWeight: 400 }}>戻した体重を入れるだけ。今回の準備データにまとまります</span></span>
                    <span className="ta">›</span>
                  </Link>
                );
              }
              return null;
            })()}
            <Link href="/u/history" className="small" style={{ display: "block", marginTop: 12 }}>過去の計量準備を見る ›</Link>
          </>
        )}
        </>
        )}
      </div>
      <UserTabbar active="record" />
    </>
  );
}
