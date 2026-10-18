"use server";

import { estimate } from "../estimation/client";
import { isKnownModel } from "../estimation/models";
import type { CompressionPreset, CompressionResult } from "../types";
import { compress } from "./client";

const MAX_PROMPT_CHARS = 20_000;

// Compresses a prompt, then estimates both versions so the saving comes from the
// same estimation API as every other figure on the site
export async function compressPrompt(prompt: string, model: string, preset: CompressionPreset = "balanced"): Promise<CompressionResult> {
    if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Prompt is empty");
    if (prompt.length > MAX_PROMPT_CHARS) throw new Error(`Prompts are limited to ${MAX_PROMPT_CHARS} characters`);
    if (!isKnownModel(model)) throw new Error(`Unknown model: ${model}`);

    if (!["light", "balanced", "aggressive"].includes(preset)) throw new Error("Unknown compression preset");
    const { compressed, details } = await compress(prompt, preset);
    // If the service couldn't shorten it, don't spend a second estimate on the same text
    if (!compressed.trim() || compressed.trim() === prompt.trim()) {
        const original = await estimate(prompt, model);
        return { compressed: prompt, original, optimised: original, details };
    }
    const [original, optimised] = await Promise.all([estimate(prompt, model), estimate(compressed, model)]);
    return { compressed, original, optimised, details };
}
