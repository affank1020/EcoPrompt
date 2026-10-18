// Estimates kept on this device. Lengths and numbers only: the prompt text is never stored.
export type EstimateComplexity = 'easy' | 'medium' | 'hard';

export interface StoredEstimate {
  // Made with crypto.randomUUID() when the estimate is created; also the Supabase row id,
  // so uploading the same estimate twice can't create two rows.
  id: string;
  createdAt: number;
  site: string;
  promptChars: number;
  tokens: number;
  complexity: EstimateComplexity | null;
  waterMl: number;
  energyWh: number;
}

export const GUEST_STORE_KEY = 'ecoGuestEstimates';
const MAX_ENTRIES = 500;

export async function readGuestEstimates(): Promise<StoredEstimate[]> {
  const data = await chrome.storage.local.get(GUEST_STORE_KEY);
  if (!Array.isArray(data[GUEST_STORE_KEY])) return [];
  // Older builds saved entries without an id or complexity.
  return (data[GUEST_STORE_KEY] as Array<Partial<StoredEstimate>>).map(entry => ({
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    complexity: entry.complexity ?? null,
  }) as StoredEstimate);
}

// Only the background worker calls this, so writes to the store never race.
export async function addGuestEstimate(entry: StoredEstimate): Promise<void> {
  const entries = await readGuestEstimates();
  entries.push(entry);
  // Keep only the newest entries.
  await chrome.storage.local.set({ [GUEST_STORE_KEY]: entries.slice(-MAX_ENTRIES) });
}

export function summarise(entries: StoredEstimate[]) {
  return {
    count: entries.length,
    waterMl: entries.reduce((total, entry) => total + entry.waterMl, 0),
  };
}
