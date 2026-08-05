import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 本部「選手の画面を閲覧」モード（fr_hq_view Cookie 保持中）は、選手ページ(/u)の
 * 書き込み（Server Actions＝POST 等）をすべて遮断して読み取り専用にする。
 * ・通常の選手・会員は fr_hq_view を持たないので影響なし。
 * ・presence チェックのみ（制限方向なので署名検証は不要）。
 */
export function middleware(req: NextRequest): NextResponse {
  const viewing = req.cookies.get("fr_hq_view");
  if (viewing && req.method !== "GET" && req.method !== "HEAD") {
    return new NextResponse("本部の閲覧モードは読み取り専用です（操作はできません）。", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/u", "/u/:path*"],
};
