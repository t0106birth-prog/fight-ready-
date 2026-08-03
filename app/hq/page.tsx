import Link from "next/link";
import { hasUnlock } from "@/lib/unlock";
import { hqVerifyAction, hqLogoutAction, hqResetPasswordAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 本部（HQ）管理ページ。今は「暗証番号のログイン画面」だけ。
 * 正しい番号を入れると解錠され、中身（全体ダッシュボード等）はここに後から足す。
 */
export default async function HqPage({ searchParams }: { searchParams: Promise<{ e?: string; pw?: string }> }) {
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
          {/* パスワード再設定（スタッフ含む誰でも。メール不要） */}
          <div className="card">
            <b>🔑 パスワード再設定（メール指定）</b>
            {sp.pw === "ok" && <div className="sig sig-green" style={{ marginTop: 4 }}>再設定しました。新しいパスワードを本人に伝えてください。</div>}
            {sp.pw === "short" && <div className="field-error" style={{ marginTop: 4 }}>パスワードは6文字以上にしてください。</div>}
            {sp.pw === "notfound" && <div className="field-error" style={{ marginTop: 4 }}>そのメールのアカウントが見つかりません。</div>}
            <form action={hqResetPasswordAction} style={{ marginTop: 6 }}>
              <label className="fl mt0" htmlFor="pwemail">アカウントのメールアドレス</label>
              <input id="pwemail" name="email" type="email" autoComplete="off" placeholder="例: staff@example.com" required />
              <label className="fl" htmlFor="pwnew">新しい仮パスワード（6文字以上）</label>
              <input id="pwnew" name="password" type="text" autoComplete="off" minLength={6} required />
              <div style={{ height: 8 }} />
              <SubmitButton className="btn btn-accent" pendingLabel="再設定中…">このアカウントのパスワードを再設定</SubmitButton>
            </form>
            <p className="info-note mt0">スタッフが自分のパスワードを忘れたときの最終手段。ここは全ジムのアカウントに効きます。</p>
          </div>

          <div className="card tight">
            <p className="meta mt0">全ジム一覧・利用者数・ログイン履歴などの本部ダッシュボードは今後ここに追加します。</p>
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
