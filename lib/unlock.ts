import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 「隠し扉」共通の解錠ヘルパー。
 * 暗証番号(env)が合致したら、SESSION_SECRET で署名した"有効期限入り"Cookie を発行し、以後その Cookie で判定する。
 * 使い所: 本部管理ページ(fr_hq / HQ_CODE)。
 */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // 本番で未設定なら例外（auth.ts と挙動を揃える。dev固定値での署名Cookie偽造を防ぐ）
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET が設定されていません（本番では必須）");
  }
  return "dev-only-secret-fight-ready";
}
function sign(material: string): string {
  return createHmac("sha256", secret()).update(material).digest("base64url");
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
  const exp = String(Date.now() + hours * 60 * 60 * 1000); // 有効期限(ms)を署名に含める＝改ざん・延長不可
  const jar = await cookies();
  jar.set(cookieName, `${exp}.${sign(`${cookieName}:${exp}`)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: !!process.env.VERCEL || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: hours * 60 * 60,
  });
}

export async function hasUnlock(cookieName: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(cookieName)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !safeEqual(sign(`${cookieName}:${exp}`), sig)) return false;
  const ms = Number(exp);
  return Number.isFinite(ms) && Date.now() < ms; // サーバー側で期限切れを拒否（漏れたCookieの永続再利用を防ぐ）
}

export async function clearUnlock(cookieName: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName);
}
