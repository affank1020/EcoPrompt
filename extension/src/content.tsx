import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store, requestAnalysis, setLastSave, setPrompt } from './store';
import { Widget } from './widget';
import { analyzePrompt, type Complexity } from './mockApi';
import type { EstimateComplexity, StoredEstimate } from './guestStore';
import { SAVE_ESTIMATE, UPLOAD_QUEUE_KEY, watchStorageKey, type QueuedEstimate, type SaveEstimateMessage, type SaveResult } from './syncState';
import widgetCss from './widget.css?inline';

const HOST_ID = 'ecoprompt-extension-mount';
const SELECTORS = [
  '#prompt-textarea[contenteditable="true"]',
  '[data-testid="prompt-textarea"][contenteditable="true"]',
  'form [contenteditable="true"][role="textbox"]',
  'form div[contenteditable="true"]',
  'form textarea',
];
const COMPLEXITY: Record<Complexity, EstimateComplexity> = { Simple: 'easy', Moderate: 'medium', Advanced: 'hard' };
const SEND_BUTTON_SELECTORS = [
  '[data-testid="send-button"]',
  'button[aria-label*="Send" i]',
];

function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  for (const selector of SELECTORS) {
    const candidate = document.querySelector<HTMLElement | HTMLTextAreaElement>(selector);
    if (candidate && candidate.getBoundingClientRect().width > 0) return candidate;
  }
  return null;
}

function readComposer(element: HTMLElement | HTMLTextAreaElement | null): string {
  if (!element) return '';
  if (element instanceof HTMLTextAreaElement) return element.value;
  return (element.innerText || element.textContent || '').trim();
}

function applyRewrite(text: string): boolean {
  const editor = findComposer();
  if (!editor) return false;
  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(editor, text);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // Preserve editor input handling (e.g. ProseMirror) where possible.
    const selection = document.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted) {
      // Best-effort fallback if the host editor does not support insertText.
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }
  store.dispatch(setPrompt(readComposer(editor)));
  return readComposer(editor).trim() === text.trim();
}

function boot() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial; position:fixed; right:20px; bottom:145px; z-index:2147483000; pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = widgetCss;
  const mount = document.createElement('div');
  shadow.append(style, mount);
  document.body.appendChild(host);
  createRoot(mount).render(<Provider store={store}><Widget onApply={applyRewrite} /></Provider>);

  let lastPrompt = '';
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;

  function refresh() {
    const composer = findComposer();
    const prompt = readComposer(composer);
    if (composer) {
      const rect = composer.getBoundingClientRect();
      // Sit above the actual composer rather than at a fixed page coordinate.
      const bottom = Math.min(window.innerHeight - 24, Math.max(98, window.innerHeight - rect.top + 14));
      const right = Math.max(14, Math.min(96, window.innerWidth - rect.right));
      host.style.bottom = bottom + 'px';
      host.style.right = right + 'px';
      host.style.display = 'block';
    } else {
      host.style.display = 'none';
    }
    if (prompt === lastPrompt) return;
    lastPrompt = prompt;
    store.dispatch(setPrompt(prompt));
    if (debounce) clearTimeout(debounce);
    if (prompt.trim()) {
      debounce = setTimeout(() => {
        if (store.getState().eco.enabled) void store.dispatch(requestAnalysis(prompt));
      }, 720);
    }
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => { scheduled = false; refresh(); }, 90);
  }

  document.addEventListener('input', scheduleRefresh, true);
  document.addEventListener('keyup', scheduleRefresh, true);
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('scroll', scheduleRefresh, true);
  // ChatGPT is a SPA and may replace the composer after navigating chats.
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  // Low-frequency fallback for programmatic editor changes.
  window.setInterval(refresh, 1400);
  refresh();

  // Older builds stored the full prompt here. Prompt text is never stored, so drop it.
  void chrome.storage.local.remove('ecoLatest');

  // Save one estimate per sent prompt (not per typing pause). Lengths and numbers only.
  // The background worker decides where it goes: the guest store, or the upload queue.
  let lastSavedAt = 0;
  async function saveSentPrompt() {
    const prompt = readComposer(findComposer());
    const now = Date.now();
    if (!prompt.trim() || now - lastSavedAt < 1500) return;
    lastSavedAt = now;
    const { analysis } = store.getState().eco;
    const estimate = analysis?.prompt === prompt ? analysis : await analyzePrompt(prompt);
    const entry: StoredEstimate = {
      id: crypto.randomUUID(),
      createdAt: now,
      site: location.hostname,
      promptChars: prompt.length,
      tokens: estimate.inputTokens + estimate.predictedOutputTokens,
      complexity: COMPLEXITY[estimate.complexity],
      waterMl: estimate.baseline.waterMl,
      energyWh: estimate.baseline.energyWh,
    };
    store.dispatch(setLastSave({ id: entry.id, state: 'saving' }));
    try {
      const result = await chrome.runtime.sendMessage<SaveEstimateMessage, SaveResult | null>({ type: SAVE_ESTIMATE, estimate: entry });
      if (store.getState().eco.lastSave?.id !== entry.id) return; // A newer prompt was sent meanwhile.
      store.dispatch(setLastSave(result ? { id: entry.id, state: result } : null));
    } catch (err) {
      console.warn('EcoPrompt: could not reach the background worker:', err instanceof Error ? err.message : err);
      if (store.getState().eco.lastSave?.id === entry.id) store.dispatch(setLastSave(null));
    }
  }

  // A queued estimate leaves the queue once a retry inserts it.
  watchStorageKey<QueuedEstimate[]>(UPLOAD_QUEUE_KEY, queue => {
    const { lastSave } = store.getState().eco;
    if (lastSave?.state === 'queued' && !queue?.some(item => item.id === lastSave.id)) {
      store.dispatch(setLastSave({ id: lastSave.id, state: 'saved' }));
    }
  });

  // Capture phase, so this runs before the page clears the composer.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const composer = findComposer();
    if (composer && event.target instanceof Node && composer.contains(event.target)) void saveSentPrompt();
  }, true);
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (SEND_BUTTON_SELECTORS.some(selector => (event.target as Element).closest(selector))) void saveSentPrompt();
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
