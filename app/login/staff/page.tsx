import Link from "next/link";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/Notice";
import { staffLoginAction } from "../actions";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ e?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="shell">
      <Hero title="ジムスタッフ ログイン" sub="選手と一般会員の状態を確認する" backHref="/" />
      {sp.e && <Notice>{sp.e}</Notice>}
      <form action={staffLoginAction} className="card">
        <label className="fl" htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={sp.email ?? ""} />
        <label className="fl" htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <label className="check">
          <input type="checkbox" name="remember" defaultChecked />
          この端末でログインしたままにする
        </label>
        <div style={{ height: 12 }} />
        <SubmitButton className="btn btn-primary" pendingLabel="ログインしています…">ログイン</SubmitButton>
      </form>
      <p className="info-note">ジムスタッフは、所属ジムのすべての利用者を確認・管理できます。</p>
      <p className="info-note mt0">パスワードを忘れたときは、管理者（本部）にご連絡ください。</p>
      <p className="center small">
        <Link href="/login/user">選手・一般会員の方はこちら</Link><br />
        <Link href="/">← 入口にもどる</Link>
      </p>
    </div>
  );
}
