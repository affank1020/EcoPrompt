import { backendPost } from "../backend";
import type { Complexity, EstimateResult } from "../types";
import { HIGH_MULTIPLIER, LOW_MULTIPLIER } from "./methodology";

// What /analyse returns for one prompt (and /analyse/bulk for each prompt)
type AnalyseResponse = {
    label: Complexity;
    water_cost: number; // mL
    energy_cost: number; // Wh
    input_tokens?: number;
    output_tokens?: number;
};

// Matches calculate_consumption in backend/api.py. Only used to recover the token
// count while the backend doesn't return input_tokens/output_tokens yet.
const BACKEND_WATER_ML_PER_TOKEN = 0.000429;

// Bulk checks run many prompts through the classifier in one request
const BULK_TIMEOUT_MS = 180_000;

// The backend doesn't take a model; `model` is only carried through for display
function toResult(r: AnalyseResponse, model: string): EstimateResult {
    const tokens =
        r.input_tokens !== undefined && r.output_tokens !== undefined
            ? r.input_tokens + r.output_tokens
            : Math.round(r.water_cost / BACKEND_WATER_ML_PER_TOKEN);
    return {
        model,
        tokens,
        complexity: r.label,
        waterMl: r.water_cost,
        lowMl: r.water_cost * LOW_MULTIPLIER,
        highMl: r.water_cost * HIGH_MULTIPLIER,
        energyWh: r.energy_cost,
    };
}

export async function estimate(prompt: string, model: string): Promise<EstimateResult> {
    return toResult(await backendPost<AnalyseResponse>("/analyse", { prompt }), model);
}

// Several prompts in one request, results in the same order
export async function estimateMany(prompts: string[], model: string): Promise<EstimateResult[]> {
    const { results } = await backendPost<{ results: AnalyseResponse[] }>("/analyse/bulk", { prompts }, BULK_TIMEOUT_MS);
    return results.map((r) => toResult(r, model));
}
