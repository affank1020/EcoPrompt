"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.scss";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" },
  { href: "/dashboard/history", label: "History", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" },
  { href: "/compare", label: "Compare", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/bulk", label: "Bulk check", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" },
];

export default function AppNav() {
  const pathname = usePathname();
  // The most specific matching link wins, so /dashboard/history doesn't also light up Dashboard
  const active = LINKS.filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className={styles.nav} aria-label="App">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={styles.navLink}
          aria-current={link.href === active ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" className={styles.navIcon} aria-hidden="true">
            <path d={link.icon} />
          </svg>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
