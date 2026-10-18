import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store, hydrate, setPrompt, setView, setOptimisationLedger } from "./store";
import { optimisationKey, normaliseLedger } from "./services/passiveTracking";
import { readSavedState, saveState } from "./services/persistence";
import { Widget } from "./widget";
import "./widget.css";
import "./style.css";
import type { ModelSwitchResult } from "./modelSwitch";

const isChatGPT = (url: string) =>
  /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url);
async function boot() {
  const available = typeof chrome !== "undefined" && !!chrome.storage;
  if (available) {
    const [{ history, responseHistory, savingActions, optimisationLedger, session }, { ecoLaunch }] =
      await Promise.all([
        readSavedState(),
        chrome.storage.session.get("ecoLaunch"),
      ]);
    store.dispatch(
      hydrate({ ...session, history, responseHistory, savingActions, optimisationLedger, view: "overview" }),
    );
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[optimisationKey]) store.dispatch(setOptimisationLedger(normaliseLedger(changes[optimisationKey].newValue)));
    });
    if (ecoLaunch && Date.now() - ecoLaunch.createdAt < 30000) {
      store.dispatch(
        hydrate({
          prompt: ecoLaunch.prompt,
          source: {
            tabId: ecoLaunch.tabId,
            url: ecoLaunch.url,
            draft: ecoLaunch.prompt,
            capturedAt: ecoLaunch.createdAt,
          },
          view: "assistant",
          analysis:
            session?.prompt === ecoLaunch.prompt ? session.analysis : null,
        }),
      );
      await chrome.storage.session.remove("ecoLaunch");
    } else {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id && isChatGPT(tab.url ?? "")) {
        try {
          const draft = (await chrome.tabs.sendMessage(tab.id, {
            type: "ECO_GET_DRAFT",
          })) as { prompt: string; url: string };
          const sameDraft =
            session?.source?.draft === draft.prompt &&
            session?.source?.url === draft.url;
          store.dispatch(
            hydrate({
              prompt: sameDraft ? session.prompt : draft.prompt,
              source: { tabId: tab.id, url: draft.url, draft: draft.prompt, capturedAt: Date.now() },
              analysis: sameDraft ? session.analysis : null,
            }),
          );
        } catch {
          store.dispatch(hydrate({ source: null }));
        }
      } else {
        store.dispatch(hydrate({ source: null, prompt: "", analysis: null }));
      }
    }
    let queue = Promise.resolve();
    store.subscribe(() => {
      queue = queue.then(() => saveState(store.getState())).catch(() => {});
    });
  }
  if (!available && import.meta.env.DEV) {
    const previewPrompt = new URLSearchParams(location.search).get("previewPrompt");
    if (previewPrompt) { store.dispatch(setPrompt(previewPrompt)); store.dispatch(setView("assistant")); }
  }
  createRoot(document.getElementById("root")!).render(
    <Provider store={store}>
      <Widget
        onSearchSelected={async () => {
          const source = store.getState().eco.source;
          if (source) await chrome.tabs.sendMessage(source.tabId, { type: "ECO_SEARCH_SELECTED", url: source.url });
        }}
        onThemeChange={(theme) => { document.documentElement.dataset.ecoTheme = theme; }}
        onCheckModel={async (modelId): Promise<ModelSwitchResult> => {
          const source = store.getState().eco.source;
          if (!available || !source) return { state: "error", message: "Open this prompt in ChatGPT to check its model." };
          try {
            return await chrome.tabs.sendMessage(source.tabId, { type: "ECO_GET_MODEL_STATE", modelId, url: source.url }) as ModelSwitchResult;
          } catch {
            return { state: "error", message: "Could not reach the ChatGPT model picker." };
          }
        }}
        onSwitchModel={async (modelId): Promise<ModelSwitchResult> => {
          const source = store.getState().eco.source;
          if (!available || !source) return { state: "error", message: "Open this prompt in ChatGPT to change its model." };
          try {
            return await chrome.tabs.sendMessage(source.tabId, { type: "ECO_SWITCH_MODEL", modelId, url: source.url }) as ModelSwitchResult;
          } catch {
            return { state: "error", message: "Could not reach the ChatGPT model picker." };
          }
        }}
        onApply={async (text) => {
          const source = store.getState().eco.source;
          if (!available || !source) return false;
          try {
            const result = await chrome.tabs.sendMessage(source.tabId, {
              type: "ECO_APPLY_REWRITE",
              text,
              expected: source.draft,
              url: source.url,
            });
            return result?.applied === true;
          } catch {
            return false;
          }
        }}
      />
    </Provider>,
  );
}
void boot().catch(() => {
  createRoot(document.getElementById("root")!).render(
    <Provider store={store}>
      <Widget />
    </Provider>,
  );
});
