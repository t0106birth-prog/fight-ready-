"use client";

import Link from "next/link";
import { SubmitButton } from "./SubmitButton";
import { ACTIVITIES } from "@/lib/constants";
import { updateActivityAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { ActivityLog } from "@/lib/types";

/** 記録済みの部練を編集するフォーム（?edit=ID のとき表示）。 */
export function ActivityEditForm({ act, ownerId }: { act: ActivityLog; ownerId: string }) {
  return (
    <form action={updateActivityAction} className="card" style={{ borderColor: "var(--amber)" }}>
      <OwnerField id={ownerId} />
      <b>✏️ この運動を編集</b>
      <input type="hidden" name="id" value={act.id} />

      <label className="fl">運動の種類</label>
      <select name="type" defaultValue={act.activityType}>
        {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      <label className="fl" htmlFor="eduration">運動時間（分）</label>
      <input id="eduration" name="duration" type="number" inputMode="numeric" min={0} defaultValue={act.durationMinutes} />

      <label className="fl">きつさ（1〜10）</label>
      <input name="rpe" type="range" min={1} max={10} defaultValue={act.rpe ?? 5}
        style={{ width: "100%", accentColor: "var(--red)" }}
        onInput={(e) => { const el = document.getElementById("erpeVal"); if (el) el.textContent = (e.target as HTMLInputElement).value; }} />
      <div className="center"><b id="erpeVal" style={{ fontSize: 22, fontStyle: "italic" }}>{act.rpe ?? 5}</b> / 10</div>

      <label className="fl">今日の動き</label>
      <div className="seg">
        <label><input type="radio" name="feel" value="good" defaultChecked={act.movementFeeling === "good"} />良かった</label>
        <label><input type="radio" name="feel" value="normal" defaultChecked={!act.movementFeeling || act.movementFeeling === "normal"} />普通</label>
        <label><input type="radio" name="feel" value="heavy" defaultChecked={act.movementFeeling === "heavy"} />重かった</label>
      </div>

      <label className="fl">汗の量</label>
      <div className="seg">
        <label><input type="radio" name="sweat" value="low" defaultChecked={act.sweatLevel === "low"} />少ない</label>
        <label><input type="radio" name="sweat" value="mid" defaultChecked={!act.sweatLevel || act.sweatLevel === "mid"} />普通</label>
        <label><input type="radio" name="sweat" value="high" defaultChecked={act.sweatLevel === "high"} />多い</label>
      </div>

      <div style={{ height: 12 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="更新しています…">この運動を更新する</SubmitButton>
      <p className="center small" style={{ marginTop: 8 }}><Link href="/u/record/activity">キャンセル</Link></p>
    </form>
  );
}
