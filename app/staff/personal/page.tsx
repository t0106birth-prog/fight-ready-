import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, gymMembers } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { summarize } from "@/lib/staff";

export default async function StaffPersonal() {
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const members = await gymMembers(staff);
  const sums = members.map((m) => summarize(db, m));

  const trials = sums.filter((s) => s.ptStatus === "体験希望");
  const stalled = sums.filter((s) => (s.lastCheckinDays ?? 0) >= 14 || (s.lastVisitDays ?? 0) >= 14);
  const weightStalled = sums.filter((s) => s.remainKg != null && s.remainKg > 0 && (s.lastCheckinDays ?? 99) < 14 && s.verdict.level !== "green");

  const Section = ({ title, list, note }: { title: string; list: typeof sums; note?: (s: (typeof sums)[number]) => string }) => (
    <>
      <p className="kicker">{title}（{list.length}）</p>
      {list.length === 0 && <p className="meta">該当なし</p>}
      {list.map((s) => (
        <Link key={s.user.id} href={`/staff/user/${s.user.id}`} className="card tight" style={{ display: "block", color: "var(--ink)" }}>
          <div className="row"><b>{s.user.name}</b><span className="meta">{note ? note(s) : ""}</span></div>
        </Link>
      ))}
    </>
  );

  return (
    <>
      <Hero title="パーソナル体験・フォロー候補" sub="提案候補として表示（自動推奨はしません）" backHref="/staff" />
      <div className="shell-wide">
        <div className="card tight">
          <p className="info-note mt0">パーソナルはプランの管理はせず、「体験に興味がある」会員だけを見込みとして表示します。案内は対面・電話などで行い、対応状況は各利用者の画面から記録できます。</p>
        </div>
        <Section title="🔥 パーソナル体験希望者" list={trials} note={() => "体験を案内する"} />
        <Section title="2週間以上停滞している会員" list={stalled} note={(s) => `最終記録${s.lastCheckinDays ?? "—"}日前 / 来館${s.lastVisitDays ?? "—"}日前`} />
        <Section title="体重が停滞している会員" list={weightStalled} note={(s) => `目標まで残り${s.remainKg}kg`} />
      </div>
      <StaffTabbar active="personal" />
    </>
  );
}
