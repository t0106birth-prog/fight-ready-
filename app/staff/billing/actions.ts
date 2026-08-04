"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getDb, mutateDb, history } from "@/lib/store";
import { getStripe, athletePriceData, syncGymBilling } from "@/lib/stripe";
import { billableCount } from "@/lib/billing";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3201";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function requireStaff() {
  const staff = await currentUser();
  if (!staff || staff.role !== "staff") redirect("/login/staff");
  return staff!;
}

/** 初回：Stripe Checkout（サブスク登録）へ。カード入力はStripe側で行う。 */
export async function startBillingCheckoutAction(): Promise<void> {
  const staff = await requireStaff();
  const stripe = getStripe();
  if (!stripe) redirect("/staff/billing?e=unconfigured");
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === staff.gymId);
  if (!gym) redirect("/staff/billing?e=nogym");
  const qty = billableCount(db, gym!.id);
  if (qty < 1) redirect("/staff/billing?e=nomembers");

  let url: string | null = null;
  try {
    // 顧客を用意（なければ作成し、ジムに保存）
    let customerId = gym!.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe!.customers.create({ name: gym!.name, email: staff.email, metadata: { gymId: gym!.id } });
      customerId = customer.id;
      await mutateDb((d) => { const g = d.gyms.find((x) => x.id === gym!.id); if (g) g.stripeCustomerId = customer.id; });
    }
    const base = await baseUrl();
    const session = await stripe!.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price_data: athletePriceData(), quantity: qty }],
      success_url: `${base}/staff/billing?saved=1`,
      cancel_url: `${base}/staff/billing?canceled=1`,
      metadata: { gymId: gym!.id },
      subscription_data: { metadata: { gymId: gym!.id } },
    });
    url = session.url;
  } catch {
    redirect("/staff/billing?e=stripe");
  }
  await history(gym!.id, staff.id, "billing_checkout_start");
  if (!url) redirect("/staff/billing?e=session");
  redirect(url);
}

/** 契約後：Stripe Billing Portal（カード変更・請求履歴・解約）へ。 */
export async function openBillingPortalAction(): Promise<void> {
  const staff = await requireStaff();
  const stripe = getStripe();
  if (!stripe) redirect("/staff/billing?e=unconfigured");
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === staff.gymId);
  if (!gym?.stripeCustomerId) redirect("/staff/billing?e=nocustomer");
  let url: string | null = null;
  try {
    const base = await baseUrl();
    const portal = await stripe!.billingPortal.sessions.create({ customer: gym!.stripeCustomerId!, return_url: `${base}/staff/billing` });
    url = portal.url;
  } catch {
    redirect("/staff/billing?e=stripe");
  }
  if (!url) redirect("/staff/billing?e=session");
  redirect(url);
}

/** 請求人数を今の対象人数に合わせる（手動同期）。 */
export async function syncBillingQuantityAction(): Promise<void> {
  const staff = await requireStaff();
  const res = await syncGymBilling(staff.gymId);
  if (res.ok) await history(staff.gymId, staff.id, "billing_sync", String(res.quantity ?? ""));
  redirect(res.ok ? "/staff/billing?synced=1" : `/staff/billing?e=${res.reason ?? "sync"}`);
}
