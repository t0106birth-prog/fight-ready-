/**
 * Stripe クライアントとサーバー側の課金ヘルパー。
 * STRIPE_SECRET_KEY 未設定なら getStripe() は null を返し、画面は「未設定」で描画する。
 * 事前に Dashboard で Price を作らなくてよいよう、単価は price_data で都度指定する。
 */
import Stripe from "stripe";
import { getDb, mutateDb, nowIso } from "./store";
import { billableCount, PRICE_PER_ATHLETE_JPY } from "./billing";
import type { Gym } from "./types";

let _stripe: Stripe | null | undefined;
export function getStripe(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  _stripe = key ? new Stripe(key) : null;
  return _stripe;
}

/** チェックアウトの明細（¥500/月 × 人数）。Dashboardでの事前Price作成が不要。 */
export function athletePriceData(): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
  return {
    currency: "jpy",
    unit_amount: PRICE_PER_ATHLETE_JPY,
    recurring: { interval: "month" },
    product_data: { name: "選手モニタリング（1名あたり月額）" },
  };
}

/** Stripeのサブスク状態をアプリの状態に写す。 */
export function mapStatus(s: string): Gym["billingStatus"] {
  switch (s) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "unpaid": return "unpaid";
    case "canceled":
    case "incomplete_expired": return "canceled";
    case "incomplete": return "incomplete";
    default: return "incomplete";
  }
}

/** サブスク1件からジムの課金状態・人数を保存する（表示専用の写し）。 */
export async function applySubscriptionToGym(gymId: string, sub: Stripe.Subscription): Promise<void> {
  const qty = sub.items.data[0]?.quantity ?? undefined;
  await mutateDb((d) => {
    const g = d.gyms.find((x) => x.id === gymId);
    if (!g) return;
    g.stripeSubscriptionId = sub.id;
    if (typeof sub.customer === "string") g.stripeCustomerId = sub.customer;
    g.billingStatus = sub.status === "canceled" || sub.status === "incomplete_expired" ? "canceled" : mapStatus(sub.status);
    if (qty != null) g.billingQuantity = qty;
    g.billingUpdatedAt = nowIso();
  });
}

/**
 * ジムの請求人数(quantity)を「今の対象人数」に合わせる。
 * Stripe未設定・サブスク未契約なら何もしない（best-effort）。
 */
export async function syncGymBilling(gymId: string): Promise<{ ok: boolean; reason?: string; quantity?: number }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: "unconfigured" };
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === gymId);
  if (!gym?.stripeSubscriptionId) return { ok: false, reason: "no_subscription" };
  try {
    const sub = await stripe.subscriptions.retrieve(gym.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) return { ok: false, reason: "no_item" };
    const qty = billableCount(db, gymId);
    if (item.quantity !== qty) {
      await stripe.subscriptionItems.update(item.id, { quantity: qty, proration_behavior: "create_prorations" });
    }
    const fresh = await stripe.subscriptions.retrieve(gym.stripeSubscriptionId);
    await applySubscriptionToGym(gymId, fresh);
    return { ok: true, quantity: qty };
  } catch {
    return { ok: false, reason: "stripe_error" };
  }
}
