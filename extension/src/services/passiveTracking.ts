import { estimatePrompt, estimateTokens, recommendModels } from "../mockApi";
import { chatGPTDemoCatalog } from "./modelCatalog";
import { stableId } from "./contracts";

export const optimisationKey = "ecoOptimisationsV1";
export interface OptimisationRecord {
  id: string;
  at: number;
  kind: "assisted" | "independent" | "search";
  sourceAnalysisId?: string;
  initialModel?: string | null;
  submittedModel?: string | null;
  modelChanged?: boolean;
  rewriteApplied?: boolean;
  estimatedWaterMl: number;
  estimatedEnergyWh: number;
}
export interface OptimisationLedger {
  records: OptimisationRecord[];
  count: number;
  waterMl: number;
  energyWh: number;
  legacyOverlap: Record<string, { water: number; energy: number }>;
}

export function boundedOptimisations(value: unknown): OptimisationRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is OptimisationRecord => {
    if (!item || typeof item.id !== "string" || !["assisted", "independent", "search"].includes(item.kind) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => b.at - a.at).slice(0, 100);
}

/** Import only completed decisions from the earlier per-prompt score records. */
export function migrateOptimisations(assessments: unknown, searches: unknown): OptimisationRecord[] {
  const prior = Array.isArray(assessments) ? assessments : [];
  const searchEvents = Array.isArray(searches) ? searches : [];
  const records: OptimisationRecord[] = prior.flatMap((item) => {
    if (!item || (!item.assistedOptimisation && !item.independentModelChange) || typeof item.promptId !== "string") return [];
    return [{ id: item.promptId, at: item.timestamp ?? 0,
      kind: item.assistedOptimisation ? "assisted" : "independent",
      sourceAnalysisId: item.sourceAnalysisId,
      initialModel: item.initialModel, submittedModel: item.submittedModel,
      modelChanged: Boolean(item.independentModelChange || (item.initialModel && item.submittedModel && item.initialModel !== item.submittedModel)),
      rewriteApplied: Boolean(item.rewriteApplied),
      estimatedWaterMl: Math.max(0, item.estimatedWaterSavedMl ?? 0),
      estimatedEnergyWh: Math.max(0, item.estimatedEnergySavedWh ?? 0) } as OptimisationRecord];
  });
  for (const event of searchEvents) {
    if (typeof event?.id === "string") records.push({ id: event.id, at: event.timestamp ?? 0,
      kind: "search", estimatedWaterMl: 0, estimatedEnergyWh: 0 });
  }
  if (!searchEvents.length) for (const item of prior) {
    if (item?.searchAlternativeSelected && typeof item.promptId === "string") records.push({
      id: `search-${item.promptId}`, at: item.timestamp ?? 0, kind: "search",
      estimatedWaterMl: 0, estimatedEnergyWh: 0 });
  }
  return boundedOptimisations(records);
}
export function ledgerFromRecords(records: OptimisationRecord[], legacyIds: string[] = []): OptimisationLedger {
  const legacy = new Set(legacyIds);
  const overlap: OptimisationLedger["legacyOverlap"] = {};
  for (const item of records) if (item.sourceAnalysisId && legacy.has(item.sourceAnalysisId)) {
    const prior = overlap[item.sourceAnalysisId] ?? { water: 0, energy: 0 };
    prior.water += item.estimatedWaterMl;
    prior.energy += item.estimatedEnergyWh;
    overlap[item.sourceAnalysisId] = prior;
  }
  return { records: boundedOptimisations(records), count: records.length,
    waterMl: records.reduce((sum, item) => sum + item.estimatedWaterMl, 0),
    energyWh: records.reduce((sum, item) => sum + item.estimatedEnergyWh, 0), legacyOverlap: overlap };
}
export function normaliseLedger(value: unknown, legacyIds: string[] = []): OptimisationLedger {
  if (Array.isArray(value)) return ledgerFromRecords(boundedOptimisations(value), legacyIds);
  if (value && typeof value === "object" && Array.isArray((value as OptimisationLedger).records)) {
    const item = value as OptimisationLedger;
    return { records: boundedOptimisations(item.records), count: Math.max(0, item.count || 0),
      waterMl: Math.max(0, item.waterMl || 0), energyWh: Math.max(0, item.energyWh || 0),
      legacyOverlap: item.legacyOverlap ?? {} };
  }
  return ledgerFromRecords([], legacyIds);
}
export function appendOptimisation(ledger: OptimisationLedger, record: OptimisationRecord, legacyIds: string[] = []): OptimisationLedger {
  if (ledger.records.some((item) => item.id === record.id)) return ledger;
  const overlap = { ...ledger.legacyOverlap };
  if (record.sourceAnalysisId && legacyIds.includes(record.sourceAnalysisId)) {
    const prior = overlap[record.sourceAnalysisId] ?? { water: 0, energy: 0 };
    overlap[record.sourceAnalysisId] = { water: prior.water + record.estimatedWaterMl,
      energy: prior.energy + record.estimatedEnergyWh };
  }
  return { records: boundedOptimisations([record, ...ledger.records]), count: ledger.count + 1,
    waterMl: ledger.waterMl + record.estimatedWaterMl,
    energyWh: ledger.energyWh + record.estimatedEnergyWh, legacyOverlap: overlap };
}

interface Draft {
  originalText: string;
  initialModel: string | null;
  lastModel: string | null;
  manualModel: string | null;
  assistedModel: string | null;
  rewriteText: string | null;
}
let fallbackSequence = 0;
export class PassiveTracker {
  private draft: Draft | null = null;
  private lastSubmission: { signature: string; at: number } | null = null;
  constructor(private readonly readModel: () => string | null,
    private readonly record: (optimisation: OptimisationRecord) => void,
    private readonly now: () => number = Date.now,
    private readonly usage?: (text: string, model: string | null, at: number) => void) {}

  observe(text: string) {
    const clean = text.trim();
    if (!clean) { this.draft = null; return; }
    const model = this.readModel();
    if (!this.draft) {
      this.draft = { originalText: clean, initialModel: model, lastModel: model,
        manualModel: null, assistedModel: null, rewriteText: null };
    } else this.draft.lastModel = model;
  }
  noteManualModelChange() {
    if (!this.draft) return;
    const model = this.readModel();
    if (model && this.draft.initialModel && model !== this.draft.initialModel && model !== this.draft.assistedModel)
      this.draft.manualModel = model;
    this.draft.lastModel = model;
  }
  markModelSelected(model: string) {
    if (!this.draft) return;
    this.draft.assistedModel = model;
    if (this.draft.manualModel === model) this.draft.manualModel = null;
    this.draft.lastModel = model;
  }
  markRewrite(text: string, original?: string) {
    if (this.draft && text.trim() !== (original ?? this.draft.originalText)) {
      this.draft.originalText = original ?? this.draft.originalText;
      this.draft.rewriteText = text.trim();
    }
  }

  submit(text: string, route: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    const at = this.now();
    const signature = `${route}:${clean}`;
    if (this.lastSubmission?.signature === signature && at - this.lastSubmission.at < 2500) return false;
    this.lastSubmission = { signature, at };
    if (!this.draft) this.observe(clean);
    const draft = this.draft!;
    this.draft = null;
    const finalModel = this.readModel();
    try { this.usage?.(clean, finalModel, at); } catch { /* Usage must not interrupt optimisation tracking. */ }
    const rewriteUsed = draft.rewriteText === clean && estimateTokens(clean) < estimateTokens(draft.originalText);
    const changedModel = Boolean(draft.initialModel && finalModel && draft.initialModel !== finalModel);
    const manualModel = changedModel && draft.manualModel === finalModel && draft.assistedModel !== finalModel;
    const assistedModel = changedModel && draft.assistedModel === finalModel;
    if (!rewriteUsed && !manualModel && !assistedModel) return true;

    let water = 0;
    let energy = 0;
    let modelImproved = false;
    try {
      const ids = chatGPTDemoCatalog.models.map((item) => item.id);
      const originalModels = recommendModels(draft.originalText, ids).models;
      const before = draft.initialModel && originalModels.find((item) => item.id === draft.initialModel);
      const lighterOnSameTask = finalModel && originalModels.find((item) => item.id === finalModel);
      const after = finalModel && recommendModels(clean, ids).models.find((item) => item.id === finalModel);
      const sameTask = estimatePrompt(draft.originalText).complexity === estimatePrompt(clean).complexity;
      modelImproved = Boolean(changedModel && before && lighterOnSameTask && after &&
        lighterOnSameTask.suitability >= 90 && lighterOnSameTask.waterMl <= before.waterMl * 0.9 && sameTask);
      if (before && after && sameTask && (!changedModel || modelImproved)) {
        water = Math.max(0, Number((before.waterMl - after.waterMl).toFixed(2)));
        energy = Math.max(0, Number((before.energyWh - after.energyWh).toFixed(3)));
      }
    } catch { /* Record a completed rewrite without an unverifiable impact estimate. */ }
    if (!rewriteUsed && !modelImproved) return true;
    const kind = rewriteUsed || assistedModel ? "assisted" : "independent";
    this.record({ id: globalThis.crypto?.randomUUID?.() ?? `${at}-${++fallbackSequence}`,
      at, kind, sourceAnalysisId: stableId("prompt", draft.originalText),
      initialModel: draft.initialModel, submittedModel: finalModel,
      modelChanged: modelImproved, rewriteApplied: rewriteUsed,
      estimatedWaterMl: water, estimatedEnergyWh: energy });
    return true;
  }
}
