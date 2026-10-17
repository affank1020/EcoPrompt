import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setView, type AppDispatch, type RootState } from "./store";
import { Mark } from "./components/Shared";
import { Overview } from "./components/Overview";
import { Assistant } from "./components/Assistant";
import type { ModelSwitchResult } from "./modelSwitch";
export function Widget({
  onApply,
  onCheckModel,
  onSwitchModel,
  onSearchSelected,
  onClose,
  onThemeChange,
}: {
  onApply?: (text: string) => Promise<boolean>;
  onCheckModel?: (modelId: string) => Promise<ModelSwitchResult>;
  onSwitchModel?: (modelId: string) => Promise<ModelSwitchResult>;
  onSearchSelected?: () => Promise<void>;
  onClose?: () => void;
  onThemeChange?: (theme: "light" | "dark") => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const view = useSelector((s: RootState) => s.eco.view);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Persist theme separately from analysis history so both the popup and
  // embedded panel share the same setting without rewriting savings records.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    let active = true;
    void chrome.storage.local.get("ecoTheme").then(({ ecoTheme }) => {
      if (active && (ecoTheme === "light" || ecoTheme === "dark")) setTheme(ecoTheme);
    }).catch(() => {});
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      const next = changes.ecoTheme?.newValue;
      if (area === "local" && (next === "light" || next === "dark")) setTheme(next);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  useEffect(() => {
    onThemeChange?.(theme);
  }, [theme, onThemeChange]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set({ ecoTheme: next }).catch(() => {});
    }
  }

  return (
    <div className="eco-app" data-theme={theme}>
      <header>
        <button
          className="brand"
          onClick={() => dispatch(setView("overview"))}
          aria-label={
            view === "assistant" ? "Back to Overview" : "EcoPrompt home"
          }
        >
          {view === "assistant" ? (
            <span className="header-back">←</span>
          ) : (
            <span className="brand-mark">
              <Mark />
            </span>
          )}
          <span>ecoprompt</span>
        </button>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            onClick={toggleTheme}
          >
            <span className="theme-thumb" aria-hidden="true">
              {theme === "light" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z"/></svg>
              )}
            </span>
          </button>
          {onClose && <button className="panel-close" aria-label="Close EcoPrompt" onClick={onClose}>×</button>}
        </div>
      </header>
      <main key={view}>
        {view === "overview" ? (
          <Overview />
        ) : (
          <Assistant onApply={onApply} onCheckModel={onCheckModel} onSwitchModel={onSwitchModel} onSearchSelected={onSearchSelected} />
        )}
      </main>
    </div>
  );
}
