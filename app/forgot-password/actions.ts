"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb, history } from "@/lib/store";
import { makeResetToken } from "@/lib/auth";
import { emailConfigured, sendPasswordResetEmail } from "@/lib/email";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3201";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * 本人セルフのパスワード再設定リクエスト。
 * ・メール未設定なら「スタッフに連絡」へ誘導（B: 非常口）。
 * ・メール設定済みなら、登録の有無に関わらず同じ完了表示（メールアドレス列挙対策）。
 */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?state=input");

  // メール送信が未設定なら、セルフ発行はできないのでスタッフ経由へ案内する
  if (!emailConfigured()) redirect("/forgot-password?state=unconfigured");

  const db = await getDb();
  const user = db.users.find((u) => u.email === email && u.status === "active");
  if (user) {
    const link = `${await baseUrl()}/reset-password?token=${encodeURIComponent(makeResetToken(user))}`;
    await sendPasswordResetEmail(user.email, link);
    await history(user.gymId, user.id, "password_reset_requested");
  }
  // 登録がない場合も同じ完了表示にする（存在有無を漏らさない）
  redirect("/forgot-password?state=sent");
}
