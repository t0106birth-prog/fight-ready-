import Link from "next/link";
import { Hero } from "@/components/Nav";
import { Notice } from "@/components/Notice";
import { RegisterForm } from "@/components/RegisterForm";
import { getDb } from "@/lib/store";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ e?: string; gym?: string }> }) {
  const sp = await searchParams;
  const db = await getDb();
  // QR/招待リンクの ?gym=CODE でジムを事前に紐付ける
  const presetGym = sp.gym
    ? db.gyms.find((g) => g.code.toUpperCase() === sp.gym!.toUpperCase() && !g.suspended) ?? null
    : null;
  return (
    <div className="shell">
      <Hero title="はじめて登録する" sub={presetGym ? `${presetGym.name} に参加` : "選手・一般会員を選んで作成"} backHref="/" />
      {sp.e && <Notice>{sp.e}</Notice>}
      {sp.gym && !presetGym && <Notice>チームコード「{sp.gym}」が見つかりませんでした。下でコードを入力してください。</Notice>}
      <RegisterForm gyms={db.gyms.filter((g) => !g.suspended)} presetGym={presetGym} />
      <p className="center small"><Link href="/login/user">← ログインにもどる</Link></p>
    </div>
  );
}
