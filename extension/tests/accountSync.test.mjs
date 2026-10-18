import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = file => readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compile(source('usageStore')), { exports });
const { addUsage, claimGuests, usageRow, validateUsage, MAX_USAGE } = exports;
const estimate = (id = '11111111-1111-4111-8111-111111111111') => ({ id, createdAt: 1700000000000, site: 'chatgpt.com', promptChars: 100, tokens: 178, complexity: 'easy', waterMl: 4, energyWh: .28, model: null, methodology: 'ecoprompt-illustrative-v1' });
const plain = x => JSON.parse(JSON.stringify(x));
test('metadata allowlist excludes prompt text and validates numbers', () => {
  assert.equal(validateUsage({ ...estimate(), prompt: 'private' }).prompt, undefined);
  assert.throws(() => validateUsage({ ...estimate(), tokens: NaN }));
  assert.throws(() => validateUsage({ ...estimate(), site: 'evil.test' }));
});
test('stable IDs, original timestamps, units and no compression savings', () => {
  const rows = addUsage([], estimate(), null);
  assert.equal(addUsage(rows, estimate(), null).length, 1);
  const row = usageRow(claimGuests(rows, 'alice')[0]);
  assert.equal(row.user_id, 'alice'); assert.equal(row.created_at, new Date(estimate().createdAt).toISOString());
  assert.equal(row.water_ml, 4); assert.equal(row.energy_wh, .28); assert.equal(row.tokens_saved, null);
  assert.equal(row.methodology, 'ecoprompt-illustrative-v1');
});
test('claiming guests never transfers another account queue', () => {
  const alice = claimGuests(addUsage([], estimate(), null), 'alice');
  assert.equal(claimGuests(alice, 'bob')[0].userId, 'alice');
});
test('bounded storage never evicts pending or rejected rows', () => {
  const rows = Array.from({ length: MAX_USAGE }, (_, i) => ({ ...estimate(), id: `old-${i}`, userId: 'alice', error: 'rejected' }));
  assert.throws(() => addUsage(rows, estimate(), null), /storage is full/);
  rows[100].uploaded = true;
  const next = addUsage(rows, estimate(), null);
  assert.equal(next.length, MAX_USAGE); assert.ok(!next.some(r => r.id === 'old-100'));
});
async function worker(storage = {}) {
  let session = null; let rejection = null;
  const uploaded = new Map();
  const chrome = { storage: { local: {
    get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, storage[k]])),
    set: async values => Object.assign(storage, structuredClone(values)),
    remove: async key => { delete storage[key]; },
  } }, runtime: { id: 'ext', getURL: () => 'chrome-extension://ext/', onMessage: { addListener() {} } },
  alarms: { get: async () => ({}), create() {}, onAlarm: { addListener() {} } } };
  const supabase = { auth: { getSession: async () => ({ data: { session }, error: null }) },
    from: () => ({ upsert: async row => { if (!rejection) uploaded.set(row.id, row); return { error: rejection }; } }) };
  const context = vm.createContext({ ...exports, chrome, supabase, ACCOUNT_CONFIGURED: true, AUTH_STORAGE_KEY: 'ecoSupabaseAuth', console });
  vm.runInContext(compile(source('accountBackground').replace(/^import .*;\n/gm, '')), context);
  await vm.runInContext('chain', context);
  return { storage, uploaded, setUser(id) { session = id ? { user: { id } } : null; storage.ecoSupabaseAuth = JSON.stringify({ user: { id } }); },
    reject(value) { rejection = value; }, flush: () => vm.runInContext('locked(flush)', context) };
}
test('guest history survives worker restart, retries idempotently, and stays owned', async () => {
  const storage = { ecoUsageV1: plain(addUsage([], estimate(), null)) };
  let w = await worker(storage);
  w.setUser('alice'); w.reject({ code: 'network' }); await w.flush();
  assert.equal(storage.ecoUsageV1[0].userId, 'alice'); assert.equal(storage.ecoUsageV1[0].uploaded, false);
  w = await worker(storage); w.setUser('bob'); await w.flush(); assert.equal(w.uploaded.size, 0);
  w.setUser('alice'); await w.flush(); await w.flush(); assert.equal(w.uploaded.size, 1);
  assert.equal(storage.ecoUsageV1[0].uploaded, true);
});
test('permanent rejection remains visible and recoverable', async () => {
  const storage = { ecoUsageV1: plain(addUsage([], estimate(), null)) };
  const w = await worker(storage); w.setUser('alice'); w.reject({ code: '23514' }); await w.flush();
  assert.match(storage.ecoUsageV1[0].error, /23514/); assert.equal(storage.ecoUsageV1.length, 1);
  w.reject(null); storage.ecoUsageV1[0].rejected = false; await w.flush(); assert.equal(storage.ecoUsageV1[0].uploaded, true);
});
