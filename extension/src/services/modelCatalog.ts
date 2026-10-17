import type { ModelCatalog } from "./contracts";

// A demo comparison set, not a claim about a particular account's model picker.
// Replace this adapter with account-visible options when a reliable source exists.
export const chatGPTDemoCatalog: ModelCatalog = {
  source: "demo",
  referenceModelId: "gpt-6-high",
  models: [
    { id: "gpt-6-instant", name: "GPT-6 · Instant", family: "gpt-6", effort: "instant" },
    { id: "gpt-6-medium", name: "GPT-6 · Medium", family: "gpt-6", effort: "medium" },
    { id: "gpt-6-high", name: "GPT-6 · High", family: "gpt-6", effort: "high" },
    { id: "gpt-6-extra-high", name: "GPT-6 · Extra High", family: "gpt-6", effort: "extra-high" },
    { id: "gpt-5-6-sol-medium", name: "GPT-5.6 Sol · Medium", family: "gpt-5.6-sol", effort: "medium" },
  ],
};
