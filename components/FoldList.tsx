import { Children } from "react";

/**
 * リストを「先頭 show 件だけ表示し、残りは折りたたむ」共通ラッパー。
 * <details> はネイティブHTMLなのでクライアントJS不要（サーバーコンポーネントでも動く）。
 */
export function FoldList({
  children,
  show = 3,
  moreLabel,
}: {
  children: React.ReactNode;
  show?: number;
  moreLabel?: (n: number) => string;
}) {
  const rows = Children.toArray(children);
  const head = rows.slice(0, show);
  const rest = rows.slice(show);
  return (
    <>
      {head}
      {rest.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary className="meta" style={{ cursor: "pointer" }}>{moreLabel ? moreLabel(rest.length) : `ほかにも ${rest.length} 件を表示`}</summary>
          <div style={{ marginTop: 4 }}>{rest}</div>
        </details>
      )}
    </>
  );
}
