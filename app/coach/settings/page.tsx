import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, ownedPersonalWorkspaces } from "@/lib/coach";
import { coachBillableCount, monthlyAmountJpy } from "@/lib/billing";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** パーソナルコーチ設定（招待コード・お支払い）。お支払いは owner のみ。 */
export default async function CoachSettings() {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  const spaces = coachWorkspaces(db, user.id);
  if (spaces.length === 0) redirect("/u");
  const owned = ownedPersonalWorkspaces(db, user.id);
  const ws = owned[0] ?? spaces[0];
  const count = coachBillableCount(db, ws.id);

  return (
    <>
      <Hero title="コーチ設定" sub={ws.name} backHref="/coach" />
      <div className="shell">
        <p className="kicker">スペース</p>
        <div className="card">
          <div className="row"><b>{ws.name}</b><span className={`sig sig-${ws.status === "active" ? "green" : "yellow"}`}>{ws.status === "active" ? "有効" : "停止中"}</span></div>
        </div>

        <p className="kicker">顧客の招待</p>
        <div className="card">
          <p className="mt0 meta">この招待コードを顧客に伝えると、参加前に「スペース名・担当コーチ・共有範囲」を確認してから参加できます（招待フローは準備中）。</p>
          <div className="progress-row"><span className="meta">招待コード</span><b style={{ letterSpacing: ".08em" }}>{ws.inviteCode}</b></div>
        </div>

        {owned.length > 0 && (
          <>
            <p className="kicker">お支払い</p>
            <Link href="/coach/billing" className="card" style={{ display: "block", color: "var(--ink)", borderColor: "var(--blue)" }}>
              <div className="row"><b>お支払い</b><span className="meta">開く ›</span></div>
              <p className="small" style={{ margin: "5px 0 0", color: "var(--blue)" }}>担当 {count}名 × ¥500 ＝ {yen(monthlyAmountJpy(count))} / 月（目安）</p>
            </Link>
          </>
        )}

        <p className="info-note center" style={{ marginTop: 16 }}>
          <Link href="/coach">← コーチのトップへ</Link>
        </p>
      </div>
    </>
  );
}
