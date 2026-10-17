import styles from "./UncertaintyRange.module.scss";
import { formatMl, formatRange } from "./format";

type Props = {
    waterMl: number;
    lowMl: number;
    highMl: number;
    // When set, draws the low–high band on a 0–scaleMax track so rows can be compared
    scaleMax?: number;
    size?: "sm" | "lg";
};

export default function UncertaintyRange({ waterMl, lowMl, highMl, scaleMax, size = "sm" }: Props) {
    const pct = (v: number) => `${Math.min(100, (v / (scaleMax || 1)) * 100)}%`;
    return (
        <span className={`${styles.range} ${size === "lg" ? styles.lg : ""}`}>
            <span className={styles.values}>
                <span className={styles.value}>{formatMl(waterMl)}</span>
                <span className={styles.band}>{formatRange(lowMl, highMl)}</span>
            </span>
            {scaleMax ? (
                <span className={styles.track} aria-hidden="true">
                    <span className={styles.bar} style={{ left: pct(lowMl), width: `calc(${pct(highMl)} - ${pct(lowMl)})` }} />
                    <span className={styles.tick} style={{ left: pct(waterMl) }} />
                </span>
            ) : null}
        </span>
    );
}
