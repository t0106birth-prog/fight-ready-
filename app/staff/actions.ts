"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { currentUser, canView } from "@/lib/auth";
import { mutateDb, appendRow, uid, nowIso, history } from "@/lib/store";

/**
 * スタッフが所属ジムの選手・一般会員のパスワードを再設定する（メール不要）。
 * 他ジム・スタッフ自身には効かない。再設定した仮パスワードは本人に口頭等で伝える運用。
 */
export async function resetUserPasswordAction(formData: FormData): Promise<void> {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/");
  const userId = String(formData.get("userId") || "");
  const pw = String(formData.get("password") || "");
  if (!(await canView(staff!, userId))) redirect("/staff");
  if (pw.length < 6) redirect(`/staff/user/${userId}?pw=short`);
  let done = false;
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === userId && x.gymId === staff!.gymId && (x.role === "pro" || x.role === "member"));
    if (u) { u.passwordHash = bcrypt.hashSync(pw, 8); done = true; }
  });
  // 会員/選手が見つからなければ、成功表示も監査ログも残さない（偽の成功を防ぐ）
  if (!done) redirect(`/staff/user/${userId}?pw=notfound`);
  await history(staff!.gymId, staff!.id, "reset_password", userId);
  redirect(`/staff/user/${userId}?pw=ok`);
}

/** ジムの基本情報を編集（設定から手動で登録） */
export async function updateGymAction(formData: FormData): Promise<void> {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/");
  const s = (k: string) => String(formData.get(k) || "").trim();
  const name = s("name");
  if (!name) redirect("/staff/settings?e=name");
  await mutateDb((d) => {
    const gym = d.gyms.find((g) => g.id === staff!.gymId);
    if (!gym) return;
    gym.name = name;
    gym.address = s("address") || undefined;
    gym.phone = s("phone") || undefined;
    gym.note = s("note") || undefined;
  });
  await history(staff!.gymId, staff!.id, "update_gym");
  redirect("/staff/settings?saved=gym");
}

/**
 * 利用区分の切替（スタッフ側）。基準は「試合に出るか」。試合に出るのを把握しているのはジム側なことも多いので、
 * スタッフからも選手↔一般を切り替えられる。一般に戻すときは試合予定を消す。過去の記録は残す。
 */
export async function setUserRoleAction(formData: FormData): Promise<void> {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");
  if (role !== "pro" && role !== "member") redirect(`/staff/user/${userId}`);
  if (!(await canView(staff!, userId))) redirect("/staff");
  await mutateDb((d) => {
    const user = d.users.find((x) => x.id === userId && x.gymId === staff!.gymId);
    if (!user || user.role === "staff") return;
    user.role = role;
    user.userType = role;
    if (role === "pro") {
      if (!user.primarySport && user.sports?.length) user.primarySport = user.sports[0];
      if (user.promotion == null) user.promotion = "none";
      if (user.usesHydration == null) user.usesHydration = true;
    } else {
      user.weighInAt = undefined;
      user.fightAt = undefined;
      user.targetDate = undefined; // 計量日が「目標日」に化けないよう消す
      d.waterCutPeriods.forEach((p) => { if (p.userId === user.id && p.status !== "done") p.status = "done"; });
    }
  });
  await history(staff!.gymId, staff!.id, "set_role", `${userId}:${role}`);
  redirect(`/staff/user/${userId}?role=${role}`);
}

/**
 * 「確認した足跡」：スタッフが利用者の記録を確認したことを残す。
 * チャットは作らない(§5)。history に staff_ack として記録し、選手側に「◯月◯日 確認」と出す。
 */
export async function ackUserAction(formData: FormData): Promise<void> {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/");
  const userId = String(formData.get("userId") || "");
  if (!(await canView(staff!, userId))) redirect("/staff");
  await appendRow("history", {
    id: uid(), gymId: staff!.gymId, actorId: staff!.id,
    action: "staff_ack", resource: userId, createdAt: nowIso(),
  });
  redirect(`/staff/user/${userId}?acked=1`);
}
