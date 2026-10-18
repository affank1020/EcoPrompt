// Keep host-page selectors and editor operations outside the product UI.
const selectors = [
  // ChatGPT sometimes uses contenteditable="plaintext-only" in new chats.
  "#prompt-textarea",
  '[data-testid="prompt-textarea"]',
  'form [contenteditable][role="textbox"]',
  'form [contenteditable="true"]',
  'form [contenteditable="plaintext-only"]',
  "form textarea",
];
// ChatGPT can briefly keep an old composer in the DOM while replacing it
// during client-side navigation. The first selector match is not necessarily
// the editor the user is typing in.
function isUsableComposer(editor: HTMLElement): boolean {
  if (editor.isConnected === false) return false;
  if (editor.hasAttribute?.("disabled") ||
      editor.getAttribute?.("aria-disabled") === "true" ||
      editor.getAttribute?.("contenteditable") === "false") return false;
  if (editor.closest?.('[hidden], [inert], [aria-hidden="true"]')) return false;
  const rect = editor.getBoundingClientRect();
  if (rect.width <= 0 || (typeof rect.height === "number" && rect.height <= 0))
    return false;
  if (typeof editor.checkVisibility === "function" &&
      !editor.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    return false;
  return true;
}

export function findComposer(): HTMLElement | HTMLTextAreaElement | null {
  // A single query returns unique elements in document order, even when one
  // editor matches multiple selectors. Later candidates often belong to the
  // newly mounted chat rather than the outgoing one.
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selectors.join(", ")),
  ).filter(isUsableComposer);
  if (!candidates.length) return null;

  const focused = document.activeElement;
  if (focused) {
    const exact = candidates.find((editor) => editor === focused);
    if (exact) return exact;
    const containing = candidates.filter((editor) => editor.contains?.(focused));
    if (containing.length) return containing[containing.length - 1];
  }

  // Focus can move to the extension button before it reads the draft.
  // Prefer the most recently mounted populated editor over a stale empty one.
  const populated = candidates.filter((editor) => readComposer(editor).trim());
  return (populated.length ? populated : candidates).at(-1) ?? null;
}
export function readComposer(editor = findComposer()): string {
  return !editor
    ? ""
    : editor instanceof HTMLTextAreaElement
      ? editor.value
      : (editor.innerText || editor.textContent || "").trim();
}
export function applyRewrite(text: string, expected: string): boolean {
  const editor = findComposer();
  // Never overwrite a draft edited while the popup was open.
  if (!editor || readComposer(editor) !== expected) return false;
  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(editor, text);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    const selection = document.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand("insertText", false, text)) return false;
  }
  return readComposer(editor).trim() === text.trim();
}
