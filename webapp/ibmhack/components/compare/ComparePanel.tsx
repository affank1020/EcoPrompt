"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { compareModels } from "../../lib/estimation/actions";
import type { EstimateResult, Model } from "../../lib/types";
import CompareChart from "./CompareChart";
import ModelCard from "./ModelCard";
import ModelSelect from "./ModelSelect";
import styles from "./ComparePanel.module.scss";

const EXAMPLES = [
    "Summarise this article in three bullet points.",
    "Write a polite email asking my landlord to fix the heating, mention it has been broken for two weeks and I have a newborn at home.",
    "Explain quantum entanglement like I'm ten.",
];

type Props = {
    // Every model the visitor can pick from; when selectable is false these are all compared
    models: Model[];
    initialSelected: string[];
    initialPrompt?: string;
    selectable?: boolean;
    showChart?: boolean;
    showExamples?: boolean;
    maxModels?: number;
    // Shown under the results; the current prompt is passed along as ?prompt=
    cta?: { label: string; href: string };
};

export default function ComparePanel({
    models,
    initialSelected,
    initialPrompt = "",
    selectable = true,
    showChart = true,
    showExamples = false,
    maxModels,
    cta,
}: Props) {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [selected, setSelected] = useState(initialSelected);
    const [results, setResults] = useState<Record<string, EstimateResult>>({});
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const chosen = models.filter((m) => selected.includes(m.id));
    const rows = chosen.flatMap((model) => (results[model.id] ? [{ model, result: results[model.id] }] : []));
    const scaleMax = Math.max(0, ...rows.map((r) => r.result.highMl));
    const lowest = rows.length ? Math.min(...rows.map((r) => r.result.waterMl)) : 0;
    const sorted = [...rows].sort((a, b) => a.result.waterMl - b.result.waterMl);
    const thirstiest = sorted.at(-1);
    const leanest = sorted[0];

    const check = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || chosen.length === 0) return;
        setError(null);
        startTransition(async () => {
            try {
                const estimates = await compareModels(prompt, chosen.map((m) => m.id));
                setResults(Object.fromEntries(estimates.map((r) => [r.model, r])));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
            }
        });
    };

    const ctaHref = cta && prompt.trim() ? `${cta.href}?prompt=${encodeURIComponent(prompt.trim())}` : cta?.href;

    return (
        <div className={styles.panel}>
            <form className={styles.form} onSubmit={check}>
                <label htmlFor="compare-prompt" className={styles.label}>
                    Your prompt
                </label>
                <textarea
                    id="compare-prompt"
                    className={styles.textarea}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Paste or type a prompt…"
                    rows={4}
                />
                {showExamples ? (
                    <div className={styles.examples}>
                        <span>Try:</span>
                        {EXAMPLES.map((example) => (
                            <button key={example} type="button" className={styles.example} onClick={() => setPrompt(example)}>
                                {example.length > 40 ? `${example.slice(0, 40)}…` : example}
                            </button>
                        ))}
                    </div>
                ) : null}
                {selectable ? (
                    <ModelSelect models={models} selected={selected} onChange={setSelected} max={maxModels} />
                ) : null}
                <div className={styles.actions}>
                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={pending || !prompt.trim() || chosen.length === 0}
                    >
                        {pending ? "Estimating…" : `Compare ${chosen.length} model${chosen.length === 1 ? "" : "s"}`}
                    </button>
                    {error ? <p className={styles.error} role="alert">{error}</p> : null}
                </div>
            </form>

            {thirstiest && leanest && thirstiest !== leanest ? (
                <p className={styles.callout} aria-live="polite">
                    <strong>{thirstiest.model.name}</strong> uses about{" "}
                    <strong>{(thirstiest.result.waterMl / leanest.result.waterMl).toFixed(1)}×</strong> more water than{" "}
                    <strong>{leanest.model.name}</strong> for this prompt.
                </p>
            ) : null}

            <div className={styles.cards}>
                {chosen.map((model) => {
                    const result = results[model.id];
                    const ratio = result && lowest ? result.waterMl / lowest : 0;
                    return (
                        <ModelCard
                            key={model.id}
                            model={model}
                            result={result}
                            loading={pending}
                            scaleMax={scaleMax}
                            note={rows.length > 1 && ratio ? (ratio < 1.05 ? "Lowest" : `${ratio.toFixed(1)}× the lowest`) : undefined}
                        />
                    );
                })}
            </div>

            {showChart && rows.length > 1 ? <CompareChart rows={rows} /> : null}

            {cta && ctaHref ? (
                <Link href={ctaHref} className={styles.cta}>
                    {cta.label} <span aria-hidden="true">→</span>
                </Link>
            ) : null}
        </div>
    );
}
