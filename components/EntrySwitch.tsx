"use client";
import { useState } from "react";

export function EntrySwitch({ login, signup }: { login: React.ReactNode; signup: React.ReactNode }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  return (
    <>
      <div className="switch" role="tablist" aria-label="入口の切り替え">
        <button type="button" role="tab" aria-selected={tab === "login"} className={tab === "login" ? "on" : ""} onClick={() => setTab("login")}>
          ログイン
        </button>
        <button type="button" role="tab" aria-selected={tab === "signup"} className={tab === "signup" ? "on" : ""} onClick={() => setTab("signup")}>
          はじめての方
        </button>
      </div>
      <div>{tab === "login" ? login : signup}</div>
    </>
  );
}
