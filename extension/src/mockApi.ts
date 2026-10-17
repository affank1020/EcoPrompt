/**
 * Temporary demo API. All environmental numbers and model scores here are
 * illustrative, NOT measured, peer-reviewed, or based on actual ChatGPT usage.
 * Replace analyzePrompt() with a real endpoint once the hackathon API is ready.
 */
export type Complexity = 'Simple' | 'Moderate' | 'Advanced';
export type ModelId = 'small' | 'balanced' | 'reasoning';

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

const PROFILES: Record<ModelId, { name: string; tagline: string; factor: number }> = {
  small: { name: 'Small model', tagline: 'Quick, lightweight tasks', factor: 0.42 },
  balanced: { name: 'Balanced model', tagline: 'General-purpose tasks', factor: 1 },
  reasoning: { name: 'Reasoning model', tagline: 'Multi-step complex tasks', factor: 2.1 },
};

const round = (value: number, places = 1) => Number(value.toFixed(places));
export const estimateTokens = (text: string) => (text.trim() ? Math.max(1, Math.ceil(text.length / 4)) : 0);

function classify(prompt: string): Complexity {
  const text = prompt.toLowerCase();
  if (
    /(?:prove|derive|debug|architect|refactor|analyse|analyze|optimi[sz]e algorithm|trade.?off|design a system|multi.?step|complexity analysis)/.test(text)
    || prompt.length > 720
  ) return 'Advanced';
  if (
    /(?:code|python|typescript|javascript|compare|explain|summari[sz]e|plan|research|implement|examples?)/.test(text)
    || prompt.length > 170
  ) return 'Moderate';
  return 'Simple';
}

function rewrite(prompt: string): string {
  let clean = prompt.trim().replace(/[ \t]{2,}/g, ' ');
  clean = clean
    .replace(/^(?:hi|hello|hey)[!,.\s]+/i, '')
    .replace(/^(?:could you|can you|would you)\s+(?:please\s+)?/i, '')
    .replace(/^i (?:would like|want) you to\s+/i, '')
    .replace(/^please\s+/i, '');
  if (clean.length) clean = clean[0].toUpperCase() + clean.slice(1);
  if (!/\b(?:detailed|in.depth|comprehensive|step.by.step|thorough)\b/i.test(prompt)
      && !/\b(?:brief|concise|short)\b/i.test(prompt)) {
    clean += '\n\nKeep the answer focused and concise.';
  }
  return clean;
}

function impact(tokens: number, factor: number): ImpactEstimate {
  // Arbitrary demo coefficients per 1,000 tokens — replace with sourced model.
  return {
    waterMl: round(tokens / 1000 * 20 * factor, 2),
    energyWh: round(tokens / 1000 * 1.4 * factor, 3),
  };
}

export async function analyzePrompt(prompt: string): Promise<Analysis> {
  // Simulate network latency for loading/skeleton UI.
  await new Promise(resolve => setTimeout(resolve, 420));
  const complexity = classify(prompt);
  const recommendation: ModelId = complexity === 'Simple' ? 'small' : complexity === 'Moderate' ? 'balanced' : 'reasoning';
  const inputTokens = estimateTokens(prompt);
  const predictedOutputTokens = Math.min(1400, Math.max(90, Math.ceil(inputTokens * 1.7 + 110)));
  const baselineTokens = inputTokens + predictedOutputTokens;
  const rewrittenPrompt = rewrite(prompt);
  const rewrittenTokens = estimateTokens(rewrittenPrompt);
  const revisedOutputTokens = rewrittenPrompt === prompt.trim()
    ? predictedOutputTokens
    : Math.round(predictedOutputTokens * 0.78);
  const optimizedTokens = rewrittenTokens + revisedOutputTokens;

  const models: ModelEstimate[] = (Object.entries(PROFILES) as Array<[ModelId, typeof PROFILES[ModelId]]>)
    .map(([id, profile]) => ({
      id,
      name: profile.name,
      tagline: profile.tagline,
      ...impact(baselineTokens, profile.factor),
      suitability: ({
        Simple: { small: 96, balanced: 98, reasoning: 98 },
        Moderate: { small: 73, balanced: 94, reasoning: 96 },
        Advanced: { small: 41, balanced: 72, reasoning: 93 },
      } as Record<Complexity, Record<ModelId, number>>)[complexity][id],
    }));

  const baseline = impact(baselineTokens, PROFILES.balanced.factor);
  const optimized = impact(optimizedTokens, PROFILES[recommendation].factor);
  const savingsPercent = baseline.waterMl > 0
    ? Math.max(0, Math.round((1 - optimized.waterMl / baseline.waterMl) * 100))
    : 0;

  return {
    prompt,
    inputTokens,
    predictedOutputTokens,
    complexity,
    recommendation,
    models,
    baseline,
    optimized,
    rewrittenPrompt,
    savingsPercent,
  };
}
