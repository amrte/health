import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normUnit, convert } from '../js/units.js';
import { matchMetric, getMetric, METRICS } from '../js/metrics.js';
import { parseNumber, parseValue, parseRange, parseExtraction, isoDate, buildPrompt } from '../js/parse.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('unit spellings normalise to one token', () => {
  for (const u of ['10^9/l', 'x10⁹/L', '×10⁹/л', 'E9/l', '/nl', 'G/l', 'Tsd/µl', '10*9/L', 'х10^9/л']) {
    assert.equal(normUnit(u), '10^9/l', u);
  }
  for (const u of ['10^12/l', 'E12/l', 'T/l', '/pl', 'Mio/µl', '×10¹²/л']) assert.equal(normUnit(u), '10^12/l', u);
  assert.equal(normUnit('g/l'), 'g/l');
  assert.equal(normUnit('г/л'), 'g/l');
  assert.equal(normUnit('мкмоль/л'), 'umol/l');
  assert.equal(normUnit('µmol/l'), 'umol/l');
  assert.equal(normUnit('ммоль/л'), 'mmol/l');
  assert.equal(normUnit('Од/л'), 'u/l');
  assert.equal(normUnit('мм/год'), 'mm/h');
  assert.equal(normUnit('мкМО/мл'), 'mu/l');
  assert.equal(normUnit('µIU/ml'), 'mu/l');
  assert.equal(normUnit('ng/ml'), 'ug/l');
  assert.equal(normUnit('нг/мл'), 'ug/l');
  assert.equal(normUnit('ml/min/1,73 m²'), 'ml/min/1.73m2');
});

test('conversions to canonical units', () => {
  near(convert(14.8, 'g/dl', getMetric('hb')), 148);
  near(convert(100, 'mg/dl', getMetric('glucose')), 5.55);
  near(convert(200, 'mg/dl', getMetric('chol')), 5.17);
  near(convert(150, 'mg/dl', getMetric('trig')), 1.69);
  near(convert(1.0, 'mg/dl', getMetric('crea')), 88.42);
  near(convert(30, 'ng/ml', getMetric('vitd')), 74.9);
  near(convert(5.5, '%', getMetric('hba1c')), 36.6);
  near(convert(6.2, '/nl', getMetric('wbc')), 6.2);
  near(convert(6200, '/µl', getMetric('wbc')), 6.2);
  near(convert(0.43, '', getMetric('hct')), 43);
  near(convert(0.5, 'mg/dl', getMetric('crp')), 5);
  near(convert(400, 'pg/ml', getMetric('b12')), 295);
  assert.equal(convert(5, 'furlongs', getMetric('hb')), null);
});

test('test names in five languages', () => {
  const cases = [
    ['B-Hb', 'hb'], ['Hämoglobin', 'hb'], ['Гемоглобін', 'hb'], ['Hemoglobin (HGB)', 'hb'],
    ['B-Leuk', 'wbc'], ['Leukozyten', 'wbc'], ['Лейкоцити', 'wbc'],
    ['B-Trom', 'plt'], ['Тромбоцити', 'plt'],
    ['B-HKR', 'hct'], ['E-MCV', 'mcv'], ['MCHC', 'mchc'], ['MCH (HbE)', 'mch'],
    ['fP-Gluk', 'glucose'], ['Glukose nüchtern', 'glucose'], ['Глюкоза', 'glucose'],
    ['B-GHbA1C', 'hba1c'], ['HbA1c (IFCC)', 'hba1c'], ['glykiertes Hämoglobin', 'hba1c'], ['Глікований гемоглобін', 'hba1c'],
    ['fP-Kol', 'chol'], ['Cholesterin gesamt', 'chol'], ['Холестерин загальний', 'chol'],
    ['fP-Kol-LDL', 'ldl'], ['LDL-Cholesterin', 'ldl'], ['Холестерин ЛПНЩ', 'ldl'],
    ['Холестерин ліпопротеїнів низької щільності (ЛПНЩ)', 'ldl'],
    ['fP-Kol-HDL', 'hdl'], ['HDL-Cholesterin', 'hdl'], ['Холестерин ЛПВЩ', 'hdl'],
    ['fP-Trigly', 'trig'], ['Тригліцериди', 'trig'],
    ['P-Krea', 'crea'], ['Kreatinin', 'crea'], ['Креатинін', 'crea'], ['eGFR (CKD-EPI)', 'egfr'], ['P-Krea-eGFR', 'egfr'],
    ['P-ALAT', 'alt'], ['GPT (ALT)', 'alt'], ['АЛТ', 'alt'], ['P-GT', 'ggt'], ['Gamma-GT', 'ggt'],
    ['Bilirubin gesamt', 'bili'], ['Bilirubin direkt', 'bili_direct'], ['Білірубін прямий', 'bili_direct'],
    ['P-Ferrit', 'ferritin'], ['Феритин', 'ferritin'], ['Eisen', 'iron'], ['Transferrinsättigung', 'tsat'],
    ['P-TSH', 'tsh'], ['TSH basal', 'tsh'], ['ТТГ', 'tsh'], ['P-T4-V', 'ft4'], ['fT4', 'ft4'], ['Т4 вільний', 'ft4'],
    ['P-CRP', 'crp'], ['C-reaktives Protein', 'crp'], ['С-реактивний білок', 'crp'], ['hs-CRP', 'hscrp'],
    ['fS-D-25', 'vitd'], ['25-OH-Vitamin D', 'vitd'], ['Вітамін D (25-OH)', 'vitd'],
    ['Vitamin B12', 'b12'], ['B 12', 'b12'], ['Holotranscobalamin', 'holotc'],
    ['ШОЕ', 'esr'], ['BSG', 'esr'], ['B-La', 'esr'], ['P-K', 'k'], ['Natrium', 'na'],
    ['Нейтрофіли сегментоядерні', 'neut_seg_pct'], ['Паличкоядерні', 'neut_band_pct'],
  ];
  for (const [name, key] of cases) assert.equal(matchMetric(name), key, name);
  assert.equal(matchMetric('U-Alb'), null);
  assert.equal(matchMetric('Something unknown'), null);
});

test('white cell differential picks % or count', () => {
  assert.equal(matchMetric('Neutrophile', '%'), 'neut_pct');
  assert.equal(matchMetric('B-Neut', 'E9/l'), 'neut_abs');
  assert.equal(matchMetric('Lymphozyten %'), 'lymph_pct');
  assert.equal(matchMetric('Лімфоцити', '', 32), 'lymph_pct');
  assert.equal(matchMetric('Лімфоцити', '×10⁹/л', 1.9), 'lymph_abs');
});

test('values and ranges', () => {
  assert.equal(parseNumber('5,3'), 5.3);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('abc'), null);
  assert.deepEqual(parseValue('<0,5'), { value: 0.5, qualifier: '<', text: '', flag: '' });
  assert.deepEqual(parseValue('12.1 H'), { value: 12.1, qualifier: '', text: '', flag: 'H' });
  assert.deepEqual(parseValue('3.1 ↓'), { value: 3.1, qualifier: '', text: '', flag: 'L' });
  assert.equal(parseValue('negativ').text, 'negativ');
  assert.deepEqual(parseRange('3,5 - 5,0'), { low: 3.5, high: 5 });
  assert.deepEqual(parseRange('134–167'), { low: 134, high: 167 });
  assert.deepEqual(parseRange('< 5.0'), { low: null, high: 5 });
  assert.deepEqual(parseRange('> 1,0'), { low: 1, high: null });
  assert.deepEqual(parseRange('до 5'), { low: null, high: 5 });
  assert.deepEqual(parseRange('bis 200'), { low: null, high: 200 });
  assert.equal(isoDate('14.03.2024'), '2024-03-14');
  assert.equal(isoDate('2024-3-4'), '2024-03-04');
});

test('Claude reply is parsed from a code block', () => {
  const reply = `Here are the results:

\`\`\`json
{"date": "2025-10-02", "lab": "Test lab", "results": [
  {"name": "B-Hb", "metric": "hb", "value": "148", "unit": "g/l", "ref": "134-167", "flag": ""},
  {"name": "fP-Gluk", "metric": null, "value": "6,1", "unit": "mmol/l", "ref": "4.0-6.0", "flag": "H"},
  {"name": "P-Ferrit", "metric": "ferritin", "value": "35", "unit": "µg/l", "ref": "30-400", "date": "2024-06-03"},
  {"name": "Weird", "metric": "not-a-key", "value": "1", "unit": "", "ref": ""}
]}
\`\`\``;
  const { date, lab, rows } = parseExtraction(reply);
  assert.equal(date, '2025-10-02');
  assert.equal(lab, 'Test lab');
  assert.equal(rows.length, 4);
  assert.equal(rows[1].metric, 'glucose');
  assert.equal(rows[1].flag, 'H');
  assert.equal(rows[2].date, '2024-06-03');
  assert.equal(rows[3].metric, '');
  assert.throws(() => parseExtraction('no json here'));
});

test('catalogue is consistent', () => {
  const keys = new Set();
  for (const m of METRICS) {
    assert.ok(!keys.has(m.key), 'duplicate ' + m.key);
    keys.add(m.key);
  }
  const prompt = buildPrompt();
  assert.ok(prompt.includes('hb = Hemoglobin'));
  assert.ok(prompt.includes('neut_abs'));
});

test('offline cache lists every app file', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of await readdir(new URL('../js/', import.meta.url))) assert.ok(sw.includes(`'js/${f}'`), `sw.js is missing js/${f}`);
});
