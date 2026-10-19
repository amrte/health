// Automatic sync through a private GitHub repository. Everything is encrypted on
// the device before upload (sync-core.js); GitHub only stores ciphertext.
//
// Repository layout: meta.json (key derivation parameters, check value),
// data.enc (all records), files/<id>.enc (photos and PDFs, uploaded once).
// On this device: settings 'sync' (repository, token, the derived non-extractable
// key) and 'syncBase' (record fingerprints as of the last sync).

import * as db from './db.js';
import { load } from './store.js';
import { SYNC_STORES, fingerprints, merge, changes, referencedFiles, newMeta, keyFromMeta, encrypt, decrypt, encryptJson, decryptJson, packFile, unpackFile, toB64, fromB64 } from './sync-core.js';

const API = 'https://api.github.com';
const DEBOUNCE_MS = 4000;

// ---- GitHub contents API ---------------------------------------------------------

class SyncError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

async function gh(cfg, path, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`${cfg.apiBase || API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('No connection to GitHub — will try again later.', 'offline');
  }
  if (res.status === 401) throw new SyncError('GitHub refused the token (wrong or expired). Paste a new token in Sync settings.', 'auth');
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') throw new SyncError('GitHub rate limit reached — will try again later.', 'offline');
  if (res.status === 403) throw new SyncError('The token has no write access to this repository (Contents: Read and write).', 'auth');
  return res;
}

const contentsPath = (cfg, file) => `/repos/${cfg.owner}/${cfg.repo}/contents/${file}`;

// { sha, bytes } or null when the file doesn't exist.
async function getFile(cfg, file) {
  const res = await gh(cfg, contentsPath(cfg, file));
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError(`GitHub error ${res.status} reading ${file}.`, 'server');
  const info = await res.json();
  if (info.encoding === 'base64' && info.content) return { sha: info.sha, bytes: fromB64(info.content) };
  // Files over 1 MB come without content; fetch them raw.
  const rawRes = await gh(cfg, contentsPath(cfg, file), { raw: true });
  if (!rawRes.ok) throw new SyncError(`GitHub error ${rawRes.status} reading ${file}.`, 'server');
  return { sha: info.sha, bytes: new Uint8Array(await rawRes.arrayBuffer()) };
}

// Returns the new sha; throws { kind: 'conflict' } if someone else wrote first.
async function putFile(cfg, file, bytes, sha, message) {
  const res = await gh(cfg, contentsPath(cfg, file), { method: 'PUT', body: { message, content: toB64(bytes), ...(sha ? { sha } : {}) } });
  if (res.status === 409 || (res.status === 422 && sha)) throw new SyncError('Changed on another device meanwhile.', 'conflict');
  if (!res.ok) throw new SyncError(`GitHub error ${res.status} saving ${file}.`, 'server');
  return (await res.json()).content?.sha;
}

async function deleteFile(cfg, file, sha) {
  const res = await gh(cfg, contentsPath(cfg, file), { method: 'DELETE', body: { message: `Remove ${file}`, sha } });
  if (!res.ok && res.status !== 404) throw new SyncError(`GitHub error ${res.status} removing ${file}.`, 'server');
}

// Names (ids) and shas of the uploaded files.
async function listFiles(cfg) {
  const res = await gh(cfg, contentsPath(cfg, 'files'));
  if (res.status === 404) return new Map();
  if (!res.ok) throw new SyncError(`GitHub error ${res.status} listing files.`, 'server');
  return new Map((await res.json()).filter((f) => f.name.endsWith('.enc')).map((f) => [f.name.slice(0, -4), f.sha]));
}

// ---- settings on this device -----------------------------------------------------

export const syncConfig = () => db.get('settings', 'sync');
const saveConfig = (cfg) => db.write({ put: { settings: [{ ...cfg, id: 'sync' }] } }, { quiet: true });

// "owner/name", "https://github.com/owner/name(.git)" → { owner, repo }
export function parseRepo(text) {
  const m = String(text ?? '').trim().replace(/\.git$/, '').match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// Checks repository, token and passphrase; creates meta.json in a new repository.
// Stores the derived key, not the passphrase.
export async function connect({ repoText, token, passphrase, confirm = '', apiBase }) {
  const r = parseRepo(repoText);
  if (!r) throw new SyncError('Enter the repository as owner/name, e.g. artem/health-data.', 'input');
  const cfg = { ...r, token: token.trim(), apiBase };
  const res = await gh(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
  if (res.status === 404) throw new SyncError('Repository not found — check the name, and that the token has access to it.', 'input');
  if (!res.ok) throw new SyncError(`GitHub error ${res.status}.`, 'server');
  const info = await res.json();
  if (!info.private) throw new SyncError('This repository is public. Use a private repository for health data.', 'input');
  const meta = await getFile(cfg, 'meta.json');
  let key;
  if (meta) {
    key = await keyFromMeta(JSON.parse(new TextDecoder().decode(meta.bytes)), passphrase);
  } else {
    if (confirm !== passphrase) throw new SyncError('This repository is new: enter the passphrase twice, to be sure it has no typo.', 'input');
    const created = await newMeta(passphrase);
    key = created.key;
    await putFile(cfg, 'meta.json', new TextEncoder().encode(JSON.stringify(created.meta, null, 2)), null, 'Set up encrypted sync');
  }
  await saveConfig({ ...cfg, key, connectedAt: new Date().toISOString(), lastSync: '', lastError: '' });
  await db.write({ del: { settings: ['syncBase'] } }, { quiet: true }); // first sync combines both sides
  return syncNow();
}

export async function disconnect() {
  await db.write({ del: { settings: ['sync', 'syncBase'] } }, { quiet: true });
  emit({ state: 'off' });
}

export async function updateToken(token) {
  const cfg = await syncConfig();
  if (!cfg) return;
  await saveConfig({ ...cfg, token: token.trim(), lastError: '' });
  return syncNow();
}

// ---- status for the UI -----------------------------------------------------------

let status = { state: 'off' };
const listeners = new Set();
function emit(s) {
  status = { ...status, ...s };
  for (const fn of listeners) fn(status);
}
export const syncStatus = () => status;
export function onSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- the sync ------------------------------------------------------------------

async function localSnapshot() {
  const snap = {};
  for (const s of SYNC_STORES) {
    if (s === 'profile') {
      const p = await db.get('settings', 'profile');
      snap.profile = p ? [p] : [];
    } else snap[s] = await db.getAll(s);
  }
  return snap;
}

function writesFor({ put, del }) {
  const out = { put: {}, del: {} };
  for (const [s, items] of Object.entries(put)) {
    if (s === 'profile') out.put.settings = items.map((p) => ({ ...p, id: 'profile' }));
    else out.put[s] = items;
  }
  for (const [s, ids] of Object.entries(del)) {
    if (s === 'profile') out.del.settings = ['profile'];
    else out.del[s] = ids;
  }
  return out;
}

let running = null;
let again = false;

// One sync at a time; a request during a sync runs once more afterwards.
export function syncNow() {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await syncOnce();
        } catch (err) {
          if (err.kind !== 'conflict') throw err; // the other device wrote first: merge again
        }
      }
      throw new SyncError('Couldn’t sync — another device keeps writing. Will try again.', 'offline');
    } catch (err) {
      const cfg = await syncConfig();
      if (cfg) await saveConfig({ ...cfg, lastError: err.message });
      emit({ state: 'error', error: err.message, kind: err.kind });
      return { ok: false, error: err.message };
    } finally {
      running = null;
      if (again) {
        again = false;
        setTimeout(syncNow, 0);
      }
    }
  })();
  return running;
}

async function syncOnce() {
  const cfg = await syncConfig();
  if (!cfg?.key) {
    emit({ state: 'off' });
    return { ok: false };
  }
  emit({ state: 'syncing' });
  const base = (await db.get('settings', 'syncBase'))?.hashes ?? null;
  const local = await localSnapshot();
  const remoteFile = await getFile(cfg, 'data.enc');
  const remote = remoteFile ? (await decryptJson(cfg.key, remoteFile.bytes)).stores : {};
  const { merged, conflicts } = merge(base, local, remote);

  // Photos and PDFs: upload new ones first, so the other device can fetch what data.enc refers to.
  const wanted = referencedFiles(merged);
  const remoteFiles = await listFiles(cfg);
  const localFileIds = new Set(await db.keys('files'));
  for (const id of wanted) {
    if (localFileIds.has(id) && !remoteFiles.has(id)) {
      const rec = await db.get('files', id);
      if (rec?.blob) await putFile(cfg, `files/${id}.enc`, await encrypt(cfg.key, await packFile(rec)), null, 'Add file');
    }
  }

  // Records: upload if the merge differs from what is there.
  const toRemote = changes(remote, merged);
  let dataSha = remoteFile?.sha ?? null;
  if (toRemote.count || !remoteFile) {
    dataSha = await putFile(cfg, 'data.enc', await encryptJson(cfg.key, { v: 1, savedAt: new Date().toISOString(), stores: merged }), dataSha,
      `Sync: ${toRemote.count} change${toRemote.count === 1 ? '' : 's'}`);
  }

  // This device: records, then missing files; files nothing refers to any more are removed.
  const toLocal = changes(local, merged);
  const fetched = [];
  for (const id of wanted) {
    if (!localFileIds.has(id) && remoteFiles.has(id)) {
      const f = await getFile(cfg, `files/${id}.enc`);
      if (f) fetched.push(unpackFile(id, await decrypt(cfg.key, f.bytes)));
    }
  }
  const orphans = [...localFileIds].filter((id) => !wanted.has(id));
  const w = writesFor(toLocal);
  if (toLocal.count || fetched.length || orphans.length) {
    await db.write({ put: { ...w.put, ...(fetched.length ? { files: fetched } : {}) }, del: { ...w.del, ...(orphans.length ? { files: orphans } : {}) } }, { quiet: true });
  }
  for (const [id, sha] of remoteFiles) if (!wanted.has(id)) await deleteFile(cfg, `files/${id}.enc`, sha);

  await db.write({ put: { settings: [{ id: 'syncBase', hashes: fingerprints(merged), dataSha }] } }, { quiet: true });
  const now = new Date().toISOString();
  await saveConfig({ ...(await syncConfig()), lastSync: now, lastError: '' });
  const changed = toLocal.count + fetched.length;
  if (changed) {
    await load();
    window.dispatchEvent(new CustomEvent('health:synced', { detail: { changed } }));
  }
  emit({ state: 'ok', lastSync: now, error: '', changed, conflicts, sent: toRemote.count });
  return { ok: true, received: toLocal.count, sent: toRemote.count, files: fetched.length, conflicts };
}

// ---- automatic sync ------------------------------------------------------------

let timer;
export async function startAutoSync() {
  const cfg = await syncConfig();
  emit(cfg ? { state: cfg.lastError ? 'error' : 'ok', lastSync: cfg.lastSync, error: cfg.lastError } : { state: 'off' });
  // After every change made in the app (sync's own writes are quiet).
  db.onWrite(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (await syncConfig()) syncNow(); }, DEBOUNCE_MS);
  });
  // When the app comes back to the foreground, and when the connection returns.
  const soon = async () => { if ((await syncConfig()) && Date.now() - Date.parse(status.lastSync || 0) > 60000) syncNow(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
  window.addEventListener('online', soon);
  if (cfg) syncNow();
}

