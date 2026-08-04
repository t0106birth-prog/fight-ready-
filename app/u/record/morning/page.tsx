import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { MorningForm } from "@/components/MorningForm";
import { MemberCheckForm } from "@/components/MemberCheckForm";
import { activeWaterCut, currentWeight, latestWaterCutLog, isFightDay, waterCutPhase } from "@/lib/derive";
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

  // 一般会員：時間帯に依存しない「今日のチェック」= 1日1回で主要記録を完了できる統合フォーム。
  if (user.role === "member") {
    const restDefaults = db.restDayLogs.find((r) => r.userId === user.id && r.date === today());
    const nutritionDefaults = db.nutritionLogs.find((n) => n.userId === user.id && n.date === today());
    return (
      <>
        <Hero title="今日のチェック" sub="約1分・1日1回でOK" backHref="/u/record" />
        <div className="shell">
          {sp.error === "weight" && <div className="alert-band alert-red">体重は20〜300kgの範囲で入力してください。</div>}
          <MemberCheckForm
            ownerId={user.id}
            defaultWeight={cw}
            defaults={todayCheck}
            painDefaults={painDefaults}
            restDefaults={restDefaults}
            nutritionDefaults={nutritionDefaults}
          />
        </div>
        <UserTabbar active="record" />
      </>
    );
  }

  const wcLog = period ? latestWaterCutLog(db, user.id, period.id) : null;
  const latestMeasured = wcLog?.currentWeight ?? cw;
  const phase = period ? waterCutPhase(period) : undefined;
  const phaseBaseline = period && phase && phase !== "loading"
    ? period.cutBaselineWeight ?? period.baselineWeight
    : period?.baselineWeight;
  const waterCut = period
    ? {
        phase: phase!,
        baselineWeight: phaseBaseline!,
        targetWeight: period.targetWeight,
        currentWeight: latestMeasured ?? period.baselineWeight,
        currentLossPct: acuteLoss(phaseBaseline!, latestMeasured ?? phaseBaseline!).pct,
        remainingKg: Math.max(0, round1((latestMeasured ?? period.baselineWeight) - period.targetWeight)),
      }
    : undefined;
  return (
    <>
      <Hero title="今日のチェック" sub="15秒で完了" backHref="/u/record" />
      <div className="shell">
        {sp.error === "weight" && <div className="alert-band alert-red">体重は20〜300kgの範囲で入力してください。</div>}
        <MorningForm ownerId={user.id} defaultWeight={latestMeasured} waterCut={waterCut} defaults={todayCheck} painDefaults={painDefaults} />
      </div>
      <UserTabbar active="record" />
    </>
  );
}
