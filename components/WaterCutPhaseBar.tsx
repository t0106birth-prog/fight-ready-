import { Fragment } from "react";
import type { WaterCutPhase } from "@/lib/derive";

const PHASES: { key: string; label: string; icon: string }[] = [
  { key: "loading", label: "ローディング", icon: "🥤" },
  { key: "cut", label: "水抜き", icon: "💧" },
  { key: "weighin", label: "計量", icon: "⚖️" },
];

/** 計量までの進行バー（ローディング→水抜き→計量）。回復は計量後の別導線。 */
export function WaterCutPhaseBar({ phase }: { phase: WaterCutPhase }) {
  const curIdx = phase === "done" || phase === "recovery" ? PHASES.length : ["loading", "cut", "weighin"].indexOf(phase);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", margin: "6px 0 10px" }}>
      {PHASES.map((p, i) => {
        const done = phase === "done" || phase === "recovery" || i < curIdx;
        const cur = phase !== "done" && phase !== "recovery" && i === curIdx;
        const color = cur ? "var(--blue)" : done ? "var(--green-bright)" : "var(--muted)";
        return (
          <Fragment key={p.key}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 66, flex: "0 0 auto" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: cur ? "var(--blue-soft)" : done ? "var(--green-soft)" : "var(--surface2)",
                border: `2px solid ${cur ? "var(--blue)" : done ? "var(--green)" : "var(--line)"}`,
                color, fontSize: 13, fontWeight: 800,
              }}>{done ? "✓" : p.icon}</div>
              <div style={{ fontSize: 11, marginTop: 5, textAlign: "center", color, fontWeight: cur ? 800 : 600, lineHeight: 1.25 }}>
                {p.label}{cur && <><br /><span style={{ fontSize: 10 }}>今ここ</span></>}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div style={{ flex: 1, height: 2, background: (phase === "done" || phase === "recovery" || i < curIdx) ? "var(--green)" : "var(--line)", marginTop: 15 }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
