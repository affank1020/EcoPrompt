# EcoPrompt — IBM Hackathon 2026

An experimental React + TypeScript Chrome extension for ChatGPT that previews **mock** water/energy impact, offers model-fit suggestions and lets you apply a leaner draft prompt. Built for the IBM hackathon; **no backend required yet**.

## Getting started

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the project's `dist` directory. Open https://chatgpt.com/ and start typing. A small EcoPrompt pill will appear next to the composer; click it for analysis. The extension toolbar popup shows the last analysed prompt.

After each rebuild, reload the extension on `chrome://extensions` and refresh ChatGPT.

## Architecture

- `src/content.tsx`: content script; detects ChatGPT composer, mounts an isolated Shadow DOM React widget and updates drafts.
- `src/widget.tsx` and `src/widget.css`: integrated analysis panel.
- `src/store.ts`: Redux Toolkit state and async analysis with stale-response guards.
- `src/mockApi.ts`: simulated ~420ms backend with heuristic task classification, model profiles, rewrite, token and footprint calculations.
- `src/main.tsx` and `src/style.css`: extension popup.
- `vite.config.ts` and `vite.content.config.ts`: two Vite builds, popup and standalone classic MV3 content script.

## Demo limitations

**All impact coefficients, model suitability percentages and savings are illustrative, not measurements or scientific claims.** Input tokens use a rough 4-characters-per-token heuristic. Output tokens are predicted, not observed. Water and energy use cannot be inferred reliably from prompt tokens alone. Replace the mock service with the actual backend and sourced impact methodology later.

The demo does not call external services or automatically send messages. ChatGPT may change its composer DOM; the integration uses multiple selectors and a best-effort text replacement, so test carefully before presenting. Use only mock/safe prompts until privacy and consent flows are ready.

## Backend integration later

Keep `Analysis` and `analyzePrompt(prompt)` as the adapter boundary. Replace the simulated response with `fetch` to your API, then add explicit opt-in before transmitting potentially sensitive prompt content.
