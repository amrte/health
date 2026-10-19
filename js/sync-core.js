// Sync between devices: the data model (what is synced), a three-way merge and
// encryption. Pure functions; js/sync.js does the GitHub transfer.
//
// Each device remembers a fingerprint of every record as of the last sync (the
// "base"). A record changed on one side only takes that side; changed on both,
// the newer edit wins; deleted on one side and unchanged on the other, it is
// deleted. So deletions carry over without tombstones.

export const SYNC_STORES = ['reports', 'obs', 'vaccines', 'measures', 'workouts', 'bp', 'genomes', 'dental', 'meds', 'events', 'profile'];

// ---- fingerprints -----------------------------------------------------------------

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

// 53-bit string hash (cyrb53), enough to tell whether a record changed.
export function hash(value) {
  const s = stable(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// snapshot: { store: [records] } → { store: { id: hash } }
export function fingerprints(snapshot) {
  return Object.fromEntries(SYNC_STORES.map((s) => [s, Object.fromEntries((snapshot[s] ?? []).map((r) => [r.id, hash(r)]))]));
}

// When a record was last changed, for conflicts (both sides edited it).
const stamp = (r) => r?.updated || r?.importedAt || r?.created || '';

// Three-way merge. base: fingerprints at the last sync (null on the first sync:
// then nothing is deleted and both sides are combined). Returns the merged
// snapshot and how many records changed on both sides.
export function merge(base, local, remote) {
  const merged = {};
  let conflicts = 0;
  for (const s of SYNC_STORES) {
    const L = new Map((local[s] ?? []).map((r) => [r.id, r]));
    const R = new Map((remote[s] ?? []).map((r) => [r.id, r]));
    const B = base?.[s] ?? {};
    const out = [];
    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id);
      const r = R.get(id);
      const lh = l ? hash(l) : null;
      const rh = r ? hash(r) : null;
      const bh = base ? (B[id] ?? null) : undefined;
      let pick;
      if (lh === rh) pick = l;
      else if (base && lh === bh) pick = r; // changed (or deleted) only on the other device
      else if (base && rh === bh) pick = l; // changed (or deleted) only here
      else if (!l || !r) pick = l ?? r; // edited on one side, deleted on the other: keep the edit
      else {
        conflicts++;
        pick = stamp(r) > stamp(l) ? r : l;
      }
      if (pick) out.push(pick);
    }
    merged[s] = out;
  }
  return { merged, conflicts };
}

// What to write locally to turn `local` into `merged`: { put: {store: []}, del: {store: [ids]} }.
export function changes(from, to) {
  const put = {};
  const del = {};
  for (const s of SYNC_STORES) {
    const F = new Map((from[s] ?? []).map((r) => [r.id, hash(r)]));
    const T = new Set((to[s] ?? []).map((r) => r.id));
    const p = (to[s] ?? []).filter((r) => F.get(r.id) !== hash(r));
    const d = [...F.keys()].filter((id) => !T.has(id));
    if (p.length) put[s] = p;
    if (d.length) del[s] = d;
  }
  return { put, del, count: Object.values(put).flat().length + Object.values(del).flat().length };
}

export const sameData = (a, b) => changes(a, b).count === 0;

// Photos, PDFs and X-rays the records refer to.
export function referencedFiles(snapshot) {
  const ids = new Set();
  for (const s of ['reports', 'vaccines', 'dental']) for (const r of snapshot[s] ?? []) for (const f of r.files ?? []) if (f?.id) ids.add(f.id);
  return ids;
}

// ---- encryption: PBKDF2-SHA-256 → AES-256-GCM -------------------------------------

export const KDF_ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Non-extractable key: it can be stored on the device but never read back out.
export async function deriveKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// iv (12 bytes) followed by the ciphertext.
export async function encrypt(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}
export async function decrypt(key, data) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12) }, key, data.subarray(12)));
}
export const encryptJson = (key, obj) => encrypt(key, enc.encode(JSON.stringify(obj)));
export const decryptJson = async (key, data) => JSON.parse(dec.decode(await decrypt(key, data)));

// The repository's meta.json: KDF parameters and a check value to verify a passphrase.
const CHECK = 'health-records-sync';
export async function newMeta(passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  return { meta: { app: CHECK, v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toB64(salt) }, check: toB64(await encrypt(key, enc.encode(CHECK))) }, key };
}
export async function keyFromMeta(meta, passphrase) {
  if (meta?.app !== CHECK) throw new Error('This repository holds something else than this app’s sync data.');
  const key = await deriveKey(passphrase, fromB64(meta.kdf.salt), meta.kdf.iterations);
  try {
    if (dec.decode(await decrypt(key, fromB64(meta.check))) === CHECK) return key;
  } catch { /* wrong key */ }
  throw new Error('Wrong passphrase for this repository.');
}

// A stored file (photo, PDF): small JSON header with type and name, then the bytes.
export async function packFile(rec) {
  const head = enc.encode(JSON.stringify({ type: rec.type ?? rec.blob?.type ?? '', name: rec.name ?? '' }));
  const body = new Uint8Array(await rec.blob.arrayBuffer());
  const out = new Uint8Array(4 + head.length + body.length);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  out.set(body, 4 + head.length);
  return out;
}
export function unpackFile(id, bytes) {
  const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0);
  const meta = JSON.parse(dec.decode(bytes.subarray(4, 4 + n)));
  return { id, type: meta.type, name: meta.name, blob: new Blob([bytes.subarray(4 + n)], { type: meta.type }) };
}
