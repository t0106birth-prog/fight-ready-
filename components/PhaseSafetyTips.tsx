"use client";

import { useState } from "react";
import { WATER_CUT_TIPS, type TipPhase } from "@/lib/waterCutTips";

/**
 * 計量準備「今日のポイント」。現在フェーズの安全案内だけを表示する。
 * ・最初は important の項目（なければ先頭2件）、「すべて見る」で残りを展開（スマホでコンパクト）。
 * ・赤警告(redWarning)がある場合は通常ポイントより上に表示する。
 */
export function PhaseSafetyTips({ phase, redWarning }: { phase: TipPhase; redWarning?: string | null }) {
  const [open, setOpen] = useState(false);
  const tips = WATER_CUT_TIPS[phase] ?? [];
  const primary = tips.filter((t) => t.important);
  const collapsed = primary.length ? primary : tips.slice(0, 2);
  const shown = open ? tips : collapsed;
  const remaining = tips.length - collapsed.length;

  if (!tips.length && !redWarning) return null;

  return (
    <div className="card tight">
      <p className="kicker mt0">今日のポイント</p>
      {redWarning && (
        <div className="alert-band alert-red" style={{ margin: "0 0 10px" }}>
          <div className="at">⚠️ 危険域の警告</div>
          {redWarning}
        </div>
      )}
      <ul style={{ margin: 0, paddingLeft: "1.1em" }}>
        {shown.map((t, i) => (
          <li key={i} style={{ marginBottom: 6, fontSize: 13, lineHeight: 1.5, fontWeight: t.important ? 700 : 400 }}>{t.text}</li>
        ))}
      </ul>
      {remaining > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setOpen((v) => !v)}>
          {open ? "閉じる" : `すべて見る（+${remaining}）`}
        </button>
      )}
    </div>
  );
}
