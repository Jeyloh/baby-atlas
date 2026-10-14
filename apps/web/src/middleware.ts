import { NextResponse, type NextRequest } from "next/server";

/**
 * Hands the requested path to the dashboard layout, which cannot see it
 * itself. A signed-out visitor is then sent to the login page with a
 * callbackUrl, so a home screen shortcut or a notification link still lands
 * on the right page after signing in again.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Next adds _rsc to client-side navigations; it must not end up in the login link
  const url = new URL(request.nextUrl);
  url.searchParams.delete("_rsc");
  headers.set("x-pathname", `${url.pathname}${url.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/dashboard/:path*"] };
