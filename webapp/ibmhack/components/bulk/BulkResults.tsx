"use client";

import type { EstimateResult, Model } from "../../lib/types";
import { formatMl, formatNumber, formatRange, formatWh } from "../ui/format";
import UncertaintyRange from "../ui/UncertaintyRange";
import { toCsv } from "./parsePrompts";
import styles from "./BulkResults.module.scss";

type Props = {
    prompts: string[];
    results: EstimateResult[];
    // Only shown while comparing models is switched on; the backend estimates without one
    model?: Model;
};

export default function BulkResults({ prompts, results, model }: Props) {
    const total = results.reduce(
        (sum, r) => ({
            tokens: sum.tokens + r.tokens,
            waterMl: sum.waterMl + r.waterMl,
            lowMl: sum.lowMl + r.lowMl,
            highMl: sum.highMl + r.highMl,
            energyWh: sum.energyWh + r.energyWh,
        }),
        { tokens: 0, waterMl: 0, lowMl: 0, highMl: 0, energyWh: 0 },
    );
    const scaleMax = Math.max(0, ...results.map((r) => r.highMl));

    const download = () => {
        const csv = toCsv([
            ["prompt", "complexity", "tokens", "water_ml", "low_ml", "high_ml", "energy_wh"],
            ...results.map((r, i) => [
                prompts[i],
                r.complexity ?? "",
                r.tokens,
                r.waterMl.toFixed(4),
                r.lowMl.toFixed(4),
                r.highMl.toFixed(4),
                r.energyWh.toFixed(4),
            ]),
        ]);
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: "water-estimates.csv" });
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className={styles.results}>
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>
                        {formatNumber(results.length)} prompts{model ? ` on ${model.name}` : ""}
                    </h2>
                    <p className={styles.total}>
                        <span className={styles.totalValue}>{formatMl(total.waterMl)}</span> in total · range{" "}
                        {formatRange(total.lowMl, total.highMl)} · {formatWh(total.energyWh)} energy
                    </p>
                </div>
                <button type="button" className={styles.download} onClick={download}>
                    Download CSV
                </button>
            </header>
            <div className={styles.wrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col" className={styles.index}>#</th>
                            <th scope="col">Prompt</th>
                            <th scope="col" className={styles.numeric}>Tokens</th>
                            <th scope="col">Estimated water</th>
                            <th scope="col" className={styles.numeric}>Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={i}>
                                <td className={styles.index}>{i + 1}</td>
                                <td>
                                    <span className={styles.prompt} title={prompts[i]}>{prompts[i]}</span>
                                </td>
                                <td className={styles.numeric}>{formatNumber(r.tokens)}</td>
                                <td className={styles.water}>
                                    <UncertaintyRange {...r} scaleMax={scaleMax} />
                                </td>
                                <td className={styles.numeric}>
                                    {total.waterMl ? `${((r.waterMl / total.waterMl) * 100).toFixed(1)}%` : "–"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td />
                            <th scope="row">Total</th>
                            <td className={styles.numeric}>{formatNumber(total.tokens)}</td>
                            <td>
                                <UncertaintyRange {...total} />
                            </td>
                            <td className={styles.numeric}>100%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}
