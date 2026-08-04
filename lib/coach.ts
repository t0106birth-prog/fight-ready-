/**
 * パーソナルコーチ（マルチロール基盤 Phase 1）の導出・認可ヘルパー。
 *
 * 重要な原則:
 *  - Cookie や hidden 値の clientUserId を信用しない。毎回 DB の Membership と
 *    CoachClientAssignment が active かをサーバー側で検証する。
 *  - コーチは「自分に active で割り当てられた顧客」だけ閲覧できる（他は直URLでも拒否）。
 *  - 表示は sharedScopes で本人が同意した範囲だけ。
 *  - 既存の Role/gymId は一切変更しない（この層は追加のみ）。
 */
import type { DB, User, Workspace, CoachClientAssignment, CoachScope } from "./types";

/** その人が active な coach/owner Membership を持つ、個人パーソナルスペース一覧。 */
export function coachWorkspaces(db: DB, userId: string): Workspace[] {
  const wsIds = new Set(
    db.memberships
      .filter((m) => m.userId === userId && m.status === "active" && (m.role === "coach" || m.role === "owner"))
      .map((m) => m.workspaceId)
  );
  return db.workspaces.filter((w) => w.type === "personal" && w.status === "active" && wsIds.has(w.id));
}

/** コーチモードを持っているか（隠し /coach への入場可否）。 */
export function hasCoachMode(db: DB, userId: string): boolean {
  return coachWorkspaces(db, userId).length > 0;
}

/** このコーチの active な担当割当（自分の active スペースに属するものだけ）。 */
export function coachAssignments(db: DB, coachUserId: string): CoachClientAssignment[] {
  const wsIds = new Set(coachWorkspaces(db, coachUserId).map((w) => w.id));
  return db.coachAssignments.filter(
    (a) => a.coachUserId === coachUserId && a.status === "active" && wsIds.has(a.workspaceId)
  );
}

/**
 * コーチ×顧客の active な割当を返す。無ければ null。
 * 担当外顧客への直URLアクセス防御に使う（呼び出し側で null → 拒否）。
 */
export function assignmentFor(db: DB, coachUserId: string, clientUserId: string): CoachClientAssignment | null {
  return coachAssignments(db, coachUserId).find((a) => a.clientUserId === clientUserId) ?? null;
}

/** 担当顧客(User)＋割当の一覧。active な顧客のみ。 */
export function coachClients(db: DB, coachUserId: string): { user: User; assignment: CoachClientAssignment }[] {
  return coachAssignments(db, coachUserId)
    .map((a) => {
      const user = db.users.find((u) => u.id === a.clientUserId && u.status === "active");
      return user ? { user, assignment: a } : null;
    })
    .filter((x): x is { user: User; assignment: CoachClientAssignment } => x !== null);
}

/** 共有範囲に含まれるか。 */
export function scopeAllowed(a: CoachClientAssignment, scope: CoachScope): boolean {
  return a.sharedScopes.includes(scope);
}

/** 表示用の共有範囲ラベル。 */
export const SCOPE_LABEL: Record<CoachScope, string> = {
  weight: "体重",
  activity: "運動",
  nutrition: "食事",
  condition: "コンディション",
  pain: "痛み",
};
