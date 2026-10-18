import { estimate } from "../../../lib/estimation/client";
import { DEFAULT_MODEL_ID } from "../../../lib/estimation/models";

// Lets the browser extension use the backend without holding its API key.
// Returns numbers only; the prompt is neither stored nor logged.
const MAX_PROMPT_CHARS = 50_000;

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
    const prompt = body?.prompt;
    if (typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({ error: "Prompt is empty" }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
        return Response.json({ error: `Prompts are limited to ${MAX_PROMPT_CHARS} characters` }, { status: 413 });
    }

    try {
        const { tokens, complexity, waterMl, lowMl, highMl, energyWh } = await estimate(prompt, DEFAULT_MODEL_ID);
        return Response.json({ tokens, complexity, waterMl, lowMl, highMl, energyWh });
    } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : "Estimate failed" }, { status: 502 });
    }
}
