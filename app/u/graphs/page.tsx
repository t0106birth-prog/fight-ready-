import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { LineChart, MetricRow, DayAxis, LoadBars, type CMarker } from "@/components/Chart";
import { weightProgress, acuteLoss, cutLoad, runningLoad } from "@/lib/judge";
import { activeWaterCut, latestWaterCutLog, periodSummary } from "@/lib/derive";
import { addDays, businessDate, round1, daysUntil, todayStr, fmtDate } from "@/lib/calc";

const lv = (m: Record<string, number>, v?: string) => (v && v in m ? m[v] : -1);

export default async function GraphsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  // 運動とコンディションは1画面に統合（負荷↔体調の関係を一目で見せる）。旧 ?view=load / ?view=condition は統合ビューへ。
  const view = sp.view === "load" || sp.view === "condition" || sp.view === "activity" ? "activity" : "weight";
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
    if (user.weighInAt) { const wd = businessDate(new Date(user.weighInAt)); markers.push({ d: wd, label: `計量 ${fmtDate(wd)}`, color: "#ff5348" }); }
  } else if (user.targetDate) {
    markers.push({ d: user.targetDate, label: `目標日 ${fmtDate(user.targetDate)}`, color: "#93a1b5" });
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

  // 「計量まで あと◯kg（現在体重の◯%）」＋減量負荷。減量ゴールで、まだ目標より重いときだけ。
  const remainKg = cw != null && effectiveTarget != null && cw > effectiveTarget ? round1(cw - effectiveTarget) : null;
  const remainPct = cw != null && effectiveTarget != null && cw > effectiveTarget ? round1(((cw - effectiveTarget) / cw) * 100) : null;
  // その選手の過去最大減量%（完了した水抜きから）。断定せず併記して本人・コーチが解釈する材料に。
  const pastPcts = db.waterCutPeriods.filter((p) => p.userId === user.id && p.status === "done").map((p) => periodSummary(db, p).maxLossPct);
  const pastMaxPct = pastPcts.length ? Math.max(...pastPcts) : null;
  // 減量負荷はプロ（計量日ベース）のみ。一般会員は「あと◯kg（現在の◯%）」だけ。
  const load = isPro && remainPct != null ? cutLoad(remainPct, cdDays) : null;

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
  // 回復は「今朝の回復（朝チェック）」を優先。無ければ旧・休養日の回復（後方互換）。
  const recovery = days.map((d) => ({ d, level: lv({ much: 0, some: 0, same: 1, worse: 2 }, byDate.get(d)?.morningRecovery ?? restByDate.get(d)?.recovery) }));

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
    // ランニングは強度別に重み付け（軽いジョグと高強度インターバルを区別・毎日走る負荷の地味な蓄積を実態に合わせる）
    loadByDate[r.date] = (loadByDate[r.date] ?? 0) + runningLoad(r.category, r.durationMinutes, r.legCondition);
  });
  const loads = days.map((d) => ({ d, load: loadByDate[d] ?? 0 }));
  const activeLoads = loads.filter((l) => l.load > 0);
  const avgLoad = activeLoads.length ? activeLoads.reduce((s, l) => s + l.load, 0) / activeLoads.length : 0;
  const spikeDays = avgLoad > 0 ? loads.filter((l) => l.load >= avgLoad * 1.8) : [];

  return (
    <>
      <Hero title="グラフ" sub="記録の振り返り" backHref="/u" />
      <div className="shell">
        <nav aria-label="グラフの表示切替" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 14 }}>
          <Link href="/u/graphs?view=weight" className={`btn btn-sm ${view === "weight" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "weight" ? "page" : undefined}>体重</Link>
          <Link href="/u/graphs?view=activity" className={`btn btn-sm ${view === "activity" ? "btn-primary" : "btn-ghost"}`} aria-current={view === "activity" ? "page" : undefined}>運動・コンディション</Link>
        </nav>

        {view === "weight" && (
          <>
            <p className="kicker">体重</p>

            {/* 計量まで あと◯kg（現在体重の◯%）＋減量負荷（プロのみ）。減量ゴールで目標より重いとき大きく出す。 */}
            {remainKg != null ? (
              <div className="card" style={{ textAlign: "center", borderColor: load ? (load.tone === "red" ? "var(--red)" : load.tone === "yellow" ? "var(--amber)" : "var(--green)") : "var(--amber)" }}>
                <div className="meta">{isPro && cdDate ? `計量（${fmtDate(cdDate)}）まで` : "目標まで"}</div>
                <div style={{ fontSize: 36, fontWeight: 800, fontStyle: "italic", lineHeight: 1.1 }}>あと {remainKg}<span style={{ fontSize: 17 }}>kg</span></div>
                <div className="meta">現在体重の {remainPct}%{isPro && cdDays != null && cdDays >= 0 ? ` ・ 計量まで ${cdDays}日` : ""}</div>
                {load && (
                  <div style={{ marginTop: 10 }}>
                    <span className={`sig sig-${load.tone}`} style={{ fontSize: 14 }}>減量負荷：{load.label}</span>
                    {load.weeklyPct != null && <span className="meta"> ／ 必要ペース 週{load.weeklyPct}%</span>}
                    {pastMaxPct != null && <span className="meta"> ／ 過去最大 −{pastMaxPct}%</span>}
                    <p className="info-note" style={{ margin: "6px 0 0" }}>{load.note}</p>
                  </div>
                )}
              </div>
            ) : goalReached ? (
              <div className="alert-band alert-green"><b>🎯 目標体重に到達しています</b></div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
              <div className="card tight"><span className="meta">現在体重</span><br /><b>{cw != null ? `${round1(cw)}kg` : "未記録"}</b></div>
              {isPro && cdDays != null
                ? <div className="card tight"><span className="meta">計量まで</span><br /><b>{cdDays}日</b></div>
                : lost != null && <div className="card tight"><span className="meta">スタートから</span><br /><b>{lost > 0 ? "−" : lost < 0 ? "+" : "±"}{Math.abs(lost)}kg</b></div>}
              {isPro && wcLossPct != null && (
                <div className="card tight"><span className="meta">水抜き開始から</span><br /><b>{wcLossPct > 0 ? "−" : wcLossPct < 0 ? "+" : "±"}{Math.abs(wcLossPct)}%</b></div>
              )}
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

        {view === "activity" && (
          <>
            <p className="kicker">運動 × コンディション</p>
            <div className="card">
              {(() => {
                // 負荷が上がっているか / コンディションが乱れているか、の2軸で一言まとめる。
                const loadUp = isMember ? activeLoads.length > 0 : spikeDays.length > 0;
                if (isMember) {
                  if (painConcern) return (
                    <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}>
                      <div className="at">痛みが出ています</div>
                      運動量（棒）と痛みの色を合わせて見てください。続くときは休みを入れるか、スタッフに相談しましょう。
                      <div style={{ marginTop: 6 }}>👐 <b>鍼・マッサージなどのボディケア</b>で早めに整えるのもおすすめです。</div>
                    </div>
                  );
                  if (loadUp && trainingEffect) return (
                    <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
                      <div className="at">よく動けています 💪 疲れは強くなる過程</div>
                      運動量が上がって体はしっかり反応しています。よく食べて眠れば回復します。この調子で。
                    </div>
                  );
                  if (loadUp) return (
                    <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
                      <div className="at">運動量が上がっても、コンディションは安定 👍</div>
                      体が慣れてきています。少しずつ増やせているのは良いサインです。
                    </div>
                  );
                  return <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>良いリズムです 👍 この調子で続けましょう。</div>;
                }
                // プロ：負荷↔体調の関係を主役にする
                if (loadUp && concerns.length > 0) return (
                  <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}>
                    <div className="at">運動量が増えた日のあと、コンディションに乱れ</div>
                    直近14日で <b>{spikeDays.length}日</b> 運動量が急増しています。負荷が上がった列の下で、色（{concerns.join(" / ")}）が黄・赤になっていないか見比べてください。
                  </div>
                );
                if (loadUp) return (
                  <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>
                    <div className="at">運動量は上がっていますが、コンディションは保てています 👍</div>
                    負荷が増えても体調が崩れていなければ、うまく順応できています。この調子で。
                  </div>
                );
                if (concerns.length > 0) return (
                  <div className="alert-band alert-yellow" style={{ margin: "0 0 10px" }}><b>最近の気になること</b><br />{concerns.join(" / ")}</div>
                );
                return <div className="alert-band alert-green" style={{ margin: "0 0 10px" }}>この2週間、運動もコンディションも大きな乱れはありません 👍</div>;
              })()}

              {/* 上＝運動量（棒）、下＝コンディション（色マス）。同じ列＝同じ日でそろえて、負荷↔体調を縦に見比べる。 */}
              <div className="row" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>運動量（負荷）</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {isMember
                    ? <><span style={{ color: "#6bb0ff" }}>■</span>いつも通り / <span style={{ color: "var(--green-bright)" }}>■</span>よく動けた</>
                    : <><span style={{ color: "#6bb0ff" }}>■</span>普段どおり / <span style={{ color: "var(--amber-ink)" }}>■</span>やや多い / <span style={{ color: "var(--red-bright)" }}>■</span>急増</>}
                </span>
              </div>
              <LoadBars cells={loads} avg={avgLoad} coach={isMember} />

              <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0 10px" }} />

              <p className="info-note mt0" style={{ marginBottom: 8 }}>コンディション：緑＝良い・黄＝注意・赤＝強い不調・灰＝記録なし。上の運動量と同じ列＝同じ日です。</p>
              <MetricRow label="疲労感" cells={fatigue} state={soften(stFatigue)} />
              <MetricRow label="だるさ" cells={sluggish} state={soften(stSluggish)} />
              <MetricRow label="睡眠" cells={sleep} state={soften(stSleep)} />
              <MetricRow label="痛み" cells={pain} state={stPain} />
              <MetricRow label="今朝の回復" cells={recovery} state={soften(stRecovery)} />
              <DayAxis days={days} />

              <p className="info-note">
                {isMember
                  ? "運動量（棒）が上がった日の前後で、コンディションの色が黄・赤に変わっていないかを見てください。痛みが続くときだけ無理をしないで。"
                  : "運動量（棒）が上がった列の後ろで、疲労・だるさ・痛みの色が赤くなっていないかを見ます。上がっても色が変わらなければ、うまく順応できています。"}
              </p>
            </div>
          </>
        )}
      </div>
      <UserTabbar active="graphs" />
    </>
  );
}
