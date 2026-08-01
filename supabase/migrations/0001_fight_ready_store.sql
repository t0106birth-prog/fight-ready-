-- FIGHT READY 本番データ保存テーブル。
-- アプリ(lib/store.ts)は全データを1行のJSONB(doc)にまとめて読み書きする。
-- アクセスは SUPABASE_SERVICE_ROLE_KEY 経由のみを想定（RLSはサービスロールでバイパスされる）。
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。

create table if not exists public.fight_ready_store (
  id         text primary key,                         -- 例: 'main'（本番） / 'dev'（開発）。env FR_STORE_ID と一致させる
  doc        jsonb       not null default '{}'::jsonb,  -- 全データのスナップショット
  updated_at timestamptz not null default now()
);

-- RLSを有効化。ポリシーを作らない＝anon/authenticated からは全拒否。
-- サーバー側はサービスロールキーで接続するためRLSをバイパスして読み書きできる。
alter table public.fight_ready_store enable row level security;
