import Link from "next/link";
import { formatNumber } from "../ui/format";
import { historyHref, type HistoryParams } from "./params";
import styles from "./Pagination.module.scss";

type Props = {
    params: HistoryParams;
    page: number;
    pageCount: number;
    pageSize: number;
    total: number;
};

// Page numbers around the current page, with gaps marked as null
function pageWindow(page: number, pageCount: number): (number | null)[] {
    const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
    const sorted = [...pages].sort((a, b) => a - b);
    return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

export default function Pagination({ params, page, pageCount, pageSize, total }: Props) {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);

    return (
        <nav className={styles.pagination} aria-label="Pagination">
            <span className={styles.summary}>
                {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
            </span>
            <div className={styles.pages}>
                {page > 1 ? (
                    <Link href={historyHref(params, { page: page - 1 })} scroll={false} className={styles.page} aria-label="Previous page">←</Link>
                ) : (
                    <span className={`${styles.page} ${styles.disabled}`} aria-hidden="true">←</span>
                )}
                {pageWindow(page, pageCount).map((p, i) =>
                    p === null ? (
                        <span key={`gap-${i}`} className={styles.gap}>…</span>
                    ) : (
                        <Link
                            key={p}
                            href={historyHref(params, { page: p })}
                            scroll={false}
                            className={styles.page}
                            aria-current={p === page ? "page" : undefined}
                        >
                            {p}
                        </Link>
                    ),
                )}
                {page < pageCount ? (
                    <Link href={historyHref(params, { page: page + 1 })} scroll={false} className={styles.page} aria-label="Next page">→</Link>
                ) : (
                    <span className={`${styles.page} ${styles.disabled}`} aria-hidden="true">→</span>
                )}
            </div>
        </nav>
    );
}
