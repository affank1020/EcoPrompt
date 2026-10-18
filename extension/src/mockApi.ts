/**
 * Temporary demo API. All environmental numbers and model scores here are
 * illustrative, NOT measured, peer-reviewed, or based on actual ChatGPT usage.
 * Replace the separate impact, model, and optimisation functions with backend
 * endpoints once the hackathon API is ready.
 */
export type Complexity = "Simple" | "Moderate" | "Advanced";
export type ModelId = string;
export interface ModelEstimate {
  id: ModelId;
  name: string;
  tagline: string;
  waterMl: number;
  energyWh: number;
  suitability: number;
}
export interface ImpactEstimate {
  waterMl: number;
  energyWh: number;
}
export interface Analysis {
  prompt: string;
  inputTokens: number;
  predictedOutputTokens: number;
  complexity: Complexity;
  recommendation: ModelId;
  models: ModelEstimate[];
  baseline: ImpactEstimate;
  optimized: ImpactEstimate;
  rewrittenPrompt: string;
  savingsPercent: number;
}
const PROFILES: Record<
  ModelId,
  {
    name: string;
    tagline: string;
    factor: number;
  }
> = {
  "gpt-6-instant": { name: "GPT-6 · Instant", tagline: "Everyday tasks", factor: 0.55 },
  "gpt-6-medium": { name: "GPT-6 · Medium", tagline: "Standard thinking", factor: 0.8 },
  "gpt-6-high": { name: "GPT-6 · High", tagline: "Extended thinking", factor: 1.3 },
  "gpt-6-extra-high": { name: "GPT-6 · Extra High", tagline: "Deeper reasoning", factor: 1.75 },
  "gpt-5-6-sol-medium": { name: "GPT-5.6 Sol · Medium", tagline: "Alternative thinking model", factor: 0.95 },
};
const REFERENCE_MODEL = "gpt-6-high";
const DEMO_IDS = Object.keys(PROFILES);
const round = (value: number, places = 1) => Number(value.toFixed(places));
export const estimateTokens = (text: string) =>
  text.trim() ? Math.max(1, Math.ceil(text.length / 4)) : 0;
export const estimateWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
function classify(prompt: string): Complexity {
  const text = prompt.toLowerCase();
  if (
    /(?:prove|derive|debug|architect|refactor|analyse|analyze|optimi[sz]e algorithm|trade.?off|design a system|multi.?step|complexity analysis)/.test(
      text,
    ) ||
    prompt.length > 720
  )
    return "Advanced";
  if (
    /(?:code|python|typescript|javascript|compare|explain|summari[sz]e|plan|research|implement|examples?)/.test(
      text,
    ) ||
    prompt.length > 170
  )
    return "Moderate";
  return "Simple";
}
function rewrite(prompt: string): string {
  const original = prompt.trim();
  const compact = original.replace(/[ \t]{2,}/g, " ");
  const withoutGreeting = compact.replace(/^(?:hi|hello|hey)[!,.;\s]+/i, "");
  const withoutPoliteness = withoutGreeting
    .replace(/^(?:could you|can you|would you)\s+(?:please\s+)?/i, "")
    .replace(/^i (?:would like|want) you to\s+/i, "")
    .replace(/^please\s+/i, "");
  // Surface-level demo cleanup, not an AI-generated improvement.
  return withoutPoliteness
    ? withoutPoliteness[0].toUpperCase() + withoutPoliteness.slice(1)
    : original;
}

function impact(tokens: number, factor: number): ImpactEstimate {
  // Arbitrary demo coefficients per 1,000 tokens — replace with sourced model.
  return {
    waterMl: round((tokens / 1000) * 20 * factor, 2),
    energyWh: round((tokens / 1000) * 1.4 * factor, 3),
  };
}
/** Estimate visible assistant text output only; NOT actual per-response usage. */
export function estimateVisibleReply(reply: string): ImpactEstimate & {
  outputTokens: number;
} {
  const outputTokens = estimateTokens(reply);
  return { outputTokens, ...impact(outputTokens, 1) };
}
export function estimatePrompt(prompt: string) {
  const complexity = classify(prompt);
  const inputTokens = estimateTokens(prompt);
  const estimatedWordCount = estimateWords(prompt);
  const predictedOutputTokens = Math.min(
    1400,
    Math.max(90, Math.ceil(inputTokens * 1.7 + 110)),
  );
  const baseline = impact(
    inputTokens + predictedOutputTokens,
    PROFILES[REFERENCE_MODEL].factor,
  );
  return { complexity, inputTokens, estimatedWordCount, predictedOutputTokens, baseline };
}
export function estimateRewriteOpportunity(prompt: string) {
  const original = estimatePrompt(prompt);
  const reducedInputTokens = Math.max(0, original.inputTokens - estimateTokens(rewrite(prompt)));
  const lighter = impact(
    original.inputTokens - reducedInputTokens + original.predictedOutputTokens,
    PROFILES[REFERENCE_MODEL].factor,
  );
  return {
    estimatedReducedInputTokens: reducedInputTokens,
    potentialWaterSavingsMl: Math.max(0, round(original.baseline.waterMl - lighter.waterMl, 2)),
    potentialEnergySavingsWh: Math.max(0, round(original.baseline.energyWh - lighter.energyWh, 3)),
  };
}
export function recommendModels(prompt: string, ids: string[] = DEMO_IDS) {
  const { inputTokens, predictedOutputTokens } = estimatePrompt(prompt);
  const total = inputTokens + predictedOutputTokens;
  const complexity = classify(prompt);
  const suitability: Record<string, Record<Complexity, number>> = {
    "gpt-6-instant": { Simple: 96, Moderate: 79, Advanced: 42 },
    "gpt-6-medium": { Simple: 98, Moderate: 94, Advanced: 73 },
    "gpt-6-high": { Simple: 99, Moderate: 97, Advanced: 92 },
    "gpt-6-extra-high": { Simple: 99, Moderate: 98, Advanced: 96 },
    "gpt-5-6-sol-medium": { Simple: 97, Moderate: 91, Advanced: 76 },
  };
  const models: ModelEstimate[] = ids.filter((id) => PROFILES[id]).map((id) => ({
    id,
    name: PROFILES[id].name,
    tagline: PROFILES[id].tagline,
    ...impact(total, PROFILES[id].factor),
    suitability: suitability[id]?.[complexity] ?? 50,
  }));
  const capable = models.filter((model) => model.suitability >= 90);
  const recommendation = (capable.length ? capable : models)
    .slice()
    .sort((a, b) => a.waterMl - b.waterMl || b.suitability - a.suitability)[0]?.id ?? REFERENCE_MODEL;
  return { models, recommendation };
}

export function optimisePrompt(prompt: string) {
  const original = estimatePrompt(prompt);
  const rewrittenPrompt = rewrite(prompt);
  const optimized = impact(
    estimateTokens(rewrittenPrompt) + original.predictedOutputTokens,
    PROFILES[REFERENCE_MODEL].factor,
  );
  return { rewrittenPrompt, baseline: original.baseline, optimized };
}
/** Compatibility helper for older local records and existing source-based tests. */
export async function analyzePrompt(prompt: string): Promise<Analysis> {
  await new Promise((resolve) => setTimeout(resolve, 420));
  const base = estimatePrompt(prompt);
  const { models, recommendation } = recommendModels(prompt);
  const { rewrittenPrompt, baseline, optimized } = optimisePrompt(prompt);
  return {
    prompt,
    inputTokens: base.inputTokens,
    predictedOutputTokens: base.predictedOutputTokens,
    complexity: base.complexity,
    recommendation,
    models,
    baseline,
    optimized,
    rewrittenPrompt,
    savingsPercent:
      baseline.waterMl > 0
        ? Math.max(
            0,
            Math.round((1 - optimized.waterMl / baseline.waterMl) * 100),
          )
        : 0,
  };
}
