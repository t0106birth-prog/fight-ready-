import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePath } from "@/lib/auth";
import { EntrySwitch } from "@/components/EntrySwitch";
import { BrandHero } from "@/components/BrandHero";
import { AppUsageDoor } from "@/components/AppUsageDoor";

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
      {/* ロゴ2回タップで本部管理(HQ)へ */}
      <BrandHero />

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

      {/* 隠し扉②：見出し先頭の小さなアプリ風アイコンを押すと、かんたんログインが出る */}
      <AppUsageDoor accounts={QUICK} />

      <p className="info-note center" style={{ marginTop: 20 }}>
        <Link href="/lp">サービス紹介ページ</Link>
      </p>
    </div>
  );
}
