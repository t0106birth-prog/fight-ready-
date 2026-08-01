import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, gymMembers } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { SigBadge } from "@/components/SigBadge";
import { summarize, priorityScore, type MemberSummary } from "@/lib/staff";
import { sportLabel, bodyPartLabel, LV3, SLUGGISH } from "@/lib/constants";
import { signed } from "@/lib/calc";

const FILTERS: { k: string; l: string }[] = [
  { k: "all", l: "すべて" }, { k: "pro", l: "選手" }, { k: "member", l: "一般会員" },
  { k: "green", l: "緑" }, { k: "yellow", l: "黄" }, { k: "red", l: "赤" },
  { k: "norecord", l: "7日以上未入力" }, { k: "novisit", l: "7日以上来館なし" },
  { k: "watercut", l: "水抜き中" }, { k: "pt", l: "パーソナル受講中" }, { k: "trial", l: "体験希望" },
];
const SORTS: { k: string; l: string }[] = [
  { k: "risk", l: "危険度順" }, { k: "target", l: "目標日が近い順" }, { k: "fatigue", l: "疲労が強い順" },
  { k: "norecord", l: "未入力日数順" }, { k: "novisit", l: "来館が少ない順" }, { k: "watercut", l: "水抜き減少率順" },
];

function match(s: MemberSummary, f: string): boolean {
  switch (f) {
    case "pro": return s.user.role === "pro";
    case "member": return s.user.role === "member";
    case "green": return s.verdict.level === "green";
    case "yellow": return s.verdict.level === "yellow";
    case "red": return s.verdict.level === "red";
    case "norecord": return (s.lastCheckinDays ?? 999) >= 7;
    case "novisit": return (s.lastVisitDays ?? 999) >= 7;
    case "watercut": return s.waterCutPct != null;
    case "pt": return s.ptStatus.startsWith("受講中");
    case "trial": return s.ptStatus === "体験希望";
    default: return true;
  }
}
const fatigueRank: Record<string, number> = { high: 3, mid: 2, low: 1 };

export default async function UsersList({ searchParams }: { searchParams: Promise<{ f?: string; sort?: string }> }) {
  const sp = await searchParams;
  const f = sp.f ?? "all";
  const sort = sp.sort ?? "risk";
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const members = await gymMembers(staff);
  let sums = members.map((m) => summarize(db, m)).filter((s) => match(s, f));

  sums = sums.sort((a, b) => {
    switch (sort) {
      case "target": return (a.targetDays ?? 9999) - (b.targetDays ?? 9999);
      case "fatigue": return (fatigueRank[b.fatigue ?? ""] ?? 0) - (fatigueRank[a.fatigue ?? ""] ?? 0);
      case "norecord": return (b.lastCheckinDays ?? 0) - (a.lastCheckinDays ?? 0);
      case "novisit": return (b.lastVisitDays ?? 0) - (a.lastVisitDays ?? 0);
      case "watercut": return (b.waterCutPct ?? -1) - (a.waterCutPct ?? -1);
      default: return priorityScore(b) - priorityScore(a);
    }
  });

  const q = (obj: Record<string, string>) => "?" + new URLSearchParams({ f, sort, ...obj }).toString();

  return (
    <>
      <Hero title="利用者一覧" sub={`${sums.length}名`} backHref="/staff" />
      <div className="shell-wide">
        <div className="seg wrap" style={{ marginBottom: 6 }}>
          {FILTERS.map((x) => (
            <Link key={x.k} href={q({ f: x.k })} className="seg" style={{ padding: 0 }}>
              <span style={{ padding: "8px 12px", borderRadius: 999, fontSize: 13, background: f === x.k ? "var(--red)" : "var(--surface)", color: f === x.k ? "#fff" : "var(--ink)", border: "1.5px solid var(--line)" }}>{x.l}</span>
            </Link>
          ))}
        </div>
        <div className="seg wrap" style={{ marginBottom: 10 }}>
          <span className="meta" style={{ alignSelf: "center" }}>並び替え:</span>
          {SORTS.map((x) => (
            <Link key={x.k} href={q({ sort: x.k })} style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12.5, background: sort === x.k ? "var(--surface2)" : "transparent", color: sort === x.k ? "var(--ink)" : "var(--muted)", border: "1px solid var(--line)" }}>{x.l}</Link>
          ))}
        </div>

        <div className="table-scroll">
          <table className="list">
            <thead>
              <tr>
                <th>氏名</th><th>区分</th><th>格闘技</th><th>状態</th><th>現在体重</th><th>残り</th>
                <th>疲労</th><th>だるさ</th><th>痛む場所</th><th>最終入力</th><th>最終来館</th><th>パーソナル</th><th>水抜き</th>
              </tr>
            </thead>
            <tbody>
              {sums.map((s) => (
                <tr key={s.user.id} className="clickable">
                  <td><Link href={`/staff/user/${s.user.id}`}>{s.user.name}</Link></td>
                  <td>{s.user.role === "pro" ? "プロ" : "一般"}</td>
                  <td>{sportLabel(s.user.primarySport)}</td>
                  <td><SigBadge level={s.verdict.level} /></td>
                  <td>{s.currentWeight != null ? `${s.currentWeight}kg` : "—"}</td>
                  <td>{s.remainKg != null ? `${s.remainKg > 0 ? s.remainKg : 0}kg` : "—"}</td>
                  <td>{LV3[s.fatigue ?? ""] ?? "—"}</td>
                  <td>{SLUGGISH[s.sluggish ?? ""] ?? "—"}</td>
                  <td>{s.painParts.length ? s.painParts.map(bodyPartLabel).join("・") : "—"}</td>
                  <td>{s.lastCheckinDays != null ? `${s.lastCheckinDays}日前` : "—"}</td>
                  <td>{s.lastVisitDays != null ? `${s.lastVisitDays}日前` : "—"}</td>
                  <td>{s.ptStatus}</td>
                  <td>{s.waterCutPct != null ? signed(-s.waterCutPct, "%") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sums.length === 0 && <p className="meta center">該当する利用者はいません。</p>}
      </div>
      <StaffTabbar active="users" />
    </>
  );
}
