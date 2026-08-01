/**
 * デモデータ(§44)。すべて架空。
 * 日付は起動時刻を基準に相対生成するので、いつ動かしても「計量まで◯日」が保たれる。
 */
import bcrypt from "bcryptjs";
import type {
  DB, User, Gym, DailyCheckin, PainLog, ActivityLog, RestDayLog,
  NutritionLog, WaterCutPeriod, WaterCutLog, HydrationLog, Camp, PtPlan,
  PtSession, PtInquiry, AttendanceLog,
} from "./types";

const PW = "fight-2026"; // デモ共通パスワード
const hash = (s: string) => bcrypt.hashSync(s, 8);

function iso(daysFromNow: number, hour = 7, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}
function dstr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

export function seed(): DB {
  const gymId = "gym-fightbase";
  const gyms: Gym[] = [
    { id: gymId, name: "FIGHT BASE Tokyo", code: "FIGHTBASE", createdAt: iso(-200) },
    { id: "gym-osaka", name: "IRON GYM Osaka", code: "IRONGYM", createdAt: iso(-200) },
  ];

  const mk = (p: Partial<User> & Pick<User, "id" | "email" | "role" | "name">): User => ({
    gymId, passwordHash: hash(PW), status: "active", createdAt: iso(-60), ...p,
  });

  const users: User[] = [
    mk({ id: "u-staff", email: "staff@fightbase.jp", role: "staff", name: "ジムスタッフ" }),

    // プロ1: 山田タケル（緑・順調）
    mk({
      id: "u-takeru", email: "takeru@example.com", role: "pro", name: "山田タケル",
      userType: "pro", gender: "male", birthDate: "1998-04-10", heightCm: 173,
      usualWeight: 66, startWeight: 64, primarySport: "boxing", sports: ["boxing"],
      goals: ["fight_prep", "lose_weight"], targetWeight: 61.2, targetDate: dstr(21),
      weeklyPlanCount: 6, promotion: "none",
      weighInAt: iso(21, 10), fightAt: iso(22, 18), weighInType: "day_before",
      pastCutExperience: "5回", maxCutKg: 5, createdAt: iso(-40),
    }),

    // プロ2: 佐藤レン（黄・水抜き2.8%・睡眠不良）
    mk({
      id: "u-ren", email: "ren@example.com", role: "pro", name: "佐藤レン",
      userType: "pro", gender: "male", birthDate: "2000-09-01", heightCm: 175,
      usualWeight: 70, startWeight: 68, primarySport: "kickboxing", sports: ["kickboxing", "muaythai"],
      goals: ["fight_prep"], targetWeight: 63.5, targetDate: dstr(5),
      weeklyPlanCount: 6, promotion: "none",
      weighInAt: iso(5, 12), fightAt: iso(6, 18), weighInType: "day_before",
      maxCutKg: 6, createdAt: iso(-35),
    }),

    // プロ3: 高橋カイト（赤・水抜き5.2%・めまい・ONE Championship）
    mk({
      id: "u-kaito", email: "kaito@example.com", role: "pro", name: "高橋カイト",
      userType: "pro", gender: "male", birthDate: "1997-01-20", heightCm: 170,
      usualWeight: 65, startWeight: 64, primarySport: "mma", sports: ["mma", "bjj"],
      goals: ["fight_prep"], targetWeight: 61.2, targetDate: dstr(1),
      weeklyPlanCount: 7, promotion: "one", contractWeightKg: 61.2,
      weighInAt: isoIn(18), fightAt: isoIn(42), weighInType: "day_before", maxCutKg: 5, createdAt: iso(-30),
    }),

    // 一般1: 田中美咲（緑・キャンプ・パーソナル受講中）
    mk({
      id: "u-misaki", email: "misaki@example.com", role: "member", name: "田中美咲",
      userType: "member", gender: "female", birthDate: "1995-06-15", heightCm: 160,
      usualWeight: 58, startWeight: 58, primarySport: "kickboxing", sports: ["kickboxing"],
      goals: ["lose_weight", "exercise_habit"], targetWeight: 53, targetDate: dstr(32),
      weeklyPlanCount: 3, createdAt: iso(-24),
    }),

    // 一般2: 鈴木一郎（黄・停滞・パーソナル体験候補）
    mk({
      id: "u-ichiro", email: "ichiro@example.com", role: "member", name: "鈴木一郎",
      userType: "member", gender: "male", birthDate: "1988-11-03", heightCm: 172,
      usualWeight: 78, startWeight: 80, primarySport: "fitness", sports: ["fitness"],
      goals: ["lose_weight", "maintain_health"], targetWeight: 72, targetDate: dstr(60),
      weeklyPlanCount: 2, createdAt: iso(-50),
    }),
  ];

  const dailyCheckins: DailyCheckin[] = [];
  const activityLogs: ActivityLog[] = [];
  const painLogs: PainLog[] = [];
  const restDayLogs: RestDayLog[] = [];
  const nutritionLogs: NutritionLog[] = [];
  const attendanceLogs: AttendanceLog[] = [];
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;

  const addCheck = (userId: string, day: number, weight: number, o: Partial<DailyCheckin> = {}) => {
    dailyCheckins.push({
      id: id("c"), gymId, userId, date: dstr(day), weight,
      sleepQuality: "normal", fatigueLevel: "low", sluggishnessLevel: "none",
      motivationLevel: "yes", painLevel: "none", createdAt: iso(day, 7), ...o,
    });
  };
  const addAct = (userId: string, day: number, type: string, min: number, rpe: number, feel: ActivityLog["movementFeeling"] = "normal") => {
    activityLogs.push({
      id: id("a"), gymId, userId, date: dstr(day), activityType: type,
      durationMinutes: min, rpe, movementFeeling: feel, load: min * rpe, createdAt: iso(day, 19),
    });
  };
  const addAtt = (userId: string, day: number) =>
    attendanceLogs.push({ id: id("at"), gymId, userId, date: dstr(day), createdAt: iso(day, 19) });

  // ── 山田タケル: 順調に減量、緑 ──
  [-12, -10, -8, -6, -4, -2, -1, 0].forEach((d, i) => addCheck("u-takeru", d, 64 - i * 0.35, {
    sleepQuality: "good", fatigueLevel: i > 5 ? "mid" : "low",
  }));
  [-13, -11, -9, -6, -4, -2, -1].forEach((d) => { addAct("u-takeru", d, "スパーリング", 60, 6, "good"); addAtt("u-takeru", d); });
  restDayLogs.push({ id: id("r"), gymId, userId: "u-takeru", date: dstr(-3), dayType: "完全休養日", recovery: "much", actions: ["入浴", "ストレッチ"], painChange: "improved", createdAt: iso(-3, 21) });

  // ── 佐藤レン: 水抜き中、睡眠不良・だるさ、黄 ──
  [-10, -8, -6, -4, -3, -2, -1, 0].forEach((d, i) => addCheck("u-ren", d, 68 - i * 0.5, {
    sleepQuality: d >= -1 ? "bad" : "normal",
    sluggishnessLevel: d >= -1 ? "strong" : "some",
    fatigueLevel: d <= -2 ? "high" : "mid",  // 当日は mid（強いだるさ＋強い疲労の同時＝赤 を避け、黄に留める）
    motivationLevel: "normal",
  }));
  [-5, -3, -1].forEach((d) => { addAct("u-ren", d, "ミット", 45, 7, "heavy"); addAtt("u-ren", d); });

  // ── 高橋カイト: 水抜き5.2%、めまい、赤 ──
  [-6, -4, -2, -1].forEach((d, i) => addCheck("u-kaito", d, 64 - i * 0.6, { fatigueLevel: "high", sluggishnessLevel: "some" }));
  addCheck("u-kaito", 0, 61.6, {
    sleepQuality: "bad", fatigueLevel: "high", sluggishnessLevel: "strong",
    motivationLevel: "normal", dangerSymptoms: ["めまい"],
  });
  addAtt("u-kaito", 0);

  // ── 田中美咲: 緑、キャンプ順調、パーソナル ──
  [-9, -7, -5, -3, -1, 0].forEach((d, i) => addCheck("u-misaki", d, 58 - i * 0.5, { sleepQuality: "good" }));
  [-12, -10, -8, -5, -3, -1].forEach((d) => { addAct("u-misaki", d, "キックボクシング", 50, 5, "good"); addAtt("u-misaki", d); });
  restDayLogs.push({ id: id("r"), gymId, userId: "u-misaki", date: dstr(-2), dayType: "完全休養日", recovery: "much", actions: ["散歩"], createdAt: iso(-2, 21) });
  nutritionLogs.push({ id: id("n"), gymId, userId: "u-misaki", date: dstr(0), goalAchieved: "done", createdAt: iso(0, 21) });

  // ── 鈴木一郎: 黄、停滞（最終記録7日前・最終来館9日前） ──
  [-30, -25, -20, -14, -10, -7].forEach((d) => addCheck("u-ichiro", d, 80 - (d < -20 ? 0 : 0.3), { fatigueLevel: "mid" }));
  addAtt("u-ichiro", -9);

  // 痛みログ（レン: 脚 3日継続、カイト: 腰）
  [-2, -1, 0].forEach((d) =>
    painLogs.push({ id: id("p"), gymId, userId: "u-ren", date: dstr(d), locationId: "shin_r", painLevel: 2, newOrContinuing: "continuing", changeStatus: "same", createdAt: iso(d, 7) }));

  // 水抜き期間・ログ
  const waterCutPeriods: WaterCutPeriod[] = [
    { id: "wc-ren", gymId, userId: "u-ren", startDatetime: iso(-2, 7), baselineWeight: 66, targetWeight: 63.5, weighInDatetime: iso(5, 12), fightDatetime: iso(6, 18), status: "active", createdAt: iso(-2, 7) },
    { id: "wc-kaito", gymId, userId: "u-kaito", startDatetime: iso(-1, 7), baselineWeight: 65, targetWeight: 61.2, weighInDatetime: isoIn(18), fightDatetime: isoIn(42), status: "active", createdAt: iso(-1, 7) },
  ];
  const waterCutLogs: WaterCutLog[] = [
    { id: "wcl-ren-1", gymId, userId: "u-ren", periodId: "wc-ren", currentWeight: 64.15, acuteLossKg: 1.85, acuteLossPercentage: 2.8, recordedDatetime: iso(0, 7), createdAt: iso(0, 7) },
    { id: "wcl-kaito-1", gymId, userId: "u-kaito", periodId: "wc-kaito", currentWeight: 61.62, acuteLossKg: 3.38, acuteLossPercentage: 5.2, recordedDatetime: iso(0, 6), createdAt: iso(0, 6) },
  ];
  const hydrationLogs: HydrationLog[] = [
    { id: "h-kaito-1", gymId, userId: "u-kaito", periodId: "wc-kaito", urineSpecificGravity: 1.031, urineColor: "very_dark", thirst: "strong", symptoms: ["めまい", "口の渇き"], simultaneousWeight: 61.6, weightMeasuredAt: iso(0, 6, 5), refractometerName: "ATAGO PAL-10S #A-102", calibrationChecked: true, measuredBy: "スタッフ", gapMinutes: 5, recordedDatetime: iso(0, 6), createdAt: iso(0, 6) },
  ];

  // キャンプ（美咲: 8週間ボディメイク 24日目）
  const camps: Camp[] = [
    { id: "camp-misaki", gymId, userId: "u-misaki", name: "8週間ボディメイクキャンプ", startDate: dstr(-24), endDate: dstr(32), goal: "体を引き締める", startWeight: 58, targetWeight: 53, startWaist: 72, targetWorkoutCount: 3, nutritionGoal: "夜の間食を控える", status: "active", createdAt: iso(-24) },
  ];

  // パーソナル（美咲: 受講中 8回中4回、一郎: 体験希望）
  const ptPlans: PtPlan[] = [
    { id: "pt-misaki", gymId, userId: "u-misaki", planName: "ボディメイク8回コース", startDate: dstr(-24), endDate: dstr(28), totalSessions: 8, completedSessions: 4, nextSessionDate: dstr(5), status: "active", createdAt: iso(-24) },
  ];
  const ptSessions: PtSession[] = [-20, -14, -8, -2].map((d, i) => ({
    id: `pts-misaki-${i}`, gymId, userId: "u-misaki", planId: "pt-misaki", date: dstr(d),
    durationMinutes: 60, category: "筋力トレーニング", attended: "done", weight: 57.5 - i * 0.3,
    condition: "mid", afterState: "good", createdAt: iso(d, 19),
  }));
  const ptInquiries: PtInquiry[] = [
    { id: "pti-ichiro", gymId, userId: "u-ichiro", status: "wanted", createdAt: iso(-3) },
  ];

  return {
    gyms, users, dailyCheckins, painLogs, activityLogs, runningLogs: [],
    restDayLogs, nutritionLogs, waterCutPeriods, waterCutLogs, hydrationLogs,
    weighInRecoveries: [], camps, ptPlans, ptSessions, ptInquiries,
    attendanceLogs, followupLogs: [], history: [], logins: [],
  };
}
