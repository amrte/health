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
assert.match(await page.locator('.page-head .sub').textContent(), /7 reports/);
assert.ok(await page.getByText('Pattern of subclinical hypothyroidism').isVisible(), 'thyroid pattern shown');
await page.screenshot({ path: SHOTS + 'dist-overview.png' });

await page.reload();
await page.locator('.findings').waitFor();
assert.match(await page.locator('.page-head .sub').textContent(), /7 reports/, 'demo is seeded only once');

await page.goto(demo + '#/test/ferritin');
await page.locator('.chart svg').waitFor();
await page.goto(demo + '#/data');
await page.getByRole('button', { name: 'Remove demo data' }).click();
await page.getByText('Demo data removed').waitFor(); // the delete must finish before reloading
await page.goto(demo + '#/');
await page.reload();
await page.getByText('No results yet').waitFor();

await browser.close();
assert.deepEqual(errors, [], 'console errors');
console.log('dist passed');
