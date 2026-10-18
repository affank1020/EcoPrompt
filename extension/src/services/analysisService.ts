import {
  estimatePrompt,
  estimateTokens,
  estimateVisibleReply,
  estimateRewriteOpportunity,
  recommendModels,
  optimisePrompt,
} from "../mockApi";
import {
  stableId,
  type PromptAnalysisRequest,
  type PromptAnalysisResponse,
  type ModelRecommendationRequest,
  type ModelRecommendationResponse,
  type PromptOptimisationRequest,
  type PromptOptimisationResponse,
  type ResponseAnalysisRequest,
  type ResponseAnalysisResponse,
  type ModelOption,
} from "./contracts";
import { searchRecommendation } from "./searchRecommendation";
export interface AnalysisService {
  analysePrompt(
    request: PromptAnalysisRequest,
  ): Promise<PromptAnalysisResponse>;
  recommendModel(
    request: ModelRecommendationRequest,
  ): Promise<ModelRecommendationResponse>;
  optimisePrompt(
    request: PromptOptimisationRequest,
  ): Promise<PromptOptimisationResponse>;
  analyseResponse(
    request: ResponseAnalysisRequest,
  ): Promise<ResponseAnalysisResponse>;
}
const methodology = {
  kind: "illustrative-model" as const,
  description:
    "Local mock: input tokens ≈ characters ÷ 4; predicted output tokens and illustrative coefficients (20 mL, 1.4 Wh per 1,000 tokens, scaled to a GPT-6 High demo reference). These are not measured usage.",
  confidence: "low" as const,
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const mockAnalysisService: AnalysisService = {
  async analysePrompt(request) {
    // Deliberate demo latency so the UI can represent a future network analysis.
    await pause(950);
    const base = estimatePrompt(request.prompt);
    return {
      analysisId: stableId("prompt", request.prompt.trim()),
      prompt: request.prompt,
      searchRecommendation: searchRecommendation(request.prompt),
      estimates: {
        waterMl: base.baseline.waterMl,
        energyWh: base.baseline.energyWh,
        estimatedInputTokens: base.inputTokens,
        estimatedWordCount: base.estimatedWordCount,
        predictedOutputTokens: base.predictedOutputTokens,
      },
      rewriteOpportunity: estimateRewriteOpportunity(request.prompt),
      methodology,
      analysedAt: new Date().toISOString(),
    };
  },
  async recommendModel(request) {
    await pause(200);
    const { models, recommendation } = recommendModels(
      request.prompt,
      request.catalog.models.map((model) => model.id),
    );
    const reference = models.find((model) => model.id === request.catalog.referenceModelId) ?? models[0];
    if (!reference) throw new Error("No comparable models were supplied.");
    const options: ModelOption[] = models.map((model) => ({
      id: model.id,
      name: request.catalog.models.find((candidate) => candidate.id === model.id)?.name ?? model.name,
      estimatedWaterMl: model.waterMl,
      estimatedEnergyWh: model.energyWh,
      suitability: model.suitability,
      potentialWaterSavingsMl: Math.max(0, Number((reference.waterMl - model.waterMl).toFixed(2))),
      potentialEnergySavingsWh: Math.max(0, Number((reference.energyWh - model.energyWh).toFixed(3))),
      rationale:
        model.id === recommendation
          ? "Lowest estimated usage among modes with at least 90% demo task suitability."
          : "Illustrative usage and task suitability; not a measured comparison.",
    }));
    return {
      analysisId: request.analysisId,
      catalogSource: request.catalog.source,
      referenceModelId: reference.id,
      baseline: options.find((model) => model.id === reference.id)!,
      recommended: options.find((model) => model.id === recommendation)!,
      alternatives: options.filter((model) => model.id !== recommendation),
      methodology,
    };
  },
  async optimisePrompt(request) {
    await pause(200);
    const { rewrittenPrompt, baseline, optimized } = optimisePrompt(
      request.prompt,
    );
    return {
      analysisId: request.analysisId,
      optimisedPrompt: rewrittenPrompt,
      reason:
        rewrittenPrompt === request.prompt.trim()
          ? "The demo template made no change."
          : "Example template rewrite only, not AI-validated. Review before applying.",
      estimates: {
        originalWaterMl: baseline.waterMl,
        optimisedWaterMl: optimized.waterMl,
        potentialWaterSavingsMl: Math.max(
          0,
          Number((baseline.waterMl - optimized.waterMl).toFixed(2)),
        ),
        originalEnergyWh: baseline.energyWh,
        optimisedEnergyWh: optimized.energyWh,
      },
      methodology,
    };
  },
  async analyseResponse(request) {
    await pause(240);
    const visible = estimateVisibleReply(request.responseText);
    return {
      analysisId: stableId(
        "response",
        `${request.conversationUrl ?? ""}:${request.responseText}`,
      ),
      inputTokens: request.prompt ? estimateTokens(request.prompt) : null,
      outputTokens: visible.outputTokens,
      estimatedWaterMl: visible.waterMl,
      estimatedEnergyWh: visible.energyWh,
      model: request.model,
      methodology: {
        ...methodology,
        description:
          "Visible response text only. Excludes prior context, reasoning, tools, images and provider overhead. Input tokens, when shown, cover the current draft only and are excluded from this water/energy estimate.",
      },
      analysedAt: new Date().toISOString(),
    };
  },
};
export const analysisService: AnalysisService = mockAnalysisService;
