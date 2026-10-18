"use client";

import { useState } from "react";
import type { CompressionDetails, CompressionResult } from "../../lib/types";
import { formatMl, formatNumber, formatWh } from "../ui/format";
import styles from "./CompressionPanel.module.scss";

type Props = {
    original: string;
    result: CompressionResult;
    onUse: () => void;
    onDismiss: () => void;
};

const SCALE_PROMPTS = 1000;

// Why the compressor kept the original prompt
function keptReason({ reason, negationsLost, numbersLost }: CompressionDetails): string {
    if (reason === "too_short") {
        return "This prompt is too short to compress. Prompts under about 15 words are left as they are.";
    }
    if (reason === "verification_failed") {
        const lost = [...negationsLost.map((w) => `"${w}"`), ...numbersLost];
        return `Compressing would have dropped ${lost.length ? lost.join(", ") : "key words"}, which could change what the prompt asks for, so we kept your original.`;
    }
    return "This prompt is already concise. There was nothing to trim without changing what it asks for.";
}

export default function CompressionPanel({ original, result, onUse, onDismiss }: Props) {
    const [copied, setCopied] = useState(false);
    const savedMl = result.original.waterMl - result.optimised.waterMl;
    const savedTokens = result.original.tokens - result.optimised.tokens;
    const savedWh = result.original.energyWh - result.optimised.energyWh;
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

    if (savedMl <= 0) {
        return (
            <div className={styles.panel}>
                <p className={styles.lean}>{keptReason(result.details)}</p>
                <button type="button" className={styles.link} onClick={onDismiss}>Close</button>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.savings}>
                <span className={styles.savedValue}>−{formatMl(savedMl)}</span>
                <span className={styles.savedDetail}>
                    {savedPct.toFixed(0)}% less water · {formatWh(savedWh)} less energy · {formatNumber(savedTokens)} fewer tokens
                </span>
            </div>

            <div className={styles.bars} aria-hidden="true">
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
            </div>

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

            <p className={styles.scale}>
                Across {formatNumber(SCALE_PROMPTS)} prompts like this, that&apos;s {formatMl(savedMl * SCALE_PROMPTS)} saved.
            </p>
            <p className={styles.meta}>
                Prompt {formatNumber(result.details.tokensBefore)} → {formatNumber(result.details.tokensAfter)} tokens ·{" "}
                {result.details.preset} compression
                {result.details.latencyMs ? ` · ${formatNumber(result.details.latencyMs)} ms` : ""}
            </p>

            <div className={styles.actions}>
                <button type="button" className={styles.use} onClick={onUse}>Use compressed prompt</button>
                <button type="button" className={styles.copy} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
                <button type="button" className={styles.link} onClick={onDismiss}>Keep original</button>
            </div>
        </div>
    );
}
