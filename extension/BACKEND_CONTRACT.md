# EcoPrompt backend contract (proposal)

The in-page Assistant requests three prompt capabilities separately. `src/services/analysisService.ts` is the replaceable client boundary, and `src/services/contracts.ts` defines the TypeScript wire shapes. Current results are local mock estimates. The backend can implement these endpoints independently.

All requests use `platform: "chatgpt"` and nullable `model`. The extension currently cannot verify ChatGPT's selected model or enumerate account-specific options. The frontend therefore sends an explicitly labelled demo catalog and a demo reference model; a future catalog adapter can replace those with detected account options without changing the recommendation endpoint. Water is in **millilitres (mL)**, energy in **watt-hours (Wh)**, and timestamps are ISO 8601 UTC. Estimates must include methodology and confidence, and must not be presented as measured usage without provider evidence.

## 1. Automatic impact: `POST /v1/prompt-analyses`

Called once when Assistant opens with a nonempty draft. An unchanged draft uses its cached analysis ID and does not require another request.

Request (`PromptAnalysisRequest`):

```json
{ "prompt": "Explain Markov chains", "platform": "chatgpt", "model": null }
```

Response (`PromptAnalysisResponse`):

```json
{
  "analysisId": "pa_123",
  "prompt": "Explain Markov chains",
  "efficiency": null,
  "estimates": { "waterMl": 3.2, "energyWh": 0.224, "estimatedInputTokens": 6, "estimatedWordCount": 3, "predictedOutputTokens": 154 },
  "rewriteOpportunity": { "potentialWaterSavingsMl": 0.12, "potentialEnergySavingsWh": 0.008, "estimatedReducedInputTokens": 5 },
  "methodology": { "kind": "illustrative-model", "description": "Model and token assumptions…", "confidence": "low" },
  "analysedAt": "2026-10-17T12:00:00.000Z"
}
```

`efficiency` may be null until a validated score is available. If supplied, it is `{ "score": 78, "label": "Good", "feedback": "…" }`, with a score between 0 and 100. `rewriteOpportunity` is nullable and estimates a possible reduction **without returning a rewritten prompt**. It must use the same model and predicted output assumptions as the baseline. The current UI displays water, energy and total estimated tokens (`estimatedInputTokens + predictedOutputTokens`); it does not invent an efficiency value. `analysisId` must be stable for retries of identical content, or the endpoint must support an idempotency key.

## 2. Model guidance: `POST /v1/model-recommendations`

Called automatically after impact analysis completes, so potential savings and model options are visible without opening a dropdown. The frontend sends the candidate catalog and comparison reference with the request.

Request (`ModelRecommendationRequest`):

```json
{
  "analysisId": "pa_123",
  "prompt": "Explain Markov chains",
  "platform": "chatgpt",
  "model": null,
  "catalog": {
    "source": "demo",
    "referenceModelId": "gpt-6-high",
    "models": [
      { "id": "gpt-6-instant", "name": "GPT-6 · Instant", "family": "gpt-6", "effort": "instant" },
      { "id": "gpt-6-medium", "name": "GPT-6 · Medium", "family": "gpt-6", "effort": "medium" },
      { "id": "gpt-6-high", "name": "GPT-6 · High", "family": "gpt-6", "effort": "high" },
      { "id": "gpt-6-extra-high", "name": "GPT-6 · Extra High", "family": "gpt-6", "effort": "extra-high" },
      { "id": "gpt-5-6-sol-medium", "name": "GPT-5.6 Sol · Medium", "family": "gpt-5.6-sol", "effort": "medium" }
    ]
  }
}
```

Response (`ModelRecommendationResponse`):

```json
{
  "analysisId": "pa_123",
  "catalogSource": "demo",
  "referenceModelId": "gpt-6-high",
  "baseline": { "id": "gpt-6-high", "name": "GPT-6 · High", "estimatedWaterMl": 4.16, "estimatedEnergyWh": 0.291, "suitability": 99, "rationale": "Demo reference", "potentialWaterSavingsMl": 0, "potentialEnergySavingsWh": 0 },
  "recommended": { "id": "gpt-6-instant", "name": "GPT-6 · Instant", "estimatedWaterMl": 1.76, "estimatedEnergyWh": 0.123, "suitability": 96, "rationale": "Lowest estimated usage among capable modes.", "potentialWaterSavingsMl": 2.4, "potentialEnergySavingsWh": 0.168 },
  "alternatives": [
    { "id": "gpt-6-medium", "name": "GPT-6 · Medium", "estimatedWaterMl": 2.56, "estimatedEnergyWh": 0.179, "suitability": 98, "rationale": "Illustrative alternative", "potentialWaterSavingsMl": 1.6, "potentialEnergySavingsWh": 0.112 },
    { "id": "gpt-6-high", "name": "GPT-6 · High", "estimatedWaterMl": 4.16, "estimatedEnergyWh": 0.291, "suitability": 99, "rationale": "Demo reference", "potentialWaterSavingsMl": 0, "potentialEnergySavingsWh": 0 },
    { "id": "gpt-6-extra-high", "name": "GPT-6 · Extra High", "estimatedWaterMl": 5.6, "estimatedEnergyWh": 0.392, "suitability": 99, "rationale": "Illustrative alternative", "potentialWaterSavingsMl": 0, "potentialEnergySavingsWh": 0 },
    { "id": "gpt-5-6-sol-medium", "name": "GPT-5.6 Sol · Medium", "estimatedWaterMl": 3.04, "estimatedEnergyWh": 0.213, "suitability": 92, "rationale": "Illustrative alternative", "potentialWaterSavingsMl": 1.12, "potentialEnergySavingsWh": 0.078 }
  ],
  "methodology": { "kind": "illustrative-model", "description": "Suitability and resource assumptions…", "confidence": "low" }
}
```

Each option has a 0–100 suitability assessment, modelled resource estimates, and non-negative savings relative to `referenceModelId` under comparable task assumptions. Include every supplied candidate with available estimates in either `recommended` or `alternatives`. The **current mock** uses heuristic task classification and arbitrary model factors; the scores are NOT validated capability judgements or measurements. The backend should rank for both task capability and resource usage, not usage alone. `catalogSource: "demo"` must remain visibly labelled until account-visible choices can be detected reliably. A recommendation does not switch the model in ChatGPT.

## 3. Rewrite: `POST /v1/prompt-optimisations`

Called only after **See suggested prompt** is clicked. Automatic impact analysis may estimate a rewrite opportunity, but does not return rewritten text.

Request (`PromptOptimisationRequest`):

```json
{ "analysisId": "pa_123", "prompt": "Hello, explain Markov chains", "platform": "chatgpt", "model": null }
```

Response (`PromptOptimisationResponse`):

```json
{
  "analysisId": "pa_123",
  "optimisedPrompt": "Explain Markov chains",
  "reason": "Removed opening filler.",
  "estimates": { "originalWaterMl": 3.2, "optimisedWaterMl": 3.08, "potentialWaterSavingsMl": 0.12, "originalEnergyWh": 0.224, "optimisedEnergyWh": 0.216 },
  "methodology": { "kind": "illustrative-model", "description": "Same model and output prediction used for both prompts…", "confidence": "low" }
}
```

`reason` may be null. Potential savings should be `max(0, originalWaterMl - optimisedWaterMl)` under the same assumptions. If no defensible comparison is available, make the estimate fields nullable in a future version and omit that figure in the UI. Current mock rewrites are deterministic template-based whitespace, greeting and politeness cleanup, not AI rewriting. A rewrite alone does not count as applied or as physical water saved. The extension records an applied action only when ChatGPT confirms replacing the unchanged draft; even then it remains **potential** savings.

## 4. Response analysis: `POST /v1/response-analyses`

This remains an optional, collapsed Assistant action. The user must explicitly request it after ChatGPT replies. The request carries `prompt: string | null`, `responseText: string`, `platform`, `model: string | null`, and `conversationUrl: string | null`. The response carries `analysisId`, nullable input/output token counts, `estimatedWaterMl`, `estimatedEnergyWh`, nullable `model`, methodology and timestamp. Full response text is not kept in local environmental history. The current mock only estimates visible output text and excludes prior context, reasoning, tools and images.

## Errors and persistence

Return JSON `{ "code": "INVALID_REQUEST", "message": "Prompt is required", "retryable": false }`. Use 400 for validation, 401/403 for authentication or permissions, 429 for rate limits, and 5xx for transient failures. Do not echo prompt or response text in error bodies or logs. The UI retains its last good result and offers retry where useful. Stable IDs prevent retries from adding duplicate history records.

`chrome.storage.local` is the source of truth for distinct analysed prompts, explicit rewrite actions, response analyses and cumulative totals. Redux holds the current panel state and loading/errors. Projected prompt water/energy totals sum the locally persisted unique draft analyses (not measured consumption or submission events). The separate estimated-consumption figure still sums explicitly analysed visible replies; savings are modelled potential from applied rewrites. Neither represents direct physical measurement. The water tank's 1 mL goal is a demo target, not a sustainability standard.
