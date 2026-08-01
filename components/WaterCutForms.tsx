"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { startWaterCutAction, saveWaterCutLogAction, updateWaterCutBaselineAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import { toDateTimeLocal } from "@/lib/calc";

/** 水抜き開始登録(§23) */
export function StartWaterCutForm({
  ownerId, defaultBaseline, defaultTarget, defaultWeighIn, defaultFight, latestMeasuredWeight,
}: {
  ownerId: string; defaultBaseline?: number; defaultTarget?: number; defaultWeighIn?: string; defaultFight?: string; latestMeasuredWeight?: number;
}) {
  const [baseline, setBaseline] = useState(defaultBaseline?.toString() ?? "");
  const [target, setTarget] = useState(defaultTarget?.toString() ?? "");
  const baselineNumber = Number(baseline);
  const targetNumber = Number(target);
  const hasPlan = baselineNumber > 0 && targetNumber > 0;
  const plannedLoss = hasPlan ? Math.max(0, Math.round((baselineNumber - targetNumber) * 10) / 10) : 0;
  const plannedPct = hasPlan ? Math.round((plannedLoss / baselineNumber) * 1000) / 10 : 0;
  const planTone = plannedPct >= 5 ? "red" : plannedPct >= 2 ? "yellow" : "blue";
  return (
    <form action={startWaterCutAction} className="card">
      <OwnerField id={ownerId} />
      <div className="alert-band alert-blue">
        <div className="at">測定条件をそろえてください</div>
        基準体重は、できる限り「起床後・排尿後・飲食前・同じ体重計」で登録してください。これは条件をそろえるための案内であり、水抜き方法の指示ではありません。
      </div>
      <label className="fl" htmlFor="start">水抜き開始日時</label>
      <input id="start" name="start" type="datetime-local" defaultValue={toDateTimeLocal()} required />
      {latestMeasuredWeight != null && (
        <div className="notice">
          最新の毎日記録は <b>{latestMeasuredWeight}kg</b> です。
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setBaseline(String(latestMeasuredWeight))}>この値を開始体重へ入力</button>
        </div>
      )}
      <div className="grid2">
        <div>
          <label className="fl" htmlFor="baseline">水抜き開始体重(kg)</label>
          <input id="baseline" name="baseline" type="number" min="20" max="300" step="0.1" inputMode="decimal" value={baseline} onChange={(e) => setBaseline(e.target.value)} required />
        </div>
        <div>
          <label className="fl" htmlFor="target">計量目標体重(kg){defaultTarget != null && <span className="meta"> 自動取得</span>}</label>
          <input id="target" name="target" type="number" min="20" max="300" step="0.1" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required />
        </div>
      </div>
      <p className="info-note">ここで変更した計量目標は今回の水抜きだけに保存され、プロフィールの目標体重は変更しません。</p>

      {hasPlan && (
        <div className={`watercut-plan-preview alert-band alert-${planTone}`}>
          <div className="at">開始前の計画確認</div>
          <div className="watercut-plan-numbers">
            <div><span>予定減少</span><b>{plannedLoss}kg</b></div>
            <div><span>開始体重から</span><b>{plannedPct}%</b></div>
          </div>
          <p className="info-note">この割合は計画確認のための参考表示で、安全を保証するものではありません。</p>
        </div>
      )}

      <label className="check watercut-target-confirm">
        <input type="checkbox" name="targetConfirmed" required />
        今回の計量目標が{target || "入力した値"}kgであることを確認しました
      </label>
      <label className="fl" htmlFor="weighIn">計量日時</label>
      <input id="weighIn" name="weighIn" type="datetime-local" defaultValue={toDateTimeLocal(defaultWeighIn)} required />
      <label className="fl" htmlFor="fight">試合日時</label>
      <input id="fight" name="fight" type="datetime-local" defaultValue={toDateTimeLocal(defaultFight)} />
      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-primary" pendingLabel="開始しています…">水抜きモニタリングを開始</SubmitButton>
    </form>
  );
}

/** 進行中の水抜き開始体重の確認・修正 */
export function WaterCutBaselineForm({ ownerId, baselineWeight }: { ownerId: string; baselineWeight: number }) {
  return (
    <details className="card tight watercut-baseline-form">
      <summary><b>設定を修正</b><span className="meta">　水抜き開始体重 {baselineWeight}kg</span></summary>
      <form action={updateWaterCutBaselineAction} style={{ marginTop: 12 }}>
      <OwnerField id={ownerId} />
      <div>
        <label className="fl" htmlFor="baselineUpdate">水抜き開始体重(kg)</label>
        <p className="info-note mt0">今回の減少率を計算する基準です。実際に水抜きを開始した時の体重を入力してください。</p>
      </div>
      <div className="watercut-baseline-input">
        <input
          id="baselineUpdate"
          name="baseline"
          type="number"
          min="20"
          max="300"
          step="0.1"
          inputMode="decimal"
          defaultValue={baselineWeight}
          required
        />
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel="更新中…">開始体重を更新</SubmitButton>
      </div>
      <label className="fl" htmlFor="baselineReason">修正理由</label>
      <textarea id="baselineReason" name="reason" rows={2} placeholder="例：開始時の測定値を誤入力したため" required />
      <label className="check">
        <input type="checkbox" name="baselineConfirmed" required />
        開始体重を変更すると、この期間の減少kg・減少率がすべて再計算されることを確認しました
      </label>
      <p className="info-note">変更すると、この水抜き期間に記録済みの「開始からの減少kg・減少率」も再計算されます。</p>
      </form>
    </details>
  );
}

/** 現在体重の記録(§24) */
export function WaterCutLogForm({ ownerId, defaultWeight }: { ownerId: string; defaultWeight?: number }) {
  return (
    <form action={saveWaterCutLogAction} className="card tight watercut-weight-form">
      <OwnerField id={ownerId} />
      <label className="fl" htmlFor="current">現在体重</label>
      <div className="watercut-weight-field">
        <input
          id="current"
          name="current"
          type="number"
          min="20"
          max="300"
          step="0.1"
          inputMode="decimal"
          placeholder="例：63.5"
          defaultValue={defaultWeight ?? ""}
          aria-describedby="currentWeightHelp"
          required
        />
        <span aria-hidden="true">kg</span>
      </div>
      <p id="currentWeightHelp" className="info-note">体重計に表示された数値を、小数第1位まで入力できます。</p>
      <SubmitButton className="btn btn-accent" pendingLabel="記録しています…">この体重を記録</SubmitButton>
    </form>
  );
}
