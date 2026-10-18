import { useEffect, useRef, useState } from 'react';
import { SITE_URL } from '../config';
interface AccountState { configured: boolean; signedIn: boolean; name: string; needsUsername: boolean; pending: number; error: string | null }
export function Account() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AccountState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  async function request(action: string, fields = {}) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const result = await chrome.runtime.sendMessage({ type: 'ECO_ACCOUNT', action, ...fields });
    if (result?.error) throw new Error(result.error);
    if (result?.value) setState(result.value);
  }
  async function act(action: string, fields = {}) {
    setBusy(true); setError('');
    try { await request(action, fields); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    void request('state').catch(() => {});
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (['ecoUsageV1', 'ecoSupabaseAuth', 'ecoUsageIssue'].some(key => key in changes)) void request('state').catch(() => {});
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const scope = root.current?.getRootNode() as Document | ShadowRoot;
    scope.addEventListener('mousedown', close as EventListener); scope.addEventListener('keydown', escape as EventListener);
    return () => { scope.removeEventListener('mousedown', close as EventListener); scope.removeEventListener('keydown', escape as EventListener); };
  }, [open]);
  return <div className="eco-account" ref={root}>
    <button className="account-toggle" aria-label="Account" aria-expanded={open} onClick={() => setOpen(!open)} title={state?.error ? 'Sync needs attention' : 'Account'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>
      {state?.error && <span className="account-attention" aria-label="Sync needs attention">!</span>}
    </button>
    {open && <section className="account-menu" aria-label="EcoPrompt account">
      {state?.signedIn ? <>
        <strong>{state.name}</strong>
        <a href={`${SITE_URL}/dashboard`} target="_blank" rel="noreferrer">Open Dashboard ↗</a>
        {state.needsUsername && <a href={`${SITE_URL}/welcome`} target="_blank" rel="noreferrer">Choose a username ↗</a>}
        {state.pending > 0 && <small>{state.pending} upload{state.pending === 1 ? '' : 's'} pending · retries every 5 minutes</small>}
        {(state.pending > 0 || state.error) && <button disabled={busy} onClick={() => void act('retry')}>Retry sync</button>}
        <button disabled={busy} onClick={() => void act('logout')}>Sign Out</button>
      </> : <>
        <strong>Save your usage history</strong>
        <small>Uploads contain estimates and metadata only. Local draft storage remains on this device.</small>
        {!state?.configured && <small>Account sync is not configured in this build.</small>}
        <button disabled={busy || !state?.configured} onClick={() => void act('google')}>Continue with Google</button>
        <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const values = new FormData(form); const fields = { email: String(values.get('email')), password: String(values.get('password')) }; form.reset(); void act('login', fields); }}>
          <input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="username" required />
          <input name="password" type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" required />
          <button disabled={busy || !state?.configured} type="submit">Sign in</button>
        </form>
        <a href={`${SITE_URL}/signup`} target="_blank" rel="noreferrer">Create an account ↗</a>
      </>}
      {busy && <small role="status">Working…</small>}
      {(error || state?.error) && <small role="alert">{error || state?.error}</small>}
    </section>}
  </div>;
}
