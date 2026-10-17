import Link from "next/link";
import type { SortKey } from "../../lib/data/estimates";
import { getModel } from "../../lib/estimation/models";
import type { Estimate } from "../../lib/types";
import { formatDateTime, formatNumber } from "../ui/format";
import UncertaintyRange from "../ui/UncertaintyRange";
import { historyHref, type HistoryParams } from "./params";
import styles from "./HistoryTable.module.scss";

type Props = {
    rows: Estimate[];
    params: HistoryParams;
};

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "date", label: "Date" },
    { key: "site", label: "Site" },
    { key: "model", label: "Model" },
    { key: "length", label: "Prompt length", numeric: true },
    { key: "water", label: "Estimated water" },
];

export default function HistoryTable({ rows, params }: Props) {
    const scaleMax = Math.max(0, ...rows.map((r) => r.highMl));

    return (
        <div className={styles.wrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {COLUMNS.map((col) => {
                            const active = params.sort === col.key;
                            // Clicking the active column flips direction; a new column starts descending
                            const dir = active && params.dir === "desc" ? "asc" : "desc";
                            return (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={col.numeric ? styles.numeric : undefined}
                                    aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
                                >
                                    <Link href={historyHref(params, { sort: col.key, dir, page: 1 })} scroll={false} className={styles.sort}>
                                        {col.label}
                                        <span className={`${styles.arrow} ${active ? styles.arrowActive : ""}`} aria-hidden="true">
                                            {active && params.dir === "asc" ? "↑" : "↓"}
                                        </span>
                                    </Link>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const model = getModel(row.model);
                        return (
                            <tr key={row.id}>
                                <td className={styles.date}>{formatDateTime(row.createdAt)}</td>
                                <td>{row.site}</td>
                                <td>
                                    <span className={`${styles.dot} ${model ? styles[model.size] : ""}`} aria-hidden="true" />
                                    {model?.name ?? row.model}
                                </td>
                                <td className={styles.numeric}>
                                    {formatNumber(row.promptChars)} chars
                                    <span className={styles.subtle}>{formatNumber(row.tokens)} tokens</span>
                                </td>
                                <td className={styles.water}>
                                    <UncertaintyRange {...row} scaleMax={scaleMax} />
                                </td>
                            </tr>
                        );
                    })}
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={COLUMNS.length} className={styles.empty}>
                                No estimates match these filters.
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}
