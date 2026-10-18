import styles from "./Faq.module.scss";

const QUESTIONS = [
    {
        q: "Do you store my prompts?",
        a: "Synced usage history contains counts and estimates, not prompt text. Analysis and rewriting can send text to the configured backend; local extension history can retain drafts.",
    },
    {
        q: "How accurate are the numbers?",
        a: "These are illustrative estimates, not measurements. The dashboard and leaderboard use only extension v1 estimates; other methods remain separate in history. Backend analysis uses a different token-based approximation.",
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
