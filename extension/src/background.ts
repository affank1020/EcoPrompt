import { GOOGLE_SIGN_IN, supabase, type GoogleSignInResult } from './supabase';
import { AUTH_STORAGE_KEY } from './authState';
import { SAVE_ESTIMATE, type SaveEstimateMessage } from './syncState';
import { flushQueue, saveEstimate, uploadGuestEstimates } from './uploader';

// Google sign-in runs here because the popup closes as soon as the auth window opens.
async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return { ok: false, error: error?.message ?? 'Could not start Google sign-in' };

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  } catch (err) {
    // Also thrown when the user closes the window.
    return { ok: false, error: err instanceof Error ? err.message : 'Google sign-in was cancelled' };
  }
  if (!redirect) return { ok: false, error: 'Google sign-in was cancelled' };

  const params = new URL(redirect).searchParams;
  const code = params.get('code');
  if (!code) return { ok: false, error: params.get('error_description') ?? 'Google sign-in did not return a code' };

  const exchange = await supabase.auth.exchangeCodeForSession(code);
  return exchange.error ? { ok: false, error: exchange.error.message } : { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === GOOGLE_SIGN_IN) {
    void signInWithGoogle().then(sendResponse);
    return true; // Respond asynchronously.
  }
  if (message?.type === SAVE_ESTIMATE) {
    void saveEstimate((message as SaveEstimateMessage).estimate).then(sendResponse, err => {
      console.warn('EcoPrompt: could not save an estimate:', err instanceof Error ? err.message : err);
      sendResponse(null);
    });
    return true;
  }
  return false;
});

// A session appearing in storage is a sign-in, whether it finished here (Google) or in the
// popup (email/password, which this worker's client doesn't hear about). Token refreshes
// replace an existing session, so they don't count.
chrome.storage.onChanged.addListener((changes, area) => {
  const change = changes[AUTH_STORAGE_KEY];
  if (area === 'local' && change && !change.oldValue && change.newValue) void uploadGuestEstimates();
});

// Retry queued uploads on startup and every few minutes.
const RETRY_ALARM = 'ecoprompt/retry-uploads';
// Only create it once: re-creating on every wake-up would keep pushing the first run back.
void chrome.alarms.get(RETRY_ALARM).then(alarm => {
  if (!alarm) void chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === RETRY_ALARM) void flushQueue();
});
void flushQueue();
