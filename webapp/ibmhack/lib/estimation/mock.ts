import type { EstimateResult } from "../types";
import {
    CHARS_PER_TOKEN,
    ENERGY_WH_PER_1K_TOKENS,
    HIGH_MULTIPLIER,
    LOW_MULTIPLIER,
    RESPONSE_TOKENS,
    WATER_ML_PER_WH,
} from "./methodology";
import { getModel } from "./models";

// Stand-in for the estimation API, used only while ESTIMATION_API_URL is unset
export function mockEstimate(promptChars: number, modelId: string): EstimateResult {
    const size = getModel(modelId)?.size ?? "medium";
    const tokens = Math.ceil(promptChars / CHARS_PER_TOKEN) + RESPONSE_TOKENS;
    const waterMl = (tokens / 1000) * ENERGY_WH_PER_1K_TOKENS[size] * WATER_ML_PER_WH;
    return {
        model: modelId,
        tokens,
        waterMl,
        lowMl: waterMl * LOW_MULTIPLIER,
        highMl: waterMl * HIGH_MULTIPLIER,
    };
}
