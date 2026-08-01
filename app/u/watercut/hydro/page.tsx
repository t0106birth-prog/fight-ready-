import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { HydrationForm } from "@/components/HydrationForm";
import { latestWaterCutLog, activeWaterCut } from "@/lib/derive";

export default async function HydroPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role !== "pro") redirect("/u");
  const db = await getDb();
  const period = activeWaterCut(db, user.id);
  if (!period) redirect("/u/watercut");
  const log = latestWaterCutLog(db, user.id, period.id);
  const w = log?.currentWeight ?? period?.baselineWeight;
  return (
    <>
      <Hero title="HYDRO チェック" sub="水分状態の記録" backHref="/u/watercut" />
      <div className="shell">
        {sp.error === "usg" && <div className="alert-band alert-red">尿比重は1.0000〜1.0500の範囲で入力してください。</div>}
        {sp.error === "weight" && <div className="alert-band alert-red">同時測定体重を20〜300kgの範囲で入力してください。</div>}
        <div className="card">
          <b>この画面でやること</b>
          <p className="info-note mt0" style={{ fontSize: 13 }}>
            {user.promotion === "one"
              ? "① 尿を採る → ② 屈折計で尿比重を測る → ③ 数値を入力 → ④ 直後に体重を測る → ⑤ 体重を入力"
              : "① 尿の色を選ぶ → ② 気になる症状があれば選ぶ → ③ 屈折計で測っていれば尿比重も入力（任意）"}
          </p>
          <p className="info-note" style={{ marginBottom: 0 }}>
            <b>すべて任意です。</b>測っていない項目は空欄のままで保存できます。
            尿比重だけで全身の水分状態は確定しません。参考基準内でも安全を保証しません。未測定でも、症状や急激な体重減少があれば警告します。
          </p>
        </div>
        <HydrationForm ownerId={user.id} isOne={user.promotion === "one"} defaultWeight={w} />
      </div>
      <UserTabbar active="record" />
    </>
  );
}
