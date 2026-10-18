/** Metadata only. Optimisation savings remain in their existing ledger. */
export interface UsageEstimate {
  id: string; createdAt: number; site: string; promptChars: number; tokens: number;
  complexity: 'easy' | 'medium' | 'hard'; waterMl: number; energyWh: number;
  model: string | null; methodology: 'ecoprompt-illustrative-v1';
}
export interface UsageRecord extends UsageEstimate { userId: string | null; uploaded?: boolean; rejected?: boolean; error?: string }
export const USAGE_KEY = 'ecoUsageV1';
export const MAX_USAGE = 2000;
export function validateUsage(value: unknown): UsageEstimate {
  const v = value as UsageEstimate;
  if (!v || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id) ||
    !Number.isFinite(v.createdAt) || v.createdAt < 0 || v.createdAt > Date.now() + 300000 ||
    !['chatgpt.com', 'chat.openai.com'].includes(v.site) ||
    !['easy', 'medium', 'hard'].includes(v.complexity) ||
    v.methodology !== 'ecoprompt-illustrative-v1' ||
    ![v.promptChars, v.tokens].every(n => Number.isInteger(n) && n >= 0 && n <= 10000000) ||
    ![v.waterMl, v.energyWh].every(n => Number.isFinite(n) && n >= 0) ||
    !(v.model === null || typeof v.model === 'string' && v.model.length < 100)) throw new Error('Invalid usage metadata');
  // Explicit allowlist: never persist extra message fields (including prompt text).
  return { id: v.id, createdAt: v.createdAt, site: v.site, promptChars: v.promptChars,
    tokens: v.tokens, complexity: v.complexity, waterMl: v.waterMl, energyWh: v.energyWh,
    model: v.model, methodology: v.methodology };
}
export function addUsage(records: UsageRecord[], value: UsageEstimate, userId: string | null): UsageRecord[] {
  if (records.some(r => r.id === value.id)) return records;
  const next = [...records];
  if (next.length >= MAX_USAGE) {
    const index = next.findIndex(r => r.uploaded);
    if (index < 0) throw new Error('Local usage storage is full. Sign in and retry sync to free space. New usage cannot be saved.');
    next.splice(index, 1);
  }
  return [...next, { ...validateUsage(value), userId }];
}
export function claimGuests(records: UsageRecord[], userId: string): UsageRecord[] {
  return records.map(r => r.userId === null ? { ...r, userId } : r);
}
export function usageRow(r: UsageRecord) {
  return { id: r.id, user_id: r.userId, created_at: new Date(r.createdAt).toISOString(),
    site: r.site, model: r.model, source: 'extension', prompt_chars: r.promptChars,
    tokens: r.tokens, complexity: r.complexity, water_ml: r.waterMl,
    low_ml: r.waterMl * 0.5, high_ml: r.waterMl * 2.5, energy_wh: r.energyWh,
    energy_low_wh: r.energyWh * 0.5, energy_high_wh: r.energyWh * 2.5,
    compressed: false, tokens_saved: null, methodology: r.methodology };
}
