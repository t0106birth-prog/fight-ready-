"use server";

import { redirect } from "next/navigation";
import { codeMatches, grantUnlock, clearUnlock } from "@/lib/unlock";

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
