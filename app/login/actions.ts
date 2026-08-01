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
 * かんたんログイン（お試し用）。隠し扉（「アプリのように使う」を2回タップ）で表示され、
 * 暗証番号なしでそのままデモ用アカウントに入れる。無認証ログインを架空の固定アカウントに限定するため許可リストで縛る。
 */
const QUICK_LOGIN_EMAILS = new Set([
  "staff@fightbase.jp",
  "takeru@example.com",
  "kaito@example.com",
  "misaki@example.com",
]);

export async function quickLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!QUICK_LOGIN_EMAILS.has(email)) redirect("/");
  const db = await getDb();
  const user = db.users.find((u) => u.email === email && u.status === "active");
  if (!user) redirect("/");
  await setSession({ userId: user!.id, gymId: user!.gymId, role: user!.role }, false);
  redirect(homePath(user!.role));
}
