import { supabase } from './supabase';
import { AUTH_STORAGE_KEY } from './authState';
import { addGuestEstimate, GUEST_STORE_KEY, readGuestEstimates, type StoredEstimate } from './guestStore';
import { SYNC_STATUS_KEY, UPLOAD_QUEUE_KEY, type QueuedEstimate, type SaveResult, type SyncStatus } from './syncState';

// Background worker only: it holds the session and is the only writer of the queue and guest store.

const BATCH_SIZE = 100;
// Same range as webapp/ibmhack/lib/estimation/methodology.ts (LOW_MULTIPLIER / HIGH_MULTIPLIER).
const LOW_MULTIPLIER = 0.5;
const HIGH_MULTIPLIER = 2.5;

// Runs storage read-modify-writes one at a time, so concurrent saves can't drop each other.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => {});
  return run;
}

async function readQueue(): Promise<QueuedEstimate[]> {
  const data = await chrome.storage.local.get(UPLOAD_QUEUE_KEY);
  return Array.isArray(data[UPLOAD_QUEUE_KEY]) ? data[UPLOAD_QUEUE_KEY] as QueuedEstimate[] : [];
}

async function writeQueue(queue: QueuedEstimate[]): Promise<void> {
  await chrome.storage.local.set({ [UPLOAD_QUEUE_KEY]: queue });
}

// The user id of the stored session, even if its access token has expired and can't be
// refreshed right now (offline). null when signed out.
async function storedUserId(): Promise<string | null> {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const raw = data[AUTH_STORAGE_KEY];
  if (typeof raw !== 'string') return null;
  try {
    const id = JSON.parse(raw)?.user?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

async function publishStatus(userId: string | null, failed: boolean): Promise<void> {
  const queue = await readQueue();
  const status: SyncStatus = {
    failed,
    guestUploading: userId ? queue.filter(item => item.userId === userId && item.fromGuest).length : 0,
  };
  await chrome.storage.local.set({ [SYNC_STATUS_KEY]: status });
}

function toRow(item: QueuedEstimate) {
  return {
    id: item.id,
    user_id: item.userId,
    created_at: new Date(item.createdAt).toISOString(),
    site: item.site,
    // The mock's recommended model isn't the model the user actually used.
    model: null,
    source: 'extension',
    prompt_chars: Math.round(item.promptChars),
    tokens: Math.round(item.tokens),
    complexity: item.complexity ?? null,
    water_ml: item.waterMl,
    low_ml: item.waterMl * LOW_MULTIPLIER,
    high_ml: item.waterMl * HIGH_MULTIPLIER,
    energy_wh: item.energyWh,
    energy_low_wh: item.energyWh * LOW_MULTIPLIER,
    energy_high_wh: item.energyWh * HIGH_MULTIPLIER,
    // Compression isn't built yet.
    compressed: false,
    tokens_saved: null,
  };
}

// Postgres data and constraint errors (22xxx, 23xxx): retrying the row would fail the same way.
const isRejectedRow = (code: string | undefined) => Boolean(code && /^2[23]/.test(code));

// Returns the ids that can leave the queue, and whether the rest should be retried later.
async function upload(batch: QueuedEstimate[]): Promise<{ done: string[]; ok: boolean }> {
  // ignoreDuplicates: a retry of a row that already went in is a no-op, not a second row.
  const { error } = await supabase.from('estimates')
    .upsert(batch.map(toRow), { onConflict: 'id', ignoreDuplicates: true });
  if (!error) return { done: batch.map(item => item.id), ok: true };
  if (!isRejectedRow(error.code)) {
    console.warn('EcoPrompt: upload failed, will retry:', error.message);
    return { done: [], ok: false };
  }
  if (batch.length === 1) {
    // Drop it rather than block the rest of the queue forever.
    console.warn('EcoPrompt: the database rejected an estimate, dropping it:', batch[0].id, error.code, error.message);
    return { done: [batch[0].id], ok: true };
  }
  // One bad row fails the whole batch, so send them one at a time to find it.
  const done: string[] = [];
  for (const item of batch) {
    const result = await upload([item]);
    done.push(...result.done);
    if (!result.ok) return { done, ok: false };
  }
  return { done, ok: true };
}

// Sends the signed-in user's queued estimates. Items stay queued until their insert succeeds,
// and items belonging to any other user are left alone.
export function flushQueue(): Promise<void> {
  return locked(async () => {
    if (!(await readQueue()).length) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      // Signed out, or signed in but the session couldn't be refreshed (offline).
      await publishStatus(null, Boolean(await storedUserId()));
      return;
    }
    let failed = false;
    for (;;) {
      const batch = (await readQueue()).filter(item => item.userId === userId).slice(0, BATCH_SIZE);
      if (!batch.length) break;
      const { done, ok } = await upload(batch);
      if (done.length) {
        const sent = new Set(done);
        await writeQueue((await readQueue()).filter(item => !sent.has(item.id)));
      }
      if (!ok) {
        failed = true;
        break;
      }
    }
    await publishStatus(userId, failed);
  });
}

// One new estimate from the content script.
export async function saveEstimate(estimate: StoredEstimate): Promise<SaveResult> {
  const userId = await storedUserId();
  if (!userId) {
    await locked(() => addGuestEstimate(estimate));
    return 'guest';
  }
  await locked(async () => {
    const queue = await readQueue();
    if (!queue.some(item => item.id === estimate.id)) await writeQueue([...queue, { ...estimate, userId }]);
  });
  await flushQueue();
  return (await readQueue()).some(item => item.id === estimate.id) ? 'queued' : 'saved';
}

// Moves every guest estimate into the queue for the user who just signed in, then sends it.
export async function uploadGuestEstimates(): Promise<void> {
  const userId = await storedUserId();
  if (!userId) return;
  await locked(async () => {
    const guest = await readGuestEstimates();
    if (!guest.length) return;
    const queue = await readQueue();
    const queued = new Set(queue.map(item => item.id));
    for (const entry of guest) {
      if (!queued.has(entry.id)) queue.push({ ...entry, userId, fromGuest: true });
    }
    // One write, so an estimate is never in both stores: a later sign-in by someone else
    // can't pick these up again.
    await chrome.storage.local.set({ [UPLOAD_QUEUE_KEY]: queue, [GUEST_STORE_KEY]: [] });
    await publishStatus(userId, false);
  });
  await flushQueue();
}
