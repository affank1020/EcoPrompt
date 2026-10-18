"use client";

import { useState, useTransition } from "react";
import { compressPrompt } from "../../lib/compression/actions";
import { checkPrompt } from "../../lib/estimation/actions";
import { DEFAULT_MODEL_ID, getModel, MODELS } from "../../lib/estimation/models";
import type { CompressionPreset, CompressionResult, EstimateResult, HistorySaveStatus } from "../../lib/types";
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
    const [preset, setPreset] = useState<CompressionPreset>("balanced");
    const [history, setHistory] = useState<HistorySaveStatus | null>(null);
    const [compression, setCompression] = useState<CompressionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, startCheck] = useTransition();
    const [compressing, startCompress] = useTransition();

    const run = (text: string, model: string) => {
        if (!text.trim()) return;
        setError(null);
        startCheck(async () => {
            try {
                const { result, history } = await checkPrompt(text, model);
                setHistory(history);
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
                setCompression(await compressPrompt(checked.prompt, checked.result.model, preset));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't compress this prompt. Try again.");
            }
        });
    };

    const applyCompressed = () => {
        if (!compression) return;
        setPrompt(compression.compressed);
        setChecked({ prompt: compression.compressed, result: compression.optimised });
        setHistory(null);
        setCompression(null);
    };

    const changeModel = (id: string) => {
        setModelId(id);
        setChecked(null);
        setCompression(null);
        setHistory(null);
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
                <button type="submit" className={styles.submit} disabled={checking || compressing || !prompt.trim()}>
                    {checking ? "Checking…" : "Check prompt"}
                </button>
            </form>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            {checked ? (
                <section className={`${styles.result} ${checking ? styles.stale : ""}`} aria-live="polite">
                    <header className={styles.resultHeader}>
                        <label className={styles.modelField}>
                            Estimated water for
                            <select disabled={checking || compressing || checked.result.methodology === "backend-token-v1"} value={modelId} onChange={(e) => changeModel(e.target.value)} className={styles.select}>
                                {MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </label>
                        <span className={styles.tokens}>
                            {formatNumber(checked.result.tokens)} {checked.result.methodology === "backend-token-v1" ? "input tokens" : "estimated total tokens"}{model && checked.result.methodology !== "backend-token-v1" ? ` · ${model.size} model` : ""}
                        </span>
                    </header>
                    {checked.result.methodology === "backend-token-v1" ? (
                        <p>Backend token approximation · model independent · no uncertainty interval supplied.</p>
                    ) : <p>Illustrative website mock estimate · not measured consumption.</p>}
                    <UncertaintyRange {...checked.result} size="lg" />
                    <p>{formatWh(checked.result.energyWh)} estimated energy{checked.result.complexity ? ` · ${checked.result.complexity} complexity` : ""}</p>
                    {history && <p role="status">{history === "saved" ? "Saved to history under its own methodology; excluded from extension dashboard and leaderboard totals." : history === "signed-out" ? "Sign in to save checks to history." : "Estimate ready, but history could not be saved. History may be unavailable or unconfigured."}</p>}

                    {compression ? (
                        <CompressionPanel
                            original={checked.prompt}
                            result={compression}
                            onUse={applyCompressed}
                            onDismiss={() => setCompression(null)}
                        />
                    ) : (
                        <div className={styles.compressRow}>
                            <label className={styles.modelField}>Compression
                                <select className={styles.select} value={preset} disabled={compressing || checking} onChange={e => setPreset(e.target.value as CompressionPreset)}>
                                    <option value="light">Light</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option>
                                </select>
                            </label>
                            <button type="button" className={styles.compress} onClick={compress} disabled={compressing || checking || checked.prompt.length > 20000}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                                </svg>
                                {compressing ? "Compressing…" : "Compress to save water"}
                            </button>
                            <span className={styles.compressHint}>{checked.prompt.length > 20000 ? "Compression is limited to 20,000 characters." : "Review the rewrite before using it; meaning may change."}</span>
                        </div>
                    )}
                </section>
            ) : null}
        </div>
    );
}
