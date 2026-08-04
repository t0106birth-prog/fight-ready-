import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentUser, canView } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { StaffTabbar, Hero } from "@/components/Nav";
import { StatusTile } from "@/components/StatusTile";
import { SigBadge } from "@/components/SigBadge";
import { statusTiles } from "@/lib/derive";
import { summarize } from "@/lib/staff";
import { dailyVerdict } from "@/lib/judge";
import { sportLabel, bodyPartLabel, LV3, SLUGGISH, SWEAT } from "@/lib/constants";
import { fmtDate, ageFrom } from "@/lib/calc";
import { followAction } from "@/app/staff/follow/actions";
import { ackUserAction, setUserRoleAction, resetUserPasswordAction } from "@/app/staff/actions";
import { SubmitButton } from "@/components/SubmitButton";

const FOLLOW_ACTIONS = ["連絡済み", "電話済み", "来館予定あり", "面談予定あり", "パーソナル体験案内済み", "パーソナル継続案内済み", "対応不要"];

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ acked?: string; role?: string; pw?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const staff = await currentUser();
  if (!staff) redirect("/login/staff");
  if (staff.role !== "staff") redirect("/u");
  if (!(await canView(staff, id))) notFound();
  const db = await getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) notFound();

  const tiles = statusTiles(db, user);
  const verdict = dailyVerdict(db, user);
  const s = summarize(db, user);
  const checks = db.dailyCheckins.filter((c) => c.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);
  const pains = db.painLogs.filter((p) => p.userId === id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const acts = [...db.activityLogs.filter((a) => a.userId === id).map((a) => ({ d: a.date, t: a.activityType, m: a.durationMinutes, sw: a.sweatLevel as string | undefined })),
    ...db.runningLogs.filter((r) => r.userId === id).map((r) => ({ d: r.date, t: `🏃${r.category}`, m: r.durationMinutes, sw: undefined as string | undefined }))]
    .sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8);
  const follows = db.followupLogs.filter((fl) => fl.userId === id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const lastAck = db.history.filter((h) => h.action === "staff_ack" && h.resource === id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  return (
    <>
      <Hero
        title={user.name}
        sub={[
          user.role === "pro" ? "選手" : "一般会員",
          sportLabel(user.primarySport),
          ageFrom(user.birthDate) != null ? `${ageFrom(user.birthDate)}歳` : null,
          user.heightCm ? `${user.heightCm}cm` : null,
        ].filter(Boolean).join("・")}
        backHref="/staff/users"
      />
      <div className="shell-wide">
        {sp.acked && <div className="alert-band alert-green"><b>✓</b> 確認しました（本人の画面に足跡が残ります）</div>}
        {sp.role && <div className="alert-band alert-green"><b>✓</b> 利用区分を「{sp.role === "pro" ? "選手" : "一般会員"}」に切り替えました</div>}
        <div className="row">
          <SigBadge level={verdict.level} />
          <span className="meta">{verdict.reasons.slice(0, 2).join(" / ")}</span>
        </div>

        {/* 確認した足跡（チャットは作らない。"見たよ"の足跡だけを本人に残す） */}
        <form action={ackUserAction} style={{ marginTop: 8 }}>
          <input type="hidden" name="userId" value={id} />
          <SubmitButton className="btn btn-green btn-sm" pendingLabel="確認中…" style={{ width: "100%" }}>👀 この人の記録を確認しました</SubmitButton>
        </form>
        {lastAck && <p className="info-note center" style={{ marginTop: 4 }}>最終確認：{fmtDate(lastAck.createdAt)}（本人に「チームが見守っています」と表示されます）</p>}

        {/* 利用区分の切替：試合に出る＝選手／出ない＝一般会員。ジム側が把握していることも多いのでここから切替可 */}
        <div className="card tight" style={{ marginTop: 8 }}>
          <div className="row">
            <span className="meta">利用区分</span>
            <b>{user.role === "pro" ? "🥊 選手" : "一般会員"}</b>
          </div>
          <form action={setUserRoleAction} style={{ marginTop: 6 }}>
            <input type="hidden" name="userId" value={id} />
            <input type="hidden" name="role" value={user.role === "pro" ? "member" : "pro"} />
            <SubmitButton className="btn btn-dark btn-sm" pendingLabel="切替中…" style={{ width: "100%" }}>
              {user.role === "pro" ? "一般会員に切り替える" : "選手に切り替える（試合に出る）"}
            </SubmitButton>
          </form>
          <p className="info-note mt0">選手にすると計量・水抜きモニタリングが解放されます。一般に戻すと試合予定は消えます（過去の記録は残ります）。</p>
        </div>

        {/* パスワード再設定（本人がパスワードを忘れたとき。メール不要） */}
        <div className="card tight" style={{ marginTop: 8 }}>
          <b>🔑 パスワード再設定</b>
          {sp.pw === "ok" && <div className="sig sig-green" style={{ marginTop: 4 }}>再設定しました。新しいパスワードを本人に伝えてください。</div>}
          {sp.pw === "short" && <div className="field-error" style={{ marginTop: 4 }}>パスワードは6文字以上にしてください。</div>}
          {sp.pw === "notfound" && <div className="field-error" style={{ marginTop: 4 }}>この利用者には再設定できませんでした。</div>}
          <form action={resetUserPasswordAction} style={{ marginTop: 6 }}>
            <input type="hidden" name="userId" value={id} />
            <input name="password" type="text" autoComplete="off" placeholder="新しい仮パスワード（6文字以上）" minLength={6} required />
            <div style={{ height: 8 }} />
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel="再設定中…" style={{ width: "100%" }}>この人のパスワードを再設定</SubmitButton>
          </form>
          <p className="info-note mt0">本人がログインできなくなったとき用。設定した仮パスワードを伝え、後で本人に変更してもらってください。</p>
        </div>

        <p className="kicker">今日の状態</p>
        <div className="status-grid">{tiles.map((t) => <StatusTile key={t.lbl} tile={t} />)}</div>

        {user.role === "pro" && s.waterCutPct != null && (
          <div className="alert-band alert-yellow" style={{ marginTop: 8 }}>
            <b>水抜き -{s.waterCutPct}%</b> — <Link href="/staff/users?f=watercut">水抜き中の選手</Link>
          </div>
        )}

        <div className="grid2" style={{ marginTop: 8 }}>
          <div className="card tight">
            <b>最近の今日のチェック</b>
            {checks.map((c) => (
              <div className="progress-row" key={c.id} style={{ fontSize: 13 }}>
                <span>{fmtDate(c.date)}</span>
                <span>{c.weight ?? "—"}kg / 疲{LV3[c.fatigueLevel ?? ""] ?? "—"} / だ{SLUGGISH[c.sluggishnessLevel ?? ""] ?? "—"}</span>
              </div>
            ))}
            {checks.length === 0 && <p className="meta mt0">記録なし</p>}
          </div>
          <div className="card tight">
            <b>最近の運動</b>
            {acts.map((a, i) => (
              <div className="progress-row" key={i} style={{ fontSize: 13 }}><span>{fmtDate(a.d)}</span><span>{a.t} {a.m}分{a.sw ? ` / 汗${SWEAT[a.sw]}` : ""}</span></div>
            ))}
            {acts.length === 0 && <p className="meta mt0">記録なし</p>}
          </div>
        </div>

        {pains.length > 0 && (
          <div className="card tight">
            <b>痛みの記録</b>
            {pains.map((p) => (
              <div className="progress-row" key={p.id} style={{ fontSize: 13 }}>
                <span>{fmtDate(p.date)} {bodyPartLabel(p.locationId)}</span>
                <span>強さ{p.painLevel} / {p.newOrContinuing === "continuing" ? "継続" : "新規"}</span>
              </div>
            ))}
          </div>
        )}

        {/* フォロー対応の記録(§42) */}
        <p className="kicker">フォロー対応</p>
        <form action={followAction} className="card">
          <input type="hidden" name="userId" value={id} />
          <label className="fl">対応状況を記録（チャットは作りません・対応状況のみ保存）</label>
          <select name="action" defaultValue={FOLLOW_ACTIONS[0]}>
            {FOLLOW_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="fl" htmlFor="note">メモ（任意）</label>
          <input id="note" name="note" type="text" />
          <div style={{ height: 10 }} />
          <SubmitButton className="btn btn-primary btn-sm" pendingLabel="保存中…" style={{ width: "100%" }}>記録する</SubmitButton>
        </form>
        {follows.length > 0 && (
          <div className="card tight">
            {follows.map((fl) => (
              <div className="progress-row" key={fl.id} style={{ fontSize: 13 }}>
                <span>{fmtDate(fl.createdAt.slice(0, 10))} {fl.action}</span>
                <span className="meta">{fl.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <StaffTabbar active="users" />
    </>
  );
}
