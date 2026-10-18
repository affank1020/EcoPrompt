import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { SITE_URL } from './config';
import { GOOGLE_SIGN_IN, supabase, type GoogleSignInResult } from './supabase';
import { watchSignedIn } from './authState';
import { GUEST_STORE_KEY, readGuestEstimates, summarise } from './guestStore';
import { SYNC_STATUS_KEY, watchStorageKey, type SyncStatus } from './syncState';
import './style.css';

type Profile = { username: string; display_name: string | null; username_set: boolean };

const fmtMl = (value: number) => value < 10 ? value.toFixed(2) : value.toFixed(1);

async function fetchProfile(userId: string): Promise<Profile | null> {
  // select('*') so this still works before the username_set migration is applied.
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) console.warn('EcoPrompt: could not load profile:', error.message);
  else if (!data) console.warn('EcoPrompt: no profile row for this user');
  if (!data) return null;
  // Without username_set, don't nag about the username.
  return { username: data.username, display_name: data.display_name ?? null, username_set: data.username_set ?? true };
}

function App() {
  // undefined while the stored session is loading.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<'main' | 'login'>('main');
  const userId = session?.user.id;

  useEffect(() => {
    const load = () => void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    load();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    // Google sign-in finishes in the background worker, which this client doesn't hear about.
    const unwatch = watchSignedIn(load);
    return () => { data.subscription.unsubscribe(); unwatch(); };
  }, []);

  useEffect(() => {
    setProfile(null);
    if (userId) void fetchProfile(userId).then(setProfile);
  }, [userId]);

  useEffect(() => {
    // Older builds stored the full prompt here. Prompt text is never stored, so drop it.
    void chrome.storage.local.remove('ecoLatest');
  }, []);

  const signedIn = Boolean(session);
  useEffect(() => { if (signedIn) setView('main'); }, [signedIn]);
  const name = profile?.display_name || profile?.username || session?.user.email || 'Account';

  return <main className="popup">
    <header>
      <div className="brand"><span className="brand-mark">✳</span><strong>ecoprompt<span>.</span></strong></div>
      {session === undefined ? null
        : signedIn ? <UserMenu name={name} />
        : view === 'main' && <button type="button" className="chip-button" onClick={() => setView('login')}>Log in</button>}
    </header>
    {view === 'login' && !signedIn
      ? <LoginView onBack={() => setView('main')} />
      : <>
        {!signedIn && <section className="hero"><div className="eyebrow">SMALLER FOOTPRINT, SMARTER PROMPTS</div><h1>Make every<br/>prompt count<span>.</span></h1><p>Understand the potential impact of AI, pick a suitable model, and write leaner requests — right inside ChatGPT.</p><a className="action" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT <span>↗</span></a></section>}
        {session === undefined ? null : signedIn ? <SignedInSummary profile={profile} name={name} /> : <GuestSummary onLogIn={() => setView('login')} />}
      </>}
    <footer><span className="status"><span className="dot"/> ChatGPT integration ready</span><span>Prompt text never stored</span></footer><p className="disclaimer">Impact factors, suitability scores and savings are illustrative placeholders, not measurements of ChatGPT resource use.</p>
  </main>;
}

function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return <div className="user-menu" ref={ref}>
    <button type="button" className="chip-button" aria-expanded={open} onClick={() => setOpen(!open)}><span className="user-name">{name}</span> ▾</button>
    {open && <div className="menu-panel" role="menu">
      <a role="menuitem" href={`${SITE_URL}/dashboard`} target="_blank" rel="noreferrer">Open dashboard ↗</a>
      {/* Local scope: only end the extension's session, not the website's. */}
      <button role="menuitem" type="button" onClick={() => { setOpen(false); void supabase.auth.signOut({ scope: 'local' }); }}>Sign out</button>
    </div>}
  </div>;
}

function GuestSummary({ onLogIn }: { onLogIn: () => void }) {
  const [totals, setTotals] = useState({ count: 0, waterMl: 0 });

  useEffect(() => {
    const load = () => void readGuestEstimates().then(entries => setTotals(summarise(entries)));
    load();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && GUEST_STORE_KEY in changes) load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return <>
    <section className="summary"><div className="section-heading">ON THIS DEVICE <span>MOCK DATA</span></div>
      <div className="stats two"><div><strong>{totals.count}</strong><span>Prompts</span></div><div><strong>{fmtMl(totals.waterMl)} mL</strong><span>Total water</span></div></div>
    </section>
    <section className="card">
      <p>Log in to save your history and see it on your dashboard.</p>
      <div className="button-row">
        <button type="button" className="action" onClick={onLogIn}>Log in</button>
        <a className="secondary-action" href={`${SITE_URL}/signup`} target="_blank" rel="noreferrer">Sign up ↗</a>
      </div>
    </section>
  </>;
}

function SignedInSummary({ profile, name }: { profile: Profile | null; name: string }) {
  // Written by the background worker while it uploads the guest estimates after sign-in.
  const [sync, setSync] = useState<SyncStatus | undefined>(undefined);
  useEffect(() => watchStorageKey<SyncStatus>(SYNC_STATUS_KEY, setSync), []);
  const guestUploading = sync?.guestUploading ?? 0;

  return <>
  <section className="welcome"><div className="eyebrow">SIGNED IN</div><h1>Welcome back<span>,</span></h1><p className="welcome-name">{name}</p><a className="action" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT <span>↗</span></a></section>
  <section className="summary"><div className="section-heading">YOUR HISTORY</div>
    {profile && !profile.username_set && <a className="notice-link" href={`${SITE_URL}/welcome`} target="_blank" rel="noreferrer">Pick a username →</a>}
    {guestUploading > 0 && <p role="status">{sync?.failed
      ? `${guestUploading} saved prompts will upload when you're back online`
      : `Uploading ${guestUploading} saved prompts…`}</p>}
    <div className="blank">Your synced totals will appear here soon. For now, see your history on the dashboard.</div>
    <a className="action" href={`${SITE_URL}/dashboard`} target="_blank" rel="noreferrer">Open dashboard <span>↗</span></a>
  </section>
  </>;
}

function LoginView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');

  async function google() {
    setBusy('google');
    setError('');
    try {
      // The popup usually closes when the Google window opens; the background worker finishes the flow.
      const result = await chrome.runtime.sendMessage<{ type: string }, GoogleSignInResult>({ type: GOOGLE_SIGN_IN });
      if (!result.ok) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy('email');
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(null);
    if (signInError) setError(signInError.message);
    // On success the auth listener in App switches back to the main view.
  }

  return <section className="login">
    <button type="button" className="back" onClick={onBack} aria-label="Back">←</button>
    <h2>Log in<span>.</span></h2>
    <p className="login-intro">Save your history and see it on your dashboard.</p>
    <button type="button" className="action google" onClick={google} disabled={busy !== null}>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</button>
    <div className="divider"><span>or</span></div>
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="action" disabled={busy !== null}>{busy === 'email' ? 'Logging in…' : 'Log in'}</button>
    </form>
    <p className="signup">No account? <a href={`${SITE_URL}/signup`} target="_blank" rel="noreferrer">Sign up on the website ↗</a></p>
  </section>;
}

createRoot(document.getElementById('root')!).render(<App />);
