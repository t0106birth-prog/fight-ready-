"use client";

import { SubmitButton } from "./SubmitButton";
import { saveWeighInRecoveryAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import { RECOVERY_SYMPTOMS } from "@/lib/constants";

/**
 * 計量後のリカバリー体重を「入れるだけ」の最小フォーム。
 * 別画面のテンプレートにせず、水抜き画面にそのまま埋め込む。
 * 計量時体重は初回だけ入力（以降はロック）。試合当日は集中でOK、後日に日時を選んで記録できる。
 */
export function RecoveryQuickForm({
  ownerId,
  weighInWeight,
  weighInLocked,
  defaultRecordedAt,
}: {
  ownerId: string;
  weighInWeight?: number;
  weighInLocked: boolean;
  defaultRecordedAt: string;
}) {
  return (
    <form action={saveWeighInRecoveryAction} className="card">
      <OwnerField id={ownerId} />
      {weighInLocked ? (
        <>
          <input type="hidden" name="weighInWeight" value={weighInWeight ?? ""} />
          <p className="meta mt0">計量時体重：<b>{weighInWeight}kg</b>（登録済み）</p>
        </>
      ) : (
        <>
          <label className="fl mt0" htmlFor="weighInWeight">計量時の体重(kg)（最初の1回だけ）</label>
          <input id="weighInWeight" name="weighInWeight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={weighInWeight ?? ""} required />
        </>
      )}

      <label className="fl" htmlFor="current">いまの体重(kg)</label>
      <input id="current" name="current" type="number" min="20" max="300" step="0.1" inputMode="decimal" required autoFocus />

      <label className="fl" htmlFor="recordedAt">測った日時</label>
      <input id="recordedAt" name="recordedAt" type="datetime-local" defaultValue={defaultRecordedAt} required />

      <label className="fl">気になる症状（あれば選ぶ・複数可）</label>
      <div className="seg multi wrap">
        {RECOVERY_SYMPTOMS.map((s) => <label key={s}><input type="checkbox" name="symptoms" value={s} />{s}</label>)}
      </div>
      <p className="info-note">吐き気・嘔吐・腹部膨満・下痢などがあるときは、無理に飲食を詰め込まないでください。</p>

      <label className="check" style={{ background: "var(--red-soft)", padding: "10px 12px", borderRadius: 10 }}>
        <input type="checkbox" name="fightDay" />🥊 これは<b>試合当日</b>の体重です
      </label>

      <div style={{ height: 12 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">リカバリー体重を記録する</SubmitButton>
      <p className="info-note" style={{ marginBottom: 0 }}>
        試合当日は集中でOK。後日、実際に測った日時を選んで入力すれば大丈夫です。何回でも記録でき、履歴に貯まります。
      </p>
    </form>
  );
}
