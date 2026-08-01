import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Hero, UserTabbar } from "@/components/Nav";
import { NutritionForm } from "@/components/NutritionForm";
import { getDb, today } from "@/lib/store";
import { isFightDay } from "@/lib/derive";

export default async function NutritionPage() {
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  if (isFightDay(db, user)) redirect("/u/record"); // 試合当日は記録オフ
  const defaults = db.nutritionLogs.find((n) => n.userId === user.id && n.date === today());
  // 「できた/できてない」の対象になる、本人の食事目標（マイページ設定＞キャンプ設定）
  const camp = db.camps.find((c) => c.userId === user.id && c.status === "active");
  const goalText = user.foodGoal || camp?.nutritionGoal || undefined;
  return (
    <>
      <Hero title="食事達成度" backHref="/u/record" />
      <div className="shell"><NutritionForm ownerId={user.id} defaults={defaults} goalText={goalText} /></div>
      <UserTabbar active="record" />
    </>
  );
}
