import { estimateTokens } from "../mockApi";

export interface SearchRecommendation {
  type: "search";
  reason: string;
}

const lookup = /^(?:what (?:is|are|was|were)|who (?:is|was)|when (?:is|was|did)|where (?:is|are|was)|how (?:old|tall|many|much)|find (?:the |a )?(?:website|page|address)|(?:website|official site) (?:for|of))\b/i;
const complex = /\b(?:compare|analyse|analyze|synthesi[sz]e|reason|prove|derive|debug|design|implement|write|create|draft|personal(?:ize|ise)|based on|my |our )\b/i;

/** Cheap local check used only when the user opens Assistant. */
export function searchRecommendation(prompt: string): SearchRecommendation | null {
  const text = prompt.trim();
  return text.length <= 180 && lookup.test(text) && !complex.test(text) && estimateTokens(text) < 45
    ? { type: "search", reason: "A conventional web search may answer this straightforward lookup. Search also uses resources." }
    : null;
}
