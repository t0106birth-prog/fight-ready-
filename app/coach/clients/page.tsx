import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { coachWorkspaces, coachClients, SCOPE_LABEL } from "@/lib/coach";

/** 担当顧客一覧（Phase 1・隠し・読み取り専用）。 */
export default async function CoachClients() {
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  if (coachWorkspaces(db, user.id).length === 0) redirect("/u");

  const clients = coachClients(db, user.id);

  return (
    <>
      <Hero title="担当顧客" sub="COACH MODE" backHref="/coach" />
      <div className="shell">
        {clients.length === 0 && (
          <div className="card"><p className="mt0 meta">まだ担当顧客がいません。招待から追加できます（招待機能は準備中）。</p></div>
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
