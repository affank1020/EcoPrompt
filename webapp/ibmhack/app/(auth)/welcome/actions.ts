"use server";

import { redirect } from "next/navigation";
import { safeNext } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

// Same rule as the profiles_username_format check constraint
const USERNAME = /^[a-z0-9_]{3,20}$/;

export async function saveUsername(formData: FormData) {
  const next = formData.get("next");

  // Back to the form with an error, keeping where the user was headed
  function retry(error: string): never {
    const params = new URLSearchParams({ error });
    if (typeof next === "string" && next) params.set("next", next);
    redirect(`/welcome?${params}`);
  }

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!USERNAME.test(username)) {
    retry("Usernames are 3–20 characters: lowercase letters, numbers and underscores");
  }
  const displayName = String(formData.get("displayName") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name: displayName || null, username_set: true })
    .eq("id", user.id);
  // 23505 is Postgres' unique violation
  if (error?.code === "23505") retry("That username is taken");
  if (error) retry("Couldn't save your username. Try again.");

  redirect(safeNext(next));
}
