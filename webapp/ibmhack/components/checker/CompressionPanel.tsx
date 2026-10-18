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

    if (savedMl <= 0) {
        return (
            <div className={styles.panel}>
                <p className={styles.lean}>
                    This prompt is already concise. There was nothing to trim without changing what it asks for.
                </p>
                <button type="button" className={styles.link} onClick={onDismiss}>Close</button>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.savings}>
                <span className={styles.savedValue}>−{formatMl(savedMl)}</span>
                <span className={styles.savedDetail}>
                    {savedPct.toFixed(0)}% lower estimated water · {formatNumber(savedTokens)} fewer tokens
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
                Across {formatNumber(SCALE_PROMPTS)} prompts like this, the potential estimated reduction is {formatMl(savedMl * SCALE_PROMPTS)}. This is not recorded savings.
            </p>

            <div className={styles.actions}>
                <button type="button" className={styles.use} onClick={onUse}>Use compressed prompt</button>
                <button type="button" className={styles.copy} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
                <button type="button" className={styles.link} onClick={onDismiss}>Keep original</button>
            </div>
        </div>
    );
}
