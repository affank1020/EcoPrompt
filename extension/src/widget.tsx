import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setPanelOpen, type AppDispatch, type RootState } from './store';
import type { ModelId } from './mockApi';
import { watchSignedIn } from './authState';
import type { SaveResult } from './syncState';

type Props = { onApply: (text: string) => boolean };

const fmt = (value: number) => value < 0.1 ? value.toFixed(3) : value < 10 ? value.toFixed(2) : value.toFixed(1);
const icon = (name: 'leaf' | 'drop' | 'bolt' | 'spark' | 'chevron' | 'check') => {
  const paths = {
    leaf: <><path d="M19 3C9 3 4 8 4 15a5 5 0 0 0 5 5c7 0 12-5 12-15V3z"/><path d="M4 20c2-6 7-9 13-12"/></>,
    drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l0-8z"/>,
    spark: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2z"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

export function Widget({ onApply }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { prompt, status, analysis, panelOpen, error, lastSave } = useSelector((state: RootState) => state.eco);
  const [notice, setNotice] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => watchSignedIn(setSignedIn), []);
  const hasPrompt = prompt.trim().length > 0;
  const recommended = analysis?.models.find(model => model.id === analysis.recommendation);
  const toggle = () => dispatch(setPanelOpen(!panelOpen));

  function apply() {
    if (!analysis) return;
    const success = onApply(analysis.rewrittenPrompt);
    setNotice(success ? 'Applied to your draft — review before sending' : 'Could not update composer. Try copying the text.');
    window.setTimeout(() => setNotice(''), 3600);
  }

  async function copy() {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis.rewrittenPrompt);
      setNotice('Copied rewritten prompt');
    } catch {
      setNotice('Clipboard blocked by browser');
    }
    window.setTimeout(() => setNotice(''), 3000);
  }

  return <section className="eco-root" aria-label="EcoPrompt sustainability assistant">
    <button className={'eco-collapsed' + (panelOpen ? ' eco-expanded-trigger' : '')} onClick={toggle} type="button" aria-expanded={panelOpen}>
      <span className="eco-logo">{icon('leaf')}</span>
      <span className="eco-trigger-name">ecoprompt</span>
      <span className="eco-trigger-separator" />
      {!hasPrompt ? <span className="eco-trigger-detail">Ready when you are</span>
        : status === 'loading' ? <span className="eco-trigger-detail">Analysing…</span>
        : analysis ? <span className="eco-trigger-detail">{analysis.inputTokens} tokens <span className="eco-trigger-dot">·</span> {fmt(analysis.baseline.waterMl)} mL</span>
        : <span className="eco-trigger-detail">{Math.ceil(prompt.length / 4)} tokens</span>}
      <span className={'eco-chevron' + (panelOpen ? ' eco-turn' : '')}>{icon('chevron')}</span>
    </button>

    {panelOpen && <div className="eco-panel">
      <div className="eco-panel-head">
        <div>
          <div className="eco-overline">YOUR AI FOOTPRINT</div>
          <h2>Make every prompt count<span className="eco-period">.</span></h2>
          <p>Find the right model. Use less by design.</p>
        </div>
        <span className="eco-demo-tag"><span className="eco-live-dot" /> DEMO</span>
      </div>

      {!hasPrompt ? <div className="eco-empty">
        <div className="eco-empty-icon">{icon('spark')}</div>
        <h3>Start typing in ChatGPT</h3>
        <p>Your environmental impact preview, model fit, and prompt suggestions will appear here.</p>
      </div> : status === 'loading' || (status === 'idle' && !analysis) ? <div className="eco-loading">
        <div className="eco-skeleton wide" /><div className="eco-skeleton" /><div className="eco-skeleton wide" />
        <p>Estimating impact locally…</p>
      </div> : status === 'error' ? <div className="eco-empty"><h3>Analysis unavailable</h3><p>{error}</p></div>
      : analysis && <div className="eco-panel-body">
        <div className="eco-section-top">
          <span>PROJECTED IMPACT</span><span>Before optimisation</span>
        </div>
        <div className="eco-metrics">
          <div className="eco-metric"><div className="eco-metric-icon blue">{icon('drop')}</div><strong>{fmt(analysis.baseline.waterMl)} <small>mL</small></strong><span>Water estimate</span></div>
          <div className="eco-metric"><div className="eco-metric-icon yellow">{icon('bolt')}</div><strong>{fmt(analysis.baseline.energyWh)} <small>Wh</small></strong><span>Energy estimate</span></div>
          <div className="eco-metric"><div className="eco-metric-icon violet">#</div><strong>{analysis.inputTokens + analysis.predictedOutputTokens}</strong><span>Projected tokens</span></div>
        </div>
        <p className="eco-caption">~{analysis.inputTokens} input + ~{analysis.predictedOutputTokens} predicted output tokens. Values are invented demo estimates, not actual ChatGPT consumption.</p>

        <div className="eco-section-title">
          <div><span className="eco-step">01</span><h3>Right model for the job</h3></div>
          <span className="eco-pill">{analysis.complexity} task</span>
        </div>
        <div className="eco-featured">
          <div className="eco-featured-top"><span>RECOMMENDED</span><span className="eco-match">{recommended?.suitability}% demo fit</span></div>
          <div className="eco-featured-title"><span className="eco-feature-icon">{icon('spark')}</span><div><strong>{recommended?.name}</strong><small>{recommended?.tagline}</small></div><span className="eco-feature-check">{icon('check')}</span></div>
        </div>
        <div className="eco-comparison">
          {analysis.models.map(model => <ModelBar key={model.id} id={model.id} name={model.name} value={model.waterMl} max={Math.max(...analysis.models.map(item => item.waterMl))} recommended={model.id === analysis.recommendation} />)}
        </div>
        <p className="eco-caption">Illustrative water comparison, assuming the same response length for each model. The backend will later supply measured or sourced factors.</p>

        <div className="eco-section-title eco-rewrite-title">
          <div><span className="eco-step">02</span><h3>A leaner prompt</h3></div>
          <span className="eco-pill muted">Draft rewrite</span>
        </div>
        <div className="eco-rewrite">
          <div className="eco-rewrite-label"><span>{icon('spark')} SUGGESTED VERSION</span></div>
          <p>{analysis.rewrittenPrompt}</p>
        </div>
        <div className="eco-actions">
          <button type="button" className="eco-primary" onClick={apply}>Apply to ChatGPT <span>↗</span></button>
          <button type="button" className="eco-secondary" onClick={copy} title="Copy suggested prompt">Copy</button>
        </div>
        <div className="eco-savings">
          <span className="eco-saving-icon">{icon('leaf')}</span>
          <div><strong>Up to {analysis.savingsPercent}% lower estimated water use</strong><small>Mock comparison vs. balanced-model baseline</small></div>
        </div>
      </div>}
      <div className="eco-sync">{syncLine(signedIn, lastSave?.state)}</div>
      <div className="eco-footer"><span>◉ Local mock analysis</span><span>No prompt uploaded</span></div>
      {notice && <div role="status" className="eco-toast">{notice}</div>}
    </div>}
  </section>;
}

function syncLine(signedIn: boolean, state: SaveResult | 'saving' | undefined) {
  if (state === 'saving') return 'Saving…';
  // Only once the row is actually in Supabase.
  if (state === 'saved') return 'Saved to your history ✓';
  if (state === 'queued') return 'Will sync when you\'re back online';
  return signedIn ? 'Prompts you send are saved to your history' : 'Saved on this device · log in from the extension icon to sync';
}

function ModelBar({ id, name, value, max, recommended }: { id: ModelId; name: string; value: number; max: number; recommended: boolean }) {
  return <div className={'eco-model-row' + (recommended ? ' eco-model-selected' : '')}>
    <div className="eco-model-header"><span>{name}{recommended && <em>BEST FIT</em>}</span><span>{fmt(value)} mL</span></div>
    <div className="eco-track"><div className={'eco-track-fill ' + id} style={{ width: (value / Math.max(max, 0.001) * 100) + '%' }} /></div>
  </div>;
}
