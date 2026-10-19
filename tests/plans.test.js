// Medicines and allergies, SCORE2, timeline, reminders and screening.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score2, category2021, category2025, assessRisk, riskFindings } from '../js/score2.js';
import { drugGroups, medFindings, medsForMetric, parseMedsReply, medsFromLetter, doseMg, isCurrent } from '../js/meds-data.js';
import { screeningStatus } from '../js/screening.js';
import { addMonths, reminderStatus, retestSuggestions } from '../js/reminders.js';
import { illnessPeriods, timelineItems } from '../js/timeline.js';
import { point } from '../js/store.js';
import { getMetric } from '../js/metrics.js';
import { buildSummary } from '../js/summary.js';

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
const pct = (x) => Math.round(x * 1000) / 10;

test('SCORE2 reproduces the published examples', () => {
  // SCORE2 paper abstract: 50-year-old smoker, SBP 140, TC 5.5, HDL 1.3.
  const paper = (sex, region) => pct(score2({ age: 50, sex, smoker: true, sbp: 140, tc: 5.5, hdl: 1.3, region }));
  assert.deepEqual([paper('male', 'low'), paper('male', 'very_high'), paper('female', 'low'), paper('female', 'very_high')], [5.9, 14.0, 4.2, 13.7]);
  // Supplementary Methods Table 4: 50, smoker, SBP 140, TC 6.3, HDL 1.4.
  const t4 = (sex) => ['low', 'moderate', 'high', 'very_high'].map((region) => pct(score2({ age: 50, sex, smoker: true, sbp: 140, tc: 6.3, hdl: 1.4, region })));
  assert.deepEqual(t4('male'), [6.3, 8.1, 8.8, 15.1]);
  assert.deepEqual(t4('female'), [4.3, 5.2, 7.1, 14.1]);
  assert.equal(score2({ age: 39, sex: 'male', smoker: false, sbp: 120, tc: 5, hdl: 1.3 }), null, 'only 40–69');
  assert.equal(score2({ age: 72, sex: 'male', smoker: false, sbp: 120, tc: 5, hdl: 1.3 }), null, 'SCORE2-OP not calculated');
});

test('risk categories and LDL goals', () => {
  assert.equal(category2021(45, 2.4), 'low to moderate');
  assert.equal(category2021(45, 3.1), 'high');
  assert.equal(category2021(55, 3.1), 'low to moderate');
  assert.equal(category2021(55, 10), 'very high');
  assert.deepEqual([1.9, 2, 9.9, 10, 19.9, 20].map((p) => category2025(p).goal), [3.0, 2.6, 2.6, 1.8, 1.8, 1.4]);
});

test('risk assessment from stored data', () => {
  const today = '2026-10-19';
  const by = data([['chol', '2026-05-12', 5.6], ['hdl', '2026-05-12', 1.2], ['ldl', '2026-05-12', 3.4]]);
  const bp = [{ time: '2026-09-09T10:00', sys: 142, dia: 88, place: 'clinic' }];
  const profile = { sex: 'male', birthYear: 1980, smoker: 'no' };
  const a = assessRisk({ profile, byMetric: by, bp, today });
  assert.equal(a.status, 'ok');
  assert.equal(a.cat, 'moderate');
  assert.match(a.inputs.sbpFrom, /doctor’s office/);
  const [f] = riskFindings(a);
  assert.deepEqual([f.level, f.keys, f.title.startsWith('LDL above your goal')], ['info', ['ldl'], true]);
  assert.deepEqual(assessRisk({ profile: { sex: 'male', birthYear: 1980 }, byMetric: by, bp, today }).missing, ['smoking (in your profile)']);
  assert.equal(assessRisk({ profile, byMetric: by, bp: [], today }).status, 'missing', 'needs a blood pressure');
  assert.equal(assessRisk({ profile: { ...profile, highRiskCondition: true }, byMetric: by, bp, today }).status, 'excluded');
  const diab = data([['chol', '2026-05-12', 5.6], ['hdl', '2026-05-12', 1.2], ['hba1c', '2026-05-12', 52]]);
  assert.equal(assessRisk({ profile, byMetric: diab, bp, today }).reason, 'diabetes');
  assert.equal(assessRisk({ profile: { ...profile, birthYear: 1990 }, byMetric: by, bp, today }).status, 'young');
  const onStatin = assessRisk({ profile, byMetric: by, bp, today, statinOn: (d) => d >= '2026-01-01' });
  assert.ok(onStatin.notes.some((n) => /statin/.test(n)), 'notes treated cholesterol');
});

test('drug groups from names and brands', () => {
  const g = (name, ingredient = '') => [...drugGroups({ name, ingredient })];
  assert.deepEqual(g('Atorvastatin Ratiopharm 20 mg'), ['statin']);
  assert.deepEqual(g('Sortis'), ['statin']);
  assert.deepEqual(g('Vitamin D3'), ['vitd']);
  assert.deepEqual(g('Devisol'), ['vitd']);
  assert.deepEqual(g('Retafer', 'ferrous sulfate'), ['iron']);
  assert.deepEqual(g('Euthyrox'), ['thyroid']);
  assert.deepEqual(g('Burana'), ['nsaid']);
  assert.deepEqual(g('Amoxicillin'), ['penicillin']);
  assert.deepEqual(g('Magnesium'), []);
  assert.deepEqual(g('Iron Maiden tickets').includes('iron'), true, 'short words match whole words');
  assert.deepEqual(g('Ironman'), []);
  const meds = [{ kind: 'medicine', name: 'Atorvastatin', start: '2026-06-01' }, { kind: 'supplement', name: 'Vitamin D3' }, { kind: 'allergy', name: 'Statins?' }];
  assert.deepEqual(medsForMetric(meds, 'ldl').map((m) => m.name), ['Atorvastatin']);
  assert.equal(isCurrent({ kind: 'medicine', start: '2026-06-01', stop: '2026-06-30' }, '2026-10-19'), false);
  assert.equal(doseMg({ dose: '0,5 mg' }), 0.5);
});

test('medicine checks: allergy and DNA', () => {
  const today = '2026-10-19';
  const meds = [{ id: 'a', kind: 'allergy', name: 'Penicillin', reaction: 'rash' }, { id: 'm1', kind: 'medicine', name: 'Amoxicillin', start: '2026-10-10' },
    { id: 'm2', kind: 'medicine', name: 'Simvastatin', dose: '40 mg', start: '2026-01-01' }, { id: 'm3', kind: 'medicine', name: 'Ibuprofen', start: '2020-01-01', stop: '2020-01-05' }];
  const tc = [{ snps: { rs4149056: 'TC' } }];
  const fs = medFindings(meds, tc, today);
  assert.deepEqual(fs.map((f) => [f.medId, f.level]), [['m1', 'alert'], ['m2', 'attention']]);
  assert.match(fs[1].text, /below 20 mg/);
  assert.deepEqual(fs[1].sources, ['cpic_statin']);
  assert.equal(medFindings([{ id: 'x', kind: 'medicine', name: 'Clopidogrel' }], [{ snps: { rs4244285: 'AG' } }], today)[0].level, 'attention');
  assert.equal(medFindings(meds.slice(2), [{ snps: { rs4149056: 'TT' } }], today).length, 0, 'normal function: nothing');
});

test('medicines from Claude and from letters; summary', () => {
  const items = parseMedsReply('```json\n{"items": [{"kind": "medicine", "name": "Euthyrox", "ingredient": "levothyroxine", "dose": "50 µg", "schedule": "every morning", "start": "2026-03-01"}, {"kind": "allergy", "name": "Penicillin", "reaction": "rash", "severity": "severe"}, {"kind": "x", "name": ""}]}\n```');
  assert.deepEqual(items.map((m) => [m.kind, m.name, m.severity]), [['medicine', 'Euthyrox', ''], ['allergy', 'Penicillin', 'severe']]);
  assert.deepEqual(medsFromLetter(['Atorvastatin 20 mg 1×1 in the evening', 'Burana as needed'], '2026-05-20').map((m) => [m.name, m.dose, m.schedule, m.start]),
    [['Atorvastatin', '20 mg', '1×1 in the evening', '2026-05-20'], ['Burana as needed', '', '', '2026-05-20']]);
  const text = buildSummary(new Map(), { keys: new Set(), includeMeds: true, today: '2026-10-19', meds: [{ kind: 'allergy', name: 'Penicillin', reaction: 'rash' },
    { kind: 'medicine', name: 'Atorvastatin', dose: '20 mg', start: '2026-06-01' }] });
  assert.match(text, /Allergies and intolerances:\n- Penicillin: rash/);
  assert.match(text, /- Atorvastatin 20 mg: since 2026-06-01/);
});

test('screening by age, sex and what was done', () => {
  const today = '2026-10-19';
  const man = (birthYear, events = [], extra = {}) => Object.fromEntries(screeningStatus({ sex: 'male', birthYear, ...extra }, events, today).map((s) => [s.item.key, s.status]));
  const m46 = man(1980);
  assert.equal(m46.de_checkup, 'due');
  assert.equal(m46.de_prostate, 'due');
  assert.equal(m46.de_colonoscopy, 'upcoming');
  assert.equal(m46.fi_bowel, 'upcoming');
  assert.equal(m46.de_mammo, undefined, 'sex-specific');
  assert.equal(m46.de_lung, undefined, 'only for smokers');
  assert.equal(man(1980, [{ kind: 'screening', screen: 'de_checkup', date: '2025-01-10' }]).de_checkup, 'ok');
  assert.equal(man(1980, [{ kind: 'screening', screen: 'de_checkup', date: '2023-11-01' }]).de_checkup, 'soon');
  const m60 = man(1966, [{ kind: 'screening', screen: 'de_colonoscopy', date: '2020-05-01' }]);
  assert.deepEqual([m60.de_colonoscopy, m60.de_ifobt, m60.fi_bowel], ['ok', 'ok', 'invite'], 'colonoscopy covers the stool test; Finland invites');
  assert.equal(man(1966, [], { smoker: 'yes' }).de_lung, 'due');
  assert.deepEqual(screeningStatus({}, [], today), [], 'needs a profile');
});

test('reminders and retest suggestions', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  const st = { byMetric: data([['ferritin', '2026-05-12', 27]]), events: [], findings: [] };
  const r = { kind: 'reminder', date: '2026-11-20', keys: ['ferritin'], created: '2026-05-25T09:00:00Z' };
  assert.equal(reminderStatus(r, st, '2026-10-19'), 'later');
  assert.equal(reminderStatus(r, st, '2026-10-25'), 'soon');
  assert.equal(reminderStatus(r, st, '2026-12-01'), 'overdue');
  st.byMetric = data([['ferritin', '2026-05-12', 27], ['ferritin', '2026-11-02', 45]]);
  assert.equal(reminderStatus(r, st, '2026-12-01'), 'done', 'a newer result clears it');
  const st2 = { byMetric: data([['tsh', '2026-05-12', 4.4], ['ft4', '2026-05-12', 15]]), events: [],
    findings: [{ keys: ['tsh', 'ft4'], title: 'Pattern of subclinical hypothyroidism', retest: { months: 3, what: 'TSH, free T4 and TPO antibodies', source: 'eta2013' } }] };
  assert.deepEqual(retestSuggestions(st2).map((s) => [s.due, s.what]), [['2026-08-12', 'TSH, free T4 and TPO antibodies']]);
  st2.events.push({ kind: 'reminder', keys: ['tsh'], date: '2026-08-12', created: '2026-05-20T00:00:00Z' });
  assert.equal(retestSuggestions(st2).length, 0, 'not suggested once a reminder exists');
});

test('timeline and illness periods', () => {
  const st = {
    reports: [{ id: 'r1', date: '2026-05-12', lab: 'Lab', type: 'lab' }], obsByReport: new Map([['r1', [{}, {}]]]),
    vaccines: [{ id: 'v', date: '2025-11-03', name: 'Comirnaty' }], dental: [],
    meds: [{ id: 'm', kind: 'medicine', name: 'Retafer', start: '2026-05-25', stop: '2026-08-01' }],
    events: [{ id: 'e', kind: 'illness', title: 'Flu', date: '2025-02-03', end: '2025-02-10' }, { id: 'x', kind: 'reminder', title: 'Repeat', date: '2027-01-01' }],
  };
  assert.deepEqual(timelineItems(st).map((x) => x.title), ['Stopped Retafer', 'Started Retafer', 'Lab results · Lab', 'Vaccination: Comirnaty', 'Flu']);
  assert.deepEqual(illnessPeriods(st.events), [{ start: '2025-02-03', end: '2025-02-10', label: 'Flu (3 Feb 2025)', kind: 'ill' }]);
});

test('two-value charts: smoothing and correlation', async () => {
  const { smooth, correlation, correlationText } = await import('../js/compare.js');
  const day = (i) => Date.UTC(2026, 0, 1) + i * 864e5;
  const a = Array.from({ length: 30 }, (_, i) => ({ t: day(i), v: 50 + (i % 5) }));
  const b = a.map((p) => ({ t: p.t, v: 8 - (p.v - 50) * 0.2 }));
  const c = correlation(a, b, 0);
  assert.equal(c.n, 30);
  assert.ok(c.r < -0.99, 'perfect negative link');
  assert.match(correlationText(c, { name: 'Night-time heart rate' }, { name: 'Sleep' }), /^A strong link \(r = -1.00, 30 pairs\): higher night-time heart rate tends to go with lower sleep/);
  assert.equal(correlation(a.slice(0, 5), b.slice(0, 5), 0), null, 'needs 8 pairs');
  assert.equal(correlation(a, b.map((p) => ({ ...p, t: p.t + 10 * 864e5 })).slice(20), 3), null, 'pairs must be close in time');
  const sm = smooth([{ t: day(0), v: 10 }, { t: day(1), v: 20 }, { t: day(10), v: 30 }], 7);
  assert.deepEqual(sm.map((p) => p.v), [10, 15, 30]);
});

test('summary for the doctor: tests and diagnoses', async () => {
  const { summaryTests, diagnosesFrom } = await import('../js/print.js');
  const by = data([['hb', '2025-01-10', 150], ['hb', '2026-05-12', 140], ['ferritin', '2026-05-12', 27, 'µg/L', '30–400'], ['mcv', '2026-05-12', 88],
    ['bmi', '2026-04-21', 26.3], ['bmi_calc', '2026-09-28', 26.1], ['qtc', '2026-05-12', 430], ['chol', '2019-01-01', 6]]);
  const t = summaryTests(by, { today: '2026-10-19' });
  assert.deepEqual(t.map((x) => x.e.m.key).sort(), ['bmi_calc', 'ferritin', 'hb'], 'key tests and flagged ones, newer BMI only, no ECG values, nothing older than 2 years');
  const hb = t.find((x) => x.e.m.key === 'hb');
  assert.equal(hb.trend, '↓');
  assert.deepEqual(hb.prev.map((p) => p.v), [150]);
  assert.ok(summaryTests(by, { mode: 'all', today: '2026-10-19' }).some((x) => x.e.m.key === 'mcv'), 'all tests mode');
  const d = diagnosesFrom([{ date: '2025-04-10', diagnoses: ['Palpitations'], specialty: 'Cardiology' }, { date: '2026-05-20', diagnoses: ['Low iron stores', 'palpitations '] }]);
  assert.deepEqual(d.map((x) => [x.text, x.date]), [['Low iron stores', '2026-05-20'], ['palpitations', '2026-05-20']]);
});

test('lab reports: urine rows, qualitative values, several formulas, two units', async () => {
  const { parseExtraction, buildPrompt } = await import('../js/parse.js');
  const { matchMetric, isUrineName } = await import('../js/metrics.js');
  const { evaluate } = await import('../js/evaluate.js');
  assert.equal(matchMetric('Hämoglobin (Urin)', ''), null);
  assert.equal(matchMetric('Protein (Urin)', ''), null);
  assert.equal(matchMetric('Harnsäure', 'mg/dL'), 'uric', 'Harnsäure is a blood test');
  assert.equal(matchMetric('Сечовина', 'ммоль/л'), 'urea', 'сечовина is a blood test');
  assert.equal(isUrineName('Сеча: білок'), true);
  assert.equal(matchMetric('Remnant-Cholesterin', 'mg/dL'), 'remnant');
  assert.equal(matchMetric('Cholesterin', 'mg/dL'), 'chol');
  const res = parseExtraction('```json\n' + JSON.stringify({ date: '2026-03-02', lab: 'Testlabor', results: [
    { name: 'Leukozyten', metric: 'wbc', value: 'negativ', unit: '', ref: 'negativ' },
    { name: 'Leukozyten', metric: 'wbc', value: '6,1', unit: 'G/L', ref: '3,5 - 9,8' },
    { name: 'Hämoglobin (Urin)', metric: 'hb', value: 'negativ', unit: '' },
    { name: 'GFR nach der MDRD-Kurzformel', metric: 'egfr', value: '>60', unit: 'ml/min/1,73m2KOF' },
    { name: 'GFR nach der CKD-EPI-Formel', metric: 'egfr', value: '88', unit: 'ml/min/1,73m2 KOF', ref: '80 - 140' },
    { name: 'HbA1c', metric: 'hba1c', value: '5,2', unit: '%' },
    { name: 'HbA1c', metric: 'hba1c', value: '33,3', unit: 'mmol/mol Hb' },
  ] }) + '\n```');
  const rows = res.rows.map((r) => [r.name, r.metric]);
  assert.deepEqual(rows, [
    ['Leukozyten', ''], ['Leukozyten', 'wbc'], ['Hämoglobin (Urin)', ''],
    ['GFR nach der MDRD-Kurzformel', 'custom:gfr-nach-der-mdrd-kurzformel'], ['GFR nach der CKD-EPI-Formel', 'egfr'],
    ['HbA1c', 'hba1c'],
  ], 'urine and "negativ" rows leave the blood keys; CKD-EPI keeps eGFR; HbA1c once, in mmol/mol');
  assert.equal(res.rows.at(-1).unit, 'mmol/mol Hb');
  const p = buildPrompt('lab');
  assert.match(p, /not the doctor who validated/);
  assert.match(p, /Leukozyten \(Urin\)/);
  assert.match(p, /only for CKD-EPI/);
  const by = data([['egfr', '2026-03-02', 76]]);
  assert.ok(evaluate(by, {}, Date.parse('2026-10-19')).some((f) => f.title === 'eGFR 76: category G2 (mildly decreased)'));
  assert.ok(!evaluate(data([['egfr', '2026-03-02', 95]]), {}, Date.parse('2026-10-19')).some((f) => /G2/.test(f.title)));
});

test('qualitative results, and tidying results saved earlier', async () => {
  const { qualitative, textStatus, tidyStored } = await import('../js/parse.js');
  const { demoData } = await import('../js/demo.js');
  assert.deepEqual(['negativ', 'Negative', 'neg.', '+++', 'Spuren', 'nicht nachweisbar', 'не виявлено', '5,3'].map(qualitative), ['neg', 'neg', 'neg', 'pos', 'trace', 'neg', 'neg', null]);
  assert.equal(textStatus('negativ', 'negativ'), 'normal');
  assert.equal(textStatus('positiv', 'negativ'), 'abnormal');
  assert.equal(textStatus('Spuren', 'negativ'), 'abnormal');
  assert.equal(textStatus('6,1', '3,5 - 9,8'), null);
  const p = point({ id: 'u', reportId: 'r', date: '2026-03-02', metric: 'custom:nitrit-urin', name: 'Nitrit (Urin)', valueRaw: 'positiv', unit: '', refRaw: 'negativ', flag: '' }, null);
  assert.equal(p.status, 'abnormal');
  const { obs } = demoData();
  assert.deepEqual(tidyStored(obs), { put: [], del: [] }, 'nothing to change in clean data');
  const saved = [
    { id: '1', reportId: 'r', date: '2026-03-02', metric: 'hb', name: 'Hämoglobin (Urin)', valueRaw: 'negativ', unit: '', refRaw: 'negativ' },
    { id: '2', reportId: 'r', date: '2026-03-02', metric: 'hb', name: 'Hämoglobin', valueRaw: '15,4', unit: 'g/dL', refRaw: '' },
    { id: '3', reportId: 'r', date: '2026-03-02', metric: 'egfr', name: 'GFR nach der Mayo-Klinik-Formel', valueRaw: '95', unit: 'ml/min' },
    { id: '4', reportId: 'r', date: '2026-03-02', metric: 'egfr', name: 'GFR nach der CKD-EPI-Formel', valueRaw: '76', unit: 'ml/min' },
    { id: '5', reportId: 'r', date: '2026-03-02', metric: 'hba1c', name: 'HbA1c', valueRaw: '5,4', unit: '%' },
    { id: '6', reportId: 'r', date: '2026-03-02', metric: 'hba1c', name: 'HbA1c', valueRaw: '35,5', unit: 'mmol/mol Hb' },
    { id: '7', reportId: 'r', date: '2026-03-02', metric: 'wbc', name: 'Leukozyten', valueRaw: 'negativ', unit: '' },
  ];
  const fix = tidyStored(saved);
  assert.deepEqual(fix.put.map((o) => [o.id, o.metric]).sort(), [['1', 'custom:hamoglobin-urin'], ['3', 'custom:gfr-nach-der-mayo-klinik-formel'], ['7', 'custom:leukozyten']]);
  assert.deepEqual(fix.del, ['5']);
  assert.deepEqual(tidyStored(saved.filter((o) => o.id !== '5').map((o) => fix.put.find((x) => x.id === o.id) ?? o)), { put: [], del: [] }, 'running it again changes nothing');
});

test('German report names, English names for unknown tests, re-matching saved own tests', async () => {
  const { matchMetric } = await import('../js/metrics.js');
  const { parseExtraction, tidyStored } = await import('../js/parse.js');
  const cases = [['Haematokrit', '%', 'hct'], ['HbE (MCH)', 'pg/Ery', 'mch'], ['Erythrozyten-Vert.', '%', 'rdw'], ['Erythrozyten', '10^12/l', 'rbc'],
    ['Unreife Granulozyten', '%', 'ig_pct'], ['Unreife Granulozyten', '10^9/l', 'ig_abs'], ['Anteil hypochromer Erys', '%', 'hypo'],
    ['Reti-Produkt.-Index(RPI)', 'Index', 'rpi'], ['Retikulozytenhämoglobin', 'pg/Reti', 'ret_he'], ['Harnsaeure (Serum)', 'mg/dl', 'uric'],
    ['Alk. Phosphatase', 'U/l', 'alp'], ['IgG', 'g/l', null]];
  for (const [n, u, k] of cases) assert.equal(matchMetric(n, u, 1), k, n);
  const res = parseExtraction('```json\n{"date": "2025-07-09", "lab": "Testlabor", "results": [{"name": "Glasmarker X", "name_en": "Glass marker X", "metric": null, "value": "3", "unit": "U/l"}]}\n```');
  assert.equal(res.rows[0].nameEn, 'Glass marker X');
  const saved = [
    { id: 'a', reportId: 'r', date: '2025-07-09', metric: 'custom:unreife-granulozyten', name: 'Unreife Granulozyten', valueRaw: '1', unit: '%' },
    { id: 'b', reportId: 'r', date: '2025-07-09', metric: 'custom:unreife-granulozyten', name: 'Unreife Granulozyten', valueRaw: '0.07', unit: '10^9/l' },
    { id: 'c', reportId: 'r', date: '2025-07-09', metric: 'custom:retikulozytenhamoglobin', name: 'Retikulozytenhämoglobin', valueRaw: '34.3', unit: 'pg/Reti' },
    { id: 'd', reportId: 'r', date: '2025-07-09', metric: 'custom:glasmarker-x', name: 'Glasmarker X', valueRaw: '3', unit: 'U/l' },
  ];
  assert.deepEqual(tidyStored(saved).put.map((o) => [o.id, o.metric]), [['a', 'ig_pct'], ['b', 'ig_abs'], ['c', 'ret_he']]);
  const custom = point({ id: 'x', reportId: 'r', date: '2025-07-09', metric: 'custom:glasmarker-x', name: 'Glasmarker X', nameEn: 'Glass marker X', valueRaw: '3', unit: 'U/l' }, null);
  assert.equal(custom.raw, 3);
});
