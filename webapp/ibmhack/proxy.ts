  import { createServerClient } from "@supabase/ssr";
  import { NextResponse, type NextRequest } from "next/server";

  // Everything in the (app) route group
  const PROTECTED = ["/dashboard", "/bulk", "/compare", "/leaderboard", "/welcome"];

  export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name,
  value, options));
          },
        },
      },
    );

    // Also refreshes an expired session, so keep this call even on public routes
    const { data } = await supabase.auth.getClaims();

    const path = request.nextUrl.pathname;
    const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
    if (!data?.claims && isProtected) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`,
  request.url));
    }
    return response;
  }

  // Run on everything except static assets, so the session cookie stays fresh
  export const config = {
    matcher:
  ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
  };
