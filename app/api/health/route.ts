import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * 本番のデータ保存状態を診断する（秘密は返さない）。HQ暗証番号でガード。
 * 例: /api/health?k=0363037239
 * 恒久機能ではなく、保存不具合の切り分け用。原因が分かったら削除してよい。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expected = process.env.HQ_CODE || "0363037239";
  if (searchParams.get("k") !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storeId = process.env.FR_STORE_ID || (process.env.VERCEL ? "main" : "dev");
  const out: Record<string, unknown> = {
    vercel: !!process.env.VERCEL,
    sessionSecretSet: !!process.env.SESSION_SECRET,
    supabaseUrlSet: !!url,
    serviceKeySet: !!key,
    serviceKeyPrefix: key ? key.slice(0, 10) : null, // sb_secret_ / eyJ... など種別だけ
    storeId,
    supaReadOk: false,
    supaWriteOk: false,
    docUserCount: null as number | null,
    error: null as string | null,
  };

  if (!url || !key) {
    out.error = "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定（＝/tmpの揮発保存になり本番でデータが消える）";
    return NextResponse.json(out);
  }

  try {
    const c = createClient(url, key, { auth: { persistSession: false } });
    const read = await c.from("fight_ready_store").select("doc").eq("id", storeId).maybeSingle();
    if (read.error) {
      out.error = `read: ${read.error.message}`;
      return NextResponse.json(out);
    }
    out.supaReadOk = true;
    out.docUserCount = Array.isArray((read.data as { doc?: { users?: unknown[] } } | null)?.doc?.users)
      ? ((read.data as { doc: { users: unknown[] } }).doc.users.length)
      : 0;
    // 書き込みテスト（診断用の別行に upsert して即削除）
    const testId = `__health_${storeId}`;
    const w = await c.from("fight_ready_store").upsert({ id: testId, doc: {}, updated_at: new Date().toISOString() });
    if (w.error) {
      out.error = `write: ${w.error.message}（RLSや権限で書き込みが弾かれている可能性）`;
      return NextResponse.json(out);
    }
    out.supaWriteOk = true;
    await c.from("fight_ready_store").delete().eq("id", testId);
  } catch (e) {
    out.error = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }
  return NextResponse.json(out);
}
