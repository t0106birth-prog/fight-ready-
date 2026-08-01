"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { HYDRO_SYMPTOMS, URINE_COLOR } from "@/lib/constants";
import { saveHydrationAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";

const COLORS: Record<string, string> = { light: "#f4e9a8", normal: "#e6c94a", dark: "#c8931f", very_dark: "#8a5a12" };

export function HydrationForm({ ownerId, isOne, defaultWeight }: { ownerId: string; isOne: boolean; defaultWeight?: number }) {
  const [usg, setUsg] = useState("");
  const usgNum = usg ? Number(usg) : null;
  const outOfRange = usgNum != null && (usgNum < 1.0 || usgNum > 1.05);

  return (
    <form action={saveHydrationAction} className="card">
      <OwnerField id={ownerId} />
      <label className="fl" htmlFor="usg">尿比重（測定した場合のみ・任意）</label>
      <input id="usg" name="usg" type="number" min="1.0000" max="1.0500" step="0.0001" inputMode="decimal"
        placeholder="例: 1.0200" value={usg} onChange={(e) => setUsg(e.target.value)} />
      {isOne && <p className="info-note">ONE対応: 小数第4位まで入力できます（入力範囲 1.0000〜1.0500）。</p>}
      {outOfRange && <div className="field-error">入力範囲（1.0000〜1.0500）の外です。値を確認してください。</div>}
      <p className="info-note">尿比重は適切な測定機器（対応する屈折計）で測定した場合のみ入力してください。尿の色から推定しないでください。未測定なら空欄で構いません。</p>

      <label className="fl">尿の色（カラーチャート）</label>
      <div className="urine-chart">
        {(["light", "normal", "dark", "very_dark"] as const).map((c) => (
          <label key={c} className="urine-swatch" style={{ background: COLORS[c], color: c === "light" ? "#333" : "#fff" }}>
            <input type="radio" name="color" value={c} />{URINE_COLOR[c]}
          </label>
        ))}
      </div>
      <p className="info-note">尿の色だけで脱水状態を確定しません。</p>

      <label className="fl">尿量</label>
      <div className="seg">
        <label><input type="radio" name="volume" value="normal" defaultChecked />普通</label>
        <label><input type="radio" name="volume" value="low" />少ない</label>
        <label><input type="radio" name="volume" value="very_low" />ほとんどない</label>
      </div>

      <label className="fl">口の渇き</label>
      <div className="seg">
        <label><input type="radio" name="thirst" value="none" defaultChecked />なし</label>
        <label><input type="radio" name="thirst" value="some" />少し</label>
        <label><input type="radio" name="thirst" value="strong" />強い</label>
      </div>

      <label className="fl">気になる症状（複数可）</label>
      <div className="seg multi wrap">
        {HYDRO_SYMPTOMS.map((s) => (
          <label key={s}><input type="checkbox" name="symptoms" value={s} />{s}</label>
        ))}
      </div>

      {isOne && (
        <div className="card tight" style={{ marginTop: 12, borderColor: "var(--red)" }}>
          <b>ONE プレチェック（尿比重の直後に体重を測定）</b>
          <p className="info-note mt0">尿を採取 → 屈折計で測定 → 尿比重入力 → 直後に体重測定 → 体重入力、の順で行ってください。</p>
          <div className="grid2">
            <div>
              <label className="fl" htmlFor="simWeight">同時測定体重(kg)</label>
              <input id="simWeight" name="simWeight" type="number" min="20" max="300" step="0.01" inputMode="decimal" defaultValue={defaultWeight ?? ""} />
            </div>
            <div>
              <label className="fl" htmlFor="gap">尿比重→体重の経過(分)</label>
              <input id="gap" name="gap" type="number" inputMode="numeric" />
            </div>
          </div>
          <label className="fl" htmlFor="weightAt">体重測定日時</label>
          <input id="weightAt" name="weightAt" type="datetime-local" />
          <label className="fl" htmlFor="refractometer">屈折計の名称・管理番号</label>
          <input id="refractometer" name="refractometer" type="text" placeholder="例: ATAGO PAL-10S #A-102" />
          <label className="fl" htmlFor="measuredBy">測定者</label>
          <input id="measuredBy" name="measuredBy" type="text" />
          <label className="check"><input type="checkbox" name="calibration" />屈折計の校正を確認した</label>
          <p className="info-note">家庭用体重計やジムの屈折計による測定は、公式検査の代わりではありません。</p>
        </div>
      )}

      <label className="fl" htmlFor="note">備考（任意）</label>
      <textarea id="note" name="note" rows={2} />

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-primary" pendingLabel="保存しています…">HYDROを記録する</SubmitButton>
    </form>
  );
}
