import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("header theme toggle is accessible and preferences sync between contexts", () => {
  const widget = source("widget.tsx");
  const popup = source("main.tsx");
  const panel = source("panel.tsx");
  assert.match(widget, /role="switch"/);
  assert.match(widget, /aria-checked=\{theme === "dark"\}/);
  assert.match(widget, /Switch to light mode/);
  assert.match(widget, /Switch to dark mode/);
  assert.match(widget, /chrome\.storage\.local\.get\("ecoTheme"\)/);
  assert.match(widget, /chrome\.storage\.local\.set\(\{ ecoTheme: next \}\)/);
  assert.match(widget, /chrome\.storage\.onChanged\.addListener\(onChanged\)/);
  assert.match(widget, /chrome\.storage\.onChanged\.removeListener\(onChanged\)/);
  assert.match(popup, /dataset\.ecoTheme = theme/);
  assert.match(panel, /onThemeChange=\{\(theme\) =>/);
});
test("cooler light mode and dark mode preserve a blue water identity", () => {
  const css = source("widget.css");
  const shell = source("style.css");
  assert.match(css, /background: #f3f7f9/);
  assert.match(shell, /background: #f3f7f9/);
  assert.match(css, /--ocean: #0878ae/);
  assert.doesNotMatch(css, /\.savings-visual::before/); // no ground strip in either theme
  assert.doesNotMatch(css, /#9bc5ad73|#376c59|#3f776e/);
  assert.match(css, /\.eco-app\[data-theme="dark"\]/);
  assert.match(css, /\.eco-app\[data-theme="dark"\] \.savings-visual/);
  assert.match(css, /\.eco-app\[data-theme="dark"\] \.rewrite-text/);
  assert.match(css, /\.eco-app\[data-theme="dark"\] \.assistant-primary/);
  assert.match(css, /\.eco-app\[data-theme="dark"\] \.theme-thumb/);
});

test("Optimise launcher follows the persisted theme without affecting prompt placement", () => {
  const launcher = source("content.tsx");
  assert.match(launcher, /:host\(\[data-theme="dark"\]\) button/);
  assert.match(launcher, /background:#193a4e/);
  assert.match(launcher, /chrome\.storage\.local\.get\("ecoTheme"\)/);
  assert.match(launcher, /chrome\.storage\.onChanged\.addListener\(onThemeChanged\)/);
  assert.match(launcher, /chrome\.storage\.onChanged\.removeListener\(onThemeChanged\)/);
  assert.match(launcher, /host\.dataset\.theme = theme/);
  assert.match(launcher, /rect\.top - host\.offsetHeight - gap/);
  assert.match(launcher, /Optimise/);
});

test("overview hides the assistant shortcut unless ChatGPT has an active draft", () => {
  const overview = source("components/Overview.tsx");
  assert.match(overview, /Boolean\(source\?\.draft\.trim\(\) && prompt\.trim\(\)\)/);
  assert.match(overview, /\{hasActiveDraft && \(/);
  assert.doesNotMatch(overview, /Open Assistant/);
  assert.match(overview, /Review current prompt/);
});

test("overview shows water saved and completed optimisations without bottle progress", () => {
  const overview = source("components/Overview.tsx");
  const visual = source("components/SavingsTank.tsx");
  const css = source("widget.css");
  assert.match(overview, /waterMl=\{totals\.potentialWaterMl\}/);
  assert.match(overview, /optimisationsMade=\{totals\.optimisationsMade\}/);
  assert.match(visual, /EST\. WATER SAVED/);
  assert.match(visual, /OPTIMISATIONS MADE/);
  assert.match(visual, /waterMl > 0 \? "55%" : "0%"/);
  assert.doesNotMatch(overview + visual + css, /getBottleProgress|bottle-tally|BOTTLE_VOLUME_ML|savings-progress/i);
  assert.match(css, /\.savings-optimisations/);
});

test("popup and embedded panel hydrate and follow the saved optimisation ledger", () => {
  for (const file of ["main.tsx", "panel.tsx"]) {
    const contents = source(file);
    assert.match(contents, /savingActions, optimisationLedger, session/);
    assert.match(contents, /hydrate\(\{ \.\.\.session, history, responseHistory, savingActions, optimisationLedger/);
    assert.match(contents, /changes\[optimisationKey\]/);
    assert.match(contents, /setOptimisationLedger\(normaliseLedger\(changes\[optimisationKey\]\.newValue\)\)/);
  }
});
