import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePath } from "@/lib/auth";
import { EntrySwitch } from "@/components/EntrySwitch";
import { quickLoginAction } from "./login/actions";

const QUICK_LOGIN = !process.env.VERCEL && process.env.NEXT_PUBLIC_QUICK_LOGIN !== "false";
const QUICK = [
  { email: "staff@fightbase.jp", label: "ジムスタッフとして入る", desc: "全利用者の状態を確認", ico: "🧑‍🏫" },
  { email: "takeru@example.com", label: "選手として入る（緑）", desc: "山田タケル／計量まで21日", ico: "🥊" },
  { email: "kaito@example.com", label: "選手として入る（赤・水抜き）", desc: "高橋カイト／ONE・計量18時間前", ico: "🚨" },
  { email: "misaki@example.com", label: "一般会員として入る", desc: "田中美咲／ボディメイクキャンプ", ico: "💪" },
];

export default async function EntryPage() {
  const s = await getSession();
  if (s) redirect(homePath(s.role));
  return (
    <div className="shell">
      <div className="brand-hero">
        <div className="brand-logo">FIGHT <span className="r">READY</span></div>
        <div className="brand-tag">落とすだけでは、勝てない。</div>
        <div className="brand-sub" style={{ color: "var(--ink)", fontWeight: 800, fontSize: 17, marginTop: 10 }}>
          一人で戦わない。<span style={{ color: "var(--red-bright)" }}>チームで、仕上げる。</span>
        </div>
        <div className="brand-sub">体重・トレーニング・疲労・回復を、チームでひとつに。</div>
        <div className="brand-en">MAKE WEIGHT. STAY STRONG. FIGHT READY.</div>
      </div>

      <EntrySwitch
        login={
          <>
            <Link href="/login/user" className="entry-btn red">
              <span className="t">選手・一般会員</span><br />
              <span className="d">体重・運動・疲労・回復を記録して、チームと分け合う</span>
            </Link>
            <Link href="/login/staff" className="entry-btn blue">
              <span className="t">ジムスタッフ</span><br />
              <span className="d">選手と一般会員を、チームで見守り・支える</span>
            </Link>
          </>
        }
        signup={
          <>
            <Link href="/register" className="entry-btn red">
              <span className="t">選手・一般会員として登録</span><br />
              <span className="d">ジムのコード / QR で参加する</span>
            </Link>
            <Link href="/register-gym" className="entry-btn blue">
              <span className="t">ジムを新しく作る</span><br />
              <span className="d">チームコードが自動で発行され、選手・会員を招待できます</span>
            </Link>
          </>
        }
      />

      {QUICK_LOGIN && (
        <div className="quick-panel">
          <div className="row" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>かんたんログイン（お試し用）</b>
            <span className="badge badge-attn">試作版</span>
          </div>
          <p className="info-note" style={{ marginTop: 0 }}>パスワードなしでサンプル画面を確認できます（データはすべて架空）。</p>
          {QUICK.map((a) => (
            <form action={quickLoginAction} key={a.email}>
              <input type="hidden" name="email" value={a.email} />
              <button type="submit" className="quick-btn">
                <span className="q-ico">{a.ico}</span>
                <span><span className="q-t">{a.label}</span><span className="q-d">{a.desc}</span></span>
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="kicker">アプリのように使う</p>
      <div className="card">
        <p className="small mt0">ホーム画面に追加すると、次からアプリのように全画面で開けます。</p>
        <p className="small" style={{ marginBottom: 4 }}><b>iPhone</b>（Safari）: 共有ボタン → 「ホーム画面に追加」</p>
        <p className="small" style={{ marginBottom: 0 }}><b>Android</b>（Chrome）: ⋮メニュー → 「インストール」</p>
      </div>

      <p className="info-note center" style={{ marginTop: 20 }}>
        <Link href="/lp">サービス紹介ページ</Link>
      </p>
    </div>
  );
}
