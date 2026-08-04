import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { gymMembers } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { updateGymAction } from "@/app/staff/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { StaffTabbar, Hero } from "@/components/Nav";

export default async function StaffSettings({ searchParams }: { searchParams: Promise<{ new?: string; saved?: string; e?: string }> }) {
  const sp = await searchParams;
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === staff.gymId);
  // 自ジムのログイン履歴だけ表示（別ジムのメールアドレスが漏れないように gymId で絞る）
  const logins = db.logins.filter((l) => l.gymId === staff.gymId).slice(-8).reverse();
  const memberCount = (await gymMembers(staff)).length;

  // 招待用のQRとリンク（ホストはリクエストから取得）
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3201";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/register?gym=${gym?.code ?? ""}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(inviteUrl, { margin: 1, width: 220, color: { dark: "#0a0d12", light: "#ffffff" } });
  } catch { /* 生成に失敗してもリンク/コードは出す */ }

  return (
    <>
      <Hero title="設定" sub={gym?.name} backHref="/staff" />
      <div className="shell-wide">
        {sp.new && (
          <div className="alert-band alert-green">
            <div className="at">✓ ジムを作成しました</div>
            チームコード <b>{gym?.code}</b> が発行されました。下のQR・コードを選手／会員に配って招待してください。
          </div>
        )}
        {/* 招待：選手・会員はこのQR/コードから自己登録→このジムに自動で紐付く */}
        <p className="kicker">選手・会員を招待する</p>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="mt0" style={{ fontWeight: 700 }}>このQR・チームコードを選手／会員に配ってください</p>
          <p className="info-note mt0">ジムでも、パーソナルトレーナー個人でも使えます（あなたのチームのコードです）。</p>
          <p className="info-note mt0">読み取って登録すると、<b>自動で {gym?.name} に紐付き</b>、下の一覧（現在 {memberCount}名）に出ます。</p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="登録用QRコード" width={200} height={200} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
          )}
          <div className="alert-band" style={{ background: "var(--bg2)", border: "1px solid var(--line)", margin: "12px 0 0" }}>
            <div className="meta">チームコード</div>
            <b style={{ fontSize: 26, fontStyle: "italic", letterSpacing: ".08em" }}>{gym?.code}</b>
          </div>
          <p className="info-note" style={{ wordBreak: "break-all", marginBottom: 0 }}>
            登録リンク：<br /><span style={{ color: "var(--blue)" }}>{inviteUrl}</span>
          </p>
          <p className="info-note">選手・会員のアプリ利用は無料です。ジムは紐付いた人数に応じてご利用いただけます。</p>
        </div>

        {/* お支払い（Stripe） */}
        <p className="kicker">お支払い</p>
        <Link href="/staff/billing" className="card" style={{ display: "block", color: "var(--ink)" }}>
          <div className="row">
            <div>
              <b>💳 お支払い・ご契約</b>
              <p className="meta mt0" style={{ marginBottom: 0 }}>選手・会員 {memberCount}名 ・ 月額の確認とカード登録</p>
            </div>
            <span className="ta">›</span>
          </div>
        </Link>

        {/* ジムの基本情報を手動で編集 */}
        <p className="kicker">ジムの基本情報</p>
        {sp.saved === "gym" && <div className="alert-band alert-green"><b>✓</b> ジム情報を保存しました</div>}
        {sp.e === "name" && <div className="alert-band alert-red">ジム名を入力してください。</div>}
        <form action={updateGymAction} className="card">
          <label className="fl mt0" htmlFor="name">ジム名</label>
          <input id="name" name="name" type="text" required defaultValue={gym?.name ?? ""} />
          <label className="fl" htmlFor="address">住所（任意）</label>
          <input id="address" name="address" type="text" defaultValue={gym?.address ?? ""} placeholder="例: 東京都〇〇区…" />
          <label className="fl" htmlFor="phone">電話番号（任意）</label>
          <input id="phone" name="phone" type="tel" defaultValue={gym?.phone ?? ""} placeholder="例: 03-0000-0000" />
          <label className="fl" htmlFor="note">メモ（任意）</label>
          <textarea id="note" name="note" rows={2} defaultValue={gym?.note ?? ""} />
          <div className="progress-row" style={{ marginTop: 10 }}><span className="meta">チームコード（自動発行・変更不可）</span><b>{gym?.code}</b></div>
          <div className="progress-row"><span className="meta">紐付いた選手・会員</span><b>{memberCount}名</b></div>
          <div className="progress-row"><span className="meta">アカウント</span><b>{staff.email}</b></div>
          <div style={{ height: 12 }} />
          <SubmitButton className="btn btn-primary btn-sm" pendingLabel="保存中…" style={{ width: "100%" }}>ジム情報を保存する</SubmitButton>
        </form>
        <div className="card tight">
          <p className="info-note mt0">ジムスタッフ間で権限差はありません。所属ジム内のすべての選手・一般会員を閲覧・更新できます。他ジムのデータは見えません。担当コーチ機能はありません。</p>
        </div>
        <div className="card">
          <b>最近のログイン</b>
          {logins.map((l) => (
            <div className="progress-row" key={l.id} style={{ fontSize: 13 }}>
              <span>{l.email}</span><span className="meta">{l.result === "success" ? "成功" : "失敗"} {new Date(l.createdAt).toLocaleString("ja-JP")}</span>
            </div>
          ))}
          {logins.length === 0 && <p className="meta mt0">記録なし</p>}
        </div>
        <form action={logoutAction}><button type="submit" className="btn btn-dark">ログアウト</button></form>
        <p className="info-note center" style={{ marginTop: 12 }}><Link href="/lp">サービス紹介</Link></p>
      </div>
      <StaffTabbar active="settings" />
    </>
  );
}
