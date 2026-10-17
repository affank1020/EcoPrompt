import type { Model } from "../types";

// Ids must match the model ids the estimation API accepts
export const MODELS: Model[] = [
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", size: "large" },
    { id: "gpt-4o-mini", name: "GPT-4o mini", provider: "OpenAI", size: "small" },
    { id: "claude-opus", name: "Claude Opus", provider: "Anthropic", size: "large" },
    { id: "claude-haiku", name: "Claude Haiku", provider: "Anthropic", size: "small" },
    { id: "gemini-pro", name: "Gemini Pro", provider: "Google", size: "large" },
    { id: "gemini-flash", name: "Gemini Flash", provider: "Google", size: "small" },
    { id: "mistral-large", name: "Mistral Large", provider: "Mistral", size: "medium" },
    { id: "llama-70b", name: "Llama 70B", provider: "Meta", size: "medium" },
    { id: "llama-8b", name: "Llama 8B", provider: "Meta", size: "small" },
];

// The landing page demo compares one large and one small model
export const DEMO_MODEL_IDS = ["gpt-4o", "gpt-4o-mini"];

export const DEFAULT_MODEL_ID = "gpt-4o";

export function getModel(id: string): Model | undefined {
    return MODELS.find((m) => m.id === id);
}

export function isKnownModel(id: string): boolean {
    return MODELS.some((m) => m.id === id);
}
