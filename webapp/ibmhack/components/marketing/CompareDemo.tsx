import { DEMO_MODEL_IDS, MODELS } from "../../lib/estimation/models";
import ComparePanel from "../compare/ComparePanel";
import styles from "./CompareDemo.module.scss";

// The landing page version of /compare: same panel, two fixed models, no chart
export default function CompareDemo() {
    const models = MODELS.filter((m) => DEMO_MODEL_IDS.includes(m.id));

    return (
        <section id="compare" className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.intro}>
                    <p className={styles.eyebrow}>Big model or small model?</p>
                    <h2 className={styles.title}>The same prompt can cost ten times the water</h2>
                    <p className={styles.lead}>
                        Type a prompt and see how a large model and a small one compare. For everyday questions, the small
                        one is often all you need.
                    </p>
                </div>
                <ComparePanel
                    models={models}
                    initialSelected={DEMO_MODEL_IDS}
                    selectable={false}
                    showChart={false}
                    showExamples
                    cta={{ label: "Compare more models", href: "/compare" }}
                />
            </div>
        </section>
    );
}
