# FIGHT READY 本番デプロイ手順（Vercel + Supabase）

コードは本番ビルドが通る状態です。あとは **①Supabaseでデータ保存先を作る → ②環境変数を設定 → ③Vercelでデプロイ** の3ステップ。
鍵の設定・アカウント操作は本人しかできません（🔴＝あなたの作業／🤖＝Claudeが用意済み）。

---

## 前提アカウント（無ければ作成）
- GitHub … コード置き場（Vercelが読む）
- Vercel … ホスティング … https://vercel.com/new
- Supabase … データ保存（無料枠でOK）… https://supabase.com/dashboard/projects

---

## ① Supabase：データ保存テーブルを作る 🔴
1. プロジェクトを新規作成（リージョンは `Northeast Asia (Tokyo)` 推奨）。
2. 左メニュー **SQL Editor** を開く → `New query`。
   直リンク（プロジェクト作成後）: `https://supabase.com/dashboard/project/<プロジェクトID>/sql/new`
3. 🤖 用意済みの SQL を貼り付けて **Run**：
   `supabase/migrations/0001_fight_ready_store.sql` の中身をコピペ。
4. 接続情報を控える（**Settings → API**）:
   `https://supabase.com/dashboard/project/<プロジェクトID>/settings/api`
   - `Project URL` → 後述の `SUPABASE_URL`
   - `service_role`（`secret`表示） → `SUPABASE_SERVICE_ROLE_KEY`
   ⚠️ `service_role` キーは**絶対に公開しない**（クライアントに出さない・GitHubに載せない）。

---

## ② 環境変数を用意する 🔴
Vercel（後述）とローカル `.env.local` の両方で使う。`.env.local.example` が雛形。

| 変数 | 値 | 必須 |
|---|---|---|
| `SESSION_SECRET` | 長いランダム文字列（下のコマンドで生成） | ✅ 未設定だと本番で全ページ500 |
| `SUPABASE_URL` | Supabaseの Project URL | ✅ 無いとデータが揮発（消える） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseの service_role キー | ✅ 同上 |
| `FR_STORE_ID` | `main` | 任意（本番と開発でデータ行を分ける） |
| `NEXT_PUBLIC_QUICK_LOGIN` | `false` | 任意（かんたんログインUIを消す。Vercelでは自動で非表示） |

`SESSION_SECRET` の生成（どちらか）:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
```bash
openssl rand -base64 48
```

> かんたんログイン（パスワード無しの試用ボタン）は**本番では既定で無効**です（サーバー側でも `ALLOW_QUICK_LOGIN=1` が無い限り拒否）。本番で使いたい時だけ `ALLOW_QUICK_LOGIN=1` を足す。

---

## ③ GitHub → Vercel でデプロイ 🔴
1. このフォルダを GitHub リポジトリにプッシュ（🤖 `git init`＋初回コミットは実施済み。リモート追加のみ）:
   ```bash
   git remote add origin https://github.com/<あなた>/fight-ready.git
   git push -u origin main
   ```
2. Vercel で **Add New… → Project** → 上のリポジトリを Import：https://vercel.com/new
3. **Environment Variables** に ② の変数を貼る（`Production` にチェック）。
   Framework は Next.js 自動検出でOK（Build/Outputは既定のまま）。
4. **Deploy** を押す。数分で `https://<プロジェクト>.vercel.app` が発行される。

---

## デプロイ後の確認 🔴
- トップ→ジムスタッフ/選手でログインできる（本番はメール＋パスワード。かんたんログインは非表示）。
- 記録を保存 → 別ブラウザ/再読込でも残る（＝Supabaseに保存されている）。残らなければ ②のSupabase変数を再確認。
- スタッフでログイン履歴・利用者が**自ジム分だけ**見えること。

---

## 既知の制約・本番前TODO（運用規模が上がったら）🔴要判断
- **同時書き込みの競合**：全データを1行JSONBで丸ごと保存する方式のため、複数人が同時刻に書くと後勝ちで一方が消える可能性。単一ジム・低頻度なら実用上問題ないが、規模拡大時は楽観ロック導入が必要。
- **セッション/セキュリティの上乗せ**（未実装）：サーバー側のセッション失効・パスワード変更での無効化、ログイン試行回数制限（レートリミット）。
- 実ユーザー公開時は利用規約・プライバシーポリシーの用意。

---

## まとめ（あなたがやる3つ）
1. Supabaseでプロジェクト作成＋`0001_fight_ready_store.sql`をRun、URL/service_roleキーを控える
2. `SESSION_SECRET`を生成し、Supabaseの2値と一緒にVercelのEnvへ
3. GitHubにpush → VercelでImport → Deploy
