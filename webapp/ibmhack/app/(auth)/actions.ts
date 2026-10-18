  "use server";

  import { redirect } from "next/navigation";
  import { safeNext } from "../../lib/auth";
  import { createClient } from "../../lib/supabase/server";

  // Builds an auth page URL that keeps ?next= so the user still lands where they were going
  function authUrl(page: "/login" | "/signup", params: Record<string, string>, next: FormDataEntryValue | null) {
      const search = new URLSearchParams(params);
      if (typeof next === "string" && next) search.set("next", next);
      return `${page}?${search}`;
  }

  export async function login(formData: FormData) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
      });
      if (error) redirect(authUrl("/login", { error: error.message }, formData.get("next")));
      redirect(safeNext(formData.get("next")));
  }

  export async function signup(formData: FormData) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
          options: {
              // Read by the handle_new_user trigger
              data: { username: String(formData.get("username")), display_name:
  String(formData.get("displayName")) },
              emailRedirectTo: `${process.env.SITE_URL}/auth/callback`,
          },
      });
      if (error) redirect(authUrl("/signup", { error: error.message }, formData.get("next")));
      // No session means email confirmation is on
      if (!data.session) redirect(authUrl("/login", { message: "Check your email to confirm your account" }, formData.get("next")));
      redirect(safeNext(formData.get("next")));
  }

  export async function signout() {
      const supabase = await createClient();
      // Local scope: end only this browser's session. The default (global) would also sign out the extension.
      await supabase.auth.signOut({ scope: "local" });
      redirect("/");
  }
