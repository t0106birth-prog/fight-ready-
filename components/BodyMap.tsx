"use client";

import { useState } from "react";
import { BODY_PARTS } from "@/lib/constants";
import type { PainLog } from "@/lib/types";

/**
 * 身体マップ(§15)。正面図・背面図に部位を配置し、タップで選択。
 * 選択した部位ごとに 強さ1-3 / 今日から・以前から / 前日比 を入力する。
 * 隠しフィールドとしてフォームに含める（painParts, painLv_*, painNew_*, painChg_*）。
 */
export function BodyMap({ defaults = [] }: { defaults?: PainLog[] }) {
  const [sel, setSel] = useState<string[]>(defaults.map((p) => p.locationId));
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const front = BODY_PARTS.filter((p) => p.side === "front");
  const back = BODY_PARTS.filter((p) => p.side === "back");

  const Silhouette = ({ side, parts }: { side: string; parts: typeof BODY_PARTS }) => (
    <div className="bodymap">
      <div className="cap">{side}</div>
      <svg viewBox="0 0 100 200" role="img" aria-label={`${side}の身体マップ`}>
        {/* 簡易シルエット */}
        <g fill="var(--surface2)" stroke="var(--line)" strokeWidth="1">
          <circle cx="50" cy="16" r="11" />
          <rect x="39" y="27" width="22" height="8" rx="3" />
          <rect x="34" y="34" width="32" height="52" rx="10" />
          <rect x="22" y="36" width="12" height="40" rx="6" />
          <rect x="66" y="36" width="12" height="40" rx="6" />
          <rect x="19" y="72" width="10" height="34" rx="5" />
          <rect x="71" y="72" width="10" height="34" rx="5" />
          <rect x="36" y="86" width="12" height="70" rx="6" />
          <rect x="52" y="86" width="12" height="70" rx="6" />
          <rect x="37" y="156" width="10" height="40" rx="5" />
          <rect x="53" y="156" width="10" height="40" rx="5" />
        </g>
        {parts.map((p) => (
          <circle
            key={p.id}
            className={`part ${sel.includes(p.id) ? "sel" : ""}`}
            cx={p.x} cy={p.y * 2} r="6"
            onClick={() => toggle(p.id)}
            role="button"
            aria-label={p.label}
            aria-pressed={sel.includes(p.id)}
          />
        ))}
      </svg>
    </div>
  );

  return (
    <div>
      <p className="info-note">痛む部分を、図のタップ か 下のリストのチェックで選べます（複数可）。</p>
      <div className="bodymap-wrap">
        <Silhouette side="正面" parts={front} />
        <Silhouette side="背面" parts={back} />
      </div>

      {/* リストからチェックで選ぶ（会長・スタッフが把握しやすいよう部位を明示） */}
      <p className="fl">部位をチェックで選ぶ</p>
      <div className="seg multi wrap">
        {BODY_PARTS.map((p) => (
          <label key={p.id}>
            <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
            {p.label}
          </label>
        ))}
      </div>

      {sel.length === 0 && <p className="meta center" style={{ marginTop: 8 }}>部位が選ばれていません。</p>}
      {sel.map((id) => {
        const label = BODY_PARTS.find((p) => p.id === id)?.label ?? id;
        const saved = defaults.find((p) => p.locationId === id);
        return (
          <div className="card tight" key={id} style={{ marginTop: 8 }}>
            <input type="hidden" name="painParts" value={id} />
            <div className="row">
              <b>{label}</b>
              <button type="button" className="btn-sm btn-ghost" onClick={() => toggle(id)}>外す</button>
            </div>
            <label className="fl">痛みの強さ</label>
            <div className="seg">
              {[1, 2, 3].map((lv) => (
                <label key={lv}><input type="radio" name={`painLv_${id}`} value={lv} defaultChecked={lv === (saved?.painLevel ?? 1)} />{lv}</label>
              ))}
            </div>
            <div className="grid2">
              <div>
                <label className="fl">いつから</label>
                <select name={`painNew_${id}`} defaultValue={saved?.newOrContinuing ?? "new"}>
                  <option value="new">今日からの痛み</option>
                  <option value="continuing">以前から続く痛み</option>
                </select>
              </div>
              <div>
                <label className="fl">前日より</label>
                <select name={`painChg_${id}`} defaultValue={saved?.changeStatus ?? "same"}>
                  <option value="improved">改善</option>
                  <option value="same">変わらない</option>
                  <option value="worse">悪化</option>
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
