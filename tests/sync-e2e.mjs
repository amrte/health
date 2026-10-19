// Two devices syncing through a mock of the GitHub contents API: first sync,
// changes in both directions, deletions, photos, wrong passphrase, public repo.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { serve } from '../scripts/serve.mjs';

const TOKEN = 'test-token';
const files = new Map(); // path → { bytes, sha }
let writes = 0;

function mockGitHub() {
  return http.createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS' };
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { ...cors, ...headers });
      res.end(body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'Bad credentials' });
    const url = new URL(req.url, 'http://x');
    const repo = url.pathname.match(/^\/repos\/me\/([\w-]+)$/);
    if (repo) return repo[1] === 'health-data' || repo[1] === 'public-repo' ? send(200, { private: repo[1] === 'health-data', default_branch: 'main' }) : send(404, { message: 'Not Found' });
    const m = url.pathname.match(/^\/repos\/me\/health-data\/contents\/(.+)$/);
    if (!m) return send(404, { message: 'Not Found' });
    const path = decodeURIComponent(m[1]);
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.method === 'GET') {
      const dir = [...files.keys()].filter((p) => p.startsWith(`${path}/`));
      if (dir.length) return send(200, dir.map((p) => ({ name: p.slice(path.length + 1), path: p, sha: files.get(p).sha, type: 'file' })));
      const f = files.get(path);
      if (!f) return send(404, { message: 'Not Found' });
      if (req.headers.accept === 'application/vnd.github.raw') return send(200, f.bytes, { 'Content-Type': 'application/octet-stream' });
      const big = f.bytes.length > 1024 * 1024;
      return send(200, { sha: f.sha, size: f.bytes.length, encoding: big ? 'none' : 'base64', content: big ? '' : f.bytes.toString('base64') });
    }
    const b = JSON.parse(body || '{}');
    const cur = files.get(path);
    if (req.method === 'PUT') {
      if (cur && b.sha !== cur.sha) return send(cur && !b.sha ? 422 : 409, { message: 'sha mismatch' });
      if (!cur && b.sha) return send(409, { message: 'sha mismatch' });
      const bytes = Buffer.from(b.content, 'base64');
      const sha = createHash('sha1').update(bytes).update(String(++writes)).digest('hex');
      files.set(path, { bytes, sha });
      return send(cur ? 200 : 201, { content: { path, sha } });
    }
    if (req.method === 'DELETE') {
      if (!cur) return send(404, { message: 'Not Found' });
      if (b.sha !== cur.sha) return send(409, { message: 'sha mismatch' });
      files.delete(path);
      return send(200, {});
    }
    send(405, {});
  });
}

const port = 8300 + Math.floor(Math.random() * 300);
const server = await serve(port);
const gh = mockGitHub();
await new Promise((r) => gh.listen(port + 1000, '127.0.0.1', r));
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];

async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((api) => { window.__SYNC_API__ = api; }, `http://127.0.0.1:${port + 1000}`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  await page.goto(base);
  return page;
}
async function connect(page, { repo = 'me/health-data', pass = 'olive mayonnaise sixty seven', confirm = '' } = {}) {
  await page.goto(base + '#/data');
  await page.getByLabel('Repository').fill(repo);
  await page.getByLabel('Token').fill(TOKEN);
  await page.getByLabel('Passphrase', { exact: true }).fill(pass);
  if (confirm) await page.getByLabel('Passphrase again (first device only)').fill(confirm);
  await page.getByRole('button', { name: 'Connect and sync' }).click();
}
const syncNow = async (page) => {
  await page.goto(base + '#/data');
  await page.evaluate(() => document.getElementById('toast')?.remove());
  await page.getByRole('button', { name: 'Sync now' }).click();
  // The toast appears only once this sync has finished.
  await page.locator('#toast', { hasText: /Up to date|Synced: \d+ received/ }).waitFor({ timeout: 30000 });
};
const count = (page, store) => page.evaluate((s) => new Promise((res) => {
  const r = indexedDB.open('health-records');
  r.onsuccess = () => { const q = r.result.transaction(s).objectStore(s).count(); q.onsuccess = () => res(q.result); };
}), store);
const step = (s) => console.log('•', s);

step('device A: demo data, new repository');
const A = await device('A');
await A.goto(base + '#/data');
await A.getByRole('button', { name: 'Load demo data' }).click();
await A.getByText('Out of range at last test').waitFor();
await connect(A, { pass: 'olive mayonnaise sixty seven' });
await A.getByText('enter the passphrase twice').waitFor();
await connect(A, { confirm: 'olive mayonnaise sixty seven' });
await A.locator('.sync-line', { hasText: 'Synced' }).waitFor({ timeout: 30000 });
assert.ok(files.has('meta.json') && files.has('data.enc'), 'meta and data uploaded');
assert.ok([...files.keys()].some((p) => p.startsWith('files/')), 'photos uploaded');
assert.ok(!files.get('data.enc').bytes.toString('latin1').includes('Demo'), 'data is encrypted');
const aReports = await count(A, 'reports');
const aFiles = await count(A, 'files');

step('refusals: public repository, wrong passphrase');
const C = await device('C');
await connect(C, { repo: 'me/public-repo' });
await C.getByText('This repository is public').waitFor();
await connect(C, { pass: 'not the right passphrase' });
await C.getByText('Wrong passphrase').waitFor();

step('device B: same repository, gets everything');
const B = await device('B');
await connect(B);
await B.locator('.sync-line', { hasText: 'Synced' }).waitFor({ timeout: 30000 });
assert.equal(await count(B, 'reports'), aReports);
assert.equal(await count(B, 'files'), aFiles, 'photos downloaded');
assert.equal(await count(B, 'obs'), await count(A, 'obs'));

step('A adds a medicine; it is sent automatically and reaches B');
const shaBefore = files.get('data.enc').sha;
await A.goto(base + '#/meds/add/medicine');
await A.getByLabel('Name', { exact: true }).fill('Synced Statin');
await A.getByRole('button', { name: 'Save', exact: true }).click();
await A.getByText('Synced Statin').waitFor();
for (let i = 0; i < 40 && files.get('data.enc').sha === shaBefore; i++) await A.waitForTimeout(250);
assert.notEqual(files.get('data.enc').sha, shaBefore, 'sent within a few seconds');
await syncNow(B);
await B.goto(base + '#/meds');
await B.getByText('Synced Statin').waitFor();

step('B deletes it, A follows');
await B.getByText('Synced Statin').click();
await B.getByRole('button', { name: 'Delete' }).click();
await B.getByText('Deleted').waitFor();
await syncNow(B);
await syncNow(A);
await A.goto(base + '#/meds');
await A.getByText('Atorvastatin').first().waitFor();
assert.equal(await A.getByText('Synced Statin').count(), 0, 'deletion carried over');

step('profile changes sync too');
await A.goto(base + '#/data');
await A.getByLabel('Height (cm)').fill('183');
await A.getByRole('button', { name: 'Save profile' }).click();
await A.getByText('Profile saved').waitFor();
await syncNow(A);
await syncNow(B);
assert.equal(await B.getByLabel('Height (cm)').inputValue(), '183');

await browser.close();
server.close();
gh.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('sync e2e passed');
