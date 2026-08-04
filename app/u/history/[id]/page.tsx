import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { periodSummary } from "@/lib/derive";
import { businessDate, fmtDateTime, round1, signed } from "@/lib/calc";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  const period = db.waterCutPeriods.find((p) => p.id === id && p.userId === user.id);
  if (!period) redirect("/u/history");

  const weights = db.waterCutLogs.filter((l) => l.periodId === id).sort((a, b) => a.recordedDatetime.localeCompare(b.recordedDatetime));
  const hydros = db.hydrationLogs.filter((h) => h.periodId === id).sort((a, b) => a.recordedDatetime.localeCompare(b.recordedDatetime));
  const recoveries = db.weighInRecoveries.filter((r) => r.periodId === id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const summary = periodSummary(db, period);
  const fightDay = [...recoveries].reverse().find((r) => r.isFightDay);
  const hasReview = Boolean(period.reviewWentWell || period.reviewDifficulties || period.reviewNextChanges);

  return (
    <>
      <Hero title="試合準備の詳細" sub={`${businessDate(new Date(period.weighInDatetime))} 計量`} backHref="/u/history" />
      <div className="shell">
        <div className="card">
          <div className="progress-row"><span>開始体重</span><b>{period.baselineWeight}kg</b></div>
          {period.cutBaselineWeight != null && <div className="progress-row"><span>水抜き開始体重</span><b>{period.cutBaselineWeight}kg</b></div>}
          <div className="progress-row"><span>計量目標</span><b>{period.targetWeight}kg</b></div>
          <div className="progress-row"><span>最終記録体重</span><b>{summary.finalWeight}kg</b></div>
          <div className="progress-row"><span>最大減少率</span><b>{signed(-summary.maxLossPct, "%")}（{signed(-summary.maxLossKg, "kg")}）</b></div>
          {summary.actualWeighInWeight != null && <div className="progress-row"><span>実測計量体重</span><b>{round1(summary.actualWeighInWeight)}kg</b></div>}
          <div className="progress-row"><span>症状の記録</span><b>{summary.symptomCount > 0 ? `${summary.symptomCount}回` : "なし"}</b></div>
          {fightDay && <div className="progress-row"><span>試合当日体重</span><b>{round1(fightDay.currentWeight)}kg</b></div>}
        </div>

        {hasReview && (
          <div className="card">
            <p className="kicker mt0">振り返り</p>
            {period.reviewWentWell && <div className="progress-row" style={{ alignItems: "flex-start" }}><span className="meta">うまくいったこと</span><b style={{ textAlign: "right", fontWeight: 500 }}>{period.reviewWentWell}</b></div>}
            {period.reviewDifficulties && <div className="progress-row" style={{ alignItems: "flex-start" }}><span className="meta">困ったこと</span><b style={{ textAlign: "right", fontWeight: 500 }}>{period.reviewDifficulties}</b></div>}
            {period.reviewNextChanges && <div className="progress-row" style={{ alignItems: "flex-start" }}><span className="meta">次回変えること</span><b style={{ textAlign: "right", fontWeight: 500 }}>{period.reviewNextChanges}</b></div>}
          </div>
        )}

        <p className="kicker">体重記録　{weights.length}件</p>
        <div className="card tight">
          {weights.length === 0 ? <p className="meta">記録なし</p> : weights.map((w) => (
            <div className="progress-row" key={w.id}><span>{fmtDateTime(w.recordedDatetime)}<span className="meta">　{w.source === "morning" ? "今日のチェック" : "手動"}</span></span><b>{round1(w.currentWeight)}kg / {signed(-w.acuteLossPercentage, "%")}</b></div>
          ))}
        </div>

        <p className="kicker">HYDRO　{hydros.length}件</p>
        <div className="card tight">
          {hydros.length === 0 ? <p className="meta">記録なし</p> : hydros.map((h) => (
            <div className="progress-row" key={h.id}><span>{fmtDateTime(h.recordedDatetime)}</span><span><b>{h.urineSpecificGravity?.toFixed(4) ?? "未測定"}</b>{h.symptoms?.length ? <span className="meta">　{h.symptoms.join("・")}</span> : null}</span></div>
          ))}
        </div>

        <p className="kicker">計量後の回復　{recoveries.length}件</p>
        <div className="card tight">
          {recoveries.length === 0 ? <p className="meta">記録なし</p> : recoveries.map((r) => (
            <div className="progress-row" key={r.id}><span>{fmtDateTime(r.recordedAt)} / {r.hoursSinceWeighIn}h</span><span><b>{round1(r.currentWeight)}kg</b>{r.isFightDay ? "　🥊" : ""}</span></div>
          ))}
        </div>
      </div>
      <UserTabbar active="record" />
    </>
  );
}
