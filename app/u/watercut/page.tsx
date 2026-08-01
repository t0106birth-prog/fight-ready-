import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { StartWaterCutForm, WaterCutBaselineForm, WaterCutLogForm } from "@/components/WaterCutForms";
import { StatusTile } from "@/components/StatusTile";
import { SubmitButton } from "@/components/SubmitButton";
import { WaterCutGuide } from "@/components/WaterCutGuide";
import { OwnerField } from "@/components/OwnerField";
import { finishWaterCutAction } from "@/app/u/actions";
import { acuteLoss, acuteLossBand, hydroBand, oneHydroBand, oneReadyVerdict, waterCutTable } from "@/lib/judge";
import { activeWaterCut, currentWeight, latestWaterCutLog, latestHydration } from "@/lib/derive";
import { businessDate, untilLabel, round1, fmtDateTime, hoursBetweenIso, signed, toDateTimeLocal } from "@/lib/calc";
import { today } from "@/lib/store";

const bandClass: Record<string, string> = { red: "alert-red", yellow: "alert-yellow", blue: "alert-blue", green: "alert-green" };

export default async function WaterCutPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role !== "pro") redirect("/u");
  const db = await getDb();
  const isOne = user.promotion === "one";
  // アマチュア等は尿比重検査を使わない → HYDRO欄を非表示。ONEは常に表示。
  const showHydro = isOne || user.usesHydration !== false;

  const period = activeWaterCut(db, user.id);

  if (!period) {
    const latestMeasuredWeight = currentWeight(db, user) ?? undefined;
    return (
      <>
        <Hero title="WATER CUT" sub="水抜きモニタリングを始める" backHref="/u/record" />
        <div className="shell">
          {sp.error === "start" && <div className="alert-band alert-red">水抜き開始体重・計量目標を入力し、計量目標の確認にチェックしてください。</div>}
          {sp.error === "unfinished" && <div className="alert-band alert-red">前回の水抜き・回復が未終了です。前回を終了してから新しい準備を開始してください。</div>}
          <WaterCutGuide step={1} />
          {isOne && user.contractWeightKg != null && user.targetWeight != null && user.contractWeightKg !== user.targetWeight && (
            <div className="alert-band alert-yellow">
              <div className="at">計量目標を確認してください</div>
              プロフィール目標は{user.targetWeight}kg、契約体重は{user.contractWeightKg}kgです。今回は契約体重を初期表示しています。
            </div>
          )}
          <p className="kicker">STEP 1　開始を登録する</p>
          <StartWaterCutForm
            ownerId={user.id}
            defaultTarget={isOne ? (user.contractWeightKg ?? user.targetWeight) : user.targetWeight}
            defaultWeighIn={user.weighInAt}
            defaultFight={user.fightAt}
            latestMeasuredWeight={latestMeasuredWeight}
          />
        </div>
        <UserTabbar active="record" />
      </>
    );
  }

  const log = latestWaterCutLog(db, user.id, period.id);
  const current = log?.currentWeight ?? period.baselineWeight;
  const { kg, pct } = acuteLoss(period.baselineWeight, current);
  const remain = round1(current - period.targetWeight);

  // 症状の検出（今日のチェックイン危険症状＋最新HYDRO症状）
  const todayCheck = db.dailyCheckins.find((c) => c.userId === user.id && c.date === today());
  const hydro = latestHydration(db, user.id, period.id);
  const symptoms = [...new Set([...(todayCheck?.dangerSymptoms ?? []), ...(hydro?.symptoms ?? [])])];
  const hasSymptom = symptoms.length > 0;
  const hydrationCaution = todayCheck?.hydrationThirst === "strong" || todayCheck?.urineVolumeStatus === "very_low";

  const band = acuteLossBand(pct, hasSymptom);
  const hb = hydroBand(hydro?.urineSpecificGravity);
  const oneBand = isOne ? oneHydroBand(hydro?.urineSpecificGravity) : null;
  const table = waterCutTable(period.baselineWeight);
  const plannedLoss = acuteLoss(period.baselineWeight, period.targetWeight);
  const lossPctLabel = pct > 0 ? `−${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : "±0%";
  const lossKgLabel = kg > 0 ? `−${kg}kg` : kg < 0 ? `+${Math.abs(kg)}kg` : "±0kg";

  const hydroTone = hb?.level ?? "blue";

  // ONE READY 参考判定
  const oneVerdict =
    isOne && hydro?.urineSpecificGravity != null && hydro?.simultaneousWeight != null && user.contractWeightKg != null
      ? oneReadyVerdict(hydro.urineSpecificGravity, hydro.simultaneousWeight, user.contractWeightKg)
      : null;

  // ハイドレーテッド体重（尿比重1.0250以下で同時測定した体重）
  const hydratedLogs = db.hydrationLogs
    .filter((h) => h.userId === user.id && h.periodId === period.id && h.urineSpecificGravity != null && h.urineSpecificGravity <= 1.025 && h.simultaneousWeight != null)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1));
  const latestHydrated = hydratedLogs[0];

  const showRecovery = new Date(period.weighInDatetime).getTime() <= Date.now();

  /**
   * 記録の推移（観察用。許容量の指示ではない）。
   * 実際の水抜きは計量直前の数時間〜1日に集中するため、日ではなく「経過時間」で見る。
   */
  const logs = db.waterCutLogs
    .filter((l) => l.periodId === period.id)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? -1 : 1));
  const paceRows = logs.map((l, i) => {
    const prev = i > 0 ? logs[i - 1].currentWeight : period.baselineWeight;
    const prevAt = i > 0 ? logs[i - 1].recordedDatetime : period.startDatetime;
    const stepLoss = round1(prev - l.currentWeight);
    const gapH = Math.max(0, hoursBetweenIso(prevAt, l.recordedDatetime));
    const elapsedH = Math.max(0, hoursBetweenIso(period.startDatetime, l.recordedDatetime));
    // 直近の落ち方（1時間あたり）。短時間で大きく落ちているほど注意して見る
    const perHour = gapH > 0.25 ? round1(stepLoss / gapH) : null;
    const cumTone: "red" | "yellow" | "blue" = l.acuteLossPercentage >= 5 ? "red" : l.acuteLossPercentage >= 2 ? "yellow" : "blue";
    return { ...l, stepLoss, gapH: Math.round(gapH * 10) / 10, elapsedH: Math.round(elapsedH * 10) / 10, perHour, cumTone };
  });
  // 直近の落ち方が急かどうか（記録・注意喚起のみ。許容量は示さない）
  const lastRow = paceRows[paceRows.length - 1];
  const rapid = lastRow?.perHour != null && lastRow.perHour >= 0.5;

  /**
   * 選手は「食事で◯kgまで落とし、残りは計量直前に水で抜く」という考え方で減量する。
   * そのため “残り何kg” が最重要の数字。ここでは残りkgと、それが基準体重の何%にあたるかを示す。
   * ※ これは自分の数字の言い換え（観察）であり、「その量を抜いてよい」という許可ではない(§30)。
   */
  const remainPct = period.baselineWeight > 0 ? Math.round((remain / period.baselineWeight) * 1000) / 10 : 0;

  /** 過去の準備の実績（自分が実際にどう落としたかが一番の判断材料になる） */
  const pastPeriods = db.waterCutPeriods
    .filter((p) => p.userId === user.id && p.id !== period.id)
    .sort((a, b) => (a.startDatetime < b.startDatetime ? 1 : -1));
  const pastSummaries = pastPeriods.slice(0, 3).map((p) => {
    const pLogs = db.waterCutLogs.filter((l) => l.periodId === p.id).sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1));
    const finalW = pLogs[0]?.currentWeight ?? p.baselineWeight;
    const a = acuteLoss(p.baselineWeight, finalW);
    const hours = pLogs[0] ? Math.round(hoursBetweenIso(p.startDatetime, pLogs[0].recordedDatetime)) : null;
    return { id: p.id, date: businessDate(new Date(p.weighInDatetime)), kg: a.kg, pct: a.pct, hours };
  });

  return (
    <>
      <Hero title="WATER CUT / HYDRO" sub="記録・参考表示・警告のための機能です" backHref="/u/record" />
      <div className="shell">
        {sp.saved === "recovery" && <div className="alert-band alert-green"><b>✓</b> 計量後の回復を記録しました</div>}
        {sp.saved === "baseline" && <div className="alert-band alert-green"><b>✓</b> 水抜き開始体重を更新し、減少率を再計算しました</div>}
        {sp.error === "baseline" && <div className="alert-band alert-red">水抜き開始体重を正しく入力してください。</div>}
        {sp.error === "current" && <div className="alert-band alert-red">現在体重を20〜300kgの範囲で入力してください。</div>}
        {sp.error === "finish" && <div className="alert-band alert-yellow">回復記録と終了確認が必要です。試合日時を登録済みの場合は、試合終了後に保存してください。</div>}
        {sp.error === "recovery-time" && <div className="alert-band alert-red">計量日時より前に回復記録を保存することはできません。</div>}

        {/* いま何をすればいいか（1行で示す） */}
        <div className="alert-band alert-blue">
          <div className="at">👉 いまやること</div>
          {showRecovery
            ? "計量は終わりました。リカバリー体重は「毎日の記録」の〈計量後のリカバリー〉から入れてください。"
            : logs.length === 0
              ? "下の「現在体重を記録」に、いまの体重を入れてください。入れると減少率が自動で出ます。"
              : "体重が変わったら「現在体重を記録」に入れてください。尿比重を測った場合はHYDROにも入力できます。"}
        </div>

        {/* 強制赤判定(§29) */}
        {hasSymptom && (
          <div className="alert-band alert-red">
            <div className="at">強い体調異常が入力されています</div>
            水抜きや運動を続ける前に、周囲のスタッフへ伝え、必要に応じて医療機関へ相談してください。（{symptoms.join("・")}）
          </div>
        )}

        {hydrationCaution && !hasSymptom && (
          <div className="alert-band alert-yellow">
            <div className="at">水分状態の気になる変化があります</div>
            強い口渇、または尿がほとんど出ない状態が記録されています。体重変化と体調を合わせて確認してください。
          </div>
        )}

        <WaterCutBaselineForm ownerId={user.id} baselineWeight={period.baselineWeight} />

        {/* 現在地とゴールを先に示し、その下に実務・安全の2つの主役を並べる */}
        <div className="status-grid watercut-context">
          <StatusTile tile={{ lbl: "現在体重", val: `${round1(current)}kg`, tone: "blue" }} />
          <StatusTile tile={{ lbl: "計量目標", val: `${period.targetWeight}kg`, tone: "blue" }} />
        </div>

        <div className="grid2 watercut-heroes">
          {/* ① 残り */}
          <div className="card" style={{ textAlign: "center", borderColor: remain > 0 ? "var(--amber)" : "var(--green)" }}>
            <div className="lbl" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>計量まで あと</div>
            <div className="big-num" style={{ fontSize: 40, color: remain > 0 ? "var(--amber-ink)" : "var(--green-bright)" }}>
              {remain > 0 ? remain : 0}<span className="unit" style={{ fontSize: 15 }}>kg</span>
            </div>
            <div className="meta" style={{ fontSize: 12 }}>目標 {period.targetWeight}kg まで</div>
          </div>
          {/* ② 開始体重からの減少率 */}
          <div className="card" style={{ textAlign: "center", borderColor: `var(--${band.level === "blue" ? "blue" : band.level === "yellow" ? "amber" : band.level === "red" ? "red" : "green"})` }}>
            <div className="lbl" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>開始体重から</div>
            <div className="big-num" style={{ fontSize: 40, color: band.level === "red" ? "var(--red-bright)" : band.level === "yellow" ? "var(--amber-ink)" : "#6bb0ff" }}>
              {lossPctLabel}
            </div>
            <div className="watercut-baseline">
              <span>水抜き開始</span>
              <b>{period.baselineWeight}kg</b>
            </div>
            <div style={{ fontSize: 13.5, marginTop: 2, color: "var(--ink)", fontWeight: 700 }}>
              開始から {lossKgLabel}（{lossPctLabel}）
            </div>
          </div>
        </div>

        {period.status === "active" && (
          <>
            <p className="kicker">STEP 2　現在体重を記録</p>
            <WaterCutLogForm ownerId={user.id} defaultWeight={current} />
          </>
        )}

        {/* 時間とHYDROは主指標を補足する情報としてまとめる */}
        <div className="card tight watercut-support">
          <div>
            <span className="meta">計量まで</span>
            <b>{untilLabel(period.weighInDatetime)}</b>
          </div>
          {showHydro && (
            <div>
              <span className="meta">HYDRO</span>
              <b className={`tile-${hydroTone}`}>{hydro?.urineSpecificGravity?.toFixed(isOne ? 4 : 3) ?? "未測定"}</b>
            </div>
          )}
        </div>

        {/* 過去の準備の実績（自分の実績が一番の判断材料） */}
        {pastSummaries.length > 0 && (
          <div className="card tight">
            <b>前回までの実績（あなた自身の記録）</b>
            <p className="info-note mt0">過去に計量へ向けて、実際にどれだけ・どれくらいの時間で落としたかです。今回の目安として自分で判断する材料にしてください。</p>
            {pastSummaries.map((s) => (
              <div className="progress-row" key={s.id} style={{ fontSize: 13 }}>
                <span>{s.date} 計量</span>
                <span><b>{signed(-s.kg, "kg")}（{signed(-s.pct, "%")}）</b>{s.hours != null && <span className="meta"> ／ 約{s.hours}時間</span>}</span>
              </div>
            ))}
            <Link href="/u/history" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>過去の詳細記録を見る</Link>
          </div>
        )}

        {/* 急性減少率の参考区分(§25) */}
        <div className={`alert-band ${bandClass[band.level]}`}>
          <div className="at">{band.title}</div>
          {band.message}
        </div>

        {/* 何%で注意・危険か（開始体重からの減少率の目安） */}
        <p className="kicker">危険度の早見表（何%で注意・危険か）</p>
        <div className="card tight">
          <table className="reftable">
            <thead><tr><th>開始体重からの減少率</th><th>アプリの表示</th></tr></thead>
            <tbody>
              <tr style={band.level === "blue" ? { outline: "2px solid var(--blue)" } : undefined}>
                <td className="k" style={{ color: "#6bb0ff" }}>0〜2%未満</td><td>参考範囲（継続して確認）</td>
              </tr>
              <tr style={band.level === "yellow" ? { outline: "2px solid var(--amber)" } : undefined}>
                <td className="k" style={{ color: "var(--amber-ink)" }}>2〜5%未満</td><td>注意（体調・水分を確認）</td>
              </tr>
              <tr style={band.level === "red" ? { outline: "2px solid var(--red)" } : undefined}>
                <td className="k" style={{ color: "var(--red-bright)" }}>5%以上</td><td>危険（専門家の確認を推奨）</td>
              </tr>
            </tbody>
          </table>
          <p className="info-note" style={{ marginBottom: 0 }}>
            いまのあなたは <b style={{ color: "var(--ink)" }}>{lossPctLabel}</b>。
            <b>症状があるときは、率に関わらず「危険（赤）」</b>になります。これは監視のための目安で、安全な水抜き量を示すものではありません。
          </p>
        </div>

        {/* 急な変化だけは安全のため主画面で警告。記録の一覧は履歴の詳細で見る */}
        {rapid && (
          <div className="alert-band alert-yellow">
            <div className="at">短時間で大きく変化しています</div>
            体調・水分状態をこまめに確認してください。
          </div>
        )}
        {logs.length > 0 && (
          <Link href={`/u/history/${period.id}`} className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
            📋 これまでの記録（{logs.length}件）を見る
          </Link>
        )}

        {/* 水抜き早見表(§26) */}
        <p className="kicker">水抜き早見表</p>
        <div className="card tight">
          <p className="meta mt0">あなたの水抜き開始体重 {period.baselineWeight}kg に対する割合</p>
          <table className="reftable">
            <thead><tr><th>開始から</th><th>減少量</th><th>その時の体重</th></tr></thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.pct}>
                  <td className="k">{r.pct}%</td>
                  <td>{r.kg}kg</td>
                  <td><b>{r.weight}kg</b></td>
                </tr>
              ))}
              <tr className="watercut-target-row">
                <td className="k">計量目標<br /><span className="meta">{plannedLoss.pct}%</span></td>
                <td>{plannedLoss.kg}kg</td>
                <td><b>{period.targetWeight}kg</b></td>
              </tr>
            </tbody>
          </table>
          <p className="info-note">この表は体重減少率を確認するための参考表示です。許容可能な水抜き量や、安全な水抜き量を示すものではありません。</p>
        </div>

        {/* HYDRO（水分状態）。アマチュア等 usesHydration=false は非表示 */}
        {showHydro && (
        <>
        <p className="kicker">STEP 3　HYDRO（水分状態）</p>
        <div className="card">
          <p className="mt0" style={{ fontSize: 14 }}>
            <b>体重だけでは分からない「水分の減り具合」を見る欄です。</b>
          </p>
          <p className="info-note mt0">
            尿比重（屈折計で測る数値）を入れると、水分がどれくらい濃くなっているかの目安が出ます。
            <b>測っていなければ空欄のままでOK</b>。尿の色や症状だけでも記録できます。
          </p>

          {/* 現在の状態 */}
          <div className="progress-row">
            <span className="meta">いまの尿比重</span>
            <b>{hydro?.urineSpecificGravity != null ? hydro.urineSpecificGravity.toFixed(isOne ? 4 : 3) : "未測定"}</b>
          </div>
          {hb ? (
            <div className={`alert-band ${bandClass[hb.level]}`} style={{ margin: "8px 0" }}>
              <div className="at">{hb.title}</div>{hb.message}
            </div>
          ) : (
            <div className="alert-band alert-blue" style={{ margin: "8px 0" }}>
              まだ測定していません。<b>未測定でも問題ありません</b>が、症状や急な体重減少があれば、測定の有無に関わらず警告します。
            </div>
          )}

          {/* 目安の早見（読み方） */}
          <table className="reftable">
            <thead><tr><th>尿比重</th><th>アプリの表示</th></tr></thead>
            <tbody>
              <tr><td className="k">1.020 以下</td><td>参考基準内</td></tr>
              <tr><td className="k">1.021〜1.029</td><td>注意（濃くなっている可能性）</td></tr>
              <tr><td className="k">1.030 以上</td><td>危険領域（強く濃縮の可能性）</td></tr>
            </tbody>
          </table>
          <p className="info-note">尿比重が基準内でも安全を保証するものではありません。体重変化と症状を合わせて確認してください。</p>

          <Link href="/u/watercut/hydro" className="btn btn-primary btn-sm" style={{ width: "100%" }}>
            💧 HYDROを記録する（尿比重・尿の色・症状）
          </Link>
        </div>
        </>
        )}

        {/* ONE Championship モード */}
        {isOne && (
          <>
            <p className="kicker">ONE Championship 対応</p>
            <div className="card">
              <p className="meta mt0">契約体重: <b>{user.contractWeightKg ?? "—"}kg</b>（ONE公式参考基準: 尿比重 1.0250 以下）</p>
              {oneBand && (
                <div className={`alert-band ${bandClass[oneBand.level]}`}>
                  <div className="at">{oneBand.title}</div>{oneBand.message}
                </div>
              )}
              {oneVerdict && (
                <div className={`alert-band ${bandClass[oneVerdict.level === "green" ? "green" : oneVerdict.level]}`}>
                  <div className="at">{oneVerdict.label}</div>{oneVerdict.reasons.join(" ")}
                </div>
              )}
              {latestHydrated && (
                <div className="card tight">
                  <b>ハイドレーテッド体重</b>
                  <div className="progress-row"><span>最新（尿比重1.0250以下で同時測定）</span><b>{round1(latestHydrated.simultaneousWeight!)}kg</b></div>
                  <div className="progress-row"><span>契約体重までの差</span><b>{round1(latestHydrated.simultaneousWeight! - (user.contractWeightKg ?? 0))}kg</b></div>
                  <p className="info-note mt0">脱水状態で測定した低い体重ではなく、水分がある状態の体重です。</p>
                </div>
              )}
              <p className="info-note">
                ONE公式計量は大会の24〜48時間前に実施され、先にハイドレーションテスト（尿比重1.0250以下）に合格してから体重測定を行います。公式スタッフの測定結果が最終結果です。このアプリはプレチェックと記録のための参考機能です。
              </p>
            </div>
          </>
        )}

        {/* 計量後のリカバリーは水抜き画面には入れない。記録タブの専用カードから入力する */}
        {showRecovery && (
          <div className="alert-band alert-blue">
            <div className="at">計量おつかれさまでした</div>
            計量後のリカバリー体重は、<Link href="/u/record" style={{ color: "#cfe4ff", textDecoration: "underline" }}>「毎日の記録」の〈計量後のリカバリー〉</Link>から入れてください。入れると今回の準備データにまとまります。
          </div>
        )}

        {/* 終了して履歴に保存 / 過去の履歴 */}
        <p className="kicker">STEP 5　この水抜きの記録</p>
        <Link href="/u/history" className="btn btn-ghost" style={{ width: "100%" }}>📚 過去の水抜き・試合準備の履歴</Link>
        {period.status === "recovery" ? (
          <form action={finishWaterCutAction} style={{ marginTop: 10 }}>
            <OwnerField id={user.id} />
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" name="finishConfirmed" required />
              試合・回復記録が完了し、この準備を履歴へ保存することを確認しました
            </label>
            <SubmitButton className="btn btn-dark" pendingLabel="保存中…">試合準備を終了して履歴に保存する</SubmitButton>
          </form>
        ) : <p className="info-note center">計量後の回復を記録すると、試合準備を終了できます。</p>}
        <p className="info-note center">終了すると今回のデータは履歴に残り、次回の準備と比較できます。</p>

        {/* 使い方ガイド（迷ったときに見返せるよう下部にも置く） */}
        <p className="kicker">使い方</p>
        <WaterCutGuide step={showRecovery ? 4 : 2} />

        {/* 禁止事項の注意(§30) */}
        <div className="card tight" style={{ marginTop: 16 }}>
          <p className="info-note mt0">
            このアプリは記録・参考表示・警告に限定します。水を止める時間、サウナ・入浴時間、発汗着・利尿薬・下剤などの具体的な脱水手順や、「あと何kg落とせる」といった指示は行いません。症状が強い場合は医療専門職へ相談してください。
          </p>
          {log && <p className="info-note">最終記録: {fmtDateTime(log.recordedDatetime)}</p>}
        </div>
      </div>
      <UserTabbar active="record" />
    </>
  );
}
