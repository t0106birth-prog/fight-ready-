"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { verifyResetToken } from "@/lib/auth";
import { mutateDb, history } from "@/lib/store";

export async function doResetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") || "");
  const pw = String(formData.get("password") || "");
  const pw2 = String(formData.get("password2") || "");

  const user = await verifyResetToken(token);
  if (!user) redirect("/reset-password?e=invalid");
  const t = encodeURIComponent(token);
  if (pw.length < 6) redirect(`/reset-password?token=${t}&e=short`);
  if (pw !== pw2) redirect(`/reset-password?token=${t}&e=mismatch`);

  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === user!.id);
    if (u) u.passwordHash = bcrypt.hashSync(pw, 8);
  });
  await history(user!.gymId, user!.id, "password_reset_done");
  // 再設定後は必ずログインし直す（旧リンクも passwordHash 変更で自動失効）
  redirect(user!.role === "staff" ? "/login/staff?reset=done" : "/login/user?reset=done");
}
