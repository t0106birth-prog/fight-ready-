import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, coachClients, SCOPE_LABEL } from "@/lib/coach";

/** 担当顧客一覧＋招待（Phase 2・読み取り専用）。 */
export default async function CoachClients() {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  const spaces = coachWorkspaces(db, user.id);
  if (spaces.length === 0) redirect("/u");
  const ws = spaces[0];

  const clients = coachClients(db, user.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const joinUrl = `${proto}://${host}/join/${ws.inviteCode}`;

  return (
    <>
      <Hero title="担当顧客" sub="COACH MODE" backHref="/coach" />
      <div className="shell">
        {/* 顧客を招待（この一覧の上に置く＝よく使うため） */}
        <div className="card" style={{ borderColor: "var(--blue)" }}>
          <div className="row"><b>＋ 顧客を招待</b><span className="meta">{ws.name}</span></div>
          <p className="info-note mt0">下のリンク（または招待コード）を顧客に伝えてください。顧客は<b>共有する範囲を自分で選んで「参加する」を押す</b>と、担当顧客になります。</p>
          <label className="fl">招待リンク</label>
          <input readOnly value={joinUrl} style={{ width: "100%" }} />
          <div className="progress-row" style={{ marginTop: 8 }}><span className="meta">招待コード</span><b style={{ letterSpacing: ".08em" }}>{ws.inviteCode}</b></div>
        </div>

        <p className="kicker">担当顧客（{clients.length}名）</p>
        {clients.length === 0 && (
          <div className="card"><p className="mt0 meta">まだ担当顧客がいません。上の招待リンクを共有すると、参加した人がここに表示されます。</p></div>
        )}
        {clients.map(({ user: c, assignment }) => (
          <Link key={c.id} href={`/coach/client/${c.id}`} className="todo-item">
            <span className="tk" style={{ fontSize: 18 }}>🧑</span>
            <span className="tt">
              {c.name}
              <br />
              <span className="meta" style={{ fontWeight: 400 }}>
                共有: {assignment.sharedScopes.map((s) => SCOPE_LABEL[s]).join("・") || "なし"}
              </span>
            </span>
            <span className="ta">›</span>
          </Link>
        ))}
        <p className="info-note center" style={{ marginTop: 16 }}>
          <Link href="/coach">← コーチのトップへ</Link>
        </p>
      </div>
    </>
  );
}
