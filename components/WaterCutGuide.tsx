/**
 * 水抜きの使い方ガイド。
 * 「何をすればいいか分からない」を防ぐため、画面上に手順を常に置く。
 * 医療ルール(§30)により、水の止め方・サウナ時間などの手順は一切書かない。
 * ここで案内するのは「アプリの操作手順」だけ。
 */
export function WaterCutGuide({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  const steps = [
    { n: 1, t: "水抜きの開始を登録", d: "基準体重・計量目標・計量日時を入力します（最初の1回だけ）" },
    { n: 2, t: "体重をこまめに記録", d: "記録するたびに減少率が自動計算され、青・黄・赤で表示されます" },
    { n: 3, t: "尿比重を測ったら入力（任意）", d: "屈折計で測った場合のみ。未測定でもOKです" },
    { n: 4, t: "計量が終わったら回復を記録", d: "計量後・試合当日の体重の戻りを残します" },
    { n: 5, t: "終わったら履歴に保存", d: "次回の準備と見比べられます" },
  ];
  return (
    <div className="card">
      {/* アプリの立ち位置を一言で（"やめさせる"ためではない） */}
      <div className="alert-band" style={{ background: "var(--bg2)", border: "1px solid var(--red)", margin: "0 0 12px" }}>
        <b style={{ fontStyle: "italic", letterSpacing: ".02em" }}>
          このアプリは、安全に落とし切って、次に活かすための記録です。
        </b>
      </div>

      <b>📖 使い方（5ステップ）</b>
      <p className="info-note mt0">いまは <b style={{ color: "var(--red-bright)" }}>STEP {step}</b> です。</p>
      {steps.map((s) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <div
            key={s.n}
            style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", marginTop: 6,
              borderRadius: 10,
              background: active ? "var(--red-soft)" : "transparent",
              border: `1px solid ${active ? "var(--red)" : "var(--line)"}`,
              opacity: done ? 0.55 : 1,
            }}
          >
            <span
              style={{
                flex: "none", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 900,
                background: active ? "var(--red)" : done ? "var(--green)" : "var(--surface2)",
                color: active || done ? "#fff" : "var(--muted)",
              }}
            >
              {done ? "✓" : s.n}
            </span>
            <span>
              <b style={{ fontSize: 14.5 }}>{s.t}</b>
              <br />
              <span className="meta" style={{ fontSize: 12.5 }}>{s.d}</span>
            </span>
          </div>
        );
      })}
      <p className="info-note" style={{ marginBottom: 0 }}>
        このアプリは記録と確認のための道具です。水の止め方・サウナ・発汗着などのやり方は案内しません。体調が悪いときは、率に関わらずスタッフや医療専門職に相談してください。
      </p>
    </div>
  );
}
