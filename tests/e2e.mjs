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
assert.ok(await page.getByText('Due and overdue').isVisible());

step('profile and findings');
await page.goto(base + '#/data');
await page.getByText('From your lab result of 14 Mar 2022').waitFor();
assert.equal(await page.getByLabel('Blood group').inputValue(), 'A');
assert.equal(await page.getByLabel('Rh factor').inputValue(), 'pos');
await page.locator('select').first().selectOption('male');
await page.getByPlaceholder('e.g. 1985').fill('1980');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.getByText('Profile saved').waitFor(); // the write must finish before reloading
await page.goto(base);
await page.locator('.findings .finding').first().waitFor();
await shot('02b-findings');
await page.goto(base + '#/test/egfr_calc');
await page.locator('.chart svg').waitFor();
await page.goto(base + '#/test/ferritin');
await page.getByText('About this test').waitFor();
assert.ok(await page.getByRole('link', { name: /ferritin concentrations/ }).isVisible());

step('discuss with Claude');
await page.goto(base + '#/test/ferritin');
await page.getByRole('link', { name: 'Discuss with Claude' }).click();
await page.locator('.summary-preview').waitFor();
let summary = await page.locator('.summary-preview').textContent();
assert.match(summary, /Ferritin \(µg\/L\)/);
assert.ok(!summary.includes('Hemoglobin ('), 'only the chosen test and related ones');
await page.getByPlaceholder(/Why does my ferritin/).fill('Why is it falling?');
assert.match(await page.locator('.summary-preview').textContent(), /My question: Why is it falling\?/);
await page.getByRole('button', { name: 'All tests' }).click();
assert.match(await page.locator('.summary-preview').textContent(), /Hemoglobin \(g\/L\)/);
await shot('02c-discuss');

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
    { name: 'Mystery marker', name_en: 'Secret marker', metric: null, value: '12', unit: 'xyz/l', ref: '0-20' },
    { name: 'Nitrit (Urin)', metric: null, value: 'positiv', unit: '', ref: 'negativ' },
  ],
}) + '\n```';
await page.locator('.claude textarea').fill(reply);
await page.getByRole('button', { name: 'Read results' }).click();
await page.locator('.row-edit').nth(4).waitFor();
assert.equal(await page.locator('.row-edit').count(), 5);
assert.equal(await page.locator('.row-edit.unknown').count(), 2);
assert.equal(await page.locator('.row-edit').nth(2).locator('select').inputValue(), 'ldl');
assert.equal(await page.locator('input[type=date]').first().inputValue(), '2026-09-30');
assert.equal(await page.locator('.row-edit input[type=date]').count(), 0, 'rows use the report date');
const urine = page.locator('.row-edit').nth(4);
assert.match(await urine.locator('.preview').textContent(), /Not as expected/);
assert.doesNotMatch(await urine.locator('.preview').textContent(), /not understood/);
await urine.getByRole('button', { name: /30 Sept? 2026 \(report date\) · change/ }).click();
assert.equal(await urine.locator('input[type=date]').inputValue(), '2026-09-30');
await urine.getByRole('button', { name: 'Use the report date' }).click();
await shot('04-editor');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.locator('h1', { hasText: '30 Sept 2026' }).or(page.locator('h1', { hasText: '30 Sep 2026' })).waitFor();
await page.locator('.row-title', { hasText: 'Secret marker' }).waitFor(); // English name, printed name below
await shot('05-report');
assert.ok(await page.getByText('Mystery marker').isVisible());

step('unit suggestions');
await page.goto(base + '#/add');
await page.locator('.claude textarea').fill('```json\n' + JSON.stringify({ date: '2026-10-01', lab: 'Unit test lab', results: [
  { name: 'Hämoglobin', metric: 'hb', value: '14,1', unit: 'gr/dl', ref: '13,5 - 17,5' },
  { name: 'Hemoglobiini', metric: 'hb', value: '14,6', unit: 'g/l', date: '2026-10-08' }] }) + '\n```');
await page.getByRole('button', { name: 'Read results' }).click();
const unclear = page.locator('.row-edit').nth(0);
await unclear.getByText('Did you mean:').waitFor();
await unclear.locator('.unit-choices button', { hasText: 'g/dL' }).click();
assert.equal(await page.locator('.row-edit').nth(0).locator('.f-unit input').inputValue(), 'g/dL');
assert.match(await page.locator('.row-edit').nth(0).locator('.preview').textContent(), /→ 141 g\/L/);
const odd = page.locator('.row-edit').nth(1);
assert.match(await odd.locator('.preview').textContent(), /Unusual for you/);
await odd.locator('.unit-choices button', { hasText: 'g/dL' }).click();
assert.match(await page.locator('.row-edit').nth(1).locator('.preview').textContent(), /→ 146 g\/L/);
await shot('04b-units');

step('cardiology letter from a Claude reply');
await page.goto(base + '#/add/letter');
await page.locator('.claude textarea').fill('```json\n' + JSON.stringify({ date: '2026-09-01', lab: 'Heart clinic', doctor: 'Dr. Test', specialty: 'Cardiology',
  summary: 'Holter for palpitations.', diagnoses: ['Ventricular extrasystoles'], recommendations: ['Echo in 6 months'], follow_up: '2026-11-01',
  results: [{ name: 'QTc', metric: 'qtc', value: '472', unit: 'ms' }, { name: 'VES-Anteil', metric: null, value: '12,5', unit: '%' }] }) + '\n```');
await page.getByRole('button', { name: 'Read results' }).click();
await page.locator('.row-edit').nth(1).waitFor();
assert.equal(await page.locator('.row-edit').nth(1).locator('select').inputValue(), 'pvc_pct', 'VES-Anteil matched to PVC burden');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByText('Holter for palpitations.').waitFor();
assert.ok(await page.getByText('Echo in 6 months').isVisible());
await page.goto(base + '#/heart');
await page.getByText('QTc prolonged').waitFor();
assert.ok(await page.getByText('PVC burden 12.5 %').isVisible());
await shot('05b-heart');

step('body measurements');
await page.goto(base + '#/body');
await page.locator('.tiles .tile').first().waitFor();
assert.ok(await page.getByText('Waist-to-height ratio 0.54: increased').isVisible(), 'NICE rule from the demo waist and profile height');
assert.ok(await page.locator('.chart svg').first().isVisible(), 'weight chart');
await page.getByLabel('Weight in kg').fill('84,9');
await page.getByLabel('Waist in cm').fill('96');
await page.getByRole('button', { name: 'Save measurement' }).click();
await page.getByText('Saved 84.9 kg, 96 cm').waitFor();
await page.locator('.tiles .tile').first().getByText('84.9').waitFor();
await shot('05c-body');
await page.goto(base + '#/add/body');
assert.ok(await page.locator('details.doc-fields').isHidden(), 'no letter fields for body measurements');
await page.locator('.claude textarea').fill('```json\n' + JSON.stringify({ date: '2025-06-11', lab: 'Test gym', results: [
  { name: 'Paino', metric: 'weight', value: '79,8', unit: 'kg', ref: '62–83,8' }, { name: 'Proteiini', metric: null, value: '13,2', unit: 'kg', ref: '11–13,4' }] }) + '\n```');
await page.getByRole('button', { name: 'Read results' }).click();
await page.locator('.row-edit').nth(1).waitFor();
assert.equal(await page.locator('.row-edit').nth(1).locator('select').inputValue(), 'body_protein', 'protein in kg is the body value');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByText('Test gym').first().waitFor();
await page.goto(base + '#/test/muscle_mass');
await page.getByText('About this test').waitFor();
assert.equal(await page.locator('.page-head .back').getAttribute('href'), '#/body');

step('medicines and allergies');
await page.goto(base + '#/meds');
await page.getByText('Atorvastatin and your SLCO1B1 result').waitFor();
await page.goto(base + '#/meds/add/medicine');
await page.getByLabel('Name', { exact: true }).fill('Amoxicillin');
await page.getByLabel('Strength').fill('500 mg');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByText('Amoxicillin: check against your allergy to Penicillin').waitFor();
await shot('05d-meds');
await page.goto(base + '#/test/ferritin');
await page.getByText('Medicines that affect this test').waitFor();
assert.equal(await page.locator('.chart .period-med').count(), 1, 'iron shown on the ferritin chart');

step('timeline, illness diary and reminders');
await page.goto(base + '#/timeline');
await page.getByText('+ Add an illness or event').click();
await page.getByPlaceholder('e.g. Flu, knee surgery, trip to Thailand').fill('Stomach flu');
await page.locator('.add-event').getByRole('button', { name: 'Save' }).click();
await page.getByText('Stomach flu').waitFor();
await page.getByRole('button', { name: 'Medicines' }).click();
assert.ok(!(await page.getByText('Stomach flu').isVisible()), 'filter hides diary entries');
await shot('05e-timeline');
await page.goto(base + '#/test/crp');
await page.locator('.chart svg').waitFor();
assert.ok(await page.locator('.chart .period-ill').count() >= 1, 'illnesses shaded on the chart');
await page.goto(base + '#/test/hb');
await page.getByRole('button', { name: /Remind me to retest/ }).click();
await page.getByText(/Reminder set for/).waitFor();
await page.goto(base + '#/reminders');
await page.getByText('Repeat Hemoglobin').waitFor();
assert.ok(await page.getByText('Repeat TSH, free T4 and TPO antibodies').isVisible(), 'ETA retest suggested');
assert.ok(await page.getByText('Gesundheits-Check-up', { exact: true }).isVisible(), 'German check-up listed');
await page.locator('.screening-row', { hasText: 'Skin cancer screening' }).getByText('Mark done').click();
await page.locator('.screening-row', { hasText: 'Skin cancer screening' }).getByRole('button', { name: 'Save' }).click();
await page.locator('.screening-row', { hasText: 'Skin cancer screening' }).getByText(/Next/).waitFor();
await shot('05f-reminders');

step('heart risk score');
await page.goto(base + '#/heart');
await page.getByText('10-year heart risk (SCORE2)').waitFor();
assert.match(await page.locator('.risk-card').textContent(), /\d+(\.\d)? %.*risk/);

step('summary for the doctor');
await page.goto(base + '#/print');
await page.locator('.print-sheet').waitFor();
await page.getByLabel('Name on the page (optional, not saved)').fill('Demo Person');
const sheetText = await page.locator('.print-sheet').textContent();
for (const s of ['Demo Person', 'Penicillin', 'Atorvastatin', 'Low iron stores', 'Ferritin', 'SCORE2']) assert.ok(sheetText.includes(s), `summary has ${s}`);
await shot('05g-print');

step('two-value charts');
await page.goto(base + '#/compare');
await page.getByRole('button', { name: 'Night-time heart rate & sleep' }).waitFor();
assert.equal(await page.locator('.chart.dual .line').count(), 2, 'two lines');
await page.getByRole('button', { name: 'Ferritin & hemoglobin' }).click();
await page.waitForFunction(() => document.querySelectorAll('.compare-pickers select')[1]?.value === 'test:hb');
assert.match(page.url(), /compare\/test%3Aferritin\/test%3Ahb/);
await page.goto(base + '#/test/ldl');
await page.getByRole('link', { name: 'Compare with…' }).click();
await page.locator('.chart.dual svg').waitFor();
assert.equal(await page.locator('.compare-pickers select').first().inputValue(), 'test:ldl');
await shot('05h-compare');

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
const sub = await page.locator('.hero-banner .sub').textContent();
assert.ok(sub.includes(`${counts.reports} reports · ${counts.obs} results`), sub);
assert.ok(sub.includes(`${counts.vaccines} vaccinations`), sub);

step('Polar export import');
const { execFileSync } = await import('node:child_process');
const { mkdtempSync, writeFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const zdir = mkdtempSync(tmpdir() + '/polar-e2e-');
writeFileSync(zdir + '/training-session-2026-10-10T07:00:00-1-a.json', JSON.stringify({ identifier: { id: 'e2e1' }, startTime: '2026-10-10T07:00:00', name: 'Rowing', durationMillis: 3000000, hrAvg: 140, calories: 600 }));
writeFileSync(zdir + '/nightly_recovery_1-b.json', JSON.stringify([{ night: '2026-10-11', meanNightlyRecoveryRmssd: 61, meanNightlyRecoveryRri: 1200 }]));
execFileSync('zip', ['-q', zdir + '/export.zip', 'training-session-2026-10-10T07:00:00-1-a.json', 'nightly_recovery_1-b.json'], { cwd: zdir });
await page.goto(base + '#/fitness');
await page.locator('#polar-in').setInputFiles(zdir + '/export.zip');
await page.getByText('Polar data imported').waitFor();
await page.locator('.tiles').waitFor();
assert.ok(await page.getByText('Rowing').first().isVisible());
await shot('08-fitness');

step('DNA import');
const ddir = mkdtempSync(tmpdir() + '/dna-e2e-');
writeFileSync(ddir + '/genome_Test.txt', '# generated by 23andMe\n# build 37\n# rsid\tchromosome\tposition\tgenotype\nrs1800562\t6\t26093141\tAA\nrs6025\t1\t169519049\tCC\nrs4149056\t12\t21331549\tTT\n');
await page.goto(base + '#/dna');
await page.locator('#dna-in').setInputFiles(ddir + '/genome_Test.txt');
await page.getByText('Two copies of C282Y').waitFor();
assert.ok(await page.getByText('Show APOE result').isVisible(), 'APOE hidden until asked');
await shot('09-dna');

step('blood pressure entry');
await page.goto(base + '#/bp');
await page.getByLabel('Upper (SYS)').fill('128');
await page.getByLabel('Lower (DIA)').fill('82');
await page.getByRole('button', { name: 'Save reading' }).click();
await page.getByText('Saved 128/82').waitFor();
assert.ok(await page.getByText('128/82').first().isVisible());

step('dark mode');
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(base + '#/test/ldl');
await page.locator('.chart svg').waitFor();
await shot('07-ldl-dark');

await browser.close();
server.close();
assert.deepEqual(errors, [], 'console errors');
console.log('e2e passed');
