/**
 * メール送信。優先順位：
 *   1) Gmail SMTP（GMAIL_USER + GMAIL_APP_PASSWORD）… ドメイン不要・無料。全宛先に送れる。
 *   2) Resend（RESEND_API_KEY）… 独自ドメイン認証済みなら全宛先、未認証なら自分のResendメール宛のみ。
 *   3) いずれも未設定 … 送らず「未設定」を返す（開発時のみリンクをログ出力）。
 * どちらも未設定でも画面は動く（フォールバックで「スタッフに連絡」表示）。
 */
const SUBJECT = "【FIGHT READY】パスワード再設定のご案内";
function bodyText(link: string): string {
  return (
    "FIGHT READY のパスワード再設定のご案内です。\n\n" +
    "下のリンクを開いて、新しいパスワードを設定してください（60分以内に有効）。\n\n" +
    `${link}\n\n` +
    "このメールに心当たりがない場合は、そのまま破棄してください。パスワードは変更されません。"
  );
}

function gmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailConfigured(): boolean {
  return gmailConfigured() || resendConfigured();
}

export interface SendResult {
  sent: boolean;
  reason?: "unconfigured" | "send_failed";
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<SendResult> {
  // 1) Gmail SMTP を最優先（ドメイン不要・無料）
  if (gmailConfigured()) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const user = process.env.GMAIL_USER!;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: process.env.GMAIL_APP_PASSWORD! },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `FIGHT READY <${user}>`,
        to,
        subject: SUBJECT,
        text: bodyText(link),
      });
      return { sent: true };
    } catch {
      return { sent: false, reason: "send_failed" };
    }
  }

  // 2) Resend（独自ドメイン認証済みなら全宛先に送れる）
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "FIGHT READY <onboarding@resend.dev>",
          to: [to],
          subject: SUBJECT,
          text: bodyText(link),
        }),
      });
      if (!res.ok) return { sent: false, reason: "send_failed" };
      return { sent: true };
    } catch {
      return { sent: false, reason: "send_failed" };
    }
  }

  // 3) 未設定：開発時のみリンクをログ出力
  if (!process.env.VERCEL) console.log(`[password-reset] to=${to} link=${link}`);
  return { sent: false, reason: "unconfigured" };
}
