# Selective PR #8 website port

Based on main at bd5911a (includes PRs #7 and #9). Reviewed PR #8, especially 3b49383d421116c245f2d6c0f2f5fedf375480c8; no wholesale merge or rebase.

## Included

- Authenticated single and bulk checks save metadata through the existing Supabase schema and RLS. Ownership comes from server-verified auth.getUser(), never client arguments. No prompt text is stored. Anonymous users do not persist records.
- Explicit backend-token-v1 and website-mock-v1 methods; backend input tokens remain exact, backend model is null, and energy comes directly from the adapter. Required backend bounds equal the central value and are not presented as uncertainty. Website records remain outside extension dashboard/leaderboard aggregates. Compression previews are not usage or recorded savings.
- One /analyse/bulk request for up to 200 prompts, preserving order and duplicates, followed by one atomic metadata insert. Count, order and individual result contracts validate before persistence. Save failure preserves the analysis and shows a warning; no automatic replay or retry is introduced.
- Light, balanced and aggressive compression presets; backend token counts, latency, verification details and explicit fallback explanations. Rewrites remain reviewable even without estimated water reduction. Existing styling is retained.
- Local mocks remain available when BACKEND_API_URL is absent and are clearly labelled. Configured backend failures remain errors, never silent mock substitution. Local compressor token metadata is unavailable rather than fabricated; its presets do not change its algorithm.

## Deliberately excluded

- Proposed /api/analyse and /api/compress routes: the website already uses server actions and server-only adapters, and no consumer requires these extra routes. Neither unrestricted relay was added. Existing public checker actions retain their input validation and caps; production inference capacity/rate controls remain a deployment responsibility.
- API-key header: the checked-in FastAPI backend does not validate one, and deployed validation was not demonstrated. No ineffective header or new secret/environment configuration was added.
- PR #8 adapter replacement, water-derived token counts, fabricated backend intervals, removal of development mocks, stale styling/data changes and duplicate PR #9 work.
- All Chrome extension changes, database migrations (including the destructive baseline), generated .next files, and backend inference changes. Existing environment configuration is unchanged.

## Validation

- Website build, lint and TypeScript checks pass.
- 18 website tests pass: auth ownership, metadata payloads, persistence errors, explicit methodologies, batch limits/order/duplicates and one 200-item backend request, invalid backend contracts, compression presets/fallbacks, local mocks and rendered explanations.
- 9 existing backend tests pass with mocked model inference.
- Disposable PostgreSQL database: existing weekly_leaderboard.sql fixture followed by website_history.sql passes. Covers unchanged schema compatibility, owner-only insertion/reading and website-method exclusion from leaderboard.
- Local production UI: guest prompt check and aggressive compression show explicit mock/sign-in messaging. POST /api/analyse and /api/compress both return 404.
- Live signed-in Supabase, deployed backend/header validation and actual trained-model inference remain unverified. No production database changes or deployment performed.

Run SQL tests only in a fresh disposable database, never an existing or production database. The existing leaderboard fixture prepares schema and roles before the new history test.
