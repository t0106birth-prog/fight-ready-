/** ホーム画面に追加する方法（PWAインストール案内）。入口ページに表示する。 */
export function AddToHomeGuide() {
  return (
    <details className="card tight a2hs-guide">
      <summary>
        <b>📲 ホーム画面に追加する方法</b>
        <span className="meta">　次回からアプリのように全画面で開けて便利です</span>
      </summary>
      <div className="a2hs-body">
        <div className="a2hs-block">
          <p className="kicker mt0">iPhoneの方（Safari）</p>
          <ol className="a2hs-steps">
            <li>このページのURLをコピー</li>
            <li>Safariを開いて、URLを貼り付けてアクセス</li>
            <li>画面下の「共有」ボタンをタップ</li>
            <li>「ホーム画面に追加」を選択</li>
          </ol>
        </div>
        <div className="a2hs-block">
          <p className="kicker">Androidの方（Chrome）</p>
          <ol className="a2hs-steps">
            <li>このページのURLをコピー</li>
            <li>Chromeを開いて、URLを貼り付けてアクセス</li>
            <li>右上の「︙」メニューをタップ</li>
            <li>「インストール」または「ホーム画面に追加」を選択</li>
          </ol>
        </div>
        <p className="info-note a2hs-note">
          ※LINE・Instagramなどのアプリ内ブラウザでは、ホーム画面に追加できない場合があります。その場合は、URLをコピー → SafariまたはChromeを開く → URLを貼り付けてアクセスしてください。
        </p>
      </div>
    </details>
  );
}
