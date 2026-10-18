"use client";

import { useState, useTransition } from "react";
import { compressPrompt } from "../../lib/compression/actions";
import { checkPrompt } from "../../lib/estimation/actions";
import { DEFAULT_MODEL_ID, getModel, MODELS } from "../../lib/estimation/models";
import type { CompressionResult, EstimateResult } from "../../lib/types";
import { formatNumber, formatWh } from "../ui/format";
import UncertaintyRange from "../ui/UncertaintyRange";
import CompressionPanel from "./CompressionPanel";
import styles from "./PromptChecker.module.scss";

type Props = {
    // "hero" is the one-line pill on the landing page; "card" is the dashboard version with a textarea
    variant: "hero" | "card";
};

export default function PromptChecker({ variant }: Props) {
    const [prompt, setPrompt] = useState("");
    const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
    // The prompt the current result is for, so editing the input doesn't relabel old results
    const [checked, setChecked] = useState<{ prompt: string; result: EstimateResult } | null>(null);
    const [compression, setCompression] = useState<CompressionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, startCheck] = useTransition();
    const [compressing, startCompress] = useTransition();

    const run = (text: string, model: string) => {
        if (!text.trim()) return;
        setError(null);
        startCheck(async () => {
            try {
                const result = await checkPrompt(text, model);
                setChecked({ prompt: text, result });
                setCompression(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
            }
        });
    };

    const compress = () => {
        if (!checked) return;
        setError(null);
        startCompress(async () => {
            try {
                setCompression(await compressPrompt(checked.prompt, modelId));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't compress this prompt. Try again.");
            }
        });
    };

    const applyCompressed = () => {
        if (!compression) return;
        setPrompt(compression.compressed);
        setChecked({ prompt: compression.compressed, result: compression.optimised });
        setCompression(null);
    };

    const changeModel = (id: string) => {
        setModelId(id);
        if (checked) run(checked.prompt, id);
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        run(prompt, modelId);
    };

    const model = getModel(modelId);

    return (
        <div className={`${styles.checker} ${styles[variant]}`}>
            <form className={styles.form} onSubmit={onSubmit}>
                {variant === "hero" ? (
                    <input
                        className={styles.input}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Paste a prompt to check its water use"
                        aria-label="Prompt"
                    />
                ) : (
                    <textarea
                        className={styles.textarea}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Paste or type a prompt to check its water use…"
                        aria-label="Prompt"
                        rows={4}
                    />
                )}
                <button type="submit" className={styles.submit} disabled={checking || !prompt.trim()}>
                    {checking ? "Checking…" : "Check prompt"}
                </button>
            </form>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            {checked ? (
                <section className={`${styles.result} ${checking ? styles.stale : ""}`} aria-live="polite">
                    <header className={styles.resultHeader}>
                        <label className={styles.modelField}>
                            Estimated water for
                            <select value={modelId} onChange={(e) => changeModel(e.target.value)} className={styles.select}>
                                {MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </label>
                        <span className={styles.tokens}>
                            {formatNumber(checked.result.tokens)} tokens{model ? ` · ${model.size} model` : ""}
                        </span>
                    </header>
                    {checked.result.methodology === "backend-token-v1" ? (
                        <p>Backend token approximation · model independent · no uncertainty interval supplied.</p>
                    ) : <p>Illustrative website mock estimate · not measured consumption.</p>}
                    <UncertaintyRange {...checked.result} size="lg" />
                    <p>{formatWh(checked.result.energyWh)} estimated energy</p>

                    {compression ? (
                        <CompressionPanel
                            original={checked.prompt}
                            result={compression}
                            onUse={applyCompressed}
                            onDismiss={() => setCompression(null)}
                        />
                    ) : (
                        <div className={styles.compressRow}>
                            <button type="button" className={styles.compress} onClick={compress} disabled={compressing || checking}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                                </svg>
                                {compressing ? "Compressing…" : "Compress to save water"}
                            </button>
                            <span className={styles.compressHint}>Trims the prompt without changing what it asks for.</span>
                        </div>
                    )}
                </section>
            ) : null}
        </div>
    );
}
