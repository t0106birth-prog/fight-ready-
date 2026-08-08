"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { BodyMap } from "./BodyMap";
import { DANGER_SYMPTOMS, OTHER_SYMPTOMS, BOWEL, URINE_COLOR } from "@/lib/constants";
import { saveMorningAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { DailyCheckin, PainLog } from "@/lib/types";
import type { WaterCutPhase } from "@/lib/derive";
import { signed, round1 } from "@/lib/calc";

const URINE_HEX: Record<string, string> = { light: "#f4e9a8", normal: "#e6c94a", dark: "#c8931f", very_dark: "#8a5a12" };

interface MorningWaterCut {
  phase: WaterCutPhase;
  baselineWeight: number;
  targetWeight: number;
  currentWeight: number;
  currentLossPct: number;
  remainingKg: number;
}

export function MorningForm({ ownerId, defaultWeight, waterCut, defaults, painDefaults = [] }: { ownerId: string; defaultWeight?: number; waterCut?: MorningWaterCut; defaults?: DailyCheckin; painDefaults?: PainLog[] }) {
  const [danger, setDanger] = useState((defaults?.dangerSymptoms?.length ?? 0) > 0);
  const phaseLabel = waterCut?.phase === "loading" ? "減量＋ローディング中"
    : waterCut?.phase === "cut" ? "減量＋水抜き中"
      : waterCut?.phase === "weighin" ? "減量＋計量中"
        : waterCut?.phase === "recovery" ? "計量後リカバリー中"
          : "減量中";

  return (
    <form action={saveMorningAction} className="card">
      <OwnerField id={ownerId} />
      {waterCut && (
        <section id="watercut" className="watercut-daily">
          <div className="watercut-daily-head">
            <div>
              <span className="badge badge-attn">{phaseLabel}</span>
              <b>今日の体重を計量準備の記録にも反映します</b>
            </div>
            <a href="/u/watercut">詳細を見る ›</a>
          </div>
          <div className="watercut-daily-grid">
            <div><span>{waterCut.phase === "loading" ? "計量準備開始" : "水抜き開始"}</span><b>{waterCut.baselineWeight}kg</b></div>
            <div><span>計量目標</span><b>{waterCut.targetWeight}kg</b></div>
            <div><span>開始から</span><b>{signed(-waterCut.currentLossPct, "%")}</b></div>
            <div><span>計量まで</span><b>あと {waterCut.remainingKg}kg</b></div>
          </div>
        </section>
      )}

      <label className="fl" htmlFor="weight">今日の体重(kg)</label>
      <input id="weight" name="weight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={defaults?.weight != null ? round1(defaults.weight) : defaultWeight != null ? round1(defaultWeight) : ""} required={Boolean(waterCut)} />

      <label className="fl">睡眠の質</label>
      <div className="seg">
        <label><input type="radio" name="sleep" value="good" defaultChecked={defaults?.sleepQuality === "good"} />良い</label>
        <label><input type="radio" name="sleep" value="normal" defaultChecked={!defaults?.sleepQuality || defaults.sleepQuality === "normal"} />普通</label>
        <label><input type="radio" name="sleep" value="bad" defaultChecked={defaults?.sleepQuality === "bad"} />悪い</label>
      </div>

      <label className="fl">今朝の回復（昨夜〜起きたとき）</label>
      <div className="seg wrap">
        <label><input type="radio" name="recovery" value="much" defaultChecked={defaults?.morningRecovery === "much"} />かなり回復</label>
        <label><input type="radio" name="recovery" value="some" defaultChecked={!defaults?.morningRecovery || defaults.morningRecovery === "some"} />少し回復</label>
        <label><input type="radio" name="recovery" value="same" defaultChecked={defaults?.morningRecovery === "same"} />変わらない</label>
        <label><input type="radio" name="recovery" value="worse" defaultChecked={defaults?.morningRecovery === "worse"} />だるさが残る</label>
      </div>

      <label className="fl">疲労感（運動・練習による疲れ）</label>
      <div className="seg">
        <label><input type="radio" name="fatigue" value="low" defaultChecked={!defaults?.fatigueLevel || defaults.fatigueLevel === "low"} />少ない</label>
        <label><input type="radio" name="fatigue" value="mid" defaultChecked={defaults?.fatigueLevel === "mid"} />普通</label>
        <label><input type="radio" name="fatigue" value="high" defaultChecked={defaults?.fatigueLevel === "high"} />強い</label>
      </div>

      <label className="fl">だるさ（全身の重さ・倦怠感）</label>
      <div className="seg">
        <label><input type="radio" name="sluggish" value="none" defaultChecked={!defaults?.sluggishnessLevel || defaults.sluggishnessLevel === "none"} />なし</label>
        <label><input type="radio" name="sluggish" value="some" defaultChecked={defaults?.sluggishnessLevel === "some"} />少しある</label>
        <label><input type="radio" name="sluggish" value="strong" defaultChecked={defaults?.sluggishnessLevel === "strong"} />強い</label>
      </div>

      <label className="fl">身体の痛み</label>
      <div className="seg">
        <label><input type="radio" name="pain" value="none" defaultChecked={!defaults?.painLevel || defaults.painLevel === "none"} />なし</label>
        <label><input type="radio" name="pain" value="some" defaultChecked={defaults?.painLevel === "some"} />少しある</label>
        <label><input type="radio" name="pain" value="strong" defaultChecked={defaults?.painLevel === "strong"} />強い</label>
      </div>
      <p className="info-note">毎日、人型の図で身体を確認してください。痛みがなければ場所は選ばなくて大丈夫です。</p>
      <div style={{ marginTop: 10 }}>
        <BodyMap defaults={painDefaults} />
      </div>

      {/* 身体の気になるサイン（つり・打撲・しびれ等）。会長・スタッフが把握できるように */}
      <label className="fl">身体の気になること（あれば選ぶ・複数可）</label>
      <div className="seg multi wrap">
        {OTHER_SYMPTOMS.map((s) => (
          <label key={s}><input type="checkbox" name="other" value={s} defaultChecked={defaults?.otherSymptoms?.includes(s)} />{s}</label>
        ))}
      </div>

      {/* 水抜き中の追加チェック（水分関連なので尿の色などと同じ下段にまとめる） */}
      {waterCut?.phase === "cut" && (
        <div className="watercut-extra">
          <p className="kicker">水抜き中の追加チェック</p>
          <label className="fl">口の渇き</label>
          <div className="seg">
            <label><input type="radio" name="hydrationThirst" value="none" defaultChecked={!defaults?.hydrationThirst || defaults.hydrationThirst === "none"} />なし</label>
            <label><input type="radio" name="hydrationThirst" value="some" defaultChecked={defaults?.hydrationThirst === "some"} />少しある</label>
            <label><input type="radio" name="hydrationThirst" value="strong" defaultChecked={defaults?.hydrationThirst === "strong"} />強い</label>
          </div>

          <label className="fl">尿の量</label>
          <div className="seg">
            <label><input type="radio" name="urineVolumeStatus" value="normal" defaultChecked={!defaults?.urineVolumeStatus || defaults.urineVolumeStatus === "normal"} />普段通り</label>
            <label><input type="radio" name="urineVolumeStatus" value="low" defaultChecked={defaults?.urineVolumeStatus === "low"} />少ない</label>
            <label><input type="radio" name="urineVolumeStatus" value="very_low" defaultChecked={defaults?.urineVolumeStatus === "very_low"} />ほとんど出ない</label>
          </div>
        </div>
      )}

      {/* 尿の色・お通じ */}
      <label className="fl">尿の色</label>
      <div className="urine-chart">
        {(["light", "normal", "dark", "very_dark"] as const).map((c) => (
          <label key={c} className="urine-swatch" style={{ background: URINE_HEX[c], color: c === "light" ? "#333" : "#fff" }}>
            <input type="radio" name="urineColor" value={c} defaultChecked={defaults?.urineColor === c} />{URINE_COLOR[c]}
          </label>
        ))}
      </div>
      <p className="info-note">尿の色だけで脱水状態を確定しません。体重・症状と合わせて確認します。</p>

      <label className="fl">お通じ</label>
      <div className="seg wrap">
        {BOWEL.map((b) => (
          <label key={b.v}><input type="radio" name="bowel" value={b.v} defaultChecked={defaults?.bowel === b.v} />{b.l}</label>
        ))}
      </div>

      <label className="fl">危険症状（あれば選ぶ・複数可）</label>
      <div className="seg multi wrap">
        {DANGER_SYMPTOMS.map((s) => (
          <label key={s}>
            <input type="checkbox" name="danger" value={s} defaultChecked={defaults?.dangerSymptoms?.includes(s)} onChange={(e) => { if (e.target.checked) setDanger(true); }} />{s}
          </label>
        ))}
      </div>
      {danger && (
        <div className="alert-band alert-red" style={{ marginTop: 8 }}>
          <div className="at">気になる症状が入力されています</div>
          症状が強い場合は、周囲のスタッフへ伝え、必要に応じて医療専門職へ相談してください。
        </div>
      )}

      <label className="fl" htmlFor="note">一言（任意）</label>
      <textarea id="note" name="note" rows={2} defaultValue={defaults?.freeNote ?? ""} />

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">保存する</SubmitButton>
    </form>
  );
}
