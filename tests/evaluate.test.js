import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ckdEpi2021, calculatedObs } from '../js/calc.js';
import { evaluate } from '../js/evaluate.js';
import { point } from '../js/store.js';
import { getMetric } from '../js/metrics.js';
import { KB, SOURCES } from '../js/knowledge.js';

// Builds the store's byMetric map from [key, date, value, unit, ref] rows.
function data(rows) {
  const by = new Map();
  rows.forEach(([key, date, valueRaw, unit = getMetric(key).unit, refRaw = ''], i) => {
    const m = getMetric(key);
    const p = point({ id: 'o' + i, reportId: 'r', date, metric: key, name: key, valueRaw: String(valueRaw), unit, refRaw, flag: '' }, m);
    if (!by.has(key)) by.set(key, { m, pts: [] });
    by.get(key).pts.push(p);
  });
  for (const e of by.values()) { e.pts.sort((a, b) => a.t - b.t); e.last = e.pts[e.pts.length - 1]; }
  return by;
}
const titles = (fs) => fs.map((f) => f.title);
const NOW = Date.parse('2026-10-19');

test('CKD-EPI 2021', () => {
  assert.equal(Math.round(ckdEpi2021(88.42, 50, 'male')), 92);
  assert.equal(Math.round(ckdEpi2021(0.8 * 88.42, 60, 'female')), 84);
  assert.equal(ckdEpi2021(80, 50, ''), null);
  assert.equal(ckdEpi2021(80, 15, 'male'), null);
});

test('calculated eGFR and non-HDL', () => {
  const by = data([['crea', '2025-01-10', 88.42], ['chol', '2025-01-10', 5.5], ['hdl', '2025-01-10', 1.3]]);
  const calc = calculatedObs((k) => by.get(k)?.pts ?? [], { sex: 'male', birthYear: 1975 });
  assert.deepEqual(calc.map((o) => [o.metric, o.valueRaw]), [['egfr_calc', '92'], ['nonhdl_calc', '4.2']]);
  assert.equal(calculatedObs((k) => by.get(k)?.pts ?? [], {}).length, 1, 'no eGFR without a profile');
});

test('guideline rules', () => {
  const f = evaluate(data([
    ['ldl', '2026-05-01', 5.2],
    ['glucose', '2026-05-01', 6.3],
    ['ferritin', '2026-05-01', 40], ['crp', '2026-05-01', 25, 'mg/L', '< 5'],
    ['tsh', '2026-05-01', 6.1, 'mU/L', '0.5-3.6'], ['ft4', '2026-05-01', 14, 'pmol/L', '9-19'],
    ['hb', '2026-05-01', 115, 'g/L', '117-155'],
    ['vitd', '2026-05-01', 42],
  ]), { sex: 'female', birthYear: 1990 }, NOW);
  const t = titles(f);
  assert.ok(t.includes('LDL cholesterol markedly raised'));
  assert.ok(t.includes('Glucose: impaired fasting glucose (if fasting)'));
  assert.ok(t.includes('Ferritin: possible iron deficiency despite inflammation'));
  assert.ok(t.includes('Pattern of subclinical hypothyroidism'));
  assert.ok(t.includes('Hemoglobin: mild anaemia range (WHO)'));
  assert.ok(t.includes('Vitamin D: possibly inadequate (IOM)'));
  assert.ok(t.includes('Lp(a) has never been measured'));
  assert.equal(f[0].level, 'alert', 'most urgent first');
});

test('trends and repeats', () => {
  const f = evaluate(data([
    ['ferritin', '2022-03-01', 145, 'µg/L', '30-400'], ['ferritin', '2023-03-01', 110, 'µg/L', '30-400'],
    ['ferritin', '2024-03-01', 80, 'µg/L', '30-400'], ['ferritin', '2025-03-01', 52, 'µg/L', '30-400'],
    ['ldl', '2025-01-01', 3.4, 'mmol/L', '< 3.0'], ['ldl', '2026-01-01', 3.6, 'mmol/L', '< 3.0'],
  ]), {}, NOW);
  const trend = f.find((x) => x.title === 'Ferritin: falling steadily');
  assert.ok(trend, titles(f).join(' | '));
  assert.equal(trend.level, 'attention', 'approaching the lower limit');
  assert.match(f.find((x) => x.keys[0] === 'ldl' && x.kind === 'range').text, /last 2 tests in a row/);
});

test('every source reference resolves', () => {
  for (const [key, kb] of Object.entries(KB)) {
    assert.ok(getMetric(key), `KB entry for unknown test ${key}`);
    for (const id of [...(kb.sources ?? []), ...(kb.thresholds ?? []).map((t) => t.source)]) assert.ok(SOURCES[id], `${key}: ${id}`);
  }
});

test('discussion summary', async () => {
  const { buildSummary } = await import('../js/summary.js');
  const by = data([
    ['ldl', '2025-01-01', '135', 'mg/dl', '< 116'], ['ldl', '2026-01-01', 3.6, 'mmol/L', '< 3.0'],
    ['ferritin', '2026-01-01', 30, 'µg/L', '30-400'],
  ]);
  const findings = evaluate(by, {}, NOW);
  const text = buildSummary(by, { keys: new Set(['ldl']), history: 'all', includeProfile: true, profile: { sex: 'male', birthYear: 1980 },
    includeFindings: true, findings, includeVaccines: false, question: 'Is this a concern?', now: NOW });
  assert.match(text, /About me: male, 46 years old\./);
  assert.match(text, /My question: Is this a concern\?/);
  assert.match(text, /- LDL cholesterol \(mmol\/L\), lab range < 3: 2025-01-01: 3\.49 \(H\); 2026-01-01: 3\.6 \(H\)/);
  assert.match(text, /LDL above all ESC\/EAS goals.*\[ESC\/EAS 2019\]/);
  assert.ok(!text.includes('Ferritin'), 'only selected tests');
  assert.match(text, /cite each source with a link/);
});
