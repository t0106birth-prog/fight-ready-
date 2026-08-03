import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { LineChart, MetricRow, DayAxis, LoadBars, type CMarker } from "@/components/Chart";
import { weightProgress, acuteLoss } from "@/lib/judge";
import { activeWaterCut, latestWaterCutLog } from "@/lib/derive";
import { addDays, businessDate, round1, daysUntil, todayStr } from "@/lib/calc";

const lv = (m: Record<string, number>, v?: string) => (v && v in m ? m[v] : -1);

export default async function GraphsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  const view = sp.view === "load" || sp.view === "condition" ? sp.view : "weight";
  const isPro = user.role === "pro";
  const isMember = user.role === "member";
  const wc = activeWaterCut(db, user.id);

  const checks = db.dailyCheckins.filter((c) => c.userId === user.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const points = checks.filter((c) => c.weight != null).map((c) => ({ d: c.date, y: c.weight as number }));

  const effectiveTarget = isPro && wc ? wc.targetWeight : user.targetWeight ?? null;
  const goalReference = isPro && wc ? wc.baselineWeight : user.startWeight ?? (points.length ? points[0].y : null);
  const targetDirection = effectiveTarget != null && goalReference != null
    ? Math.sign(effectiveTarget - goalReference)
    : 0;
  const goalCoherent = effectiveTarget != null && goalReference != null && targetDirection !== 0
    && !(isPro && effectiveTarget >= goalReference);

  // 予定体重線。activeな計量準備では期間の開始体重・計量目標を優先する。
  let plan: { d: string; y: number }[] = [];
  if (isPro && wc && goalCoherent) {
    plan = [
      { d: businessDate(new Date(wc.startDatetime)), y: wc.baselineWeight },
      { d: businessDate(new Date(wc.weighInDatetime)), y: wc.targetWeight },
    ];
  } else if (goalCoherent && user.startWeight != null && user.targetWeight != null && user.targetDate) {
    const start = user.createdAt.slice(0, 10);
    plan = [{ d: start, y: user.startWeight }, { d: user.targetDate, y: user.targetWeight }];
  }

  // プロは計量日だけを目印にする（試合日は出さない。当日計量/前日計量の違いは計量日時で吸収）
  const markers: CMarker[] = [];
  if (isPro) {
    if (user.weighInAt) markers.push({ d: businessDate(new Date(user.weighInAt)), label: "計量", color: "#ff5348" });
  } else if (user.targetDate) {
    markers.push({ d: user.targetDate, label: "目標日", color: "#93a1b5" });
  }
  if (wc) markers.push({ d: businessDate(new Date(wc.startDatetime)), label: "水抜き開始", color: "#3d8bf0" });
  const loadingBand = wc ? {
    from: businessDate(new Date(wc.startDatetime)),
    to: wc.cutStartedAt ? businessDate(new Date(wc.cutStartedAt)) : todayStr(),
  } : null;
  const cutBand = wc?.cutStartedAt ? {
    from: businessDate(new Date(wc.cutStartedAt)),
    to: businessDate(new Date(wc.weighInDatetime)),
  } : null;

  const wp = weightProgress(user, db);
  const cw = points.length ? points[points.length - 1].y : (user.startWeight ?? null);
  const goalDistance = cw != null && effectiveTarget != null ? round1(Math.abs(cw - effectiveTarget)) : null;
  const goalReached = goalCoherent && cw != null && effectiveTarget != null
    ? (targetDirection < 0 ? cw <= effectiveTarget : cw >= effectiveTarget)
    : false;
  const wcLog = wc ? latestWaterCutLog(db, user.id, wc.id) : null;
  const wcCurrent = wcLog?.currentWeight ?? wc?.baselineWeight;
  const wcLossPct = wc && wcCurrent != null ? acuteLoss(wc.baselineWeight, wcCurrent).pct : null;
  // 一般会員は「スタートから −◯kg」で"続けて減っている嬉しさ"を主役にする
  const startW = user.startWeight ?? (points.length ? points[0].y : null);
  const lost = startW != null && cw != null ? round1(startW - cw) : null; // 正=減った
  // プロのカウントダウンは「計量日」ベースのみ（計量日未設定なら出さない＝目標日を"計量"と誤ラベルしない）
  const cdDate = user.weighInAt ? businessDate(new Date(user.weighInAt)) : undefined;
  const cdDays = daysUntil(cdDate);

  // 疲労・回復グラフ（直近14日）
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push(addDays(todayStr(), -i));
  }
  const byDate = new Map(checks.map((c) => [c.date, c]));
  const restByDate = new Map(db.restDayLogs.filter((r) => r.userId === user.id).map((r) => [r.date, r]));
  const painDates = new Set(db.painLogs.filter((p) => p.userId === user.id).map((p) => p.date));

  const fatigue = days.map((d) => ({ d, level: lv({ low: 0, mid: 1, high: 2 }, byDate.get(d)?.fatigueLevel) }));
  const sluggish = days.map((d) => ({ d, level: lv({ none: 0, some: 1, strong: 2 }, byDate.get(d)?.sluggishnessLevel) }));
  const sleep = days.map((d) => ({ d, level: lv({ good: 0, normal: 1, bad: 2 }, byDate.get(d)?.sleepQuality) }));
  const pain = days.map((d) => ({ d, level: painDates.has(d) ? 2 : byDate.has(d) ? 0 : -1 }));
  const recovery = days.map((d) => ({ d, level: lv({ much: 0, some: 0, same: 1, worse: 2 }, restByDate.get(d)?.recovery) }));

  // 各項目の「最近の状態」を言葉にする（色マスは補助にして、言葉で分かるようにする）
  const state = (cells: { level: number }[], words: [string, string, string]): { text: string; tone: string } => {
    const withData = cells.filter((c) => c.level >= 0);
    const recent = withData.slice(-3);
    if (recent.length === 0) return { text: "記録が少ない", tone: "muted" };
    let badRun = 0;
    for (let i = recent.length - 1; i >= 0; i--) { if (recent[i].level >= 2) badRun++; else break; }
    if (badRun >= 2) return { text: `${words[2]}が続いている`, tone: "red" };
    if (recent[recent.length - 1].level >= 2) return { text: words[2], tone: "red" };
    if (recent.some((r) => r.level >= 1)) return { text: words[1], tone: "amber" };
    return { text: words[0], tone: "green" };
  };
  const stFatigue = state(fatigue, ["良好", "やや疲れ", "疲れが強い"]);
  const stSluggish = state(sluggish, ["なし", "少しだるい", "だるさが強い"]);
  const stSleep = state(sleep, ["よく眠れている", "やや乱れ", "眠れていない"]);
  const stPain = state(pain, ["なし", "痛みあり", "痛みあり"]);
  const stRecovery = state(recovery, ["回復できている", "やや戻りが遅い", "回復が弱い"]);
  const concerns = [
    ["疲れ", stFatigue], ["だるさ", stSluggish], ["睡眠", stSleep], ["痛み", stPain], ["回復", stRecovery],
  ].filter(([, s]) => (s as { tone: string }).tone === "red" || (s as { tone: string }).tone === "amber")
    .map(([k, s]) => `${k}（${(s as { text: string }).text}）`);

  // 一般会員は疲労・だるさ・睡眠の"赤"を出さない（成長の途中なので警告しすぎない）。痛みだけは実サインなので残す
  const soften = (s: { text: string; tone: string }) => (isMember && s.tone === "red" ? { ...s, tone: "amber" } : s);
  // 一般会員向け：痛みが出ているか／トレーニングが効いている（疲れ等が上がっている）か
  const painConcern = stPain.tone === "red" || stPain.tone === "amber";
  const trainingEffect = [stFatigue, stSluggish, stSleep].some((s) => s.tone === "amber" || s.tone === "red");

  // 運動量（14日）：その日の負荷＝運動(時間×きつさ)＋ランニング(時間×5の目安)。普段比で色付けする。
  const loadByDate: Record<string, number> = {};
  db.activityLogs.filter((a) => a.userId === user.id).forEach((a) => {
    loadByDate[a.date] = (loadByDate[a.date] ?? 0) + (a.load ?? a.durationMinutes * (a.rpe ?? 5));
  });
  db.runningLogs.filter((r) => r.userId === user.id).forEach((r) => {
    loadByDate[r.date] = (loadByDate[r.date] ?? 0) + r.durationMinutes * 5;
  });
  const loads = days.map((d) => ({ d, load: loadByDate[d] ?? 0 }));
  const activeLoads = loads.filter((l) => l.load > 0);
  const avgLoad = activeLoads.length ? activeLoads.reduce((s, l) => s + l.load, 0) / activeLoads.length : 0;
  const spikeDays = avgLoad > 0 ? loads.filter((l) => l.load >= avgLoad * 1.8) : [];

  return (
    <>
      <Hero title="グラフ" sub="記録の振り返り" backHref="/u" />
      <div className="shell">
        <nav aria-label="グラフの表示切替" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginBottom: 14 }}>
          <Link href="/u/graphs?view=weight" className={`btn btn-sm ${view === "weight" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "weight" ? "page" : undefined}>体重</Link>
          <Link href="/u/graphs?view=load" className={`btn btn-sm ${view === "load" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "load" ? "page" : undefined}>運動</Link>
          <Link href="/u/graphs?view=condition" className={`btn btn-sm ${view === "condition" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "condition" ? "page" : undefined}>コンディション</Link>
        </nav>

        {view === "weight" && (
          <>
            <p className="kicker">体重</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
              <div className="card tight"><span className="meta">現在体重</span><br /><b>{cw != null ? `${round1(cw)}kg` : "未記録"}</b></div>
              {isPro && cdDays != null
                ? <div className="card tight"><span className="meta">計量まで</span><br /><b>{cdDays}日</b></div>
                : lost != null && <div className="card tight"><span className="meta">スタートから</span><br /><b>{lost > 0 ? "−" : lost < 0 ? "+" : "±"}{Math.abs(lost)}kg</b></div>}
              {isPro && wcLossPct != null
                ? <div className="card tight"><span className="meta">開始から</span><br /><b>−{wcLossPct}%</b></div>
                : goalCoherent && goalDistance != null && <div className="card tight"><span className="meta">目標まで</span><br /><b>{goalReached ? "目標到達" : `あと ${goalDistance}kg`}</b></div>}
            </div>

            {!goalCoherent && effectiveTarget != null && (
              <div className="alert-band alert-yellow"><b>目標設定を確認してください</b><br />現在の設定では正しい進捗評価ができないため、予定線と達成評価を表示していません。</div>
            )}
            {!isMember && !wc && goalCoherent && wp && <div className={`alert-band alert-${wp.level === "green" ? "green" : "yellow"}`}><b>{wp.text}</b></div>}
            <div className="card">
              <LineChart
                points={points}
                plan={goalCoherent ? plan : []}
                markers={markers}
                loadingBand={loadingBand}
                cutBand={cutBand}
                startY={isMember && startW != null ? startW : undefined}
                hLine={goalCoherent && effectiveTarget != null ? { y: effectiveTarget, label: `${isPro ? "計量目標" : "目標"} ${effectiveTarget}kg` } : null}
              />
            </div>
          </>
        )}

        {view === "load" && (
          <>
            <p className="kicker">運動量（負荷）</p>
            <div className="card">
              {isMember ? (
                activeLoads.length > 0 && (
                  <div className="alert-band alert-green" style={{ margin: "0 0 8px" }}>
                    <div className="at">よく動けています 💪</div>
                    少しずつ運動量を上げていくと、体が慣れてまた強くなれます（<b>漸進性過負荷の原則</b>）。増やせているのは良いサインです。
                  </div>
                )
              ) : (
                spikeDays.length > 0 && (
                  <div className="alert-band alert-yellow" style={{ margin: "0 0 8px" }}>
                    <div className="at">運動量が急に増えた日があります</div>
                    直近14日で <b>{spikeDays.length}日</b>、普段より大きく増えています。疲労・痛みの色と合わせて見てください。
                  </div>
                )
              )}
              <p className="meta mt0">
                棒の高さ＝その日の運動量。{isMember ? (
                  <>色は<b>普段との比べ</b>：<span style={{ color: "#6bb0ff" }}>■</span>いつも通り / <span style={{ color: "var(--green-bright)" }}>■</span>よく動けた</>
                ) : (
                  <>色は<b>普段（この期間の運動日の平均）との比べ</b>：<span style={{ color: "#6bb0ff" }}>■</span>普段どおり / <span style={{ color: "var(--amber-ink)" }}>■</span>やや多い / <span style={{ color: "var(--red-bright)" }}>■</span>急増</>
                )}
              </p>
              <LoadBars cells={loads} avg={avgLoad} coach={isMember} />
              <DayAxis days={days} />
              <p className="info-note">
                {isMember
                  ? "疲れが残るときは、しっかり食べて眠れば回復します。少しの疲れは強くなる過程です。"
                  : "運動量が上がった後は、コンディションの疲労・だるさ・痛みが赤くなっていないかを確認しましょう。"}
              </p>
            </div>
          </>
        )}

        {view === "condition" && (
          <>
            <p className="kicker">疲労・回復</p>
            <div className="card">
              {isMember ? (painConcern ? (
                <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}>
                  <div className="at">痛みが出ています</div>
                  痛みは「無理をしない」サイン。長く続くときは休みを入れるか、スタッフに相談しましょう。
                  <div style={{ marginTop: 6 }}>👐 <b>鍼・マッサージなどのボディケア</b>で早めに整えるのもおすすめです。</div>
                </div>
              ) : trainingEffect ? (
                <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
                  <div className="at">トレーニングが効いています 👍</div>
                  少しの疲れは体が強くなっている証。しっかり食べて眠れば回復します。この調子で続けましょう。
                  <div style={{ marginTop: 6 }}>👐 疲れを翌日に残さないために、<b>入浴・マッサージ・鍼・ストレッチなどのボディケア</b>で回復を助けるのがおすすめです。</div>
                </div>
              ) : (
                <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
                  良いリズムです 👍 この調子で続けましょう。
                  <div style={{ marginTop: 6 }}>👐 コンディション維持には、<b>入浴・マッサージ・鍼などのボディケア</b>を定期的に取り入れるのがおすすめです。</div>
                </div>
              )) : concerns.length > 0 ? (
                <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}><b>最近の気になること</b><br />{concerns.join(" / ")}</div>
              ) : (
                <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>この2週間、大きな乱れはありません 👍</div>
              )}
              <p className="info-note mt0">各項目の右に最近の状態を表示。色マスは左が14日前、右が今日です（緑＝良い・黄＝注意・赤＝強い不調・灰＝記録なし）。</p>
              <MetricRow label="疲労感" cells={fatigue} state={soften(stFatigue)} />
              <MetricRow label="だるさ" cells={sluggish} state={soften(stSluggish)} />
              <MetricRow label="睡眠" cells={sleep} state={soften(stSleep)} />
              <MetricRow label="痛み" cells={pain} state={stPain} />
              <MetricRow label="休養後の回復" cells={recovery} state={soften(stRecovery)} />
              <DayAxis days={days} />
              <p className="info-note">
                {isMember
                  ? "日ごとの上がり下がりは気にしすぎず、数日間の流れで見てください。痛みが続くときだけ無理をしないで。"
                  : "日単位の変化だけで過剰に判断せず、数日間の傾向も合わせて見てください。"}
              </p>
            </div>
          </>
        )}
      </div>
      <UserTabbar active="graphs" />
    </>
  );
}
