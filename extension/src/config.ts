const trim = (value: string) => value.replace(/\/$/, "");
export const SITE_URL = trim(import.meta.env.VITE_SITE_URL || "http://localhost:3000");
export const BACKEND_URL = trim(import.meta.env.VITE_BACKEND_URL || "http://localhost:8000");
export const SUPABASE_URL = trim(import.meta.env.VITE_SUPABASE_URL || "");
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const ACCOUNT_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
