import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, applySubscriptionToGym } from "@/lib/stripe";
import { getDb } from "@/lib/store";

// Stripe署名検証のため Node ランタイムで動かす（Edge不可）。
export const runtime = "nodejs";

/** サブスクからジムIDを特定（metadata優先、なければ顧客IDで照合）。 */
async function gymIdForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const metaGym = sub.metadata?.gymId;
  if (metaGym) return metaGym;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const db = await getDb();
  return db.gyms.find((g) => g.stripeCustomerId === customerId)?.id ?? null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) return new Response("stripe not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const gymId = session.metadata?.gymId;
        if (gymId && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToGym(gymId, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const gymId = await gymIdForSubscription(sub);
        if (gymId) await applySubscriptionToGym(gymId, sub);
        break;
      }
      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subRef = invoice.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const gymId = await gymIdForSubscription(sub);
          if (gymId) await applySubscriptionToGym(gymId, sub);
        }
        break;
      }
      default:
        break;
    }
  } catch {
    // 処理に失敗しても200で受ける（Stripeの過剰リトライを避ける。状態は次イベントで整合）。
    return new Response("handler error", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
