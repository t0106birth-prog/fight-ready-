import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import Link from "next/link";
import { Hero, UserTabbar } from "@/components/Nav";
import { RecoveryQuickForm } from "@/components/RecoveryQuickForm";
import { activeWaterCut } from "@/lib/derive";
import { fmtDateTime, round1, signed, toDateTimeLocal } from "@/lib/calc";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role !== "pro") redirect("/u");
  const db = await getDb();
  const period = activeWaterCut(db, user.id);
  if (!period) redirect("/u/history");
  if (period.status !== "recovery" || period.actualWeighInWeight == null) redirect("/u/watercut");

  // 計量後の記録を時系列で（体重の戻りが見える）
  const recs = db.weighInRecoveries
    .filter((r) => r.userId === user.id && r.periodId === period.id)
    .sort((a, b) => ((a.recordedAt ?? a.createdAt) < (b.recordedAt ?? b.createdAt) ? 1 : -1));
  const weighInWeight = period.actualWeighInWeight;
  const fightDay = recs.find((r) => r.isFightDay);
  // 計量からの戻り率（％）。※「高い＝良い」ではなく、水抜き幅の大きさ＝体への負担の目安として観察する。
  const recPct = (r: { currentWeight: number; weighInWeight?: number }) =>
    r.weighInWeight ? Math.round(((r.currentWeight - r.weighInWeight) / r.weighInWeight) * 1000) / 10 : null;
  const fightPct = fightDay ? recPct(fightDay) : null;

  return (
    <>
      <Hero title="計量後の回復記録" sub="体重の戻りを記録・蓄積" backHref="/u/watercut" />
      <div className="shell">
        <div className="alert-band alert-blue">
          <div className="at">試合当日は集中でOK。後日でも記録できます</div>
          試合の日は競技に集中して、<b>あとから「測った日時」を選んで入力</b>すれば大丈夫です。水抜きを「終了」するまで、この画面はいつでも開けます。
        </div>
        {sp.error === "input" && <div className="alert-band alert-red">体重は20〜300kg、測定日時は計量後から現在までで入力してください。計量時体重は初回記録後に変更できません。</div>}
        {fightDay && (
          <>
            <div className="alert-band alert-green">
              <div className="at">🥊 試合当日の体重</div>
              <b style={{ fontSize: 22, fontStyle: "italic" }}>{round1(fightDay.currentWeight)}kg</b>
              {weighInWeight != null && (
                <span className="meta"> ／ 計量時 {round1(weighInWeight)}kg から {signed(fightDay.currentWeight - weighInWeight, "kg")}{fightPct != null && `（${signed(fightPct, "%")}）`}</span>
              )}
            </div>
            <div className="alert-band alert-yellow" style={{ marginTop: -4 }}>
              <b>戻り率は「高いほど良い」ではありません。</b>戻りが極端に大きいときは水抜き幅が大きかったことを表し、身体への負担も大きくなります。過去の自分の準備と比べる材料として見てください。
            </div>
          </>
        )}

        <RecoveryQuickForm
          ownerId={user.id}
          weighInWeight={weighInWeight}
          weighInLocked
          defaultRecordedAt={toDateTimeLocal()}
        />

        <Link href={`/u/history/${period.id}`} className="btn btn-ghost" style={{ width: "100%" }}>
          📚 今回の準備データ（水抜き→リカバリーの流れ）を見る
        </Link>

        {recs.length > 0 && (
          <>
            <p className="kicker">計量後の記録（新しい順）</p>
            <div className="card">
              <div className="table-scroll">
                <table className="list">
                  <thead><tr><th>記録日時</th><th>体重</th><th>計量から</th><th>戻り</th><th>戻り率</th><th></th></tr></thead>
                  <tbody>
                    {recs.map((r) => {
                      const p = recPct(r);
                      return (
                        <tr key={r.id}>
                          <td>{fmtDateTime(r.recordedAt ?? r.createdAt)}</td>
                          <td><b>{round1(r.currentWeight)}kg</b></td>
                          <td>{r.hoursSinceWeighIn >= 0 ? `${r.hoursSinceWeighIn}h` : "—"}</td>
                          <td>{r.weighInWeight ? signed(r.currentWeight - r.weighInWeight, "kg") : "—"}</td>
                          <td>{p != null ? signed(p, "%") : "—"}</td>
                          <td>{r.isFightDay ? "🥊試合当日" : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="info-note">計量から試合までの体重の戻りが時系列で残ります。摂取量や具体的な戻し方の指示は行いません。</p>
            </div>
          </>
        )}
      </div>
      <UserTabbar active="record" />
    </>
  );
}
