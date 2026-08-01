import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 「隠し扉」共通の解錠ヘルパー。
 * 暗証番号(env)が合致したら、SESSION_SECRET で署名した Cookie を発行し、以後その Cookie で判定する。
 * 使い所: かんたんログイン(fr_quick / QUICK_CODE) と 本部管理ページ(fr_hq / HQ_CODE)。
 */
function secret(): string {
  return process.env.SESSION_SECRET || "dev-only-secret-fight-ready";
}
function sign(name: string): string {
  return createHmac("sha256", secret()).update(`${name}:ok`).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 入力コードが env の期待値と一致するか（env 未設定なら常に false ＝ 事故防止で拒否）。 */
export function codeMatches(expected: string | undefined, given: string): boolean {
  return !!expected && safeEqual(expected, given);
}

export async function grantUnlock(cookieName: string, hours = 8): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName, `ok.${sign(cookieName)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: !!process.env.VERCEL || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * hours,
  });
}

export async function hasUnlock(cookieName: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(cookieName)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split(".");
  return payload === "ok" && !!sig && safeEqual(sign(cookieName), sig);
}

export async function clearUnlock(cookieName: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName);
}
