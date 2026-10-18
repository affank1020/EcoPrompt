import Link from "next/link";
import { Suspense } from "react";
import { login } from "../actions";
import { GoogleButton } from "../../../components/auth/GoogleButton";
import styles from "../auth.module.scss";

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error, message, next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "";
  // Keep ?next= when switching to sign up, so the user still lands where they were going
  const signupHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";
  return (
    <form action={login} className={styles.form}>
      <h1 className={styles.title}>Log in</h1>
      <p className={styles.subtitle}>Welcome back. Pick up where you left off.</p>
      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <input type="hidden" name="next" value={nextPath} />
      <label className={styles.field}>
        Email <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className={styles.field}>
        Password <input name="password" type="password" required autoComplete="current-password" />
      </label>
      <button type="submit" className={styles.submit}>Log in</button>
      <div className={styles.divider}>or</div>
      <GoogleButton className={styles.google} next={nextPath} />
      <p className={styles.footer}>
        No account? <Link href={signupHref}>Sign up</Link>
      </p>
    </form>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}
