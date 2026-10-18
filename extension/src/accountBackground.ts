import { supabase } from './supabase';
import { ACCOUNT_CONFIGURED } from './config';
import { AUTH_STORAGE_KEY } from './authState';
import { addUsage, claimGuests, usageRow, USAGE_KEY, type UsageRecord } from './usageStore';

// One worker owns both authentication and queue mutations. Sessions never enter UI messages.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task, task);
  chain = result.catch(() => {});
  return result;
}
async function records(): Promise<UsageRecord[]> {
  return (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY] ?? [];
}
async function owner(): Promise<string | null> {
  const stored = await chrome.storage.local.get([AUTH_STORAGE_KEY, 'ecoUsageOwner']);
  const raw = stored[AUTH_STORAGE_KEY];
  if (stored.ecoUsageOwner) return stored.ecoUsageOwner;
  try { return JSON.parse(raw)?.user?.id ?? null; } catch { return null; }
}
async function save(rows: UsageRecord[]) { await chrome.storage.local.set({ [USAGE_KEY]: rows }); }
async function flush() {
  if (!ACCOUNT_CONFIGURED) return;
  const previousOwner = await owner();
  if (previousOwner) await chrome.storage.local.set({ ecoUsageOwner: previousOwner });
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return;
  const userId = data.session.user.id;
  let rows = claimGuests(await records(), userId);
  await save(rows); // Durable ownership before the first network request.
  for (const row of rows.filter(r => r.userId === userId && !r.uploaded && !r.rejected).slice(0, 100)) {
    const { error } = await supabase.from('estimates').upsert(usageRow(row), { onConflict: 'id', ignoreDuplicates: true });
    rows = rows.map(r => r.id === row.id ? { ...r, uploaded: !error, rejected: Boolean(error && /^2[23]/.test(error.code ?? '')), error: error ? `Sync failed (${error.code || 'network'}). Retry after checking connection, login and schema.` : undefined } : r);
    await save(rows); // Crash after insert is safe: retry uses the same UUID.
    if (error && !/^2[23]/.test(error.code ?? '')) break;
  }
}
async function state() {
  const userId = await owner();
  const raw = (await chrome.storage.local.get(AUTH_STORAGE_KEY))[AUTH_STORAGE_KEY];
  let user;
  try { user = JSON.parse(raw)?.user; } catch { /* no session */ }
  let profile;
  if (userId && ACCOUNT_CONFIGURED) {
    const result = await supabase.from('profiles').select('display_name,username,username_set').eq('id', userId).maybeSingle();
    profile = result.data;
  }
  const pending = (await records()).filter(r => !r.uploaded && r.userId === userId);
  const issue = (await chrome.storage.local.get('ecoUsageIssue')).ecoUsageIssue;
  return { configured: ACCOUNT_CONFIGURED, signedIn: Boolean(userId),
    name: profile?.display_name || profile?.username || user?.user_metadata?.full_name || user?.email || 'Account',
    needsUsername: Boolean(userId && !profile?.username_set), pending: pending.length,
    error: issue || (userId && !user ? 'Session expired. Sign out and sign in again to resume syncing.' : null) || pending.find(r => r.error)?.error || null };
}
async function account(message: { action: string; email?: string; password?: string }) {
  if (message.action === 'state') return state();
  if (!ACCOUNT_CONFIGURED) throw new Error('Account sync is not configured in this build. Guest mode remains available.');
  if (message.action === 'google') {
    const redirectTo = chrome.identity.getRedirectURL();
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) throw error || new Error('Could not start Google login');
    const redirect = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    if (!redirect || !redirect.startsWith(redirectTo)) throw new Error('Google login cancelled or invalid redirect');
    const params = new URL(redirect).searchParams;
    const code = params.get('code');
    if (!code) throw new Error(params.get('error_description') || 'Google did not return an authorization code');
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (result.error) throw result.error;
  } else if (message.action === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email: message.email || '', password: message.password || '' });
    if (error) throw error;
  } else if (message.action === 'logout') {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    // Offline signout must still remove this device's credentials.
    if (error) await chrome.storage.local.remove(AUTH_STORAGE_KEY);
    await chrome.storage.local.remove('ecoUsageOwner');
    return state();
  } else if (message.action !== 'retry') throw new Error('Unknown account action');
  if (message.action === 'google' || message.action === 'login') {
    const { data } = await supabase.auth.getSession();
    if (data.session) await chrome.storage.local.set({ ecoUsageOwner: data.session.user.id });
  }
  if (message.action === 'retry') {
    const userId = await owner();
    await save((await records()).map(r => r.userId === userId ? { ...r, rejected: false } : r));
  }
  await flush();
  return state();
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL(''));
  const panelPage = /^https?:\/\//.test(sender.tab?.url || '');
  const chatPage = /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(sender.tab?.url || '');
  if (message?.type === 'ECO_ACCOUNT' && (extensionPage || panelPage)) {
    void locked(() => account(message)).then(value => respond({ value }), e => respond({ error: e.message }));
    return true;
  }
  if (message?.type === 'ECO_USAGE' && chatPage) {
    void locked(async () => {
      try {
        await save(addUsage(await records(), message.estimate, await owner()));
        await chrome.storage.local.remove('ecoUsageIssue');
      } catch (e) {
        await chrome.storage.local.set({ ecoUsageIssue: (e as Error).message });
        throw e;
      }
      return true;
    }).then(() => { respond({ saved: true }); void locked(flush).catch(() => {}); }, e => respond({ error: e.message }));
    return true;
  }
});
const alarm = 'ecoprompt/retry-uploads';
void chrome.alarms.get(alarm).then(value => { if (!value) void chrome.alarms.create(alarm, { periodInMinutes: 5 }); });
chrome.alarms.onAlarm.addListener(value => { if (value.name === alarm) void locked(flush).catch(() => {}); });
void locked(flush).catch(() => {});
