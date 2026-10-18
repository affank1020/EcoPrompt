import type { EstimateResult } from "../types";
import { mockEstimate } from "./mock";

// The one place that talks to the estimation API. Server-side only, so the
// API URL (and any key added later) never reaches the browser.
export async function estimate(prompt: string, model: string): Promise<EstimateResult> {
    const baseUrl = process.env.BACKEND_API_URL;
    if (!baseUrl) return mockEstimate(prompt.length, model);

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error(`Estimation API returned ${res.status}`);
    }
    return res.json();
}
