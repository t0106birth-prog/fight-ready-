import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, gymMembers } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { SigBadge } from "@/components/SigBadge";
import { summarize, gymSummary, priorityScore } from "@/lib/staff";
import { sportLabel, bodyPartLabel } from "@/lib/constants";

export default async function StaffHome() {
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const members = await gymMembers(staff);
  const sums = members.map((m) => summarize(db, m));
  const gs = gymSummary(sums);

  const priority = sums
    .map((s) => ({ s, score: priorityScore(s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const gym = db.gyms.find((g) => g.id === staff.gymId);

  return (
    <>
      <Hero title="ジムスタッフ" sub={gym?.name} backHref="/staff" />
      <div className="shell-wide">
        {/* 上部サマリー */}
        <div className="grid3">
          <Stat n={gs.pros} l="選手" />
          <Stat n={gs.members} l="一般会員" />
          <Stat n={gs.red} l="赤判定" tone="red" />
          <Stat n={gs.yellow} l="黄判定" tone="yellow" />
          <Stat n={gs.noRecord7} l="7日以上未入力" />
          <Stat n={gs.noVisit7} l="7日以上来館なし" />
          <Stat n={gs.ptTrials} l="体験希望" tone="green" />
          <Stat n={gs.ptEnding} l="パーソナル残1以下" />
        </div>

        <p className="kicker">今日確認する利用者</p>
        {priority.length === 0 && <div className="card"><p className="meta mt0">特に注意が必要な利用者はいません。</p></div>}
        {priority.map(({ s }) => (
          <Link key={s.user.id} href={`/staff/user/${s.user.id}`} className="card" style={{ display: "block", color: "var(--ink)" }}>
            <div className="row">
              <div>
                <b>{s.user.name}</b>{" "}
                <span className="meta">{s.user.role === "pro" ? "プロ" : "一般"}・{sportLabel(s.user.primarySport)}</span>
              </div>
              <SigBadge level={s.verdict.level} />
            </div>
            <p className="meta mt0" style={{ marginBottom: 0 }}>
              {[
                s.waterCutPct != null ? `水抜き -${s.waterCutPct}%` : null,
                s.painParts.length ? `痛み: ${s.painParts.map(bodyPartLabel).join("・")}` : null,
                (s.lastCheckinDays ?? 0) >= 7 ? `最終記録${s.lastCheckinDays}日前` : null,
                (s.lastVisitDays ?? 0) >= 7 ? `最終来館${s.lastVisitDays}日前` : null,
                s.ptStatus === "体験希望" ? "パーソナル体験希望" : null,
                s.verdict.reasons[0],
              ].filter(Boolean).join(" / ")}
            </p>
          </Link>
        ))}

        <Link href="/staff/users" className="btn btn-ghost" style={{ marginTop: 12 }}>利用者一覧をすべて見る</Link>
      </div>
      <StaffTabbar active="home" />
    </>
  );
}

function Stat({ n, l, tone }: { n: number; l: string; tone?: "red" | "yellow" | "green" }) {
  const color = tone === "red" ? "var(--red-bright)" : tone === "yellow" ? "var(--amber-ink)" : tone === "green" ? "var(--green-bright)" : "var(--ink)";
  return (
    <div className="status-tile" style={{ textAlign: "center" }}>
      <div className="val" style={{ color, fontSize: 26 }}>{n}</div>
      <div className="lbl">{l}</div>
    </div>
  );
}
