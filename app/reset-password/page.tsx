import Link from "next/link";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/Notice";
import { verifyResetToken } from "@/lib/auth";
import { doResetPasswordAction } from "./actions";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string; e?: string }> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const user = token ? await verifyResetToken(token) : null;

  return (
    <div className="shell">
      <Hero title="新しいパスワードを設定" backHref="/login/user" />

      {!user ? (
        <>
          <div className="alert-band alert-red">
            <div className="at">リンクが無効か、期限切れです</div>
            再設定リンクは60分で失効します（また、一度使うと無効になります）。お手数ですが、もう一度やり直してください。
          </div>
          <p className="center small"><Link href="/forgot-password">パスワードを再設定する</Link></p>
        </>
      ) : (
        <>
          {sp.e === "short" && <Notice>パスワードは6文字以上にしてください。</Notice>}
          {sp.e === "mismatch" && <Notice>確認用のパスワードが一致しません。</Notice>}
          <form action={doResetPasswordAction} className="card">
            <input type="hidden" name="token" value={token} />
            <p className="meta mt0"><b>{user.email}</b> のパスワードを再設定します。</p>
            <label className="fl" htmlFor="password">新しいパスワード（6文字以上）</label>
            <input id="password" name="password" type="password" required autoComplete="new-password" />
            <label className="fl" htmlFor="password2">新しいパスワード（確認）</label>
            <input id="password2" name="password2" type="password" required autoComplete="new-password" />
            <div style={{ height: 12 }} />
            <SubmitButton className="btn btn-accent" pendingLabel="変更しています…">パスワードを変更する</SubmitButton>
          </form>
        </>
      )}
    </div>
  );
}
