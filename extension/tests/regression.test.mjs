import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import ts from "typescript";
// Compile the actual source into an ephemeral ESM fixture; no browser dependencies.
const dir = new URL("../node_modules/.cache/eco-tests/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const file of [
  "mockApi",
  "store",
  "integration",
  "services/contracts",
  "services/modelCatalog",
  "services/analysisService",
  "services/searchRecommendation",
  "services/passiveTracking",
  "services/savingsOpportunity",
  "services/persistence",
]) {
  const source = readFileSync(
    new URL(`../src/${file}.ts`, import.meta.url),
    "utf8",
  );
  const js = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replaceAll("../mockApi", "./mockApi")
    .replaceAll("'./mockApi'", "'./mockApi.mjs'")
    .replaceAll('"./mockApi"', '"./mockApi.mjs"')
    .replaceAll("./services/analysisService", "./analysisService.mjs")
    .replaceAll("./services/modelCatalog", "./modelCatalog.mjs")
    .replaceAll("./services/contracts", "./contracts.mjs")
    .replaceAll("./services/searchRecommendation", "./searchRecommendation.mjs")
    .replaceAll("./services/passiveTracking", "./passiveTracking.mjs")
    .replaceAll("'./contracts'", "'./contracts.mjs'")
    .replaceAll('"./contracts"', '"./contracts.mjs"')
    .replaceAll('"./searchRecommendation"', '"./searchRecommendation.mjs"')
    .replaceAll('"./passiveTracking"', '"./passiveTracking.mjs"')
    .replaceAll('"./modelCatalog"', '"./modelCatalog.mjs"');
  writeFileSync(new URL(`${file.split("/").at(-1)}.mjs`, dir), js);
}
const api = await import(new URL("mockApi.mjs", dir));
const { savingsOpportunity } = await import(new URL("savingsOpportunity.mjs", dir));
const {
  store,
  setPrompt,
  requestAnalysis,
  requestModel,
  requestOptimisation,
  markUsed,
  hydrate,
  setView,
} = await import(new URL("store.mjs", dir));
const { applyRewrite } = await import(new URL("integration.mjs", dir));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

test("rewrite keeps task instructions and compares the same model", async () => {
  const a = await api.analyzePrompt(
    "Hello, could you please explain rain gardens in detail?",
  );
  assert.match(a.rewrittenPrompt.toLowerCase(), /explain rain gardens in detail\?$/);
  assert.equal((await api.analyzePrompt("Hello, could you please explain rain gardens in detail?")).rewrittenPrompt, a.rewrittenPrompt);
  assert.ok(a.optimized.waterMl <= a.baseline.waterMl);
  const unchanged = await api.analyzePrompt("Prove this theorem step by step.");
  assert.deepEqual(unchanged.optimized, unchanged.baseline);
  assert.equal(unchanged.savingsPercent, 0);
});
test("mock resource estimates scale with prompt length and recommendations are repeatable", () => {
  const short = api.estimatePrompt("Summarise this.");
  const long = api.estimatePrompt("Summarise this. ".repeat(60));
  assert.equal(short.estimatedWordCount, 2);
  assert.equal(long.estimatedWordCount, 120);
  assert.ok(long.inputTokens > short.inputTokens);
  assert.ok(long.baseline.waterMl > short.baseline.waterMl);
  assert.ok(long.baseline.energyWh > short.baseline.energyWh);
  assert.deepEqual(api.recommendModels("Prompt A"), api.recommendModels("Prompt A"));
  assert.equal(api.recommendModels("Prompt A").models.length, 5);
  assert.equal(api.estimateRewriteOpportunity("Prove the theorem.").potentialWaterSavingsMl, 0);
  assert.ok(api.estimateRewriteOpportunity("Hello, could you please explain this?").potentialWaterSavingsMl > 0);
});
test("model service uses the supplied catalog and reference", async () => {
  const { mockAnalysisService } = await import(new URL("analysisService.mjs", dir));
  const result = await mockAnalysisService.recommendModel({
    analysisId: "prompt-test",
    prompt: "List three colours.",
    platform: "chatgpt",
    model: null,
    catalog: {
      source: "detected",
      referenceModelId: "gpt-6-medium",
      models: [
        { id: "gpt-6-instant", name: "Instant available here", family: "gpt-6", effort: "instant" },
        { id: "gpt-6-medium", name: "Medium available here", family: "gpt-6", effort: "medium" },
      ],
    },
  });
  assert.equal(result.catalogSource, "detected");
  assert.equal(result.baseline.name, "Medium available here");
  assert.deepEqual(
    [result.recommended, ...result.alternatives].map((model) => model.id).sort(),
    ["gpt-6-instant", "gpt-6-medium"],
  );
  assert.ok(result.recommended.potentialWaterSavingsMl > 0);
});
test("headline uses one meaningful action and ignores negligible rewrites", async () => {
  const { mockAnalysisService } = await import(new URL("analysisService.mjs", dir));
  const prompt = "Hello, could you please explain rain gardens in detail?";
  const analysis = await mockAnalysisService.analysePrompt({ prompt, platform: "chatgpt", model: null });
  const catalog = (await import(new URL("modelCatalog.mjs", dir))).chatGPTDemoCatalog;
  const model = await mockAnalysisService.recommendModel({ prompt, analysisId: analysis.analysisId, platform: "chatgpt", model: null, catalog });
  const result = savingsOpportunity(analysis, model);
  assert.equal(result.showModel, true);
  assert.equal(result.waterMl, model.recommended.potentialWaterSavingsMl);
  assert.equal(result.percent, Math.round(result.waterMl / analysis.estimates.waterMl * 100));
  const unchanged = await mockAnalysisService.analysePrompt({ prompt: "Prove the theorem.", platform: "chatgpt", model: null });
  assert.equal(savingsOpportunity(unchanged, null).showRewrite, false);
});
test("analysis is cached and model/rewrite services remain independent", async () => {
  const { mockAnalysisService } = await import(
    new URL("analysisService.mjs", dir)
  );
  let modelCalls = 0,
    rewriteCalls = 0;
  const originalModel = mockAnalysisService.recommendModel;
  const originalRewrite = mockAnalysisService.optimisePrompt;
  mockAnalysisService.recommendModel = async (request) => {
    modelCalls++;
    return originalModel(request);
  };
  mockAnalysisService.optimisePrompt = async (request) => {
    rewriteCalls++;
    return originalRewrite(request);
  };
  store.dispatch(setPrompt("Hello, explain rain gardens."));
  const pending = store.dispatch(requestAnalysis(store.getState().eco.prompt));
  store.dispatch(setPrompt("Another draft"));
  await pending;
  assert.equal(store.getState().eco.analysis, null);
  assert.equal(store.getState().eco.history.length, 0);
  await store.dispatch(requestAnalysis("Another draft"));
  await store.dispatch(requestAnalysis("Another draft"));
  assert.equal(store.getState().eco.history.length, 1);
  assert.ok(store.getState().eco.analysis.rewriteOpportunity);
  assert.equal(modelCalls, 0);
  assert.equal(rewriteCalls, 0);
  const analysisId = store.getState().eco.analysis.analysisId;
  await store.dispatch(requestModel({ prompt: "Another draft", analysisId }));
  assert.equal(modelCalls, 1);
  assert.ok(
    store.getState().eco.modelRecommendation.recommended.suitability >= 90,
  );
  assert.equal(store.getState().eco.modelRecommendation.catalogSource, "demo");
  assert.equal(store.getState().eco.modelRecommendation.baseline.id, "gpt-6-high");
  assert.equal(store.getState().eco.modelRecommendation.alternatives.length, 4);
  assert.ok(store.getState().eco.modelRecommendation.recommended.potentialWaterSavingsMl >= 0);
  for (const option of [store.getState().eco.modelRecommendation.recommended, ...store.getState().eco.modelRecommendation.alternatives]) {
    assert.ok(option.estimatedWaterMl > 0);
    assert.ok(option.estimatedEnergyWh > 0);
    assert.ok(option.potentialEnergySavingsWh >= 0);
  }
  await store.dispatch(
    requestOptimisation({ prompt: "Another draft", analysisId }),
  );
  assert.equal(rewriteCalls, 1);
  assert.equal(store.getState().eco.optimisation.analysisId, analysisId);
  store.dispatch(hydrate({ ...store.getState().eco, status: "loading" }));
  assert.equal(store.getState().eco.status, "ready");
  mockAnalysisService.recommendModel = originalModel;
  mockAnalysisService.optimisePrompt = originalRewrite;
});

test("applied suggestions do not credit savings before submission", async () => {
  const { clearHistory, selectTotals } = await import(new URL("store.mjs", dir));
  store.dispatch(clearHistory());
  store.dispatch(setPrompt("Hello, explain water savings."));
  await store.dispatch(requestAnalysis("Hello, explain water savings."));
  const analysisId = store.getState().eco.analysis.analysisId;
  await store.dispatch(requestOptimisation({ prompt: "Hello, explain water savings.", analysisId }));
  store.dispatch(markUsed());
  assert.equal(store.getState().eco.savingActions.length, 0);
  assert.equal(selectTotals(store.getState()).potentialWaterMl, 0);
  assert.equal(store.getState().eco.history[0].used, true);
});

test("legacy efficiency records migrate only completed decisions and preserve history", async () => {
  const { saveState, readSavedState } = await import(new URL("persistence.mjs", dir));
  const data = { ecoAssessmentsV1: [
    { promptId: "unused", timestamp: 1, outcome: "efficient", assistedOptimisation: false },
    { promptId: "submitted", timestamp: 2, assistedOptimisation: true, estimatedWaterSavedMl: 1.5, estimatedEnergySavedWh: 0.1 },
  ], ecoSearchSelectionsV1: [{ id: "search-1", timestamp: 3 }] };
  globalThis.chrome = { storage: {
    local: { async get(keys) { return Object.fromEntries(keys.map((key) => [key, data[key]])); }, async set(value) { Object.assign(data, value); }, async remove(keys) { for (const key of keys) delete data[key]; } },
    session: { async get(key) { return { [key]: data[key] }; }, async set(value) { Object.assign(data, value); } },
  } };
  await saveState(store.getState());
  data.ecoHistoryV4 = structuredClone(data.ecoHistoryV4);
  data.ecoHistoryV4.history[0].analysis.efficiency = { score: 100 };
  const saved = await readSavedState();
  assert.equal(saved.history.length, 1);
  assert.deepEqual(saved.optimisationLedger.records.map((item) => item.id), ["search-1", "submitted"]);
  assert.equal(saved.optimisationLedger.records[1].estimatedWaterMl, 1.5);
  assert.equal(saved.history[0].analysis.efficiency, undefined);
  assert.equal(data.ecoAssessmentsV1, undefined);
  assert.equal(data.ecoOptimisationsV1.records.length, 2);
});

test("legacy saving actions remain in totals without new click credits", async () => {
  const { selectTotals, hydrate } = await import(new URL("store.mjs", dir));
  store.dispatch(hydrate({ savingActions: [{ id: "old", at: 1, type: "rewrite", analysisId: "old-analysis", estimatedWaterMl: 2, estimatedEnergyWh: 0.1, realisedWaterMl: 0, realisedEnergyWh: 0 }] }));
  assert.equal(selectTotals(store.getState()).potentialWaterMl, 2);
  store.dispatch(markUsed());
  assert.equal(selectTotals(store.getState()).potentialWaterMl, 2);
});

test("earlier local prompt history imports once with stable IDs", async () => {
  const { readSavedState } = await import(new URL("persistence.mjs", dir));
  const prior = await api.analyzePrompt("Hello, explain water savings.");
  const legacy = [
    { at: 1000, used: true, analysis: prior },
    { at: 2000, used: true, analysis: prior },
  ];
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { ecoHistory: legacy }; },
        async set() {},
      },
      session: {
        async get() {
          return {};
        },
      },
    },
  };
  const saved = await readSavedState();
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].used, true);
  assert.equal(
    saved.history[0].analysis.estimates.waterMl,
    prior.baseline.waterMl,
  );
});
async function launch(mode, entry = "launcher") {
  let listener, actionListener;
  const writes = [];
  const tabs = [];
  const injections = [];
  const messages = [];
  const chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          listener = fn;
        },
      },
      getURL: (path) => `chrome-extension://test/${path}`,
    },
    storage: {
      session: {
        async set(value) {
          writes.push(value);
        },
      },
    },
    action: { onClicked: { addListener(fn) { actionListener = fn; } } },
    scripting: {
      async executeScript(options) {
        injections.push(options);
        if (mode === "failure") throw Error("Injection blocked");
      },
    },
    tabs: {
      async sendMessage(tabId, message) {
        messages.push({ tabId, message });
        if (mode === "failure") throw Error("No receiver");
        return mode === "existing" || injections.length
          ? { opened: "panel", visible: true }
          : undefined;
      },
      async create(options) {
        tabs.push(options);
      },
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../public/background.js", import.meta.url), "utf8"),
    { chrome },
  );
  const source = { id: 42, windowId: 7, url: "https://chatgpt.com/c/example" };
  const result = entry === "launcher"
    ? await new Promise((resolve) =>
        listener({ type: "ECO_OPEN", prompt: "Draft" }, { tab: source }, resolve),
      )
    : await actionListener(entry === "restricted" ? { id: 42, url: "chrome://extensions" } : source);
  if (entry !== "launcher") await new Promise((resolve) => setImmediate(resolve));
  return { result, writes, tabs, injections, messages, listener, actionListener };
}
test("ChatGPT launcher injects the rounded Assistant panel once", async () => {
  const state = await launch("fresh");
  assert.equal(state.result.opened, "panel");
  assert.equal(state.injections.length, 1);
  assert.equal(state.injections[0].files[0], "panel.js");
  assert.equal(state.messages.at(-1).message.view, "assistant");
  assert.equal(state.messages.at(-1).message.tabId, 42);
  assert.equal(state.tabs.length, 0);
  assert.equal(state.writes.length, 0);
  assert.equal(
    state.listener(
      { type: "ECO_OPEN" },
      { tab: { id: 4, url: "https://example.com" } },
      () => assert.fail(),
    ),
    undefined,
  );
});
test("toolbar action reuses an existing panel", async () => {
  const state = await launch("existing", "toolbar");
  assert.equal(state.injections.length, 0);
  assert.equal(state.messages[0].message.view, "overview");
  assert.equal(state.messages[0].message.toggle, true);
  assert.equal(state.tabs.length, 0);
});
test("blocked injection falls back to the extension page with the draft", async () => {
  const state = await launch("failure");
  assert.equal(state.result.opened, "tab");
  assert.equal(state.writes[0].ecoLaunch.prompt, "Draft");
  assert.equal(state.tabs[0].url, "chrome-extension://test/popup.html");
});
test("restricted browser pages open the extension page", async () => {
  const state = await launch("fresh", "restricted");
  assert.equal(state.injections.length, 0);
  assert.equal(state.tabs[0].url, "chrome-extension://test/popup.html");
});
test("toolbar action has no native popup", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url)));
  assert.equal(manifest.action.default_popup, undefined);
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.permissions.includes("activeTab"));
});
test("textarea replacement emits input, never sends, and refuses changed drafts", () => {
  class Textarea {
    _value = "Original";
    events = [];
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = v;
    }
    focus() {}
    getBoundingClientRect() {
      return { width: 100 };
    }
    dispatchEvent(e) {
      this.events.push(e.type);
    }
  }
  const editor = new Textarea();
  globalThis.HTMLTextAreaElement = Textarea;
  globalThis.document = { querySelectorAll: () => [editor], activeElement: null };
  assert.equal(applyRewrite("New", "Stale"), false);
  assert.equal(editor.value, "Original");
  assert.equal(applyRewrite("New", "Original"), true);
  assert.equal(editor.value, "New");
  assert.deepEqual(editor.events, ["input"]);
});
test("rich editor replacement uses editor input handling and preserves changed drafts", () => {
  const editor = {
    innerText: "Original",
    focus() {},
    getBoundingClientRect: () => ({ width: 100 }),
  };
  const calls = [];
  globalThis.document = {
    querySelectorAll: () => [editor],
    activeElement: null,
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
    createRange: () => ({ selectNodeContents() {} }),
    execCommand(command, _ui, text) {
      calls.push(command);
      editor.innerText = text;
      return true;
    },
  };
  assert.equal(applyRewrite("New", "Original"), true);
  assert.deepEqual(calls, ["insertText"]);
  assert.equal(applyRewrite("Overwrite", "Original"), false);
});
test("new-chat editor is detected even when contenteditable is plaintext-only", async () => {
  const { findComposer, readComposer } = await import(new URL("integration.mjs", dir));
  const editor = {
    innerText: "Draft in a fresh chat",
    getBoundingClientRect: () => ({ width: 420 }),
  };
  globalThis.document = {
    querySelectorAll: (selector) => selector.includes("#prompt-textarea") ? [editor] : [],
    activeElement: editor,
  };
  assert.equal(findComposer(), editor);
  assert.equal(readComposer(), "Draft in a fresh chat");
});
test("new-chat navigation selects the active draft instead of the old empty editor", async () => {
  const { findComposer, readComposer } = await import(new URL("integration.mjs", dir));
  class Textarea {
    isConnected = true;
    hidden = false;
    constructor(value) { this.value = value; }
    getBoundingClientRect() {
      return { width: 420, height: 42, top: 700, bottom: 742, right: 850 };
    }
    checkVisibility() { return !this.hidden; }
    focus() {}
  }
  globalThis.HTMLTextAreaElement = Textarea;
  const previous = new Textarea("");
  const fresh = new Textarea("Draft in the new chat");
  const document = {
    activeElement: fresh,
    querySelectorAll: () => [previous, fresh],
  };
  globalThis.document = document;
  assert.equal(findComposer(), fresh);
  assert.equal(readComposer(), "Draft in the new chat");

  // Clicking EcoPrompt removes focus from ChatGPT's editor.
  document.activeElement = null;
  assert.equal(findComposer(), fresh);
  assert.equal(readComposer(), "Draft in the new chat");

  // Returning to an earlier chat must not read a retained hidden editor.
  fresh.hidden = true;
  previous.value = "Draft in the original chat";
  document.activeElement = previous;
  assert.equal(findComposer(), previous);
  assert.equal(readComposer(), "Draft in the original chat");

  // A disabled editor left over from a transition must be ignored.
  fresh.hidden = false;
  fresh.getAttribute = (name) => name === "aria-disabled" ? "true" : null;
  document.activeElement = null;
  assert.equal(findComposer(), previous);
});

test("rewrites target the current composer, never a stale one after navigation", async () => {
  const { findComposer } = await import(new URL("integration.mjs", dir));
  class Textarea {
    isConnected = true;
    events = [];
    constructor(value) { this._value = value; }
    get value() { return this._value; }
    set value(next) { this._value = next; }
    getBoundingClientRect() {
      return { width: 400, height: 40, top: 680, bottom: 720, right: 850 };
    }
    focus() {}
    dispatchEvent(event) { this.events.push(event.type); }
  }
  globalThis.HTMLTextAreaElement = Textarea;
  const stale = new Textarea("Old draft");
  const current = new Textarea("Current draft");
  globalThis.document = {
    activeElement: current,
    querySelectorAll: () => [stale, current],
  };
  assert.equal(findComposer(), current);
  assert.equal(applyRewrite("Optimised draft", "Old draft"), false);
  assert.equal(applyRewrite("Optimised draft", "Current draft"), true);
  assert.equal(stale.value, "Old draft");
  assert.equal(current.value, "Optimised draft");
  assert.deepEqual(current.events, ["input"]);
});

test("visible reply estimates are deterministic and empty output is zero", () => {
  assert.deepEqual(api.estimateVisibleReply(""), {
    outputTokens: 0,
    waterMl: 0,
    energyWh: 0,
  });
  assert.equal(api.estimateVisibleReply("12345678").outputTokens, 2);
});


test("search recommendation is deterministic and excludes synthesis", async () => {
  const { searchRecommendation } = await import(new URL("searchRecommendation.mjs", dir));
  const factual = searchRecommendation("What is the capital of France?");
  assert.equal(factual?.type, "search");
  assert.deepEqual(searchRecommendation("What is the capital of France?"), factual);
  assert.equal(searchRecommendation("Compare and analyze transport options for my trip."), null);
});

test("ordinary submissions and unobserved model changes create no optimisation", async () => {
  const { PassiveTracker } = await import(new URL("passiveTracking.mjs", dir));
  let model = "gpt-6-instant";
  let time = 1000;
  const records = [];
  const tracker = new PassiveTracker(() => model, (item) => records.push(item), () => time);
  tracker.observe("List three examples of fruit.");
  tracker.submit("List three examples of fruit.", "/c/one");
  assert.equal(records.length, 0);
  time += 3000;
  model = "gpt-6-high";
  tracker.observe("Explain photosynthesis to a child.");
  model = "gpt-6-medium";
  tracker.submit("Explain photosynthesis to a child.", "/c/two");
  assert.equal(records.length, 0);
});

test("observed manual switch to a suitable lighter model counts once with an estimate", async () => {
  const { PassiveTracker } = await import(new URL("passiveTracking.mjs", dir));
  let model = "gpt-6-high";
  const records = [];
  const tracker = new PassiveTracker(() => model, (item) => records.push(item), () => 1000);
  tracker.observe("Explain photosynthesis to a child.");
  model = "gpt-6-medium";
  tracker.noteManualModelChange();
  assert.equal(tracker.submit("Explain photosynthesis to a child.", "/c/one"), true);
  assert.equal(tracker.submit("Explain photosynthesis to a child.", "/c/one"), false);
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "independent");
  assert.ok(records[0].estimatedWaterMl > 0);
});

test("unsuitable or unknown model changes do not count", async () => {
  const { PassiveTracker } = await import(new URL("passiveTracking.mjs", dir));
  let model = "gpt-6-high";
  const records = [];
  const tracker = new PassiveTracker(() => model, (item) => records.push(item));
  tracker.observe("Prove this theorem and derive its complexity analysis.");
  model = "gpt-6-instant";
  tracker.noteManualModelChange();
  tracker.submit("Prove this theorem and derive its complexity analysis.", "/c/one");
  model = null;
  tracker.observe("Explain photosynthesis to a child.");
  model = "gpt-6-medium";
  tracker.noteManualModelChange();
  tracker.submit("Explain photosynthesis to a child.", "/c/two");
  assert.equal(records.length, 0);
});

test("assisted model and rewrite produce one combined submission record", async () => {
  const { PassiveTracker } = await import(new URL("passiveTracking.mjs", dir));
  let model = "gpt-6-high";
  const records = [];
  const tracker = new PassiveTracker(() => model, (item) => records.push(item));
  tracker.observe("Hello, could you please explain rain gardens in detail?");
  tracker.markRewrite("Explain rain gardens in detail?", "Hello, could you please explain rain gardens in detail?");
  tracker.markModelSelected("gpt-6-medium");
  model = "gpt-6-medium";
  tracker.submit("Explain rain gardens in detail?", "/c/one");
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "assisted");
  assert.equal(records[0].rewriteApplied, true);
  assert.equal(records[0].modelChanged, true);
  assert.ok(records[0].estimatedWaterMl > 0);
});

test("search choices count without claiming savings and legacy totals do not duplicate", async () => {
  const { ledgerFromRecords, migrateOptimisations } = await import(new URL("passiveTracking.mjs", dir));
  const { selectTotals, setOptimisationLedger } = await import(new URL("store.mjs", dir));
  const records = migrateOptimisations([
    { promptId: "p1", timestamp: 1, assistedOptimisation: true, sourceAnalysisId: "old-analysis", estimatedWaterSavedMl: 2 },
  ], [{ id: "search-1", timestamp: 2 }]);
  assert.equal(records.length, 2);
  assert.equal(records.find((item) => item.kind === "search").estimatedWaterMl, 0);
  store.dispatch(setOptimisationLedger(ledgerFromRecords(records, ["old-analysis"])));
  const totals = selectTotals(store.getState());
  assert.equal(totals.optimisationsMade, 2);
  assert.equal(totals.potentialWaterMl, 2);
  store.dispatch(setOptimisationLedger(ledgerFromRecords([{ id: "new-zero", at: 5, kind: "assisted", sourceAnalysisId: "old-analysis", estimatedWaterMl: 0, estimatedEnergyWh: 0 }], ["old-analysis"])));
  assert.equal(selectTotals(store.getState()).potentialWaterMl, 2);
});

test("repeat submission after a new chat counts a new completed decision", async () => {
  const { PassiveTracker } = await import(new URL("passiveTracking.mjs", dir));
  let model = "gpt-6-high";
  let time = 1000;
  const records = [];
  const tracker = new PassiveTracker(() => model, (item) => records.push(item), () => time);
  for (const route of ["/c/one", "/c/two"]) {
    tracker.observe("Explain photosynthesis to a child.");
    model = "gpt-6-medium";
    tracker.noteManualModelChange();
    tracker.submit("Explain photosynthesis to a child.", route);
    time += 3000;
    model = "gpt-6-high";
  }
  assert.equal(records.length, 2);
  assert.notEqual(records[0].id, records[1].id);
});

test("background migration and retries keep one optimisation event", async () => {
  const data = { ecoAssessmentsV1: [
    { promptId: "already", timestamp: 1, outcome: "efficient", assistedOptimisation: false },
    { promptId: "legacy", timestamp: 2, assistedOptimisation: true, estimatedWaterSavedMl: 1, estimatedEnergySavedWh: 0.1 },
  ] };
  let listener;
  const chrome = {
    action: { onClicked: { addListener() {} } },
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: {
      async get(keys) { return Object.fromEntries(keys.map((key) => [key, data[key]])); },
      async set(value) { Object.assign(data, value); },
      async remove(keys) { for (const key of keys) delete data[key]; },
    } },
  };
  vm.runInNewContext(readFileSync(new URL("../public/background.js", import.meta.url), "utf8"), { chrome });
  const sender = { tab: { id: 1, url: "https://chatgpt.com/c/one" } };
  const record = { id: "new", at: 3, kind: "independent", estimatedWaterMl: 2, estimatedEnergyWh: 0.2 };
  const send = (message) => new Promise((resolve) => listener(message, sender, resolve));
  await send({ type: "ECO_RECORD_OPTIMISATION", optimisation: record });
  await send({ type: "ECO_RECORD_OPTIMISATION", optimisation: record });
  await send({ type: "ECO_RECORD_SEARCH", event: { id: "search", timestamp: 4 } });
  assert.deepEqual(Array.from(data.ecoOptimisationsV1.records, (item) => item.id), ["search", "new", "legacy"]);
  assert.equal(data.ecoAssessmentsV1, undefined);
  assert.equal(data.ecoOptimisationsV1.records[0].estimatedWaterMl, 0);
});

test("running optimisation totals remain cumulative after recent records are capped", async () => {
  const { appendOptimisation, ledgerFromRecords } = await import(new URL("passiveTracking.mjs", dir));
  let ledger = ledgerFromRecords([]);
  for (let n = 0; n < 105; n++) ledger = appendOptimisation(ledger, {
    id: String(n), at: n, kind: "independent", estimatedWaterMl: 1,
    estimatedEnergyWh: 0.1,
  });
  assert.equal(ledger.records.length, 100);
  assert.equal(ledger.count, 105);
  assert.equal(ledger.waterMl, 105);
});
