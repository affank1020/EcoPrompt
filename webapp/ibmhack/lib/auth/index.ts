import { createClient } from "../supabase/server";
import type { User } from "../types";

export const ANONYMOUS_USER: User = {
  id: "anonymous",
  name: "You",
  isAnonymous: true,
};

export async function getCurrentUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ANONYMOUS_USER;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    name: profile?.display_name ?? profile?.username ?? user.email ?? "You",
    isAnonymous: user.is_anonymous ?? false,
  };
}

// Only allow redirects back into this site
export function safeNext(next: unknown): string {
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//")
    ? next
    : "/dashboard";
}
