import Link from "next/link";
import { hasUnlock } from "@/lib/unlock";
import { hqVerifyAction, hqLogoutAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 本部（HQ）管理ページ。今は「暗証番号のログイン画面」だけ。
 * 正しい番号を入れると解錠され、中身（全体ダッシュボード等）はここに後から足す。
 */
export default async function HqPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const unlocked = await hasUnlock("fr_hq");

  return (
    <div className="shell">
      <div className="brand-hero">
        <div className="brand-logo">FIGHT <span className="r">READY</span></div>
        <div className="brand-tag">本部管理（HQ）</div>
      </div>

      {unlocked ? (
        <>
          <div className="alert-band alert-green" style={{ marginTop: 12 }}><b>🔓 解錠しました</b> — 本部管理ページ</div>
          <div className="card">
            <p className="mt0"><b>本部管理ページ（準備中）</b></p>
            <p className="meta mt0">ここに全ジム一覧・利用者数・ログイン履歴などの本部ダッシュボードを後から追加します。今は入口だけです。</p>
          </div>
          <form action={hqLogoutAction}>
            <SubmitButton className="btn btn-dark" pendingLabel="…">本部からログアウト</SubmitButton>
          </form>
          <p className="center small" style={{ marginTop: 10 }}><Link href="/">← トップへ</Link></p>
        </>
      ) : (
        <>
          {sp.e && <div className="alert-band alert-red" style={{ marginTop: 12 }}>暗証番号が違います。</div>}
          <form action={hqVerifyAction} className="card" style={{ marginTop: 12 }}>
            <label className="fl mt0" htmlFor="code">暗証番号</label>
            <input id="code" name="code" type="password" inputMode="numeric" autoComplete="off" autoFocus placeholder="番号を入力" />
            <div style={{ height: 10 }} />
            <SubmitButton className="btn btn-accent" pendingLabel="確認中…">本部に入る</SubmitButton>
          </form>
          <p className="center small" style={{ marginTop: 10 }}><Link href="/">← トップへ戻る</Link></p>
        </>
      )}
    </div>
  );
}
