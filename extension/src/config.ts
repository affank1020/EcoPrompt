// Values are baked in at build time from the VITE_* env vars (see .env.example).
const trimSlash = (url: string) => url.replace(/\/$/, '');

export const BACKEND_URL = trimSlash(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000');

// The website, used for sign up, onboarding and the dashboard.
export const SITE_URL = trimSlash(import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000');

function required(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy extension/.env.example to extension/.env.local, fill it in, and rebuild.`);
  }
  return value;
}

// Same Supabase project as the website (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
export const SUPABASE_URL = trimSlash(required('VITE_SUPABASE_URL'));
export const SUPABASE_PUBLISHABLE_KEY = required('VITE_SUPABASE_PUBLISHABLE_KEY');
