/** 画面表示用の派生値の計算（ホーム・スタッフ一覧で共用）。 */
import type { DB, User, WaterCutPeriod } from "./types";
import { addDays, businessDate, daysBetween, hoursBetweenIso, round1, signed, todayStr, weekStart, untilLabel } from "./calc";
import { dailyVerdict, weightProgress, acuteLoss, type Signal } from "./judge";

/** 試合当日か（選手のみ）。この日は記録オフにして試合に集中させる。 */
export function isFightDay(db: DB, user: User): boolean {
  if (user.role !== "pro") return false;
  const period = db.waterCutPeriods.find((p) => p.userId === user.id && p.status !== "done");
  const fightAt = period?.fightDatetime ?? user.fightAt;
  return !!fightAt && businessDate(new Date(fightAt)) === businessDate();
}

export function currentWeight(db: DB, user: User): number | null {
  const period = db.waterCutPeriods.find((p) => p.userId === user.id && p.status !== "done");
  const latestWaterCut = period
    ? db.waterCutLogs.filter((l) => l.periodId === period.id).sort((a, b) => b.recordedDatetime.localeCompare(a.recordedDatetime))[0]
    : undefined;
  if (period?.status === "active" && latestWaterCut) return latestWaterCut.currentWeight;
  const latestDaily = db.dailyCheckins
    .filter((c) => c.userId === user.id && c.weight != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (period?.status === "recovery") {
    const latestRecovery = db.weighInRecoveries.filter((r) => r.periodId === period.id)
      .sort((a, b) => (b.recordedAt ?? b.createdAt).localeCompare(a.recordedAt ?? a.createdAt))[0];
    const candidates = [
      latestWaterCut && { weight: latestWaterCut.currentWeight, at: latestWaterCut.recordedDatetime },
      latestRecovery && { weight: latestRecovery.currentWeight, at: latestRecovery.recordedAt ?? latestRecovery.createdAt },
      latestDaily?.weight != null && { weight: latestDaily.weight, at: latestDaily.createdAt },
    ].filter(Boolean) as { weight: number; at: string }[];
    return candidates.sort((a, b) => b.at.localeCompare(a.at))[0]?.weight ?? user.startWeight ?? null;
  }
  return latestDaily?.weight ?? user.startWeight ?? null;
}

/** 連続記録日数（今日のチェックが連続している日数） */
export function streakDays(db: DB, userId: string): number {
  const dates = new Set(db.dailyCheckins.filter((c) => c.userId === userId).map((c) => c.date));
  let n = 0;
  let date = todayStr();
  if (!dates.has(date)) date = addDays(date, -1);
  for (;;) {
    if (dates.has(date)) { n++; date = addDays(date, -1); } else break;
  }
  return n;
}

export function weeklyActivityCount(db: DB, userId: string): number {
  const ws = weekStart();
  const days = new Set<string>();
  db.activityLogs.filter((a) => a.userId === userId && a.date >= ws).forEach((a) => days.add(a.date));
  db.runningLogs.filter((r) => r.userId === userId && r.date >= ws).forEach((r) => days.add(r.date));
  return days.size;
}

export interface Todos { morning: boolean; activity: boolean; running: boolean; nutrition: boolean; night: boolean }
export function todosDone(db: DB, userId: string): Todos {
  const t = todayStr();
  const hasRestDeclaration = db.restDayLogs.some((r) => r.userId === userId && r.date === t && Boolean(r.dayType));
  return {
    morning: db.dailyCheckins.some((c) => c.userId === userId && c.date === t),
    activity: db.activityLogs.some((a) => a.userId === userId && a.date === t) ||
      db.runningLogs.some((r) => r.userId === userId && r.date === t) || hasRestDeclaration,
    running: db.runningLogs.some((r) => r.userId === userId && r.date === t),
    nutrition: db.nutritionLogs.some((n) => n.userId === userId && n.date === t),
    night: db.restDayLogs.some((r) => r.userId === userId && r.date === t && r.recovery != null),
  };
}

/** 計量7日前以降か(§13-4, §22) */
export function inWaterCutWindow(user: User): boolean {
  if (user.role !== "pro" || !user.weighInAt) return false;
  const d = daysBetween(todayStr(), businessDate(new Date(user.weighInAt)));
  return d >= 0 && d <= 7;
}

export function activeWaterCut(db: DB, userId: string) {
  return db.waterCutPeriods.find((p) => p.userId === userId && p.status !== "done") ?? null;
}

/** 計量準備のフェーズ。ローディング→水抜き→計量→リカバリー。 */
export type WaterCutPhase = "loading" | "cut" | "weighin" | "recovery" | "done";
export function waterCutPhase(period: { status: string; weighInDatetime: string; cutStartedAt?: string; weighInStartedAt?: string }): WaterCutPhase {
  if (period.status === "done") return "done";
  if (period.status === "recovery") return "recovery";
  if (period.weighInStartedAt) return "weighin";
  if (new Date(period.weighInDatetime).getTime() <= Date.now()) return "weighin";
  return period.cutStartedAt ? "cut" : "loading";
}
export function latestWaterCutLog(db: DB, userId: string, periodId: string) {
  return db.waterCutLogs.filter((l) => l.userId === userId && l.periodId === periodId)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1))[0] ?? null;
}
export function latestHydration(db: DB, userId: string, periodId: string) {
  return db.hydrationLogs.filter((l) => l.userId === userId && l.periodId === periodId)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1))[0] ?? null;
}

/**
 * 過去（または進行中）の計量準備1件の要約(§8)。表示専用で保存データは書き換えない。
 * ・減少率の基準は水抜き開始後は cutBaselineWeight、なければ baselineWeight。
 * ・最大減少率は最後のログではなく期間内の全ログ（＋実測計量値）の最小体重から計算。
 * ・実測計量体重(actualWeighInWeight)があれば最終計量体重として優先。
 * ・症状が記録された回数（HYDRO・計量後回復のうち症状ありの件数）。
 * ・存在しないデータは推測しない（null / 0 を返す）。
 */
export interface PeriodSummary {
  base: number;
  finalWeight: number;
  maxLossKg: number;
  maxLossPct: number;
  actualWeighInWeight: number | null;
  symptomCount: number;
  hours: number | null;
}
export function periodSummary(db: DB, period: WaterCutPeriod): PeriodSummary {
  const base = period.cutBaselineWeight ?? period.baselineWeight;
  const logs = db.waterCutLogs.filter((l) => l.periodId === period.id)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? -1 : 1));
  const lastLog = logs[logs.length - 1];
  const finalWeight = period.actualWeighInWeight ?? lastLog?.currentWeight ?? period.baselineWeight;
  const candidateWeights = [
    ...logs.map((l) => l.currentWeight),
    ...(period.actualWeighInWeight != null ? [period.actualWeighInWeight] : []),
  ];
  const minWeight = candidateWeights.length ? Math.min(...candidateWeights) : base;
  const maxLoss = acuteLoss(base, minWeight);
  const symptomCount =
    db.hydrationLogs.filter((h) => h.periodId === period.id && (h.symptoms?.length ?? 0) > 0).length +
    db.weighInRecoveries.filter((r) => r.periodId === period.id && (r.symptoms?.length ?? 0) > 0).length;
  const hours = lastLog ? Math.round(hoursBetweenIso(period.startDatetime, lastLog.recordedDatetime)) : null;
  return {
    base,
    finalWeight: round1(finalWeight),
    maxLossKg: maxLoss.kg,
    maxLossPct: maxLoss.pct,
    actualWeighInWeight: period.actualWeighInWeight ?? null,
    symptomCount,
    hours,
  };
}

export interface Tile { lbl: string; val: string; tone: Signal }

/** 今日の状態タイル(§13-4) */
export function statusTiles(db: DB, user: User): Tile[] {
  const verdict = dailyVerdict(db, user);
  const wp = weightProgress(user, db);
  const tiles: Tile[] = [];

  const checks = db.dailyCheckins.filter((c) => c.userId === user.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = checks[0];
  const fatigueTone: Signal = latest?.fatigueLevel === "high" ? "yellow" : "green";
  const rest = db.restDayLogs.filter((r) => r.userId === user.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  // 回復は「今朝の回復（朝チェック）」を優先。無ければ旧・休養日の回復（後方互換）。
  const latestRecovery = latest?.morningRecovery ?? rest?.recovery;
  const recoveryTone: Signal = latestRecovery === "worse" ? "red" : latestRecovery === "same" ? "yellow" : "green";
  const week = weeklyActivityCount(db, user.id);
  const trainTone: Signal = week >= (user.weeklyPlanCount ?? 3) ? "green" : "yellow";

  if (user.role === "pro") {
    tiles.push({ lbl: "WEIGHT", val: wp?.text ?? "—", tone: wp?.level ?? "blue" });
    tiles.push({ lbl: "CONDITION", val: latest?.fatigueLevel === "high" ? "疲労あり" : "良好", tone: fatigueTone });
    tiles.push({ lbl: "RECOVERY", val: latestRecovery ? recoveryLabel(latestRecovery) : "—", tone: recoveryTone });
    tiles.push({ lbl: "TRAINING", val: `今週 ${week}回`, tone: trainTone });
    if (inWaterCutWindow(user)) {
      const wc = activeWaterCut(db, user.id);
      const log = wc ? latestWaterCutLog(db, user.id, wc.id) : null;
      if (wc && log) {
        const band = acuteLoss(wc.baselineWeight, log.currentWeight);
        const tone: Signal = band.pct >= 5 ? "red" : band.pct >= 2 ? "yellow" : "blue";
        tiles.push({ lbl: "WATER CUT", val: signed(-band.pct, "%"), tone });
      }
      const h = wc ? latestHydration(db, user.id, wc.id) : null;
      if (h?.urineSpecificGravity != null) {
        const usg = h.urineSpecificGravity;
        const tone: Signal = usg >= 1.03 ? "red" : usg >= 1.021 ? "yellow" : "blue";
        tiles.push({ lbl: "HYDRO", val: usg.toFixed(3), tone });
      }
    }
    tiles.push({ lbl: "FIGHT READY", val: verdict.label, tone: verdict.level });
  } else {
    // 一般会員は「予定より◯kg遅れ」等の締切プレッシャーを出さず、「スタートから −◯kg」を前向きに見せる
    const cwv = currentWeight(db, user);
    const firstWeight = [...checks].reverse().find((c) => c.weight != null)?.weight;
    const startW = user.startWeight ?? firstWeight ?? null;
    const lost = startW != null && cwv != null ? round1(startW - cwv) : null;
    const body: { val: string; tone: Signal } =
      lost != null && lost > 0 ? { val: `スタート −${lost}kg`, tone: "green" }
      : cwv != null ? { val: `${cwv}kg`, tone: "blue" }
      : { val: "—", tone: "blue" };
    tiles.push({ lbl: "BODY", val: body.val, tone: body.tone });
    tiles.push({ lbl: "TRAINING", val: `今週 ${week}回`, tone: trainTone });
    tiles.push({ lbl: "RECOVERY", val: latestRecovery ? recoveryLabel(latestRecovery) : (latest?.fatigueLevel === "high" ? "疲労あり" : "良好"), tone: recoveryTone });
    const nut = db.nutritionLogs.filter((n) => n.userId === user.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    tiles.push({ lbl: "NUTRITION", val: nut ? achieveLabel(nut.goalAchieved) : "—", tone: nut?.goalAchieved === "done" ? "green" : "yellow" });
    tiles.push({ lbl: "BODY READY", val: verdict.label, tone: verdict.level });
  }
  return tiles;
}

function currentWeightLabel(db: DB, user: User) {
  const w = currentWeight(db, user);
  return w != null ? `${round1(w)}kg` : "—";
}
const recoveryLabel = (r: string) => ({ much: "かなり回復", some: "少し回復", same: "変わらない", worse: "悪化" }[r] ?? r);
const achieveLabel = (a: string) => ({ done: "目標どおり", partial: "だいたい", none: "未達" }[a] ?? a);

export { untilLabel };
