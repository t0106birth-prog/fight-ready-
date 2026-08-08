"use client";

import { useState } from "react";
import { quickLoginAction } from "@/app/login/actions";

type QuickAccount = { email: string; label: string; desc: string; ico: string };

/**
 * 隠し扉：「アプリのように使う（おすすめ）」の先頭にある小さなアプリ風アイコンを押すと、
 * 暗証番号なしで「かんたんログイン」ボタンが出る（デモ用の架空アカウント）。
 */
export function AppUsageDoor({ accounts }: { accounts: QuickAccount[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <p className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          onClick={() => setOpen((v) => !v)}
          role="button"
          aria-label="かんたんログイン"
          title="かんたんログイン"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, borderRadius: 5, background: "#6c5ce7", color: "#fff",
            fontSize: 12, lineHeight: 1, cursor: "pointer", userSelect: "none", flex: "none",
          }}
        >▦</span>
        アプリのように使う（おすすめ）
      </p>
      {/* ホーム画面への追加手順は上部の「📲 ホーム画面に追加する方法」に集約（重複回避） */}

      {open && (
        <div className="quick-panel" style={{ marginTop: 8 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>かんたんログイン（お試し用）</b>
            <span className="badge badge-attn">試作版</span>
          </div>
          <p className="info-note" style={{ marginTop: 0 }}>パスワードなしでサンプル画面を確認できます（データはすべて架空）。</p>
          {accounts.map((a) => (
            <form action={quickLoginAction} key={a.email}>
              <input type="hidden" name="email" value={a.email} />
              <button type="submit" className="quick-btn">
                <span className="q-ico">{a.ico}</span>
                <span><span className="q-t">{a.label}</span><span className="q-d">{a.desc}</span></span>
              </button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
