"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "./SubmitButton";
import { ACTIVITIES } from "@/lib/constants";
import { saveActivityAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";

/**
 * すでに今日の練習を1部以上記録済みのときに使う「もう1部 追加」フォーム。
 * 既定では畳んでおき、ボタンを押した時だけ開く（＝1部で完了できる感を出す）。
 */
export function AddActivitySession({ ownerId, isMember, nextIndex }: { ownerId: string; isMember: boolean; nextIndex: number }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-accent" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        ＋ もう1部 練習を追加（{nextIndex}部）
      </button>
    );
  }

  return (
    <form action={saveActivityAction} className="card">
      <OwnerField id={ownerId} />
      <div className="row" style={{ marginBottom: 4 }}>
        <b>{nextIndex}部の練習を追加</b>
        <button type="button" className="btn-sm btn-ghost" onClick={() => setOpen(false)}>閉じる</button>
      </div>

      <label className="fl">運動の種類</label>
      <select name="type" defaultValue={ACTIVITIES[0]}>
        {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <p className="info-note">ランニングは <Link href="/u/record/running">ランニング記録</Link> から記録してください。</p>

      <label className="fl" htmlFor={`duration-${nextIndex}`}>運動時間（分）</label>
      <input id={`duration-${nextIndex}`} name="duration" type="number" inputMode="numeric" min={0} defaultValue={60} />

      <label className="fl">きつさ（1〜10）</label>
      <input name="rpe" type="range" min={1} max={10} defaultValue={5}
        style={{ width: "100%", accentColor: "var(--red)" }}
        onInput={(e) => { const el = document.getElementById(`rpeVal-${nextIndex}`); if (el) el.textContent = (e.target as HTMLInputElement).value; }} />
      <div className="center"><b id={`rpeVal-${nextIndex}`} style={{ fontSize: 22, fontStyle: "italic" }}>5</b> / 10</div>
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
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">この運動（{nextIndex}部）を保存する</SubmitButton>
    </form>
  );
}
