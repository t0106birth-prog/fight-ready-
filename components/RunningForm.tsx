"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { RUNNING_CATS } from "@/lib/constants";
import { saveRunningAction } from "@/app/u/actions";
import { OwnerField } from "@/components/OwnerField";

export function RunningForm({ ownerId }: { ownerId: string }) {
  const [cat, setCat] = useState(RUNNING_CATS[0]);
  const isDash = cat === "ダッシュ" || cat === "坂道ダッシュ";
  return (
    <form action={saveRunningAction} className="card">
      <OwnerField id={ownerId} />
      <label className="fl">ランニングカテゴリー</label>
      <select name="category" value={cat} onChange={(e) => setCat(e.target.value)}>
        {RUNNING_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label className="fl" htmlFor="duration">ランニング時間（分）</label>
      <input id="duration" name="duration" type="number" inputMode="numeric" min={0} defaultValue={30} />

      <p className="info-note">ランニングでは「きつさ」は入力しません。時間・カテゴリー・本数・脚の状態から傾向を表示します。</p>

      <div className="grid2">
        <div>
          <label className="fl" htmlFor="distance">距離(km・任意)</label>
          <input id="distance" name="distance" type="number" step="0.1" inputMode="decimal" />
        </div>
        <div>
          <label className="fl" htmlFor="pace">平均ペース(任意)</label>
          <input id="pace" name="pace" type="text" placeholder="5:30/km" />
        </div>
      </div>

      {isDash && (
        <div className="card tight" style={{ marginTop: 8 }}>
          <b>ダッシュ</b>
          <div className="grid2">
            <div>
              <label className="fl" htmlFor="dashCount">本数</label>
              <input id="dashCount" name="dashCount" type="number" inputMode="numeric" min={0} />
            </div>
            <div>
              <label className="fl" htmlFor="dashUnit">1本の時間/距離</label>
              <input id="dashUnit" name="dashUnit" type="text" placeholder="10秒 / 50m" />
            </div>
          </div>
          <label className="fl" htmlFor="rest">休憩時間</label>
          <input id="rest" name="rest" type="text" placeholder="60秒" />
        </div>
      )}

      <label className="fl">脚の状態</label>
      <div className="seg wrap">
        <label><input type="radio" name="leg" value="light" />軽い</label>
        <label><input type="radio" name="leg" value="normal" defaultChecked />普通</label>
        <label><input type="radio" name="leg" value="heavy" />重い</label>
        <label><input type="radio" name="leg" value="pain" />痛みがある</label>
      </div>

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">保存する</SubmitButton>
    </form>
  );
}
