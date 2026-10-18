import type { EstimateResult } from "../types";
import { mockEstimate } from "./mock";

// Server-side adapter: /analyse has no model-specific estimates or uncertainty bounds.
export async function estimate(prompt: string, model: string): Promise<EstimateResult> {
    const baseUrl = process.env.BACKEND_API_URL;
    if (!baseUrl) return mockEstimate(prompt.length, model);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/analyse`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, epsilon: 0.5 }), cache: "no-store",
        signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Analysis API returned ${res.status}`);
    const data = await res.json();
    return toResult(data, model);
}

// Retain PR #9's INPUT-token accounting; never infer tokens from water consumption.
function toResult(data: { tokens: number; water_cost: number; energy_cost: number; label?: EstimateResult["complexity"] }, model: string): EstimateResult {
    if (!data || !Number.isInteger(data.tokens) ||
        ![data.tokens, data.water_cost, data.energy_cost].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0) ||
        (data.label !== undefined && !["easy", "medium", "hard"].includes(data.label))) {
        throw new Error("Analysis API returned invalid resource estimates");
    }
    return { model, tokens: data.tokens, complexity: data.label, waterMl: data.water_cost,
        lowMl: data.water_cost, highMl: data.water_cost, energyWh: data.energy_cost,
        methodology: "backend-token-v1" };
}

export async function estimateMany(prompts: string[], model: string): Promise<EstimateResult[]> {
    const baseUrl = process.env.BACKEND_API_URL;
    if (!baseUrl) return prompts.map(prompt => mockEstimate(prompt.length, model));
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/analyse/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts, epsilon: 0.5 }), cache: "no-store",
        signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throw new Error(`Bulk analysis API returned ${res.status}`);
    const data = await res.json();
    if (!data || data.count !== prompts.length || !Array.isArray(data.results) || data.results.length !== prompts.length) {
        throw new Error("Bulk analysis API returned an incomplete response");
    }
    // /analyse/bulk echoes prompts in input order. Check alignment before storing metadata.
    return data.results.map((row: Parameters<typeof toResult>[0] & { prompt: string }, i: number) => {
        if (!row || row.prompt !== prompts[i]) throw new Error("Bulk analysis API returned out-of-order results");
        return toResult(row, model);
    });
}
