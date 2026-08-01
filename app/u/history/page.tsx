import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { acuteLoss } from "@/lib/judge";
import { businessDate, fmtDateTime, round1, signed } from "@/lib/calc";
import Link from "next/link";

/**
 * 過去の水抜き・試合準備の履歴(§4-1)。
 * 水抜き期間を1件＝1準備として新しい順に蓄積表示。終了した準備と現在進行中を区別する。
 */
export default async function HistoryPage() {
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();

  const periods = db.waterCutPeriods
    .filter((p) => p.userId === user.id)
    .sort((a, b) => (a.startDatetime < b.startDatetime ? 1 : -1));
  const unassignedRecoveries = db.weighInRecoveries
    .filter((r) => r.userId === user.id && !r.periodId)
    .sort((a, b) => (b.recordedAt ?? b.createdAt).localeCompare(a.recordedAt ?? a.createdAt));
  const comparison = periods.slice(0, 2).map((p) => {
    const logs = db.waterCutLogs.filter((l) => l.periodId === p.id).sort((a, b) => b.recordedDatetime.localeCompare(a.recordedDatetime));
    const finalWeight = logs[0]?.currentWeight ?? p.baselineWeight;
    const loss = acuteLoss(p.baselineWeight, finalWeight);
    const latestHydro = db.hydrationLogs.filter((h) => h.periodId === p.id).sort((a, b) => b.recordedDatetime.localeCompare(a.recordedDatetime))[0];
    const latestRecovery = db.weighInRecoveries.filter((r) => r.periodId === p.id).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    return { p, loss, latestHydro, latestRecovery };
  });

  return (
    <>
      <Hero title="過去の水抜き・試合準備" sub="1件ずつ蓄積されます" backHref={user.role === "pro" ? "/u/watercut" : "/u"} />
      <div className="shell">
        {unassignedRecoveries.length > 0 && (
          <div className="alert-band alert-yellow">
            <div className="at">未紐付けの旧回復記録</div>
            以前の形式で保存された回復記録が{unassignedRecoveries.length}件あります。大会へ自動紐付けせず、記録を保持して表示しています。
            <div className="meta" style={{ marginTop: 6 }}>
              {unassignedRecoveries.slice(0, 3).map((r) => `${fmtDateTime(r.recordedAt ?? r.createdAt)} ${round1(r.currentWeight)}kg`).join(" / ")}
            </div>
          </div>
        )}
        {periods.length === 0 && (
          <div className="card"><p className="meta mt0">まだ記録がありません。水抜きを開始すると、ここに準備が1件ずつ貯まっていきます。</p></div>
        )}

        {comparison.length === 2 && (
          <div className="card tight">
            <b>直近2回の比較</b>
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table className="reftable">
                <thead><tr><th></th>{comparison.map((x) => <th key={x.p.id}>{businessDate(new Date(x.p.weighInDatetime))}</th>)}</tr></thead>
                <tbody>
                  <tr><td className="k">開始→目標</td>{comparison.map((x) => <td key={x.p.id}>{x.p.baselineWeight}→{x.p.targetWeight}kg</td>)}</tr>
                  <tr><td className="k">実績</td>{comparison.map((x) => <td key={x.p.id}>{signed(-x.loss.kg, "kg")} / {signed(-x.loss.pct, "%")}</td>)}</tr>
                  <tr><td className="k">最終USG</td>{comparison.map((x) => <td key={x.p.id}>{x.latestHydro?.urineSpecificGravity?.toFixed(4) ?? "—"}</td>)}</tr>
                  <tr><td className="k">回復後</td>{comparison.map((x) => <td key={x.p.id}>{x.latestRecovery ? `${x.latestRecovery.currentWeight}kg` : "—"}</td>)}</tr>
                  <tr><td className="k">戻り</td>{comparison.map((x) => {
                    const w = x.latestRecovery?.weighInWeight ?? x.p.actualWeighInWeight;
                    const c = x.latestRecovery?.currentWeight;
                    const rp = w && c != null ? Math.round(((c - w) / w) * 1000) / 10 : null;
                    return <td key={x.p.id}>{w && c != null ? `${signed(c - w, "kg")} / ${rp != null ? signed(rp, "%") : "—"}` : "—"}</td>;
                  })}</tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {periods.map((p, idx) => {
          const logs = db.waterCutLogs.filter((l) => l.periodId === p.id).sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1));
          const finalWeight = logs[0]?.currentWeight ?? p.baselineWeight;
          const { kg, pct } = acuteLoss(p.baselineWeight, finalWeight);
          const recs = db.weighInRecoveries.filter((r) => r.userId === user.id && r.periodId === p.id)
            .sort((a, b) => ((a.recordedAt ?? a.createdAt) < (b.recordedAt ?? b.createdAt) ? 1 : -1));
          const fightDay = recs.find((r) => r.isFightDay);
          const hydrated = db.hydrationLogs
            .filter((h) => h.periodId === p.id && (h.urineSpecificGravity ?? 9) <= 1.025 && h.simultaneousWeight != null)
            .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1))[0];
          return (
            <div className="card" key={p.id}>
              <div className="row">
                <b>#{periods.length - idx}　{businessDate(new Date(p.weighInDatetime))} 計量</b>
                <span className={`badge ${p.status !== "done" ? "badge-attn" : ""}`}>{p.status === "active" ? "水抜き中" : p.status === "recovery" ? "回復中" : "終了"}</span>
              </div>
              <div className="progress-row"><span>基準体重 → 計量目標</span><b>{p.baselineWeight}kg → {p.targetWeight}kg</b></div>
              <div className="progress-row"><span>最終記録体重</span><b>{round1(finalWeight)}kg</b></div>
              <div className="progress-row"><span>開始からの変化</span><b>{signed(-kg, "kg")}（{signed(-pct, "%")}）</b></div>
              {p.actualWeighInWeight != null && <div className="progress-row"><span>実測計量体重</span><b>{round1(p.actualWeighInWeight)}kg</b></div>}
              {hydrated && <div className="progress-row"><span>ハイドレーテッド体重</span><b>{round1(hydrated.simultaneousWeight!)}kg</b></div>}
              {p.status !== "active" && fightDay && (() => {
                const w = fightDay.weighInWeight ?? p.actualWeighInWeight;
                const rp = w ? Math.round(((fightDay.currentWeight - w) / w) * 1000) / 10 : null;
                return (
                  <div className="progress-row">
                    <span>🥊 試合当日体重</span>
                    <b>{round1(fightDay.currentWeight)}kg{w != null && ` ／ 戻り ${signed(fightDay.currentWeight - w, "kg")}${rp != null ? `（${signed(rp, "%")}）` : ""}`}</b>
                  </div>
                );
              })()}
              {recs.length > 0 && <div className="progress-row"><span>計量後の回復記録</span><b>{recs.length}件</b></div>}
              <p className="meta" style={{ marginBottom: 0 }}>開始 {fmtDateTime(p.startDatetime)} ／ 記録 {logs.length}件</p>
              <Link href={`/u/history/${p.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>この準備の詳細を見る</Link>
            </div>
          );
        })}
        <p className="info-note center" style={{ marginTop: 12 }}>過去の準備と見比べて、今回の減り方や仕上がりを確認できます。</p>
      </div>
      <UserTabbar active="record" />
    </>
  );
}
