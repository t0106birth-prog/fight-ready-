"use client";

import Link from "next/link";
import { SubmitButton } from "./SubmitButton";
import { saveNutritionAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { NutritionLog } from "@/lib/types";

function BinaryRow({ name, label, yes, no, value }: { name: string; label: string; yes: string; no: string; value?: NutritionLog["breakfast"] }) {
  return (
    <>
      <label className="fl">{label}</label>
      <div className="seg">
        <label><input type="radio" name={name} value="done" defaultChecked={value === "done"} />{yes}</label>
        <label><input type="radio" name={name} value="none" defaultChecked={value === "none"} />{no}</label>
      </div>
    </>
  );
}

export function NutritionForm({ ownerId, defaults, goalText }: { ownerId: string; defaults?: NutritionLog; goalText?: string }) {
  const hasGoal = Boolean(goalText);
  return (
    <form action={saveNutritionAction} className="card">
      <OwnerField id={ownerId} />
      {hasGoal ? (
        <>
          <div className="alert-band alert-blue" style={{ margin: "0 0 12px" }}>
            <div className="at">あなたの食事目標</div>
            <b style={{ fontSize: 16 }}>{goalText}</b>
            <p className="info-note mt0" style={{ marginBottom: 0 }}>この目標全体に対して、今日はどうだったかを選んでください。</p>
          </div>
          <label className="fl">今日の食事目標</label>
          <div className="seg">
            <label><input type="radio" name="goal" value="done" defaultChecked={defaults?.goalAchieved === "done"} required />目標どおり</label>
            <label><input type="radio" name="goal" value="partial" defaultChecked={defaults?.goalAchieved === "partial"} />だいたいできた</label>
            <label><input type="radio" name="goal" value="none" defaultChecked={defaults?.goalAchieved === "none"} />できなかった</label>
          </div>
          <p className="info-note">カロリー計算や写真解析は行いません。達成度だけ記録します。</p>
        </>
      ) : (
        <div className="alert-band alert-yellow" style={{ margin: "0 0 12px" }}>
          <div className="at">先に食事目標を設定してください</div>
          達成度は「自分で決めた食事目標」に対して記録します。まだ目標が設定されていないため、達成度は選べません。
          <Link href="/u/mypage" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>🎯 食事目標を設定する</Link>
          <p className="info-note mt0" style={{ marginBottom: 0 }}>目標がなくても、下の「事実だけ記録」は入力できます。</p>
        </div>
      )}

      <hr className="divider" />
      <p className="meta mt0">事実だけを記録（任意）</p>
      <BinaryRow name="breakfast" label="朝食を完食した？" yes="完食した" no="完食しなかった" value={defaults?.breakfast} />
      <BinaryRow name="lunch" label="昼食を完食した？" yes="完食した" no="完食しなかった" value={defaults?.lunch} />
      <BinaryRow name="dinner" label="夕食を完食した？" yes="完食した" no="完食しなかった" value={defaults?.dinner} />
      <BinaryRow name="snack" label="間食を控えられた？" yes="控えられた" no="控えられなかった" value={defaults?.snack} />
      <BinaryRow name="hydration" label="水分の目標量を飲めた？" yes="飲めた" no="飲めなかった" value={defaults?.hydration} />

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">保存する</SubmitButton>
    </form>
  );
}
