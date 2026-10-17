  "use server";

  import { redirect } from "next/navigation";
  import { safeNext } from "../../lib/auth";
  import { createClient } from "../../lib/supabase/server";

  export async function login(formData: FormData) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
      });
      if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
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
      if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
      // No session means email confirmation is on
      if (!data.session) redirect("/login?message=Check your email to confirm your account");
      redirect("/dashboard");
  }

  export async function signout() {
      const supabase = await createClient();
      await supabase.auth.signOut();
      redirect("/");
  }
