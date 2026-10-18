import type { StoredEstimate } from './guestStore';

// Shared by the background worker, the content script and the popup. No supabase-js here,
// so the content script can import it without bundling the client.

// Estimates waiting to be inserted into Supabase. Only the background worker writes it.
export const UPLOAD_QUEUE_KEY = 'ecoUploadQueue';
// What the popup shows about uploads, written by the background worker.
export const SYNC_STATUS_KEY = 'ecoSyncStatus';

// Each item is tagged with the user it belongs to, and is only ever uploaded under that user.
export interface QueuedEstimate extends StoredEstimate {
  userId: string;
  fromGuest?: boolean;
}

export interface SyncStatus {
  // The last upload attempt failed (offline, or the session could not be refreshed).
  failed: boolean;
  // Guest estimates still waiting to be uploaded for the signed-in user.
  guestUploading: number;
}

// Content script → background worker: save one new estimate.
export const SAVE_ESTIMATE = 'ecoprompt/save-estimate';
export type SaveEstimateMessage = { type: typeof SAVE_ESTIMATE; estimate: StoredEstimate };
// guest: saved on this device. saved: the row is in Supabase. queued: still waiting after a failed upload.
export type SaveResult = 'guest' | 'saved' | 'queued';

// Calls back with the key's current value, then again whenever it changes.
export function watchStorageKey<T>(key: string, callback: (value: T | undefined) => void): () => void {
  chrome.storage.local.get(key, data => callback(data[key] as T | undefined));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && key in changes) callback(changes[key].newValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
