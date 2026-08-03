import Link from "next/link";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/Notice";
import { loginAction } from "../actions";

export default async function UserLogin({ searchParams }: { searchParams: Promise<{ e?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="shell">
      <Hero title="選手・一般会員 ログイン" sub="体重・運動・疲労・回復を記録する" backHref="/" />
      {sp.e && <Notice>{sp.e}</Notice>}
      <form action={loginAction} className="card">
        <label className="fl" htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={sp.email ?? ""} />
        <label className="fl" htmlFor="password">パスワード</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <label className="check">
          <input type="checkbox" name="remember" defaultChecked />
          この端末でログインしたままにする
        </label>
        <div style={{ height: 12 }} />
        <SubmitButton className="btn btn-accent" pendingLabel="ログインしています…">ログイン</SubmitButton>
      </form>
      <p className="info-note">共用の端末では、上のチェックを外してください。</p>
      <p className="info-note mt0">パスワードを忘れたときは、所属ジムのスタッフに連絡すると再設定してもらえます。</p>
      <p className="center small">
        <Link href="/register">はじめての方（新規登録）</Link><br />
        <Link href="/login/staff">ジムスタッフの方はこちら</Link><br />
        <Link href="/">← 入口にもどる</Link>
      </p>
    </div>
  );
}
