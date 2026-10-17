import { readComposer } from "./integration";

export type ModelSwitchState = "already" | "selected" | "unavailable" | "error";
export interface ModelSwitchResult {
  state: ModelSwitchState;
  message: string;
}
export interface ModelTarget { family: string; effort: string; }

const TARGETS: Record<string, ModelTarget> = {
  "gpt-6-instant": { family: "GPT-6", effort: "Instant" },
  "gpt-6-medium": { family: "GPT-6", effort: "Medium" },
  "gpt-6-high": { family: "GPT-6", effort: "High" },
  "gpt-6-extra-high": { family: "GPT-6", effort: "Extra High" },
  "gpt-5-6-sol-medium": { family: "GPT-5.6 Sol", effort: "Medium" },
};
const ORDER = ["Instant", "Medium", "High", "Extra High"];
const normal = (text: string) => text.toLowerCase().replace(/[\u2010-\u2015]/g, "-").replace(/[^a-z0-9]+/g, " ").trim();
export function targetForModel(id: string): ModelTarget | null { return TARGETS[id] ?? null; }
/** Passive read only. Never opens ChatGPT's picker during typing or submission. */
export function readChatGPTModelPassive(): string | null {
  const trigger = pickerButton();
  if (!trigger) return null;
  const label = [trigger.textContent ?? "", trigger.getAttribute("aria-label") ?? "",
    trigger.getAttribute("title") ?? "", trigger.getAttribute("data-selected-model") ?? "",
    trigger.getAttribute("data-model-id") ?? ""].join(" ");
  const exact = Object.keys(TARGETS).filter((id) => label.includes(id));
  if (exact.length === 1) return exact[0];
  const menu = openMenu(trigger);
  const selected = menu?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]');
  const familyLabel = `${label} ${selected?.textContent ?? ""}`;
  const effort = trigger.getAttribute("data-selected-reasoning-effort") ?? "";
  const matches = Object.entries(TARGETS).filter(([, target]) =>
    normal(familyLabel).includes(normal(target.family)) &&
    (normal(effort) === normal(target.effort) || normal(familyLabel).includes(normal(target.effort))));
  return matches.length === 1 ? matches[0][0] : null;
}
export function sameModel(actual: ModelTarget | null, target: ModelTarget): boolean {
  return Boolean(actual && normal(actual.family) === normal(target.family) && normal(actual.effort) === normal(target.effort));
}
function visible(element: Element): element is HTMLElement {
  const html = element as HTMLElement;
  return html.getClientRects().length > 0 && !html.closest('[hidden],[inert],[aria-hidden="true"]') &&
    getComputedStyle(html).visibility !== "hidden";
}
function pickerButton(): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Select ChatGPT model"],button[data-testid="model-switcher-dropdown-button"]')]
    .filter(visible).at(-1) ?? null;
}
function openMenu(trigger: HTMLButtonElement): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('[role="menu"]')]
    .find((menu) => visible(menu) && (menu.getAttribute("aria-labelledby") === trigger.id || menu.getAttribute("aria-label") === "Select ChatGPT model")) ?? null;
}
async function waitFor<T>(read: () => T | null, timeout = 1800): Promise<T | null> {
  const immediate = read();
  if (immediate) return immediate;
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: T | null) => { if (done) return; done = true; observer.disconnect(); clearInterval(tick); clearTimeout(timer); resolve(value); };
    const check = () => { const value = read(); if (value) finish(value); };
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = setInterval(check, 80);
    const timer = setTimeout(() => finish(null), timeout);
  });
}
async function menuForPicker(): Promise<{ trigger: HTMLButtonElement; menu: HTMLElement } | null> {
  const trigger = pickerButton();
  if (!trigger || trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return null;
  if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
  const menu = await waitFor(() => openMenu(trigger));
  return menu ? { trigger, menu } : null;
}
function closePicker(trigger: HTMLButtonElement | null) {
  if (trigger?.isConnected && trigger.getAttribute("aria-expanded") === "true") trigger.click();
}
function readEffort(trigger: HTMLButtonElement, menu: HTMLElement): string | null {
  const attributed = trigger.getAttribute("data-selected-reasoning-effort");
  if (attributed && ORDER.some((item) => normal(item) === normal(attributed)))
    return ORDER.find((item) => normal(item) === normal(attributed)) ?? null;
  const status = menu.querySelector('[role="status"]')?.textContent ?? "";
  return ORDER.find((item) => normal(status).startsWith(normal(item) + " ")) ?? null;
}
async function readSelection(): Promise<{ selection: ModelTarget | null; trigger: HTMLButtonElement; menu: HTMLElement } | null> {
  const picker = await menuForPicker();
  if (!picker) return null;
  let family = picker.menu.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]');
  if (!family) {
    const toggle = picker.menu.querySelector<HTMLElement>('[role="menuitem"][aria-label="Select model"]');
    toggle?.click();
    family = await waitFor(() => picker.menu.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]'));
  }
  const effort = readEffort(picker.trigger, picker.menu);
  return { ...picker, selection: family && effort ? { family: family.textContent?.trim() ?? "", effort } : null };
}
export async function checkChatGPTModel(id: string, expectedUrl?: string): Promise<ModelSwitchResult> {
  const target = targetForModel(id);
  if (!target) return { state: "unavailable", message: "This demo model cannot be selected in ChatGPT." };
  let trigger: HTMLButtonElement | null = null;
  try {
    const found = await readSelection();
    trigger = found?.trigger ?? null;
    if (expectedUrl && location.href !== expectedUrl) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
    if (!found?.selection) return { state: "error", message: "Could not read ChatGPT’s selected model." };
    return sameModel(found.selection, target)
      ? { state: "already", message: "Already using this model" }
      : { state: "selected", message: "Different model selected" };
  } finally { closePicker(trigger ?? pickerButton()); }
}

/** Only call from an explicit user-click handler. */
async function performModelSwitch(id: string, expectedUrl?: string): Promise<ModelSwitchResult> {
  const target = targetForModel(id);
  if (!target) return { state: "unavailable", message: "This demo model cannot be selected in ChatGPT." };
  const originalDraft = readComposer();
  let trigger: HTMLButtonElement | null = null;
  try {
    const initial = await readSelection();
    trigger = initial?.trigger ?? null;
    if (expectedUrl && location.href !== expectedUrl) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
    if (!initial?.selection) return { state: "error", message: "Could not read ChatGPT’s model picker." };
    if (sameModel(initial.selection, target)) return { state: "already", message: "Already using this model" };
    if (normal(initial.selection.family) !== normal(target.family)) {
      initial.menu.querySelector<HTMLElement>('[role="menuitem"][aria-label="Select model"]')?.click();
      const family = await waitFor(() => [...initial.menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
        .find((item) => normal(item.textContent ?? "") === normal(target.family) && visible(item) && item.getAttribute("aria-disabled") !== "true" && !item.hasAttribute("data-disabled")) ?? null, 700);
      if (!family) return { state: "unavailable", message: `${target.family} is not available in this model menu.` };
      if (expectedUrl && location.href !== expectedUrl) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
      family.click();
      let next = await readSelection();
      for (let retry = 0; retry < 3 && normal(next?.selection?.family ?? "") !== normal(target.family); retry++) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        next = await readSelection();
      }
      trigger = next?.trigger ?? trigger;
      if (!next?.selection || normal(next.selection.family) !== normal(target.family))
        return { state: "error", message: "ChatGPT did not select the recommended model family." };
    }
    let current = await readSelection();
    trigger = current?.trigger ?? trigger;
    if (!current?.selection) return { state: "error", message: "Could not read ChatGPT’s thinking level." };
    // A family submenu can remain open. Reopen the picker at its power view.
    closePicker(current.trigger);
    current = await readSelection();
    trigger = current?.trigger ?? trigger;
    if (!current?.selection) return { state: "error", message: "Could not read ChatGPT’s thinking level." };
    for (let attempt = 0; attempt < 4 && !sameModel(current.selection, target); attempt++) {
      const from = ORDER.findIndex((effort) => normal(effort) === normal(current!.selection!.effort));
      const to = ORDER.findIndex((effort) => normal(effort) === normal(target.effort));
      if (from < 0 || to < 0) break;
      const power = current.menu.querySelector<HTMLElement>('[role="menuitem"][aria-label="Power"]');
      if (!power) return { state: "unavailable", message: "This thinking level is not available in ChatGPT." };
      if (expectedUrl && location.href !== expectedUrl) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
      power.focus();
      power.dispatchEvent(new KeyboardEvent("keydown", { key: to > from ? "ArrowRight" : "ArrowLeft", bubbles: true, cancelable: true }));
      const previous = current.selection.effort;
      const changed = await waitFor(() => {
        const effort = pickerButton()?.getAttribute("data-selected-reasoning-effort");
        return effort && normal(effort) !== normal(previous) ? effort : null;
      }, 700);
      if (!changed) return { state: "unavailable", message: "Could not set the exact thinking level. Check ChatGPT’s model picker." };
      current = await readSelection();
      trigger = current?.trigger ?? trigger;
      if (!current?.selection) break;
    }
    const verified = await readSelection();
    trigger = verified?.trigger ?? trigger;
    if (expectedUrl && location.href !== expectedUrl) return { state: "error", message: "This ChatGPT conversation changed. Reopen EcoPrompt." };
    if (readComposer() !== originalDraft)
      return { state: "error", message: "ChatGPT changed the draft during model selection. Please review it." };
    return sameModel(verified?.selection ?? null, target)
      ? { state: "selected", message: "Model changed" }
      : { state: "error", message: "ChatGPT did not confirm the model change." };
  } catch {
    return { state: "error", message: "Could not change the model. Try choosing it in ChatGPT." };
  } finally { closePicker(trigger ?? pickerButton()); }
}

let switchInFlight: Promise<ModelSwitchResult> | null = null;
export function switchChatGPTModel(id: string, expectedUrl?: string): Promise<ModelSwitchResult> {
  if (switchInFlight) return Promise.resolve({ state: "error", message: "A model change is already in progress." });
  const operation = performModelSwitch(id, expectedUrl);
  switchInFlight = operation;
  const release = () => { if (switchInFlight === operation) switchInFlight = null; };
  void operation.then(release, release);
  return operation;
}
