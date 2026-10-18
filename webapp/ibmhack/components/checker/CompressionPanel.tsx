"use client";

import { useState } from "react";
import type { CompressionResult } from "../../lib/types";
import { formatMl, formatNumber } from "../ui/format";
import styles from "./CompressionPanel.module.scss";

type Props = {
    original: string;
    result: CompressionResult;
    onUse: () => void;
    onDismiss: () => void;
};

const SCALE_PROMPTS = 1000;

export default function CompressionPanel({ original, result, onUse, onDismiss }: Props) {
    const [copied, setCopied] = useState(false);
    const savedMl = result.original.waterMl - result.optimised.waterMl;
    const savedTokens = result.original.tokens - result.optimised.tokens;
    const savedPct = result.original.waterMl ? (savedMl / result.original.waterMl) * 100 : 0;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(result.compressed);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be blocked (e.g. insecure context); the text is still selectable
        }
    };

    const d = result.details;
    const explanation = {
        ok: "Prompt shortened. Review the rewrite before using it.",
        too_short: "The prompt is below the backend’s minimum length; the original was kept.",
        no_savings: "Compression did not reduce the token count; the original was kept.",
        verification_failed: "The candidate lost a negation or number; the original was kept.",
        local_mock: "Local mock compressor: simple filler removal, not backend inference. Presets do not change this mock; backend token counts are unavailable.",
    }[d.reason];
    const details = <div className={styles.scale}>
        <p>{d.preset} · {explanation}</p>
        {d.tokensBefore !== null && <p>Compressor tokens: {formatNumber(d.tokensBefore)} → {formatNumber(d.tokensAfter!)} · {formatNumber(d.tokensSaved!)} fewer · {d.latencyMs} ms</p>}
        {d.negationsLost.length > 0 && <p>Negations lost by candidate: {d.negationsLost.join(", ")}</p>}
        {d.numbersLost.length > 0 && <p>Numbers lost by candidate: {d.numbersLost.join(", ")}</p>}
    </div>;

    if (result.compressed.trim() === original.trim()) {
        return (
            <div className={styles.panel}>
                {details}
                <button type="button" className={styles.link} onClick={onDismiss}>Close</button>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            {details}
            {savedMl > 0 ? <div className={styles.savings}>
                <span className={styles.savedValue}>−{formatMl(savedMl)}</span>
                <span className={styles.savedDetail}>
                    {savedPct.toFixed(0)}% lower estimated water · {formatNumber(savedTokens)} fewer tokens
                </span>
            </div>

            : <p className={styles.lean}>The rewrite has no estimated water reduction. Token reduction alone does not guarantee lower estimated usage.</p>}
            {savedMl > 0 && <div className={styles.bars} aria-hidden="true">
                <div className={styles.barRow}>
                    <span>Before</span>
                    <span className={styles.track}><span className={styles.before} style={{ width: "100%" }} /></span>
                    <span className={styles.barValue}>{formatMl(result.original.waterMl)}</span>
                </div>
                <div className={styles.barRow}>
                    <span>After</span>
                    <span className={styles.track}>
                        <span className={styles.after} style={{ width: `${100 - savedPct}%` }} />
                    </span>
                    <span className={styles.barValue}>{formatMl(result.optimised.waterMl)}</span>
                </div>
            </div>}

            <div className={styles.compare}>
                <div className={styles.version}>
                    <span className={styles.versionLabel}>Original · {formatNumber(original.length)} chars</span>
                    <p className={`${styles.text} ${styles.originalText}`}>{original}</p>
                </div>
                <div className={styles.version}>
                    <span className={styles.versionLabel}>Compressed · {formatNumber(result.compressed.length)} chars</span>
                    <p className={styles.text}>{result.compressed}</p>
                </div>
            </div>

            {savedMl > 0 && <p className={styles.scale}>
                Across {formatNumber(SCALE_PROMPTS)} prompts like this, the potential estimated reduction is {formatMl(savedMl * SCALE_PROMPTS)}. This is not recorded savings.
            </p>}

            <div className={styles.actions}>
                <button type="button" className={styles.use} onClick={onUse}>Use compressed prompt</button>
                <button type="button" className={styles.copy} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
                <button type="button" className={styles.link} onClick={onDismiss}>Keep original</button>
            </div>
        </div>
    );
}
