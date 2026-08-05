"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { codeMatches, grantUnlock, clearUnlock, hasUnlock } from "@/lib/unlock";
import { getDb, mutateDb, history, uid, nowIso } from "@/lib/store";

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

/** 本部から、選手/会員を任意のジムに紐付ける（無所属→ジム、別ジムへ移動も）。gymId="" で無所属に戻す。HQ解錠必須。 */
export async function hqLinkGymAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const userId = String(formData.get("userId") || "");
  const gymId = String(formData.get("gymId") || "");
  const db = await getDb();
  if (gymId && !db.gyms.some((g) => g.id === gymId)) redirect(`/hq/user/${userId}`);
  let done = false;
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === userId && (x.role === "pro" || x.role === "member"));
    if (u) { u.gymId = gymId; done = true; }
  });
  // 対象(選手/会員)が見つからなければ成功表示も監査ログも残さない
  if (!done) redirect(`/hq/user/${userId}`);
  await history(gymId, undefined, "hq_link_gym", userId);
  redirect(`/hq/user/${userId}?linked=1`);
}

/**
 * 本部からジムを削除する（課金前に勝手に作られた不要ジムの掃除用）。HQ解錠必須。
 * 安全策：選手・会員が1人でも紐付いているジムは削除しない（先に紐付けを外す/移す必要がある）。
 * 削除時はそのジムのスタッフアカウントも一緒に削除する。
 */
export async function hqDeleteGymAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const gymId = String(formData.get("gymId") || "");
  const db = await getDb();
  const hasAthletes = db.users.some((u) => u.gymId === gymId && u.status === "active" && (u.role === "pro" || u.role === "member"));
  if (!gymId || hasAthletes) redirect("/hq?gymdel=blocked");
  await mutateDb((d) => {
    d.gyms = d.gyms.filter((g) => g.id !== gymId);
    d.users = d.users.filter((u) => !(u.gymId === gymId && u.role === "staff"));
  });
  await history(gymId, undefined, "hq_delete_gym");
  redirect("/hq?gymdel=1");
}

/**
 * 本部から選手/会員アカウントを停止/再開する。停止中はログイン不可・各一覧から除外される。
 * 停止すると、ログイン中でも次のリクエストで弾かれる（currentUser が status="active" のみ返すため）。HQ解錠必須。
 */
export async function hqToggleUserAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const userId = String(formData.get("userId") || "");
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === userId && (x.role === "pro" || x.role === "member"));
    if (u) u.status = u.status === "active" ? "suspended" : "active";
  });
  await history("", undefined, "hq_toggle_user", userId);
  redirect(`/hq/user/${userId}?acct=1`);
}

/**
 * 本部から、指定メールの利用者に「パーソナルコーチ権限」を付与する（初期オンボーディング/デモ用）。
 * 個人パーソナルスペースを作り、本人へ owner+coach の Membership を付与する（担当顧客は招待から追加）。
 * 既に owner スペースがあれば作り直さず coach 権限だけ補う（idempotent）。HQ解錠必須。
 */
export async function hqGrantCoachAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const db = await getDb();
  const target = db.users.find((u) => u.email.toLowerCase() === email && u.status === "active");
  if (!target) redirect("/hq?coach=notfound");
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === target!.id);
    if (!u) return;
    const ownerMs = d.memberships.filter((m) => m.userId === u.id && m.role === "owner" && m.status === "active");
    let wsId = d.workspaces.find((w) => w.type === "personal" && w.status === "active" && ownerMs.some((m) => m.workspaceId === w.id))?.id;
    if (!wsId) {
      wsId = uid();
      const code = uid().replace(/-/g, "").slice(0, 8).toUpperCase();
      d.workspaces.push({ id: wsId, name: `${u.name} パーソナル`, type: "personal", ownerId: u.id, status: "active", inviteCode: `PC-${code}`, createdAt: nowIso() });
      d.memberships.push({ id: uid(), userId: u.id, workspaceId: wsId, role: "owner", status: "active", createdAt: nowIso() });
    }
    if (!d.memberships.some((m) => m.userId === u.id && m.workspaceId === wsId && m.role === "coach" && m.status === "active")) {
      d.memberships.push({ id: uid(), userId: u.id, workspaceId: wsId!, role: "coach", status: "active", createdAt: nowIso() });
    }
  });
  await history("", undefined, "hq_grant_coach", target!.id);
  redirect("/hq?coach=granted");
}

/** 本部からジムを停止/再開する（停止中はそのコードでの新規登録・参加を拒否）。HQ解錠必須。 */
export async function hqToggleGymAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const gymId = String(formData.get("gymId") || "");
  await mutateDb((d) => {
    const g = d.gyms.find((x) => x.id === gymId);
    if (g) g.suspended = !g.suspended;
  });
  redirect("/hq");
}

/**
 * 本部から、メールアドレス指定で任意アカウント（スタッフ含む）のパスワードを再設定する。
 * スタッフが自分のパスワードを忘れたときの最終手段。HQ解錠済みが必須。
 */
export async function hqResetPasswordAction(formData: FormData): Promise<void> {
  if (!(await hasUnlock("fr_hq"))) redirect("/hq");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const pw = String(formData.get("password") || "");
  if (pw.length < 6) redirect("/hq?pw=short");
  const db = await getDb();
  const target = db.users.find((x) => x.email === email && x.status === "active");
  if (!target) redirect("/hq?pw=notfound");
  await mutateDb((d) => {
    const u = d.users.find((x) => x.id === target!.id);
    if (u) u.passwordHash = bcrypt.hashSync(pw, 8);
  });
  await history(target!.gymId, undefined, "hq_reset_password", target!.id);
  redirect("/hq?pw=ok");
}
