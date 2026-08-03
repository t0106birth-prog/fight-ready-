"use server";

import { redirect } from "next/navigation";
import { currentUser, setSession } from "@/lib/auth";
import { getDb, mutateDb, uid, nowIso, today, appendRow, history } from "@/lib/store";
import { acuteLoss } from "@/lib/judge";
import { businessDate, fromDateTimeLocal, hoursBetweenIso } from "@/lib/calc";
import type {
  DailyCheckin, PainLog, ActivityLog, RunningLog, RestDayLog, NutritionLog,
  WaterCutPeriod, WaterCutLog, HydrationLog, WeighInRecovery, PtInquiry, User,
} from "@/lib/types";

async function me() {
  const u = await currentUser();
  if (!u || u.role === "staff") redirect("/");
  return u!;
}

/**
 * 水抜き系は選手専用。画面はpro限定だが、ロール変更前に開いた古い画面から送信される場合に備え、
 * 送信時点でも pro であることを再確認する（member/一般に落ちていたら拒否）。
 */
async function mePro() {
  const u = await me();
  if (u.role !== "pro") redirect("/u?error=notpro");
  return u;
}

/**
 * 古いフォーム対策(P0)：別タブで他ユーザーにログインし直すとCookieが全タブ共通で切り替わる。
 * その状態で古いフォームを送ると"今のCookie利用者"のデータとして保存されてしまう。
 * フォームに埋めた ownerId が現在の利用者と食い違えば拒否する。
 */
async function assertOwner(formData: FormData, u: { id: string }) {
  const ownerId = str(formData, "ownerId");
  if (ownerId && ownerId !== u.id) redirect("/u?error=switched");
}

/** QR/コードでジムに参加（紐付け先を切り替える）。生コードでも /register?gym=CODE のURLでも受ける。 */
export async function joinGymByCodeAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const db = await getDb();
  const raw = String(formData.get("code") || "").trim();
  let code = raw.toUpperCase();
  const m = raw.match(/[?&]gym=([^&\s]+)/i);
  if (m) code = decodeURIComponent(m[1]).toUpperCase();
  const gym = db.gyms.find((g) => g.code.toUpperCase() === code && !g.suspended);
  if (!gym) redirect("/u/mypage?e=gymcode");
  await mutateDb((d) => {
    const user = d.users.find((x) => x.id === u.id);
    if (user) user.gymId = gym!.id;
  });
  await setSession({ userId: u.id, gymId: gym!.id, role: u.role }, true);
  await history(gym!.id, u.id, "join_gym", gym!.code);
  redirect("/u/mypage?saved=gym");
}
const str = (f: FormData, k: string) => String(f.get(k) || "").trim();
const numOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  const n = v ? Number(v) : null;
  return n != null && Number.isFinite(n) ? n : null; // "abc"→NaN を弾く（?? をすり抜けて NaN が混入するのを防ぐ）
};
const numOrU = (f: FormData, k: string) => {
  const v = str(f, k);
  const n = v ? Number(v) : undefined;
  return n != null && Number.isFinite(n) ? n : undefined;
};
const validWeight = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 20 && v <= 300;

/** 朝のチェック(§14) + 体重 + 痛み場所(§15) */
export async function saveMorningAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const date = today();
  // 一般会員の「今日のチェック」統合フォームからの保存か。運動・食事もまとめて保存し、
  // この画面に無い水抜き系の項目（尿・お通じ・危険症状など）は既存値を保持して勝手に消さない。
  const isMemberCheck = str(formData, "memberCheck") === "1";
  const before = await getDb();
  const existing = before.dailyCheckins.find((c) => c.userId === u.id && c.date === date);
  const enteredWeight = numOrNull(formData, "weight");
  if (enteredWeight != null && !validWeight(enteredWeight)) redirect("/u/record/morning?error=weight");
  // 同日の既存チェックインを置き換える
  const checkin: DailyCheckin = {
    id: existing?.id ?? uid(), gymId: u.gymId, userId: u.id, date,
    weight: enteredWeight,
    sleepQuality: (str(formData, "sleep") || undefined) as DailyCheckin["sleepQuality"],
    fatigueLevel: (str(formData, "fatigue") || undefined) as DailyCheckin["fatigueLevel"],
    sluggishnessLevel: (str(formData, "sluggish") || undefined) as DailyCheckin["sluggishnessLevel"],
    painLevel: (str(formData, "pain") || "none") as DailyCheckin["painLevel"],
    otherSymptoms: isMemberCheck ? existing?.otherSymptoms : formData.getAll("other").map(String),
    urineColor: (isMemberCheck ? existing?.urineColor : (str(formData, "urineColor") || undefined)) as DailyCheckin["urineColor"],
    hydrationThirst: (isMemberCheck ? existing?.hydrationThirst : (str(formData, "hydrationThirst") || undefined)) as DailyCheckin["hydrationThirst"],
    urineVolumeStatus: (isMemberCheck ? existing?.urineVolumeStatus : (str(formData, "urineVolumeStatus") || undefined)) as DailyCheckin["urineVolumeStatus"],
    bowel: (isMemberCheck ? existing?.bowel : (str(formData, "bowel") || undefined)) as DailyCheckin["bowel"],
    dangerSymptoms: isMemberCheck ? existing?.dangerSymptoms : formData.getAll("danger").map(String),
    freeNote: str(formData, "note") || undefined,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  // 痛み場所（部位ごと）
  const parts = formData.getAll("painParts").map(String);
  const painLogs: PainLog[] = parts.map((locationId) => ({
    id: uid(), gymId: u.gymId, userId: u.id, date, locationId,
    painLevel: (numOrU(formData, `painLv_${locationId}`) as 1 | 2 | 3) || 1,
    newOrContinuing: (str(formData, `painNew_${locationId}`) || "new") as PainLog["newOrContinuing"],
    changeStatus: (str(formData, `painChg_${locationId}`) || "same") as PainLog["changeStatus"],
    createdAt: nowIso(),
  }));

  // 一般会員の統合フォーム：運動/休養・食事のかんたん回答を既存テーブルへ反映する。
  const dayChoice = isMemberCheck ? str(formData, "dayChoice") : "";
  const nutritionGoal = isMemberCheck ? str(formData, "nutritionGoal") : "";

  let syncedWaterCut = false;
  await mutateDb((d) => {
    d.dailyCheckins = d.dailyCheckins.filter((c) => !(c.userId === u.id && c.date === date));
    d.dailyCheckins.push(checkin);
    d.painLogs = d.painLogs.filter((p) => !(p.userId === u.id && p.date === date));
    d.painLogs.push(...painLogs);

    // 運動/休養のかんたん記録：日の区分(dayType)だけを更新し、既存の回復・行動記録は保持する。
    if (dayChoice === "trained" || dayChoice === "rest") {
      const dayType = dayChoice === "trained" ? "通常練習日" : "完全休養日";
      const rest = d.restDayLogs.find((r) => r.userId === u.id && r.date === date);
      if (rest) {
        rest.dayType = dayType;
      } else {
        d.restDayLogs.push({ id: uid(), gymId: u.gymId, userId: u.id, date, dayType, createdAt: nowIso() });
      }
    }

    // 食事達成度：達成度(goalAchieved)を更新し、既存の内訳(朝昼夜など)は保持する。
    if (nutritionGoal === "done" || nutritionGoal === "partial" || nutritionGoal === "none") {
      const existingNut = d.nutritionLogs.find((n) => n.userId === u.id && n.date === date);
      d.nutritionLogs = d.nutritionLogs.filter((n) => !(n.userId === u.id && n.date === date));
      d.nutritionLogs.push({
        ...(existingNut ?? { id: uid(), gymId: u.gymId, userId: u.id, date, createdAt: nowIso() }),
        goalAchieved: nutritionGoal as NutritionLog["goalAchieved"],
      });
    }

    // 水抜き中は朝の体重を同日の水抜きログにも反映し、二重入力を避ける。
    const period = d.waterCutPeriods.find((p) => p.userId === u.id && p.status === "active");
    if (period && checkin.weight != null) {
      const previousMorning = d.waterCutLogs
        .filter((l) => l.periodId === period.id && l.source === "morning" && businessDate(new Date(l.recordedDatetime)) === date)
        .sort((a, b) => b.recordedDatetime.localeCompare(a.recordedDatetime))[0];
      const newerManualExists = Boolean(existing && d.waterCutLogs.some((l) =>
        l.periodId === period.id && l.source === "manual" &&
        (!previousMorning || l.recordedDatetime > previousMorning.recordedDatetime)
      ));
      if (newerManualExists) return;
      const loss = acuteLoss(period.baselineWeight, checkin.weight);
      const timestamp = nowIso();
      d.waterCutLogs = d.waterCutLogs.filter((l) => !(
        l.periodId === period.id && l.source === "morning" && businessDate(new Date(l.recordedDatetime)) === date
      ));
      d.waterCutLogs.push({
        id: uid(), gymId: u.gymId, userId: u.id, periodId: period.id,
        currentWeight: checkin.weight, acuteLossKg: loss.kg, acuteLossPercentage: loss.pct,
        source: "morning", recordedDatetime: timestamp, createdAt: timestamp,
      });
      syncedWaterCut = true;
    }
  });
  await history(u.gymId, u.id, isMemberCheck ? "member_check" : "morning_check");
  if (syncedWaterCut) await history(u.gymId, u.id, "watercut_daily_sync");
  redirect(isMemberCheck ? "/u/record?saved=check" : "/u/record?saved=morning");
}

/** 運動記録(§16) */
export async function saveActivityAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const min = numOrU(formData, "duration") ?? 0;
  const rpe = numOrU(formData, "rpe");
  const log: ActivityLog = {
    id: uid(), gymId: u.gymId, userId: u.id, date: today(),
    activityType: str(formData, "type") || "その他",
    durationMinutes: min,
    rpe,
    movementFeeling: (str(formData, "feel") || undefined) as ActivityLog["movementFeeling"],
    sweatLevel: (str(formData, "sweat") || undefined) as ActivityLog["sweatLevel"],
    load: rpe ? min * rpe : undefined,
    createdAt: nowIso(),
  };
  await appendRow("activityLogs", log);
  await mutateDb((d) => {
    const rest = d.restDayLogs.find((r) => r.userId === u.id && r.date === log.date);
    if (rest?.dayType === "完全休養日") rest.dayType = "通常練習日";
  });
  // 来館も記録
  await recordAttendance(u.gymId, u.id);
  await history(u.gymId, u.id, "activity");
  // 2部練・3部練に対応：保存後は運動画面に戻り、続けて追加できるようにする
  redirect("/u/record/activity?saved=1");
}

/** 運動記録（部練）の更新 */
export async function updateActivityAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const id = str(formData, "id");
  const min = numOrU(formData, "duration") ?? 0;
  const rpe = numOrU(formData, "rpe");
  await mutateDb((d) => {
    const a = d.activityLogs.find((x) => x.id === id && x.userId === u.id);
    if (!a) return;
    a.activityType = str(formData, "type") || a.activityType;
    a.durationMinutes = min;
    a.rpe = rpe;
    a.movementFeeling = (str(formData, "feel") || undefined) as ActivityLog["movementFeeling"];
    a.sweatLevel = (str(formData, "sweat") || undefined) as ActivityLog["sweatLevel"];
    a.load = rpe ? min * rpe : undefined;
  });
  await history(u.gymId, u.id, "activity_update");
  redirect("/u/record/activity?saved=1");
}

/** 運動記録（部練）の削除 */
export async function deleteActivityAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const id = str(formData, "id");
  await mutateDb((d) => {
    d.activityLogs = d.activityLogs.filter((a) => !(a.id === id && a.userId === u.id));
  });
  await history(u.gymId, u.id, "activity_delete");
  redirect("/u/record/activity?saved=del");
}

/** ランニング記録(§17) — rpe は使わない */
export async function saveRunningAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const log: RunningLog = {
    id: uid(), gymId: u.gymId, userId: u.id, date: today(),
    category: str(formData, "category") || "ジョギング",
    durationMinutes: numOrU(formData, "duration") ?? 0,
    distanceKm: numOrU(formData, "distance"),
    averagePace: str(formData, "pace") || undefined,
    dashCount: numOrU(formData, "dashCount"),
    dashDurationOrDistance: str(formData, "dashUnit") || undefined,
    restDuration: str(formData, "rest") || undefined,
    legCondition: (str(formData, "leg") || undefined) as RunningLog["legCondition"],
    createdAt: nowIso(),
  };
  await appendRow("runningLogs", log);
  await mutateDb((d) => {
    const rest = d.restDayLogs.find((r) => r.userId === u.id && r.date === log.date);
    if (rest?.dayType === "完全休養日") rest.dayType = "通常練習日";
  });
  await recordAttendance(u.gymId, u.id);
  await history(u.gymId, u.id, "running");
  redirect("/u/record?saved=running");
}

/** オフ日・休養日 + 夜の回復チェック(§18) */
export async function saveRestAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const date = today();
  const db = await getDb();
  const existing = db.restDayLogs.find((r) => r.userId === u.id && r.date === date);
  const source = str(formData, "source") || "night";
  const log: RestDayLog = {
    id: existing?.id ?? uid(), gymId: u.gymId, userId: u.id, date,
    dayType: source === "day" ? (str(formData, "dayType") || "完全休養日") : (existing?.dayType || ""),
    recovery: (source === "night" ? str(formData, "recovery") : existing?.recovery) as RestDayLog["recovery"],
    actions: formData.has("actionsPresent") ? formData.getAll("actions").map(String) : existing?.actions,
    painChange: (source === "night" ? str(formData, "painChange") : existing?.painChange) as RestDayLog["painChange"],
    createdAt: existing?.createdAt ?? nowIso(),
  };
  await mutateDb((d) => {
    d.restDayLogs = d.restDayLogs.filter((r) => !(r.userId === u.id && r.date === log.date));
    d.restDayLogs.push(log);
  });
  await history(u.gymId, u.id, "rest_day");
  redirect("/u/record?saved=rest");
}

/** 食事達成度(§21) */
export async function saveNutritionAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const v = (k: string) => (str(formData, k) || undefined) as NutritionLog["breakfast"];
  const log: NutritionLog = {
    id: uid(), gymId: u.gymId, userId: u.id, date: today(),
    goalAchieved: (str(formData, "goal") || "partial") as NutritionLog["goalAchieved"],
    breakfast: v("breakfast"), lunch: v("lunch"), dinner: v("dinner"),
    snack: v("snack"), hydration: v("hydration"),
    createdAt: nowIso(),
  };
  await mutateDb((d) => {
    d.nutritionLogs = d.nutritionLogs.filter((n) => !(n.userId === u.id && n.date === log.date));
    d.nutritionLogs.push(log);
  });
  await history(u.gymId, u.id, "nutrition");
  redirect("/u/record?saved=nutrition");
}

async function recordAttendance(gymId: string, userId: string) {
  const db = await getDb();
  if (db.attendanceLogs.some((a) => a.userId === userId && a.date === today())) return;
  await appendRow("attendanceLogs", { id: uid(), gymId, userId, date: today(), createdAt: nowIso() });
}

/* ───────── 水抜き(§23-31) ───────── */

export async function startWaterCutAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const baseline = numOrU(formData, "baseline");
  const target = numOrU(formData, "target");
  if (
    !validWeight(baseline) || !validWeight(target) || target! >= baseline! ||
    !str(formData, "start") || !str(formData, "weighIn") ||
    new Date(str(formData, "start")).getTime() >= new Date(str(formData, "weighIn")).getTime() ||
    formData.get("targetConfirmed") !== "on"
  ) {
    redirect("/u/watercut?error=start");
  }
  const before = await getDb();
  if (before.waterCutPeriods.some((p) => p.userId === u.id && p.status !== "done")) {
    redirect("/u/watercut?error=unfinished");
  }
  const period: WaterCutPeriod = {
    id: uid(), gymId: u.gymId, userId: u.id,
    startDatetime: fromDateTimeLocal(str(formData, "start")) || nowIso(),
    baselineWeight: baseline!,
    targetWeight: target!,
    weighInDatetime: fromDateTimeLocal(str(formData, "weighIn")) || nowIso(),
    fightDatetime: str(formData, "fight") ? fromDateTimeLocal(str(formData, "fight")) : undefined,
    status: "active",
    createdAt: nowIso(),
  };
  // 進め方: full=ローディングから / cutonly=水抜きのみ(最初から水抜き期) / loadingonly=ローディングのみ(水抜きなし)
  const plan = (str(formData, "plan") || "full") as "full" | "cutonly" | "loadingonly";
  period.plan = plan;
  period.loadingTargetLiters = plan === "cutonly" ? undefined : numOrU(formData, "loadingTarget");
  if (plan === "cutonly") {
    period.cutStartedAt = nowIso();
    period.cutBaselineWeight = baseline!;
  }
  await mutateDb((d) => {
    d.waterCutPeriods.push(period);
  });
  await history(u.gymId, u.id, "watercut_start");
  redirect("/u/watercut");
}

/** ローディング→水抜きへフェーズを進める。水抜き開始時の体重（ローディングで増えた"山"）を改めて記録する。 */
export async function startCutPhaseAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const cutBaseline = numOrU(formData, "cutBaseline");
  if (!validWeight(cutBaseline)) redirect("/u/watercut?error=cutbaseline");
  await mutateDb((d) => {
    const p = d.waterCutPeriods.find((x) => x.userId === u.id && x.status === "active" && !x.cutStartedAt);
    if (p) { p.cutStartedAt = nowIso(); p.cutBaselineWeight = cutBaseline!; }
  });
  await history(u.gymId, u.id, "watercut_cut_start");
  redirect("/u/watercut");
}

/** 水抜き→ローディングへ戻す（間違えて進めた時の修正）。記録は消さず、フェーズだけ戻す。 */
export async function revertToLoadingAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  await mutateDb((d) => {
    const p = d.waterCutPeriods.find((x) => x.userId === u.id && x.status === "active" && x.cutStartedAt);
    if (p) {
      p.cutStartedAt = undefined;
      p.cutBaselineWeight = undefined;
      p.weighInStartedAt = undefined;
    }
  });
  await history(u.gymId, u.id, "watercut_revert_loading");
  redirect("/u/watercut");
}

export async function startWeighInPhaseAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  await mutateDb((d) => {
    const p = d.waterCutPeriods.find((x) => x.userId === u.id && x.status === "active");
    if (p) p.weighInStartedAt = nowIso();
  });
  await history(u.gymId, u.id, "watercut_weighin_start");
  redirect("/u/watercut");
}

export async function saveActualWeighInAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const weight = numOrU(formData, "actualWeighInWeight");
  if (!validWeight(weight)) redirect("/u/watercut?error=weighin-weight");
  let saved = false;
  await mutateDb((d) => {
    const p = d.waterCutPeriods.find((x) => x.userId === u.id && x.status === "active" && (x.weighInStartedAt || new Date(x.weighInDatetime).getTime() <= Date.now()));
    if (!p) return;
    p.actualWeighInWeight = weight;
    p.weighedInAt = nowIso();
    p.weighInStartedAt = p.weighInStartedAt ?? p.weighedInAt;
    p.status = "recovery";
    saved = true;
  });
  if (!saved) redirect("/u/watercut?error=weighin-weight");
  await history(u.gymId, u.id, "watercut_weighin_weight");
  redirect("/u/watercut?saved=weighin");
}

/** 進行中の水抜き開始体重を修正し、期間内の減少率を再計算する。 */
export async function updateWaterCutBaselineAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const baseline = numOrU(formData, "baseline");
  const reason = str(formData, "reason");
  if (!validWeight(baseline) || !reason || formData.get("baselineConfirmed") !== "on") {
    redirect("/u/watercut?error=baseline");
  }

  const before = await getDb();
  const beforePeriod = before.waterCutPeriods.find((p) => p.userId === u.id && p.status === "active");
  const oldBaseline = beforePeriod?.baselineWeight;
  let updated = false;
  await mutateDb((d) => {
    const period = d.waterCutPeriods.find((p) => p.userId === u.id && p.status === "active");
    const latest = period ? d.waterCutLogs.filter((l) => l.periodId === period.id).sort((a, b) => a.recordedDatetime < b.recordedDatetime ? 1 : -1)[0] : undefined;
    if (!period || baseline <= period.targetWeight || (latest && baseline < latest.currentWeight)) return;
    period.baselineWeight = baseline;
    d.waterCutLogs
      .filter((l) => l.periodId === period.id)
      .forEach((l) => {
        const loss = acuteLoss(baseline, l.currentWeight);
        l.acuteLossKg = loss.kg;
        l.acuteLossPercentage = loss.pct;
      });
    updated = true;
  });

  if (!updated) redirect("/u/watercut?error=baseline");
  await history(u.gymId, u.id, "watercut_baseline_update", beforePeriod?.id, JSON.stringify({ before: oldBaseline, after: baseline, reason }));
  redirect("/u/watercut?saved=baseline");
}

/** 水抜き期間を終了して履歴に保存(§4-1 過去の試合準備履歴) */
export async function finishWaterCutAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const db = await getDb();
  const period = db.waterCutPeriods.find((p) => p.userId === u.id && p.status !== "done");
  if (!period || period.status !== "recovery" || !db.weighInRecoveries.some((r) => r.periodId === period.id) ||
      formData.get("finishConfirmed") !== "on" || (period.fightDatetime && Date.now() < new Date(period.fightDatetime).getTime())) {
    redirect("/u/watercut?error=finish");
  }
  await mutateDb((d) => {
    d.waterCutPeriods.filter((p) => p.userId === u.id && p.status !== "done").forEach((p) => (p.status = "done"));
  });
  await history(u.gymId, u.id, "watercut_finish");
  redirect("/u/history");
}

export async function saveWaterCutLogAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const db = await getDb();
  const period = db.waterCutPeriods.find((p) => p.userId === u.id && p.status === "active");
  if (!period) redirect("/u/watercut");
  const current = numOrU(formData, "current");
  if (!validWeight(current)) redirect("/u/watercut?error=current");
  // 水抜き開始体重(cutBaselineWeight)があればそこから、なければローディング開始体重から%を測る
  const base = period!.cutBaselineWeight ?? period!.baselineWeight;
  const { kg, pct } = acuteLoss(base, current!);
  const waterIntakeLiters = numOrU(formData, "waterIntake");
  const log: WaterCutLog = {
    id: uid(), gymId: u.gymId, userId: u.id, periodId: period!.id,
    currentWeight: current!, acuteLossKg: kg, acuteLossPercentage: pct,
    waterIntakeLiters: waterIntakeLiters != null && waterIntakeLiters >= 0 && waterIntakeLiters <= 20 ? waterIntakeLiters : undefined,
    tookElectrolyte: formData.get("electrolyte") === "on" ? true : undefined,
    source: "manual", recordedDatetime: nowIso(), createdAt: nowIso(),
  };
  await appendRow("waterCutLogs", log);
  await history(u.gymId, u.id, "watercut_log");
  redirect("/u/watercut");
}

export async function saveHydrationAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const db = await getDb();
  const period = db.waterCutPeriods.find((p) => p.userId === u.id && p.status !== "done");
  if (!period) redirect("/u/watercut");
  const usg = numOrNull(formData, "usg");
  const simultaneousWeight = numOrU(formData, "simWeight");
  if (usg != null && (!Number.isFinite(usg) || usg < 1 || usg > 1.05)) redirect("/u/watercut/hydro?error=usg");
  if (simultaneousWeight != null && !validWeight(simultaneousWeight)) redirect("/u/watercut/hydro?error=weight");
  const log: HydrationLog = {
    id: uid(), gymId: u.gymId, userId: u.id, periodId: period?.id,
    urineSpecificGravity: usg,
    urineColor: (str(formData, "color") || undefined) as HydrationLog["urineColor"],
    urineVolumeStatus: (str(formData, "volume") || undefined) as HydrationLog["urineVolumeStatus"],
    thirst: (str(formData, "thirst") || undefined) as HydrationLog["thirst"],
    symptoms: formData.getAll("symptoms").map(String),
    simultaneousWeight,
    weightMeasuredAt: str(formData, "weightAt") ? fromDateTimeLocal(str(formData, "weightAt")) : undefined,
    refractometerName: str(formData, "refractometer") || undefined,
    calibrationChecked: formData.get("calibration") === "on",
    measuredBy: str(formData, "measuredBy") || undefined,
    gapMinutes: numOrU(formData, "gap"),
    note: str(formData, "note") || undefined,
    recordedDatetime: nowIso(), createdAt: nowIso(),
  };
  await appendRow("hydrationLogs", log);
  await history(u.gymId, u.id, "hydration");
  redirect("/u/watercut");
}

export async function saveWeighInRecoveryAction(formData: FormData): Promise<void> {
  const u = await mePro();
  await assertOwner(formData, u);
  const db = await getDb();
  const period = db.waterCutPeriods.find((p) => p.userId === u.id && p.status === "recovery" && p.actualWeighInWeight != null);
  if (!period) redirect("/u/watercut");
  const weighInWeight = numOrU(formData, "weighInWeight");
  const currentWeight = numOrU(formData, "current");
  const recordedAtRaw = str(formData, "recordedAt");
  const recordedAt = recordedAtRaw ? fromDateTimeLocal(recordedAtRaw) : nowIso();
  const recordedMs = new Date(recordedAt).getTime();
  const weighInMs = new Date(period.weighedInAt ?? period.weighInDatetime).getTime();
  const lockedWeight = period.actualWeighInWeight;
  if (!validWeight(weighInWeight) || !validWeight(currentWeight) || Number.isNaN(recordedMs) ||
      recordedMs < weighInMs || recordedMs > Date.now() + 5 * 60_000 ||
      (lockedWeight != null && Math.abs(lockedWeight - weighInWeight) > 0.05)) {
    redirect("/u/watercut/recovery?error=input");
  }
  const hours = Math.round(hoursBetweenIso(period.weighedInAt ?? period.weighInDatetime, recordedAt) * 10) / 10;
  const log: WeighInRecovery = {
    id: uid(), gymId: u.gymId, userId: u.id, periodId: period.id,
    weighInWeight: weighInWeight!, currentWeight: currentWeight!, hoursSinceWeighIn: hours,
    tookWater: formData.get("water") === "on",
    tookFood: formData.get("food") === "on",
    symptoms: formData.getAll("symptoms").map(String),
    sleep: (str(formData, "sleep") || undefined) as WeighInRecovery["sleep"],
    preFightCondition: (str(formData, "condition") || undefined) as WeighInRecovery["preFightCondition"],
    isFightDay: formData.get("fightDay") === "on",
    recordedAt,
    createdAt: nowIso(),
  };
  await mutateDb((d) => {
    const p = d.waterCutPeriods.find((x) => x.id === period.id);
    if (p) {
      p.status = "recovery";
      p.actualWeighInWeight = p.actualWeighInWeight ?? weighInWeight!;
      p.weighedInAt = p.weighedInAt ?? period.weighInDatetime;
    }
    if (log.isFightDay) d.weighInRecoveries.filter((r) => r.periodId === period.id).forEach((r) => { r.isFightDay = false; });
    d.weighInRecoveries.push(log);
  });
  await history(u.gymId, u.id, "weighin_recovery");
  redirect("/u/watercut?saved=recovery");
}

/** プロフィール編集：目標・からだ・（プロ）計量情報をまとめて更新(§11) */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const targetWeight = numOrU(formData, "targetWeight");
  let targetDate = str(formData, "targetDate") || undefined;
  const startWeight = numOrU(formData, "startWeight");
  const heightCm = numOrU(formData, "height");
  const birthDate = str(formData, "birthDate") || undefined;
  const weighInRaw = str(formData, "weighInAt");
  const fightRaw = str(formData, "fightAt");
  const weighInAt = weighInRaw ? fromDateTimeLocal(weighInRaw) : undefined;
  const fightAt = fightRaw ? fromDateTimeLocal(fightRaw) : undefined;
  const weighInType = (str(formData, "weighInType") || undefined) as User["weighInType"];
  const promotion = (str(formData, "promotion") || undefined) as User["promotion"];
  const contractWeightKg = numOrU(formData, "contractWeight");
  if ([targetWeight, startWeight, contractWeightKg].some((v) => v != null && !validWeight(v))) redirect("/u/mypage?error=weight");
  if (u.role === "pro" && weighInAt) targetDate = businessDate(new Date(weighInAt));

  await mutateDb((d) => {
    const user = d.users.find((x) => x.id === u.id);
    if (!user) return;
    user.targetWeight = targetWeight;
    user.targetDate = targetDate;
    user.startWeight = startWeight;
    user.foodGoal = str(formData, "foodGoal") || undefined;
    if (heightCm != null) user.heightCm = heightCm;
    if (birthDate) user.birthDate = birthDate;
    if (user.role === "pro") {
      user.weighInAt = weighInAt;
      user.fightAt = fightAt;
      if (weighInType) user.weighInType = weighInType;
      if (promotion) user.promotion = promotion;
      user.contractWeightKg = contractWeightKg;
      user.usesHydration = formData.get("usesHydration") === "on";
    }
  });
  await history(u.gymId, u.id, "update_profile");
  redirect("/u/mypage?saved=profile");
}

/**
 * 一般会員 → 選手 へ切替。基準は「試合に出るか」。試合日時（＋計量日時・主競技）を登録した瞬間に選手になる。
 * 水抜き方法・量は出さない現行の医療ルールは維持（解放するのはモニタリングだけ）。
 */
export async function switchToProAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  const primarySport = (str(formData, "primarySport") || u.primarySport) as User["primarySport"];
  const fightRaw = str(formData, "fightAt");
  const weighInRaw = str(formData, "weighInAt");
  if (!primarySport) redirect("/u/mypage?error=sport");
  if (!fightRaw && !weighInRaw) redirect("/u/mypage?error=fight");
  const fightAt = fightRaw ? fromDateTimeLocal(fightRaw) : undefined;
  const weighInAt = weighInRaw ? fromDateTimeLocal(weighInRaw) : undefined;
  const weighInType = (str(formData, "weighInType") || "day_before") as User["weighInType"];
  await mutateDb((d) => {
    const user = d.users.find((x) => x.id === u.id);
    if (!user) return;
    user.role = "pro";
    user.userType = "pro";
    user.primarySport = primarySport;
    if (!user.sports?.length && primarySport) user.sports = [primarySport];
    user.fightAt = fightAt;
    user.weighInAt = weighInAt;
    user.weighInType = weighInType;
    if (user.promotion == null) user.promotion = "none";
    if (user.usesHydration == null) user.usesHydration = true;
    if (weighInAt) user.targetDate = businessDate(new Date(weighInAt));
  });
  await setSession({ userId: u.id, gymId: u.gymId, role: "pro" });
  await history(u.gymId, u.id, "switch_role", "pro");
  redirect("/u?rolechanged=pro");
}

/**
 * 選手 → 一般会員（フィットネス）へ戻す。試合予定（試合日時・計量日時）を消す＝一般に戻る。
 * 過去の試合・水抜きの記録は消さず残す。
 */
export async function switchToMemberAction(formData: FormData): Promise<void> {
  const u = await me();
  await assertOwner(formData, u);
  await mutateDb((d) => {
    const user = d.users.find((x) => x.id === u.id);
    if (!user) return;
    user.role = "member";
    user.userType = "member";
    user.weighInAt = undefined;
    user.fightAt = undefined;
    user.targetDate = undefined; // 競技の計量日が「目標日」に化けないよう消す（本人が改めて設定できる）
    // 進行中の水抜き期間を終了扱いに（member で水抜き体重を拾う／pro復帰で新規開始がブロックされるのを防ぐ）
    d.waterCutPeriods.forEach((p) => { if (p.userId === user.id && p.status !== "done") p.status = "done"; });
  });
  await setSession({ userId: u.id, gymId: u.gymId, role: "member" });
  await history(u.gymId, u.id, "switch_role", "member");
  redirect("/u?rolechanged=member");
}

/** パーソナル体験希望(§20) */
export async function requestPtTrialAction(): Promise<void> {
  const u = await me();
  const db = await getDb();
  if (!db.ptInquiries.some((i) => i.userId === u.id && i.status === "wanted")) {
    const inq: PtInquiry = { id: uid(), gymId: u.gymId, userId: u.id, status: "wanted", createdAt: nowIso() };
    await appendRow("ptInquiries", inq);
    await history(u.gymId, u.id, "pt_trial_request");
  }
  redirect("/u/personal?requested=1");
}
