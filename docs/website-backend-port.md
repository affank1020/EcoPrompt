# Selective PR #6 port after PR #7

Based on main at 164be10. The extension directory and migration 20261018000002 are unchanged.

## Included and adapted

- Real global rolling-seven-day leaderboard; ten prompts required to rank; opted-in profiles only, including for the current user. Empty results have an explicit message. Deterministic ranking by average water, then user ID.
- Database-side history count, filtering, ordering and bounded pagination. Tie-breaking by ID; authenticated user predicates retained. Filter options fetch only site/model columns. Dashboard statistics are retained; challenges now use the user's real illustrative records instead of mock users.
- Stored energy in dashboard, selectable usage chart, sortable history and leaderboard. Wh/kWh and mL/L formatting; missing energy remains unavailable. No energy is derived from water.
- PR #6's Why Water, Extension and FAQ sections using existing Sass tokens. Corrected privacy/measurement claims. Preserved next destinations through login/signup switching, OAuth, email confirmation, failures and protected-route query strings. Website logout is local to that browser.
- Comparison implementation remains intact but hidden with `FEATURES.compareModels = false`: FastAPI does not support model-specific estimates.
- Exact-origin configurable CORS and validated `/analyse/bulk`, sharing single-prompt analysis. No classifier, compression algorithm or inference coefficient changes.
- Server adapters use `BACKEND_API_URL`. Analysis sends `{prompt, epsilon}` to `/analyse`, maps `water_cost` (mL), `energy_cost` (Wh), and the added input-token count. Compression sends `{prompt, preset: "balanced"}` to `/compress`; its existing `compressed` response is retained. Compression's website limit now matches its 20,000-character backend limit.

## Intentionally excluded

The destructive PR #6 baseline was neither copied nor executed. Its old extension implementation, wholesale data-layer replacement, unrestricted Chrome-extension CORS regex, mock leaderboard and broken undefined bulk model were not brought over. PR #7 already supplies authentication, account menus, guest storage, durable uploads/retries, metadata-only Supabase usage records, methodology tagging and the modern extension UI/optimisation ledger.

## Migration and data boundaries

`supabase/migrations/20261018000003_weekly_leaderboard.sql` requires PR #7's schema, especially `methodology`, energy columns and profile visibility. It adds `weekly_leaderboard_v1()` and grants execution only to authenticated users. The versioned name avoids ambiguity with PR #6's optional-timestamp overload on databases where it was already deployed. If that old overload exists, its PUBLIC/anon/authenticated execution privileges are revoked; its definition and all tables remain intact.

The SQL function deliberately uses SECURITY DEFINER to aggregate across user-isolated rows, with an empty search path, fully qualified relations, a required authenticated UID, fixed time window, and no caller-controlled filters. It exposes only per-user aggregate counts/water/energy and profile identity for opted-in users, never individual estimates. Existing RLS, auth triggers and rows are not replaced. Apply as the schema/table owner; review remote schema differences and any additional roles/grants first. Ordinary direct estimate queries remain user-scoped and protected by RLS. The threshold controls ranking, not whether an opted-in aggregate is displayed.

Only `ecoprompt-illustrative-v1` contributes to dashboard, chart, challenges and leaderboard. History shows all methods with labels. These are estimates of submitted usage, not measurements and not optimisation savings. Backend `backend-token-v1` and website `website-mock-v1` results are distinct, are not included in extension aggregates. The subsequent [website history port](website-history-compression.md) adds authenticated checker persistence for these distinct methods. Backend analysis supplies no uncertainty bounds; UI and CSV do not present a fabricated interval. Mock energy is calculated from the mock's existing energy coefficients, independently of water.

**Not applied to live Supabase.** Tested only in a disposable local PostgreSQL database. Review and explicitly approve production application separately. Back up before deploying; do not run the SQL test fixture on an existing database.

## Deployment

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SITE_URL`; configure Supabase OAuth/email redirect allowlists for `/auth/callback`. Deploy the additive migration before the website. Missing Supabase environment values cause the existing authentication proxy to reject requests, including public routes.

Replace old ESTIMATION_API_URL / COMPRESSION_API_URL settings with server-only `BACKEND_API_URL` pointing to FastAPI. Leaving it unset enables labelled local mocks. A configured service failure surfaces an error rather than silently falling back. FastAPI must have its ML dependencies and trained artifacts available for its existing startup warm-up. CORS does not provide API authentication/rate limiting: the public inference service still needs deployment-level capacity controls.

Set `APP_ENV=production` and exact comma-separated `ALLOWED_ORIGINS` (deployed HTTPS website and `chrome-extension://<actual-id>` as needed). Production defaults to no browser origins. Development defaults to localhost/127.0.0.1:3000. Wildcards are rejected; arbitrary extension IDs are not trusted. Environment examples are templates, not automatic dotenv loading.

Bulk requests contain 1–200 nonblank strings of at most 50,000 characters each, with finite epsilon in [0,1]. All inputs validate before inference; results preserve order and duplicates. Invalid requests return 422; inference failures fail the entire request with 500, without partial results. `/analyse` retains its response fields and adds `tokens`; `/compress` retains its response contract.

## Validation

- Website: `npx tsc --noEmit`, `npm run lint`, `npm run build`; production route generation succeeds. The sandboxed Turbopack attempt stalled; rerunning with build permissions succeeded.
- Website contracts: `node --test tests/*.test.mjs` (6 tests): backend mappings, mocks/errors, compression payload, redirect safety, user-scoped pagination, leaderboard threshold/empty results.
- Backend: install `backend/requirements-test.txt` into an isolated venv; `python -m unittest discover -s backend -p 'test_*.py' -v` (9 tests). Real FastAPI/Pydantic HTTP validation, mocked classifier/compressor/tokenization; existing joint-classifier tests included. Actual trained-model inference remains unverified.
- Extension: `npm test` (50 tests plus all four builds). `git diff origin/main -- extension` is empty.
- Database: `psql -v ON_ERROR_STOP=1 -f supabase/tests/weekly_leaderboard.sql` in a new disposable database. Covers repeated migration application, global aggregation under RLS, private row isolation, opt-out, old/future/incompatible records, missing identity, denied anonymous/legacy RPC privileges, and an existing default-argument legacy function.
- Local production HTTP smoke checks with fake local Supabase settings: landing/login/signup return 200; all four new/existing section anchors resolve; dashboard/history/leaderboard/compare redirect unauthenticated visitors to login. History query parameters survive the redirect. These checks did not contact live Supabase.
- Live Supabase, signed-in UI, Google OAuth and email confirmation are not verified. No deployment performed.

Remaining limits: dashboard/facet totals still page through user records (history rows themselves now use database pagination). Very large accounts may eventually need dedicated aggregate/facet RPCs. As before, client-submitted estimates are illustrative and not independently verified measurements or a tamper-proof competition.
