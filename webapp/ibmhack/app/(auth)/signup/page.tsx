import Link from "next/link";
import { Suspense } from "react";
import { signup } from "../actions";
import { GoogleButton } from "@/components/auth/GoogleButton";
import styles from "../auth.module.scss";

async function SignupForm({
  searchParams,
}: {
  searchParams: PageProps<"/signup">["searchParams"];
}) {
  const { error, message, next } = await searchParams;
  return (
    <form action={signup} className={styles.form}>
      <h1 className={styles.title}>Sign Up</h1>
      <p className={styles.subtitle}>Track and shrink the water behind your prompts.</p>
      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <input
        type="hidden"
        name="next"
        value={typeof next === "string" ? next : ""}
      />
      <label className={styles.field}>
        Username{" "}
        <input
          name="username"
          type="username"
          required
          autoComplete="username"
        />
      </label>
      <label className={styles.field}>
        Display Name{" "}
        <input
          name="displayName"
          type="displayName"
          required
          autoComplete="display-name"
        />
      </label>
      <label className={styles.field}>
        Email <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className={styles.field}>
        Password{" "}
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
        />
      </label>

      <button type="submit" className={styles.submit}>Sign Up</button>
      <div className={styles.divider}>or</div>
      <GoogleButton className={styles.google} />
      <p className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}

export default function SignupPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense>
      <SignupForm searchParams={searchParams} />
    </Suspense>
  );
}
