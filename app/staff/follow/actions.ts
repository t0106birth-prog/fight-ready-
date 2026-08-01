"use server";

import { redirect } from "next/navigation";
import { currentUser, canView } from "@/lib/auth";
import { appendRow, uid, nowIso, history } from "@/lib/store";
import type { FollowupLog } from "@/lib/types";

export async function followAction(formData: FormData): Promise<void> {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/");
  const userId = String(formData.get("userId") || "");
  if (!(await canView(staff!, userId))) redirect("/staff");
  const log: FollowupLog = {
    id: uid(), gymId: staff!.gymId, userId,
    action: String(formData.get("action") || "対応"),
    staffId: staff!.id,
    note: String(formData.get("note") || "").trim() || undefined,
    createdAt: nowIso(),
  };
  await appendRow("followupLogs", log);
  await history(staff!.gymId, staff!.id, "followup", userId, log.action);
  redirect(`/staff/user/${userId}`);
}
