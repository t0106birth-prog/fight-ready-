"use client";

import { SubmitButton } from "./SubmitButton";
import { DAY_TYPES, REST_ACTIONS } from "@/lib/constants";
import { saveRestAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { RestDayLog } from "@/lib/types";

export function RestForm({ ownerId, defaults, trainedToday }: { ownerId: string; defaults?: RestDayLog; trainedToday: boolean }) {
  return (
    <form action={saveRestAction} className="card">
      <OwnerField id={ownerId} />
      <input type="hidden" name="source" value="night" />
      <input type="hidden" name="actionsPresent" value="1" />
      <div className="alert-band alert-blue">
        <div className="at">今日の区分</div>
        {defaults?.dayType ?? (trainedToday ? "通常練習日" : "運動・休養の記録がまだありません")}
        <p className="info-note">日の区分は「運動・休養の記録」で設定し、ここでは夜の回復状態だけを更新します。</p>
      </div>

      <label className="fl">今日の回復状態</label>
      <div className="seg wrap">
        <label><input type="radio" name="recovery" value="much" defaultChecked={defaults?.recovery === "much"} />かなり回復した</label>
        <label><input type="radio" name="recovery" value="some" defaultChecked={!defaults?.recovery || defaults.recovery === "some"} />少し回復した</label>
        <label><input type="radio" name="recovery" value="same" defaultChecked={defaults?.recovery === "same"} />変わらない</label>
        <label><input type="radio" name="recovery" value="worse" defaultChecked={defaults?.recovery === "worse"} />悪化した</label>
      </div>

      <label className="fl">今日行ったこと（複数可）</label>
      <div className="seg multi wrap">
        {REST_ACTIONS.map((a) => (
          <label key={a}><input type="checkbox" name="actions" value={a} defaultChecked={defaults?.actions?.includes(a)} />{a}</label>
        ))}
      </div>

      <label className="fl">痛みの変化</label>
      <div className="seg">
        <label><input type="radio" name="painChange" value="improved" defaultChecked={defaults?.painChange === "improved"} />改善した</label>
        <label><input type="radio" name="painChange" value="same" defaultChecked={!defaults?.painChange || defaults.painChange === "same"} />変わらない</label>
        <label><input type="radio" name="painChange" value="worse" defaultChecked={defaults?.painChange === "worse"} />悪化した</label>
      </div>

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">保存する</SubmitButton>
    </form>
  );
}
