import styles from "./Faq.module.scss";

const QUESTIONS = [
    {
        q: "Do you store my prompts?",
        a: "No. HydroPrompt only keeps a prompt's length and the estimate numbers, never the text, on the website and in the extension.",
    },
    {
        q: "How accurate are the numbers?",
        a: "They're estimates. AI companies don't publish per-prompt figures, so we combine published research and show a low–high range with every number. The method and sources are in How it works above.",
    },
    {
        q: "Do I need an account?",
        a: "No. The prompt checker on this page and the extension both work without one. An account keeps your history and adds it to your dashboard and the leaderboard.",
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
