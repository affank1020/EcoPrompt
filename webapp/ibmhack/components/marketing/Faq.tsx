import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./Faq.module.scss";

const QUESTIONS: { q: string; a: ReactNode }[] = [
    {
        q: "Do you store my prompts?",
        a: (
            <>
                No. Synced usage history contains counts and estimates, not prompt text. Checking or compressing a prompt
                sends its text to our analysis server, which doesn&apos;t store or log it; local extension history can
                keep drafts on your own device. See our <Link href="/privacy">privacy policy</Link>.
            </>
        ),
    },
    {
        q: "How accurate are the numbers?",
        a: (
            <>
                They&apos;re estimates, not measurements. Website checks count your prompt&apos;s tokens, predict the
                reply length from its complexity and apply one per-token rate for every model (see{" "}
                <a href="#methodology">How it works</a>). The extension currently uses its own illustrative estimate; the
                dashboard and leaderboard use only extension estimates, and history labels the two methods separately.
            </>
        ),
    },
    {
        q: "Do I need an account?",
        a: "No. The prompt checker on this page and the extension both work without one. An account syncs submitted usage to your dashboard. Only users who enable leaderboard visibility appear there.",
    },
    {
        q: "Which AI sites does the extension work on?",
        a: "ChatGPT for now. More sites are on the way.",
    },
];

export default function Faq() {
    return (
        <section id="faq" className={styles.section}>
            <div className={styles.inner}>
                <p className={styles.eyebrow}>FAQ</p>
                <h2 className={styles.title}>Questions</h2>
                <div className={styles.list}>
                    {QUESTIONS.map((item) => (
                        <details key={item.q} className={styles.item}>
                            <summary className={styles.question}>{item.q}</summary>
                            <p className={styles.answer}>{item.a}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
