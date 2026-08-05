import Link from "next/link";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPasswordResetAction } from "./actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="shell">
      <Hero title="パスワードを再設定" sub="合言葉（秘密の質問）で本人確認します" backHref="/login/user" />

      {sp.state === "noquestion" && (
        <div className="alert-band alert-yellow">
          <div className="at">この方法では再設定できません</div>
          登録が見つからないか、<b>合言葉が未設定</b>です。合言葉は、ログイン後に「マイページ →🔒合言葉」から設定できます。
          所属ジムがある場合は、スタッフにパスワード再設定を依頼することもできます。
        </div>
      )}
      {sp.state === "input" && <div className="alert-band alert-red">メールアドレスを入力してください。</div>}

      <form action={requestPasswordResetAction} className="card">
        <label className="fl mt0" htmlFor="email">ご登録のメールアドレス</label>
        <input id="email" name="email" type="email" required autoComplete="username" placeholder="例: you@example.com" />
        <p className="info-note mt0">次の画面で「合言葉（秘密の質問）」の答えを入力すると、新しいパスワードを設定できます。メールは使いません。</p>
        <div style={{ height: 12 }} />
        <SubmitButton className="btn btn-accent" pendingLabel="確認しています…">次へ（合言葉で確認）</SubmitButton>
      </form>

      <p className="center small">
        <Link href="/login/user">← ログインにもどる</Link>
      </p>
    </div>
  );
}
