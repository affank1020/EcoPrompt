import {
    ASSUMPTIONS,
    ENERGY_WH_PER_1K_TOKENS,
    FORMULA,
    LIMITATIONS,
    OUTPUT_MULTIPLIER,
    WATER_ML_PER_1K_TOKENS,
    energyWh,
    totalTokens,
    waterMl,
} from "../../lib/estimation/methodology";
import { SOURCES } from "../../lib/estimation/sources";
import type { Complexity } from "../../lib/types";
import { formatMl, formatNumber, formatWh } from "../ui/format";
import styles from "./Methodology.module.scss";

const EXAMPLE_TOKENS = 200;
const EXAMPLE_COMPLEXITY: Complexity = "medium";
const COMPLEXITIES: Complexity[] = ["easy", "medium", "hard"];

export default function Methodology() {
    const replyTokens = EXAMPLE_TOKENS * OUTPUT_MULTIPLIER[EXAMPLE_COMPLEXITY];
    const total = totalTokens(EXAMPLE_TOKENS, EXAMPLE_COMPLEXITY);
    const sourceNumber = (id: string) => SOURCES.findIndex((s) => s.id === id) + 1;

    return (
        <section id="methodology" className={styles.section}>
            <div className={styles.inner}>
                <p className={styles.eyebrow}>Methodology</p>
                <h2 className={styles.title}>How we estimate the water behind a prompt</h2>
                <p className={styles.lead}>
                    Every prompt runs on servers that draw electricity and need cooling. We count your prompt&apos;s tokens,
                    predict how long the reply will be from how complex the prompt is, and turn the total into energy and
                    water using per-token rates.
                </p>

                <div className={styles.formula}>
                    <code>{FORMULA}</code>
                </div>

                <div className={styles.assumptions}>
                    {ASSUMPTIONS.map((a) => (
                        <div key={a.label} className={styles.assumption}>
                            <span className={styles.assumptionLabel}>{a.label}</span>
                            <span className={styles.assumptionValue}>{a.value}</span>
                            <p className={styles.assumptionDetail}>
                                {a.detail}
                                {a.sourceIds.map((id) => (
                                    <a key={id} href={`#source-${id}`} className={styles.ref}>
                                        [{sourceNumber(id)}]
                                    </a>
                                ))}
                            </p>
                        </div>
                    ))}
                </div>

                <div className={styles.worked}>
                    <div>
                        <h3 className={styles.subtitle}>Worked example</h3>
                        <p className={styles.body}>
                            A {EXAMPLE_TOKENS}-token prompt (roughly {EXAMPLE_TOKENS * 4} characters) rated {EXAMPLE_COMPLEXITY}:
                        </p>
                        <ol className={styles.steps}>
                            <li>
                                Reply: {EXAMPLE_TOKENS} × {OUTPUT_MULTIPLIER[EXAMPLE_COMPLEXITY]} = <strong>{formatNumber(replyTokens)} tokens</strong>
                            </li>
                            <li>
                                Total: {EXAMPLE_TOKENS} + {formatNumber(replyTokens)} = <strong>{formatNumber(total)} tokens</strong>
                            </li>
                            <li>
                                Energy: {formatNumber(total)} ÷ 1000 × {ENERGY_WH_PER_1K_TOKENS} Wh ={" "}
                                <strong>{formatWh(energyWh(EXAMPLE_TOKENS, EXAMPLE_COMPLEXITY))}</strong>
                            </li>
                            <li>
                                Water: {formatNumber(total)} ÷ 1000 × {WATER_ML_PER_1K_TOKENS} mL ={" "}
                                <strong>{formatMl(waterMl(EXAMPLE_TOKENS, EXAMPLE_COMPLEXITY))}</strong>
                            </li>
                        </ol>
                    </div>

                    <div>
                        <h3 className={styles.subtitle}>Complexity matters</h3>
                        <p className={styles.body}>The same {EXAMPLE_TOKENS}-token prompt at each complexity:</p>
                        <ul className={styles.levels}>
                            {COMPLEXITIES.map((c) => (
                                <li key={c} className={styles.level}>
                                    <span className={styles.levelName}>{c}</span>
                                    <span>{formatNumber(totalTokens(EXAMPLE_TOKENS, c))} tokens</span>
                                    <strong>{formatMl(waterMl(EXAMPLE_TOKENS, c))}</strong>
                                </li>
                            ))}
                        </ul>
                        <p className={styles.body}>{LIMITATIONS}</p>
                    </div>
                </div>

                <div className={styles.sources}>
                    <h3 className={styles.subtitle}>Sources and further reading</h3>
                    <ol className={styles.sourceList}>
                        {SOURCES.map((s) => (
                            <li key={s.id} id={`source-${s.id}`}>
                                <a href={s.url} target="_blank" rel="noreferrer" className={styles.sourceTitle}>
                                    {s.title}
                                </a>
                                <span className={styles.sourceMeta}>
                                    {s.publisher}, {s.year}. {s.usedFor}.
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
