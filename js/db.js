// IndexedDB storage. Everything stays in this browser on this device.

const NAME = 'health-records';
const VERSION = 4;
export const STORES = ['reports', 'obs', 'files', 'vaccines', 'settings', 'measures', 'workouts', 'bp', 'genomes'];

// Some browsers (e.g. Safari for files opened from disk) refuse IndexedDB. The app
// then keeps data in memory for the session and tells the user.
let memory = null;
export function isMemoryOnly() {
  return !!memory;
}
function useMemory() {
  memory = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return null;
}

let opening;
function open() {
  opening ??= Promise.race([openIdb(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))]).catch(useMemory);
  return opening;
}

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available');
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const has = (s) => db.objectStoreNames.contains(s);
      if (!has('reports')) db.createObjectStore('reports', { keyPath: 'id' });
      if (!has('obs')) db.createObjectStore('obs', { keyPath: 'id' }).createIndex('reportId', 'reportId');
      if (!has('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!has('vaccines')) db.createObjectStore('vaccines', { keyPath: 'id' });
      if (!has('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      if (!has('measures')) db.createObjectStore('measures', { keyPath: 'id' });
      if (!has('workouts')) db.createObjectStore('workouts', { keyPath: 'id' });
      if (!has('bp')) db.createObjectStore('bp', { keyPath: 'id' });
      if (!has('genomes')) db.createObjectStore('genomes', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Storage transaction failed'));
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await open();
  if (!db) return [...memory[store].values()];
  return request(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, id) {
  const db = await open();
  if (!db) return memory[store].get(id);
  return request(db.transaction(store).objectStore(store).get(id));
}

// Applies all changes in one transaction: { put: { store: [items] }, del: { store: [ids] }, clear: [stores] }.
export async function write({ put = {}, del = {}, clear = [] }) {
  const db = await open();
  if (!db) {
    for (const st of clear) memory[st].clear();
    for (const [st, ids] of Object.entries(del)) for (const id of ids) memory[st].delete(id);
    for (const [st, items] of Object.entries(put)) for (const item of items) memory[st].set(item.id, structuredClone(item));
    return;
  }
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of clear) tx.objectStore(s).clear();
  for (const [s, ids] of Object.entries(del)) for (const id of ids) tx.objectStore(s).delete(id);
  for (const [s, items] of Object.entries(put)) for (const item of items) tx.objectStore(s).put(item);
  return finished(tx);
}
