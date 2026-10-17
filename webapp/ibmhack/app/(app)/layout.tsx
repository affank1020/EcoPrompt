import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "../../lib/auth";
import AppNav from "./AppNav";
import styles from "./layout.module.scss";
import { signout } from "../(auth)/actions";

async function UserBadge() {
  const user = await getCurrentUser();
  return (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden="true">
        {user.name.charAt(0).toUpperCase()}
      </span>
      <span className={styles.userText}>
        <span className={styles.userName} title={user.name}>{user.name}</span>
        <span className={styles.userNote}>
          {user.isAnonymous ? "Not signed in" : "Signed in"}
        </span>
      </span>
      {user.isAnonymous ? (
        <Link href="/login" className={styles.userAction}>Log in</Link>
      ) : (
        <form action={signout}>
          <button type="submit" className={styles.signOut} aria-label="Sign out" title="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true" />
          HydroPrompt
        </Link>
        <AppNav />
        <Suspense fallback={<div className={styles.user} />}>
          <UserBadge />
        </Suspense>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
