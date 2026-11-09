import type { Complexity } from "../types";

// Describes the formula the estimation API uses (calculate_consumption in backend/api.py).
// The API is the source of truth: keep these values in sync with the backend. The landing
// page and the local mock both read from here, so they never disagree with each other.

// Reply length predicted from the prompt's complexity, as a multiple of its input tokens
export const OUTPUT_MULTIPLIER: Record<Complexity, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
};

// One rate for every model, per 1,000 tokens (input + predicted output)
export const ENERGY_WH_PER_1K_TOKENS = 0.453;
export const WATER_ML_PER_1K_TOKENS = 0.429;

export const TOKENIZER = "o200k_base";

export const FORMULA = "Water = (input tokens + predicted reply tokens) ÷ 1000 × 0.429 mL";

export function totalTokens(inputTokens: number, complexity: Complexity): number {
    return inputTokens * (1 + OUTPUT_MULTIPLIER[complexity]);
}

export function energyWh(inputTokens: number, complexity: Complexity): number {
    return (totalTokens(inputTokens, complexity) / 1000) * ENERGY_WH_PER_1K_TOKENS;
}

export function waterMl(inputTokens: number, complexity: Complexity): number {
    return (totalTokens(inputTokens, complexity) / 1000) * WATER_ML_PER_1K_TOKENS;
}

// Local mock only: it can't tokenize or classify, so it approximates both
export const CHARS_PER_TOKEN = 4;
export const MOCK_COMPLEXITY: Complexity = "medium";

// Local mock only: the API returns a single value. Stored mock and extension rows keep
// this illustrative band, which is asymmetric because published estimates skew high.
export const LOW_MULTIPLIER = 0.5;
export const HIGH_MULTIPLIER = 2.5;

export type Assumption = {
    label: string;
    value: string;
    detail: string;
    sourceIds: string[];
};

export const ASSUMPTIONS: Assumption[] = [
    {
        label: "Input tokens",
        value: `Counted with ${TOKENIZER}`,
        detail: "We count your prompt's tokens exactly, using the tokenizer GPT-4o uses. Other models split text a little differently.",
        sourceIds: [],
    },
    {
        label: "Complexity",
        value: "easy / medium / hard",
        detail: "A classifier trained on real chatbot conversations, blended with a small fine-tuned language model, rates how demanding your prompt is.",
        sourceIds: ["wildchat-tagged", "brick-complexity"],
    },
    {
        label: "Reply tokens",
        value: `${OUTPUT_MULTIPLIER.easy}× / ${OUTPUT_MULTIPLIER.medium}× / ${OUTPUT_MULTIPLIER.hard}× input`,
        detail: "Harder prompts tend to get longer answers, so we predict the reply's length from the prompt's complexity.",
        sourceIds: [],
    },
    {
        label: "Energy",
        value: `${ENERGY_WH_PER_1K_TOKENS} Wh per 1k tokens`,
        detail: "Server energy per token. Providers don't publish per-model figures, so every model uses the same rate.",
        sourceIds: [],
    },
    {
        label: "Water",
        value: `${WATER_ML_PER_1K_TOKENS} mL per 1k tokens`,
        detail: "Water used to cool the data centre and generate its electricity, per token.",
        sourceIds: [],
    },
];

export const LIMITATIONS =
    "These are estimates, not measurements. The reply length is predicted rather than counted, every model " +
    "uses the same per-token rate, and data centre location, cooling and hardware all move the real figure. " +
    "Published per-prompt estimates differ by about an order of magnitude.";
