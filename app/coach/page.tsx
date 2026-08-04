import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, coachClients } from "@/lib/coach";

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

        {/* お支払い（¥500 × 担当顧客数）は Phase 4 で実装予定。今は入口だけ・準備中表示。 */}
        <p className="kicker">お支払い</p>
        <div className="card tight" style={{ opacity: 0.65 }}>
          <div className="row">
            <b>お支払い（担当 {clients.length}名 × ¥500）</b>
            <span className="badge badge-attn">準備中</span>
          </div>
          <p className="info-note mt0">月額の決済（Stripe）は準備中です。金額は担当顧客数に応じて自動計算されます。</p>
        </div>

        <p className="info-note center" style={{ marginTop: 16 }}>
          <Link href="/u">← 選手・会員モードに戻る</Link>
        </p>
      </div>
    </>
  );
}
