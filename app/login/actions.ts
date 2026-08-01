"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, appendRow, uid, nowIso, history } from "@/lib/store";
import { setSession, clearSession, homePath } from "@/lib/auth";
import type { Role } from "@/lib/types";

async function doLogin(
  entry: "user" | "staff",
  formData: FormData
): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const remember = formData.get("remember") === "on";
  const db = await getDb();
  const backPath = entry === "staff" ? "/login/staff" : "/login/user";

  const user = db.users.find((u) => u.email === email && u.status === "active");
  // ログイン履歴に gymId を残す（該当メールのユーザーが居れば所属を記録）→ スタッフ設定で自ジムだけ表示できる
  const fail = (msg: string) => {
    void appendRow("logins", { id: uid(), email, result: "fail", gymId: user?.gymId, createdAt: nowIso() });
    redirect(`${backPath}?${new URLSearchParams({ e: msg, email })}`);
  };

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    fail("メールアドレスまたはパスワードが正しくありません");
    return;
  }
  const isStaff = user!.role === "staff";
  if (entry === "staff" && !isStaff) fail("このアカウントは選手・一般会員用の入口からログインしてください");
  if (entry === "user" && isStaff) fail("このアカウントはジムスタッフ用の入口からログインしてください");

  await appendRow("logins", { id: uid(), email, result: "success", gymId: user!.gymId, createdAt: nowIso() });
  await history(user!.gymId, user!.id, "login");
  await setSession({ userId: user!.id, gymId: user!.gymId, role: user!.role as Role }, remember);
  redirect(homePath(user!.role));
}

export async function loginAction(formData: FormData): Promise<void> {
  await doLogin("user", formData);
}
export async function staffLoginAction(formData: FormData): Promise<void> {
  await doLogin("staff", formData);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

/**
 * かんたんログイン（お試し用）。**パスワード不要**なので厳重にゲートする:
 * 1) 本番/Vercel では ALLOW_QUICK_LOGIN=1 のときだけ（開発は既定で許可）
 * 2) 固定の許可アカウントのみ（任意のメールでの無認証ログインを塞ぐ）
 * UI を隠しても Server Action へ直接POSTできるため、サーバー側でも必ず検証する。
 */
const QUICK_LOGIN_EMAILS = new Set([
  "staff@fightbase.jp",
  "takeru@example.com",
  "kaito@example.com",
  "misaki@example.com",
]);
function quickLoginEnabled(): boolean {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return process.env.ALLOW_QUICK_LOGIN === "1";
  }
  return true;
}
export async function quickLoginAction(formData: FormData): Promise<void> {
  if (!quickLoginEnabled()) redirect("/");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!QUICK_LOGIN_EMAILS.has(email)) redirect("/");
  const db = await getDb();
  const user = db.users.find((u) => u.email === email && u.status === "active");
  if (!user) redirect("/");
  await setSession({ userId: user!.id, gymId: user!.gymId, role: user!.role }, false);
  redirect(homePath(user!.role));
}
