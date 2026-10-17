import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Analysis } from './mockApi';
import './style.css';

type Recent = Analysis & { analyzedAt: number };
function App() {
  const [recent, setRecent] = useState<Recent | null>(null);
  useEffect(() => {
    chrome.storage.local.get('ecoLatest', data => {
      if (data.ecoLatest) setRecent(data.ecoLatest as Recent);
    });
  }, []);
  return <main className="popup">
    <header><div className="brand"><span className="brand-mark">✳</span><strong>ecoprompt<span>.</span></strong></div><span className="prototype">BETA · DEMO</span></header>
    <section className="hero"><div className="eyebrow">SMALLER FOOTPRINT, SMARTER PROMPTS</div><h1>Make every<br/>prompt count<span>.</span></h1><p>Understand the potential impact of AI, pick a suitable model, and write leaner requests — right inside ChatGPT.</p><a className="action" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT <span>↗</span></a></section>
    <section className="summary"><div className="section-heading">LAST ANALYSED PROMPT <span>MOCK DATA</span></div>
    {recent ? <><div className="last-prompt">{recent.prompt.slice(0, 145)}{recent.prompt.length > 145 ? '…' : ''}</div><div className="stats"><div><strong>{recent.inputTokens}</strong><span>Input tokens</span></div><div><strong>{recent.baseline.waterMl.toFixed(2)} mL</strong><span>Projected water</span></div><div><strong>{recent.savingsPercent}%</strong><span>Demo potential</span></div></div></> : <div className="blank">Your latest prompt analysis will appear here once you type in ChatGPT.</div>}
    </section><footer><span className="status"><span className="dot"/> ChatGPT integration ready</span><span>100% local demo</span></footer><p className="disclaimer">Impact factors, suitability scores and savings are illustrative placeholders, not measurements of ChatGPT resource use.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
