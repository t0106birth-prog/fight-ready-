"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getDb, mutateDb, history } from "@/lib/store";
import { getStripe, clientPriceData, syncPersonalBilling } from "@/lib/stripe";
import { coachBillableCount } from "@/lib/billing";
import { ownedPersonalWorkspaces } from "@/lib/coach";
import type { Workspace } from "@/lib/types";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3201";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 支払い主体は「その個人スペースの owner 本人」だけ。サーバー側で毎回検証。 */
async function requireOwner(): Promise<{ userId: string; email: string; ws: Workspace }> {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  const owned = ownedPersonalWorkspaces(db, user!.id);
  if (owned.length === 0) redirect("/coach"); // owner でなければ課金操作させない
  return { userId: user!.id, email: user!.email, ws: owned[0] };
}

/** 初回：Stripe Checkout（サブスク登録）へ。 */
export async function startCoachBillingCheckoutAction(): Promise<void> {
  const { userId, email, ws } = await requireOwner();
  const stripe = getStripe();
  if (!stripe) redirect("/coach/billing?e=unconfigured");
  const db = await getDb();
  const qty = coachBillableCount(db, ws.id);
  if (qty < 1) redirect("/coach/billing?e=nomembers");

  let url: string | null = null;
  try {
    let customerId = ws.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe!.customers.create({ name: ws.name, email, metadata: { workspaceId: ws.id } });
      customerId = customer.id;
      await mutateDb((d) => { const w = d.workspaces.find((x) => x.id === ws.id); if (w) w.stripeCustomerId = customer.id; });
    }
    const base = await baseUrl();
    const session = await stripe!.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price_data: clientPriceData(), quantity: qty }],
      success_url: `${base}/coach/billing?saved=1`,
      cancel_url: `${base}/coach/billing?canceled=1`,
      metadata: { workspaceId: ws.id },
      subscription_data: { metadata: { workspaceId: ws.id } },
    });
    url = session.url;
  } catch {
    redirect("/coach/billing?e=stripe");
  }
  await history(ws.id, userId, "coach_billing_checkout_start");
  if (!url) redirect("/coach/billing?e=session");
  redirect(url);
}

/** 契約後：Stripe Billing Portal（カード変更・請求履歴・解約）へ。 */
export async function openCoachBillingPortalAction(): Promise<void> {
  const { ws } = await requireOwner();
  const stripe = getStripe();
  if (!stripe) redirect("/coach/billing?e=unconfigured");
  if (!ws.stripeCustomerId) redirect("/coach/billing?e=nocustomer");
  let url: string | null = null;
  try {
    const base = await baseUrl();
    const portal = await stripe!.billingPortal.sessions.create({ customer: ws.stripeCustomerId!, return_url: `${base}/coach/billing` });
    url = portal.url;
  } catch {
    redirect("/coach/billing?e=stripe");
  }
  if (!url) redirect("/coach/billing?e=session");
  redirect(url);
}

/** 請求人数を今の担当顧客数に合わせる（手動同期）。 */
export async function syncCoachBillingQuantityAction(): Promise<void> {
  const { userId, ws } = await requireOwner();
  const res = await syncPersonalBilling(ws.id);
  if (res.ok) await history(ws.id, userId, "coach_billing_sync", String(res.quantity ?? ""));
  redirect(res.ok ? "/coach/billing?synced=1" : `/coach/billing?e=${res.reason ?? "sync"}`);
}
