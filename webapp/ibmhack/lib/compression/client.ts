import { mockCompress } from "./mock";
import type { CompressionDetails, CompressionPreset } from "../types";

// Server-side only. Keep PR #9's URL, endpoint, timeout and explicit local mock behavior.
export async function compress(prompt: string, preset: CompressionPreset = "balanced"): Promise<{ compressed: string; details: CompressionDetails }> {
    const baseUrl = process.env.BACKEND_API_URL;
    if (!baseUrl) {
        const compressed = mockCompress(prompt) || prompt;
        return { compressed, details: {
            mode: "local-mock", preset, reason: "local_mock", fallback: compressed === prompt,
            tokensBefore: null, tokensAfter: null, tokensSaved: null,
            negationsLost: [], numbersLost: [], latencyMs: null,
        } };
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/compress`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY ?? "" },
        body: JSON.stringify({ prompt, preset }), cache: "no-store",
        signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Compression service returned ${res.status}`);
    const r = await res.json();
    const counts = r && [r.tokens_before, r.tokens_after, r.tokens_saved];
    if (!r || typeof r.compressed !== "string" || !r.compressed.trim() || r.compressed.length > 20000 ||
        r.preset !== preset || !["ok", "too_short", "no_savings", "verification_failed"].includes(r.reason) ||
        typeof r.fallback !== "boolean" || r.fallback !== (r.reason !== "ok") ||
        !counts.every((n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0) ||
        r.tokens_before - r.tokens_after !== r.tokens_saved ||
        !Number.isFinite(r.latency_ms) || r.latency_ms < 0 ||
        ![r.negations_lost, r.numbers_lost].every(a => Array.isArray(a) && a.every(v => typeof v === "string")) ||
        (r.fallback && (r.compressed !== prompt || r.tokens_saved !== 0))) {
        throw new Error("Compression service returned an invalid response");
    }
    return { compressed: r.compressed, details: {
        mode: "backend", preset: r.preset, reason: r.reason, fallback: r.fallback,
        tokensBefore: r.tokens_before, tokensAfter: r.tokens_after, tokensSaved: r.tokens_saved,
        negationsLost: r.negations_lost, numbersLost: r.numbers_lost, latencyMs: r.latency_ms,
    } };
}
