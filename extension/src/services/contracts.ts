export type Platform = "chatgpt";
export type EstimateConfidence = "low" | "medium" | "high";
export interface EstimationMethod {
  kind: "illustrative-model" | "provider-usage";
  description: string;
  confidence: EstimateConfidence;
}
export interface PromptAnalysisRequest {
  prompt: string;
  platform: Platform;
  model: string | null;
}
export interface PromptAnalysisResponse {
  analysisId: string;
  prompt: string;
  searchRecommendation?: import("./searchRecommendation").SearchRecommendation | null;
  estimates: {
    waterMl: number;
    energyWh: number;
    estimatedInputTokens: number;
    estimatedWordCount?: number;
    predictedOutputTokens: number;
  };
  rewriteOpportunity?: {
    potentialWaterSavingsMl: number;
    potentialEnergySavingsWh: number;
    estimatedReducedInputTokens: number;
  } | null;
  methodology: EstimationMethod;
  analysedAt: string;
}
export interface ModelRecommendationRequest {
  analysisId: string;
  prompt: string;
  platform: Platform;
  model: string | null;
  catalog: ModelCatalog;
}
export interface ModelCandidate {
  id: string;
  name: string;
  family: string;
  effort: string;
}
export interface ModelCatalog {
  source: "demo" | "detected";
  referenceModelId: string;
  models: ModelCandidate[];
}
export interface ModelOption {
  id: string;
  name: string;
  estimatedWaterMl: number;
  estimatedEnergyWh: number;
  suitability: number;
  rationale: string;
  potentialWaterSavingsMl: number;
  potentialEnergySavingsWh: number;
}
export interface ModelRecommendationResponse {
  analysisId: string;
  catalogSource: ModelCatalog["source"];
  referenceModelId: string;
  baseline: ModelOption;
  recommended: ModelOption;
  alternatives: ModelOption[];
  methodology: EstimationMethod;
}
export interface PromptOptimisationRequest {
  analysisId: string;
  prompt: string;
  platform: Platform;
  model: string | null;
}
export interface PromptOptimisationResponse {
  analysisId: string;
  optimisedPrompt: string;
  reason: string | null;
  estimates: {
    originalWaterMl: number;
    optimisedWaterMl: number;
    potentialWaterSavingsMl: number;
    originalEnergyWh: number;
    optimisedEnergyWh: number;
  };
  methodology: EstimationMethod;
}
export interface ResponseAnalysisRequest {
  prompt: string | null;
  responseText: string;
  platform: Platform;
  model: string | null;
  conversationUrl: string | null;
}
export interface ResponseAnalysisResponse {
  analysisId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedWaterMl: number;
  estimatedEnergyWh: number;
  model: string | null;
  methodology: EstimationMethod;
  analysedAt: string;
}
export interface EnvironmentalHistory {
  prompts: Array<{
    id: string;
    at: number;
    prompt: string;
    analysis: PromptAnalysisResponse;
    optimisation: PromptOptimisationResponse | null;
    appliedAt: number | null;
  }>;
  responses: ResponseAnalysisResponse[];
}
export function stableId(kind: string, text: string): string {
  let hash = 2166136261;
  for (const char of `${kind}:${text}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${kind}-${(hash >>> 0).toString(36)}`;
}
