/** 日付・時間・体重計算のユーティリティ。 */

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export const APP_TIME_ZONE = "Asia/Tokyo";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function businessDate(date = new Date()): string {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function toDateTimeLocal(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const p = zonedParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * 保存済みの「任意」日時を datetime-local の defaultValue にする。
 * 未設定なら空欄（引数なしの toDateTimeLocal() は"現在時刻"を返すので、任意項目にそれを使うと
 * 未入力でも今の日時が勝手に入ってしまう＝試合日時が今日扱いになり記録が試合当日ロックされる）。
 */
export function toDateTimeLocalValue(iso?: string): string {
  return iso ? toDateTimeLocal(iso) : "";
}

export function fromDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? new Date(value) : new Date(`${value}:00+09:00`);
  if (Number.isNaN(d.getTime())) return ""; // 壊れた日時文字列で .toISOString() が例外(500)にならないようガード
  return d.toISOString();
}

export function addDays(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: string): string {
  const p = zonedParts(new Date(d));
  return `${Number(p.month)}/${Number(p.day)}`;
}
export function fmtDateFull(d: string): string {
  const t = new Date(d);
  const p = zonedParts(t);
  const wd = new Intl.DateTimeFormat("ja-JP", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(t);
  return `${p.year}年${Number(p.month)}月${Number(p.day)}日(${wd.replace("曜日", "")})`;
}
export function fmtDateTime(iso: string): string {
  const p = zonedParts(new Date(iso));
  return `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`;
}

export function todayStr(): string {
  return businessDate();
}

export function signed(value: number, unit = ""): string {
  const n = round1(value);
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`;
}

/** a から b までの日数（b - a、切り捨て）。負もあり */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
}

/** 今から target までの残り日数（過去なら負） */
export function daysUntil(target?: string): number | null {
  if (!target) return null;
  return daysBetween(todayStr(), target.slice(0, 10));
}

/** 計量までの残り日数を人にやさしいラベルに（過去は「経過」表記にして負数を出さない） */
export function weighInDayLabel(days: number | null): string {
  if (days == null) return "—";
  if (days > 0) return `あと${days}日`;
  if (days === 0) return "計量当日";
  return `計量から${-days}日経過`;
}

/** 残り時間を「◯日◯時間」表記に */
export function untilLabel(targetIso?: string): string {
  if (!targetIso) return "—";
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "経過";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const rh = h % 24;
  if (d > 0) return `${d}日${rh}時間`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}時間${m}分`;
}

/** 時間差(時間) */
export function hoursBetweenIso(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

/** 予定体重線: start(現在体重/開始日) から target(目標体重/目標日) への線形補間 */
export function plannedWeight(
  startW: number,
  startDate: string,
  targetW: number,
  targetDate: string,
  onDate: string
): number {
  const total = daysBetween(startDate, targetDate);
  if (total <= 0) return targetW;
  const elapsed = Math.min(Math.max(daysBetween(startDate, onDate), 0), total);
  return startW + ((targetW - startW) * elapsed) / total;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 生年月日から満年齢を出す（誕生日前ならマイナス1歳） */
export function ageFrom(birthDate?: string): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** ISO週(日曜始まり)の開始日 YYYY-MM-DD */
export function weekStart(d = todayStr()): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - t.getUTCDay());
  return t.toISOString().slice(0, 10);
}
