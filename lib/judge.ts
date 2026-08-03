/**
 * 判定ロジック(§25, §27, §29, §33-35, §ONE)。
 *
 * 医療ルール(§35):
 *  - 病名を断定しない（「脱水症です」等は使わない）
 *  - 水抜き方法や水分量を指示しない
 *  - 症状がある場合は減少率・尿比重に関係なく赤を優先する
 *
 * 判定は「1つの総合点」ではなくカテゴリごとに出す(§33)。ここでは画面表示用に
 * 総合の信号色(緑/黄/赤)＋理由の配列を返す。
 */
import type {
  DB, User, DailyCheckin, PainLog, RestDayLog, ActivityLog, RunningLog,
} from "./types";
import { daysBetween, plannedWeight, round1, todayStr, weekStart } from "./calc";

export type Signal = "green" | "yellow" | "red" | "blue";

export interface Verdict {
  level: Signal;
  label: string;
  reasons: string[];
}

export const SIGNAL_LABEL: Record<Signal, string> = {
  green: "READY",
  yellow: "CAUTION",
  red: "STOP & CHECK",
  blue: "—",
};

/* ───────── 急性体重減少率(§24-25) ───────── */

export function acuteLoss(baseline: number, current: number) {
  const kg = round1(baseline - current);
  const pct = baseline > 0 ? Math.round(((baseline - current) / baseline) * 1000) / 10 : 0;
  return { kg, pct };
}

export interface Band {
  level: Signal;
  title: string;
  message: string;
}

/**
 * 急性体重減少率の参考区分(§25)。
 * 「安全を保証する範囲」ではなく監視用参考区分。緑は使わず、参考範囲は青。
 * 症状がある場合は減少率に関係なく赤を優先する。
 */
export function acuteLossBand(pct: number, hasSymptom: boolean): Band {
  if (hasSymptom) {
    return {
      level: "red",
      title: "症状あり — 確認を推奨",
      message: "体調の異常が入力されています。減少率に関わらず、これ以上進める前に周囲のスタッフへ伝え、必要に応じて医療専門職へ相談してください。",
    };
  }
  if (pct >= 5) {
    return {
      level: "red",
      title: "危険領域（5%以上）",
      message: pct >= 7
        ? "7%以上の極めて大きな急性減少です。これ以上進めず、医療専門職または適切な専門家へ確認してください。"
        : pct >= 6
          ? "6%以上の急性減少です。5%以上はすべて危険域であり、これ以上進める前に専門家の確認が必要です。"
          : "5%以上は危険域です。これ以上進める前に、医療専門職または適切な専門家による確認を推奨します。",
    };
  }
  if (pct >= 2) {
    return {
      level: "yellow",
      title: "注意領域（2%以上5%未満）",
      message: "急性の体重減少が進んでいます。体調と水分状態を確認してください。",
    };
  }
  return {
    level: "blue",
    title: "参考範囲（0%以上2%未満）",
    message: "変化を継続確認してください。",
  };
}

/** 水抜き早見表(§26): 基準体重に対する1〜5%相当kg */
export function waterCutTable(baseline: number) {
  return [1, 2, 3, 5].map((p) => {
    const kg = round1((baseline * p) / 100);
    return { pct: p, kg, weight: round1(baseline - kg) };
  });
}

/* ───────── HYDRO 尿比重(§27) ───────── */

export function hydroBand(usg?: number | null): Band | null {
  if (usg == null) return null;
  if (usg >= 1.03) {
    return { level: "red", title: "危険領域（1.030以上）", message: "強く濃縮している可能性があります。体重変化と症状を合わせて確認してください。" };
  }
  if (usg >= 1.021) {
    return { level: "yellow", title: "注意（1.021〜1.029）", message: "尿が濃くなっている可能性があります。" };
  }
  return { level: "blue", title: "HYDRO参考基準内（1.020以下）", message: "尿比重は参考基準内です（全身の水分状態を確定するものではありません）。" };
}

/* ───────── ONE Championship 対応(§ONE) ───────── */

export const ONE_THRESHOLD = 1.025;

/** ONE 公式参考基準に対するアプリ内表示区分 */
export function oneHydroBand(usg?: number | null): Band | null {
  if (usg == null) return null;
  if (usg > 1.025) {
    return { level: "red", title: "ONE基準外（1.0250超）", message: "ONE公式ハイドレーション基準を超えています。ONE公式計量条件を満たしていない参考判定になります。" };
  }
  if (usg >= 1.0201) {
    return { level: "yellow", title: "ONE基準内・境界域（1.0201〜1.0250）", message: "ONE公式基準内ですが、基準値に近い状態です。測定条件や機器の違いにより公式検査結果と異なる可能性があります。" };
  }
  return { level: "blue", title: "余裕あり・参考（1.0200以下）", message: "ONE公式基準に対して余裕のある数値です。ただし公式検査での合格や安全性を保証するものではありません。" };
}

/** ONE の尿比重＋同時体重による参考判定(§ONE) */
export function oneReadyVerdict(usg: number, weight: number, contract: number): Verdict {
  const hydroOk = usg <= ONE_THRESHOLD;
  const weightOk = weight <= contract;
  if (hydroOk && weightOk) {
    return { level: "green", label: "ONE READY 参考", reasons: ["尿比重と体重がONE公式基準の参考範囲内です（公式検査での合格を保証するものではありません）。"] };
  }
  if (hydroOk && !weightOk) {
    return { level: "yellow", label: "HYDRATION OK ／ WEIGHT OVER", reasons: [`尿比重はONE基準内ですが、体重が契約体重を ${round1(weight - contract)}kg 超えています。`] };
  }
  if (!hydroOk && weightOk) {
    return { level: "red", label: "WEIGHT OK ／ HYDRATION OUT", reasons: ["体重は契約体重内ですが、尿比重がONE基準を超えています。正式なONE計量条件を満たしていない参考判定です。"] };
  }
  return { level: "red", label: "HYDRATION OUT ／ WEIGHT OVER", reasons: ["尿比重・体重ともにONE基準を満たしていない参考判定です。"] };
}

/* ───────── 通常時の緑・黄・赤判定(§34) ───────── */

const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1);

/** 直近 n 日ぶんのチェックインを日付降順で */
function recentCheckins(db: DB, userId: string, n = 7): DailyCheckin[] {
  return db.dailyCheckins
    .filter((c) => c.userId === userId)
    .sort(byDateDesc)
    .slice(0, n);
}

/** ある値が「直近で連続 k 日以上」続いているか */
function consecutive<T extends { date: string }>(rows: T[], pred: (r: T) => boolean, k: number): boolean {
  let run = 0;
  let previousDate: string | null = null;
  for (const r of rows) {
    if (previousDate && Math.abs(daysBetween(r.date, previousDate)) !== 1) break;
    if (pred(r)) {
      run++;
      if (run >= k) return true;
    } else break;
    previousDate = r.date;
  }
  return false;
}

/** 総合の信号（画面のバッジ用）。プロ／一般共通の中核。 */
export function dailyVerdict(db: DB, user: User): Verdict {
  const reasons: string[] = [];
  let level: Signal = "green";
  const bump = (l: Signal, why: string) => {
    reasons.push(why);
    if (l === "red") level = "red";
    else if (l === "yellow" && level !== "red") level = "yellow";
  };

  const checks = recentCheckins(db, user.id, 7);
  const latest = checks[0];

  // ── 赤: 危険症状・強い痛み・強い脱力 ──
  if (latest?.dangerSymptoms?.length) {
    bump("red", `危険症状が入力されています（${latest.dangerSymptoms.join("・")}）`);
  }
  if (latest?.painLevel === "strong") bump("red", "強い痛みが記録されています");
  if (latest?.sluggishnessLevel === "strong" && latest?.fatigueLevel === "high") {
    bump("red", "強いだるさと疲労が同時に記録されています");
  }

  // ── 赤: 急激な体重減少（直近2日で目標に対し速すぎ、または前日比大） ──
  const weights = db.dailyCheckins
    .filter((c) => c.userId === user.id && c.weight != null)
    .sort(byDateDesc);
  if (weights.length >= 2) {
    const drop = (weights[1].weight as number) - (weights[0].weight as number);
    const days = Math.max(1, daysBetween(weights[1].date, weights[0].date));
    const perDay = drop / days;
    if (perDay >= 1.2) bump("red", "急激な体重減少が確認されています");
    else if (perDay >= 0.6) bump("yellow", "体重減少が予定より速い可能性があります");
  }

  // ── 黄: 疲労・だるさ・睡眠が2日以上続く ──
  if (consecutive(checks, (c) => c.fatigueLevel === "high", 2)) bump("yellow", "疲労が2日以上続いています");
  if (consecutive(checks, (c) => c.sluggishnessLevel === "strong", 2)) bump("yellow", "だるさが2日以上続いています");
  if (consecutive(checks, (c) => c.sleepQuality === "bad", 2)) bump("yellow", "睡眠不良が2日以上続いています");

  // ── 黄: 今日の動きが2回連続で重い ──
  const acts = db.activityLogs.filter((a) => a.userId === user.id).sort(byDateDesc);
  if (acts.length >= 2 && acts[0].movementFeeling === "heavy" && acts[1].movementFeeling === "heavy") {
    bump("yellow", "今日の動きが2回連続で重くなっています");
  }

  // ── 黄: 運動量の急増（今週 vs 先週の負荷合計） ──
  const ws = weekStart();
  const prevWs = weekStart(new Date(new Date(ws).getTime() - 86400000).toISOString().slice(0, 10));
  const loadSum = (from: string, to: string) =>
    db.activityLogs.filter((a) => a.userId === user.id && a.date >= from && a.date < to)
      .reduce((s, a) => s + (a.load ?? a.durationMinutes * (a.rpe ?? 5)), 0);
  const thisWeek = loadSum(ws, todayStr() + "z");
  const lastWeek = loadSum(prevWs, ws);
  if (lastWeek > 0 && thisWeek > lastWeek * 1.8) bump("yellow", "運動量が急増しています");

  // ── 黄: 同じ場所の痛みが3日以上続く ──
  const painByLoc: Record<string, string[]> = {};
  db.painLogs.filter((p) => p.userId === user.id && daysBetween(p.date, todayStr()) <= 7).forEach((p) => {
    (painByLoc[p.locationId] ??= []).push(p.date);
  });
  const hasThreeDayPain = Object.values(painByLoc).some((dates) => {
    const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
    return unique.length >= 3 && daysBetween(unique[2], unique[1]) === 1 && daysBetween(unique[1], unique[0]) === 1;
  });
  if (hasThreeDayPain) {
    bump("yellow", "同じ場所の痛みが3日以上続いています");
  }

  // ── 黄: 7日以上 完全休養日がない ──
  const restDays = db.restDayLogs.filter((r) => r.userId === user.id).sort(byDateDesc);
  const lastFullRest = restDays.find((r) => r.dayType === "完全休養日");
  if (!lastFullRest || daysBetween(lastFullRest.date, todayStr()) >= 7) {
    bump("yellow", "7日以上、完全休養日がありません");
  }

  // ── 黄/赤: 休養後の回復状態 ──
  if (restDays[0]) {
    if (restDays[0].recovery === "worse") bump("red", "休養後も状態が悪化しています");
    else if (restDays[0].recovery === "same") bump("yellow", "休養後も状態が改善していません");
  }

  // ── 黄: 一般会員の記録・来館が減っている ──
  if (user.role === "member") {
    const lastCheckin = checks[0]?.date;
    const daysSinceRecord = lastCheckin ? daysBetween(lastCheckin, todayStr()) : 999;
    if (daysSinceRecord >= 5) bump("yellow", "記録が空いています");
    const att = db.attendanceLogs.filter((a) => a.userId === user.id).sort(byDateDesc)[0];
    const daysSinceVisit = att ? daysBetween(att.date, todayStr()) : 999;
    if (daysSinceVisit >= 7) bump("yellow", "来館が空いています");
  }

  if (reasons.length === 0) reasons.push("大きな問題は見られません");
  return { level, label: SIGNAL_LABEL[level], reasons };
}

/* ───────── 体重進捗(§36) ───────── */

export function weightProgress(user: User, db: DB): { text: string; level: Signal } | null {
  if (!user.targetWeight || !user.targetDate || user.startWeight == null) return null;
  // 目標が開始体重と同じならプラン方向が定まらない → 評価しない（誤判定ガード）
  const goalDelta = round1(user.targetWeight - user.startWeight);
  if (goalDelta === 0) return null;
  const isLossPlan = goalDelta < 0; // 目標＜開始 = 減量プラン
  const weights = db.dailyCheckins
    .filter((c) => c.userId === user.id && c.weight != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const current = (weights[0]?.weight ?? user.startWeight) as number;
  const startDate = user.createdAt.slice(0, 10);
  const planned = plannedWeight(user.startWeight, startDate, user.targetWeight, user.targetDate, todayStr());
  const diff = round1(current - planned); // ＋＝予定より重い / −＝予定より軽い
  if (Math.abs(diff) <= 0.4) return { text: "予定どおりです", level: "green" };
  if (isLossPlan) {
    // 減量プラン：重い＝遅れ、軽い＝速く落ちている
    return diff > 0
      ? { text: `予定より${diff}kg 遅れています`, level: "yellow" }
      : { text: `予定より速く落ちています（${Math.abs(diff)}kg）`, level: "yellow" };
  }
  // 増量プラン：軽い＝遅れ、重い＝順調。減量プランと取り違えて「速く落ちている」とは言わない
  return diff < 0
    ? { text: `予定より${Math.abs(diff)}kg 遅れています`, level: "yellow" }
    : { text: `予定より${diff}kg 増えています`, level: "green" };
}
