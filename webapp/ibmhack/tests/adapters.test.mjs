import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, { mocks = {}, env = {}, fetch } = {}) {
  const output = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
    return { ok: true, json: async () => ({ compressed: 'short' }) };
  } });
  assert.equal(await compress('long prompt'), 'short');
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
