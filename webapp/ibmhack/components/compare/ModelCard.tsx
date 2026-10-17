import type { EstimateResult, Model } from "../../lib/types";
import { formatNumber } from "../ui/format";
import UncertaintyRange from "../ui/UncertaintyRange";
import styles from "./ModelCard.module.scss";

type Props = {
    model: Model;
    result?: EstimateResult;
    loading?: boolean;
    scaleMax?: number;
    note?: string;
};

export default function ModelCard({ model, result, loading, scaleMax, note }: Props) {
    return (
        <article className={`${styles.card} ${loading ? styles.loading : ""}`} aria-busy={loading}>
            <header className={styles.header}>
                <div>
                    <span className={styles.provider}>{model.provider}</span>
                    <h3 className={styles.name}>{model.name}</h3>
                </div>
                <span className={`${styles.size} ${styles[model.size]}`}>{model.size}</span>
            </header>
            {result ? (
                <>
                    <UncertaintyRange {...result} scaleMax={scaleMax} size="lg" />
                    <dl className={styles.meta}>
                        <div>
                            <dt>Tokens</dt>
                            <dd>{formatNumber(result.tokens)}</dd>
                        </div>
                        {note ? (
                            <div>
                                <dt>Compared</dt>
                                <dd>{note}</dd>
                            </div>
                        ) : null}
                    </dl>
                </>
            ) : (
                <p className={styles.empty}>{loading ? "Estimating…" : "Check a prompt to see this model's estimate."}</p>
            )}
        </article>
    );
}
