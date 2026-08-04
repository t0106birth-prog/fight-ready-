import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { billableCount, monthlyAmountJpy, stripeConfigured, billingStatusView, PRICE_PER_ATHLETE_JPY } from "@/lib/billing";
import { startBillingCheckoutAction, openBillingPortalAction, syncBillingQuantityAction } from "@/app/staff/billing/actions";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const ERR: Record<string, string> = {
  unconfigured: "Stripeが未設定です（テスト用APIキーを設定すると有効になります）。",
  nogym: "ジム情報が見つかりませんでした。",
  nomembers: "対象の選手・会員が0名です。先に招待してからお支払いを設定してください。",
  nocustomer: "まだお支払いが設定されていません。先に「お支払いを設定する」を行ってください。",
  no_subscription: "契約中のサブスクリプションがありません。",
  stripe: "Stripeとの通信でエラーが発生しました。時間をおいて再度お試しください。",
  stripe_error: "Stripeとの通信でエラーが発生しました。時間をおいて再度お試しください。",
  session: "決済ページの生成に失敗しました。もう一度お試しください。",
  sync: "請求人数の更新に失敗しました。",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ saved?: string; canceled?: string; synced?: string; e?: string }> }) {
  const sp = await searchParams;
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === staff.gymId);

  const configured = stripeConfigured();
  const count = billableCount(db, staff.gymId);
  const amount = monthlyAmountJpy(count);
  const status = gym?.billingStatus;
  const view = billingStatusView(status);
  const hasSub = Boolean(gym?.stripeSubscriptionId) && status !== "canceled";
  const billedQty = gym?.billingQuantity;
  const qtyDrift = hasSub && billedQty != null && billedQty !== count;

  return (
    <>
      <Hero title="お支払い" sub={gym?.name} backHref="/staff/settings" />
      <div className="shell-wide">
        {sp.saved && <div className="alert-band alert-green"><b>✓</b> お支払いの設定が完了しました。以後は自動で毎月請求されます。</div>}
        {sp.synced && <div className="alert-band alert-green"><b>✓</b> 請求人数を今の対象人数に更新しました。</div>}
        {sp.canceled && <div className="alert-band alert-yellow">お支払いの設定を中断しました。いつでも再開できます。</div>}
        {sp.e && <div className="alert-band alert-red">{ERR[sp.e] ?? "エラーが発生しました。"}</div>}

        {/* 状態サマリー */}
        <div className="card">
          <div className="row">
            <b style={{ fontSize: 16 }}>ご契約状況</b>
            <span className={`sig sig-${view.tone}`}>{view.text}</span>
          </div>
          <div className="progress-row" style={{ marginTop: 8 }}><span className="meta">対象人数（選手・一般会員）</span><b>{count}名</b></div>
          <div className="progress-row"><span className="meta">単価</span><b>{yen(PRICE_PER_ATHLETE_JPY)} / 名・月</b></div>
          <div className="progress-row"><span className="meta">{hasSub ? "現在の月額（目安）" : "お支払いの目安"}</span><b style={{ fontSize: 18 }}>{yen(amount)} / 月</b></div>
          {hasSub && billedQty != null && (
            <div className="progress-row"><span className="meta">Stripeに反映済みの請求人数</span><b>{billedQty}名</b></div>
          )}
          <p className="info-note" style={{ marginBottom: 0 }}>
            人数が変わると請求額も自動で変わります（1ジム＝1契約。日割りで精算されます）。選手・会員アプリの利用は無料です。
          </p>
        </div>

        {/* Stripe未設定：画面は見せるが操作は無効 */}
        {!configured && (
          <div className="card tight">
            <div className="alert-band alert-yellow" style={{ margin: 0 }}>
              <div className="at">お支払い機能は準備中です</div>
              決済（Stripe）がまだ設定されていません。テスト用のAPIキーを設定すると、この画面から契約・カード登録・解約ができるようになります。
            </div>
          </div>
        )}

        {/* 未契約：はじめて設定する */}
        {configured && !hasSub && (
          <>
            <form action={startBillingCheckoutAction}>
              <SubmitButton className="btn btn-accent" pendingLabel="決済ページへ移動しています…" style={{ width: "100%" }} disabled={count < 1}>
                お支払いを設定する（カード登録）
              </SubmitButton>
            </form>
            {count < 1
              ? <p className="info-note center">先に「設定」から選手・会員を招待してください（現在0名）。</p>
              : <p className="info-note center">Stripeの安全なページでカードを登録します。カード情報は当アプリには保存されません。</p>}
          </>
        )}

        {/* 契約中：人数更新＆管理 */}
        {configured && hasSub && (
          <>
            {qtyDrift && (
              <div className="alert-band alert-yellow">
                <div className="at">対象人数が変わっています</div>
                請求中 <b>{billedQty}名</b> → 現在 <b>{count}名</b>。下のボタンで請求人数を今の人数に合わせられます。
              </div>
            )}
            <form action={syncBillingQuantityAction}>
              <SubmitButton className={qtyDrift ? "btn btn-accent" : "btn btn-ghost"} pendingLabel="更新しています…" style={{ width: "100%" }}>
                請求人数を今の人数（{count}名）に更新する
              </SubmitButton>
            </form>
            <form action={openBillingPortalAction} style={{ marginTop: 8 }}>
              <SubmitButton className="btn btn-primary" pendingLabel="管理ページへ移動しています…" style={{ width: "100%" }}>
                お支払い情報を管理（カード変更・請求履歴・解約）
              </SubmitButton>
            </form>
            <p className="info-note center">カードの変更・領収書・解約は、Stripeの管理ページから行えます。</p>
          </>
        )}

        <div className="card tight">
          <p className="info-note mt0" style={{ marginBottom: 0 }}>
            ジムスタッフは全員このお支払い画面を利用できます。ご不明点は運営までお問い合わせください。
          </p>
        </div>
      </div>
      <StaffTabbar active="settings" />
    </>
  );
}
