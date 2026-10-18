import { compress } from "../../../lib/compression/client";
import type { CompressionPreset } from "../../../lib/types";

// Lets the browser extension use the backend without holding its API key.
// The prompt is neither stored nor logged.
const MAX_PROMPT_CHARS = 20_000; // the backend's limit for /compress
const PRESETS: CompressionPreset[] = ["light", "balanced", "aggressive"];

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { prompt?: unknown; preset?: unknown } | null;
    const prompt = body?.prompt;
    const preset = (body?.preset ?? "balanced") as CompressionPreset;
    if (typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({ error: "Prompt is empty" }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
        return Response.json({ error: `Prompts are limited to ${MAX_PROMPT_CHARS} characters` }, { status: 413 });
    }
    if (!PRESETS.includes(preset)) {
        return Response.json({ error: "Unknown compression preset" }, { status: 400 });
    }

    try {
        return Response.json(await compress(prompt, preset));
    } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : "Compression failed" }, { status: 502 });
    }
}
