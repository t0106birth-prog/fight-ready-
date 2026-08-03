import Link from "next/link";
import { hasUnlock } from "@/lib/unlock";
import { getDb } from "@/lib/store";
import { sportLabel } from "@/lib/constants";
import { dailyVerdict } from "@/lib/judge";
import { fmtDateTime } from "@/lib/calc";
import { SigBadge } from "@/components/SigBadge";
import { hqVerifyAction, hqLogoutAction, hqResetPasswordAction, hqToggleGymAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 本部（HQ）管理ページ。暗証番号で解錠すると、全ジムと利用者の紐づけ一覧＋選手の中身を閲覧できる（簡易版）。
 */
export default async function HqPage({ searchParams }: { searchParams: Promise<{ e?: string; pw?: string }> }) {
  const sp = await searchParams;
  const unlocked = await hasUnlock("fr_hq");
  const db = unlocked ? await getDb() : null;
  const gyms = db?.gyms ?? [];
  const activeUsers = db?.users.filter((u) => u.status === "active") ?? [];
  const proTotal = activeUsers.filter((u) => u.role === "pro").length;
  const memberTotal = activeUsers.filter((u) => u.role === "member").length;
  const staffTotal = activeUsers.filter((u) => u.role === "staff").length;
  const gymName = (gid: string) => gyms.find((g) => g.id === gid)?.name ?? "—";
  // 要注意者（赤/黄判定）を全ジム横断で。赤を先頭に。
  const atRisk = db
    ? activeUsers
        .filter((u) => u.role === "pro" || u.role === "member")
        .map((u) => ({ u, v: dailyVerdict(db, u) }))
        .filter((x) => x.v.level === "red" || x.v.level === "yellow")
        .sort((a, b) => (a.v.level === "red" ? 0 : 1) - (b.v.level === "red" ? 0 : 1))
    : [];
  const recentLogins = db ? [...db.logins].slice(-15).reverse() : [];

  return (
    <div className="shell">
      <div className="brand-hero">
        <div className="brand-logo">FIGHT <span className="r">READY</span></div>
        <div className="brand-tag">本部管理（HQ）</div>
      </div>

      {unlocked ? (
        <>
          <div className="alert-band alert-green" style={{ marginTop: 12 }}><b>🔓 解錠しました</b> — 本部管理ページ</div>

          {/* 全体サマリ */}
          <p className="kicker">全体</p>
          <div className="card">
            <div className="progress-row"><span>ジム</span><b>{gyms.length}</b></div>
            <div className="progress-row"><span>選手</span><b>{proTotal}</b></div>
            <div className="progress-row"><span>一般会員</span><b>{memberTotal}</b></div>
            <div className="progress-row"><span>スタッフ</span><b>{staffTotal}</b></div>
          </div>

          {/* 要注意者（赤/黄）を全ジム横断で */}
          <p className="kicker">要注意者（全ジム）</p>
          {atRisk.length === 0 ? (
            <div className="card tight"><p className="meta mt0">今、赤・黄判定の利用者はいません。</p></div>
          ) : (
            <div className="card tight">
              {atRisk.map(({ u, v }) => (
                <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)", alignItems: "flex-start" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <SigBadge level={v.level} />
                    <span>{u.name}<span className="meta"> ・{gymName(u.gymId)}</span><br /><span className="meta" style={{ fontSize: 12 }}>{v.reasons.slice(0, 2).join(" / ")}</span></span>
                  </span>
                  <span className="meta">›</span>
                </Link>
              ))}
            </div>
          )}

          {/* ジムと利用者の紐づけ（選手/会員をタップで中身を閲覧・停止/再開も） */}
          <p className="kicker">ジムと利用者（紐づけ）</p>
          {gyms.map((g) => {
            const us = activeUsers.filter((u) => u.gymId === g.id);
            const athletes = us.filter((u) => u.role === "pro" || u.role === "member");
            const staffs = us.filter((u) => u.role === "staff");
            return (
              <div className="card" key={g.id}>
                <div className="row"><b>{g.name}</b><span className="meta">コード {g.code}{g.suspended ? " ・停止中" : ""}</span></div>
                <div className="row">
                  <p className="meta mt0">
                    選手 {athletes.filter((u) => u.role === "pro").length} / 一般 {athletes.filter((u) => u.role === "member").length} ／ スタッフ {staffs.length}
                  </p>
                  <form action={hqToggleGymAction}>
                    <input type="hidden" name="gymId" value={g.id} />
                    <SubmitButton className={`btn-sm ${g.suspended ? "btn-green" : "btn-dark"}`} pendingLabel="…">
                      {g.suspended ? "再開する" : "停止する"}
                    </SubmitButton>
                  </form>
                </div>
                {athletes.map((u) => (
                  <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)", borderTop: "1px solid var(--line)" }}>
                    <span>{u.role === "pro" ? "🥊" : "💪"} {u.name}<span className="meta"> ・{sportLabel(u.primarySport)}</span></span>
                    <span className="meta">›</span>
                  </Link>
                ))}
                {athletes.length === 0 && <p className="meta mt0">利用者はまだいません</p>}
              </div>
            );
          })}

          {/* ログイン履歴（全ジム横断・直近15件） */}
          <p className="kicker">ログイン履歴（全体）</p>
          <div className="card tight">
            {recentLogins.length === 0 && <p className="meta mt0">記録なし</p>}
            {recentLogins.map((l) => (
              <div className="progress-row" key={l.id} style={{ fontSize: 13 }}>
                <span>{l.email}<span className="meta"> ・{gymName(l.gymId ?? "")}</span></span>
                <span className={l.result === "success" ? "" : "field-error"} style={{ fontSize: 12 }}>
                  {l.result === "success" ? "成功" : "失敗"} / {fmtDateTime(l.createdAt)}
                </span>
              </div>
            ))}
          </div>

          {/* パスワード再設定（スタッフ含む誰でも。メール不要） */}
          <div className="card">
            <b>🔑 パスワード再設定（メール指定）</b>
            {sp.pw === "ok" && <div className="sig sig-green" style={{ marginTop: 4 }}>再設定しました。新しいパスワードを本人に伝えてください。</div>}
            {sp.pw === "short" && <div className="field-error" style={{ marginTop: 4 }}>パスワードは6文字以上にしてください。</div>}
            {sp.pw === "notfound" && <div className="field-error" style={{ marginTop: 4 }}>そのメールのアカウントが見つかりません。</div>}
            <form action={hqResetPasswordAction} style={{ marginTop: 6 }}>
              <label className="fl mt0" htmlFor="pwemail">アカウントのメールアドレス</label>
              <input id="pwemail" name="email" type="email" autoComplete="off" placeholder="例: staff@example.com" required />
              <label className="fl" htmlFor="pwnew">新しい仮パスワード（6文字以上）</label>
              <input id="pwnew" name="password" type="text" autoComplete="off" minLength={6} required />
              <div style={{ height: 8 }} />
              <SubmitButton className="btn btn-accent" pendingLabel="再設定中…">このアカウントのパスワードを再設定</SubmitButton>
            </form>
            <p className="info-note mt0">スタッフが自分のパスワードを忘れたときの最終手段。ここは全ジムのアカウントに効きます。</p>
          </div>

          <form action={hqLogoutAction}>
            <SubmitButton className="btn btn-dark" pendingLabel="…">本部からログアウト</SubmitButton>
          </form>
          <p className="center small" style={{ marginTop: 10 }}><Link href="/">← トップへ</Link></p>
        </>
      ) : (
        <>
          {sp.e && <div className="alert-band alert-red" style={{ marginTop: 12 }}>暗証番号が違います。</div>}
          <form action={hqVerifyAction} className="card" style={{ marginTop: 12 }}>
            <label className="fl mt0" htmlFor="code">暗証番号</label>
            <input id="code" name="code" type="password" inputMode="numeric" autoComplete="off" autoFocus placeholder="番号を入力" />
            <div style={{ height: 10 }} />
            <SubmitButton className="btn btn-accent" pendingLabel="確認中…">本部に入る</SubmitButton>
          </form>
          <p className="center small" style={{ marginTop: 10 }}><Link href="/">← トップへ戻る</Link></p>
        </>
      )}
    </div>
  );
}
