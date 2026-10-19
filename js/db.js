// IndexedDB storage. Everything stays in this browser on this device.

const NAME = 'health-records';
const VERSION = 1;
export const STORES = ['reports', 'obs', 'files', 'vaccines'];

let opening;
function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('reports', { keyPath: 'id' });
      db.createObjectStore('obs', { keyPath: 'id' }).createIndex('reportId', 'reportId');
      db.createObjectStore('files', { keyPath: 'id' });
      db.createObjectStore('vaccines', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
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
  return request(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, id) {
  const db = await open();
  return request(db.transaction(store).objectStore(store).get(id));
}

// Applies all changes in one transaction: { put: { store: [items] }, del: { store: [ids] }, clear: [stores] }.
export async function write({ put = {}, del = {}, clear = [] }) {
  const db = await open();
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of clear) tx.objectStore(s).clear();
  for (const [s, ids] of Object.entries(del)) for (const id of ids) tx.objectStore(s).delete(id);
  for (const [s, items] of Object.entries(put)) for (const item of items) tx.objectStore(s).put(item);
  return finished(tx);
}
