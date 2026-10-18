const isChatGPT = (url) =>
  /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url || "");
const isWebPage = (url) => /^https?:\/\//.test(url || "");

async function openPanel(tab, view, toggle, prompt = "") {
  async function fallback() {
    if (view === "assistant" && tab?.id && isChatGPT(tab.url)) {
      await chrome.storage.session.set({
        ecoLaunch: {
          prompt: String(prompt),
          tabId: tab.id,
          url: tab.url,
          createdAt: Date.now(),
        },
      });
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    return { opened: "tab" };
  }
  if (!tab?.id || !isWebPage(tab.url)) {
    return fallback();
  }
  const request = {
    type: "ECO_PANEL_OPEN",
    view: isChatGPT(tab.url) ? view : "overview",
    tabId: tab.id,
    toggle,
  };
  try {
    const result = await chrome.tabs.sendMessage(tab.id, request);
    if (result?.opened === "panel") return result;
  } catch {
    // A page opened before this extension loaded may have no content script yet.
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["panel.js"],
    });
    const result = await chrome.tabs.sendMessage(tab.id, request);
    if (result?.opened === "panel") return result;
  } catch {
    // Restricted pages and pages being navigated cannot host an overlay.
  }
  return fallback();
}

chrome.action.onClicked.addListener((tab) => {
  void openPanel(tab, "overview", true).catch(() => {});
});

const optimisationKey = "ecoOptimisationsV1";
async function appendOptimisation(record) {
  if (!record || typeof record.id !== "string" || !["assisted", "independent", "search"].includes(record.kind)) return;
  const saved = await chrome.storage.local.get([optimisationKey, "ecoAssessmentsV1", "ecoSearchSelectionsV1", "ecoHistoryV4"]);
  const legacyIds = new Set((saved.ecoHistoryV4?.savingActions ?? []).map((item) => item.analysisId));
  let ledger = saved[optimisationKey];
  if (!ledger || Array.isArray(ledger)) {
    let records = Array.isArray(ledger) ? ledger : (Array.isArray(saved.ecoAssessmentsV1) ? saved.ecoAssessmentsV1 : [])
      .filter((item) => item?.promptId && (item.assistedOptimisation || item.independentModelChange))
      .map((item) => ({ id: item.promptId, at: item.timestamp ?? 0,
        kind: item.assistedOptimisation ? "assisted" : "independent",
        sourceAnalysisId: item.sourceAnalysisId, initialModel: item.initialModel,
        submittedModel: item.submittedModel, modelChanged: Boolean(item.independentModelChange ||
          (item.initialModel && item.submittedModel && item.initialModel !== item.submittedModel)),
        rewriteApplied: Boolean(item.rewriteApplied),
        estimatedWaterMl: Math.max(0, item.estimatedWaterSavedMl ?? 0),
        estimatedEnergyWh: Math.max(0, item.estimatedEnergySavedWh ?? 0) }));
    if (!Array.isArray(ledger)) {
      const searches = Array.isArray(saved.ecoSearchSelectionsV1) ? saved.ecoSearchSelectionsV1 : [];
      records.push(...searches.filter((item) => item?.id).map((item) => ({ id: item.id,
        at: item.timestamp ?? 0, kind: "search", estimatedWaterMl: 0, estimatedEnergyWh: 0 })));
      if (!searches.length) records.push(...(Array.isArray(saved.ecoAssessmentsV1) ? saved.ecoAssessmentsV1 : [])
        .filter((item) => item?.promptId && item.searchAlternativeSelected)
        .map((item) => ({ id: `search-${item.promptId}`, at: item.timestamp ?? 0,
          kind: "search", estimatedWaterMl: 0, estimatedEnergyWh: 0 })));
    }
    const seen = new Set();
    records = records.filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id));
    const overlap = {};
    for (const item of records) if (item.sourceAnalysisId && legacyIds.has(item.sourceAnalysisId)) {
      const prior = overlap[item.sourceAnalysisId] ?? { water: 0, energy: 0 };
      prior.water += item.estimatedWaterMl;
      prior.energy += item.estimatedEnergyWh;
      overlap[item.sourceAnalysisId] = prior;
    }
    ledger = { records: records.sort((a, b) => b.at - a.at).slice(0, 100), count: records.length,
      waterMl: records.reduce((sum, item) => sum + item.estimatedWaterMl, 0),
      energyWh: records.reduce((sum, item) => sum + item.estimatedEnergyWh, 0), legacyOverlap: overlap };
  }
  if (!ledger.records.some((item) => item.id === record.id)) {
    ledger = { ...ledger, records: [record, ...ledger.records].sort((a, b) => b.at - a.at).slice(0, 100),
      count: ledger.count + 1, waterMl: ledger.waterMl + record.estimatedWaterMl,
      energyWh: ledger.energyWh + record.estimatedEnergyWh,
      legacyOverlap: { ...ledger.legacyOverlap } };
    if (record.sourceAnalysisId && legacyIds.has(record.sourceAnalysisId)) {
      const prior = ledger.legacyOverlap[record.sourceAnalysisId] ?? { water: 0, energy: 0 };
      ledger.legacyOverlap[record.sourceAnalysisId] = { water: prior.water + record.estimatedWaterMl,
        energy: prior.energy + record.estimatedEnergyWh };
    }
  }
  await chrome.storage.local.set({ [optimisationKey]: ledger });
  await chrome.storage.local.remove(["ecoAssessmentsV1", "ecoSearchSelectionsV1"]);
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "ECO_MARK_ASSISTED" && isChatGPT(sender.tab?.url) && sender.tab?.id) {
    void chrome.tabs.sendMessage(sender.tab.id, message).then(respond).catch(() => respond({ recorded: false }));
    return true;
  }
  if (message?.type === "ECO_RECORD_OPTIMISATION" && isChatGPT(sender.tab?.url)) {
    assessmentQueue = assessmentQueue.then(async () => {
      await appendOptimisation(message.optimisation);
    }).catch(() => {});
    void assessmentQueue.then(() => respond({ recorded: true }));
    return true;
  }
  if (message?.type === "ECO_RECORD_SEARCH" && isChatGPT(sender.tab?.url)) {
    assessmentQueue = assessmentQueue.then(async () => {
      await appendOptimisation({ id: message.event?.id, at: message.event?.timestamp,
        kind: "search", estimatedWaterMl: 0, estimatedEnergyWh: 0 });
    }).catch(() => {});
    void assessmentQueue.then(() => respond({ recorded: true }));
    return true;
  }
  if (message?.type !== "ECO_OPEN" || !isChatGPT(sender.tab?.url)) return;
  void openPanel(sender.tab, "assistant", false, message.prompt)
    .then(respond)
    .catch(() => respond({ opened: false }));
  return true;
});
let assessmentQueue = Promise.resolve();
