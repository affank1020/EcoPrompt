import type { EstimateResult } from "../types";
import {
    CHARS_PER_TOKEN,
    HIGH_MULTIPLIER,
    LOW_MULTIPLIER,
    MOCK_COMPLEXITY,
    energyWh,
    waterMl,
} from "./methodology";

// Stand-in for the estimation API, used only while BACKEND_API_URL is unset.
// Same formula as the API, with approximate tokens and a fixed complexity.
export function mockEstimate(promptChars: number, modelId: string): EstimateResult {
    const tokens = Math.ceil(promptChars / CHARS_PER_TOKEN);
    const water = waterMl(tokens, MOCK_COMPLEXITY);
    return {
        model: modelId,
        methodology: "website-mock-v1",
        energyWh: energyWh(tokens, MOCK_COMPLEXITY),
        tokens,
        waterMl: water,
        lowMl: water * LOW_MULTIPLIER,
        highMl: water * HIGH_MULTIPLIER,
    };
}
