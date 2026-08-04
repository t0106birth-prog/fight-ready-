"use client";

import { SubmitButton } from "./SubmitButton";
import { saveWeighInRecoveryAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import { toDateTimeLocal } from "@/lib/calc";
import { RECOVERY_SYMPTOMS as SYMPTOMS } from "@/lib/constants";

export function WeighInRecoveryForm({ ownerId, defaultWeighIn, lockWeighIn = false, minRecordedAt }: { ownerId: string; defaultWeighIn?: number; lockWeighIn?: boolean; minRecordedAt?: string }) {
  return (
    <form action={saveWeighInRecoveryAction} className="card">
      <OwnerField id={ownerId} />
      <div className="grid2">
        <div>
          <label className="fl" htmlFor="weighInWeight">計量時体重(kg)</label>
          <input id="weighInWeight" name="weighInWeight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={defaultWeighIn ?? ""} readOnly={lockWeighIn} required />
          {lockWeighIn && <p className="info-note">初回記録で確定済みです。誤りがある場合は履歴を保つためスタッフに確認してください。</p>}
        </div>
        <div>
          <label className="fl" htmlFor="current">現在体重(kg)</label>
          <input id="current" name="current" type="number" min="20" max="300" step="0.1" inputMode="decimal" required />
        </div>
      </div>
      <label className="fl" htmlFor="recordedAt">この体重を測った日時</label>
      <input id="recordedAt" name="recordedAt" type="datetime-local" min={toDateTimeLocal(minRecordedAt)} max={toDateTimeLocal()} defaultValue={toDateTimeLocal()} required />
      <p className="info-note">計量からの経過時間は、計量日時と測定日時から自動計算します。</p>

      <label className="check" style={{ background: "var(--red-soft)", padding: "10px 12px", borderRadius: 10 }}>
        <input type="checkbox" name="fightDay" />🥊 これは<b>試合当日</b>の体重です
      </label>
      <p className="info-note">計量後は何回でも記録できます。時間ごとに体重の戻りが履歴に残ります。試合当日の体重にはチェックを入れてください。</p>

      <label className="check"><input type="checkbox" name="water" defaultChecked />水分を摂取した</label>
      <label className="check"><input type="checkbox" name="food" defaultChecked />食事を摂取した</label>

      <label className="fl">気になる症状（複数可）</label>
      <div className="seg multi wrap">
        {SYMPTOMS.map((s) => <label key={s}><input type="checkbox" name="symptoms" value={s} />{s}</label>)}
      </div>

      <label className="fl">睡眠</label>
      <div className="seg">
        <label><input type="radio" name="sleep" value="good" />良い</label>
        <label><input type="radio" name="sleep" value="normal" defaultChecked />普通</label>
        <label><input type="radio" name="sleep" value="bad" />悪い</label>
      </div>

      <label className="fl">試合前の身体状態</label>
      <div className="seg">
        <label><input type="radio" name="condition" value="good" />良い</label>
        <label><input type="radio" name="condition" value="normal" defaultChecked />普通</label>
        <label><input type="radio" name="condition" value="bad" />悪い</label>
      </div>
      <p className="info-note">摂取内容や具体量の指示は行いません。回復状態の記録だけを行います。</p>

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-primary" pendingLabel="保存しています…">計量後の回復を記録</SubmitButton>
    </form>
  );
}
