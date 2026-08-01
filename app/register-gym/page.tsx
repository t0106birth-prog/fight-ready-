import Link from "next/link";
import { Hero } from "@/components/Nav";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { registerGymAction } from "./actions";

export default async function RegisterGymPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="shell">
      <Hero title="ジムを新しく作る" sub="チームコードは自動で発行されます" backHref="/" />
      {sp.e && <Notice>{sp.e}</Notice>}
      <form action={registerGymAction} className="card">
        <label className="fl mt0" htmlFor="gymName">ジム名</label>
        <input id="gymName" name="gymName" type="text" required placeholder="例: FIGHT BASE Tokyo" />

        <label className="fl" htmlFor="email">ジムスタッフのメールアドレス</label>
        <input id="email" name="email" type="email" required autoComplete="email" />

        <label className="fl" htmlFor="password">パスワード（6文字以上）</label>
        <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />

        <p className="info-note">
          作成すると、この ジム専用のコード（＋QR）が自動で発行されます。それを選手・会員に配ると、各自が登録して自動でこのジムに紐付きます。
        </p>
        <div style={{ height: 12 }} />
        <SubmitButton className="btn btn-primary" pendingLabel="作成しています…">ジムを作成する</SubmitButton>
      </form>
      <p className="center small">
        <Link href="/login/staff">← すでにジムがある方（スタッフログイン）</Link>
      </p>
    </div>
  );
}
