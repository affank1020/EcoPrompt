# Account and usage sync integration

This branch selectively adapts Ghiles' account/storage design onto main at ee2a066. It does not merge the old branch. The existing JavaScript background worker is imported unchanged into one bundled MV3 worker. The current Redux state, local history migrations, optimisation ledger, water tank, composer detection, navigation, rewrite, model switching and search interactions remain in place.

## Implemented

- Compact header account menu shared by popup and in-page panel; Google PKCE through Chrome Identity, email/password, website signup/dashboard/onboarding links, profile name and local signout.
- One worker owns the independent Supabase session, refresh-on-use and serialized queue writes. No website cookies or refresh tokens are shared.
- PassiveTracker emits a usage callback after its existing duplicate guard, even for ordinary submissions. Usage never increments savings. Its existing optimisation calculation is unchanged.
- Persisted UUID-based, metadata-only records; original timestamps, input plus predicted output tokens, water mL, energy Wh, nullable observed model, complexity and a versioned methodology. The observed model is context; the current calculation still uses the mock reference model.
- Durable account ownership before upload, idempotent inserts, five-minute/startup retries, explicit retry, and retained rejected rows. Permanent constraint errors are skipped until manual retry so they cannot block later records. An expired session retains the queue's owner. Sign out/sign in again to recover an invalid session.
- Bounded local storage (2,000 usage rows). Only uploaded rows are pruned. If all rows are pending, collection reports a visible storage-full error instead of deleting unsynced history. Sync to free space. Existing savings/history storage is untouched.
- Website history reads authenticated Supabase records with explicit user filtering plus RLS. Dashboard totals/charts include only `ecoprompt-illustrative-v1`; history labels other methods separately. Existing leaderboard and other website UI are not ported.

## Configuration and database

1. Copy `.env.example` to `.env.local`. Supply the same Supabase URL and **publishable** key as the website, and the website origin in `VITE_SITE_URL`. Never use a service-role key. Vite embeds public configuration in the extension. `VITE_BACKEND_URL` is available for future adapters; the existing mock analysis service remains active.
2. Review and apply `supabase/migrations/20261018000002_extension_account_sync.sql` in a staging database, then your project. It creates missing tables, adds methodology and username onboarding fields, policies and the signup trigger without dropping tables or deleting rows. It assumes pre-existing tables match Ghiles' baseline columns; incompatible custom schemas require reconciliation first. This migration has **not** been executed against a live database.
3. Do **not** run Ghiles' `20261018000001_baseline.sql` on an existing project: it drops tables. Only the non-destructive adaptation is included here. Review existing RLS policies as well; this migration replaces the named baseline policies, not unrelated custom policies.
4. Enable Google in Supabase Auth and configure its provider credentials there. In the extension worker console, evaluate `chrome.identity.getRedirectURL()`, then add that exact URL to Supabase's redirect allowlist. Configure Google's provider callback to the Supabase project callback. Each unpacked extension ID needs its matching redirect. Chrome 116+ is required.
5. Build with `npm run build`; load `extension/dist` unpacked in Chrome. The build adds only the configured Supabase origin to manifest host permissions. Rebuild/reload after changing env configuration. With no configuration, guest mode and local tracking still work and the account menu explains that login is unavailable.
6. Configure/deploy the website against the same project. The small data-reader change here replaces mock dashboard/history data; no merge of Ghiles' website branch is required. The website authenticates separately.

## Methodology and privacy

The mock estimator is illustrative, not measured consumption: characters-to-token approximation, predicted output, demo reference coefficients and a versioned identifier. The 0.5x–2.5x range matches the prior upload contract and is illustrative, not a statistical confidence interval. `compressed=false` and `tokens_saved=null` avoid treating confirmed local optimisations as cloud usage savings. Cloud optimisation syncing needs a separate event schema; the existing local ledger remains authoritative.

The new store/upload has an explicit field allowlist and never contains raw prompt/response text. Existing local/session draft and analysis storage still contains text where the current extension needs it; this integration does not expand that storage. Existing analysis history cannot reliably be reconstructed as submitted usage, so it is not backfilled or reinterpreted. Old experimental Ghiles keys, if present, are left untouched rather than assigned an unverified methodology or owner.

## Verification and manual checks

Automated: extension `npm run typecheck`, `npm run build` (also run by `npm test`), and all 50 tests pass. New tests cover metadata validation, duplicate UUIDs, timestamps/units, account ownership, bounded storage, restart/offline recovery, permanent rejection recovery and usage events independent of savings. Existing regression coverage includes navigation/new chat, rewrites, model changes, migrations, cumulative savings, theme and background panel fallback.

Website: `npx next typegen && npx tsc --noEmit` passes. `npm run build -- --webpack` also passes. The sandboxed default Turbopack build stalled during compilation and was stopped; the production webpack build completed outside the sandbox. Light/dark account-menu layout was inspected in a browser preview; it scrolls within the unchanged compact Overview dimensions. Preview is not a live extension/auth test.

Still required with configured Chrome/Supabase:

- Submit as guest, restart Chrome, and verify `ecoUsageV1` remains. Ordinary submissions must not change water saved.
- Sign in using email, then Google in a separate run. Check exact redirect, cancellation, username onboarding and profile name. Close the panel during Google login and reopen afterward.
- Check rows in `estimates` and website history: UUID, original timestamp, owner, null unknown model, units and methodology; no text fields. Verify RLS prevents cross-user reads/inserts.
- Disable network, submit, restart the service worker, reconnect and wait up to five minutes or use Retry sync. Repeated retries must leave one row per UUID.
- Sign out with a pending queue; sign into a second account. The first account's records must remain owned by it and upload only after signing back into that account.
- Reject a row with a temporary staging constraint: verify visible failure and retained local row; repair the schema and Retry sync. Test session expiry/revocation and reauthentication.
- Test popup and closed-shadow in-page panel, both themes, existing new-chat navigation, rewriting, model switching, savings totals, and account menu keyboard/scroll controls.

## Files and deliberately omitted old implementation

New: `src/accountBackground.ts`, `src/authState.ts`, `src/background.ts`, `src/config.ts`, `src/supabase.ts`, `src/usageStore.ts`, `src/components/Account.tsx`, `vite.background.config.ts`, `.env.example`, `tests/accountSync.test.mjs`, this report, and the SQL migration.

Modified: package/lock/build configuration and manifest, `content.tsx`, `services/passiveTracking.ts`, `widget.tsx`/CSS, regression tests and root ignore rules. Website changes are limited to its estimate reader/types, history methodology label and dashboard explanation.

Not reused: the older popup/panel, submission detector, background replacement, permanent login banner/status footer, hard failure when env vars are absent, deletion of rejected uploads, destructive baseline migration, unrelated website redesign/backend changes. No live database, OAuth-provider or deployment configuration was changed.
