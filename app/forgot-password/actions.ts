"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/store";
import { makeResetToken } from "@/lib/auth";

/**
 * 本人セルフのパスワード再設定（合言葉方式・メール不要）。
 * ・メール入力 → 合言葉が設定済みの人だけ、質問→答えの画面へ進める。
 * ・登録が無い／合言葉が未設定なら、同じ案内（存在有無を強く漏らさない）。
 */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?state=input");

  const db = await getDb();
  const user = db.users.find((u) => u.email === email && u.status === "active");
  if (user && user.recoveryQuestion && user.recoveryAnswerHash) {
    // トークンで userId を次画面へ渡す（本人確認の関門は「答え」）
    redirect(`/reset-password?token=${encodeURIComponent(makeResetToken(user))}`);
  }
  redirect("/forgot-password?state=noquestion");
}
