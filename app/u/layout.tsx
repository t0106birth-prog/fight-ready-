import { hqViewAsUserId } from "@/lib/unlock";
import { getDb } from "@/lib/store";

/**
 * 選手・会員ページの共通ラッパー。
 * 本部が「選手の画面を閲覧」モード中は、上部に読み取り専用バナーを常時表示する。
 * （書き込み自体は middleware で遮断済み。ここは見た目の明示のみ）
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const viewAs = await hqViewAsUserId();
  let name = "";
  if (viewAs) {
    const db = await getDb();
    name = db.users.find((u) => u.id === viewAs)?.name ?? "";
  }
  return (
    <>
      {viewAs && (
        <div
          style={{
            position: "sticky", top: 0, zIndex: 60,
            background: "#b26a00", color: "#fff",
            padding: "8px 12px", fontSize: 13, fontWeight: 700, textAlign: "center",
          }}
        >
          🔎 本部：{name || "選手"} の画面を閲覧中（読み取り専用・操作不可）
          <a href="/hq/exit-view" style={{ color: "#fff", textDecoration: "underline" }}>閲覧を終了</a>
        </div>
      )}
      {children}
    </>
  );
}
