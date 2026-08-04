import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Hero, UserTabbar } from "@/components/Nav";
import { StartWaterCutForm, WaterCutBaselineForm, WaterCutLogForm } from "@/components/WaterCutForms";
import { StatusTile } from "@/components/StatusTile";
import { SubmitButton } from "@/components/SubmitButton";
import { WaterCutGuide } from "@/components/WaterCutGuide";
import { WaterCutPhaseBar } from "@/components/WaterCutPhaseBar";
import { PhaseSafetyTips } from "@/components/PhaseSafetyTips";
import { LineChart, type CPoint } from "@/components/Chart";
import { OwnerField } from "@/components/OwnerField";
import { finishWaterCutAction, startCutPhaseAction, revertToLoadingAction, startWeighInPhaseAction, saveActualWeighInAction } from "@/app/u/actions";
import { acuteLoss, acuteLossBand, hydroBand, oneHydroBand, oneReadyVerdict, waterCutTable } from "@/lib/judge";
import { activeWaterCut, currentWeight, latestWaterCutLog, latestHydration, waterCutPhase, periodSummary } from "@/lib/derive";
import { untilLabel, round1, fmtDateTime, hoursBetweenIso, signed, businessDate } from "@/lib/calc";
import { EMERGENCY_SYMPTOMS } from "@/lib/constants";
import { today } from "@/lib/store";

const bandClass: Record<string, string> = { red: "alert-red", yellow: "alert-yellow", blue: "alert-blue", green: "alert-green" };

const PHASE_GUIDE: Record<string, string> = {
  loading: "水分量・体重・体調の変化を記録し、異常があればスタッフへ伝えてください。",
  cut: "水抜き中です。体重と症状を記録し、体調を最優先にしてください。",
  weighin: "計量おつかれさま。次はリカバリーです。",
  recovery: "計量後の回復を記録すると、この準備を終えられます。",
  done: "",
};

export default async function WaterCutPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role !== "pro") redirect("/u");
  const db = await getDb();
  const isOne = user.promotion === "one";
  const showHydro = isOne || user.usesHydration !== false;

  const period = activeWaterCut(db, user.id);

  // ── まだ準備を始めていない：開始フォームだけ ──
  if (!period) {
    const latestMeasuredWeight = currentWeight(db, user) ?? undefined;
    return (
      <>
        <Hero title="計量準備をはじめる" sub="ローディング→水抜き→計量→回復" backHref="/u/record" />
        <div className="shell">
          {sp.error === "start" && <div className="alert-band alert-red">開始体重・計量目標を入力し、計量目標の確認にチェックしてください。</div>}
          {sp.error === "unfinished" && <div className="alert-band alert-red">前回の準備が未終了です。前回を終了してから新しい準備を開始してください。</div>}
          {isOne && user.contractWeightKg != null && user.targetWeight != null && user.contractWeightKg !== user.targetWeight && (
            <div className="alert-band alert-yellow">
              <div className="at">計量目標を確認してください</div>
              プロフィール目標は{user.targetWeight}kg、契約体重は{user.contractWeightKg}kg。今回は契約体重を初期表示しています。
            </div>
          )}
          <StartWaterCutForm
            ownerId={user.id}
            defaultTarget={isOne ? (user.contractWeightKg ?? user.targetWeight) : user.targetWeight}
            defaultWeighIn={user.weighInAt}
            defaultFight={user.fightAt}
            latestMeasuredWeight={latestMeasuredWeight}
          />
          <details className="card tight" style={{ marginTop: 10 }}>
            <summary><b>使い方</b></summary>
            <div style={{ marginTop: 10 }}><WaterCutGuide step={1} /></div>
          </details>
        </div>
        <UserTabbar active="record" />
      </>
    );
  }

  // ── 進行中：フェーズ本体 ──
  const phase = waterCutPhase(period);
  // 水抜き開始体重があればそれを基準に（ローディングで増えた"山"から水抜きの%を測る）
  const effBaseline = period.cutBaselineWeight ?? period.baselineWeight;
  const log = latestWaterCutLog(db, user.id, period.id);
  const current = period.status === "recovery" && period.actualWeighInWeight != null
    ? period.actualWeighInWeight
    : log?.currentWeight ?? effBaseline;
  const { kg, pct } = acuteLoss(effBaseline, current);
  const remain = round1(current - period.targetWeight);
  const todayWaterL = log?.waterIntakeLiters ?? null;

  const todayCheck = db.dailyCheckins.find((c) => c.userId === user.id && c.date === today());
  const hydro = latestHydration(db, user.id, period.id);
  const symptoms = [...new Set([...(todayCheck?.dangerSymptoms ?? []), ...(hydro?.symptoms ?? [])])];
  const hasSymptom = symptoms.length > 0;
  const hasEmergency = symptoms.some((s) => EMERGENCY_SYMPTOMS.includes(s));
  const hydrationCaution = todayCheck?.hydrationThirst === "strong" || todayCheck?.urineVolumeStatus === "very_low";

  const band = acuteLossBand(pct, hasSymptom);
  const hb = hydroBand(hydro?.urineSpecificGravity);
  const oneBand = isOne ? oneHydroBand(hydro?.urineSpecificGravity) : null;
  const table = waterCutTable(effBaseline);
  const plannedLoss = acuteLoss(effBaseline, period.targetWeight);
  const lossPctLabel = pct > 0 ? `−${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : "±0%";
  const lossKgLabel = kg > 0 ? `−${kg}kg` : kg < 0 ? `+${Math.abs(kg)}kg` : "±0kg";
  const hydroTone = hb?.level ?? "blue";
  const bandTone = band.level === "blue" ? "blue" : band.level === "yellow" ? "yellow" : band.level === "red" ? "red" : "green";

  const oneVerdict =
    isOne && hydro?.urineSpecificGravity != null && hydro?.simultaneousWeight != null && user.contractWeightKg != null
      ? oneReadyVerdict(hydro.urineSpecificGravity, hydro.simultaneousWeight, user.contractWeightKg)
      : null;
  const hydratedLogs = db.hydrationLogs
    .filter((h) => h.userId === user.id && h.periodId === period.id && h.urineSpecificGravity != null && h.urineSpecificGravity <= 1.025 && h.simultaneousWeight != null)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? 1 : -1));
  const latestHydrated = hydratedLogs[0];

  const showRecovery = period.status === "recovery";

  const logs = db.waterCutLogs
    .filter((l) => l.periodId === period.id)
    .sort((a, b) => (a.recordedDatetime < b.recordedDatetime ? -1 : 1));
  const waterLogs = logs.filter((l) => l.waterIntakeLiters != null);
  // 体重の推移グラフ（開始体重＝ローディング開始点から、水抜きまで通しで）。帯＝水抜き期間。
  const chartPoints: CPoint[] = [
    { d: period.startDatetime, y: round1(period.baselineWeight) },
    ...logs.map((l) => ({ d: l.recordedDatetime, y: round1(l.currentWeight) })),
  ];
  const chartBand = period.cutStartedAt ? { from: period.cutStartedAt, to: period.weighInDatetime } : null;
  const paceRows = logs.map((l, i) => {
    const prevAt = i > 0 ? logs[i - 1].recordedDatetime : period.startDatetime;
    const stepLoss = round1((i > 0 ? logs[i - 1].currentWeight : period.baselineWeight) - l.currentWeight);
    const gapH = Math.max(0, hoursBetweenIso(prevAt, l.recordedDatetime));
    return { perHour: gapH > 0.25 ? round1(stepLoss / gapH) : null };
  });
  const rapid = paceRows.length > 0 && paceRows[paceRows.length - 1].perHour != null && paceRows[paceRows.length - 1].perHour! >= 0.5;

  // 過去の準備の要約（表示専用）。水抜き開始後は cutBaseline 基準、最大減少率は全ログから、実測計量値を優先。
  const pastSummaries = db.waterCutPeriods
    .filter((p) => p.userId === user.id && p.id !== period.id)
    .sort((a, b) => (a.startDatetime < b.startDatetime ? 1 : -1))
    .slice(0, 3)
    .map((p) => ({ id: p.id, date: businessDate(new Date(p.weighInDatetime)), summary: periodSummary(db, p) }));

  return (
    <>
      <Hero title="計量準備" sub="ローディング→水抜き→計量→回復" backHref="/u/record" />
      <div className="shell">
        {sp.saved === "recovery" && <div className="alert-band alert-green"><b>✓</b> 計量後の回復を記録しました</div>}
        {sp.saved === "weighin" && <div className="alert-band alert-green"><b>✓</b> 計量時の最終体重を記録しました</div>}
        {sp.saved === "baseline" && <div className="alert-band alert-green"><b>✓</b> 開始体重を更新し、減少率を再計算しました</div>}
        {sp.error === "current" && <div className="alert-band alert-red">現在体重を20〜300kgの範囲で入力してください。</div>}
        {sp.error === "cutbaseline" && <div className="alert-band alert-red">水抜き開始体重を20〜300kgの範囲で入力してください。</div>}
        {sp.error === "baseline" && <div className="alert-band alert-red">開始体重を正しく入力してください。</div>}
        {sp.error === "finish" && <div className="alert-band alert-yellow">回復記録と終了確認が必要です。試合終了後に保存してください。</div>}
        {sp.error === "recovery-time" && <div className="alert-band alert-red">計量日時より前に回復記録は保存できません。</div>}
        {sp.error === "weighin-weight" && <div className="alert-band alert-red">計量時の最終体重を20〜300kgで入力してください。</div>}

        {/* 今どのフェーズか＋スキップ */}
        <WaterCutPhaseBar phase={phase} />
        {phase === "loading" && (
          <form action={startCutPhaseAction} style={{ marginTop: 4, marginBottom: 10 }}>
            <OwnerField id={user.id} />
            <input type="hidden" name="cutBaseline" value={round1(current)} />
            <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…" style={{ width: "100%" }}>ローディングをスキップ → 水抜きへ</SubmitButton>
          </form>
        )}
        {phase === "cut" && (
          <div className="grid2" style={{ marginTop: 4, marginBottom: 10 }}>
            <form action={revertToLoadingAction}>
              <OwnerField id={user.id} />
              <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="戻しています…" style={{ width: "100%" }}>← ローディングに戻す</SubmitButton>
            </form>
            <form action={startWeighInPhaseAction}>
              <OwnerField id={user.id} />
              <SubmitButton className="btn btn-primary btn-sm" pendingLabel="進めています…" style={{ width: "100%" }}>計量までスキップ →</SubmitButton>
            </form>
          </div>
        )}
        {phase === "weighin" && period.status === "active" && (
          <form action={saveActualWeighInAction} className="card tight" style={{ borderColor: "var(--blue)", marginTop: 6 }}>
            <OwnerField id={user.id} />
            <b>⚖️ 計量時の最終体重</b>
            <p className="info-note mt0">公式計量で確定した数字を入力してください。保存すると計量後の回復記録へ進みます。</p>
            <label className="fl" htmlFor="actualWeighInWeight">計量結果(kg)</label>
            <input id="actualWeighInWeight" name="actualWeighInWeight" type="number" min="20" max="300" step="0.01" inputMode="decimal" defaultValue={period.actualWeighInWeight ?? round1(current)} required />
            <div style={{ height: 8 }} />
            <SubmitButton className="btn btn-primary" pendingLabel="保存しています…" style={{ width: "100%" }}>この体重で計量を確定する</SubmitButton>
          </form>
        )}

        {/* 安全アラート（あるときだけ主張する）。症状は減少率が低くても赤。 */}
        {hasSymptom && (
          <div className="alert-band alert-red">
            <div className="at">危険な症状があります</div>
            減量・水抜きを中止し、周囲の人へ知らせてください。重い症状や意識障害がある場合は、直ちに救急要請を検討してください。（{symptoms.join("・")}）
            {hasEmergency && <div style={{ marginTop: 6, fontWeight: 800 }}>🚑 緊急性の高い症状です。ためらわず救急要請（119）を検討してください。</div>}
          </div>
        )}
        {/* 5%以上は折りたたみの中だけでなく、常に上部で赤警告する（§5） */}
        {pct >= 5 && (
          <div className="alert-band alert-red">
            <div className="at">5%以上の急性減少です</div>
            危険域のため、これ以上進める前に専門家へ確認してください。（いま {lossPctLabel}）
          </div>
        )}
        {hydrationCaution && !hasSymptom && (
          <div className="alert-band alert-yellow">
            <div className="at">水分状態の気になる変化</div>
            強い口渇、または尿がほとんど出ない状態です。体重と体調を合わせて確認してください。
          </div>
        )}

        {/* フェーズ別ヒーロー：今の主役の数字だけ大きく */}
        {phase === "loading" ? (
          <div className="card" style={{ textAlign: "center", borderColor: "var(--blue)" }}>
            <div className="lbl" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>水分ローディング（今日）</div>
            <div className="big-num" style={{ fontSize: 40, color: "#6bb0ff" }}>{todayWaterL ?? "—"}<span className="unit" style={{ fontSize: 15 }}>L</span></div>
            <div className="meta" style={{ fontSize: 12 }}>
              {period.loadingTargetLiters ? `目標 ${period.loadingTargetLiters}L ／ ` : ""}現在 {round1(current)}kg
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", borderColor: remain > 0 ? "var(--amber)" : "var(--green)" }}>
            <div className="lbl" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>計量まで あと</div>
            <div className="big-num" style={{ fontSize: 44, color: remain > 0 ? "var(--amber-ink)" : "var(--green-bright)" }}>{remain > 0 ? remain : 0}<span className="unit" style={{ fontSize: 16 }}>kg</span></div>
            <div className="meta" style={{ fontSize: 12 }}>現在 {round1(current)}kg → 目標 {period.targetWeight}kg</div>
          </div>
        )}

        {/* 補助の3数字 */}
        <div className="status-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
          <StatusTile tile={{ lbl: "開始から", val: lossPctLabel, tone: bandTone }} />
          {(showHydro || hydro?.urineSpecificGravity != null)
            ? <StatusTile tile={{ lbl: "HYDRO", val: hydro?.urineSpecificGravity?.toFixed(isOne ? 4 : 3) ?? "未測定", tone: hydroTone }} />
            : <StatusTile tile={{ lbl: phase === "cut" ? "水抜き開始" : "開始体重", val: `${effBaseline}kg`, tone: "blue" }} />}
          <StatusTile tile={{ lbl: "計量まで", val: untilLabel(period.weighInDatetime), tone: "blue" }} />
        </div>

        {/* 今のフェーズの一言ガイド */}
        {PHASE_GUIDE[phase] && (
          <div className="alert-band alert-blue"><div className="at">👉 今のフェーズ</div>{PHASE_GUIDE[phase]}</div>
        )}

        {/* 今日のポイント：現在フェーズの安全案内（重要2件＋すべて見る）。赤警告があれば上に出す。 */}
        {phase !== "done" && (
          <PhaseSafetyTips
            phase={phase}
            redWarning={hasSymptom
              ? "危険な症状があります。減量・水抜きを中止し、周囲の人へ知らせてください。"
              : pct >= 5
                ? "5%以上の急性減少です。これ以上進める前に専門家へ確認してください。"
                : null}
          />
        )}

        {/* 今日の記録（体重＋水分量＋電解質） */}
        {period.status === "active" && (
          <>
            <p className="kicker">今日の記録</p>
            <WaterCutLogForm ownerId={user.id} defaultWeight={current} phase={phase === "loading" ? "loading" : "cut"} loadingTarget={period.loadingTargetLiters} />
            {waterLogs.length > 0 && (
              <div className="card tight">
                <b>水分量の推移</b>
                {waterLogs.slice(-6).map((l) => (
                  <div className="progress-row" key={l.id} style={{ fontSize: 13 }}>
                    <span>{fmtDateTime(l.recordedDatetime)}</span>
                    <span><b>{l.waterIntakeLiters}L</b>{l.tookElectrolyte ? <span className="meta"> ・電解質✓</span> : null}<span className="meta"> ／ {round1(l.currentWeight)}kg</span></span>
                  </div>
                ))}
              </div>
            )}

            {/* 体重の推移グラフ（ローディング〜水抜き通し・帯＝水抜き期間） */}
            {chartPoints.length >= 2 && (
              <div className="card">
                <b>体重の推移（ローディング〜水抜き）</b>
                <p className="info-note mt0">薄い帯の部分が「水抜き」期間です。ローディングで上がり、水抜きで下がる流れが見えます。</p>
                <LineChart points={chartPoints} hLine={{ y: period.targetWeight, label: `目標 ${period.targetWeight}kg` }} band={chartBand} height={180} />
              </div>
            )}

            {/* 水抜きの目安（参考）：ローディングと揃えて水抜き期にも置く */}
            {phase === "cut" && (
              <details className="card tight">
                <summary><b>水抜きの目安（参考）</b></summary>
                <div style={{ marginTop: 8 }}>
                  <p className="meta mt0">水抜き開始 {effBaseline}kg に対する、減少率ごとの体重（参考であり、抜いてよい量の指示ではありません）。</p>
                  <table className="reftable">
                    <thead><tr><th>開始から</th><th>減少量</th><th>その時の体重</th></tr></thead>
                    <tbody>
                      {table.map((r) => <tr key={r.pct}><td className="k">{r.pct}%</td><td>{r.kg}kg</td><td><b>{r.weight}kg</b></td></tr>)}
                      <tr className="watercut-target-row"><td className="k">計量目標<br /><span className="meta">{plannedLoss.pct}%</span></td><td>{plannedLoss.kg}kg</td><td><b>{period.targetWeight}kg</b></td></tr>
                    </tbody>
                  </table>
                  <p className="info-note">症状があるときは率に関わらず「危険（赤）」。体調を最優先に。</p>
                </div>
              </details>
            )}
          </>
        )}

        {/* フェーズを進める：ローディング→水抜き。ここで"水抜き開始体重"を改めて記録する */}
        {phase === "loading" && period.plan === "loadingonly" && (
          <p className="info-note center">この準備は「ローディングのみ（水抜きなし）」。計量まで体重を見守ります。必要なら下から水抜きへ進めます。</p>
        )}
        {phase === "loading" && (
          <form action={startCutPhaseAction} className="card tight" style={{ borderColor: "var(--blue)" }}>
            <OwnerField id={user.id} />
            <b>💧 水抜きを開始する</b>
            <p className="info-note mt0">ローディングを終えて水を絞り始めるとき。<b>いまの体重</b>を入れて開始します（この体重を基準に水抜きの%を測ります）。</p>
            <label className="fl" htmlFor="cutBaseline">水抜き開始体重(kg)</label>
            <input id="cutBaseline" name="cutBaseline" type="number" min="20" max="300" step="0.1" inputMode="decimal" defaultValue={round1(current)} required />
            <div style={{ height: 8 }} />
            <SubmitButton className="btn btn-primary" pendingLabel="開始中…" style={{ width: "100%" }}>この体重で「水抜き」へ進む</SubmitButton>
          </form>
        )}

        {/* ONE Championship：尿比重(ハイドレーション)が主役なので主画面に出す */}
        {isOne && (
          <div className="card" style={{ borderColor: "var(--blue)" }}>
            <b>💧 ONE ハイドレーション</b>
            <div className="progress-row" style={{ marginTop: 4 }}><span className="meta">尿比重</span><b className={`tile-${hydroTone}`}>{hydro?.urineSpecificGravity != null ? hydro.urineSpecificGravity.toFixed(4) : "未測定"}</b></div>
            <div className="progress-row"><span className="meta">契約体重</span><b>{user.contractWeightKg ?? "—"}kg</b><span className="meta">（基準 1.0250 以下）</span></div>
            {oneBand && <div className={`alert-band ${bandClass[oneBand.level]}`} style={{ margin: "8px 0 0" }}><div className="at">{oneBand.title}</div>{oneBand.message}</div>}
            {oneVerdict && <div className={`alert-band ${bandClass[oneVerdict.level === "green" ? "green" : oneVerdict.level]}`} style={{ margin: "8px 0 0" }}><div className="at">{oneVerdict.label}</div>{oneVerdict.reasons.join(" ")}</div>}
            {latestHydrated && (
              <div className="card tight" style={{ marginTop: 8 }}>
                <b>ハイドレーテッド体重</b>
                <div className="progress-row"><span>最新（尿比重1.0250以下で同時測定）</span><b>{round1(latestHydrated.simultaneousWeight!)}kg</b></div>
                <div className="progress-row"><span>契約体重までの差</span><b>{round1(latestHydrated.simultaneousWeight! - (user.contractWeightKg ?? 0))}kg</b></div>
              </div>
            )}
            <Link href="/u/watercut/hydro" className="btn btn-primary btn-sm" style={{ width: "100%", marginTop: 8 }}>💧 尿比重・体重を記録する</Link>
            <p className="info-note mt0">ONE公式は計量前にハイドレーションテスト（尿比重1.0250以下）合格→体重測定。公式結果が最終。これはプレチェック用です。</p>
          </div>
        )}

        {/* 尿比重(HYDRO)：どのフェーズでも記録できるよう、独立したカードで（詳しく見るの外・上に置く） */}
        {!isOne && !showRecovery && (
          <div className="card tight" style={{ borderColor: "var(--blue)" }}>
            <div className="row">
              <b>💧 尿比重・HYDRO</b>
              {hydro?.urineSpecificGravity != null && <b className={`tile-${hydroTone}`}>{hydro.urineSpecificGravity.toFixed(3)}</b>}
            </div>
            <p className="info-note mt0">尿比重・尿の色・症状を記録できます（測ったときに入れてください）。</p>
            <Link href="/u/watercut/hydro" className="btn btn-primary btn-sm" style={{ width: "100%" }}>尿比重・HYDROを記録する</Link>
          </div>
        )}

        {/* 計量後：リカバリー案内 */}
        {showRecovery && (
          <div className="alert-band alert-blue">
            <div className="at">計量おつかれさまでした</div>
            リカバリー体重は<Link href="/u/watercut/recovery" style={{ color: "#cfe4ff", textDecoration: "underline" }}>こちら</Link>から入れてください。今回の準備データにまとまります。
          </div>
        )}

        {rapid && (
          <div className="alert-band alert-yellow"><div className="at">短時間で大きく変化しています</div>体調・水分状態をこまめに確認してください。</div>
        )}

        {/* ── くわしく見る（早見表・HYDRO・ONE・過去実績・注意をすべて畳む）── */}
        <details className="card tight" style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer" }}><b>▾ くわしく見る</b><span className="meta">　危険度の早見表・過去の実績・使い方・注意</span></summary>
          <div style={{ marginTop: 12 }}>
            <div className={`alert-band ${bandClass[band.level]}`} style={{ marginTop: 0 }}>
              <div className="at">{band.title}</div>{band.message}（いま {lossPctLabel}／{lossKgLabel}）
            </div>

            <WaterCutBaselineForm ownerId={user.id} baselineWeight={period.baselineWeight} />

            <p className="kicker">危険度の早見表（開始体重からの減少率）</p>
            <table className="reftable">
              <tbody>
                <tr style={band.level === "blue" ? { outline: "2px solid var(--blue)" } : undefined}><td className="k" style={{ color: "#6bb0ff" }}>0〜2%未満</td><td>参考範囲</td></tr>
                <tr style={band.level === "yellow" ? { outline: "2px solid var(--amber)" } : undefined}><td className="k" style={{ color: "var(--amber-ink)" }}>2〜5%未満</td><td>注意</td></tr>
                <tr style={band.level === "red" && pct < 6 ? { outline: "2px solid var(--red)" } : undefined}><td className="k" style={{ color: "var(--red-bright)" }}>5〜6%未満</td><td>危険域（これ以上進める前に専門家へ確認）</td></tr>
                <tr style={band.level === "red" && pct >= 6 && pct < 7 ? { outline: "2px solid var(--red)" } : undefined}><td className="k" style={{ color: "var(--red-bright)" }}>6〜7%未満</td><td>危険度がさらに高い</td></tr>
                <tr style={band.level === "red" && pct >= 7 ? { outline: "2px solid var(--red)" } : undefined}><td className="k" style={{ color: "var(--red-bright)" }}>7%以上</td><td>極めて高い危険域</td></tr>
              </tbody>
            </table>
            <p className="info-note"><b>5%以上はすべて危険域です。</b> 6%・7%は「場合によって安全」という意味ではなく、危険度の上昇を見落とさないための参考表示です。症状があるときは率に関わらず危険（赤）。これは安全な水抜き量を示すものではありません。</p>

            {showHydro && (
              <>
                <p className="kicker">HYDRO（尿比重）の読み方</p>
                {hb && <div className={`alert-band ${bandClass[hb.level]}`} style={{ margin: "8px 0" }}><div className="at">{hb.title}</div>{hb.message}</div>}
                <table className="reftable">
                  <tbody>
                    <tr><td className="k">1.020 以下</td><td>参考基準内</td></tr>
                    <tr><td className="k">1.021〜1.029</td><td>注意</td></tr>
                    <tr><td className="k">1.030 以上</td><td>危険領域</td></tr>
                  </tbody>
                </table>
                <Link href="/u/watercut/hydro" className="btn btn-primary btn-sm" style={{ width: "100%", marginTop: 8 }}>💧 HYDROを記録する</Link>
              </>
            )}

            {pastSummaries.length > 0 && (
              <>
                <p className="kicker">前回までの実績（あなた自身）</p>
                {pastSummaries.map((s, i) => (
                  <div key={s.id} style={{ fontSize: 13, marginBottom: 10 }}>
                    <div className="progress-row">
                      <span>{s.date} 計量</span>
                      <span><b>最大 {signed(-s.summary.maxLossPct, "%")}（{signed(-s.summary.maxLossKg, "kg")}）</b></span>
                    </div>
                    <div className="progress-row">
                      <span className="meta">{s.summary.actualWeighInWeight != null ? `実測計量 ${round1(s.summary.actualWeighInWeight)}kg` : `最終記録 ${s.summary.finalWeight}kg`}</span>
                      <span className="meta">{s.summary.symptomCount > 0 ? `症状記録 ${s.summary.symptomCount}回` : "症状記録なし"}</span>
                    </div>
                    {i === 0 && <Link href={`/u/history/${s.id}`} className="small">前回の計量準備を振り返る ›</Link>}
                  </div>
                ))}
              </>
            )}

            {logs.length > 0 && <Link href={`/u/history/${period.id}`} className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8 }}>📋 これまでの記録（{logs.length}件）</Link>}
            <Link href="/u/history" className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 6 }}>📚 過去の準備の履歴</Link>

            <p className="info-note" style={{ marginTop: 12 }}>
              このアプリは記録・参考表示・警告に限定します。水を止める時間・サウナ・発汗着・利尿薬などの脱水手順や「あと何kg落とせる」の指示は行いません。症状が強い場合は医療専門職へ相談してください。
            </p>
            <WaterCutGuide step={showRecovery ? 4 : 2} />
          </div>
        </details>

        {/* 終了して履歴に保存 */}
        {period.status === "recovery" && (
          <form action={finishWaterCutAction} style={{ marginTop: 12 }}>
            <OwnerField id={user.id} />
            <p className="kicker">振り返り（任意）</p>
            <p className="info-note mt0">次回の準備に活かすためのメモです。空欄でも保存できます。</p>
            <label className="fl" htmlFor="reviewWentWell">うまくいったこと</label>
            <textarea id="reviewWentWell" name="reviewWentWell" rows={2} defaultValue={period.reviewWentWell ?? ""} />
            <label className="fl" htmlFor="reviewDifficulties">困ったこと</label>
            <textarea id="reviewDifficulties" name="reviewDifficulties" rows={2} defaultValue={period.reviewDifficulties ?? ""} />
            <label className="fl" htmlFor="reviewNextChanges">次回変えること</label>
            <textarea id="reviewNextChanges" name="reviewNextChanges" rows={2} defaultValue={period.reviewNextChanges ?? ""} />
            <div style={{ height: 8 }} />
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" name="finishConfirmed" required />
              試合・回復記録が完了し、この準備を履歴へ保存することを確認しました
            </label>
            <SubmitButton className="btn btn-dark" pendingLabel="保存中…" style={{ width: "100%" }}>この準備を終了して履歴に保存</SubmitButton>
          </form>
        )}
      </div>
      <UserTabbar active="record" />
    </>
  );
}
