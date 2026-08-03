import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { hasUnlock } from "@/lib/unlock";
import { getDb } from "@/lib/store";
import { StatusTile } from "@/components/StatusTile";
import { SigBadge } from "@/components/SigBadge";
import { statusTiles } from "@/lib/derive";
import { dailyVerdict } from "@/lib/judge";
import { sportLabel, LV3, SLUGGISH } from "@/lib/constants";
import { fmtDate, ageFrom } from "@/lib/calc";

/**
 * 本部（HQ）用の利用者詳細（全ジム横断・読み取り専用）。
 * fr_hq 解錠が必須。スタッフ画面と違い、どのジムの選手/会員でも中身を確認できる。
 */
export default async function HqUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const db = await getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) notFound();
  const gym = db.gyms.find((g) => g.id === user.gymId);

  const tiles = statusTiles(db, user);
  const verdict = dailyVerdict(db, user);
  const checks = db.dailyCheckins.filter((c) => c.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);
  const acts = [
    ...db.activityLogs.filter((a) => a.userId === id).map((a) => ({ d: a.date, t: a.activityType, m: a.durationMinutes })),
    ...db.runningLogs.filter((r) => r.userId === id).map((r) => ({ d: r.date, t: `🏃${r.category}`, m: r.durationMinutes })),
  ].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8);

  return (
    <div className="shell-wide">
      <div className="brand-hero">
        <div className="brand-logo" style={{ fontSize: 22 }}>本部 / 利用者</div>
        <div className="brand-tag">
          {user.name}（{user.role === "pro" ? "選手" : user.role === "member" ? "一般会員" : "スタッフ"}）
        </div>
        <div className="brand-sub">
          {[gym?.name, sportLabel(user.primarySport), ageFrom(user.birthDate) != null ? `${ageFrom(user.birthDate)}歳` : null, user.heightCm ? `${user.heightCm}cm` : null].filter(Boolean).join("・")}
        </div>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <SigBadge level={verdict.level} />
        <span className="meta">{verdict.reasons.slice(0, 2).join(" / ")}</span>
      </div>

      <p className="kicker">今日の状態</p>
      <div className="status-grid">{tiles.map((t) => <StatusTile key={t.lbl} tile={t} />)}</div>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="card tight">
          <b>最近の朝チェック</b>
          {checks.map((c) => (
            <div className="progress-row" key={c.id} style={{ fontSize: 13 }}>
              <span>{fmtDate(c.date)}</span>
              <span>{c.weight ?? "—"}kg / 疲{LV3[c.fatigueLevel ?? ""] ?? "—"} / だ{SLUGGISH[c.sluggishnessLevel ?? ""] ?? "—"}</span>
            </div>
          ))}
          {checks.length === 0 && <p className="meta mt0">記録なし</p>}
        </div>
        <div className="card tight">
          <b>最近の運動</b>
          {acts.map((a, i) => (
            <div className="progress-row" key={i} style={{ fontSize: 13 }}><span>{fmtDate(a.d)}</span><span>{a.t} {a.m}分</span></div>
          ))}
          {acts.length === 0 && <p className="meta mt0">記録なし</p>}
        </div>
      </div>

      <p className="info-note" style={{ marginTop: 12 }}>本部からの閲覧（読み取り専用）。記録の編集や連絡はできません。</p>
      <p className="center small" style={{ marginTop: 8 }}><Link href="/hq">← 本部にもどる</Link></p>
    </div>
  );
}
