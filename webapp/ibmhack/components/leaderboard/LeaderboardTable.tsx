import type { LeaderboardEntry } from "../../lib/types";
import { formatMl, formatNumber, formatWh } from "../ui/format";
import styles from "./LeaderboardTable.module.scss";

type Props = {
    entries: LeaderboardEntry[];
    minPrompts: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardTable({ entries, minPrompts }: Props) {
    const ranked = entries.filter((e) => e.rank !== null);
    const unranked = entries.filter((e) => e.rank === null);
    const best = ranked[0]?.avgMl ?? 0;
    const worst = ranked.at(-1)?.avgMl ?? 0;

    const row = (e: LeaderboardEntry) => (
        <tr key={e.user.id} className={e.isCurrentUser ? styles.you : undefined} aria-current={e.isCurrentUser || undefined}>
            <td className={styles.rank}>
                {e.rank === null ? "–" : e.rank <= 3 ? <span aria-label={`Rank ${e.rank}`}>{MEDALS[e.rank - 1]}</span> : e.rank}
            </td>
            <td>
                <span className={styles.user}>
                    <span className={styles.avatar} aria-hidden="true">{e.user.name.charAt(0)}</span>
                    {e.user.name}
                    {/* The anonymous user is already called "You" */}
                    {e.isCurrentUser && e.user.name !== "You" ? <span className={styles.badge}>You</span> : null}
                </span>
            </td>
            <td className={styles.numeric}>{formatNumber(e.prompts)}</td>
            <td className={styles.avg}>
                <span className={styles.avgValue}>{e.prompts ? formatMl(e.avgMl) : "–"}</span>
                {e.rank !== null ? (
                    <span className={styles.meter} aria-hidden="true">
                        <span style={{ width: `${worst ? 15 + 85 * ((e.avgMl - best) / (worst - best || 1)) : 0}%` }} />
                    </span>
                ) : null}
            </td>
            <td className={styles.numeric}>{formatMl(e.totalMl)}</td>
            <td className={styles.numeric}>{formatWh(e.totalWh)}</td>
        </tr>
    );

    if (!entries.length) return <p>No visible illustrative estimates this week yet.</p>;

    return (
        <div className={styles.wrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col" className={styles.rank}>Rank</th>
                        <th scope="col">Name</th>
                        <th scope="col" className={styles.numeric}>Prompts</th>
                        <th scope="col">Avg water per prompt</th>
                        <th scope="col" className={styles.numeric}>Estimated water</th>
                        <th scope="col" className={styles.numeric}>Estimated energy</th>
                    </tr>
                </thead>
                <tbody>{ranked.map(row)}</tbody>
                {unranked.length ? (
                    <tbody className={styles.unranked}>
                        <tr>
                            <th colSpan={6} scope="rowgroup" className={styles.divider}>
                                Not ranked yet · fewer than {minPrompts} prompts this week
                            </th>
                        </tr>
                        {unranked.map(row)}
                    </tbody>
                ) : null}
            </table>
        </div>
    );
}
