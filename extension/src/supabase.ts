import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import { AUTH_STORAGE_KEY } from './authState';

// The extension keeps its own session in chrome.storage.local, shared by the popup and the
// background worker. It is never handed to or taken from the website: sharing one refresh
// token would trip Supabase's reuse detection and sign the user out of both.
const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const data = await chrome.storage.local.get(key);
    return typeof data[key] === 'string' ? data[key] as string : null;
  },
  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key) {
    await chrome.storage.local.remove(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: chromeStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Messages between the popup and the background worker.
export const GOOGLE_SIGN_IN = 'ecoprompt/google-sign-in';
export type GoogleSignInResult = { ok: true } | { ok: false; error: string };
