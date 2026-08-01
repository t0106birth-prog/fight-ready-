import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { MorningForm } from "@/components/MorningForm";
import { activeWaterCut, currentWeight, latestWaterCutLog, isFightDay } from "@/lib/derive";
import { acuteLoss } from "@/lib/judge";
import { round1 } from "@/lib/calc";
import { today } from "@/lib/store";

export default async function MorningPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  if (isFightDay(db, user)) redirect("/u/record"); // 試合当日は記録オフ
  const cw = currentWeight(db, user) ?? undefined;
  const period = activeWaterCut(db, user.id);
  const todayCheck = db.dailyCheckins.find((c) => c.userId === user.id && c.date === today());
  const painDefaults = db.painLogs.filter((p) => p.userId === user.id && p.date === today());
  const wcLog = period ? latestWaterCutLog(db, user.id, period.id) : null;
  const latestMeasured = wcLog?.currentWeight ?? cw;
  const waterCut = period
    ? {
        baselineWeight: period.baselineWeight,
        targetWeight: period.targetWeight,
        currentWeight: latestMeasured ?? period.baselineWeight,
        currentLossPct: acuteLoss(period.baselineWeight, latestMeasured ?? period.baselineWeight).pct,
        remainingKg: Math.max(0, round1((latestMeasured ?? period.baselineWeight) - period.targetWeight)),
      }
    : undefined;
  return (
    <>
      <Hero title="朝のチェック" sub="15秒で完了" backHref="/u/record" />
      <div className="shell">
        {sp.error === "weight" && <div className="alert-band alert-red">体重は20〜300kgの範囲で入力してください。</div>}
        <MorningForm ownerId={user.id} defaultWeight={latestMeasured} waterCut={waterCut} defaults={todayCheck} painDefaults={painDefaults} />
      </div>
      <UserTabbar active="record" />
    </>
  );
}
