"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "./SubmitButton";
import { ACTIVITIES, DAY_TYPES, REST_ACTIONS } from "@/lib/constants";
import { saveActivityAction, saveRestAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";
import type { RestDayLog } from "@/lib/types";

/**
 * 「運動記録」と「休養日記録」を1つの画面に統合(§16 + §18)。
 * 先頭で「運動した / していない（休養日）」を選び、同じUI内で切り替える。
 * 運動しなかった日を未入力にせず、休養日として残せるようにするための入口統合。
 */
export function TrainingForm({ ownerId, isMember, restDefaults }: { ownerId: string; isMember: boolean; restDefaults?: RestDayLog }) {
  const [mode, setMode] = useState<"activity" | "rest">("activity");

  return (
    <>
      <div className="card tight">
        <label className="fl mt0">今日は運動しましたか？</label>
        <div className="seg">
          <label>
            <input type="radio" name="mode" checked={mode === "activity"} onChange={() => setMode("activity")} />
            運動した
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === "rest"} onChange={() => setMode("rest")} />
            していない（休養日）
          </label>
        </div>
        {mode === "rest" && (
          <p className="info-note" style={{ marginBottom: 0 }}>
            運動しなかった日も「休養日」として記録します。未入力とは区別され、休養後に回復したかを確認できます。
          </p>
        )}
      </div>

      {mode === "activity" ? (
        <form action={saveActivityAction} className="card">
          <OwnerField id={ownerId} />
          <label className="fl mt0">運動の種類</label>
          <select name="type" defaultValue={ACTIVITIES[0]}>
            {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <p className="info-note">ランニングは <Link href="/u/record/running">ランニング記録</Link> から記録してください。</p>

          <label className="fl" htmlFor="duration">運動時間（分）</label>
          <input id="duration" name="duration" type="number" inputMode="numeric" min={0} defaultValue={60} />

          <label className="fl">きつさ（1〜10）</label>
          <input name="rpe" type="range" min={1} max={10} defaultValue={5}
            style={{ width: "100%", accentColor: "var(--red)" }}
            onInput={(e) => { const el = document.getElementById("rpeVal"); if (el) el.textContent = (e.target as HTMLInputElement).value; }} />
          <div className="center"><b id="rpeVal" style={{ fontSize: 22, fontStyle: "italic" }}>5</b> / 10</div>
          {isMember && <p className="info-note center">きつさから運動負荷（軽め・適度・高め）を自動で計算します。</p>}

          <label className="fl">今日の動き</label>
          <div className="seg">
            <label><input type="radio" name="feel" value="good" />良かった</label>
            <label><input type="radio" name="feel" value="normal" defaultChecked />普通</label>
            <label><input type="radio" name="feel" value="heavy" />重かった</label>
          </div>

          <label className="fl">汗の量</label>
          <div className="seg">
            <label><input type="radio" name="sweat" value="low" />少ない</label>
            <label><input type="radio" name="sweat" value="mid" defaultChecked />普通</label>
            <label><input type="radio" name="sweat" value="high" />多い</label>
          </div>

          <div style={{ height: 14 }} />
          <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">この運動を保存する</SubmitButton>
        </form>
      ) : (
        <form action={saveRestAction} className="card">
          <OwnerField id={ownerId} />
          <input type="hidden" name="source" value="day" />
          <input type="hidden" name="actionsPresent" value="1" />
          <label className="fl mt0">今日はどんな日でしたか</label>
          <select name="dayType" defaultValue={restDefaults?.dayType ?? "完全休養日"}>
            {DAY_TYPES.filter((d) => d !== "通常練習日" && d !== "高強度練習日").map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label className="fl">今日の回復状態</label>
          <div className="seg wrap">
            <label><input type="radio" name="recovery" value="much" defaultChecked={restDefaults?.recovery === "much"} />かなり回復</label>
            <label><input type="radio" name="recovery" value="some" defaultChecked={!restDefaults?.recovery || restDefaults.recovery === "some"} />少し回復</label>
            <label><input type="radio" name="recovery" value="same" defaultChecked={restDefaults?.recovery === "same"} />変わらない</label>
            <label><input type="radio" name="recovery" value="worse" defaultChecked={restDefaults?.recovery === "worse"} />悪化</label>
          </div>

          <label className="fl">今日行ったこと（複数可）</label>
          <div className="seg multi wrap">
            {REST_ACTIONS.map((a) => <label key={a}><input type="checkbox" name="actions" value={a} defaultChecked={restDefaults?.actions?.includes(a)} />{a}</label>)}
          </div>

          <label className="fl">痛みの変化</label>
          <div className="seg">
            <label><input type="radio" name="painChange" value="improved" defaultChecked={restDefaults?.painChange === "improved"} />改善した</label>
            <label><input type="radio" name="painChange" value="same" defaultChecked={!restDefaults?.painChange || restDefaults.painChange === "same"} />変わらない</label>
            <label><input type="radio" name="painChange" value="worse" defaultChecked={restDefaults?.painChange === "worse"} />悪化した</label>
          </div>

          <div style={{ height: 14 }} />
          <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">休養日を保存する</SubmitButton>
        </form>
      )}
    </>
  );
}
