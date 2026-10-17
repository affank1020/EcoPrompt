import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  requestAnalysis,
  requestModel,
  requestOptimisation,
  markUsed,
  type AppDispatch,
  type RootState,
} from "../store";
import { savingsOpportunity } from "../services/savingsOpportunity";
import type { ModelSwitchResult } from "../modelSwitch";

export function Assistant({
  onApply,
  onCheckModel,
  onSwitchModel,
  onSearchSelected,
}: {
  onApply?: (text: string) => Promise<boolean>;
  onCheckModel?: (modelId: string) => Promise<ModelSwitchResult>;
  onSwitchModel?: (modelId: string) => Promise<ModelSwitchResult>;
  onSearchSelected?: () => Promise<void>;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    prompt, analysis, status, error, source,
    modelStatus, modelRecommendation, modelError,
    optimisationStatus, optimisation, optimisationError,
    history,
  } = useSelector((s: RootState) => s.eco);
  const [step, setStep] = useState<"impact" | "actions">("impact");
  const [notice, setNotice] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const [modelNotice, setModelNotice] = useState("");
  const [modelAction, setModelAction] = useState<"idle" | "checking" | "switching" | "already" | "success">("idle");
  const [applying, setApplying] = useState(false);
  const impactRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const modelRequestId = useRef(0);
  const applyPending = useRef(false);
  const currentModel = analysis && modelRecommendation?.analysisId === analysis.analysisId
    ? modelRecommendation : null;
  const currentOptimisation = analysis && optimisation?.analysisId === analysis.analysisId
    ? optimisation : null;
  const rewriteApplied = Boolean(analysis && history.some((item) => item.id === analysis.analysisId && item.used));
  const modelApplied = modelAction === "success";

  useEffect(() => {
    if (prompt.trim() && status === "idle") void dispatch(requestAnalysis(prompt));
  }, [dispatch, prompt, status]);
  useEffect(() => {
    if (analysis && (modelStatus === "idle" || (modelStatus === "ready" && !currentModel)))
      void dispatch(requestModel({ prompt, analysisId: analysis.analysisId }));
  }, [analysis, currentModel, dispatch, modelStatus, prompt]);
  useEffect(() => {
    setStep("impact");
    setNotice("");
    setSearchNotice("");
    setModelNotice("");
    setModelAction("idle");
    modelRequestId.current++;
  }, [prompt]);

  const ready = analysis && (Boolean(currentModel) || modelStatus === "error");
  const opportunity = ready && analysis ? savingsOpportunity(analysis, currentModel) : null;
  const searchSuggested = analysis?.searchRecommendation?.type === "search";
  const hasActions = Boolean(analysis);

  function navigate(next: "impact" | "actions") {
    setStep(next);
    const target = next === "impact" ? impactRef.current : actionsRef.current;
    target?.scrollTo({ top: 0 });
    if (next === "actions" && analysis && !currentOptimisation && (optimisationStatus === "idle" || optimisationStatus === "ready")) {
      void dispatch(requestOptimisation({ prompt, analysisId: analysis.analysisId }));
    }
    if (next === "actions" && opportunity?.showModel && currentModel && onCheckModel && source) {
      const requestId = ++modelRequestId.current;
      setModelAction("checking");
      setModelNotice("");
      void onCheckModel(currentModel.recommended.id).then((result) => {
        if (requestId !== modelRequestId.current) return;
        setModelAction(result.state === "already" ? "already" : "idle");
        if (result.state === "error" || result.state === "unavailable") setModelNotice(result.message);
      }).catch(() => {
        if (requestId === modelRequestId.current) { setModelAction("idle"); setModelNotice("Could not check ChatGPT’s model."); }
      });
    }
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }
  async function copy() {
    if (!currentOptimisation) return;
    try {
      await navigator.clipboard.writeText(currentOptimisation.optimisedPrompt);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard unavailable. Select and copy the prompt.");
    }
  }
  async function useRecommendedModel() {
    if (!currentModel || !onSwitchModel || modelAction === "switching") return;
    const requestId = ++modelRequestId.current;
    setModelAction("switching");
    setModelNotice("");
    try {
      const result = await onSwitchModel(currentModel.recommended.id);
      if (requestId !== modelRequestId.current) return;
      setModelAction(result.state === "already" ? "already" : result.state === "selected" ? "success" : "idle");
      setModelNotice(result.state === "selected" || result.state === "already" ? "" : result.message);
    } catch {
      if (requestId === modelRequestId.current) { setModelAction("idle"); setModelNotice("Could not change the model in ChatGPT."); }
    }
  }
  async function apply() {
    if (!currentOptimisation || !onApply || rewriteApplied || applyPending.current) return;
    applyPending.current = true;
    setApplying(true);
    try {
      const okay = await onApply(currentOptimisation.optimisedPrompt);
      if (okay) dispatch(markUsed());
      setNotice(okay ? "Draft replaced. Any saving is credited only if you submit it." : "The ChatGPT draft changed. Copy the suggestion instead.");
    } catch {
      setNotice("Could not reach ChatGPT. Copy the suggestion instead.");
    } finally {
      applyPending.current = false;
      setApplying(false);
    }
  }
  const model = currentModel?.recommended;
  function openSearch() {
    const query = prompt.trim().replace(/[?!.]+$/, "");
    if (source) void onSearchSelected?.().catch(() => {});
    window.open(`https://www.google.com/search?${new URLSearchParams({ q: query })}`, "_blank", "noopener,noreferrer");
    setSearchNotice("Search opened. No AI saving has been credited.");
  }
  const promptPreview = prompt.trim().replace(/\s+/g, " ");
  return (
    <div className={`assistant-flow ${step === "actions" ? "show-actions" : ""}`}>
      <div className="assistant-track">
        <div className="assistant-page" ref={impactRef} tabIndex={-1} aria-hidden={step !== "impact"} inert={step !== "impact"}>
          {!prompt.trim() ? (
            <div className="assistant-empty"><strong>No prompt yet</strong><span>Type in ChatGPT, then open EcoPrompt from its composer.</span></div>
          ) : (
            <>
              <div className="impact-eyebrow">{analysis ? "ANALYSED PROMPT" : "ANALYSING THIS PROMPT"}</div>
              <div className="prompt-preview" title={promptPreview}>{promptPreview}</div>
              <div className="impact-metrics" aria-label="Estimated prompt impact">
                <div><span>Water</span><strong>{analysis ? `${analysis.estimates.waterMl.toFixed(2)} mL` : error ? "—" : <i className="impact-skeleton" aria-hidden="true" />}</strong></div>
                <div><span>Energy</span><strong>{analysis ? `${analysis.estimates.energyWh.toFixed(3)} Wh` : error ? "—" : <i className="impact-skeleton" aria-hidden="true" />}</strong></div>
              </div>
              {error ? <div className="compact-error" role="alert">{error} <button onClick={() => void dispatch(requestAnalysis(prompt))}>Retry</button></div> : null}
              {!error && !opportunity ? (
                <div className="opportunity-pending" role="status" aria-live="polite"><span className="loading-ripple" aria-hidden="true"><i /><i /><i /></span><strong>{analysis ? "Comparing savings" : "Estimating impact"}</strong><span>Finding the best saving for this prompt…</span></div>
              ) : opportunity && hasActions ? (
                <>
                  {searchSuggested ? <section className="opportunity-hero"><span className="opportunity-kicker">SEARCH ALTERNATIVE</span><p>A direct source may answer this lookup without a generated reply.</p></section> : opportunity.best ? <section className="opportunity-hero" aria-label="Savings opportunity">
                    <span className="opportunity-kicker">YOUR SAVINGS OPPORTUNITY</span>
                    <div className="opportunity-number">Up to <strong>{opportunity.percent}%</strong></div>
                    <div className="opportunity-water" aria-hidden="true"><span style={{ width: `${Math.max(7, 100 - opportunity.percent)}%` }} /></div>
                    <p>You could save around <strong>{opportunity.waterMl.toFixed(2)} mL water</strong> and <strong>{opportunity.energyWh.toFixed(3)} Wh</strong> with one suggested change.</p>
                  </section> : <div className="opportunity-empty"><strong>Explore your options</strong><p>Preview a simpler prompt and choose what works for you.</p></div>}
                  <button className="assistant-primary" onClick={() => navigate("actions")}>Show me how <span aria-hidden="true">→</span></button>
                </>
              ) : modelError ? (
                <div className="compact-error" role="alert">{modelError} <button onClick={() => analysis && void dispatch(requestModel({ prompt, analysisId: analysis.analysisId }))}>Retry</button></div>
              ) : opportunity ? (
                <div className="opportunity-empty"><strong>Looking good already</strong><p>We found no meaningful saving for this prompt in the current demo estimates.</p></div>
              ) : null}
              <p className="assistant-disclaimer">Illustrative estimates, not measured ChatGPT usage.</p>
            </>
          )}
        </div>
        <div className="assistant-page" ref={actionsRef} tabIndex={-1} aria-hidden={step !== "actions"} inert={step !== "actions"}>
          <button className="assistant-back" onClick={() => navigate("impact")}>← <span>Back to impact</span></button>
          <h1 className="actions-title">Make a lighter choice</h1>
          <p className="actions-intro">Choose what helps. Your water total grows after you send an improved prompt.</p>
          {searchSuggested && <section className="action-item"><div className="action-heading"><span className="action-icon" aria-hidden="true">⌕</span><div><span className="action-kicker">SKIP THE AI REPLY</span><h2>Find the answer directly</h2></div></div><p>A web result may answer this simple lookup faster, without generating a ChatGPT reply.</p><div className="action-benefit">Direct source · no AI reply</div><button className="outline-button" onClick={openSearch}>Open search results <span aria-hidden="true">↗</span></button>{searchNotice && <div className="action-notice" role="status">{searchNotice}</div>}</section>}
          {opportunity?.showModel && currentModel && model && (
            <section className={`action-item ${modelApplied ? "action-applied" : ""}`}>
              <div className="action-heading"><span className="action-icon" aria-hidden="true">↘</span><div><span className="action-kicker">RIGHT SIZE THE MODEL</span><h2>Switch to {model.name}</h2></div></div>
              <p>This task may need less computing power. A lighter model can reduce the estimated impact of your next reply, compared with demo reference {currentModel.baseline.name}.</p>
              <div className="action-benefit">Up to ~{model.potentialWaterSavingsMl.toFixed(2)} mL water · ~{model.potentialEnergySavingsWh.toFixed(3)} Wh energy</div>
              <div className="model-action-row">{modelApplied ? <span className="model-confirmation" role="status"><span className="applied-check">✓</span> Model selected</span> : modelAction === "already" ? <span className="model-confirmation" role="status">Already using this model</span> : <button className="solid-button" disabled={!source || !onSwitchModel || modelAction === "checking" || modelAction === "switching"} onClick={() => void useRecommendedModel()}>{modelAction === "checking" ? "Checking model…" : modelAction === "switching" ? "Switching…" : "Switch model →"}</button>}</div>
              {modelApplied && <div className="pending-water" role="status"><span className="pending-water-vessel" aria-hidden="true"><span className="pending-water-fill" /><span className="pending-water-drop" /></span>Nice choice. Send your prompt to add any verified saving to your water total.</div>}
              {modelNotice && <div className="action-notice" role="status">{modelNotice}</div>}
            </section>
          )}
          {analysis && (
            <section className={`action-item ${rewriteApplied ? "action-applied" : ""}`}>
              <div className="action-heading"><span className="action-icon" aria-hidden="true">✦</span><div><span className="action-kicker">MOCK PREVIEW</span><h2>Replace with a focused prompt</h2></div></div>
              <p>A shorter request keeps your intent while using fewer input tokens. Review it before replacing your draft.</p>
              {opportunity?.showRewrite && analysis.rewriteOpportunity && <div className="action-benefit">Up to ~{analysis.rewriteOpportunity.potentialWaterSavingsMl.toFixed(2)} mL water · ~{analysis.rewriteOpportunity.potentialEnergySavingsWh.toFixed(3)} Wh energy</div>}
              {optimisationStatus === "loading" || optimisationStatus === "idle" ? <div className="rewrite-text rewrite-placeholder" role="status">Your mock rewrite will appear here…</div> : optimisationError ? <div className="compact-error" role="alert">{optimisationError} <button onClick={() => analysis && void dispatch(requestOptimisation({ prompt, analysisId: analysis.analysisId }))}>Retry</button></div> : currentOptimisation && currentOptimisation.optimisedPrompt !== prompt.trim() ? (
                <>
                  <div className="rewrite-label">SUGGESTED REPLACEMENT</div>
                  <div className="rewrite-text" tabIndex={0}>{currentOptimisation.optimisedPrompt}</div>
                  <div className="rewrite-actions">{rewriteApplied ? <span className="model-confirmation" role="status"><span className="applied-check">✓</span> Draft replaced</span> : source && onApply && <button className="solid-button" disabled={applying} onClick={() => void apply()}>{applying ? "Replacing…" : "Replace draft →"}</button>}<button className={source && onApply ? "outline-button" : "solid-button"} onClick={() => void copy()}>Copy</button></div>
                  {rewriteApplied && <div className="pending-water" role="status"><span className="pending-water-vessel" aria-hidden="true"><span className="pending-water-fill" /><span className="pending-water-drop" /></span>Ready to collect. Send the rewritten prompt to add any verified saving to your water total.</div>}
                  {notice && <div className="action-notice" role="status">{notice}</div>}
                </>
              ) : <div className="rewrite-text rewrite-placeholder"><strong>Example mock replacement</strong><span>“Could you please give me a quick summary of this article?”</span><span>→ “Summarise this article in 3 bullets.”</span><small>Your draft is already concise in this mock, so there is no replacement to apply yet.</small></div>}
            </section>
          )}
          {modelError && !opportunity?.showModel && <div className="compact-error" role="alert">{modelError} <button onClick={() => analysis && void dispatch(requestModel({ prompt, analysisId: analysis.analysisId }))}>Retry</button></div>}
          <p className="actions-footnote">Illustrative estimates. Changes can overlap, so totals are counted only after a qualifying submission.</p>
        </div>
      </div>
    </div>
  );
}
