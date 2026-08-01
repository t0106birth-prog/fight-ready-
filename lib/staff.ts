/** スタッフ画面用の集計(§39-41)。 */
import type { DB, User } from "./types";
import { addDays, daysBetween, todayStr, round1, daysUntil } from "./calc";
import { dailyVerdict, acuteLoss, type Signal } from "./judge";
import { currentWeight, inWaterCutWindow, activeWaterCut, latestWaterCutLog } from "./derive";

export interface MemberSummary {
  user: User;
  verdict: ReturnType<typeof dailyVerdict>;
  lastCheckinDays: number | null;   // 何日前に記録したか
  lastVisitDays: number | null;     // 何日前に来館したか
  painParts: string[];              // 継続中の痛み部位（3日以上）
  currentWeight: number | null;
  remainKg: number | null;
  targetDays: number | null;
  waterCutPct: number | null;
  ptStatus: string;                 // 受講中(残りn) / 体験希望 / 未受講 ...
  ptRemaining: number | null;
  ptEndDays: number | null;
  fatigue?: string;
  sluggish?: string;
}

export function summarize(db: DB, u: User): MemberSummary {
  const verdict = dailyVerdict(db, u);
  const checks = db.dailyCheckins.filter((c) => c.userId === u.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastCheckinDays = checks[0] ? daysBetween(checks[0].date, todayStr()) : null;
  const att = db.attendanceLogs.filter((a) => a.userId === u.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastVisitDays = att ? daysBetween(att.date, todayStr()) : null;

  const painByLoc: Record<string, Set<string>> = {};
  db.painLogs.filter((p) => p.userId === u.id).forEach((p) => (painByLoc[p.locationId] ??= new Set()).add(p.date));
  const cutoff = addDays(todayStr(), -6);
  const painParts = Object.entries(painByLoc).filter(([, days]) => {
    const recent = [...days].filter((d) => d >= cutoff).sort();
    return recent.some((d) => days.has(addDays(d, 1)) && days.has(addDays(d, 2)));
  }).map(([id]) => id);

  const cw = currentWeight(db, u);
  const remainKg = cw != null && u.targetWeight != null ? round1(cw - u.targetWeight) : null;

  let waterCutPct: number | null = null;
  if (u.role === "pro" && inWaterCutWindow(u)) {
    const period = activeWaterCut(db, u.id);
    const log = period ? latestWaterCutLog(db, u.id, period.id) : null;
    if (period && log) waterCutPct = acuteLoss(period.baselineWeight, log.currentWeight).pct;
  }

  const plan = db.ptPlans.find((p) => p.userId === u.id && p.status === "active");
  const inquiry = db.ptInquiries.find((i) => i.userId === u.id && (i.status === "wanted" || i.status === "contacted"));
  let ptStatus = "未受講";
  let ptRemaining: number | null = null;
  let ptEndDays: number | null = null;
  if (plan) {
    ptRemaining = plan.totalSessions - plan.completedSessions;
    ptStatus = `受講中（残${ptRemaining}）`;
    ptEndDays = plan.endDate ? daysUntil(plan.endDate) : null;
  } else if (inquiry) {
    ptStatus = "体験希望";
  }

  return {
    user: u, verdict, lastCheckinDays, lastVisitDays, painParts, currentWeight: cw,
    remainKg, targetDays: daysUntil(u.targetDate), waterCutPct, ptStatus, ptRemaining, ptEndDays,
    fatigue: checks[0]?.fatigueLevel, sluggish: checks[0]?.sluggishnessLevel,
  };
}

export interface GymSummary {
  pros: number; members: number; red: number; yellow: number;
  noRecord7: number; noVisit7: number; ptTrials: number; ptEnding: number;
}
export function gymSummary(sums: MemberSummary[]): GymSummary {
  return {
    pros: sums.filter((s) => s.user.role === "pro").length,
    members: sums.filter((s) => s.user.role === "member").length,
    red: sums.filter((s) => s.verdict.level === "red").length,
    yellow: sums.filter((s) => s.verdict.level === "yellow").length,
    noRecord7: sums.filter((s) => (s.lastCheckinDays ?? 999) >= 7).length,
    noVisit7: sums.filter((s) => (s.lastVisitDays ?? 999) >= 7).length,
    ptTrials: sums.filter((s) => s.ptStatus === "体験希望").length,
    ptEnding: sums.filter((s) => s.ptRemaining != null && s.ptRemaining <= 1).length,
  };
}

/** 継続リスク(§41) */
export function followRisk(s: MemberSummary): "high" | "mid" | "low" {
  if ((s.lastVisitDays ?? 0) >= 14 || (s.lastCheckinDays ?? 0) >= 10 || (s.user.goals ?? []).length === 0) return "high";
  if ((s.lastVisitDays ?? 0) >= 7 || (s.lastCheckinDays ?? 0) >= 5 || s.verdict.level !== "green") return "mid";
  return "low";
}

/** 今日確認する利用者の優先度スコア（高いほど上）(§39) */
export function priorityScore(s: MemberSummary): number {
  let n = 0;
  if (s.verdict.level === "red") n += 100;
  if (s.verdict.level === "yellow") n += 40;
  if (s.waterCutPct != null && s.waterCutPct >= 5) n += 120;
  else if (s.waterCutPct != null && s.waterCutPct >= 2) n += 30;
  if (s.painParts.length) n += 20;
  if ((s.lastCheckinDays ?? 0) >= 7) n += 15;
  if ((s.lastVisitDays ?? 0) >= 7) n += 15;
  if (s.ptStatus === "体験希望") n += 10;
  if (s.ptRemaining != null && s.ptRemaining <= 1) n += 8;
  return n;
}

export const toneClass: Record<Signal, string> = { green: "sig-green", yellow: "sig-yellow", red: "sig-red", blue: "sig-blue" };
