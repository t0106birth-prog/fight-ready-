"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, mutateDb, uid, nowIso, history } from "@/lib/store";
import { setSession } from "@/lib/auth";
import type { Gym, User } from "@/lib/types";

// 読み間違えにくい文字だけ（0/O, 1/I などを除く）でジムコードを作る
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

export async function registerGymAction(formData: FormData): Promise<void> {
  const g = (k: string) => String(formData.get(k) || "").trim();
  const gymName = g("gymName");
  const email = g("email").toLowerCase();
  const password = g("password");
  const fail = (msg: string) => redirect(`/register-gym?${new URLSearchParams({ e: msg })}`);

  if (!gymName) fail("ジム名を入力してください");
  if (!email || !email.includes("@")) fail("正しいメールアドレスを入力してください");
  if (password.length < 6) fail("パスワードは6文字以上にしてください");

  const db = await getDb();
  if (db.users.some((u) => u.email === email)) fail("このメールアドレスは登録済みです");

  // ジムコードを自動生成し、既存と重複しないものを選ぶ
  const existing = new Set(db.gyms.map((x) => x.code.toUpperCase()));
  let code = genCode();
  for (let i = 0; existing.has(code) && i < 50; i++) code = genCode();

  const gymId = uid();
  const staffId = uid();
  const gym: Gym = { id: gymId, name: gymName, code, createdAt: nowIso() };
  const staff: User = {
    id: staffId, gymId, email, passwordHash: bcrypt.hashSync(password, 8),
    role: "staff", name: "ジムスタッフ", status: "active", createdAt: nowIso(),
  };

  await mutateDb((d) => {
    d.gyms.push(gym);
    d.users.push(staff);
  });
  await history(gymId, staffId, "register_gym", code);
  await setSession({ userId: staffId, gymId, role: "staff" }, true);
  // 作成後は設定へ → 発行されたジムコード・QRをすぐ配れる
  redirect("/staff/settings?new=1");
}
