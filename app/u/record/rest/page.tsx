import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Hero, UserTabbar } from "@/components/Nav";
import { RestForm } from "@/components/RestForm";
import { getDb, today } from "@/lib/store";
import { isFightDay } from "@/lib/derive";

export default async function RestPage() {
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  if (isFightDay(db, user)) redirect("/u/record"); // 試合当日は記録オフ
  const defaults = db.restDayLogs.find((r) => r.userId === user.id && r.date === today());
  const trainedToday = db.activityLogs.some((a) => a.userId === user.id && a.date === today()) || db.runningLogs.some((r) => r.userId === user.id && r.date === today());
  return (
    <>
      <Hero title="オフ日・夜の回復チェック" backHref="/u/record" />
      <div className="shell">
        <div className="card tight">
          <p className="meta mt0">オフ日は正式な回復日として扱います。休養後に疲労・だるさ・痛みが改善したかを確認しましょう。</p>
        </div>
        <RestForm ownerId={user.id} defaults={defaults} trainedToday={trainedToday} />
      </div>
      <UserTabbar active="record" />
    </>
  );
}
