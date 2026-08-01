"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, mutateDb, uid, nowIso, history } from "@/lib/store";
import { setSession } from "@/lib/auth";
import type { CombatSport, Goal, User, UserType } from "@/lib/types";

export async function registerAction(formData: FormData): Promise<void> {
  const g = (k: string) => String(formData.get(k) || "").trim();
  const email = g("email").toLowerCase();
  const password = g("password");
  const name = g("name");
  const userType = g("userType") as UserType;

  const fail = (msg: string) => redirect(`/register?${new URLSearchParams({ e: msg })}`);

  if (!name) fail("氏名を入力してください");
  if (!email || !email.includes("@")) fail("正しいメールアドレスを入力してください");
  if (password.length < 6) fail("パスワードは6文字以上にしてください");
  if (userType !== "pro" && userType !== "member") fail("利用区分を選んでください");

  const db = await getDb();
  if (db.users.some((u) => u.email === email)) fail("このメールアドレスは登録済みです");
  // ジムコード（QR/招待）優先で紐付け。無ければ選択したジムID（お試し用）。
  const gymCode = g("gymCode").toUpperCase();
  const byCode = gymCode ? db.gyms.find((x) => x.code.toUpperCase() === gymCode && !x.suspended) : undefined;
  if (gymCode && !byCode) fail("チームコードが見つかりません。コードを確認してください");
  const gymId = byCode?.id || g("gymId") || db.gyms[0]?.id;
  if (!gymId || !db.gyms.some((x) => x.id === gymId && !x.suspended)) fail("所属を選んでください（チームコードを入力してください）");

  const sports = formData.getAll("sports").map(String) as CombatSport[];
  const primarySport = (g("primarySport") || sports[0] || undefined) as CombatSport | undefined;
  if (userType === "pro" && !primarySport) fail("主競技を選んでください");

  const num = (k: string) => {
    const v = g(k);
    return v ? Number(v) : undefined;
  };
  const goals = formData.getAll("goals").map(String) as Goal[];
  const dt = (k: string) => {
    const v = g(k);
    return v || undefined;
  };

  const user: User = {
    id: uid(),
    gymId,
    email,
    passwordHash: bcrypt.hashSync(password, 8),
    role: userType,
    name,
    status: "active",
    gender: (g("gender") || undefined) as User["gender"],
    birthDate: dt("birthDate"),
    heightCm: num("height"),
    userType,
    usualWeight: num("usualWeight"),
    startWeight: num("currentWeight"),
    primarySport,
    sports: sports.length ? sports : primarySport ? [primarySport] : [],
    goals,
    targetWeight: num("targetWeight"),
    targetDate: dt("targetDate"),
    weeklyPlanCount: num("weeklyPlanCount"),
    createdAt: nowIso(),
    ...(userType === "pro"
      ? {
          promotion: (g("promotion") || "none") as User["promotion"],
          contractWeightKg: num("contractWeight"),
          usesHydration: formData.get("usesHydration") === "on",
          weighInAt: dt("weighInAt"),
          fightAt: dt("fightAt"),
          weighInType: (g("weighInType") || undefined) as User["weighInType"],
          pastCutExperience: g("pastCutExperience") || undefined,
          maxCutKg: num("maxCutKg"),
        }
      : {}),
  };

  await mutateDb((d) => d.users.push(user));
  await history(gymId, user.id, "register", userType);
  await setSession({ userId: user.id, gymId, role: user.role }, true);
  redirect("/u");
}
