import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";
import styles from "../auth.module.scss";
import { saveUsername } from "./actions";

async function WelcomeForm({
  searchParams,
}: {
  searchParams: PageProps<"/welcome">["searchParams"];
}) {
  const { error, next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already guards /welcome; this covers an expired session
  if (!user) redirect("/login?next=/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, username_set")
    .eq("id", user.id)
    .single();
  if (profile?.username_set) redirect(safeNext(nextPath));

  return (
    <form action={saveUsername} className={styles.form}>
      <h1 className={styles.title}>Pick a username</h1>
      <p className={styles.subtitle}>This is how you&apos;ll appear on the leaderboard.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <input type="hidden" name="next" value={nextPath} />
      <label className={styles.field}>
        Username
        <input
          name="username"
          type="text"
          required
          pattern="[a-z0-9_]{3,20}"
          title="3–20 characters: lowercase letters, numbers and underscores"
          defaultValue={profile?.username ?? ""}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="username-hint"
        />
        <span id="username-hint" className={styles.hint}>
          3–20 characters: lowercase letters, numbers and underscores.
        </span>
      </label>
      <label className={styles.field}>
        Display name (optional)
        <input
          name="displayName"
          type="text"
          defaultValue={profile?.display_name ?? ""}
          autoComplete="nickname"
        />
      </label>
      <button type="submit" className={styles.submit}>Continue</button>
    </form>
  );
}

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <Suspense>
      <WelcomeForm searchParams={searchParams} />
    </Suspense>
  );
}
