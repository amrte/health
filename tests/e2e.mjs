// End-to-end check in headless Chromium at iPhone size: demo data, charts,
// Claude import for lab results and vaccinations, backup round trip.
// Screenshots go to tests/screenshots/.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { serve } from '../scripts/serve.mjs';

const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });
const port = 8000 + Math.floor(Math.random() * 1000);
const server = await serve(port);
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
const shot = (name) => page.screenshot({ path: SHOTS + name + '.png', fullPage: true });
const step = (name) => console.log('•', name);

step('empty state');
await page.goto(base);
await page.getByText('No results yet').waitFor();
await shot('01-empty');

step('demo data');
await page.goto(base + '#/data');
await page.getByRole('button', { name: 'Load demo data' }).click();
await page.getByText('Out of range at last test').waitFor();
await shot('02-overview');
const rows = await page.locator('.group .row').count();
assert.ok(rows > 15, `overview rows: ${rows}`);
assert.ok(await page.getByText('Vaccinations due').isVisible());

step('profile and findings');
await page.goto(base + '#/data');
await page.locator('select').first().selectOption('male');
await page.getByPlaceholder('e.g. 1985').fill('1980');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.goto(base);
await page.locator('.findings .finding').first().waitFor();
await shot('02b-findings');
await page.goto(base + '#/test/egfr_calc');
await page.locator('.chart svg').waitFor();
await page.goto(base + '#/test/ferritin');
await page.getByText('About this test').waitFor();
assert.ok(await page.getByRole('link', { name: /ferritin concentrations/ }).isVisible());

step('hemoglobin from g/L, g/dL and г/л on one chart');
await page.goto(base + '#/test/hb');
await page.locator('.chart svg').waitFor();
const hbValues = await page.locator('table.results tbody .value').allTextContents();
assert.equal(hbValues.length, 7);
for (const v of hbValues) assert.match(v, /^1[45]\d g\/L$/, v);
assert.equal(await page.locator('.chart .mk').count(), 7);

step('ferritin trend with out-of-range marker');
await page.goto(base + '#/test/ferritin');
await page.locator('.chart svg').waitFor();
assert.equal(await page.locator('.chart .mk-out').count(), 1);
const box = await page.locator('.chart .hit').boundingBox();
await page.mouse.move(box.x + box.width - 5, box.y + 100);
await page.locator('.tip:not([hidden])').waitFor();
assert.match(await page.locator('.tip').textContent(), /27 µg\/L · Low/);
await shot('03-ferritin');

step('search');
await page.goto(base);
await page.locator('input.search').fill('chol');
assert.ok(await page.getByText('LDL cholesterol').first().isVisible());
await page.locator('input.search').fill('');

step('add a report from a Claude reply');
await page.goto(base + '#/add');
await page.getByRole('button', { name: 'Copy instructions' }).waitFor();
const reply = '```json\n' + JSON.stringify({
  date: '2026-09-30', lab: 'Test clinic',
  results: [
    { name: 'B-Hb', metric: 'hb', value: '139', unit: 'g/l', ref: '134-167', flag: '' },
    { name: 'Leukozyten', metric: 'wbc', value: '11,2', unit: '/nl', ref: '3,9-10,2', flag: 'H' },
    { name: 'Холестерин ЛПНЩ', metric: null, value: '3,6', unit: 'ммоль/л', ref: '< 3,0' },
    { name: 'Mystery marker', metric: null, value: '12', unit: 'xyz/l', ref: '0-20' },
  ],
}) + '\n```';
await page.locator('.claude textarea').fill(reply);
await page.getByRole('button', { name: 'Read results' }).click();
await page.locator('.row-edit').nth(3).waitFor();
assert.equal(await page.locator('.row-edit').count(), 4);
assert.equal(await page.locator('.row-edit.unknown').count(), 1);
assert.equal(await page.locator('.row-edit').nth(2).locator('select').inputValue(), 'ldl');
assert.equal(await page.locator('input[type=date]').first().inputValue(), '2026-09-30');
await shot('04-editor');
await page.getByRole('button', { name: 'Save report' }).click();
await page.locator('h1', { hasText: '30 Sept 2026' }).or(page.locator('h1', { hasText: '30 Sep 2026' })).waitFor();
await shot('05-report');
assert.ok(await page.getByText('Mystery marker').isVisible());

step('vaccinations from a Claude reply');
await page.goto(base + '#/vaccines/add');
await page.locator('.claude textarea').fill('```json\n' + JSON.stringify({ vaccinations: [
  { date: '2019-05-02', vaccine: 'Revaxis', targets: ['tetanus', 'diphtheria', 'polio'], dose: 'booster', lot: 'X123', place: 'Berlin', due: '2029-05-02' },
  { date: '2024-10-01', vaccine: 'Influvac Tetra', targets: [], dose: '', uncertain: true },
] }) + '\n```');
await page.getByRole('button', { name: 'Read vaccinations' }).click();
await page.locator('.row-edit').nth(1).waitFor();
assert.equal(await page.locator('.row-edit').count(), 2);
assert.ok(await page.locator('.row-edit').nth(1).getByText('Influenza').isVisible(), 'influenza guessed from the name');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText('By disease').waitFor();
await shot('06-vaccines');

step('backup round trip');
await page.goto(base + '#/data');
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
const backupPath = SHOTS + 'backup.json';
await download.saveAs(backupPath);
const counts = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('health-records');
  r.onsuccess = () => {
    const tx = r.result.transaction(['reports', 'obs', 'vaccines']);
    const out = {};
    let n = 0;
    for (const s of ['reports', 'obs', 'vaccines']) tx.objectStore(s).count().onsuccess = (e) => { out[s] = e.target.result; if (++n === 3) res(out); };
  };
}));
await page.getByRole('button', { name: 'Delete all data' }).click();
await page.getByText('No results yet').waitFor();
await page.goto(base + '#/data');
await page.locator('#backup-in').setInputFiles(backupPath);
await page.getByText('Out of range at last test').waitFor();
const sub = await page.locator('.page-head .sub').textContent();
assert.ok(sub.includes(`${counts.reports} reports · ${counts.obs} results`), sub);
assert.ok(sub.includes(`${counts.vaccines} vaccinations`), sub);

step('dark mode');
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(base + '#/test/ldl');
await page.locator('.chart svg').waitFor();
await shot('07-ldl-dark');

await browser.close();
server.close();
assert.deepEqual(errors, [], 'console errors');
console.log('e2e passed');
