import { estimateVisibleReply } from "./mockApi";
// ChatGPT does not expose real per-message energy, water use, or full context tokens.
// This unobtrusive label estimates *visible text output only* and says so.
// ChatGPT's newer rich-response layout uses a selection message ID rather
// than data-message-author-role. The assistant content marker identifies the
// reply without accidentally decorating the user's messages.
const MODERN_MESSAGE_SELECTOR = "[data-chatgpt-selection-message-id]";
const MODERN_CONTENT_SELECTOR = [
  '[data-markdown-text-style="assistant-message"]',
  "[data-dil-message-id]",
].join(", ");
const LEGACY_REPLY_SELECTOR = [
  '[data-message-author-role="assistant"]',
  '[data-testid="assistant-message"]',
  '[data-role="assistant"]',
].join(", ");
const LEGACY_CONTENT_SELECTOR = [
  '[data-testid="message-content"]',
  '[data-testid="conversation-turn-content"]',
  "[data-message-content]",
  ".markdown",
  ".prose",
].join(", ");
function replyText(message: HTMLElement, content: HTMLElement | null): string {
  if (content) return content.innerText.trim();
  // Some response layouts (e.g. richer UI renderers) don't use .markdown/.prose.
  // Cloning excludes our shadow-root badge and prevents its label being counted
  // as new assistant output on each MutationObserver refresh.
  const clean = message.cloneNode(true) as HTMLElement;
  clean
    .querySelectorAll('button, nav, [role="toolbar"], [data-ecoprompt-reply]')
    .forEach((node) => node.remove());
  return (clean.textContent ?? "").trim();
}
type BadgeEntry = { host: HTMLElement; anchor: HTMLElement };
const badgeEntries = new Map<HTMLElement, BadgeEntry>();
let badgeLayer: HTMLElement | null = null;
const MAX_VISIBLE_BADGES = 80;

/** Remove badges left by an earlier content-script version without starting badge work. */
export function removeReplyBadges(): void {
  for (const { host } of badgeEntries.values()) host.remove();
  badgeEntries.clear();
  document.getElementById("ecoprompt-reply-overlay")?.remove();
  document.querySelectorAll('[data-ecoprompt-reply]').forEach((node) => node.remove());
  badgeLayer = null;
}

function layer(): HTMLElement {
  if (badgeLayer?.isConnected) return badgeLayer;
  badgeLayer = document.createElement("div");
  badgeLayer.id = "ecoprompt-reply-overlay";
  // No children are inserted into React-managed ChatGPT message trees.
  badgeLayer.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147482990;";
  document.body.append(badgeLayer);
  return badgeLayer;
}

let positioning = false;
export function updateReplyBadgePositions(): void {
  if (positioning) return;
  positioning = true;
  const reposition = () => {
    positioning = false;
    for (const { host, anchor } of badgeEntries.values()) {
      if (!anchor.isConnected) {
        host.style.display = "none";
        continue;
      }
      const rect = anchor.getBoundingClientRect();
      // Only place badges whose reply footer is on screen; never force layout
      // for reply text while scrolling or while ChatGPT streams a response.
      const visible = rect.width > 0 && rect.bottom >= 0 && rect.bottom < window.innerHeight - 24;
      host.style.display = visible ? "block" : "none";
      if (!visible) continue;
      host.style.top = Math.max(6, rect.bottom + 6) + "px";
      host.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + "px";
    }
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(reposition);
  else setTimeout(reposition, 40);
}

function badgeFor(
  message: HTMLElement,
  content: HTMLElement | null,
): HTMLElement {
  const existing = badgeEntries.get(message);
  if (existing) {
    existing.anchor = content ?? message;
    return existing.host;
  }
  const host = document.createElement("div");
  host.dataset.ecopromptReply = "true";
  host.style.cssText =
    "position:absolute;display:none;pointer-events:auto;width:max-content;max-width:calc(100vw - 16px);";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    button { font: 500 10px/1.4 Inter,system-ui,-apple-system,sans-serif; color: #638982; background: #f3faf7; border: 1px solid #dcece5; border-radius: 999px; padding: 5px 10px; cursor: pointer; text-align:left; }
    button:hover { background:#eaf6f0; color:#3d7762; }
    button:focus-visible { outline:2px solid #81bace; outline-offset:2px; }
    .details { max-width:310px; margin-top:6px; padding:9px 11px; background:#f6fbfa; border:1px solid #e0eeea; border-radius:9px; font: 11px/1.5 Inter,system-ui,-apple-system,sans-serif; color:#64817d; }
    [hidden] { display:none!important; }
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Show EcoPrompt reply estimate details");
  const details = document.createElement("div");
  details.className = "details";
  details.hidden = true;
  button.addEventListener("click", () => {
    details.hidden = !details.hidden;
    button.setAttribute("aria-expanded", String(!details.hidden));
  });
  shadow.append(style, button, details);
  // The fixed, pointer-transparent layer is owned entirely by EcoPrompt.
  layer().append(host);
  badgeEntries.set(message, { host, anchor: content ?? message });
  return host;
}
export function decorateAssistantReplies(dirty: ReadonlySet<HTMLElement> = new Set()): void {
  const modernMessages = document.querySelectorAll<HTMLElement>(MODERN_MESSAGE_SELECTOR);
  const messages = modernMessages.length
    ? modernMessages
    : document.querySelectorAll<HTMLElement>(LEGACY_REPLY_SELECTOR);
  // Bound DOM work and retained badge elements in very long conversations.
  const recent = Array.from(messages).slice(-MAX_VISIBLE_BADGES);
  const current = new Set(recent);
  for (const [message, entry] of badgeEntries) {
    if (!message.isConnected || !current.has(message)) {
      entry.host.remove();
      badgeEntries.delete(message);
    }
  }
  for (const message of recent) {
    if (badgeEntries.has(message) && !dirty.has(message)) continue;
    const content = modernMessages.length
      ? message.querySelector<HTMLElement>(MODERN_CONTENT_SELECTOR)
      : message.querySelector<HTMLElement>(LEGACY_CONTENT_SELECTOR);
    // Modern IDs are also present on user turns.
    if (modernMessages.length && !content) continue;
    const visibleReply = replyText(message, content);
    if (!visibleReply) continue;
    const estimate = estimateVisibleReply(visibleReply);
    const entry = badgeEntries.get(message);
    if (entry?.host.dataset.ecoTokens === String(estimate.outputTokens)) continue;
    const badge = badgeFor(message, content);
    badge.dataset.ecoTokens = String(estimate.outputTokens);
    const button = badge.shadowRoot?.querySelector("button");
    const details = badge.shadowRoot?.querySelector<HTMLElement>(".details");
    if (button)
      button.textContent = "✳ EcoPrompt estimate · ~" + estimate.outputTokens + " tokens · " + estimate.waterMl.toFixed(2) + " mL";
    if (details)
      details.textContent = "Visible reply text only: ~" + estimate.outputTokens + " output tokens, ~" + estimate.energyWh.toFixed(3) + " Wh, ~" + estimate.waterMl.toFixed(2) + " mL. Illustrative balanced-model assumption. Excludes prior context, input tokens, reasoning, tools and images. Not measured usage.";
  }
  updateReplyBadgePositions();
}

/** Read the latest visible assistant message only when the user requests analysis. */
export function readLatestAssistantReply(): string {
  const modern = [
    ...document.querySelectorAll<HTMLElement>(MODERN_MESSAGE_SELECTOR),
  ]
    .map((message) =>
      message.querySelector<HTMLElement>(MODERN_CONTENT_SELECTOR),
    )
    .filter((content): content is HTMLElement => Boolean(content));
  const legacy = modern.length
    ? []
    : [...document.querySelectorAll<HTMLElement>(LEGACY_REPLY_SELECTOR)].map(
        (message) =>
          message.querySelector<HTMLElement>(LEGACY_CONTENT_SELECTOR) ??
          message,
      );
  const replies = modern.length ? modern : legacy;
  return replies.at(-1)?.innerText.trim() ?? "";
}
