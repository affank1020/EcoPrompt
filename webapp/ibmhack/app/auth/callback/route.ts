import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNext(searchParams.get("next"));
      // Google sign-ups get a placeholder username until they pick one
      const { data: profile } = await supabase
        .from("profiles")
        .select("username_set")
        .eq("id", data.user.id)
        .single();
      if (profile && !profile.username_set)
        return NextResponse.redirect(
          new URL(`/welcome?next=${encodeURIComponent(next)}`, origin),
        );
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=Could not sign you in", origin),
  );
}
