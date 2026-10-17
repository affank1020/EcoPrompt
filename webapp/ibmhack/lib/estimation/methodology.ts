import type { ModelSize } from "../types";

// Describes the formula the estimation API uses. The API is the source of truth:
// keep these values in sync with the backend. The landing page and the local mock
// both read from here, so they never disagree with each other.

// Wh of server energy per 1,000 tokens processed
export const ENERGY_WH_PER_1K_TOKENS: Record<ModelSize, number> = {
    small: 0.06,
    medium: 0.2,
    large: 0.6,
};

export const WUE_L_PER_KWH = 1.8; // on-site cooling water per kWh of IT energy
export const PUE = 1.2; // facility energy / IT energy
export const EWIF_L_PER_KWH = 3.1; // water used to generate each kWh of electricity
export const RESPONSE_TOKENS = 400; // assumed length of the model's reply
export const CHARS_PER_TOKEN = 4;

// The uncertainty band is asymmetric because published estimates skew high
export const LOW_MULTIPLIER = 0.5;
export const HIGH_MULTIPLIER = 2.5;

// L/kWh is the same ratio as mL/Wh
export const WATER_ML_PER_WH = WUE_L_PER_KWH + PUE * EWIF_L_PER_KWH;

export const FORMULA = "Water = (tokens ÷ 1000) × E(model) × (WUE + PUE × EWIF)";

export type Assumption = {
    label: string;
    value: string;
    detail: string;
    sourceIds: string[];
};

export const ASSUMPTIONS: Assumption[] = [
    {
        label: "Tokens",
        value: `prompt chars ÷ ${CHARS_PER_TOKEN} + ${RESPONSE_TOKENS}`,
        detail: `We count roughly one token per ${CHARS_PER_TOKEN} characters of your prompt and assume a typical ${RESPONSE_TOKENS}-token reply.`,
        sourceIds: [],
    },
    {
        label: "E(model)",
        value: `${ENERGY_WH_PER_1K_TOKENS.small} / ${ENERGY_WH_PER_1K_TOKENS.medium} / ${ENERGY_WH_PER_1K_TOKENS.large} Wh per 1k tokens`,
        detail: "Server energy for small, medium and large models. Providers don't publish per-model figures, so we group models by size.",
        sourceIds: ["google-2025", "epoch-2025"],
    },
    {
        label: "WUE",
        value: `${WUE_L_PER_KWH} L/kWh`,
        detail: "Water evaporated on site to cool the servers, per kWh of IT energy.",
        sourceIds: ["lbnl-2024", "li-2023"],
    },
    {
        label: "PUE",
        value: `${PUE}`,
        detail: "Total facility energy divided by IT energy. Typical for large cloud data centres.",
        sourceIds: ["uptime-2024", "lbnl-2024"],
    },
    {
        label: "EWIF",
        value: `${EWIF_L_PER_KWH} L/kWh`,
        detail: "Water consumed by power plants to generate the electricity, using a US grid average.",
        sourceIds: ["li-2023"],
    },
];

export const UNCERTAINTY_NOTE =
    `Every estimate is shown with a range from ${LOW_MULTIPLIER}× to ${HIGH_MULTIPLIER}× the central value. ` +
    "Data centre location, cooling technology, hardware and reply length all move the real figure, " +
    "and published per-prompt estimates differ by about an order of magnitude.";
