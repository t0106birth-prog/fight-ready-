"use client";

import { useRef, useState } from "react";
import { quickUnlockAction } from "@/app/login/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * 隠し扉②：「アプリのように使う」を2回タップ → 暗証番号(QUICK_CODE)入力 → かんたんログイン解錠。
 * 見た目は普通の説明カード。2回タップで暗証番号の入力欄が出る。
 */
export function AppUsageDoor() {
  const [showCode, setShowCode] = useState(false);
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTap = () => {
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (taps.current >= 2) {
      taps.current = 0;
      setShowCode(true);
      return;
    }
    timer.current = setTimeout(() => { taps.current = 0; }, 700);
  };

  return (
    <>
      <p className="kicker" onClick={onTap} style={{ userSelect: "none" }}>アプリのように使う</p>
      <div className="card" onClick={onTap} style={{ userSelect: "none" }}>
        <p className="small mt0">ホーム画面に追加すると、次からアプリのように全画面で開けます。</p>
        <p className="small" style={{ marginBottom: 4 }}><b>iPhone</b>（Safari）: 共有ボタン → 「ホーム画面に追加」</p>
        <p className="small" style={{ marginBottom: 0 }}><b>Android</b>（Chrome）: ⋮メニュー → 「インストール」</p>
      </div>

      {showCode && (
        <form action={quickUnlockAction} className="card" style={{ marginTop: 8, borderColor: "var(--line)" }}>
          <label className="fl mt0" htmlFor="qcode">暗証番号</label>
          <input id="qcode" name="code" type="password" inputMode="numeric" autoComplete="off" autoFocus placeholder="番号を入力" />
          <div style={{ height: 8 }} />
          <SubmitButton className="btn btn-dark btn-sm" pendingLabel="確認中…">かんたんログインを表示</SubmitButton>
        </form>
      )}
    </>
  );
}
