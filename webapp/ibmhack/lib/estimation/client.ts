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
    if (![data.tokens, data.water_cost, data.energy_cost].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
        throw new Error("Analysis API returned invalid resource estimates");
    }
    return { model, tokens: data.tokens, waterMl: data.water_cost,
        lowMl: data.water_cost, highMl: data.water_cost, energyWh: data.energy_cost,
        methodology: "backend-token-v1" };
}
