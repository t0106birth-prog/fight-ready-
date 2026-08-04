import Link from "next/link";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPasswordResetAction } from "./actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="shell">
      <Hero title="パスワードを再設定" sub="ご登録のメールに再設定リンクを送ります" backHref="/login/user" />

      {sp.state === "sent" && (
        <div className="alert-band alert-green">
          <div className="at">✓ 送信しました</div>
          ご登録があれば、再設定用のリンクをメールでお送りしました（60分以内に有効）。メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </div>
      )}
      {sp.state === "unconfigured" && (
        <div className="alert-band alert-yellow">
          <div className="at">メール再設定は準備中です</div>
          現在メールでの自動再設定が使えません。お手数ですが、<b>所属ジムのスタッフ</b>にご連絡ください。スタッフがパスワードを再設定できます。
        </div>
      )}
      {sp.state === "input" && (
        <div className="alert-band alert-red">メールアドレスを入力してください。</div>
      )}

      <form action={requestPasswordResetAction} className="card">
        <label className="fl mt0" htmlFor="email">ご登録のメールアドレス</label>
        <input id="email" name="email" type="email" required autoComplete="username" placeholder="例: you@example.com" />
        <div style={{ height: 12 }} />
        <SubmitButton className="btn btn-accent" pendingLabel="送信しています…">再設定リンクを送る</SubmitButton>
      </form>

      <p className="info-note">セキュリティのため、リンクは60分で失効し、一度使うと無効になります。</p>
      <p className="center small">
        <Link href="/login/user">← ログインにもどる</Link>
      </p>
    </div>
  );
}
