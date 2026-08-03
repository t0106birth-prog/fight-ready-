import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { hasUnlock } from "@/lib/unlock";
import { getDb } from "@/lib/store";
import { StatusTile } from "@/components/StatusTile";
import { SigBadge } from "@/components/SigBadge";
import { statusTiles, activeWaterCut, latestWaterCutLog, latestHydration } from "@/lib/derive";
import { dailyVerdict, acuteLoss } from "@/lib/judge";
import { SubmitButton } from "@/components/SubmitButton";
import { sportLabel, LV3, SLUGGISH } from "@/lib/constants";
import { fmtDate, ageFrom, untilLabel, round1 } from "@/lib/calc";
import { hqLinkGymAction } from "../../actions";

/**
 * 本部（HQ）用の利用者詳細（全ジム横断・読み取り専用）。
 * fr_hq 解錠が必須。スタッフ画面と違い、どのジムの選手/会員でも中身を確認できる。
 */
export default async function HqUserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ linked?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const db = await getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) notFound();
  const gym = db.gyms.find((g) => g.id === user.gymId);
  const linkable = user.role === "pro" || user.role === "member";

  const tiles = statusTiles(db, user);
  const verdict = dailyVerdict(db, user);

  // 水抜きの詳細（選手で進行中の期間があるとき）
  const wc = user.role === "pro" ? activeWaterCut(db, user.id) : null;
  const wcLog = wc ? latestWaterCutLog(db, user.id, wc.id) : null;
  const wcCur = wc ? (wcLog?.currentWeight ?? wc.baselineWeight) : null;
  const wcPct = wc && wcCur != null ? acuteLoss(wc.baselineWeight, wcCur).pct : null;
  const wcRem = wc && wcCur != null ? round1(wcCur - wc.targetWeight) : null;
  const wcHyd = wc ? latestHydration(db, user.id, wc.id) : null;
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

      {/* 所属ジムの紐付け（無所属→ジム、別ジムへ移動も） */}
      {linkable && (
        <div className="card tight" style={{ marginTop: 8 }}>
          <div className="row"><span className="meta">所属ジム</span><b>{gym ? gym.name : "無所属（未紐付け）"}</b></div>
          {sp.linked && <div className="sig sig-green" style={{ marginTop: 4 }}>紐付けを更新しました。</div>}
          <form action={hqLinkGymAction} style={{ marginTop: 6 }}>
            <input type="hidden" name="userId" value={id} />
            <div className="row" style={{ gap: 8 }}>
              <select name="gymId" defaultValue={user.gymId ?? ""} style={{ flex: 1 }}>
                <option value="">無所属（未紐付け）</option>
                {db.gyms.filter((g) => !g.suspended).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <SubmitButton className="btn btn-primary btn-sm" pendingLabel="…">紐付ける</SubmitButton>
            </div>
          </form>
        </div>
      )}

      <p className="kicker">今日の状態</p>
      <div className="status-grid">{tiles.map((t) => <StatusTile key={t.lbl} tile={t} />)}</div>

      {wc && wcCur != null && (
        <>
          <p className="kicker">水抜きの状況</p>
          <div className="card" style={{ borderColor: "var(--blue)" }}>
            <div className="row"><b>WATER CUT / HYDRO</b><span className={`sig sig-${(wcPct ?? 0) >= 5 ? "red" : (wcPct ?? 0) >= 2 ? "yellow" : "blue"}`}>開始から −{wcPct}%</span></div>
            <div className="progress-row"><span>現在体重</span><b>{wcCur}<span className="unit">kg</span></b></div>
            <div className="progress-row"><span>開始体重 → 計量目標</span><b>{wc.baselineWeight}kg → {wc.targetWeight}kg</b></div>
            <div className="progress-row"><span>計量まで残り</span><b>あと {(wcRem ?? 0) > 0 ? wcRem : 0}<span className="unit">kg</span></b></div>
            <div className="progress-row"><span>計量まで</span><b>{untilLabel(wc.weighInDatetime)}</b></div>
            {wcHyd?.urineSpecificGravity != null && (
              <div className="progress-row"><span>HYDRO（尿比重）</span><b>{wcHyd.urineSpecificGravity.toFixed(3)}</b></div>
            )}
          </div>
        </>
      )}

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
