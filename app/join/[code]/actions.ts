"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb, mutateDb, history, uid, nowIso } from "@/lib/store";
import { workspaceByInviteCode } from "@/lib/coach";
import type { CoachScope } from "@/lib/types";

const ALL_SCOPES: CoachScope[] = ["weight", "activity", "nutrition", "condition", "pain"];

/**
 * 顧客が招待コードで参加する（本人同意）。
 * ・本人が「参加する」を押して初めて CoachClientAssignment を active にする。
 * ・共有範囲は本人がチェックした scope だけ（同意ベース）。
 * ・コーチ(owner)＝スペースの持ち主。自分のスペースには顧客参加させない。
 */
export async function joinCoachAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const code = String(formData.get("code") || "");
  const scopes = ALL_SCOPES.filter((s) => formData.get(`scope_${s}`) != null);
  const db = await getDb();
  const ws = workspaceByInviteCode(db, code);
  if (!ws) redirect("/u?joined=invalid");
  if (ws.ownerId === user!.id) redirect("/coach"); // 自分のスペースには参加しない

  await mutateDb((d) => {
    const w = d.workspaces.find((x) => x.id === ws.id);
    if (!w) return;
    // client Membership（無ければ作る／招待中なら有効化）
    const mb = d.memberships.find((m) => m.userId === user!.id && m.workspaceId === w.id && m.role === "client");
    if (mb) mb.status = "active";
    else d.memberships.push({ id: uid(), userId: user!.id, workspaceId: w.id, role: "client", status: "active", createdAt: nowIso() });
    // 割当（coach = owner）。既存があれば active＋共有範囲を更新、無ければ作る
    const asg = d.coachAssignments.find((a) => a.workspaceId === w.id && a.clientUserId === user!.id);
    if (asg) { asg.status = "active"; asg.sharedScopes = scopes; asg.coachUserId = w.ownerId; }
    else d.coachAssignments.push({ id: uid(), workspaceId: w.id, coachUserId: w.ownerId, clientUserId: user!.id, status: "active", sharedScopes: scopes, createdAt: nowIso() });
  });
  await history(ws.id, user!.id, "coach_client_join");
  redirect("/u?joined=coach");
}
