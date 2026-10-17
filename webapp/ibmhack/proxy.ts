import { NextResponse } from "next/server";

// TODO(auth): set to true once Supabase Auth is set up
const REQUIRE_AUTH = false;

export function proxy() {
  if (!REQUIRE_AUTH) return NextResponse.next();

  // TODO(auth): take the request as a parameter (request: NextRequest), check the Supabase session
  // cookie and redirect to /login when there isn't one, e.g.
  // return NextResponse.redirect(new URL(`/login?next=${request.nextUrl.pathname}`, request.url));
  return NextResponse.next();
}

// Everything in the (app) route group
export const config = {
  matcher: ["/dashboard/:path*", "/bulk/:path*", "/compare/:path*", "/leaderboard/:path*"],
};
