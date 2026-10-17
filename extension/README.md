# EcoPrompt — IBM LinuxONE Datathon extension

A compact in-page Chrome extension panel for estimated AI impact and prompt optimisation. Built with React, TypeScript and Redux Toolkit. All extension source and build output stay inside `extension/`.

## Build and install

```sh
cd extension
npm install
npm run build
npm test
```

Load `extension/dist` as an unpacked extension in `chrome://extensions`. Reload the extension and refresh ChatGPT after rebuilding. `npm run dev` serves `/popup.html` for visual preview. In development, `/popup.html?previewPrompt=Hello%20world` previews the Assistant without Chrome APIs.

## Workflow

- **Overview** opens as a rounded panel inside the current page when the toolbar icon is clicked. It keeps the illustrated water tank with two metrics: estimated water saved and completed optimisations. There is no bottle target or progress counter. A shortcut appears when ChatGPT has an active draft.
- **Assistant** opens in the same panel from the small button near the ChatGPT composer. That button is hidden until the draft has text. The Assistant automatically estimates impact, then shows benefit-led action cards for a lighter model, direct search when relevant, and a mock prompt rewrite preview. The rewrite card remains visible even when the mock cannot improve a concise draft. A useful rewrite can be copied or used to replace the unchanged ChatGPT draft; EcoPrompt never submits it. The suggestions screen no longer includes response analysis or an estimates disclosure.
- The launcher reconciles after composer replacement and SPA navigation. A background worker asks the page panel to open, injecting it on demand if needed. Restricted pages or failed injections open the same React interface in an extension tab. Reply estimate badges remain available.

## Data and estimates

`chrome.storage.local` stores up to 100 distinct prompt records and 100 response records. Prompt records include the original prompt, impact analysis, optional rewrite and whether replacement was confirmed. Response records contain estimates and token metadata, not response text. `chrome.storage.session` holds the current draft, cached results and source tab across panel closures. Earlier local history is imported on first use. Chrome's extension settings can clear stored data.

The mock estimates tokens as `ceil(characters / 4)` and uses arbitrary coefficients of 20 mL and 1.4 Wh per 1,000 tokens, scaled by illustrative model factors. Water and energy are **modelled estimates**, not measured ChatGPT consumption. GPT-6 High is the explicit Assistant demo comparison reference, not a detected current model. The example model list is not account-aware; actual availability depends on the ChatGPT plan and workspace. Passive tracking uses only local calculations for observed model changes and submitted rewrites. The conventional-search option opens a search query, records only that an alternative was selected, and credits no saving.

`ecoOptimisationsV1` stores a bounded list of the 100 most recent completed decisions plus compact lifetime count and estimated savings totals, without raw prompt text. A submission produces at most one record and one combined illustrative saving against the original draft and model. Ordinary submissions produce no record. Existing `ecoHistoryV4` records and earlier estimated savings are retained; the new total avoids counting a legacy action again when a matching submitted optimisation exists. Earlier `ecoAssessmentsV1` and `ecoSearchSelectionsV1` records migrate to completed decisions only. The active Assistant still stores its raw draft and cached prompt analysis in extension storage as described above.

Search-opening events are stored as decisions even if no AI prompt is later submitted. These events contain no prompt text and never add savings.

Passive model detection reads the visible ChatGPT model control without opening it. A manual change counts only when a model-selection interaction is observed, the final model is confirmed, and the local suitability comparison supports a lower-resource choice. Submission detection listens to form submission, Enter and known send controls, with a short duplicate window. ChatGPT can change these controls; an installed-extension smoke test remains necessary after interface changes. A browser action that does not reach a detectable submission path may be missed, and an intercepted Enter or send click may be recorded as a submission. Missing or ambiguous model data cannot produce a model saving.

The staged endpoint proposal and typed schemas are in [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md). `src/services/analysisService.ts` is the replaceable service boundary; `src/mockApi.ts` contains deterministic demo calculations.

## Architecture and verification

- `src/components/Overview.tsx`, `src/components/Assistant.tsx`, `src/components/SavingsTank.tsx`: two-view interface and water visualisation.
- `src/store.ts`, `src/services/persistence.ts`, `src/services/modelCatalog.ts`: Redux UI state, request lifecycles, demo model catalog, cached analyses and durable metrics.
- `src/content.tsx`, `src/integration.ts`, `src/replyBadges.ts`: ChatGPT launcher, editor safeguards and visible-reply estimates.
- `src/panel.tsx`, `vite.panel.config.ts`: on-demand rounded React panel inside the page, isolated in a shadow root.
- `public/background.js`: toolbar and composer routing, on-demand script injection and extension-tab fallback.
- `tests/regression.test.mjs`: staged calls, deduplication, persistence, messaging, editor and SPA launcher tests.

`npm test` runs the TypeScript and production builds before the regression suite. ChatGPT's DOM may change, so the integration still needs an installed-extension smoke test in the target Chrome session. Browser preview cannot exercise toolbar-action injection. Concurrent extension pages use last-write-wins storage updates.

## Demo estimation and persistence

Opening Assistant analyses the current ChatGPT draft and records the distinct draft in `chrome.storage.local` (`ecoHistoryV4`). The mock uses characters/4 as an input-token proxy, predicts output tokens, and applies illustrative mL/Wh per 1,000 tokens. The water tank shows estimates for attributable submitted changes, plus preserved earlier local estimates. It plays a short water animation when its saved total rises. Word count is recorded too. Identical Assistant drafts are deduplicated.

Model recommendations use a heuristic prompt classification and illustrative per-mode factors, not real model fitness or provider energy data. The prompt-shortening opportunity is estimated during impact analysis; the separate optimisation call produces a template cleanup when the action page opens. Identical prompts produce identical mock answers for repeatable demos. To test ChatGPT's single-page new-chat navigation, reload the unpacked extension, refresh ChatGPT once, then create several chats without refreshing the page. The composer shortcut should appear only while the current draft has text. `npm test` in `extension/` builds and runs the regression checks.
