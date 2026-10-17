import type { RootState, HistoryItem, SavingAction } from "../store";
import type { Analysis as LegacyAnalysis } from "../mockApi";
import { optimisationKey, normaliseLedger, migrateOptimisations, ledgerFromRecords } from "./passiveTracking";
import { searchRecommendation } from "./searchRecommendation";
import {
  stableId,
  type PromptAnalysisResponse,
  type PromptOptimisationResponse,
} from "./contracts";
const historyKey = "ecoHistoryV4";
const sessionKey = "ecoSessionV3";
function cleanAnalysis(analysis: PromptAnalysisResponse): PromptAnalysisResponse {
  const { efficiency: _oldScore, efficiencyAssessment: _oldAssessment, ...retained } = analysis as PromptAnalysisResponse & {
    efficiency?: unknown; efficiencyAssessment?: unknown;
  };
  return { ...retained, searchRecommendation: typeof retained.prompt === "string" ? searchRecommendation(retained.prompt) : null };
}
function importLegacyHistory(records: unknown): HistoryItem[] {
  if (!Array.isArray(records)) return [];
  const seen = new Set<string>();
  return records
    .flatMap((record): HistoryItem[] => {
      const old = record as {
        at?: number;
        used?: boolean;
        analysis?: Partial<LegacyAnalysis>;
      };
      const a = old.analysis;
      if (!a || typeof a.prompt !== "string" || !a.baseline || !a.optimized)
        return [];
      const id = stableId("prompt", a.prompt.trim());
      if (seen.has(id)) return [];
      seen.add(id);
      const at = typeof old.at === "number" ? old.at : Date.now();
      const methodology = {
        kind: "illustrative-model" as const,
        description: "Imported from an earlier EcoPrompt local demo.",
        confidence: "low" as const,
      };
      const analysis: PromptAnalysisResponse = {
        analysisId: id,
        prompt: a.prompt,
        searchRecommendation: null,
        estimates: {
          waterMl: a.baseline.waterMl,
          energyWh: a.baseline.energyWh,
          estimatedInputTokens: a.inputTokens ?? 0,
          predictedOutputTokens: a.predictedOutputTokens ?? 0,
        },
        methodology,
        analysedAt: new Date(at).toISOString(),
      };
      const optimisation: PromptOptimisationResponse | null =
        typeof a.rewrittenPrompt === "string"
          ? {
              analysisId: id,
              optimisedPrompt: a.rewrittenPrompt,
              reason: "Imported from an earlier local demo.",
              estimates: {
                originalWaterMl: a.baseline.waterMl,
                optimisedWaterMl: a.optimized.waterMl,
                potentialWaterSavingsMl: Math.max(
                  0,
                  Number((a.baseline.waterMl - a.optimized.waterMl).toFixed(2)),
                ),
                originalEnergyWh: a.baseline.energyWh,
                optimisedEnergyWh: a.optimized.energyWh,
              },
              methodology,
            }
          : null;
      return [
        {
          id,
          at,
          analysis,
          optimisation,
          used: Boolean(old.used && optimisation),
          appliedAt: old.used && optimisation ? at : null,
        },
      ];
    })
    .slice(0, 100);
}
export async function readSavedState() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([historyKey, "ecoHistoryV3", "ecoHistoryV2", "ecoHistory", optimisationKey, "ecoAssessmentsV1", "ecoSearchSelectionsV1"]),
    chrome.storage.session.get(sessionKey),
  ]);
  const saved = local[historyKey] ?? local.ecoHistoryV3;
  const legacy = local.ecoHistoryV2?.history ?? local.ecoHistory;
  const history: HistoryItem[] = (Array.isArray(saved?.history)
    ? saved.history : importLegacyHistory(legacy)).map((item: HistoryItem) => ({
      ...item, analysis: cleanAnalysis(item.analysis),
    }));
  const savingActions: SavingAction[] = Array.isArray(saved?.savingActions)
    ? saved.savingActions
    : history.filter((item) => item.used && item.optimisation).map((item) => ({
        id: stableId("action", `${item.id}:rewrite`),
        at: item.appliedAt ?? item.at,
        type: "rewrite" as const,
        analysisId: item.id,
        estimatedWaterMl: item.optimisation!.estimates.potentialWaterSavingsMl,
        estimatedEnergyWh: Math.max(0, item.optimisation!.estimates.originalEnergyWh - item.optimisation!.estimates.optimisedEnergyWh),
        realisedWaterMl: 0,
        realisedEnergyWh: 0,
      }));
  const legacyIds = savingActions.map((item) => item.analysisId);
  const optimisationLedger = local[optimisationKey]
    ? normaliseLedger(local[optimisationKey], legacyIds)
    : ledgerFromRecords(migrateOptimisations(local.ecoAssessmentsV1, local.ecoSearchSelectionsV1), legacyIds);
  if (!local[optimisationKey] || Array.isArray(local[optimisationKey])) {
    await chrome.storage.local.set({ [optimisationKey]: optimisationLedger });
  }
  if (local.ecoAssessmentsV1 || local.ecoSearchSelectionsV1) {
    await chrome.storage.local.remove(["ecoAssessmentsV1", "ecoSearchSelectionsV1"]);
  }
  return {
    optimisationLedger,
    history,
    savingActions,
    responseHistory: Array.isArray(saved?.responseHistory)
      ? saved.responseHistory
      : Array.isArray(local.ecoHistoryV2?.responseHistory)
        ? local.ecoHistoryV2.responseHistory
        : [],
    session: session[sessionKey]?.analysis
      ? { ...session[sessionKey], analysis: cleanAnalysis(session[sessionKey].analysis) }
      : session[sessionKey] ?? {},
  };
}
export async function saveState(state: RootState) {
  const {
    prompt,
    analysis,
    modelRecommendation,
    optimisation,
    response,
    source,
    history,
    savingActions,
    responseHistory,
  } = state.eco;
  await Promise.all([
    chrome.storage.session.set({
      [sessionKey]: {
        prompt,
        analysis,
        modelRecommendation,
        optimisation,
        response,
        source,
      },
    }),
    chrome.storage.local.set({ [historyKey]: { history, responseHistory, savingActions } }),
  ]);
}
