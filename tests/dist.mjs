// Opens the single-file builds from disk (file://) and checks they work.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });
const demo = new URL('../dist/health-records-demo.html', import.meta.url).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());

await page.goto(demo);
await page.locator('.findings .finding').first().waitFor();
assert.match(await page.locator('.hero-banner .sub').textContent(), /20 reports/);
assert.ok(await page.locator('.finding-title', { hasText: 'Pattern of subclinical hypothyroidism' }).isVisible(), 'thyroid pattern shown');
await page.screenshot({ path: SHOTS + 'dist-overview.png' });

await page.reload();
await page.locator('.findings').waitFor();
assert.match(await page.locator('.hero-banner .sub').textContent(), /20 reports/, 'demo is seeded only once');

await page.goto(demo + '#/dna');
await page.getByText('23andMe and tellmeGen compared').waitFor();
assert.ok(await page.getByText('They agree on 15 of 15 variants tested by both.').isVisible());
await page.screenshot({ path: SHOTS + 'dist-dna.png', fullPage: true });
await page.goto(demo + '#/test/ferritin');
await page.locator('.chart svg').waitFor();
await page.goto(demo + '#/data');
await page.getByRole('button', { name: 'Remove demo data' }).click();
await page.getByText('Demo data removed').waitFor(); // the delete must finish before reloading
await page.goto(demo + '#/');
await page.reload();
await page.getByText('No results yet').waitFor();

// A browser that refuses IndexedDB (like Safari for local files) still runs the app, in memory.
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx2.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } }); });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push('no-idb: ' + e.message));
await p2.goto(demo);
await p2.getByText('Not saved in this browser.').waitFor();
await p2.locator('.findings .finding').first().waitFor();
await p2.screenshot({ path: SHOTS + 'dist-no-storage.png' });

// Desktop search: Ctrl/⌘+K focuses the sidebar box, results appear as you type, Enter opens the first.
await p2.keyboard.press('Control+K');
await p2.keyboard.type('феритин');
await p2.locator('.search-hit').first().waitFor();
assert.match(await p2.locator('.search-hit').first().textContent(), /Ferritin/);
await p2.screenshot({ path: SHOTS + 'dist-search.png' });
await p2.keyboard.press('Enter');
await p2.locator('h1', { hasText: 'Ferritin' }).waitFor();

// The summary for the doctor fits one A4 page for the demo person.
await p2.goto(demo + '#/print');
await p2.locator('.print-sheet').waitFor();
await p2.emulateMedia({ media: 'print' });
const pdf = await p2.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
assert.equal(pages, 1, `summary is ${pages} pages`);

await browser.close();
assert.deepEqual(errors, [], 'console errors');
console.log('dist passed');
