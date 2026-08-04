import Link from "next/link";

export const metadata = { title: "FIGHT READY — 格闘技ジム専用コンディション管理", robots: { index: false } };

export default function LandingPage() {
  return (
    <div>
      <div className="lp-hero">
        <div className="brand-logo" style={{ fontSize: 40 }}>FIGHT <span className="r">READY</span></div>
        <p style={{ fontWeight: 800, fontSize: 18, marginTop: 14 }}>落とすだけでは、勝てない。</p>
        <p style={{ fontWeight: 900, fontSize: 22, margin: "10px auto 0", maxWidth: 520 }}>
          一人で戦わない。<span style={{ color: "var(--red-bright)" }}>チームで、仕上げる。</span>
        </p>
        <p className="meta" style={{ maxWidth: 520, margin: "10px auto 0" }}>
          体重・トレーニング・疲労・回復をチームでひとつにまとめる、格闘技ジム専用コンディション管理アプリ。
          選手は自分の状態をチームに分け合い、ジムはみんなを見守り・支える。
        </p>
        <p className="brand-en">MAKE WEIGHT. STAY STRONG. FIGHT READY.</p>
      </div>

      <div className="shell">
        <section className="lp-section">
          <h2>プロ選手へ</h2>
          <p>計量に間に合わせるだけではなく、試合当日に動ける状態を作る。体重の進捗、落とす速度、疲労・睡眠・痛み、水抜き・HYDRO状態を一つの画面で。</p>
          <ul>
            <li>目標体重までの進捗と、落とす速度が速すぎないかが分かる</li>
            <li>計量直前の水抜き状態・急性体重減少率を見える化</li>
            <li>ONE Championship のハイドレーション参考基準にも対応</li>
            <li>急激な体重減少や脱水の危険サインを早く確認</li>
          </ul>
        </section>

        <section className="lp-section">
          <h2>一般会員へ</h2>
          <p>プロと同じ方法で、あなたの身体を仕上げる。ダイエットを「我慢」ではなく「身体を仕上げる期間」として。</p>
          <ul>
            <li>体重だけでなく、運動・睡眠・疲労・回復もまとめて記録</li>
            <li>キャンプ（目標期間）で進捗が見える</li>
            <li>パーソナルトレーニングの進捗が分かる</li>
            <li>ジムに見守られている安心感</li>
          </ul>
        </section>

        <section className="lp-section">
          <h2>ジムへ</h2>
          <p>プロ選手のコンディション、一般会員の継続、パーソナルトレーニングを一つの画面で管理。</p>
          <ul>
            <li>今日、確認するべき利用者が分かる</li>
            <li>疲労・痛みが強い利用者、水抜き危険領域の選手を早く確認</li>
            <li>来館や記録が止まった会員を退会前にフォロー</li>
            <li>パーソナルの受講状況・体験希望者を管理し、継続提案につなげる</li>
          </ul>
        </section>

        <div className="card tight" style={{ margin: "20px 0 40px" }}>
          <p className="info-note mt0">
            本アプリは健康関連データ（体重・体調・痛みなど）を記録・保存します。医療診断は行わず、水抜き方法の指示もしません。症状が強い場合は医療専門職へ相談してください。
          </p>
          <p className="center" style={{ marginBottom: 0 }}><Link href="/">← 入口へ</Link></p>
        </div>
      </div>
    </div>
  );
}
