import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "../../lib/auth";
import AppNav from "./AppNav";
import styles from "./layout.module.scss";
import { signout } from "../(auth)/actions";

async function UserBadge() {
  // TODO(auth): show the signed-in user's name and avatar, with a sign-out link
  const user = await getCurrentUser();
  return (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden="true">
        {user.name.charAt(0)}
      </span>
      <span className={styles.userText}>
        <span className={styles.userName}>{user.name}</span>
        <form action={signout}>
          <button type="submit">Sign out</button>
        </form>
        <span className={styles.userNote}>
          {user.isAnonymous ? "Not signed in" : "Signed in"}
        </span>
      </span>
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
