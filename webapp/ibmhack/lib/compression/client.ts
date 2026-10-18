import { backendPost } from "../backend";
import type { CompressionDetails, CompressionPreset } from "../types";

// What /compress returns
type CompressResponse = {
    compressed: string;
    reason: string;
    preset: CompressionPreset;
    tokens_before: number;
    tokens_after: number;
    negations_lost: string[];
    numbers_lost: string[];
    latency_ms: number;
};

export async function compress(
    prompt: string,
    preset: CompressionPreset,
): Promise<{ compressed: string; details: CompressionDetails }> {
    const r = await backendPost<CompressResponse>("/compress", { prompt, preset });
    return {
        compressed: r.compressed,
        details: {
            preset: r.preset,
            reason: r.reason,
            tokensBefore: r.tokens_before,
            tokensAfter: r.tokens_after,
            negationsLost: r.negations_lost ?? [],
            numbersLost: r.numbers_lost ?? [],
            latencyMs: r.latency_ms,
        },
    };
}
