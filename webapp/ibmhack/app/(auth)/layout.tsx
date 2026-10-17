import Link from "next/link";
import Waves from "../../components/marketing/Waves";
import styles from "./auth.module.scss";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className={styles.page}>
      <Waves />
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true" />
          HydroPrompt
        </Link>
        {children}
      </div>
    </main>
  );
}
