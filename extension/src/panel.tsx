import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { Widget } from "./widget";
import { store, hydrate, setPrompt, setOptimisationLedger } from "./store";
import { optimisationKey, normaliseLedger } from "./services/passiveTracking";
import { readSavedState, saveState } from "./services/persistence";
import { applyRewrite, readComposer } from "./integration";
import { checkChatGPTModel, switchChatGPTModel } from "./modelSwitch";
import widgetCss from "./widget.css?inline";

const HOST_ID = "ecoprompt-page-panel";
const isChatGPT = () =>
  /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(location.href);

if (!document.getElementById(HOST_ID)) {
  let host: HTMLDivElement | null = null;
  let visible = false;
  const ready = readSavedState()
    .then(({ history, responseHistory, savingActions, optimisationLedger, session }) => {
      store.dispatch(hydrate({ ...session, history, responseHistory, savingActions, optimisationLedger }));
    })
    .catch(() => {})
    .then(() => {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[optimisationKey]) store.dispatch(setOptimisationLedger(normaliseLedger(changes[optimisationKey].newValue)));
      });
      let queue = Promise.resolve();
      store.subscribe(() => {
        queue = queue.then(() => saveState(store.getState())).catch(() => {});
      });
    });

  function close() {
    visible = false;
    if (host) host.style.display = "none";
  }

  function mount() {
    if (host) {
      if (!host.isConnected) document.body.append(host);
      return;
    }
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-label", "EcoPrompt");
    host.style.cssText =
      "all:initial;position:fixed;top:16px;right:16px;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 32px);z-index:2147483001;display:none;overflow:hidden;border:1px solid #cfe3ed;border-radius:22px;background:#f3f7f9;box-shadow:0 18px 55px #153c5540;";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `:host{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#20475e;color-scheme:light}*{box-sizing:border-box}button,textarea{font:inherit}button{cursor:pointer}button:focus-visible,summary:focus-visible{outline:3px solid #75c9dd;outline-offset:2px}${widgetCss}.eco-app{max-height:min(520px,calc(100vh - 32px));border-radius:0}`;
    const container = document.createElement("div");
    shadow.append(style, container);
    document.body.append(host);
    createRoot(container).render(
      <Provider store={store}>
        <Widget
          onSearchSelected={async () => {
            const source = store.getState().eco.source;
            if (source?.url === location.href) await chrome.runtime.sendMessage({ type: "ECO_MARK_ASSISTED", kind: "search", url: source.url });
          }}
          onClose={close}
          onThemeChange={(theme) => {
            if (!host) return;
            host.style.background = theme === "dark" ? "#101e29" : "#f3f7f9";
            host.style.borderColor = theme === "dark" ? "#324b59" : "#cfe3ed";
          }}
          onCheckModel={async (modelId) => {
            const source = store.getState().eco.source;
            return source?.url === location.href
              ? checkChatGPTModel(modelId, source.url)
              : { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
          }}
          onSwitchModel={async (modelId) => {
            const source = store.getState().eco.source;
            if (source?.url !== location.href) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
            const result = await switchChatGPTModel(modelId, source.url);
            if (result.state === "selected") await chrome.runtime.sendMessage({ type: "ECO_MARK_ASSISTED", kind: "model", modelId, url: source.url }).catch(() => {});
            return result;
          }}
          onApply={async (text) => {
            const source = store.getState().eco.source;
            const applied = Boolean(source && source.url === location.href && applyRewrite(text, source.draft));
            if (applied) await chrome.runtime.sendMessage({ type: "ECO_MARK_ASSISTED", kind: "rewrite", text, expected: source!.draft, url: source!.url }).catch(() => {});
            return applied;
          }}
        />
      </Provider>,
    );
  }

  chrome.runtime.onMessage.addListener(
    (
      message: { type?: string; view?: string; tabId?: number; toggle?: boolean },
      _sender,
      respond,
    ) => {
      if (message?.type !== "ECO_PANEL_OPEN") return;
      void ready.then(() => {
        if (message.toggle && visible) {
          close();
          respond({ opened: "panel", visible: false });
          return;
        }
        const source = isChatGPT() && typeof message.tabId === "number"
          ? {
              tabId: message.tabId,
              url: location.href,
              draft: readComposer(),
              capturedAt: Date.now(),
            }
          : null;
        store.dispatch(setPrompt(source?.draft ?? ""));
        const eco = store.getState().eco;
        store.dispatch(
          hydrate({
            source,
            view: source && message.view === "assistant" ? "assistant" : "overview",
            analysis: eco.analysis,
            modelRecommendation: eco.modelRecommendation,
            optimisation: eco.optimisation,
          }),
        );
        mount();
        host!.style.display = "block";
        visible = true;
        respond({ opened: "panel", visible: true });
      }).catch(() => respond({ opened: false }));
      return true;
    },
  );

  document.addEventListener("pointerdown", (event) => {
    if (visible && host && !event.composedPath().includes(host)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (visible && event.key === "Escape") close();
  });
  mount();
}
