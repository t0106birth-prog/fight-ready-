"use client";

import { SubmitButton } from "./SubmitButton";
import { BodyMap } from "./BodyMap";
import { saveMorningAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { DailyCheckin, PainLog, RestDayLog, NutritionLog } from "@/lib/types";

/**
 * 一般会員の「今日のチェック」= 1日1回で主要記録を完了できる統合フォーム。
 * どの時間帯に開いても不自然にならない時間非依存の文言にする。
 * 保存先は既存テーブルを再利用（DailyCheckin / PainLog / RestDayLog / NutritionLog）。
 * hidden memberCheck=1 を付け、saveMorningAction 側で運動・食事もまとめて保存する。
 */
const REST_DAYTYPES = ["完全休養日", "体調不良による休養日", "痛みによる休養日"];

export function MemberCheckForm({
  ownerId, defaultWeight, defaults, painDefaults = [], restDefaults, nutritionDefaults,
}: {
  ownerId: string;
  defaultWeight?: number;
  defaults?: DailyCheckin;
  painDefaults?: PainLog[];
  restDefaults?: RestDayLog;
  nutritionDefaults?: NutritionLog;
}) {
  const dayInit: "trained" | "rest" | "" = !restDefaults?.dayType
    ? ""
    : REST_DAYTYPES.includes(restDefaults.dayType) ? "rest" : "trained";
  const nutInit = nutritionDefaults?.goalAchieved;

  return (
    <form action={saveMorningAction} className="card">
      <OwnerField id={ownerId} />
      <input type="hidden" name="memberCheck" value="1" />

      <p className="info-note mt0">この1枚で今日の記録は完了です。いつ開いても大丈夫。空欄があってもそのまま保存できます。</p>

      {/* ── 体調 ── */}
      <p className="kicker">体調</p>

      <label className="fl" htmlFor="weight">今の体重（kg・任意）</label>
      <input id="weight" name="weight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={defaults?.weight ?? defaultWeight ?? ""} />

      <label className="fl">昨夜の睡眠</label>
      <div className="seg">
        <label><input type="radio" name="sleep" value="good" defaultChecked={defaults?.sleepQuality === "good"} />よく眠れた</label>
        <label><input type="radio" name="sleep" value="normal" defaultChecked={!defaults?.sleepQuality || defaults.sleepQuality === "normal"} />普通</label>
        <label><input type="radio" name="sleep" value="bad" defaultChecked={defaults?.sleepQuality === "bad"} />眠れなかった</label>
      </div>

      <label className="fl">今朝の回復（昨夜〜起きたとき）</label>
      <div className="seg wrap">
        <label><input type="radio" name="recovery" value="much" defaultChecked={defaults?.morningRecovery === "much"} />かなり回復</label>
        <label><input type="radio" name="recovery" value="some" defaultChecked={!defaults?.morningRecovery || defaults.morningRecovery === "some"} />少し回復</label>
        <label><input type="radio" name="recovery" value="same" defaultChecked={defaults?.morningRecovery === "same"} />変わらない</label>
        <label><input type="radio" name="recovery" value="worse" defaultChecked={defaults?.morningRecovery === "worse"} />だるさが残る</label>
      </div>

      <label className="fl">今の疲労感</label>
      <div className="seg">
        <label><input type="radio" name="fatigue" value="low" defaultChecked={!defaults?.fatigueLevel || defaults.fatigueLevel === "low"} />少ない</label>
        <label><input type="radio" name="fatigue" value="mid" defaultChecked={defaults?.fatigueLevel === "mid"} />普通</label>
        <label><input type="radio" name="fatigue" value="high" defaultChecked={defaults?.fatigueLevel === "high"} />強い</label>
      </div>

      <label className="fl">今のだるさ（全身の重さ）</label>
      <div className="seg">
        <label><input type="radio" name="sluggish" value="none" defaultChecked={!defaults?.sluggishnessLevel || defaults.sluggishnessLevel === "none"} />なし</label>
        <label><input type="radio" name="sluggish" value="some" defaultChecked={defaults?.sluggishnessLevel === "some"} />少しある</label>
        <label><input type="radio" name="sluggish" value="strong" defaultChecked={defaults?.sluggishnessLevel === "strong"} />強い</label>
      </div>

      {/* ── 痛み（有無に関わらず常に人型マップを表示）── */}
      <p className="kicker">痛み</p>
      <label className="fl mt0">今の痛み</label>
      <div className="seg">
        <label><input type="radio" name="pain" value="none" defaultChecked={!defaults?.painLevel || defaults.painLevel === "none"} />なし</label>
        <label><input type="radio" name="pain" value="some" defaultChecked={defaults?.painLevel === "some"} />少しある</label>
        <label><input type="radio" name="pain" value="strong" defaultChecked={defaults?.painLevel === "strong"} />強い</label>
      </div>
      <p className="info-note">人型の図で身体を確認できます。痛みがなければ場所は選ばなくて大丈夫です。</p>
      <div style={{ marginTop: 10 }}>
        <BodyMap defaults={painDefaults} />
      </div>

      {/* ── 昨日の行動（運動・食事のかんたん記録）── */}
      <p className="kicker">昨日の行動</p>
      <label className="fl mt0">からだを動かしましたか</label>
      <div className="seg">
        <label><input type="radio" name="dayChoice" value="trained" defaultChecked={dayInit === "trained"} />運動した</label>
        <label><input type="radio" name="dayChoice" value="rest" defaultChecked={dayInit === "rest"} />休養した</label>
        <label><input type="radio" name="dayChoice" value="" defaultChecked={dayInit === ""} />まだ選ばない</label>
      </div>
      <p className="info-note">くわしい種目・時間は、あとから「運動の詳細」で追加できます。</p>

      <label className="fl">食事の目標はどうでしたか</label>
      <div className="seg">
        <label><input type="radio" name="nutritionGoal" value="done" defaultChecked={nutInit === "done"} />目標どおり</label>
        <label><input type="radio" name="nutritionGoal" value="partial" defaultChecked={nutInit === "partial"} />だいたいできた</label>
        <label><input type="radio" name="nutritionGoal" value="none" defaultChecked={nutInit === "none"} />できなかった</label>
      </div>

      <label className="fl" htmlFor="note">一言（任意）</label>
      <textarea id="note" name="note" rows={2} defaultValue={defaults?.freeNote ?? ""} />

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="記録しています…">今日のチェックを記録</SubmitButton>
    </form>
  );
}
