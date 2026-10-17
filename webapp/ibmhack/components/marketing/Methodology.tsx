import {
    ASSUMPTIONS,
    CHARS_PER_TOKEN,
    ENERGY_WH_PER_1K_TOKENS,
    FORMULA,
    HIGH_MULTIPLIER,
    LOW_MULTIPLIER,
    RESPONSE_TOKENS,
    UNCERTAINTY_NOTE,
    WATER_ML_PER_WH,
} from "../../lib/estimation/methodology";
import { mockEstimate } from "../../lib/estimation/mock";
import { DEMO_MODEL_IDS, getModel } from "../../lib/estimation/models";
import { SOURCES } from "../../lib/estimation/sources";
import { formatMl, formatRange } from "../ui/format";
import styles from "./Methodology.module.scss";

const EXAMPLE_CHARS = 400;

export default function Methodology() {
    const exampleModel = getModel(DEMO_MODEL_IDS[0])!;
    const example = mockEstimate(EXAMPLE_CHARS, exampleModel.id);
    const sourceNumber = (id: string) => SOURCES.findIndex((s) => s.id === id) + 1;
    // Where the central value sits on the low–high band
    const centralPct = ((1 - LOW_MULTIPLIER) / (HIGH_MULTIPLIER - LOW_MULTIPLIER)) * 100;

    return (
        <section id="methodology" className={styles.section}>
            <div className={styles.inner}>
                <p className={styles.eyebrow}>Methodology</p>
                <h2 className={styles.title}>How we estimate the water behind a prompt</h2>
                <p className={styles.lead}>
                    Every prompt runs on servers that draw electricity and need cooling. We estimate the energy your prompt
                    uses, then the water evaporated to cool the data centre and the water used to generate its power.
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
                            A {EXAMPLE_CHARS}-character prompt to {exampleModel.name} ({exampleModel.size} model):
                        </p>
                        <ol className={styles.steps}>
                            <li>
                                {EXAMPLE_CHARS} ÷ {CHARS_PER_TOKEN} + {RESPONSE_TOKENS} = <strong>{example.tokens} tokens</strong>
                            </li>
                            <li>
                                {example.tokens} ÷ 1000 × {ENERGY_WH_PER_1K_TOKENS[exampleModel.size]} Wh ={" "}
                                <strong>{((example.tokens / 1000) * ENERGY_WH_PER_1K_TOKENS[exampleModel.size]).toFixed(3)} Wh</strong>
                            </li>
                            <li>
                                × {WATER_ML_PER_WH.toFixed(2)} mL per Wh = <strong>{formatMl(example.waterMl)}</strong>
                            </li>
                        </ol>
                    </div>

                    <div className={styles.band}>
                        <h3 className={styles.subtitle}>Uncertainty range</h3>
                        <div className={styles.bandTrack} aria-hidden="true">
                            <span className={styles.bandMarker} style={{ left: `${centralPct}%` }} />
                        </div>
                        <div className={styles.bandLabels}>
                            <span>Low · {formatMl(example.lowMl)}</span>
                            <span>Estimate · {formatMl(example.waterMl)}</span>
                            <span>High · {formatMl(example.highMl)}</span>
                        </div>
                        <p className={styles.body}>{UNCERTAINTY_NOTE}</p>
                        <p className={styles.small}>So this example is shown as {formatMl(example.waterMl)} ({formatRange(example.lowMl, example.highMl)}).</p>
                    </div>
                </div>

                <div className={styles.sources}>
                    <h3 className={styles.subtitle}>Sources</h3>
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
