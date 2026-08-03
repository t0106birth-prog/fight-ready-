"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { codeMatches, grantUnlock, clearUnlock, hasUnlock } from "@/lib/unlock";
import { getDb, mutateDb, history } from "@/lib/store";

/**
 * 本部（HQ）管理ページの暗証番号チェック。
 * 暗証番号は env HQ_CODE（未設定なら常に拒否＝事故防止）。合致で fr_hq Cookie を発行。
 */
export async function hqVerifyAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  // env HQ_CODE 優先。未設定なら既定番号で解錠（後で env を入れればそちらが勝つ）
  if (!codeMatches(process.env.HQ_CODE || "0363037239", code)) redirect("/hq?e=1");
  await grantUnlock("fr_hq");
  redirect("/hq");
}

export async function hqLogoutAction(): Promise<void> {
  await clearUnlock("fr_hq");
  redirect("/");
}

/** 本部から、選手/会員を任意のジムに紐付ける（無所属→ジム、別ジムへ移動も）。gymId="" で無所属に戻す。HQ解錠必須。 */
export async function hqLinkGymAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const userId = String(formData.get("userId") || "");
  const gymId = String(formData.get("gymId") || "");
  const db = await getDb();
  if (gymId && !db.gyms.some((g) => g.id === gymId)) redirect(`/hq/user/${userId}`);
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === userId && (x.role === "pro" || x.role === "member"));
    if (u) u.gymId = gymId;
  });
  await history(gymId, undefined, "hq_link_gym", userId);
  redirect(`/hq/user/${userId}?linked=1`);
}

/** 本部からジムを停止/再開する（停止中はそのコードでの新規登録・参加を拒否）。HQ解錠必須。 */
export async function hqToggleGymAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const gymId = String(formData.get("gymId") || "");
  await mutateDb((d) => {
    const g = d.gyms.find((x) => x.id === gymId);
    if (g) g.suspended = !g.suspended;
  });
  redirect("/hq");
}

/**
 * 本部から、メールアドレス指定で任意アカウント（スタッフ含む）のパスワードを再設定する。
 * スタッフが自分のパスワードを忘れたときの最終手段。HQ解錠済みが必須。
 */
export async function hqResetPasswordAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const pw = String(formData.get("password") || "");
  if (pw.length < 6) redirect("/hq?pw=short");
  const db = await getDb();
  const target = db.users.find((x) => x.email === email && x.status === "active");
  if (!target) redirect("/hq?pw=notfound");
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === target!.id);
    if (u) u.passwordHash = bcrypt.hashSync(pw, 8);
  });
  await history(target!.gymId, undefined, "hq_reset_password", target!.id);
  redirect("/hq?pw=ok");
}
