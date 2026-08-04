/**
 * 課金（ジム単位のシート課金）の共通ロジック。
 * ・1ジム＝Stripeの顧客1・サブスク1。単価 ¥500/月 × 対象人数(quantity)。
 * ・対象人数＝所属する選手・一般会員（activeなpro/member）。スタッフは含めない。
 * ・金額計算・状態ラベルなど「お金の表示」をここに集約し、後から単価等を変えやすくする。
 */
import type { DB } from "./types";

/** 1人あたりの月額（円）。将来変えるならここだけ。 */
export const PRICE_PER_ATHLETE_JPY = 500;

/** 請求対象の人数（ジム内の active な選手・一般会員）。 */
export function billableCount(db: DB, gymId: string): number {
  return db.users.filter(
    (u) => u.gymId === gymId && (u.role === "pro" || u.role === "member") && u.status === "active"
  ).length;
}

/** パーソナルコーチの請求対象人数（そのスペースの active な担当顧客）。単価はジムと同じ。 */
export function coachBillableCount(db: DB, workspaceId: string): number {
  return db.coachAssignments.filter((a) => a.workspaceId === workspaceId && a.status === "active").length;
}

/** 対象人数から月額（円）。 */
export function monthlyAmountJpy(count: number): number {
  return count * PRICE_PER_ATHLETE_JPY;
}

/** Stripeのシークレットキーが設定されているか（未設定でも画面は出す）。 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface BillingStatusView {
  text: string;
  tone: "green" | "yellow" | "red" | "blue";
}

/** 課金状態の表示（バッジ用）。 */
export function billingStatusView(status?: string): BillingStatusView {
  switch (status) {
    case "active":
    case "trialing":
      return { text: "契約中", tone: "green" };
    case "past_due":
    case "unpaid":
      return { text: "支払い確認が必要", tone: "red" };
    case "incomplete":
      return { text: "手続き未完了", tone: "yellow" };
    case "canceled":
      return { text: "解約済み", tone: "blue" };
    default:
      return { text: "未契約", tone: "blue" };
  }
}

/** 契約が有効（機能を有効にしてよい）状態か。 */
export function billingActive(status?: string): boolean {
  return status === "active" || status === "trialing";
}
