import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { getDb } from "./store";
import type { Role, User } from "./types";

const COOKIE = "fight_ready_session";

/** セッション署名鍵。本番では SESSION_SECRET 必須（未設定なら本番は例外）。 */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET が設定されていません（本番では必須）");
  }
  return "dev-only-secret-fight-ready";
}

export interface Session {
  userId: string;
  gymId: string;
  role: Role;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function setSession(s: Session, remember = true): Promise<void> {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    // 本番(HTTPS)では常に Secure。開発は http なので付けない（付けると dev でCookieが無効化される）
    secure: !!process.env.VERCEL || process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  const s = await getSession();
  if (!s) return null;
  const db = await getDb();
  return db.users.find((x) => x.id === s.userId && x.status === "active") ?? null;
}

export function isStaff(u: User | null | undefined): boolean {
  return !!u && u.role === "staff";
}

/** スタッフは所属ジム内の全プロ選手・一般会員を閲覧・更新できる(§47)。他ジムは不可。 */
export async function canView(actor: User, targetId: string): Promise<boolean> {
  if (actor.id === targetId) return true;
  const db = await getDb();
  const target = db.users.find((u) => u.id === targetId);
  if (!target || target.gymId !== actor.gymId) return false;
  return isStaff(actor);
}

/** 一覧に出すジム内の利用者（プロ＋一般） */
export async function gymMembers(actor: User): Promise<User[]> {
  const db = await getDb();
  if (!isStaff(actor)) return [];
  return db.users.filter(
    (u) => u.gymId === actor.gymId && (u.role === "pro" || u.role === "member") && u.status === "active"
  );
}

export function homePath(role: Role): string {
  return role === "staff" ? "/staff" : "/u";
}

/** 認可ガード。未ログイン or 権限不足なら null（呼び出し側で redirect） */
export async function requireUser(): Promise<User | null> {
  return currentUser();
}
