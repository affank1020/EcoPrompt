import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, { mocks = {}, env = {}, fetch } = {}) {
  const output = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: id => mocks[id] ?? require(id), process: { env }, fetch, AbortSignal });
  return exports;
}
test('analyse adapter maps real backend contract without inventing energy', async () => {
  let request;
  const { estimate } = load('lib/estimation/client.ts', { env: { BACKEND_API_URL: 'http://backend/' }, mocks: { './mock': {} }, fetch: async (...args) => {
    request = args;
    return { ok: true, json: async () => ({ tokens: 7, water_cost: .02, energy_cost: .03 }) };
  } });
  const result = await estimate('hello', 'model');
  assert.equal(request[0], 'http://backend/analyse');
  assert.deepEqual(JSON.parse(request[1].body), { prompt: 'hello', epsilon: .5 });
  assert.equal(result.energyWh, .03);
  assert.equal(result.methodology, 'backend-token-v1');
});
test('missing URL is explicitly mocked, configured failures are not', async () => {
  const mocks = { './mock': { mockEstimate: () => ({ methodology: 'website-mock-v1' }) } };
  assert.equal((await load('lib/estimation/client.ts', { mocks }).estimate('a', 'm')).methodology, 'website-mock-v1');
  for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ tokens: 1, water_cost: 2 }) }]) {
    await assert.rejects(load('lib/estimation/client.ts', { mocks, env: { BACKEND_API_URL: 'http://backend' }, fetch: async () => response }).estimate('a', 'm'));
  }
});
test('compression adapter sends supported preset', async () => {
  let request;
  const { compress } = load('lib/compression/client.ts', { mocks: { './mock': {} }, env: { BACKEND_API_URL: 'http://backend' }, fetch: async (url, options) => {
    request = { url, payload: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ compressed: 'short', preset: 'balanced', reason: 'ok', fallback: false, tokens_before: 3, tokens_after: 1, tokens_saved: 2, latency_ms: 4, negations_lost: [], numbers_lost: [] }) };
  } });
  const result = await compress('long prompt');
  assert.equal(result.compressed, 'short');
  assert.equal(result.details.tokensSaved, 2);
  assert.deepEqual(request, { url: 'http://backend/compress', payload: { prompt: 'long prompt', preset: 'balanced' } });
});
test('redirect destinations accept local paths and reject external URL tricks', () => {
  const { safeNext } = load('lib/auth/index.ts', { mocks: { '../supabase/server': {} } });
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test', null]) assert.equal(safeNext(value), '/dashboard');
  assert.equal(safeNext('/dashboard/history?page=2'), '/dashboard/history?page=2');
});

test('history delegates filtering, stable sorting and bounded pagination to user-scoped queries', async () => {
  const calls = [];
  const client = { from(table) {
    const chain = { then(resolve) { return Promise.resolve({ data: [], count: 45, error: null }).then(resolve); } };
    for (const method of ['select', 'eq', 'is', 'order', 'range']) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
    calls.push(['from', table]);
    return chain;
  } };
  const { getEstimates } = load('lib/data/estimates.ts', { mocks: {
    'next/server': { connection: async () => {} }, '../auth': { getCurrentUser: async () => ({ id: 'mine', isAnonymous: false }) },
    '../supabase/server': { createClient: async () => client }, './dates': {},
  } });
  const page = await getEstimates({ sort: 'energy', dir: 'asc', page: 999, pageSize: 20, site: 'ChatGPT', model: 'Unknown' });
  assert.equal(page.page, 3);
  assert.equal(page.pageCount, 3);
  assert.equal(calls.filter(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'mine').length, 2);
  assert.ok(calls.some(c => c[0] === 'range' && c[1] === 40 && c[2] === 59));
  assert.ok(calls.some(c => c[0] === 'order' && c[1] === 'energy_wh'));
  assert.ok(calls.some(c => c[0] === 'order' && c[1] === 'id'));
  assert.ok(calls.some(c => c[0] === 'is' && c[1] === 'model' && c[2] === null));
});

test('leaderboard enforces ten-prompt ranking threshold and handles an empty RPC', async () => {
  let rows = [
    { user_id: 'a', username: 'alice', prompts: 9, avg_ml: 1, total_ml: 9, total_wh: 2 },
    { user_id: 'b', username: 'bob', prompts: 10, avg_ml: 2, total_ml: 20, total_wh: 3 },
  ];
  const { getWeeklyLeaderboard } = load('lib/data/leaderboard.ts', { mocks: {
    'next/server': { connection: async () => {} }, '../auth': { getCurrentUser: async () => ({ id: 'a', isAnonymous: false }) },
    '../supabase/server': { createClient: async () => ({ rpc: async name => { assert.equal(name, 'weekly_leaderboard_v1'); return { data: rows }; } }) },
    '../estimation/models': {}, './dates': { DAY_MS: 86400000 }, './estimates': {},
  } });
  const board = await getWeeklyLeaderboard();
  assert.equal(board.entries[0].user.id, 'b');
  assert.equal(board.entries[0].rank, 1);
  assert.equal(board.entries[1].rank, null);
  assert.equal(board.entries[1].isCurrentUser, true);
  rows = [];
  assert.equal((await getWeeklyLeaderboard()).entries.length, 0);
});

const estimateRow = { model: 'display-model', methodology: 'backend-token-v1', tokens: 7, complexity: 'easy', waterMl: 2, lowMl: 2, highMl: 2, energyWh: 3 };
function historyStore({ user = { id: 'current-user' }, authError = null, insertError = null, throws = false } = {}) {
  const inserted = [];
  const { saveEstimates } = load('lib/data/saveEstimates.ts', { mocks: {
    '../estimation/methodology': { LOW_MULTIPLIER: .5, HIGH_MULTIPLIER: 2.5 },
    '../supabase/server': { createClient: async () => {
      if (throws) throw new Error('unavailable');
      return { auth: { getUser: async () => ({ data: { user }, error: authError }) }, from: table => {
        assert.equal(table, 'estimates');
        return { insert: async rows => { inserted.push(...rows); return { error: insertError }; } };
      } };
    } },
  } });
  return { saveEstimates, inserted };
}
test('history persists only authenticated metadata, source and exact backend methodology', async () => {
  const { saveEstimates, inserted } = historyStore();
  assert.equal(await saveEstimates(['private prompt'], [estimateRow], 'web'), 'saved');
  assert.deepEqual(JSON.parse(JSON.stringify(inserted)), [{
    user_id: 'current-user', site: 'HydroPrompt', source: 'web', model: null, methodology: 'backend-token-v1',
    prompt_chars: 14, tokens: 7, complexity: 'easy', water_ml: 2, low_ml: 2, high_ml: 2,
    energy_wh: 3, energy_low_wh: 3, energy_high_wh: 3, compressed: false, tokens_saved: null,
  }]);
  assert.ok(!JSON.stringify(inserted).includes('private prompt'));
});
test('bulk persistence preserves duplicates and mock methodology without crediting savings', async () => {
  const { saveEstimates, inserted } = historyStore();
  const mock = { ...estimateRow, methodology: 'website-mock-v1' };
  assert.equal(await saveEstimates(['a', 'a'], [mock, mock], 'bulk'), 'saved');
  assert.equal(inserted.length, 2);
  for (const row of inserted) {
    assert.equal(row.methodology, 'website-mock-v1'); assert.equal(row.model, 'display-model');
    assert.equal(row.energy_low_wh, 1.5); assert.equal(row.energy_high_wh, 7.5);
    assert.equal(row.source, 'bulk'); assert.equal(row.compressed, false); assert.equal(row.tokens_saved, null);
  }
});
test('signed-out and anonymous visitors never write history; errors are explicit and nonfatal', async () => {
  for (const settings of [{ user: null }, { user: { id: 'guest', is_anonymous: true } }, { user: null, authError: { name: 'AuthSessionMissingError' } }]) {
    const { saveEstimates, inserted } = historyStore(settings);
    assert.equal(await saveEstimates(['a'], [estimateRow], 'web'), 'signed-out'); assert.equal(inserted.length, 0);
  }
  for (const settings of [{ authError: { name: 'InvalidJWT' } }, { insertError: { message: 'RLS denied' } }, { throws: true }]) {
    assert.equal(await historyStore(settings).saveEstimates(['a'], [estimateRow], 'web'), 'failed');
  }
});
test('persistence rejects unknown methods, missing energy and misaligned batches', async () => {
  const { saveEstimates, inserted } = historyStore();
  for (const row of [{ ...estimateRow, methodology: 'ecoprompt-illustrative-v1' }, { ...estimateRow, energyWh: undefined }, { ...estimateRow, tokens: 2.5 }]) {
    assert.equal(await saveEstimates(['a'], [row], 'web'), 'failed');
  }
  assert.equal(await saveEstimates([], [estimateRow], 'bulk'), 'failed'); assert.equal(inserted.length, 0);
});
test('bulk uses one request for 200 ordered results with input-token accounting', async () => {
  let requests = 0;
  const prompts = Array.from({ length: 200 }, (_, i) => `prompt ${i % 5}`);
  const { estimateMany } = load('lib/estimation/client.ts', { env: { BACKEND_API_URL: 'http://backend/' }, mocks: { './mock': {} }, fetch: async (url, options) => {
    requests++; assert.equal(url, 'http://backend/analyse/bulk');
    assert.deepEqual(JSON.parse(options.body), { prompts, epsilon: .5 }); assert.ok(!('X-API-Key' in options.headers));
    return { ok: true, json: async () => ({ count: 200, results: prompts.map((prompt, i) => ({ prompt, tokens: i, label: 'hard', water_cost: 100, energy_cost: 2 })) }) };
  } });
  const results = await estimateMany(prompts, 'model');
  assert.equal(requests, 1); assert.equal(results.length, 200); assert.equal(results[199].tokens, 199);
  assert.equal(results[0].methodology, 'backend-token-v1'); assert.equal(results[0].complexity, 'hard');
});
test('bulk rejects truncated, reordered and malformed responses; local mocks stay explicit', async () => {
  const row = { prompt: 'a', tokens: 1, water_cost: 1, energy_cost: 1 };
  for (const body of [null, { count: 0, results: [] }, { count: 1, results: [{ ...row, prompt: 'other' }] }, { count: 1, results: [{ ...row, energy_cost: null }] }, { count: 1, results: [null] }]) {
    const { estimateMany } = load('lib/estimation/client.ts', { env: { BACKEND_API_URL: 'http://backend' }, mocks: { './mock': {} }, fetch: async () => ({ ok: true, json: async () => body }) });
    await assert.rejects(estimateMany(['a'], 'm'));
  }
  const { estimateMany } = load('lib/estimation/client.ts', { mocks: { './mock': { mockEstimate: n => ({ tokens: n, methodology: 'website-mock-v1' }) } } });
  assert.equal((await estimateMany(['a', 'bb'], 'm'))[1].tokens, 2);
});
function analysisActions({ history = 'saved', fail = false } = {}) {
  const calls = [];
  const actions = load('lib/estimation/actions.ts', { mocks: {
    'next/cache': { refresh: () => calls.push('refresh') },
    '../data/saveEstimates': { saveEstimates: async (prompts, rows, source) => { calls.push(['save', prompts.length, rows.length, source]); return history; } },
    './models': { isKnownModel: model => model === 'valid' },
    './client': {
      estimate: async () => { calls.push('single'); return estimateRow; },
      estimateMany: async prompts => { calls.push('bulk'); if (fail) throw new Error('bad response'); return prompts.map(() => estimateRow); },
    },
  } });
  return { actions, calls };
}
test('actions save once and refresh only successful inserts; history errors retain results', async () => {
  const { actions, calls } = analysisActions();
  assert.equal((await actions.checkPrompt('a', 'valid')).history, 'saved');
  assert.equal((await actions.estimatePrompts(['a', 'b'], 'valid')).results.length, 2);
  assert.deepEqual(calls, ['single', ['save', 1, 1, 'web'], 'refresh', 'bulk', ['save', 2, 2, 'bulk'], 'refresh']);
  const failed = analysisActions({ history: 'failed' });
  assert.equal((await failed.actions.checkPrompt('a', 'valid')).result.tokens, 7); assert.ok(!failed.calls.includes('refresh'));
  const malformed = analysisActions({ fail: true });
  await assert.rejects(malformed.actions.estimatePrompts(['a'], 'valid')); assert.deepEqual(malformed.calls, ['bulk']);
});
test('action validation rejects bad input before backend or history calls', async () => {
  const { actions, calls } = analysisActions();
  for (const prompts of [[], ['a'.repeat(50001)], [' '], Array(201).fill('a'), [42], null]) await assert.rejects(actions.estimatePrompts(prompts, 'valid'));
  await assert.rejects(actions.checkPrompt('a', 'invalid')); await assert.rejects(actions.checkPrompt(' ', 'valid')); assert.equal(calls.length, 0);
});
const compressionResponse = { compressed: 'short', preset: 'balanced', reason: 'ok', fallback: false, tokens_before: 5, tokens_after: 2, tokens_saved: 3, latency_ms: 1, negations_lost: [], numbers_lost: [] };
test('all compression presets and fallback reasons map existing backend response', async () => {
  for (const preset of ['light', 'balanced', 'aggressive']) for (const reason of ['ok', 'too_short', 'no_savings', 'verification_failed']) {
    const fallback = reason !== 'ok';
    const payload = { ...compressionResponse, preset, reason, fallback, ...(fallback ? { compressed: 'original', tokens_after: 5, tokens_saved: 0, negations_lost: ['not'], numbers_lost: ['42'] } : {}) };
    const { compress } = load('lib/compression/client.ts', { mocks: { './mock': {} }, env: { BACKEND_API_URL: 'http://backend' }, fetch: async (url, options) => {
      assert.equal(JSON.parse(options.body).preset, preset); return { ok: true, json: async () => payload };
    } });
    const result = await compress('original', preset);
    assert.equal(result.details.reason, reason); assert.equal(result.details.fallback, fallback); assert.equal(result.details.tokensSaved, fallback ? 0 : 3);
  }
});
test('compression rejects invalid metadata and configured failures; mocks have no fabricated token counts', async () => {
  for (const response of [{ ok: false, status: 503 }, ...[null, {}, { ...compressionResponse, tokens_saved: 99 }, { ...compressionResponse, fallback: true }, { ...compressionResponse, tokens_before: -1 }].map(body => ({ ok: true, json: async () => body }))]) {
    const { compress } = load('lib/compression/client.ts', { mocks: { './mock': {} }, env: { BACKEND_API_URL: 'http://backend' }, fetch: async () => response });
    await assert.rejects(compress('original'));
  }
  const { compress } = load('lib/compression/client.ts', { mocks: { './mock': { mockCompress: () => 'short' } } });
  const result = await compress('original', 'light');
  assert.equal(result.details.mode, 'local-mock'); assert.equal(result.details.tokensBefore, null); assert.equal(result.details.reason, 'local_mock');
});
test('compression actions validate presets and retain fallback details without saving previews', async () => {
  const calls = [];
  const { compressPrompt } = load('lib/compression/actions.ts', { mocks: {
    '../estimation/client': { estimate: async prompt => { calls.push(['estimate', prompt]); return estimateRow; } },
    '../estimation/models': { isKnownModel: () => true },
    './client': { compress: async (prompt, preset) => { calls.push(['compress', preset]); return { compressed: prompt, details: { reason: 'too_short' } }; } },
  } });
  for (const args of [['a', 'm', 'wrong'], ['', 'm'], ['x'.repeat(20001), 'm']]) await assert.rejects(compressPrompt(...args));
  assert.equal(calls.length, 0);
  const result = await compressPrompt('original', 'm', 'aggressive');
  assert.equal(result.details.reason, 'too_short'); assert.equal(result.original, result.optimised);
  assert.deepEqual(calls, [['compress', 'aggressive'], ['estimate', 'original']]);
});

test('compression panel explains every fallback and renders shortened text even without resource savings', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: Panel } = load('components/checker/CompressionPanel.tsx', { mocks: {
    '../ui/format': { formatMl: n => `${n} mL`, formatNumber: String }, './CompressionPanel.module.scss': { default: {} },
  } });
  for (const [reason, text] of [['too_short', 'minimum length'], ['no_savings', 'did not reduce'], ['verification_failed', 'lost a negation'], ['local_mock', 'Local mock compressor']]) {
    const result = { original: estimateRow, optimised: estimateRow, compressed: 'original', details: { preset: 'balanced', reason, tokensBefore: null, negationsLost: [], numbersLost: [] } };
    const html = renderToStaticMarkup(React.createElement(Panel, { original: 'original', result, onUse() {}, onDismiss() {} }));
    assert.ok(html.includes(text));
  }
  const result = { original: estimateRow, optimised: { ...estimateRow, waterMl: 3 }, compressed: 'short', details: { preset: 'light', reason: 'ok', tokensBefore: 5, tokensAfter: 2, tokensSaved: 3, latencyMs: 1, negationsLost: [], numbersLost: [] } };
  const html = renderToStaticMarkup(React.createElement(Panel, { original: 'original', result, onUse() {}, onDismiss() {} }));
  assert.ok(html.includes('no estimated water reduction'));
  assert.ok(html.includes('Use compressed prompt'));
});
