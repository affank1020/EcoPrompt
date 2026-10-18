# HydroPrompt: Supabase auth handoff (as of 2026-10-18)

## Project
- Repo: ~/UbuntuRepos/ibmhack26, branch `Ghiles` (main branch: `main`).
- Web app: `webapp/ibmhack`, Next.js 16.4 with `cacheComponents: true` and `partialPrefetching: true`. Read `webapp/ibmhack/AGENTS.md` and `node_modules/next/dist/docs/` before writing code. `proxy.ts` replaces middleware. Read `searchParams`/`cookies()` inside `<Suspense>`.
- Chrome extension: repo root (Vite + React TSX, `src/main.tsx`). It's still a starter popup with no Supabase code yet.
- The app tracks the estimated water use of AI prompts: dashboard, history, compare, bulk check and leaderboard pages. The data layer in `lib/data/*` still uses mocks marked `TODO(supabase)`.

## Decisions
- Supabase Auth: email/password plus Google OAuth. Google is the main sign-in.
- **Prompt text is never stored.** Only `prompt_chars` and the estimate numbers. The extension must only send lengths and numbers.
- Email verification is **off** for the hackathon. The code handles both settings: `signup` checks whether `data.session` exists.
- Challenges stay hardcoded and computed from estimates. Tables for them are a later feature.

## Database (applied by hand in the Supabase SQL editor; no migration files in the repo)
- `profiles`: id uuid PK → auth.users (cascade), username text unique not null, display_name, avatar_url, show_on_leaderboard bool default true, created_at.
- `estimates`: id uuid, user_id uuid default auth.uid() → auth.users (cascade), created_at, site, model, source ('extension'|'web'|'bulk'), prompt_chars int, tokens int, water_ml/low_ml/high_ml real. Index on (user_id, created_at desc).
- `friendships`: requester_id, addressee_id → auth.users (cascade), status ('pending'|'accepted'), created_at, accepted_at. PK (requester, addressee), check not self, unique index on least/greatest of the pair.
- Trigger `handle_new_user`: creates a profile from raw_user_meta_data (username, display_name or full_name, avatar_url). Username falls back to `user_<8 chars of id>`.
- RLS on all tables: profiles readable by signed-in users and editable by the owner; estimates select/insert/delete own; friendships visible to both people, insert as requester (pending), addressee can accept, either can delete.
- To delete an account, delete from `auth.users` and the cascade removes the rest. Optional `delete_my_account()` security definer RPC for self-service deletion.

## Code written
- `lib/supabase/server.ts`: createServerClient with cookies. **Calls `await connection()` after `cookies()`.** This fixes the "Date.now() while prerendering" error caused by Cache Components.
- `lib/supabase/client.ts`: browser client, used only by the Google button.
- `proxy.ts`: refreshes the session via `getClaims()` and redirects PROTECTED routes (/dashboard, /bulk, /compare, /leaderboard) to `/login?next=`. Its matcher covers all routes except static assets.
- `lib/auth/index.ts`: `getCurrentUser()` (Supabase user + profile → `User` type, falling back to ANONYMOUS_USER) and `safeNext()`.
- `app/(auth)/`: `actions.ts` (login, signup, signout), `login/page.tsx`, `signup/page.tsx`, `layout.tsx`, `auth.module.scss`.
- `app/auth/callback/route.ts`: exchangeCodeForSession. Moved out of the `(auth)` group so it's served at `/auth/callback`.
- `components/auth/GoogleButton.tsx`: signInWithOAuth, redirecting to `/auth/callback`.
- Sign-out button in `app/(app)/layout.tsx` UserBadge.
- Env vars (`.env.local`): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SITE_URL.
- `npm run build` passes.

## In progress elsewhere (another agent)
- "Pick a username" onboarding: `app/(auth)/welcome/`, a `username_set` column plus migration, a redirect from the callback route, and `/welcome` added to proxy PROTECTED. Don't edit `app/auth/callback/route.ts`, `proxy.ts` or `welcome/` until it's merged.

## Still to do
1. Replace the mocks in `lib/data/estimates.ts` and `lib/data/leaderboard.ts` with Supabase queries. RLS already scopes them to the current user.
2. A `weekly_leaderboard(friends_only)` security definer function that returns aggregates only, for users with show_on_leaderboard.
3. A `friends` view or function covering both directions, plus a friends UI (search by username, send/accept/remove).
4. Extension: Supabase sign-in, session in chrome.storage.local, a content script on chat sites, sending estimates (lengths and numbers only) via insert or POST `/api/estimates` with a Bearer token, an offline queue, and manifest permissions.
5. Dashboard setup (user does this): Google Cloud OAuth client (redirect URI = Supabase `/auth/v1/callback`), Supabase Redirect URLs including `/auth/callback`, publish the Google consent screen before launch.
6. Later, if launching for real: email verification with custom SMTP and an `/auth/confirm` route using `verifyOtp` with token_hash.
