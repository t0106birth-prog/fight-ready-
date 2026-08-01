import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { businessDate, weekStart, todayStr, round1, daysUntil, signed } from "@/lib/calc";
import { acuteLoss, weightProgress } from "@/lib/judge";
import { activeWaterCut, latestWaterCutLog } from "@/lib/derive";

const AVG = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

export default async function WeeklyPage() {
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  const ws = weekStart();
  const inWeek = (d: string) => d >= ws && d <= todayStr();

  const checks = db.dailyCheckins.filter((c) => c.userId === user.id && inWeek(c.date)).sort((a, b) => a.date.localeCompare(b.date));
  const acts = db.activityLogs.filter((a) => a.userId === user.id && inWeek(a.date));
  const runs = db.runningLogs.filter((r) => r.userId === user.id && inWeek(r.date));
  const nut = db.nutritionLogs.filter((n) => n.userId === user.id && inWeek(n.date));
  const rests = db.restDayLogs.filter((r) => r.userId === user.id && inWeek(r.date));

  const weights = checks.filter((c) => c.weight != null).map((c) => c.weight as number);
  const weightChange = weights.length >= 2 ? round1(weights[weights.length - 1] - weights[0]) : null;
  const actMin = acts.reduce((s, a) => s + a.durationMinutes, 0);
  const runMin = runs.reduce((s, r) => s + r.durationMinutes, 0);
  const dashes = runs.reduce((s, r) => s + (r.dashCount ?? 0), 0);
  const nutRate = nut.length ? Math.round((nut.filter((n) => n.goalAchieved === "done").length / nut.length) * 100) : null;
  const fatigueMap: Record<string, number> = { low: 1, mid: 2, high: 3 };
  const slugMap: Record<string, number> = { none: 1, some: 2, strong: 3 };
  const avgFatigue = AVG(checks.map((c) => fatigueMap[c.fatigueLevel ?? ""] ?? 0).filter(Boolean));
  const avgSlug = AVG(checks.map((c) => slugMap[c.sluggishnessLevel ?? ""] ?? 0).filter(Boolean));
  const painLocs = new Set(db.painLogs.filter((p) => p.userId === user.id && inWeek(p.date)).map((p) => p.locationId));

  const rows: [string, string][] = [
    ["体重の変化", weightChange != null ? `${weightChange > 0 ? "+" : ""}${weightChange}kg` : "—"],
    ["運動回数", `${new Set([...acts.map((a) => a.date), ...runs.map((r) => r.date)]).size}回`],
    ["合計運動時間", `${actMin}分`],
    ["ランニング回数", `${runs.length}回`],
    ["ランニング合計時間", `${runMin}分`],
    ["ダッシュ本数", `${dashes}本`],
    ["食事達成率", nutRate != null ? `${nutRate}%` : "—"],
    ["平均疲労", avgFatigue != null ? `${avgFatigue}/3` : "—"],
    ["平均だるさ", avgSlug != null ? `${avgSlug}/3` : "—"],
    ["休養日数", `${rests.filter((r) => r.dayType !== "通常練習日" && r.dayType !== "高強度練習日").length}日`],
    ["痛みの継続", painLocs.size ? `${painLocs.size}部位` : "なし"],
    ["記録日数", `${new Set(checks.map((c) => c.date)).size}日`],
  ];

  if (user.role === "member") {
    const plan = db.ptPlans.find((p) => p.userId === user.id && p.status === "active");
    if (plan) {
      rows.push(["パーソナル実施回数", `${plan.completedSessions}回`]);
      rows.push(["パーソナル残り回数", `${plan.totalSessions - plan.completedSessions}回`]);
    }
  } else {
    const wd = daysUntil(user.weighInAt ? businessDate(new Date(user.weighInAt)) : undefined);
    if (wd != null) rows.push(["計量までの日数", `${wd}日`]);
    const wp = weightProgress(user, db);
    if (wp) rows.push(["予定体重線との差", wp.text]);
    const period = activeWaterCut(db, user.id);
    const log = period ? latestWaterCutLog(db, user.id, period.id) : null;
    if (period && log) rows.push(["急性体重減少率", signed(-acuteLoss(period.baselineWeight, log.currentWeight).pct, "%")]);
  }

  return (
    <>
      <Hero title="今週の振り返り" sub={`${ws.slice(5).replace("-", "/")} 〜 今日`} backHref="/u" />
      <div className="shell">
        <div className="card">
          {rows.map(([k, v]) => (
            <div className="progress-row" key={k}><span>{k}</span><b style={{ fontSize: 16 }}>{v}</b></div>
          ))}
        </div>
        <p className="info-note center">読みやすさを優先し、細かい数値は詰め込みすぎない表示にしています。</p>
      </div>
      <UserTabbar active="home" />
    </>
  );
}
