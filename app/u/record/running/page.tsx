import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Hero, UserTabbar } from "@/components/Nav";
import { RunningForm } from "@/components/RunningForm";
import { getDb } from "@/lib/store";
import { isFightDay } from "@/lib/derive";

export default async function RunningPage() {
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  if (isFightDay(await getDb(), user)) redirect("/u/record"); // 試合当日は記録オフ
  return (
    <>
      <Hero title="ランニング記録" backHref="/u/record" />
      <div className="shell"><RunningForm ownerId={user.id} /></div>
      <UserTabbar active="record" />
    </>
  );
}
