import { estimatePrompt } from "./mockApi";
import { findComposer, readComposer, applyRewrite } from "./integration";
import { checkChatGPTModel, switchChatGPTModel, targetForModel, readChatGPTModelPassive } from "./modelSwitch";
import { PassiveTracker } from "./services/passiveTracking";
import {
  removeReplyBadges,
  readLatestAssistantReply,
} from "./replyBadges";
const HOST_ID = "ecoprompt-extension-mount";

// Keep the launcher independent of ChatGPT's internal toolbar layout.
// Position it using the active composer form's bounding box.
function boot() {
  removeReplyBadges();
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Remain above the page background, but below ChatGPT's menus and overlays.
  host.style.cssText = "all:initial;position:fixed;top:0;right:0;z-index:1;display:none;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>:host{color-scheme:light}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;border:1px solid #aadbef;border-radius:999px;padding:5px 11px;background:#eaf8ff;color:#0878ae;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;box-shadow:0 2px 8px #074c6814;cursor:pointer}button:hover:not(:disabled){background:#d6f0ff;border-color:#7ec6e6}button:disabled{opacity:.52;cursor:default}button:focus-visible{outline:2px solid #25a2dc;outline-offset:2px}svg{width:16px;height:16px;flex-shrink:0}:host([data-theme="dark"]){color-scheme:dark}:host([data-theme="dark"]) button{background:#193a4e;border-color:#376d85;color:#a5e5ff;box-shadow:0 2px 10px #07172366}:host([data-theme="dark"]) button:hover:not(:disabled){background:#254e66;border-color:#4b8ca9}</style>
<button type="button" title="Analyse water and energy estimates and improve your draft" aria-label="Analyse and improve this prompt with EcoPrompt">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
<path d="M20 3C9 3 4 8 4 15a5 5 0 0 0 5 5c8 0 11-8 11-17ZM4 21 16 9"/>
</svg><span class="label">Optimise</span></button>`;
  document.body.append(host);
  const button = shadow.querySelector("button")!;
  const tracker = new PassiveTracker(readChatGPTModelPassive, (optimisation) => {
    try { void chrome.runtime.sendMessage({ type: "ECO_RECORD_OPTIMISATION", optimisation }).catch(() => {}); }
    catch { /* Never let extension storage interrupt submission. */ }
  }, Date.now, (text, model, at) => {
    const estimate = estimatePrompt(text);
    const metadata = { id: crypto.randomUUID(), createdAt: at, site: location.hostname,
      promptChars: text.length, tokens: estimate.inputTokens + estimate.predictedOutputTokens,
      complexity: ({ Simple: "easy", Moderate: "medium", Advanced: "hard" } as const)[estimate.complexity],
      waterMl: estimate.baseline.waterMl, energyWh: estimate.baseline.energyWh,
      model, methodology: "ecoprompt-illustrative-v1" };
    void chrome.runtime.sendMessage({ type: "ECO_USAGE", estimate: metadata }).catch(() => {});
  });
  const recordSearch = () => {
    void chrome.runtime.sendMessage({ type: "ECO_RECORD_SEARCH", event: { id: crypto.randomUUID(), timestamp: Date.now() } }).catch(() => {});
  };
  tracker.observe(readComposer());
  const onDraftInput = (event: Event) => {
    const composer = findComposer();
    if (composer && (event.target === composer || composer.contains?.(event.target as Node)))
      tracker.observe(readComposer(composer));
  };
  const submit = () => {
    const text = readComposer();
    if (text.trim()) tracker.submit(text, location.pathname);
  };
  const onSubmit = (event: Event) => {
    const composer = findComposer();
    if (composer && event.target === composer.closest("form")) submit();
  };
  const onSubmitKey = (event: KeyboardEvent) => {
    const composer = findComposer();
    if (composer && (event.target === composer || composer.contains?.(event.target as Node)) &&
      event.key === "Enter" && !event.shiftKey && !event.isComposing) submit();
  };
  const onSubmitClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const send = target.closest('button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]');
    if (send && !send.hasAttribute("disabled")) submit();
  };
  document.addEventListener("input", onDraftInput, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("keydown", onSubmitKey, true);
  document.addEventListener("click", onSubmitClick, true);
  const onModelPickerClick = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button[aria-label="Select ChatGPT model"],button[data-testid="model-switcher-dropdown-button"],[role="menuitemradio"],[role="menuitem"][aria-label="Power"]'))
      setTimeout(() => tracker.noteManualModelChange(), 180);
  };
  document.addEventListener("click", onModelPickerClick, true);
  // Mirror the popup/panel theme through the existing shared storage key.
  // This keeps the launcher in sync even when the theme changes in another tab.
  let themeUpdated = false;
  const onThemeChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== "local") return;
    const theme = changes.ecoTheme?.newValue;
    if (theme === "light" || theme === "dark") {
      themeUpdated = true;
      host.dataset.theme = theme;
    }
  };
  chrome.storage.onChanged.addListener(onThemeChanged);
  void chrome.storage.local.get("ecoTheme").then(({ ecoTheme }) => {
    if (!themeUpdated && (ecoTheme === "light" || ecoTheme === "dark")) {
      host.dataset.theme = ecoTheme;
    }
  }).catch(() => {});

  button.addEventListener("click", async () => {
    const prompt = readComposer();
    if (!prompt.trim()) return;
    try {
      await chrome.runtime.sendMessage({
        type: "ECO_OPEN",
        prompt,
        url: location.href,
      });
    } catch {
      button.title = "Reload this ChatGPT page to reconnect EcoPrompt.";
    }
  });
  // Align to the full prompt box, not to the inner text field or + toolbar.
  // Keep the launcher outside ChatGPT's form so it cannot be clipped.
  let observedForm: Element | null = null;
  const formResizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => refresh())
    : null;

  function refresh() {
    if (!host.isConnected) document.body.append(host);
    const composer = findComposer();
    const form = composer?.closest("form") ??
      composer?.closest('[data-testid="composer"]') ??
      composer?.parentElement?.parentElement ??
      null;
    if (form !== observedForm) {
      formResizeObserver?.disconnect();
      observedForm = form;
      if (form) formResizeObserver?.observe(form);
    }
    if (!form) {
      host.style.display = "none";
      return;
    }
    const rect = form.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      host.style.display = "none";
      return;
    }
    const hasDraft = Boolean(composer && readComposer(composer).trim());
    button.disabled = !hasDraft;
    button.title = hasDraft
      ? "Analyse this prompt's impact and find ways to save water and energy"
      : "Type a prompt to use EcoPrompt";
    host.style.display = "block";
    const gap = 8;
    const top = Math.max(8, rect.top - host.offsetHeight - gap);
    const right = Math.min(
      Math.max(12, window.innerWidth - rect.right),
      Math.max(12, window.innerWidth - host.offsetWidth - 12),
    );
    host.style.top = Math.round(top) + "px";
    host.style.right = Math.round(right) + "px";
  }
  // Batch DOM and input updates into one pre-paint frame instead of delaying
  // them with a timeout. ResizeObserver directly aligns before paint.
  let refreshFrame: number | null = null;
  function schedule() {
    if (refreshFrame !== null) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = null;
      refresh();
    });
  }
  const observer = new MutationObserver((records) => {
    if (records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest("form, #prompt-textarea, [data-testid='prompt-textarea']")) return true;
      return [...record.addedNodes, ...record.removedNodes].some((node) =>
        node instanceof Element && (node.matches("form, #prompt-textarea, [data-testid='prompt-textarea'], button, [role='button']") ||
          Boolean(node.querySelector("form, #prompt-textarea, [data-testid='prompt-textarea']"))));
    })) schedule();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  let lastUrl = location.href;
  function onNavigation() {
    lastUrl = location.href;
    schedule();
  }
  // ChatGPT swaps editors and conversations without a full document reload.
  const watchdog = typeof setInterval === "function"
    ? setInterval(() => {
        schedule();
        if (location.href !== lastUrl) onNavigation();
      }, 1500)
    : null;
  function onViewportChange() {
    schedule();
  }
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("pageshow", onNavigation);
  document.addEventListener("focusin", schedule, true);
  window.addEventListener("popstate", onNavigation);
  window.addEventListener("hashchange", onNavigation);
  document.addEventListener("input", schedule, true);
  const onMessage = (
    message: { type?: string; kind?: string; text?: string; expected?: string; url?: string; modelId?: string },
    _sender: chrome.runtime.MessageSender,
    respond: (response: unknown) => void,
  ) => {
    if (message.type === "ECO_GET_DRAFT")
      respond({ prompt: readComposer(), url: location.href });
    if (message.type === "ECO_GET_RESPONSE")
      respond({
        text: message.url === location.href ? readLatestAssistantReply() : "",
      });
    if (message.type === "ECO_APPLY_REWRITE")
      {
      const applied =
          message.url === location.href &&
          typeof message.text === "string" &&
          typeof message.expected === "string" &&
          applyRewrite(message.text, message.expected);
      if (applied) tracker.markRewrite(message.text!, message.expected!);
      respond({ applied });
      }
    if (message.type === "ECO_SEARCH_SELECTED") {
      if (message.url === location.href) recordSearch();
      respond({ recorded: true });
    }
    if (message.type === "ECO_MARK_ASSISTED" && message.url === location.href) {
      if (message.kind === "rewrite" && message.text && message.expected && readComposer().trim() === message.text.trim())
        tracker.markRewrite(message.text, message.expected);
      if (message.kind === "model" && message.modelId && readChatGPTModelPassive() === message.modelId)
        tracker.markModelSelected(message.modelId);
      if (message.kind === "search") recordSearch();
      respond({ recorded: true });
    }
    if (message.type === "ECO_GET_MODEL_STATE" || message.type === "ECO_SWITCH_MODEL") {
      if (message.url !== location.href || !message.modelId || !targetForModel(message.modelId)) {
        respond({ state: "error", message: "This ChatGPT page or model is no longer available." });
        return;
      }
      void (message.type === "ECO_SWITCH_MODEL"
        ? switchChatGPTModel(message.modelId, message.url)
        : checkChatGPTModel(message.modelId, message.url))
        .then((result) => {
          if (message.type === "ECO_SWITCH_MODEL" && result.state === "selected") tracker.markModelSelected(message.modelId!);
          respond(result);
        })
        .catch(() => respond({ state: "error", message: "Could not read ChatGPT’s model picker." }));
      return true;
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) return; // Keep listeners alive for back-forward cache restores.
    observer.disconnect();
    formResizeObserver?.disconnect();
    if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
    if (watchdog !== null) clearInterval(watchdog);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("pageshow", onNavigation);
    document.removeEventListener("focusin", schedule, true);
    window.removeEventListener("popstate", onNavigation);
    window.removeEventListener("hashchange", onNavigation);
    document.removeEventListener("input", schedule, true);
    document.removeEventListener("input", onDraftInput, true);
    document.removeEventListener("submit", onSubmit, true);
    document.removeEventListener("keydown", onSubmitKey, true);
    document.removeEventListener("click", onSubmitClick, true);
    document.removeEventListener("click", onModelPickerClick, true);
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.storage.onChanged.removeListener(onThemeChanged);
    window.removeEventListener("pagehide", onPageHide);
  };
  window.addEventListener("pagehide", onPageHide);
  refresh();
}
boot();
