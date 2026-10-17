import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import ts from "typescript";

const dir = new URL("../node_modules/.cache/model-switch-tests/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const file of ["integration", "modelSwitch"]) {
  const source = readFileSync(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    .outputText.replaceAll('"./integration"', '"./integration.mjs"');
  writeFileSync(new URL(`${file}.mjs`, dir), js);
}
const { targetForModel, sameModel, readChatGPTModelPassive, checkChatGPTModel, switchChatGPTModel } = await import(new URL("modelSwitch.mjs", dir));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

function fixture({ family = "GPT-6", effort = "High", families = ["GPT-6", "GPT-5.6 Sol"], efforts = ["Instant", "Medium", "High"], picker = true, delay = 0, draft = "Unsent prompt", mutateDraft = false } = {}) {
  const state = { family, effort, draft, clicks: 0, arrows: 0, open: false };
  class FakeTextarea { value = draft; getBoundingClientRect() { return { width: 200, height: 40 }; } hasAttribute() { return false; } getAttribute() { return null; } closest() { return null; } checkVisibility() { return true; } }
  const composer = new FakeTextarea();
  globalThis.HTMLTextAreaElement = FakeTextarea;
  globalThis.KeyboardEvent = class { constructor(_type, options) { this.key = options.key; } };
  globalThis.location = { href: "https://chatgpt.com/c/current" };
  globalThis.getComputedStyle = () => ({ visibility: "visible" });
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  const element = (attrs = {}, extra = {}) => ({
    isConnected: true,
    getClientRects: () => [{}],
    closest: () => null,
    hasAttribute: () => false,
    getAttribute: (name) => attrs[name] ?? null,
    ...extra,
  });
  const trigger = element({}, {
    id: "picker",
    disabled: false,
    click() { state.open = !state.open; state.clicks++; },
    getAttribute(name) {
      if (name === "aria-expanded") return state.open ? "true" : "false";
      if (name === "data-selected-reasoning-effort") return state.effort.toLowerCase().replaceAll(" ", "-");
      return null;
    },
  });
  const power = element({}, {
    focus() {},
    dispatchEvent(event) {
      state.arrows++;
      const index = efforts.indexOf(state.effort);
      const next = efforts[index + (event.key === "ArrowRight" ? 1 : -1)];
      if (next) setTimeout(() => { state.effort = next; if (mutateDraft) composer.value = "Changed by page"; }, delay);
    },
  });
  const radios = families.map((name) => element({}, {
    textContent: name,
    getAttribute(attr) {
      if (attr === "aria-checked") return String(state.family === name);
      return null;
    },
    click() { state.family = name; state.clicks++; },
  }));
  const menu = element({}, {
    getAttribute(name) { return name === "aria-labelledby" ? "picker" : null; },
    querySelector(selector) {
      if (selector.includes('aria-checked="true"')) return radios.find((radio) => radio.getAttribute("aria-checked") === "true") ?? null;
      if (selector.includes('aria-label="Power"')) return power;
      return null;
    },
    querySelectorAll(selector) { return selector === '[role="menuitemradio"]' ? radios : []; },
  });
  globalThis.document = {
    activeElement: null,
    documentElement: {},
    querySelectorAll(selector) {
      if (selector.startsWith('button[aria-label="Select ChatGPT model"]')) return picker ? [trigger] : [];
      if (selector === '[role="menu"]') return state.open ? [menu] : [];
      if (selector.includes("#prompt-textarea")) return [composer];
      return [];
    },
  };
  return { state, composer };
}

test("maps exact model families and efforts without fuzzy substitution", () => {
  assert.deepEqual(targetForModel("gpt-6-extra-high"), { family: "GPT-6", effort: "Extra High" });
  assert.deepEqual(targetForModel("gpt-5-6-sol-medium"), { family: "GPT-5.6 Sol", effort: "Medium" });
  assert.equal(targetForModel("unknown"), null);
  assert.equal(sameModel({ family: "GPT-6", effort: "High" }, { family: "GPT-5.6 Sol", effort: "High" }), false);
});
test("passive model read returns unknown unless family and effort are explicit", () => {
  fixture();
  assert.equal(readChatGPTModelPassive(), null);
  const trigger = globalThis.document.querySelectorAll('button[aria-label="Select ChatGPT model"]')[0];
  trigger.textContent = "GPT-6";
  assert.equal(readChatGPTModelPassive(), "gpt-6-high");
});
test("already selected model causes no selection click", async () => {
  const { state } = fixture();
  assert.equal((await checkChatGPTModel("gpt-6-high")).state, "already");
  assert.equal((await switchChatGPTModel("gpt-6-high")).state, "already");
  assert.equal(state.arrows, 0);
  assert.equal(state.family, "GPT-6");
  assert.equal(state.effort, "High");
});
test("switches family and reasoning effort, verifies both, preserves draft", async () => {
  const { state, composer } = fixture({ family: "GPT-6", effort: "High", delay: 110 });
  const result = await switchChatGPTModel("gpt-5-6-sol-medium");
  assert.equal(result.state, "selected");
  assert.equal(state.family, "GPT-5.6 Sol");
  assert.equal(state.effort, "Medium");
  assert.equal(composer.value, "Unsent prompt");
  assert.equal(state.arrows, 1);
});
test("unavailable family, effort, or picker never claims success", async () => {
  fixture({ families: ["GPT-6"] });
  assert.equal((await switchChatGPTModel("gpt-5-6-sol-medium")).state, "unavailable");
  fixture({ efforts: ["Instant", "Medium", "High"] });
  assert.equal((await switchChatGPTModel("gpt-6-extra-high")).state, "unavailable");
  fixture({ picker: false });
  assert.equal((await switchChatGPTModel("gpt-6-medium")).state, "error");
});
test("a changed draft prevents a success confirmation", async () => {
  fixture({ mutateDraft: true });
  const result = await switchChatGPTModel("gpt-6-medium");
  assert.equal(result.state, "error");
  assert.match(result.message, /draft/i);
});
test("a second switch request cannot overlap the first", async () => {
  fixture({ delay: 120 });
  const first = switchChatGPTModel("gpt-6-medium");
  const second = await switchChatGPTModel("gpt-6-instant");
  assert.equal(second.state, "error");
  assert.match(second.message, /already in progress/i);
  assert.equal((await first).state, "selected");
});
test("navigation before selection cancels the switch", async () => {
  const { state } = fixture();
  const result = await switchChatGPTModel("gpt-6-medium", "https://chatgpt.com/c/previous");
  assert.equal(result.state, "error");
  assert.equal(state.effort, "High");
});
