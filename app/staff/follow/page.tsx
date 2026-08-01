import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, gymMembers } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { SigBadge } from "@/components/SigBadge";
import { summarize, followRisk } from "@/lib/staff";
import { sportLabel } from "@/lib/constants";

const RISK_LABEL = { high: "高リスク", mid: "注意", low: "低リスク" } as const;

export default async function FollowPage() {
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const members = await gymMembers(staff);
  const sums = members.map((m) => summarize(db, m));

  const groups = {
    high: sums.filter((s) => followRisk(s) === "high"),
    mid: sums.filter((s) => followRisk(s) === "mid"),
    low: sums.filter((s) => followRisk(s) === "low"),
  };
  const reason = (s: ReturnType<typeof summarize>) => [
    (s.lastVisitDays ?? 0) >= 14 ? `${s.lastVisitDays}日来館なし` : (s.lastVisitDays ?? 0) >= 7 ? `来館頻度低下(${s.lastVisitDays}日)` : null,
    (s.lastCheckinDays ?? 0) >= 10 ? `${s.lastCheckinDays}日記録なし` : (s.lastCheckinDays ?? 0) >= 5 ? `記録頻度低下(${s.lastCheckinDays}日)` : null,
    (s.user.goals ?? []).length === 0 ? "目標未設定" : null,
    s.ptStatus === "体験希望" ? "パーソナル体験希望" : null,
  ].filter(Boolean).join(" / ") || "経過を確認";

  return (
    <>
      <Hero title="フォロー候補" sub="退会前に早めにフォロー" backHref="/staff" />
      <div className="shell-wide">
        <div className="card tight">
          <p className="meta mt0">「退会予測」ではなく「フォロー候補」として表示します。連絡はアプリ内チャットではなく、対応状況の記録だけを行います。</p>
        </div>

        {(["high", "mid"] as const).map((k) => (
          <div key={k}>
            <p className="kicker">{RISK_LABEL[k]}（{groups[k].length}名）</p>
            {groups[k].length === 0 && <p className="meta">該当なし</p>}
            {groups[k].map((s) => (
              <Link key={s.user.id} href={`/staff/user/${s.user.id}`} className="card" style={{ display: "block", color: "var(--ink)" }}>
                <div className="row">
                  <div><b>{s.user.name}</b> <span className="meta">{s.user.role === "pro" ? "プロ" : "一般"}・{sportLabel(s.user.primarySport)}</span></div>
                  <SigBadge level={s.verdict.level} />
                </div>
                <p className="meta mt0" style={{ marginBottom: 0 }}>{reason(s)}</p>
              </Link>
            ))}
          </div>
        ))}

        <p className="kicker">低リスク（{groups.low.length}名）</p>
        <div className="card tight">
          <p className="meta mt0">{groups.low.map((s) => s.user.name).join("・") || "—"}</p>
        </div>
      </div>
      <StaffTabbar active="follow" />
    </>
  );
}
