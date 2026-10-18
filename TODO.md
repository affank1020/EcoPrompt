# HydroPrompt to-do

Tick items off as they're done. See `webapp/ibmhack/docs/auth-handoff.md` for the auth and database background.

**Rules**
- Prompt text is never stored, in Supabase or anywhere else. Only `prompt_chars` and the estimate numbers.
- There is no friends feature. The leaderboard is global.
- Comparing prompts across models is a bonus feature, not in scope for now.

**Several agents work on this list at once. Before starting a task:**
1. Check it isn't already marked `🔒 IN PROGRESS`. If it is, leave it and its files alone.
2. Mark it: append ` — 🔒 IN PROGRESS (<who>, <date>)` to the line.
3. When it's done, tick the box and remove the marker.

## Done
- [x] Google OAuth (Google Cloud + Supabase)
- [x] Supabase auth on the website (email/password + Google, `proxy.ts`, `/auth/callback`)

## 1. Backend hosting and shared config
- [ ] Backend hosted (friend), public URL shared
- [x] CORS middleware in `backend/api.py` (`ALLOWED_ORIGINS` env var + `chrome-extension://` regex)
- [x] Backend URL as an env var in the website (`ESTIMATION_API_URL` / `COMPRESSION_API_URL` → one `BACKEND_API_URL`)
- [x] Backend URL as an env var in the extension (Vite `VITE_BACKEND_URL`, `src/config.ts`)
- [x] Website and extension both use the same Supabase project URL and publishable key
- [ ] Backend `/analyse` returns `input_tokens` and `output_tokens` (`calculate_consumption` must return the output count). Not needed yet; do it before saving estimates to Supabase

## 2. Database (write each change as a migration file in the repo)
All of this is in `supabase/migrations/20261018000001_baseline.sql` (applied 2026-10-18). The tables made earlier in the Table Editor were dropped and recreated.
- [x] Complete the `estimates` row: add `energy_wh`/`energy_low_wh`/`energy_high_wh`, `complexity` (easy/medium/hard), `compressed`, `tokens_saved`; make `model` nullable; `created_at` not in the future
- [x] Global `weekly_leaderboard()` security definer function: aggregates only, users with `show_on_leaderboard`
- [x] Optional: drop the unused `friendships` table and its policies
- [x] Commit the existing hand-applied schema (profiles, estimates, trigger, RLS) as a baseline migration

## 3. Website
- [x] Pick a username: test end to end (new Google sign-up → `/welcome` → dashboard; changing the username)
- [x] `lib/data/estimates.ts`: replace the mocks with Supabase queries
- [x] `lib/data/leaderboard.ts`: call `weekly_leaderboard()`
- [x] Delete `lib/data/mock.ts`
- [ ] Single-prompt check calls the backend `/analyse` instead of the local estimator (`/analyse` takes no model)
- [ ] Bulk check uses the teammate's separate bulk endpoint (being built; wait for it)
- [ ] Save web estimates to Supabase (`source = 'web'` / `'bulk'`), with all fields filled in
- [ ] Prompt compression section calling `/compress`
- [x] Show energy next to water: dashboard, history, leaderboard (bulk waits for its endpoint; compare is a bonus)
- [ ] (Tomorrow, another teammate) Bring `lib/estimation/methodology.ts` (and the methodology page) in line with the backend formula in `backend/api.py`. They currently disagree: about 5.5 vs 0.95 mL per Wh, and a fixed 400-token reply vs a reply length based on the prompt
- [x] Nav: check every link (marketing anchors `#compare` `#extension` `#faq` `#methodology` `#why-water`, `AppNav`, CTAs)
- [x] Give `#extension` a real target (install link or instructions) (install instructions for now; swap in the Chrome Web Store link once it's published)

## 4. Extension
- [ ] Replace `src/mockApi.ts` with calls to the backend `/analyse`
- [ ] Compress button in the widget calling `/compress`
- [x] Guest mode: estimates saved in `chrome.storage.local` (lengths and numbers only; stop storing prompt text in `ecoLatest`) (saved once per sent prompt in `ecoGuestEstimates`, capped at 500)
- [x] Guest mode: notice saying "Log in to see your history on the website"
- [x] Log in: the extension has its own Supabase session (not shared with the website), stored in `chrome.storage.local`
  - [x] Google via `chrome.identity.launchWebAuthFlow`, run in the background service worker (the popup closes mid-flow)
  - [x] Email/password form in the popup
  - [x] Sign up links to the website's `/signup`
  - [x] "Pick a username →" link to the website when `username_set` is false
  - [x] Popup: Log in button top right (guest) / user menu with Open dashboard + Sign out (signed in)
  - [x] Widget status line: "Saved on this device · log in from the extension icon" / "Saving…" / "Saved to your history ✓" (only after the insert succeeds) / "Will sync when you're back online"
- [x] On first log in, upload the stored guest estimates to Supabase, then clear them locally (give each estimate a client-generated `id` so retries can't save duplicates; keep the original `created_at`) (`src/uploader.ts`: on sign-in, guest estimates move into the upload queue and the guest store is cleared in the same write; popup shows "Uploading N saved prompts…")
- [x] Logged-in users: send estimates to Supabase (`source = 'extension'`, lengths and numbers only) (content script → background worker via `chrome.runtime.sendMessage`; upsert on `id` with `ignoreDuplicates`)
- [x] Offline queue: retry failed uploads (`ecoUploadQueue` in `chrome.storage.local`, tagged by user id; retried on worker startup, sign-in and a 5-minute `chrome.alarms` alarm; batches of 100)
- [ ] `manifest.json` `host_permissions` for the backend and Supabase URLs
- [ ] Other LLM sites: content script matches and prompt-box selectors for each site
  - [x] ChatGPT
  - [ ] Claude
  - [ ] Gemini
  - [ ] Copilot
  - [ ] Perplexity
- [ ] Show energy next to water in the widget and popup

## 5. Branding and styling
- [ ] Decide the app name (the extension says "EcoPrompt", the website says "HydroPrompt") — later
- [ ] Same title and logo in the manifest, popup, widget, website header and favicon
- [ ] Shared design tokens (colours, fonts, radii) used by the extension CSS and the website SCSS

## Bonus (only if there's time)
- [x] Disable the compare-across-models feature behind a flag (hide it everywhere, keep the code for later)
- [ ] Compare a prompt's efficiency across models (`/compare` page, `compareModels` action). The backend `/analyse` has no model input yet.
  - Switched off via FEATURES.compareModels in lib/features.ts

## Later
- [ ] Email verification with custom SMTP and an `/auth/confirm` route (`verifyOtp`)
- [ ] Before launch: publish the Google consent screen; add the production domain to the Supabase redirect URLs
