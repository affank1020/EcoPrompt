"""Prompt compression engine: LLMLingua-2 plus guard rails.

Pipeline per request:
  1. split out spans that must not be touched (code, URLs, emails, paths, quoted text)
  2. rule-based pass removes greetings / politeness filler (cheap and safe)
  3. LLMLingua-2 prunes the remaining prose
  4. clean up tokenizer spacing artefacts
  5. restore instruction verbs the model dropped (e.g. "Summarise")
  6. verify negations and numbers survived and tokens were actually saved,
     otherwise return the original prompt unchanged
"""
import logging
import os
import re
import threading
import time
from collections import Counter

log = logging.getLogger("compressor")

DEFAULT_MODEL = "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank"

# Fraction of tokens KEPT. Starting values: tune by reading real outputs.
PRESETS = {"light": 0.8, "balanced": 0.65, "aggressive": 0.45}
MIN_WORDS_TOTAL = 15     # shorter prompts are returned unchanged
MIN_WORDS_SEGMENT = 8    # short prose pieces between code/URLs are not sent to the model

# Tokens the model is asked never to drop.
FORCE_TOKENS = ["\n", ".", "?", "!", ",", "'", "not", "no", "never", "only", "must", "without"]

# Losing any of these flips or weakens the meaning -> fall back to the original.
NEGATIONS = {"not", "no", "never", "only", "without", "cannot", "must", "nor",
             "dont", "doesnt", "didnt", "wont", "cant", "isnt", "arent", "shouldnt"}

# Unambiguous task verbs. If the model drops one, it is put back at the start.
INSTRUCTION_WORDS = {"summarise", "summarize", "translate", "explain", "rewrite", "rephrase",
                     "paraphrase", "proofread", "classify", "analyse", "analyze", "describe",
                     "compare", "generate", "calculate", "convert", "debug", "simplify",
                     "shorten", "write", "create", "solve", "improve", "suggest", "recommend"}

_QUOTES = str.maketrans({"\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"'})

# Spans passed through untouched. Exactly ONE capturing group, so re.split puts them at odd indices.
PROTECT = re.compile(
    r"(```.*?```"
    r"|`[^`\n]+`"
    r"|\"[^\"\n]{1,200}\""
    r"|\u201c[^\u201d\n]{1,200}\u201d"
    r"|https?://\S+|www\.\S+"
    r"|[\w.+-]+@[\w-]+\.[\w.-]+"
    r"|\b[\w-]+(?:/[\w.-]+)+\b"
    r"|\b[\w-]+\.(?:py|js|ts|json|csv|txt|md|html|css|ipynb|pdf|docx|xlsx|java|cpp|go|rs|sql|ya?ml)\b)",
    re.S,
)

# Rule-based filler removal (applied to prose only).
FILLER = [re.compile(p, re.I) for p in (
    r"^\s*(?:hi|hello|hey)(?:\s+(?:there|claude|chatgpt))?\s*[,!.]*\s*",
    r"\bi\s+(?:was\s+wondering|wanted\s+to\s+ask)\s+if\s+(?:you\s+(?:could|can|would)\s+)?",
    r"\bi\s+would\s+(?:really\s+)?(?:appreciate|love)\s+it\s+if\s+(?:you\s+(?:could|can|would)\s+)?",
    r"\b(?:please|kindly)\b[ \t]*,?[ \t]*",
    r"[ \t]*\b(?:thanks|thank\s+you)(?:\s+(?:so|very)\s+much)?(?:\s+in\s+advance)?\W*$",
)]


def _norm(word):
    return re.sub(r"[^\w]", "", word.lower())


def _prepass(text):
    for pattern in FILLER:
        text = pattern.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def _clean(s):
    """Undo tokenizer spacing artefacts: '10, 000', '$ 5', "city ' s", stray apostrophes."""
    s = re.sub(r"(\w)[ \t]+'[ \t]*(s|t|re|ve|ll|d|m)\b", r"\1'\2", s)
    s = re.sub(r"(?<!\w)'(?!\w)", "", s)            # apostrophe with no word on either side
    s = re.sub(r"[ \t]+([,.;:!?%)\]])", r"\1", s)
    s = re.sub(r"([(\[$\u00a3\u20ac])[ \t]+", r"\1", s)
    s = re.sub(r"(\d),[ \t]+(\d{3})\b", r"\1,\2", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return re.sub(r"^[ \t!?.,;:]+", "", s)


class _MockLingua:
    """Stand-in model (MOCK_MODEL=1) so the frontend team can run the API without the real model."""
    DROP = {"please", "kindly", "very", "really", "just", "the", "a", "an", "that", "would", "could"}

    def compress_prompt(self, context, rate=0.5, **kwargs):
        words = re.findall(r"\w+|[^\w\s]", " ".join(context))
        return {"compressed_prompt": " ".join(w for w in words if w.lower() not in self.DROP)}


class Compressor:
    def __init__(self, model_name=None):
        self.model_name = model_name or os.getenv("MODEL_PATH", DEFAULT_MODEL)
        self._lock = threading.Lock()          # one inference at a time
        self._count, self.exact_counts = self._make_counter()

        if os.getenv("MOCK_MODEL") == "1":
            log.warning("MOCK_MODEL=1: using the fake compressor, not LLMLingua")
            self._model = _MockLingua()
            return

        threads = os.getenv("TORCH_THREADS")
        if threads:
            import torch
            torch.set_num_threads(int(threads))
        from llmlingua import PromptCompressor
        self._model = PromptCompressor(
            model_name=self.model_name,
            device_map="cpu",
            use_llmlingua2=True,     # keep True: otherwise the library downloads a 7B Llama model
        )

    @staticmethod
    def _make_counter():
        try:
            import tiktoken
            enc = tiktoken.get_encoding("o200k_base")
            return (lambda t: len(enc.encode(t))), True
        except Exception as exc:
            log.warning("tiktoken unavailable (%s): token counts are ROUGH ESTIMATES", exc)
            return (lambda t: max(1, round(len(t) / 4))), False

    def warm_up(self):
        self.compress("Could you please help me write a short and friendly email to my neighbour "
                      "about the noise last night, it was not a big problem but I would like to mention it.")

    def _lingua(self, text, rate):
        kwargs = dict(rate=rate, force_tokens=FORCE_TOKENS, force_reserve_digit=True, drop_consecutive=True)
        try:
            return self._model.compress_prompt([text], **kwargs)["compressed_prompt"]
        except TypeError:                      # library version with different keyword names
            return self._model.compress_prompt([text], rate=rate)["compressed_prompt"]

    @staticmethod
    def _restore_verbs(original, new):
        o_words = original.split()
        have = Counter(_norm(w) for w in new.split())
        need = Counter(_norm(w) for w in o_words)
        restored, seen = [], set()
        for w in o_words:
            n = _norm(w)
            if n in INSTRUCTION_WORDS and n not in seen and have[n] < need[n]:
                restored.append(re.sub(r"^\W+|\W+$", "", w))
                seen.add(n)
        return (" ".join(restored) + " " + new) if restored else new

    @staticmethod
    def _lost_items(original, new):
        o = Counter(_norm(w) for w in original.split())
        n = Counter(_norm(w) for w in new.split())
        neg = sorted(w for w in NEGATIONS if n[w] < o[w])
        num = sorted(set(re.findall(r"\d+", original)) - set(re.findall(r"\d+", new)))
        return neg, num

    def compress(self, prompt, preset="balanced"):
        start = time.perf_counter()
        before = self._count(prompt)

        def result(final, reason, neg=(), num=()):
            fallback = reason != "ok"
            after = before if fallback else self._count(final)
            return {
                "compressed": final, "fallback": fallback, "reason": reason,
                "tokens_before": before, "tokens_after": after, "tokens_saved": before - after,
                "negations_lost": list(neg), "numbers_lost": list(num), "preset": preset,
                "latency_ms": int((time.perf_counter() - start) * 1000),
            }

        if len(prompt.split()) < MIN_WORDS_TOTAL:
            return result(prompt, "too_short")

        out = []
        with self._lock:
            for i, part in enumerate(PROTECT.split(prompt)):
                if i % 2 == 1 or not part.strip():
                    out.append(part)                      # protected span or blank
                    continue
                lead = part[: len(part) - len(part.lstrip())]
                trail = part[len(part.rstrip()):]
                body = _prepass(part.translate(_QUOTES))
                if len(body.split()) >= MIN_WORDS_SEGMENT:
                    body = _clean(self._lingua(body, PRESETS[preset]))
                out.append(lead + body + trail)
        new = self._restore_verbs(prompt, "".join(out)).strip()

        neg, num = self._lost_items(prompt, new)
        if neg or num:
            return result(prompt, "verification_failed", neg, num)
        if self._count(new) >= before:
            return result(prompt, "no_savings")
        return result(new, "ok")
