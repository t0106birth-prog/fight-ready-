import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HQ_VIEW_COOKIE } from "@/lib/unlock";

// 本部「選手の画面を閲覧」モードを終了して本部へ戻る（GETリンクからも呼べるよう Route Handler）。
export async function GET(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/hq", req.url));
  res.cookies.delete(HQ_VIEW_COOKIE);
  return res;
}
