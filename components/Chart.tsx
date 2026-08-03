"use client";

import { useState } from "react";
import { fmtDate, fmtDateFull } from "@/lib/calc";

export interface CPoint { d: string; y: number }
export interface CMarker { d: string; label: string; color?: string }

/**
 * タップで値を確認できる折れ線グラフ（体重用）。外部ライブラリ不使用。
 * plan: 予定体重線（破線）。band: 単一期間の背景帯。
 * loadingBand / cutBand: 計量準備グラフでローディングと水抜きを分けて表示する背景帯。
 */
export function LineChart({
  points, plan, markers, band, loadingBand, cutBand, hLine, startY, unit = "kg", label = "体重", color = "#ff5348", height = 230,
}: {
  points: CPoint[];
  plan?: CPoint[];
  markers?: CMarker[];
  band?: { from: string; to: string } | null;
  loadingBand?: { from: string; to: string } | null;
  cutBand?: { from: string; to: string } | null;
  hLine?: { y: number; label: string } | null;
  startY?: number; // 指定するとタップ吹き出しに「スタートから ±◯kg」を出す（一般会員向け）
  unit?: string;
  label?: string;
  color?: string;
  height?: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 720, H = height * 2, PAD = { l: 64, r: 20, t: 24, b: 44 };
  if (points.length === 0) return <p className="meta center">まだ記録がありません。</p>;

  const ts = (d: string) => new Date(d).getTime();
  const all = [...points.map((p) => p.d), ...(plan ?? []).map((p) => p.d), ...(markers ?? []).map((m) => m.d)];
  let tMin = Math.min(...all.map(ts)), tMax = Math.max(...all.map(ts));
  if (tMin === tMax) { tMin -= 86400000 * 10; tMax += 86400000 * 10; }
  const ys = [...points.map((p) => p.y), ...(plan ?? []).map((p) => p.y)];
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = Math.max((yMax - yMin) * 0.2, 0.8);
  yMin -= pad; yMax += pad;
  const X = (d: string) => PAD.l + ((ts(d) - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const sorted = points.slice().sort((a, b) => ts(a.d) - ts(b.d));
  const line = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.d).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const planSorted = (plan ?? []).slice().sort((a, b) => ts(a.d) - ts(b.d));
  const planLine = planSorted.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.d).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const yTicks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * (i + 0.5)) / 4);

  const pickAt = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    sorted.forEach((p, i) => { const d = Math.abs(X(p.d) - px); if (d < bd) { bd = d; best = i; } });
    setSel(best);
  };
  const selP = sel != null ? sorted[sel] : null;
  const tipLeft = selP ? Math.min(88, Math.max(12, (X(selP.d) / W) * 100)) : 0;

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i style={{ background: color }} /> 実際の{label}</span>
        {plan && plan.length > 0 && <span><i style={{ background: "#93a1b5" }} /> 予定線</span>}
        {hLine && <span style={{ color: "var(--amber-ink)", fontWeight: 800 }}><i style={{ background: "var(--amber)", height: 5 }} /> {hLine.label}</span>}
        {band && <span><i style={{ background: "rgba(61,139,240,.3)" }} /> 水抜き期間</span>}
        {loadingBand && <span><i style={{ background: "rgba(61,139,240,.55)", height: 8 }} /> ローディング期間</span>}
        {cutBand && <span><i style={{ background: "rgba(226,59,50,.55)", height: 8 }} /> 水抜き期間</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, touchAction: "pan-y" }}
        role="img" aria-label={`${label}のグラフ。タップで各日の値を表示。`}
        onPointerDown={(e) => pickAt(e.clientX, e.currentTarget)}
        onPointerMove={(e) => { if (e.buttons === 1 || e.pointerType === "touch") pickAt(e.clientX, e.currentTarget); }}>
        {band && (
          <rect x={X(band.from)} y={PAD.t} width={Math.max(2, X(band.to) - X(band.from))} height={H - PAD.t - PAD.b} fill="rgba(61,139,240,.16)" />
        )}
        {loadingBand && (
          <rect x={X(loadingBand.from)} y={PAD.t} width={Math.max(2, X(loadingBand.to) - X(loadingBand.from))} height={H - PAD.t - PAD.b} fill="rgba(61,139,240,.13)" />
        )}
        {cutBand && (
          <rect x={X(cutBand.from)} y={PAD.t} width={Math.max(2, X(cutBand.to) - X(cutBand.from))} height={H - PAD.t - PAD.b} fill="rgba(226,59,50,.12)" />
        )}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth="1.2" />
            <text x={PAD.l - 8} y={Y(v) + 5} textAnchor="end" fontSize="19" fill="var(--muted)">{Math.round(v * 10) / 10}</text>
          </g>
        ))}
        {/* 目標体重の横線（一目で「あと何kg」が分かるように） */}
        {hLine && hLine.y >= yMin && hLine.y <= yMax && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(hLine.y)} y2={Y(hLine.y)} stroke="var(--amber)" strokeWidth="4.5" strokeDasharray="12 6" />
            <rect x={W - PAD.r - 194} y={Y(hLine.y) - 35} width="190" height="30" rx="7" fill="var(--amber-soft)" stroke="var(--amber)" strokeWidth="1.5" />
            <text x={W - PAD.r - 12} y={Y(hLine.y) - 13} textAnchor="end" fontSize="22" fontWeight="800" fill="var(--amber-ink)">{hLine.label}</text>
          </g>
        )}
        {/* 日付マーカー（目標日・計量・試合）。近い日付はラベルを縦にずらして重ならないようにする */}
        {(() => {
          const sorted = (markers ?? []).map((m) => ({ ...m, x: X(m.d) })).sort((a, b) => a.x - b.x);
          let prevX = -999, row = 0;
          return sorted.map((mk, i) => {
            if (mk.x - prevX < 90) row += 1; else row = 0;
            prevX = mk.x;
            const anchor = mk.x > W - 130 ? "end" : mk.x < PAD.l + 60 ? "start" : "middle";
            const ly = PAD.t + 18 + row * 26;
            const tx = mk.x + (anchor === "end" ? -6 : anchor === "start" ? 6 : 0);
            return (
              <g key={i}>
                <line x1={mk.x} x2={mk.x} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.65" />
                <text x={tx} y={ly} textAnchor={anchor} fontSize="16" fontWeight="700" fill={mk.color ?? "var(--muted)"}>{mk.label}</text>
              </g>
            );
          });
        })()}
        {planLine && <path d={planLine} fill="none" stroke="#93a1b5" strokeWidth="3.5" strokeDasharray="10 7" strokeLinecap="round" />}
        {selP && <line x1={X(selP.d)} x2={X(selP.d)} y1={PAD.t} y2={H - PAD.b} stroke={color} strokeWidth="2.5" strokeOpacity="0.4" />}
        <path d={line} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {sorted.map((p, i) => (
          <circle key={i} cx={X(p.d)} cy={Y(p.y)} r={sel === i ? 12 : 7} fill={sel === i ? color : "var(--surface)"} stroke={color} strokeWidth="4" />
        ))}
        <text x={PAD.l - 8} y={PAD.t - 6} textAnchor="end" fontSize="18" fill="var(--muted)">{unit}</text>
        {sorted.length === 1 ? (
          <text x={X(sorted[0].d)} y={H - 12} textAnchor="middle" fontSize="20" fill="var(--muted)">{fmtDate(sorted[0].d)}</text>
        ) : (
          <>
            <text x={X(sorted[0].d)} y={H - 12} textAnchor="start" fontSize="20" fill="var(--muted)">{fmtDate(sorted[0].d)}</text>
            <text x={X(sorted[sorted.length - 1].d)} y={H - 12} textAnchor="end" fontSize="20" fill="var(--muted)">{fmtDate(sorted[sorted.length - 1].d)}</text>
          </>
        )}
      </svg>
      {selP ? (
        <div className="chart-tip" style={{ left: `${tipLeft}%` }}>
          <button type="button" className="tip-close" onClick={() => setSel(null)} aria-label="閉じる">✕</button>
          <div className="tip-date">{fmtDateFull(selP.d)}</div>
          <div className="tip-val">{label} <b>{selP.y}</b><span className="tip-unit">{unit}</span></div>
          {startY != null && (
            <div style={{ marginTop: 2, fontWeight: 800, color: selP.y < startY ? "var(--green-bright)" : "var(--muted)" }}>
              スタートから {selP.y < startY ? "−" : selP.y > startY ? "+" : "±"}{Math.abs(Math.round((selP.y - startY) * 10) / 10)}{unit}
            </div>
          )}
        </div>
      ) : (
        <p className="chart-hint">グラフを押すと、その日の値が見られます。</p>
      )}
    </div>
  );
}

/** 疲労・だるさ・睡眠・痛みを色で直感表示(§37)＋"言葉での状態"を添える */
const TONE: Record<number, string> = { 0: "var(--green)", 1: "var(--amber)", 2: "var(--red)" };
const STATE_COLOR: Record<string, string> = { green: "var(--green-bright)", amber: "var(--amber-ink)", red: "var(--red-bright)", muted: "var(--muted)" };
export function MetricRow({ label, cells, state }: { label: string; cells: { d: string; level: number }[]; state?: { text: string; tone: string } }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        {state && <span style={{ fontSize: 13, fontWeight: 800, color: STATE_COLOR[state.tone] ?? "var(--muted)" }}>{state.text}</span>}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {cells.map((c, i) => (
          <div key={i} title={fmtDate(c.d)} style={{ flex: 1, height: 16, borderRadius: 4, background: c.level < 0 ? "var(--surface2)" : TONE[c.level] }} />
        ))}
      </div>
    </div>
  );
}

/** 14日分の日付軸。直近6日は毎日（今日・昨日・N日前）、それ以前は2日おきに相対表記を出す */
const relLabel = (fromEnd: number) =>
  fromEnd === 0 ? "今日" : fromEnd === 1 ? "昨日" : `${fromEnd}日前`;
export function DayAxis({ days }: { days: string[] }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
      {days.map((d, i) => {
        const fromEnd = days.length - 1 - i;
        const text = fromEnd <= 6 || fromEnd % 2 === 0 ? relLabel(fromEnd) : "";
        return (
          <div key={i} title={fmtDate(d)} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>{text}</div>
        );
      })}
    </div>
  );
}

/**
 * 運動量の棒グラフ（14日）。棒の高さ=その日の負荷、色=普段比。
 * 普段（=期間内の運動日の平均）より多い日・急増した日を色で見える化する。
 * ※「これ以上やるな」ではなく、上がり具合を観察するための表示。
 */
export function LoadBars({ cells, avg, coach = false }: { cells: { d: string; load: number }[]; avg: number; coach?: boolean }) {
  const max = Math.max(1, ...cells.map((c) => c.load));
  const color = (load: number) => {
    if (load <= 0) return "var(--surface2)";
    // coach（一般会員）＝赤で驚かせない。多く動けた日を緑で"よく動けた"と前向きに
    if (coach) return avg > 0 && load >= avg * 1.5 ? "var(--green)" : "var(--blue)";
    if (avg > 0 && load >= avg * 1.8) return "var(--red)";
    if (avg > 0 && load >= avg * 1.2) return "var(--amber)";
    return "var(--blue)";
  };
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 52 }}>
      {cells.map((c, i) => (
        <div key={i} title={`${fmtDate(c.d)} 負荷${Math.round(c.load)}`} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
          <div style={{ width: "100%", height: c.load <= 0 ? 4 : Math.max(6, (c.load / max) * 52), background: color(c.load), borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}
