import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, coachClients, ownedPersonalWorkspaces } from "@/lib/coach";
import { monthlyAmountJpy } from "@/lib/billing";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/**
 * パーソナルコーチ ダッシュボード（Phase 1・隠し）。
 * 公開リンクは張っていない。active な coach/owner Membership を持つ人だけが URL で入れる。
 * それ以外は /u へ戻す（通常ユーザーには存在しないのと同じ）。
 */
export default async function CoachHome() {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  const spaces = coachWorkspaces(db, user.id);
  if (spaces.length === 0) redirect("/u"); // コーチ権限なし → 隠す

  const clients = coachClients(db, user.id);
  const isOwner = ownedPersonalWorkspaces(db, user.id).length > 0;

  return (
    <>
      <Hero title="パーソナルコーチ" sub="COACH MODE" backHref="/u" />
      <div className="shell">
        <div className="alert-band alert-blue" style={{ margin: "0 0 10px" }}>
          <b>パーソナルコーチモードで利用中</b> — あなた自身の記録は「選手・会員モード」（← もどる）で確認できます。
        </div>

        {spaces.map((ws) => (
          <div key={ws.id} className="card">
            <div className="row"><b>{ws.name}</b><span className="meta">パーソナルスペース</span></div>
            <div className="progress-row"><span>担当顧客</span><b>{clients.filter(() => true).length}<span className="unit">名</span></b></div>
          </div>
        ))}

        <p className="kicker">担当顧客</p>
        <Link href="/coach/clients" className="entry-btn red">
          <span className="t">担当顧客を見る（{clients.length}名）</span><br />
          <span className="d">共有を許可された記録だけを確認できます</span>
        </Link>

        {/* お支払い（¥500 × 担当顧客数）。owner だけに出す。画面本体は設定内の /coach/billing。 */}
        {isOwner && (
          <>
            <p className="kicker">お支払い</p>
            <Link href="/coach/billing" className="card" style={{ display: "block", color: "var(--ink)", borderColor: "var(--blue)" }}>
              <div className="row"><b>お支払い</b><span className="meta">開く ›</span></div>
              <p className="small" style={{ margin: "5px 0 0", color: "var(--blue)" }}>担当 {clients.length}名 × ¥500 ＝ {yen(monthlyAmountJpy(clients.length))} / 月（目安）</p>
            </Link>
          </>
        )}

        <p className="kicker">設定</p>
        <Link href="/coach/settings" className="todo-item">
          <span className="tk" style={{ fontSize: 18 }}>⚙️</span>
          <span className="tt">コーチ設定<br /><span className="meta" style={{ fontWeight: 400 }}>招待コード・お支払い</span></span>
          <span className="ta">›</span>
        </Link>

        <p className="info-note center" style={{ marginTop: 16 }}>
          <Link href="/u">← 選手・会員モードに戻る</Link>
        </p>
      </div>
    </>
  );
}
