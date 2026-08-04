/**
 * メール送信（Resend）。RESEND_API_KEY 未設定なら送らず「未設定」を返す。
 * 追加パッケージ不要（Resend の HTTP API を fetch で叩くだけ）。
 * 未設定時は、開発環境のみリンクをサーバーログに出す（本番では出さない）。
 */
const FROM = process.env.EMAIL_FROM || "FIGHT READY <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendResult {
  sent: boolean;
  reason?: "unconfigured" | "send_failed";
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!process.env.VERCEL) console.log(`[password-reset] to=${to} link=${link}`);
    return { sent: false, reason: "unconfigured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "【FIGHT READY】パスワード再設定のご案内",
        text:
          "FIGHT READY のパスワード再設定のご案内です。\n\n" +
          "下のリンクを開いて、新しいパスワードを設定してください（60分以内に有効）。\n\n" +
          `${link}\n\n` +
          "このメールに心当たりがない場合は、そのまま破棄してください。パスワードは変更されません。",
      }),
    });
    if (!res.ok) return { sent: false, reason: "send_failed" };
    return { sent: true };
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}
