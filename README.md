# FIGHT READY

格闘技ジム専用・プロ選手コンディション＆一般会員継続管理アプリ（MVP・試作版）

**落とすだけでは、勝てない。** — 体重・トレーニング・疲労・回復を、ひとつに。

スマートフォン中心のレスポンシブWebアプリ。ログイン・初回登録・毎日の記録・体重推移・疲労/回復判定・水抜きモニタリング・パーソナル管理・ジムスタッフ画面まで、実際に操作・保存・判定できます。UI/UXは姉妹プロジェクト「成長見守り手帳」を基準にしています。

---

## 1. 起動方法（ローカル）

```bash
cd fight-ready
npm install
npm run dev
```

ブラウザで <http://localhost:3201> を開く。トップの「かんたんログイン（お試し用）」からパスワードなしで各画面を確認できます。

- Supabase 未設定でも動作します（データは `data/db.json` に保存＝リロード後も保持）。
- 環境変数 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定すると、`fight_ready_store` テーブルの1行(JSONB)に保存します。
- `.env.local.example` を `.env.local` にコピーして設定。

### テスト用アカウント（デモデータ・全て架空）

パスワードは全員 `fight-2026`。ジム: FIGHT BASE Tokyo。

| 区分 | 氏名 | メール | 状態 |
|---|---|---|---|
| ジムスタッフ | ジムスタッフ | `staff@fightbase.jp` | 全利用者を確認 |
| プロ選手 | 山田タケル | `takeru@example.com` | 緑・計量21日前・順調 |
| プロ選手 | 佐藤レン | `ren@example.com` | 黄・計量5日前・水抜き2.8%・睡眠不良 |
| プロ選手 | 高橋カイト | `kaito@example.com` | 赤・ONE・計量18h前・水抜き5.2%・めまい |
| 一般会員 | 田中美咲 | `misaki@example.com` | 緑・ボディメイクキャンプ・パーソナル受講中 |
| 一般会員 | 鈴木一郎 | `ichiro@example.com` | 黄・停滞・パーソナル体験候補 |

---

## 2. プロジェクト構成

```
fight-ready/
├── app/
│   ├── page.tsx                 # 入口（2つの大きなカード：選手・一般 / スタッフ）
│   ├── lp/                       # 販売用ランディングページ
│   ├── login/                   # staff / user ログイン + actions
│   ├── register/                # 初回登録（プロ/一般＋格闘技種目）
│   ├── u/                        # 利用者（プロ・一般）
│   │   ├── page.tsx              # ホーム（今日やること・進捗・状態タイル）
│   │   ├── record/              # 今日のチェック/運動/ランニング/休養/食事
│   │   ├── watercut/            # 水抜き/HYDRO/ONE/計量後回復
│   │   ├── graphs / personal / weekly / mypage
│   │   └── actions.ts            # 記録の保存アクション
│   └── staff/                    # ジムスタッフ
│       ├── page.tsx              # ダッシュボード（サマリー＋今日確認する利用者）
│       ├── users/               # 一覧（フィルタ・並び替え）
│       ├── user/[id]/           # 利用者詳細＋フォロー対応
│       ├── personal / follow / settings
├── components/                   # フォーム・グラフ・身体マップ・タブバー等
├── lib/
│   ├── types.ts                  # データモデル（§45 の全テーブル）
│   ├── store.ts                  # ドキュメント型ストア（Supabase or ローカルJSON）
│   ├── auth.ts                   # セッション（HMAC署名Cookie）・権限
│   ├── judge.ts                  # 判定ロジック（緑黄赤・水抜き・HYDRO・ONE）
│   ├── derive.ts / staff.ts      # 画面用の派生値・スタッフ集計
│   ├── constants.ts / calc.ts / seed.ts
├── public/                       # manifest.json・sw.js・アイコン（PWA）
└── data/db.json                  # ローカル保存（gitignore）
```

主要コンポーネント: `BodyMap`（身体マップ痛み記録）, `MorningForm`, `RunningForm`, `HydrationForm`（ONE対応）, `WaterCutForms`, `LineChart`/`MetricRow`（グラフ）, `StatusTile`, `SigBadge`, `Nav`（タブバー/ヘッダー）。

---

## 3. データベース構成

ドキュメント型（`lib/types.ts` の `DB`）に §45 の全テーブル相当を配列で保持:
gyms, users(profiles/user_roles/user_combat_sports/goals/fight_events 相当を統合), dailyCheckins(daily_checkins + weight_logs), painLogs, activityLogs, runningLogs, restDayLogs, nutritionLogs, waterCutPeriods, waterCutLogs, hydrationLogs, weighInRecoveries, camps, ptPlans, ptSessions, ptInquiries, attendanceLogs, followupLogs, history, logins。

担当コーチ／担当トレーナー／チャット／コメント関連テーブルは**作っていません**（§5, §45）。本格運用時は正規化テーブルへ移行（型は列名に寄せてあります）。

---

## 4. ロジック概要

### 通常時の緑・黄・赤判定（`dailyVerdict` §34-35）
- **赤**: 危険症状の入力 / 強い痛み / 強いだるさ＋強い疲労の同時 / 急激な体重減少 / 休養後の悪化。
- **黄**: 疲労・だるさ・睡眠不良が2日以上継続 / 今日の動きが2回連続重い / 運動量急増 / 同じ場所の痛み3日以上 / 7日以上完全休養なし / 休養後も改善せず / （一般）記録・来館の停滞。
- **緑**: 上記に該当なし。
- 病名は断定せず（§35）、「疲労蓄積傾向」等の表現に限定。

### 水抜き判定（`acuteLossBand` §25 / §29）
- 急性体重減少率 =（開始時基準体重−現在体重）÷開始時基準体重×100。
- 0–2%=参考範囲（青）/ 2–5%=注意（橙）/ 5%以上=危険（赤）。
- **症状があれば減少率に関係なく赤を優先**。水を止める時間等の指示は一切しない（§30）。
- 早見表: 基準体重の1〜5%相当kgを自動計算（§26）。

### HYDRO / ONE（`hydroBand` / `oneHydroBand` / `oneReadyVerdict`）
- 尿比重（任意入力）: 1.020以下=参考基準内 / 1.021–1.029=注意 / 1.030以上=危険。
- **ONE Championship**: 1.0250以下=基準内（1.0200以下=余裕/参考、1.0201–1.0250=境界域）、1.0250超=基準外。小数第4位まで保存、入力範囲1.0000–1.0500。
- 尿比重＋同時測定体重で ONE READY 参考 / HYDRATION OK・WEIGHT OVER / WEIGHT OK・HYDRATION OUT を判定。ハイドレーテッド体重（1.0250以下で測定した体重）を履歴保存。公式合格は保証しない旨を明記。

### パーソナル管理（§20）
- プラン（契約/実施/残り/次回）・セッション記録・体験希望（`ptInquiries`）。担当トレーナーは持たず、全スタッフが閲覧・更新可。スタッフ画面に「提案候補」として表示（自動推奨しない）。

### 権限（§47）
- Cookie セッション（HMAC-SHA256 署名）。プロ・一般は自分のデータのみ。スタッフは所属ジム内の全プロ・一般を閲覧・更新（`canView`/`gymMembers`）。他ジムは不可。スタッフ間で権限差なし。全操作を `history` に記録。

---

## 5. 必要な環境変数

| 変数 | 用途 | 本番 |
|---|---|---|
| `SESSION_SECRET` | セッション署名鍵 | **必須**（未設定だと本番は例外） |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 永続化先 | 任意（未設定はローカルJSON） |
| `FR_STORE_ID` | データ行の分離 | 任意 |
| `NEXT_PUBLIC_QUICK_LOGIN` | かんたんログイン | `false`で無効。本番(Vercel)は自動無効 |

---

## 6. 実装済み機能（§48）

入口/ログイン/初回登録、プロ・一般・スタッフの権限分け（スタッフ統一）、格闘技種目登録、今日のチェック（だるさ含む）、身体マップ痛み記録、運動記録、ランニング（カテゴリー・ダッシュ本数）、オフ日/休養日、食事達成度、キャンプ、パーソナル（プラン/セッション/体験希望）、体重グラフ（予定線・計量/試合/水抜きマーカー）、疲労・回復グラフ、緑黄赤判定、水抜きモニタリング・急性減少率・早見表、HYDRO・尿比重・危険症状赤判定、ONE Championship対応、計量後回復記録、スタッフ一覧、フォロー候補・対応履歴、週間振り返り、デモデータ、LP、Supabase/ローカル保存、リロード保持、PWA(manifest/sw)。

## 7. 未実装（§49・意図的に対象外）

担当コーチ/トレーナー、チャット/コメント/プッシュ、オンライン決済・予約確定、各種ヘルスデバイス連携、食事写真AI解析・詳細カロリー、AIによる水抜き手順・水分量指示、医療診断、退会予測AI、SNS/ランキング。

---

## 8. 本番公開前の対応（要対応）

- 🔴 `SESSION_SECRET` を強いランダム値で設定。
- 🔴 Supabase 本番プロジェクト作成 + `fight_ready_store` テーブル作成。将来的に正規化テーブル＋Row Level Security へ移行。
- 🔴 かんたんログインの削除（`NEXT_PUBLIC_QUICK_LOGIN=false` は自動だが、本番前にコードごと除去推奨）。
- 🔴 健康関連データの取り扱いを利用規約・プライバシーポリシーに明記（雛形ページは未作成）。
- パスワード再発行/メール確認フロー、スタッフアカウント発行UIは未実装。

## 9. 既知の制約

- ストアは単一プロセス想定の全体保存。多人数同時書き込みの厳密な整合は本格運用時に正規化＋トランザクションで対応。
- グラフは自前SVG（外部ライブラリ不使用）。
- 体重の目標「残り」は現在体重−目標体重の単純差。

## 10. 次期開発の優先順位

1. 利用規約/プライバシー/同意フロー（健康データ）
2. Supabase 正規化＋RLS、スタッフアカウント発行UI
3. パスワード/メール確認・通知
4. 週次まとめの自動生成・履歴閲覧の拡充
5. （必要なら）デバイス連携・決済
