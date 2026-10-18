"use client";

import { useState, useTransition } from "react";
import { estimatePrompts } from "../../lib/estimation/actions";
import { DEFAULT_MODEL_ID, MODELS } from "../../lib/estimation/models";
import { FEATURES } from "../../lib/features";
import type { EstimateResult } from "../../lib/types";
import ModelSelect from "../compare/ModelSelect";
import BulkInput, { INITIAL_BULK_INPUT, promptsFromInput, type BulkInputState } from "./BulkInput";
import BulkResults from "./BulkResults";
import styles from "./BulkChecker.module.scss";

// Matches the server action's limit
const MAX_PROMPTS = 200;

export default function BulkChecker() {
    const [input, setInput] = useState<BulkInputState>(INITIAL_BULK_INPUT);
    const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
    const [checked, setChecked] = useState<{ prompts: string[]; results: EstimateResult[]; modelId: string; saved: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const prompts = promptsFromInput(input);
    const tooMany = prompts.length > MAX_PROMPTS;
    const checkedModel = MODELS.find((m) => m.id === checked?.modelId);

    const check = () => {
        setError(null);
        startTransition(async () => {
            try {
                const { results, saved } = await estimatePrompts(prompts, modelId);
                setChecked({ prompts, results, modelId, saved });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
            }
        });
    };

    return (
        <div className={styles.checker}>
            <div className={styles.card}>
                <BulkInput state={input} onChange={setInput} />
                {/* The backend estimates without a model, so the picker only shows when comparing is on */}
                {FEATURES.compareModels ? (
                    <ModelSelect
                        models={MODELS}
                        selected={[modelId]}
                        onChange={([id]) => setModelId(id)}
                        multiple={false}
                        label="Estimate for"
                    />
                ) : null}
                <div className={styles.actions}>
                    <button type="button" className={styles.submit} onClick={check} disabled={pending || prompts.length === 0 || tooMany}>
                        {pending ? "Checking…" : `Check ${prompts.length || ""} prompt${prompts.length === 1 ? "" : "s"}`}
                    </button>
                    <span className={tooMany ? styles.warning : styles.hint}>
                        {tooMany
                            ? `That's ${prompts.length} prompts; the limit is ${MAX_PROMPTS} per check.`
                            : `${prompts.length} prompt${prompts.length === 1 ? "" : "s"} found`}
                    </span>
                    {error ? <p className={styles.error} role="alert">{error}</p> : null}
                </div>
            </div>
            {checked && checkedModel ? (
                <div className={pending ? styles.stale : undefined}>
                    {checked.saved ? (
                        <p className={styles.saved}>Saved {checked.results.length} prompts to your history ✓</p>
                    ) : null}
                    <BulkResults
                        prompts={checked.prompts}
                        results={checked.results}
                        model={FEATURES.compareModels ? checkedModel : undefined}
                    />
                </div>
            ) : null}
        </div>
    );
}
