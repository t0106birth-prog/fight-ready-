import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Hero, UserTabbar } from "@/components/Nav";
import { TrainingForm } from "@/components/TrainingForm";
import { AddActivitySession } from "@/components/AddActivitySession";
import { ActivityEditForm } from "@/components/ActivityEditForm";
import { SubmitButton } from "@/components/SubmitButton";
import { OwnerField } from "@/components/OwnerField";
import { getDb, today } from "@/lib/store";
import { deleteActivityAction } from "@/app/u/actions";
import { isFightDay } from "@/lib/derive";
import { SWEAT } from "@/lib/constants";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ saved?: string; edit?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  if (isFightDay(db, user)) redirect("/u/record"); // 試合当日は記録オフ
  const restDefaults = db.restDayLogs.find((r) => r.userId === user.id && r.date === today());
  // 今日すでに記録した運動（2部練・3部練に対応：運動ごとに追加・編集・削除できる）
  const todaysActs = db.activityLogs
    .filter((a) => a.userId === user.id && a.date === today())
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const editing = sp.edit ? todaysActs.find((a) => a.id === sp.edit) : undefined;

  return (
    <>
      <Hero title="運動・休養の記録" sub="運動した日も、しなかった日も" backHref="/u/record" />
      <div className="shell">
        {sp.saved === "del" ? (
          <div className="alert-band alert-green"><b>✓</b> 運動を削除しました。</div>
        ) : sp.saved && (
          <div className="alert-band alert-green"><b>✓</b> 運動を保存しました。別の練習があれば、続けて追加できます。</div>
        )}

        {todaysActs.length > 0 && (
          <div className="card tight">
            <b>今日の運動（{todaysActs.length}部）</b>
            {todaysActs.map((a, i) => (
              <div key={a.id} className="edit-row" style={{ padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <div className="row" style={{ fontSize: 13 }}>
                  <span><b>{i + 1}部：{a.activityType}</b> — {a.durationMinutes}分{a.rpe ? ` / きつさ${a.rpe}` : ""}{a.sweatLevel ? ` / 汗${SWEAT[a.sweatLevel]}` : ""}</span>
                  <span style={{ display: "flex", gap: 6, flex: "none" }}>
                    <Link href={`/u/record/activity?edit=${a.id}`} className="btn-sm btn-ghost">編集</Link>
                    <form action={deleteActivityAction}>
                      <OwnerField id={user.id} />
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton className="btn-sm btn-dark" pendingLabel="…">削除</SubmitButton>
                    </form>
                  </span>
                </div>
              </div>
            ))}
            <p className="info-note mt0">1部だけでも完了です。2部・3部があれば下の「＋追加」から。各部は「編集／削除」できます。</p>
          </div>
        )}

        {editing ? (
          <ActivityEditForm act={editing} ownerId={user.id} />
        ) : todaysActs.length > 0 ? (
          // すでに1部以上ある：畳んだ「＋もう1部 追加」ボタンだけ出す（1部で完了できる感を出す）
          <AddActivitySession ownerId={user.id} isMember={user.role === "member"} nextIndex={todaysActs.length + 1} />
        ) : (
          // まだ0部：最初の1部（または休養日）をそのまま入力
          <TrainingForm ownerId={user.id} isMember={user.role === "member"} restDefaults={restDefaults} />
        )}
      </div>
      <UserTabbar active="record" />
    </>
  );
}
