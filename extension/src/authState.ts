// chrome.storage.local key that holds the extension's own Supabase session (see supabase.ts).
// Kept in its own module so the content script can watch it without bundling supabase-js.
export const AUTH_STORAGE_KEY = 'ecoSupabaseAuth';

// Calls back with whether a session is stored now, then again whenever that changes.
// Only checks that the session exists; it never uses the tokens.
export function watchSignedIn(callback: (signedIn: boolean) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return () => {};
  chrome.storage.local.get(AUTH_STORAGE_KEY, data => callback(Boolean(data[AUTH_STORAGE_KEY])));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && AUTH_STORAGE_KEY in changes) callback(Boolean(changes[AUTH_STORAGE_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
