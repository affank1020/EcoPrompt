import type { Challenge } from "../../lib/types";
import { formatDate } from "../ui/format";
import styles from "./ChallengeCard.module.scss";

function formatAmount(n: number, unit: string) {
    return unit === "mL" ? `${n < 10 ? n.toFixed(1) : Math.round(n)} mL` : `${Math.round(n)} ${unit}`;
}

export default function ChallengeCard({ challenge }: { challenge: Challenge }) {
    const { title, description, kind, progress, target, unit, endsAt } = challenge;
    const ratio = Math.min(1, progress / target);
    const done = kind === "reach" && progress >= target;
    const over = kind === "stay-under" && progress > target;
    const status = done ? "Completed" : over ? "Over budget" : kind === "stay-under" ? "On track" : "In progress";
    const tone = done ? styles.done : over ? styles.over : kind === "stay-under" && ratio > 0.8 ? styles.close : "";

    return (
        <article className={`${styles.card} ${tone}`}>
            <header className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                <span className={styles.status}>{status}</span>
            </header>
            <p className={styles.description}>{description}</p>
            <div
                className={styles.track}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.round(Math.min(progress, target))}
                aria-label={title}
            >
                <span className={styles.fill} style={{ width: `${ratio * 100}%` }} />
            </div>
            <footer className={styles.footer}>
                <span>
                    <strong>{formatAmount(progress, unit)}</strong> {kind === "stay-under" ? "used of" : "of"} {formatAmount(target, unit)}
                </span>
                <span>Ends {formatDate(endsAt, { weekday: "short", day: "numeric", month: "short" })}</span>
            </footer>
        </article>
    );
}
