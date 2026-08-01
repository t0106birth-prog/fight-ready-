"use client";

import { SubmitButton } from "./SubmitButton";
import { saveNutritionAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { NutritionLog } from "@/lib/types";

const OPTS = [
  { v: "done", l: "できた" },
  { v: "partial", l: "一部" },
  { v: "none", l: "できなかった" },
];

function Row({ name, label, value }: { name: string; label: string; value?: NutritionLog["breakfast"] }) {
  return (
    <>
      <label className="fl">{label}</label>
      <div className="seg">
        {OPTS.map((o) => (
          <label key={o.v}><input type="radio" name={name} value={o.v} defaultChecked={value === o.v} />{o.l}</label>
        ))}
      </div>
    </>
  );
}

export function NutritionForm({ ownerId, defaults, goalText }: { ownerId: string; defaults?: NutritionLog; goalText?: string }) {
  return (
    <form action={saveNutritionAction} className="card">
      <OwnerField id={ownerId} />
      {goalText ? (
        <div className="alert-band alert-blue" style={{ margin: "0 0 12px" }}>
          <div className="at">あなたの食事目標</div>
          <b style={{ fontSize: 16 }}>{goalText}</b>
          <p className="info-note mt0" style={{ marginBottom: 0 }}>この目標に対して、今日はどうだったかを選んでください。</p>
        </div>
      ) : (
        <p className="info-note mt0">食事の目標は「目標・設定」ページで決められます（例：夜の間食を控える）。まずは「目標に対して今日できたか」をざっくり選びましょう。</p>
      )}
      <label className="fl">今日の食事目標</label>
      <div className="seg">
        <label><input type="radio" name="goal" value="done" defaultChecked={defaults?.goalAchieved === "done"} />目標どおり</label>
        <label><input type="radio" name="goal" value="partial" defaultChecked={!defaults || defaults.goalAchieved === "partial"} />一部できた</label>
        <label><input type="radio" name="goal" value="none" defaultChecked={defaults?.goalAchieved === "none"} />できなかった</label>
      </div>
      <p className="info-note">カロリー計算や写真解析は行いません。達成度だけ記録します。</p>

      <hr className="divider" />
      <p className="meta mt0">項目ごとに記録（任意）</p>
      <Row name="breakfast" label="朝食" value={defaults?.breakfast} />
      <Row name="lunch" label="昼食" value={defaults?.lunch} />
      <Row name="dinner" label="夕食" value={defaults?.dinner} />
      <Row name="snack" label="間食" value={defaults?.snack} />
      <Row name="hydration" label="水分" value={defaults?.hydration} />

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">保存する</SubmitButton>
    </form>
  );
}
