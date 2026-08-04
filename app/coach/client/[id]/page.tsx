import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, assignmentFor, scopeAllowed, SCOPE_LABEL } from "@/lib/coach";
import { fmtDate } from "@/lib/calc";
import { bodyPartLabel } from "@/lib/constants";

/**
 * 顧客詳細（Phase 1・隠し・読み取り専用）。
 * セキュリティ: assignmentFor が active な割当を返す顧客だけ表示。担当外の直URLは notFound。
 * 表示は sharedScopes で本人が同意した範囲のみ。記録の書き換えはできない。
 */
export default async function CoachClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  if (coachWorkspaces(db, user.id).length === 0) redirect("/u");

  // 担当外・停止中・承認前は一切見せない（Cookie/hidden値ではなくDBで判定）
  const assignment = assignmentFor(db, user.id, id);
  if (!assignment) notFound();
  const client = db.users.find((u) => u.id === id && u.status === "active");
  if (!client) notFound();

  const checks = db.dailyCheckins.filter((c) => c.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = checks[0];
  const latestWeight = checks.find((c) => c.weight != null);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const actCount = db.activityLogs.filter((a) => a.userId === id && a.date >= weekAgo).length
    + db.runningLogs.filter((r) => r.userId === id && r.date >= weekAgo).length;
  const nutrition = db.nutritionLogs.filter((n) => n.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const pains = db.painLogs.filter((p) => p.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  const nutLabel: Record<string, string> = { done: "達成", partial: "一部", none: "未達" };
  const fatLabel: Record<string, string> = { low: "低い", mid: "普通", high: "高い" };
  const slpLabel: Record<string, string> = { good: "良い", normal: "普通", bad: "悪い" };

  return (
    <>
      <Hero title={client.name} sub="担当顧客" backHref="/coach/clients" />
      <div className="shell">
        <div className="alert-band alert-blue" style={{ margin: "0 0 10px" }}>
          <b>{client.name} さんの記録</b> — 本人が共有を許可した範囲だけを表示しています（閲覧のみ）。
        </div>

        {scopeAllowed(assignment, "weight") && (
          <>
            <p className="kicker">体重</p>
            <div className="card">
              {latestWeight?.weight != null
                ? <div className="progress-row"><span>最新体重（{fmtDate(latestWeight.date)}）</span><b>{latestWeight.weight}<span className="unit">kg</span></b></div>
                : <p className="meta mt0">記録がありません。</p>}
            </div>
          </>
        )}

        {scopeAllowed(assignment, "activity") && (
          <>
            <p className="kicker">運動</p>
            <div className="card">
              <div className="progress-row"><span>直近7日の運動回数</span><b>{actCount}<span className="unit">回</span></b></div>
            </div>
          </>
        )}

        {scopeAllowed(assignment, "nutrition") && (
          <>
            <p className="kicker">食事</p>
            <div className="card">
              {nutrition
                ? <div className="progress-row"><span>最新の食事目標（{fmtDate(nutrition.date)}）</span><b>{nutLabel[nutrition.goalAchieved] ?? nutrition.goalAchieved}</b></div>
                : <p className="meta mt0">記録がありません。</p>}
            </div>
          </>
        )}

        {scopeAllowed(assignment, "condition") && (
          <>
            <p className="kicker">コンディション</p>
            <div className="card">
              {latest
                ? <>
                    <div className="progress-row"><span>疲労感</span><b>{latest.fatigueLevel ? fatLabel[latest.fatigueLevel] : "—"}</b></div>
                    <div className="progress-row"><span>睡眠</span><b>{latest.sleepQuality ? slpLabel[latest.sleepQuality] : "—"}</b></div>
                    <p className="meta" style={{ marginBottom: 0 }}>{fmtDate(latest.date)} 時点</p>
                  </>
                : <p className="meta mt0">記録がありません。</p>}
            </div>
          </>
        )}

        {scopeAllowed(assignment, "pain") && (
          <>
            <p className="kicker">痛み</p>
            <div className="card">
              {pains.length > 0
                ? pains.map((p) => (
                    <div key={p.id} className="progress-row">
                      <span>{fmtDate(p.date)}・{bodyPartLabel(p.locationId)}</span>
                      <b>レベル{p.painLevel}</b>
                    </div>
                  ))
                : <p className="meta mt0">記録がありません。</p>}
            </div>
          </>
        )}

        <p className="info-note center" style={{ marginTop: 16 }}>
          <Link href="/coach/clients">← 担当顧客一覧へ</Link>
        </p>
      </div>
    </>
  );
}
