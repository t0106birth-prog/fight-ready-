import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { workspaceByInviteCode } from "@/lib/coach";
import { joinCoachAction } from "./actions";
import type { CoachScope } from "@/lib/types";

const SCOPES: { key: CoachScope; label: string }[] = [
  { key: "weight", label: "体重" },
  { key: "activity", label: "運動" },
  { key: "nutrition", label: "食事の達成度" },
  { key: "condition", label: "コンディション（疲労・睡眠）" },
  { key: "pain", label: "痛み" },
];

/**
 * 招待コードでコーチに参加する同意画面（Phase 2）。
 * 参加前に「スペース名・担当コーチ名・共有する範囲・参加後に見える情報」を提示し、
 * 本人が「参加する」を押して初めて共有が始まる。
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect("/login/user");
  const db = await getDb();
  const ws = workspaceByInviteCode(db, code);
  const coach = ws ? db.users.find((u) => u.id === ws.ownerId) : null;
  const isOwner = ws?.ownerId === user.id;
  const already = ws
    ? db.coachAssignments.find((a) => a.workspaceId === ws.id && a.clientUserId === user.id && a.status === "active")
    : null;

  return (
    <>
      <Hero title="コーチに参加" sub="招待の確認" backHref="/u" />
      <div className="shell">
        {!ws && (
          <div className="card"><p className="mt0">この招待コードは無効か、受付を終了しています。コーチにもう一度リンクを教えてもらってください。</p>
            <Link href="/u" className="btn btn-ghost" style={{ marginTop: 8 }}>ホームへ</Link>
          </div>
        )}

        {ws && isOwner && (
          <div className="card"><p className="mt0">これはあなた自身のパーソナルスペースです。</p>
            <Link href="/coach" className="btn btn-primary" style={{ marginTop: 8 }}>コーチモードを開く</Link>
          </div>
        )}

        {ws && !isOwner && already && (
          <div className="card"><p className="mt0"><b>すでに参加済みです。</b> あなたの記録は担当コーチと共有されています。</p>
            <Link href="/u" className="btn btn-ghost" style={{ marginTop: 8 }}>ホームへ</Link>
          </div>
        )}

        {ws && !isOwner && !already && (
          <>
            <div className="card">
              <p className="mt0" style={{ fontWeight: 700, fontSize: 16 }}>{ws.name}</p>
              <div className="progress-row"><span className="meta">担当コーチ</span><b>{coach?.name ?? "—"}</b></div>
              <p className="info-note" style={{ marginBottom: 0 }}>
                参加すると、あなたが選んだ範囲の記録を担当コーチが「閲覧」できます。コーチがあなたの記録を書き換えることはありません。参加はいつでも見直せます。
              </p>
            </div>

            <form action={joinCoachAction}>
              <input type="hidden" name="code" value={ws.inviteCode} />
              <p className="kicker">共有する範囲を選ぶ</p>
              <div className="card">
                {SCOPES.map((s) => (
                  <label key={s.key} className="check">
                    <input type="checkbox" name={`scope_${s.key}`} defaultChecked />
                    {s.label}
                  </label>
                ))}
                <p className="info-note" style={{ marginBottom: 0 }}>チェックを外した項目はコーチに共有されません。</p>
              </div>
              <div style={{ height: 8 }} />
              <SubmitButton className="btn btn-primary" pendingLabel="参加しています…" style={{ width: "100%" }}>
                この内容で参加する
              </SubmitButton>
              <p className="info-note center">参加を押すまで、コーチにあなたの記録は共有されません。</p>
            </form>
          </>
        )}
      </div>
    </>
  );
}
