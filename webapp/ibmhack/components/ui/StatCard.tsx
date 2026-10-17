import type { ReactNode } from "react";
import styles from "./StatCard.module.scss";

type Props = {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    tone?: "default" | "good" | "warning";
};

export default function StatCard({ label, value, sub, tone = "default" }: Props) {
    return (
        <div className={styles.card}>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{value}</span>
            {sub ? <span className={`${styles.sub} ${tone === "default" ? "" : styles[tone]}`}>{sub}</span> : null}
        </div>
    );
}
