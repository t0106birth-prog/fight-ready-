"use client";
import { useEffect, useState } from "react";

/** サーバーから ?e= で返ったエラー。入力し直すか ✕ で消える。 */
export function Notice({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const hide = () => setShown(false);
    document.addEventListener("input", hide, { once: true });
    return () => document.removeEventListener("input", hide);
  }, []);
  if (!shown) return null;
  return (
    <div className="notice" role="alert">
      <button type="button" className="tip-close" onClick={() => setShown(false)} aria-label="閉じる">✕</button>
      {children}
    </div>
  );
}
