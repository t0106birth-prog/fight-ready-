"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { SPORTS, GOALS } from "@/lib/constants";
import { registerAction } from "@/app/register/actions";
import type { Gym } from "@/lib/types";

/**
 * 登録フォーム（モバイル最適化）。
 * 最初は"必須だけ"を表示して短く。性別・体重・目標などの任意項目は「詳しい情報」に折りたたむ（あとでマイページでも設定可）。
 */
export function RegisterForm({ gyms, presetGym }: { gyms: Gym[]; presetGym?: Gym | null }) {
  const [userType, setUserType] = useState<"pro" | "member" | "">("");
  const [goals, setGoals] = useState<string[]>([]);
  const [promotion, setPromotion] = useState("none");
  const [showMore, setShowMore] = useState(false);

  const wantsTarget = goals.includes("lose_weight") || goals.includes("lose_fat") || (userType === "pro");
  const toggleGoal = (id: string) =>
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  return (
    <form action={registerAction} className="card">
      {/* ── ここから必須 ── */}
      <label className="fl mt0">利用区分</label>
      <div className="seg">
        <label><input type="radio" name="userType" value="pro" required onChange={() => setUserType("pro")} />選手</label>
        <label><input type="radio" name="userType" value="member" onChange={() => setUserType("member")} />一般会員</label>
      </div>

      <label className="fl" htmlFor="name">氏名</label>
      <input id="name" name="name" type="text" required autoComplete="name" />

      <label className="fl" htmlFor="email">メールアドレス</label>
      <input id="email" name="email" type="email" required autoComplete="email" />

      <label className="fl" htmlFor="password">パスワード（6文字以上）</label>
      <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />

      {/* 所属ジム：招待リンクなら固定。無ければコード or「なし」 */}
      {presetGym ? (
        <>
          <label className="fl">所属ジム</label>
          <div className="alert-band alert-green" style={{ margin: 0 }}>
            <b>{presetGym.name}</b> に参加します（招待コード：{presetGym.code}）
          </div>
          <input type="hidden" name="gymCode" value={presetGym.code} />
        </>
      ) : (
        <>
          <label className="fl" htmlFor="gymCode">チームコード（配られたコード / QR）</label>
          <input id="gymCode" name="gymCode" type="text" placeholder="例: FIGHTBASE" autoCapitalize="characters" style={{ textTransform: "uppercase" }} />
          <p className="info-note mt0">コードが無ければ「なし」でOK（あとで紐付けできます）。</p>
          <select id="gymId" name="gymId" defaultValue="none">
            <option value="none">なし（あとで紐付け）</option>
            {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </>
      )}

      {/* 選手は主競技だけ必須（あとの詳細は折りたたみ側） */}
      {userType === "pro" && (
        <>
          <label className="fl">主競技</label>
          <select name="primarySport" defaultValue="" required>
            <option value="" disabled>選ぶ</option>
            {SPORTS.filter((s) => s.id !== "fitness").map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </>
      )}

      {/* ── 任意の詳細（折りたたみ）── */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="btn btn-ghost btn-sm"
        style={{ width: "100%", marginTop: 14 }}
      >
        {showMore ? "詳しい情報を閉じる ▲" : "＋ 詳しい情報を入力（任意・あとでもOK）"}
      </button>

      {showMore && (
        <div style={{ marginTop: 10 }}>
          <label className="fl mt0">性別</label>
          <div className="seg wrap">
            <label><input type="radio" name="gender" value="male" />男性</label>
            <label><input type="radio" name="gender" value="female" />女性</label>
            <label><input type="radio" name="gender" value="other" />その他</label>
            <label><input type="radio" name="gender" value="no_answer" />回答しない</label>
          </div>

          <div className="grid2">
            <div>
              <label className="fl" htmlFor="birthDate">生年月日</label>
              <input id="birthDate" name="birthDate" type="date" />
            </div>
            <div>
              <label className="fl" htmlFor="height">身長(cm)</label>
              <input id="height" name="height" type="number" step="0.1" inputMode="decimal" />
            </div>
          </div>

          <label className="fl">格闘技の種類{userType === "pro" ? "（副競技・複数可）" : "（複数可）"}</label>
          <div className="seg multi wrap">
            {SPORTS.map((s) => (
              <label key={s.id}><input type="checkbox" name="sports" value={s.id} />{s.label}</label>
            ))}
          </div>

          <div className="grid2">
            <div>
              <label className="fl" htmlFor="currentWeight">現在体重(kg)</label>
              <input id="currentWeight" name="currentWeight" type="number" step="0.1" inputMode="decimal" />
            </div>
            <div>
              <label className="fl" htmlFor="usualWeight">通常体重(kg)</label>
              <input id="usualWeight" name="usualWeight" type="number" step="0.1" inputMode="decimal" />
            </div>
          </div>

          <label className="fl">主な目標（複数可）</label>
          <div className="seg multi wrap">
            {GOALS.map((g) => (
              <label key={g.id}>
                <input type="checkbox" name="goals" value={g.id} onChange={() => toggleGoal(g.id)} />{g.label}
              </label>
            ))}
          </div>

          {wantsTarget && (
            <div className="grid2">
              <div>
                <label className="fl" htmlFor="targetWeight">目標体重(kg)</label>
                <input id="targetWeight" name="targetWeight" type="number" step="0.1" inputMode="decimal" />
              </div>
              <div>
                <label className="fl" htmlFor="targetDate">目標日</label>
                <input id="targetDate" name="targetDate" type="date" />
              </div>
            </div>
          )}

          <label className="fl" htmlFor="weeklyPlanCount">1週間の運動予定回数</label>
          <input id="weeklyPlanCount" name="weeklyPlanCount" type="number" inputMode="numeric" min={0} max={14} />

          {/* 選手の計量・試合情報（任意） */}
          {userType === "pro" && (
            <div className="card tight" style={{ marginTop: 16 }}>
              <b>選手の計量・試合情報（任意）</b>
              <label className="fl">大会団体</label>
              <div className="seg wrap">
                <label><input type="radio" name="promotion" value="none" defaultChecked onChange={() => setPromotion("none")} />指定なし</label>
                <label><input type="radio" name="promotion" value="one" onChange={() => setPromotion("one")} />ONE Championship</label>
                <label><input type="radio" name="promotion" value="other" onChange={() => setPromotion("other")} />その他</label>
              </div>
              {promotion === "one" && (
                <>
                  <label className="fl" htmlFor="contractWeight">契約体重(kg)</label>
                  <input id="contractWeight" name="contractWeight" type="number" step="0.01" inputMode="decimal" />
                  <p className="info-note">ONE選択時は、ハイドレーション対応モードが表示されます。</p>
                </>
              )}
              {promotion !== "one" && (
                <>
                  <label className="check"><input type="checkbox" name="usesHydration" />ハイドレーション（尿比重・HYDRO）検査を使う</label>
                  <p className="info-note">尿比重検査を使わない場合はチェックを外してください（水抜きの体重モニタリングは使えます）。ONE選択時は自動でON。</p>
                </>
              )}
              <div className="grid2">
                <div>
                  <label className="fl" htmlFor="weighInAt">計量日時</label>
                  <input id="weighInAt" name="weighInAt" type="datetime-local" />
                </div>
                <div>
                  <label className="fl" htmlFor="fightAt">試合日時</label>
                  <input id="fightAt" name="fightAt" type="datetime-local" />
                </div>
              </div>
              <label className="fl">計量の種類</label>
              <div className="seg">
                <label><input type="radio" name="weighInType" value="day_before" defaultChecked />前日計量</label>
                <label><input type="radio" name="weighInType" value="same_day" />当日計量</label>
              </div>
              <div className="grid2">
                <div>
                  <label className="fl" htmlFor="pastCutExperience">過去の減量経験</label>
                  <input id="pastCutExperience" name="pastCutExperience" type="text" placeholder="例: 5回" />
                </div>
                <div>
                  <label className="fl" htmlFor="maxCutKg">過去最大の減量幅(kg)</label>
                  <input id="maxCutKg" name="maxCutKg" type="number" step="0.1" inputMode="decimal" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 14 }} />
      <SubmitButton className="btn btn-accent" pendingLabel="登録しています…">この内容で登録する</SubmitButton>
      <p className="info-note" style={{ marginTop: 10 }}>
        登録すると、健康に関するデータ（体重・体調・痛みなど）を記録・保存することに同意したものとします。あとで「目標・設定」からいつでも変更できます。
      </p>
    </form>
  );
}
