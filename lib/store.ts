/**
 * データ層（seicho-mimamori の実績ある方式を踏襲）。
 *
 * 保存先は2段構え:
 *  1. Supabase（SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY があるとき）
 *     - `fight_ready_store` テーブルの1行(id指定)に全データをJSONBで保存。
 *  2. ローカルJSONファイル（開発時・Supabase未設定時のフォールバック）
 *     - data/db.json。これで「リロード後も保持」(§50)を満たす。
 *
 * 接続失敗時はファイル保存へ自動フォールバックし、アプリは止まらない。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./types";
import { seed } from "./seed";
import { businessDate } from "./calc";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "fight-ready-data")
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORE_TABLE = "fight_ready_store";
const STORE_ID = process.env.FR_STORE_ID || (process.env.VERCEL ? "main" : "dev");
const RETRY_MS = 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __frDb: DB | undefined;
  // eslint-disable-next-line no-var
  var __frSupa: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __frSupaDown: number | undefined;
}

export function uid(): string {
  return randomUUID();
}
export function nowIso(): string {
  return new Date().toISOString();
}
export function today(): string {
  return businessDate();
}

function supaDown(): boolean {
  const t = globalThis.__frSupaDown;
  if (!t) return false;
  if (Date.now() - t > RETRY_MS) {
    globalThis.__frSupaDown = undefined;
    return false;
  }
  return true;
}

function supa(): SupabaseClient | null {
  if (!SUPA_URL || !SUPA_KEY) return null;
  if (!globalThis.__frSupa) {
    globalThis.__frSupa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  }
  return globalThis.__frSupa;
}

function loadFile(): DB | null {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as DB;
  } catch {
    /* 壊れていたらシードし直す */
  }
  return null;
}

function saveFile(db: DB): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1), "utf-8");
  } catch {
    /* 書き込めない環境ではメモリのみで続行 */
  }
}

export async function getDb(): Promise<DB> {
  const client = supa();
  if (client && !supaDown()) {
    const { data, error } = await client.from(STORE_TABLE).select("doc").eq("id", STORE_ID).maybeSingle();
    if (!error) {
      if (data?.doc) {
        globalThis.__frDb = data.doc as DB;
        return globalThis.__frDb;
      }
      const seeded = globalThis.__frDb ?? loadFile() ?? seed();
      globalThis.__frDb = seeded;
      await client.from(STORE_TABLE).upsert({ id: STORE_ID, doc: seeded, updated_at: nowIso() });
      return seeded;
    }
    console.warn(`[fight-ready] Supabase読み込み失敗（${error.message}）。ローカル保存に切替。`);
    globalThis.__frSupaDown = Date.now();
  }
  if (!globalThis.__frDb) {
    globalThis.__frDb = loadFile() ?? seed();
    saveFile(globalThis.__frDb);
  }
  return globalThis.__frDb;
}

async function saveDb(): Promise<void> {
  const db = globalThis.__frDb;
  if (!db) return;
  const client = supa();
  if (client && !supaDown()) {
    const { error } = await client.from(STORE_TABLE).upsert({ id: STORE_ID, doc: db, updated_at: nowIso() });
    if (!error) return;
    console.warn(`[fight-ready] Supabase書き込み失敗（${error.message}）。ローカル保存に切替。`);
    globalThis.__frSupaDown = Date.now();
  }
  saveFile(db);
}

/** 読み込み→変更→保存。試作は単一プロセス想定で、全体保存で十分。 */
export async function mutateDb<R>(fn: (db: DB) => R): Promise<R> {
  const db = await getDb();
  const result = fn(db);
  await saveDb();
  return result;
}

/** 追記専用（記録・履歴など増える一方のデータ） */
export async function appendRow<K extends keyof DB>(
  key: K,
  item: DB[K] extends (infer T)[] ? T : never
): Promise<void> {
  const db = await getDb();
  (db[key] as unknown[]).push(item);
  await saveDb();
}

export async function history(
  gymId: string,
  actorId: string | undefined,
  action: string,
  resource?: string,
  detail?: string
): Promise<void> {
  await appendRow("history", { id: uid(), gymId, actorId, action, resource, detail, createdAt: nowIso() });
}
