import Link from "next/link";
import { hasUnlock } from "@/lib/unlock";
import { getDb } from "@/lib/store";
import { sportLabel } from "@/lib/constants";
import { dailyVerdict } from "@/lib/judge";
import { fmtDateTime } from "@/lib/calc";
import { SigBadge } from "@/components/SigBadge";
import { hqVerifyAction, hqLogoutAction, hqResetPasswordAction, hqToggleGymAction, hqDeleteGymAction, hqGrantCoachAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 本部（HQ）管理ページ。暗証番号で解錠すると、全ジムと利用者の紐づけ一覧＋選手の中身を閲覧できる（簡易版）。
 */
export default async function HqPage({ searchParams }: { searchParams: Promise<{ e?: string; pw?: string; gymdel?: string; coach?: string }> }) {
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
  // 「最近ログインした利用者」＝利用者ごとに最新1件にまとめる（同じ人の連続ログインで埋まらない＝誰が入ったか一目）
  const usersByEmail = new Map((db?.users ?? []).map((u) => [u.email, u] as const));
  const lastLoginByEmail = new Map<string, { email: string; at: string; result: string }>();
  for (const l of db?.logins ?? []) lastLoginByEmail.set(l.email, { email: l.email, at: l.createdAt, result: l.result });
  const recentLogins = [...lastLoginByEmail.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 20);
  const roleJa = (r?: string) => (r === "pro" ? "選手" : r === "member" ? "一般会員" : r === "staff" ? "スタッフ" : "—");
  // どのジムにも属していない選手/会員（登録時に「なし」を選んだ人）
  const unaffiliated = activeUsers.filter((u) => (u.role === "pro" || u.role === "member") && !gyms.some((g) => g.id === u.gymId));
  // 停止中の選手/会員（active一覧から外れるので、再開できるよう別枠で出す）
  const suspendedUsers = db ? db.users.filter((u) => u.status !== "active" && (u.role === "pro" || u.role === "member")) : [];

  return (
    <div className="shell">
      <div className="brand-hero">
        <div className="brand-logo">FIGHT <span className="r">READY</span></div>
        <div className="brand-tag">本部管理（HQ）</div>
      </div>

      {unlocked ? (
        <>
          <div className="alert-band alert-green" style={{ marginTop: 12 }}><b>🔓 解錠しました</b> — 本部管理ページ</div>
          {sp.gymdel === "1" && <div className="alert-band alert-green">ジムを削除しました。</div>}
          {sp.gymdel === "blocked" && <div className="alert-band alert-yellow">選手・会員が紐付いているジムは削除できません。先に別ジムへ移すか無所属にしてください。</div>}
          {sp.coach === "granted" && <div className="alert-band alert-green"><b>✓ パーソナルコーチ権限を付与しました。</b> 対象の方はホームに「🧑‍🏫 パーソナルコーチモード」が出ます（再読み込み）。</div>}
          {sp.coach === "notfound" && <div className="alert-band alert-yellow">そのメールの利用者が見つかりませんでした（active な選手・会員のメールを入力してください）。</div>}

          {/* パーソナルコーチ権限の付与（初期オンボーディング/デモ用） */}
          <p className="kicker">パーソナルコーチ権限</p>
          <form action={hqGrantCoachAction} className="card tight">
            <p className="info-note mt0">指定メールの利用者に「パーソナルコーチ」権限（個人スペース＋owner/coach）を付与します。担当顧客は招待から追加します。</p>
            <label className="fl" htmlFor="coachEmail">メールアドレス</label>
            <input id="coachEmail" name="email" type="email" placeholder="例：coach@example.com" required />
            <div style={{ height: 8 }} />
            <SubmitButton className="btn btn-primary" pendingLabel="付与しています…" style={{ width: "100%" }}>コーチ権限を付与する</SubmitButton>
          </form>

          {/* 全体サマリ（各項目をタップすると一覧が開く） */}
          <p className="kicker">全体（タップで一覧）</p>

          <details className="card tight">
            <summary style={{ cursor: "pointer" }}><b>ジム</b><span className="meta">　{gyms.length}　▾</span></summary>
            <div style={{ marginTop: 8 }}>
              {gyms.length === 0 ? <p className="meta mt0">ジムはありません。</p> : gyms.map((g) => {
                const us = activeUsers.filter((u) => u.gymId === g.id);
                return (
                  <div key={g.id} className="progress-row">
                    <span>{g.name}<span className="meta"> ・{g.code}{g.suspended ? " ・停止中" : ""}</span></span>
                    <b className="meta">選手{us.filter((u) => u.role === "pro").length}／会員{us.filter((u) => u.role === "member").length}</b>
                  </div>
                );
              })}
            </div>
          </details>

          <details className="card tight">
            <summary style={{ cursor: "pointer" }}><b>選手</b><span className="meta">　{proTotal}　▾</span></summary>
            <div style={{ marginTop: 8 }}>
              {proTotal === 0 ? <p className="meta mt0">選手はいません。</p> : activeUsers.filter((u) => u.role === "pro").map((u) => (
                <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)" }}>
                  <span>{u.name}<span className="meta"> ・{gymName(u.gymId)}</span></span>
                  <span className="meta">›</span>
                </Link>
              ))}
            </div>
          </details>

          <details className="card tight">
            <summary style={{ cursor: "pointer" }}><b>一般会員</b><span className="meta">　{memberTotal}　▾</span></summary>
            <div style={{ marginTop: 8 }}>
              {memberTotal === 0 ? <p className="meta mt0">一般会員はいません。</p> : activeUsers.filter((u) => u.role === "member").map((u) => (
                <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)" }}>
                  <span>{u.name}<span className="meta"> ・{gymName(u.gymId)}</span></span>
                  <span className="meta">›</span>
                </Link>
              ))}
            </div>
          </details>

          <details className="card tight">
            <summary style={{ cursor: "pointer" }}><b>スタッフ</b><span className="meta">　{staffTotal}　▾</span></summary>
            <div style={{ marginTop: 8 }}>
              {staffTotal === 0 ? <p className="meta mt0">スタッフはいません。</p> : activeUsers.filter((u) => u.role === "staff").map((u) => (
                <div key={u.id} className="progress-row">
                  <span>{u.name}<span className="meta"> ・{gymName(u.gymId)}</span></span>
                </div>
              ))}
            </div>
          </details>

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
                  <span style={{ display: "flex", gap: 6, flex: "none" }}>
                    <form action={hqToggleGymAction}>
                      <input type="hidden" name="gymId" value={g.id} />
                      <SubmitButton className={`btn-sm ${g.suspended ? "btn-green" : "btn-dark"}`} pendingLabel="…">
                        {g.suspended ? "再開する" : "停止する"}
                      </SubmitButton>
                    </form>
                    {athletes.length === 0 && (
                      <form action={hqDeleteGymAction}>
                        <input type="hidden" name="gymId" value={g.id} />
                        <SubmitButton className="btn-sm btn-accent" pendingLabel="…">削除</SubmitButton>
                      </form>
                    )}
                  </span>
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

          {/* 無所属（未紐付け）の選手/会員。タップで詳細→ジムに紐付け可能 */}
          {unaffiliated.length > 0 && (
            <>
              <p className="kicker">無所属（未紐付け）</p>
              <div className="card">
                <p className="meta mt0">{unaffiliated.length}名 — タップして詳細から「ジムに紐付け」できます。</p>
                {unaffiliated.map((u) => (
                  <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)", borderTop: "1px solid var(--line)" }}>
                    <span>{u.role === "pro" ? "🥊" : "💪"} {u.name}<span className="meta"> ・{sportLabel(u.primarySport)}</span></span>
                    <span className="meta">›</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* 停止中のアカウント（再開できるよう別枠） */}
          {suspendedUsers.length > 0 && (
            <>
              <p className="kicker">停止中のアカウント</p>
              <div className="card">
                {suspendedUsers.map((u) => (
                  <Link key={u.id} href={`/hq/user/${u.id}`} className="progress-row" style={{ textDecoration: "none", color: "var(--ink)", borderTop: "1px solid var(--line)" }}>
                    <span>⛔ {u.name}<span className="meta"> ・{gymName(u.gymId)}</span></span>
                    <span className="meta">›</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* 最近ログインした利用者（全ジム横断・利用者ごとに最新1件）。3件だけ表示し、残りは折りたたむ。 */}
          <p className="kicker">最近ログインした利用者</p>
          <div className="card tight">
            {recentLogins.length === 0 && <p className="meta mt0">記録なし</p>}
            {recentLogins.slice(0, 3).map((l) => {
              const u = usersByEmail.get(l.email);
              return (
                <div className="progress-row" key={l.email} style={{ fontSize: 13 }}>
                  <span>{u?.name ?? l.email}<span className="meta"> ・{roleJa(u?.role)}{u ? ` ・${gymName(u.gymId)}` : ""}</span></span>
                  <span className={l.result === "success" ? "" : "field-error"} style={{ fontSize: 12 }}>
                    {l.result === "success" ? "成功" : "失敗"} / {fmtDateTime(l.at)}
                  </span>
                </div>
              );
            })}
            {recentLogins.length > 3 && (
              <details style={{ marginTop: 4 }}>
                <summary className="meta" style={{ cursor: "pointer" }}>ほかにも {recentLogins.length - 3} 人を表示</summary>
                <div style={{ marginTop: 4 }}>
                  {recentLogins.slice(3).map((l) => {
                    const u = usersByEmail.get(l.email);
                    return (
                      <div className="progress-row" key={l.email} style={{ fontSize: 13 }}>
                        <span>{u?.name ?? l.email}<span className="meta"> ・{roleJa(u?.role)}{u ? ` ・${gymName(u.gymId)}` : ""}</span></span>
                        <span className={l.result === "success" ? "" : "field-error"} style={{ fontSize: 12 }}>
                          {l.result === "success" ? "成功" : "失敗"} / {fmtDateTime(l.at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
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
