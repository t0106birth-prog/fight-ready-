import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { logoutAction } from "@/app/login/actions";
import { updateProfileAction, switchToProAction, switchToMemberAction, setRecoveryAction } from "@/app/u/actions";
import { Hero, UserTabbar } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { OwnerField } from "@/components/OwnerField";
import { QrJoinForm } from "@/components/QrJoinForm";
import { sportLabel, goalLabel, SPORTS, RECOVERY_QUESTIONS } from "@/lib/constants";
import { currentWeight } from "@/lib/derive";
import { round1, ageFrom, businessDate, daysUntil, toDateTimeLocalValue } from "@/lib/calc";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; e?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role === "staff") redirect("/");
  const db = await getDb();
  const gym = db.gyms.find((g) => g.id === user.gymId);
  const isPro = user.role === "pro";
  const cw = currentWeight(db, user);
  const remain = cw != null && user.targetWeight != null ? round1(cw - user.targetWeight) : null;
  const age = ageFrom(user.birthDate);
  // プロは計量日ベース（計量日未設定なら出さない＝目標日を"計量"と誤ラベルしない）、一般は目標日まで
  const cdFromWeighIn = isPro && !!user.weighInAt;
  const cdDate = cdFromWeighIn ? businessDate(new Date(user.weighInAt!)) : isPro ? undefined : user.targetDate;
  const cdDays = daysUntil(cdDate);
  const cdLabel = cdFromWeighIn ? "計量" : "目標日";
  const sportNames = (user.sports ?? []).map((s) => SPORTS.find((x) => x.id === s)?.label).filter(Boolean).join("・");

  // 今回の減量幅（スタート体重 − 目標体重）と、過去の実績（回を重ねたら比較できる）
  const cutRange = user.startWeight != null && user.targetWeight != null ? round1(user.startWeight - user.targetWeight) : null;
  const pastCuts = db.waterCutPeriods
    .filter((p) => p.userId === user.id && p.status === "done")
    .sort((a, b) => (a.startDatetime < b.startDatetime ? 1 : -1))
    .slice(0, 3)
    .map((p) => {
      const pLogs = db.waterCutLogs.filter((l) => l.periodId === p.id).sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1));
      const finalW = pLogs[0]?.currentWeight ?? p.baselineWeight;
      return { id: p.id, date: businessDate(new Date(p.weighInDatetime)), range: round1(p.baselineWeight - finalW) };
    });

  return (
    <>
      <Hero title="マイページ・目標体重を設定" sub={`${user.name}（${isPro ? "選手" : "一般会員"}）`} backHref="/u" />
      <div className="shell">
        {sp.saved === "profile" && <div className="alert-band alert-green"><b>✓</b> 設定を保存しました</div>}
        {sp.saved === "recovery" && <div className="alert-band alert-green"><b>✓</b> 合言葉を設定しました。パスワードを忘れたときに使えます。</div>}
        {sp.e === "recovery" && <div className="alert-band alert-red">質問と答えの両方を入力してください。</div>}
        {sp.saved === "gym" && <div className="alert-band alert-green"><b>✓</b> ジムに参加しました（{gym?.name}）</div>}
        {sp.e === "gymcode" && <div className="alert-band alert-red">チームコードが見つかりませんでした。コードを確認してください。</div>}
        {sp.error === "weight" && <div className="alert-band alert-red">体重は20〜300kgの範囲で入力してください。</div>}
        {sp.error === "sport" && <div className="alert-band alert-red">主競技を選んでください。</div>}
        {sp.error === "fight" && <div className="alert-band alert-red">試合日時または計量日時を入れてください（＝試合に出る＝選手）。</div>}

        {/* ひとつのフォームで 目標・からだ・計量 をまとめて編集 */}
        <form action={updateProfileAction}>
          <OwnerField id={user.id} />
          {/* 目標体重（スタート体重と並べる。どちらも準備ごとに変わる） */}
          <p className="kicker">🎯 目標体重の設定</p>
          <div className="card">
            {/* スタート → 目標 → 残り を一目で */}
            <div className="alert-band" style={{ background: "var(--bg2)", border: "1px solid var(--line)", margin: "0 0 12px", textAlign: "center" }}>
              {user.targetWeight != null ? (
                <>
                  <div style={{ fontSize: 15 }}>
                    <span className="meta">スタート</span>{" "}
                    <b style={{ fontStyle: "italic" }}>{user.startWeight ?? "—"}kg</b>
                    <span className="meta"> → 目標 </span>
                    <b style={{ fontSize: 20, fontStyle: "italic", color: "var(--amber-ink)" }}>{user.targetWeight}kg</b>
                  </div>
                  {remain != null && (
                    <div style={{ marginTop: 6 }}>
                      <span className="meta">現在 {cw}kg ／ 残り </span>
                      <b style={{ fontSize: 26, fontStyle: "italic", color: remain > 0 ? "var(--red-bright)" : "var(--green-bright)" }}>
                        {remain > 0 ? remain : 0}kg
                      </b>
                    </div>
                  )}
                  {cdDays != null && (
                    <div style={{ marginTop: 6, fontWeight: 800 }}>
                      {cdLabel}まで{" "}
                      <span style={{ fontSize: 24, fontStyle: "italic", color: "var(--red-bright)" }}>{cdDays}</span> 日
                    </div>
                  )}
                  {cdDate && <div className="meta" style={{ marginTop: 2 }}>{cdDate} {isPro ? "計量" : "まで"}</div>}

                  {/* 今回の減量幅（スタート−目標）。回を重ねたら前回と比べられる */}
                  {cutRange != null && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                      <span className="meta">今回の減量幅　</span>
                      <b style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink)" }}>{cutRange}kg</b>
                      {pastCuts.length > 0 && (
                        <div className="meta" style={{ marginTop: 4, fontSize: 12 }}>
                          前回まで：{pastCuts.map((c) => `${c.range}kg`).join(" / ")}
                          {"　"}<a href="/u/history">比べる ›</a>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <span className="meta">目標体重はまだ設定されていません。下に入力してください。</span>
              )}
            </div>
            <div className="grid2">
              <div>
                <label className="fl mt0" htmlFor="startWeight">スタート体重(kg)</label>
                <input id="startWeight" name="startWeight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={user.startWeight ?? ""} placeholder="開始時の体重" />
              </div>
              <div>
                <label className="fl mt0" htmlFor="targetWeight">目標体重(kg)</label>
                <input id="targetWeight" name="targetWeight" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={user.targetWeight ?? ""} placeholder="例: 61.2" />
              </div>
            </div>
            <label className="fl" htmlFor="targetDate">{isPro ? "目標日（計量に合わせる）" : "目標日"}</label>
            <input id="targetDate" name="targetDate" type="date" defaultValue={user.targetDate ?? ""} />
            <p className="info-note">スタート体重は、減量・仕上げを始めた時点の体重です。準備ごとに入れ直してください（ここを基準に予定線と「残り何kg」を計算します）。</p>
          </div>

          {/* からだ（身長・生年月日は基本変わらない項目） */}
          <p className="kicker">🧍 からだ</p>
          <div className="card">
            <div className="grid2">
              <div>
                <label className="fl mt0" htmlFor="height">身長(cm)</label>
                <input id="height" name="height" type="number" step="0.1" inputMode="decimal" defaultValue={user.heightCm ?? ""} />
              </div>
              <div>
                <label className="fl mt0" htmlFor="birthDate">生年月日</label>
                <input id="birthDate" name="birthDate" type="date" defaultValue={user.birthDate ?? ""} />
              </div>
            </div>
            <p className="info-note mt0">
              {age != null ? <>現在の年齢：<b style={{ fontSize: 17, fontStyle: "italic", color: "var(--ink)" }}>{age}歳</b>（生年月日から自動計算）</> : "生年月日を入れると年齢が自動で表示されます。"}
            </p>
          </div>

          {/* 食事の目標（食事達成度はこの目標に対して評価する） */}
          <p className="kicker">🍽️ 食事の目標</p>
          <div className="card">
            <label className="fl mt0" htmlFor="foodGoal">今の食事で気をつけること（1つ）</label>
            <input id="foodGoal" name="foodGoal" type="text" defaultValue={user.foodGoal ?? ""} placeholder="例：夜の間食を控える / たんぱく質をとる / 水分をこまめに" maxLength={40} />
            <p className="info-note mt0">毎日の「食事達成度」で、この目標に対して〈目標どおり／だいたいできた／できなかった〉を選びます。</p>
          </div>

          {/* 計量・大会（プロのみ） */}
          {isPro && (
            <>
              <p className="kicker">🥊 計量・大会</p>
              <div className="card">
                <label className="fl mt0" htmlFor="weighInAt">計量日時</label>
                <input id="weighInAt" name="weighInAt" type="datetime-local" defaultValue={toDateTimeLocalValue(user.weighInAt)} />
                <label className="fl" htmlFor="fightAt">試合日時（任意）</label>
                <input id="fightAt" name="fightAt" type="datetime-local" defaultValue={toDateTimeLocalValue(user.fightAt)} />
                <label className="fl">計量の種類</label>
                <div className="seg">
                  <label><input type="radio" name="weighInType" value="day_before" defaultChecked={user.weighInType !== "same_day"} />前日計量</label>
                  <label><input type="radio" name="weighInType" value="same_day" defaultChecked={user.weighInType === "same_day"} />当日計量</label>
                </div>
                <label className="fl">大会団体</label>
                <div className="seg wrap">
                  <label><input type="radio" name="promotion" value="none" defaultChecked={!user.promotion || user.promotion === "none"} />指定なし</label>
                  <label><input type="radio" name="promotion" value="one" defaultChecked={user.promotion === "one"} />ONE</label>
                  <label><input type="radio" name="promotion" value="other" defaultChecked={user.promotion === "other"} />その他</label>
                </div>
                <label className="fl" htmlFor="contractWeight">契約体重(kg・ONEハイドレーション用)</label>
                <input id="contractWeight" name="contractWeight" type="number" min="20" max="300" step="0.01" inputMode="decimal" defaultValue={user.contractWeightKg ?? ""} />
                <label className="check"><input type="checkbox" name="usesHydration" defaultChecked={user.usesHydration !== false} />ハイドレーション（尿比重・HYDRO）検査を使う</label>
                <p className="info-note mt0">アマチュアなど尿比重検査を使わない場合はチェックを外すと、水抜き画面のHYDRO欄が非表示になります（体重モニタリングは使えます）。ONE選択時は自動でONです。</p>
              </div>
            </>
          )}

          <SubmitButton className="btn btn-accent" pendingLabel="保存しています…">この内容で保存する</SubmitButton>
        </form>

        {/* 利用区分の切替：基準は「試合に出るか」。試合を登録＝選手／試合をやめる＝一般会員 */}
        <p className="kicker">🥊 試合に出ますか？（区分の切替）</p>
        {isPro ? (
          <div className="card">
            <p className="mt0"><b>今は「選手」</b>です。計量・水抜きモニタリングが使えます。</p>
            <p className="info-note mt0">試合の予定がなくなった・フィットネス目的に戻すときは、下から「一般会員」に切り替えられます。過去の試合・水抜きの記録は残ります。</p>
            <form action={switchToMemberAction}>
              <OwnerField id={user.id} />
              <SubmitButton className="btn btn-dark" pendingLabel="切り替えています…">一般会員（フィットネス）に切り替える</SubmitButton>
            </form>
          </div>
        ) : (
          <form action={switchToProAction} className="card">
            <OwnerField id={user.id} />
            <p className="mt0"><b>試合に出るなら「選手」</b>に切り替えましょう。計量日・水抜きのモニタリングが使えるようになります。</p>
            <label className="fl" htmlFor="sw_sport">主競技</label>
            <select id="sw_sport" name="primarySport" defaultValue={user.primarySport ?? user.sports?.[0] ?? ""}>
              <option value="" disabled>選んでください</option>
              {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <label className="fl" htmlFor="sw_fight">試合日時</label>
            <input id="sw_fight" name="fightAt" type="datetime-local" />
            <label className="fl" htmlFor="sw_weighin">計量日時（任意）</label>
            <input id="sw_weighin" name="weighInAt" type="datetime-local" />
            <label className="fl">計量の種類</label>
            <div className="seg">
              <label><input type="radio" name="weighInType" value="day_before" defaultChecked />前日計量</label>
              <label><input type="radio" name="weighInType" value="same_day" />当日計量</label>
            </div>
            <p className="info-note mt0">※このアプリは水抜きの「方法」や「落とす量」は指示しません。安全に記録・見守るためのモニタリングです。</p>
            <div style={{ height: 10 }} />
            <SubmitButton className="btn btn-accent" pendingLabel="切り替えています…">選手に切り替える</SubmitButton>
          </form>
        )}

        {/* ジムに参加（QRカメラ / コード手入力） */}
        <p className="kicker">🏋️ ジムに参加・変更</p>
        <QrJoinForm currentGymName={gym?.name} ownerId={user.id} />

        {/* 合言葉（パスワードを忘れたとき用・メール不要のセルフ復旧） */}
        <p className="kicker">🔒 合言葉（パスワードを忘れたとき用）</p>
        <div className="card">
          <p className="mt0">
            {user.recoveryQuestion
              ? <>設定済み：<b>「{user.recoveryQuestion}」</b>（答えは表示されません）</>
              : <b style={{ color: "var(--amber-ink)" }}>まだ未設定です。忘れたときの復旧のため、設定をおすすめします。</b>}
          </p>
          <p className="info-note mt0">パスワードを忘れたとき、この「質問と答え」で自分で再設定できます（メール不要）。答えは覚えやすく、他人に推測されにくいものにしてください。</p>
          <form action={setRecoveryAction}>
            <OwnerField id={user.id} />
            <label className="fl" htmlFor="recoveryQuestion">合言葉の質問</label>
            <select id="recoveryQuestion" name="recoveryQuestion" defaultValue={user.recoveryQuestion ?? ""} required>
              <option value="" disabled>選んでください</option>
              {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              {user.recoveryQuestion && !RECOVERY_QUESTIONS.includes(user.recoveryQuestion) && (
                <option value={user.recoveryQuestion}>{user.recoveryQuestion}</option>
              )}
            </select>
            <label className="fl" htmlFor="recoveryAnswer">答え</label>
            <input id="recoveryAnswer" name="recoveryAnswer" type="text" autoComplete="off" required placeholder="例：柔道" />
            <p className="info-note mt0">大文字・小文字・前後の空白は無視して照合します。</p>
            <div style={{ height: 8 }} />
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel="保存しています…" style={{ width: "100%" }}>
              {user.recoveryQuestion ? "合言葉を更新する" : "合言葉を設定する"}
            </SubmitButton>
          </form>
        </div>

        {/* 変更しない基本情報 */}
        <p className="kicker">アカウント情報</p>
        <div className="card">
          <div className="progress-row"><span className="meta">利用区分</span><b>{isPro ? "選手" : "一般会員"}</b></div>
          <div className="progress-row"><span className="meta">所属ジム</span><b>{gym?.name ?? "—"}</b></div>
          <div className="progress-row"><span className="meta">メール</span><b style={{ fontSize: 14 }}>{user.email}</b></div>
          {age != null && <div className="progress-row"><span className="meta">年齢</span><b>{age}歳</b></div>}
          {isPro && <div className="progress-row"><span className="meta">主競技</span><b>{sportLabel(user.primarySport)}</b></div>}
          <div className="progress-row"><span className="meta">格闘技</span><b style={{ fontSize: 14 }}>{sportNames || "—"}</b></div>
          <div className="progress-row"><span className="meta">週の運動予定</span><b>{user.weeklyPlanCount != null ? `${user.weeklyPlanCount}回` : "—"}</b></div>
          <div style={{ marginTop: 8 }}>
            <span className="meta">目標の種類：</span>{" "}
            {(user.goals ?? []).map((g) => <span key={g} className="badge">{goalLabel(g)}</span>)}
            {(user.goals ?? []).length === 0 && <span className="meta">未設定</span>}
          </div>
        </div>

        <Link href="/u/weekly" className="btn btn-ghost">今週の振り返り</Link>
        <div style={{ height: 10 }} />
        <form action={logoutAction}><button type="submit" className="btn btn-dark">ログアウト</button></form>

        <p className="info-note center" style={{ marginTop: 16 }}><Link href="/lp">サービス紹介</Link></p>
      </div>
      <UserTabbar active="mypage" />
    </>
  );
}
