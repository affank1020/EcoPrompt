import type { ModelRecommendationResponse, PromptAnalysisResponse } from "./contracts";

// Each action is estimated against the same baseline. Their savings may overlap,
// so the headline uses the strongest single action rather than adding them.
export function savingsOpportunity(
  analysis: PromptAnalysisResponse,
  model: ModelRecommendationResponse | null,
) {
  const baseline = analysis.estimates;
  const suggested = model?.recommended;
  const modelWater = suggested && suggested.id !== model?.baseline.id
    ? Math.min(baseline.waterMl, suggested.potentialWaterSavingsMl)
    : 0;
  const rewriteWater = Math.min(
    baseline.waterMl,
    analysis.rewriteOpportunity?.potentialWaterSavingsMl ?? 0,
  );
  const meaningful = (water: number) =>
    water >= 0.1 && baseline.waterMl > 0 && water / baseline.waterMl >= 0.01;
  const showModel = meaningful(modelWater);
  const showRewrite = meaningful(rewriteWater);
  const best = showModel && (!showRewrite || modelWater >= rewriteWater) ? "model" : showRewrite ? "rewrite" : null;
  const waterMl = best === "model" ? modelWater : best === "rewrite" ? rewriteWater : 0;
  const energyWh = best === "model"
    ? Math.min(baseline.energyWh, suggested?.potentialEnergySavingsWh ?? 0)
    : best === "rewrite"
      ? Math.min(baseline.energyWh, analysis.rewriteOpportunity?.potentialEnergySavingsWh ?? 0)
      : 0;
  return {
    showModel,
    showRewrite,
    best,
    waterMl,
    energyWh,
    percent: baseline.waterMl > 0 ? Math.round(waterMl / baseline.waterMl * 100) : 0,
  };
}
