"use server";

import { refresh } from "next/cache";
import { saveEstimates } from "../data/saveEstimates";
import type { EstimateResult, HistorySaveStatus } from "../types";
import { estimate, estimateMany } from "./client";
import { isKnownModel } from "./models";

// Server actions are public endpoints, so cap what one call can ask for
const MAX_PROMPT_CHARS = 50_000;
const MAX_BULK_PROMPTS = 200;
const MAX_COMPARE_MODELS = 12;
const CONCURRENCY = 5;

function validatePrompt(prompt: string) {
    if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Prompt is empty");
    if (prompt.length > MAX_PROMPT_CHARS) throw new Error(`Prompts are limited to ${MAX_PROMPT_CHARS} characters`);
}

function validateModel(model: string) {
    if (!isKnownModel(model)) throw new Error(`Unknown model: ${model}`);
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

export async function checkPrompt(prompt: string, model: string): Promise<{ result: EstimateResult; history: HistorySaveStatus }> {
    validatePrompt(prompt);
    validateModel(model);
    const result = await estimate(prompt, model);
    const history = await saveEstimates([prompt], [result], "web");
    if (history === "saved") refresh();
    return { result, history };
}

// One prompt against several models
export async function compareModels(prompt: string, models: string[]): Promise<EstimateResult[]> {
    validatePrompt(prompt);
    if (!Array.isArray(models) || models.length === 0) throw new Error("Pick at least one model");
    if (models.length > MAX_COMPARE_MODELS) throw new Error(`Compare up to ${MAX_COMPARE_MODELS} models at once`);
    models.forEach(validateModel);
    return mapWithLimit(models, CONCURRENCY, (model) => estimate(prompt, model));
}

// One backend request and one atomic history insert for the whole batch.
export async function estimatePrompts(prompts: string[], model: string): Promise<{ results: EstimateResult[]; history: HistorySaveStatus }> {
    if (!Array.isArray(prompts) || prompts.length === 0) throw new Error("No prompts to check");
    if (prompts.length > MAX_BULK_PROMPTS) throw new Error(`Check up to ${MAX_BULK_PROMPTS} prompts at once`);
    prompts.forEach(validatePrompt);
    validateModel(model);
    const results = await estimateMany(prompts, model);
    const history = await saveEstimates(prompts, results, "bulk");
    if (history === "saved") refresh();
    return { results, history };
}
