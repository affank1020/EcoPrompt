import styles from "./Skeleton.module.scss";

// Placeholder block shown while data streams in
export default function Skeleton({ height = 120, label = "Loading" }: { height?: number; label?: string }) {
    return <div className={styles.skeleton} style={{ height }} role="status" aria-label={label} />;
}
