import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatedObs } from '../js/calc.js';
import { evaluate } from '../js/evaluate.js';
import { point } from '../js/store.js';
import { getMetric, matchMetric, METRICS } from '../js/metrics.js';
import { KB, SOURCES } from '../js/knowledge.js';
import { buildPrompt, parseExtraction, isDocType } from '../js/parse.js';
import { BODY_GROUPS } from '../js/body.js';

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
const NOW = Date.parse('2026-10-19');
const find = (fs, key) => fs.filter((f) => f.keys.includes(key));

test('body composition names in Finnish, German, Ukrainian and English', () => {
  const cases = [
    ['Paino', 'kg', 'weight'], ['Suositeltu paino', 'kg', 'target_weight'], ['Lihasmassa', 'kg', 'muscle_mass'],
    ['Rasvamassa', 'kg', 'fat_mass'], ['Rasvaprosentti', '%', 'body_fat_pct'], ['Rasvamassaindeksi', 'kg/m²', 'fmi'],
    ['Painoindeksi (BMI)', 'BMI', 'bmi'], ['VFA (Visceral fat area)', 'cm²', 'visceral_fat_area'],
    ['Oikean käden rasvaton massa', 'kg', 'lean_arm_r'], ['Keskivartalon rasvaton massa', 'kg', 'lean_trunk'],
    ['Vasemman jalan rasvamassa', 'kg', 'fat_leg_l'], ['Vartalon rasvamassa', 'kg', 'fat_trunk'], ['Rasvaton massa', 'kg', 'lean_mass'],
    ['Kehon vesi', 'L', 'body_water'], ['ECW/TBW', '', 'ecw_tbw'], ['Solunulkoinen vesi (ECW)', 'L', 'ecw'], ['Solunsisäinen vesi (ICW)', 'L', 'icw'],
    ['Mineraalit', 'kg', 'body_minerals'], ['Pehmyt kudos', 'kg', 'soft_lean'], ['Perusaineenvaihdunta', 'kcal', 'bmr'],
    ['Vyötärö-lantiosuhde', '', 'waist_hip'], ['Koko kehon vaihekulma', '°', 'phase_angle'], ['Luun mineraalimassa', 'kg', 'bone_mineral'],
    ['Kehon solumassa', 'kg', 'body_cell_mass'], ['Kehon ikä', '', 'body_age'], ['Kehon kokonaispisteet', '', 'body_score'],
    ['Körperfettanteil', '%', 'body_fat_pct'], ['Skelettmuskelmasse', 'kg', 'muscle_mass'], ['Taillenumfang', 'cm', 'waist'],
    ['Вага', 'кг', 'weight'], ['Обхват талії', 'см', 'waist'], ['Skeletal Muscle Mass', 'kg', 'muscle_mass'], ['Percent Body Fat', '%', 'body_fat_pct'],
  ];
  for (const [name, unit, key] of cases) assert.equal(matchMetric(name, unit), key, name);
});

test('the unit decides between a blood test and a body value of the same name', () => {
  assert.equal(matchMetric('Proteiini', 'kg'), 'body_protein');
  assert.equal(matchMetric('Proteiini', 'g/l'), 'protein');
  assert.equal(matchMetric('P-Prot', 'g/l'), 'protein');
  assert.equal(matchMetric('Protein', ''), 'protein', 'without a unit the blood test stays first');
});

test('every body metric is on the Body page', () => {
  const shown = new Set(BODY_GROUPS.flatMap(([, ks]) => ks));
  for (const m of METRICS.filter((x) => x.cat === 'body')) assert.ok(shown.has(m.key), m.key);
});

test('BMI and waist-to-height ratio from the profile height', () => {
  const by = data([['weight', '2026-01-10', '86,2', 'kg'], ['waist', '2026-01-10', 97, 'cm'], ['weight', '2026-03-01', 85, 'kg'], ['bmi', '2026-03-01', 25.9]]);
  const calc = calculatedObs((k) => by.get(k)?.pts ?? [], { height: 181 });
  assert.deepEqual(calc.map((o) => [o.metric, o.date, o.valueRaw]), [['bmi_calc', '2026-01-10', '26.3'], ['whtr_calc', '2026-01-10', '0.54']],
    'no calculated BMI where the report has one');
  assert.equal(calculatedObs((k) => by.get(k)?.pts ?? [], {}).length, 0, 'nothing without a height');
  const measured = data([['height', '2020-01-01', '1,81', 'm'], ['weight', '2026-01-10', 72, 'kg']]);
  assert.equal(calculatedObs((k) => measured.get(k)?.pts ?? [], {})[0].valueRaw, '22', 'uses a measured height');
});

test('WHO BMI classes', () => {
  const lvl = (b) => find(evaluate(data([['bmi', '2026-05-01', b]]), {}, NOW), 'bmi').map((f) => [f.level, f.title]);
  assert.deepEqual(lvl(17.9), [['attention', 'BMI 17.9: underweight']]);
  assert.deepEqual(lvl(22.6), [['good', 'BMI 22.6: healthy range']]);
  assert.deepEqual(lvl(26.3), [['info', 'BMI 26.3: overweight']]);
  assert.deepEqual(lvl(31), [['attention', 'BMI 31: obesity class I']]);
  assert.deepEqual(lvl(41), [['attention', 'BMI 41: obesity class III']]);
  assert.equal(KB.bmi_calc.rules, KB.bmi.rules, 'calculated BMI uses the same rule');
});

test('WHO waist and NICE waist-to-height thresholds', () => {
  const waist = (cm, sex) => find(evaluate(data([['waist', '2026-05-01', cm]]), { sex }, NOW), 'waist').map((f) => f.level);
  assert.deepEqual(waist(93, 'male'), ['good']);
  assert.deepEqual(waist(97, 'male'), ['info']);
  assert.deepEqual(waist(102, 'male'), ['attention']);
  assert.deepEqual(waist(85, 'female'), ['info']);
  assert.deepEqual(waist(88, 'female'), ['attention']);
  assert.deepEqual(waist(97, ''), [], 'needs the sex');
  const whtr = (v) => find(evaluate(data([['whtr_calc', '2026-05-01', v]]), {}, NOW), 'whtr_calc').map((f) => f.level);
  assert.deepEqual([whtr(0.45), whtr(0.54), whtr(0.6)], [['good'], ['info'], ['attention']]);
  for (const id of ['who_bmi', 'who2008waist', 'nice246']) assert.ok(SOURCES[id]?.url.startsWith('https://'), id);
});

test('device ranges: muscle above the range is fine, fat above it is information', () => {
  const fs = evaluate(data([['muscle_mass', '2026-05-01', '37,7', 'kg', '31,3–38,3'], ['muscle_mass', '2026-06-01', '39,0', 'kg', '31,3–38,3'],
    ['fat_mass', '2026-06-01', '21,4', 'kg', '9,4–18,8'], ['ldl', '2026-06-01', 4.5, 'mmol/L', '< 3.0']]), {}, NOW);
  assert.deepEqual(find(fs, 'muscle_mass').map((f) => [f.level, f.title]), [['good', 'Skeletal muscle mass above the device’s range']]);
  assert.deepEqual(find(fs, 'fat_mass').map((f) => [f.level, f.title]), [['info', 'Fat mass above the device’s range']]);
  assert.ok(find(fs, 'ldl').some((f) => f.level === 'attention' && f.title === 'LDL cholesterol above the lab’s range'), 'labs unchanged');
});

test('body composition prompt and reply', () => {
  const p = buildPrompt('body');
  assert.match(p, /visceral_fat_area = Visceral fat area/);
  assert.match(p, /Muutos edelliseen mittaukseen/);
  assert.doesNotMatch(p, /hb = Hemoglobin/, 'no lab tests in the body list');
  assert.doesNotMatch(p, /"summary"/, 'no letter fields');
  assert.doesNotMatch(buildPrompt('lab'), /visceral_fat_area/, 'no body values in the lab list');
  assert.equal(isDocType('body'), false);
  assert.equal(isDocType('ecg'), true);
  const res = parseExtraction('```json\n{"date": "2025-06-11", "lab": "Oma Puhti", "results": [' +
    '{"name": "Paino", "metric": "weight", "value": "79,8", "unit": "kg", "ref": "62–83,8"},' +
    '{"name": "Proteiini", "metric": null, "value": "13,2", "unit": "kg", "ref": "11–13,4"},' +
    '{"name": "Painoindeksi (BMI)", "metric": "bmi", "value": "24,1", "unit": "BMI", "ref": "18,5–25"}]}\n```');
  assert.equal(res.date, '2025-06-11');
  assert.deepEqual(res.rows.map((r) => r.metric), ['weight', 'body_protein', 'bmi']);
  const bmi = point({ ...res.rows[2], id: 'x', reportId: 'r', date: res.date }, getMetric('bmi'));
  assert.equal(bmi.v, 24.1, 'the unit "BMI" is read as kg/m²');
  assert.equal(bmi.status, 'normal');
});
