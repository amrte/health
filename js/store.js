// In-memory copy of the database plus everything derived from it.
//
// Results are stored as printed (value, unit and reference range as text), and
// parsed and converted here on load. Improvements to parsing or the catalogue
// therefore apply to old records too.

import * as db from './db.js';
import { getMetric, normName, CATEGORY_NAME } from './metrics.js';
import { normUnit, convert } from './units.js';
import { parseValue, parseRange, textStatus, tidyStored } from './parse.js';
import { dateMs } from './format.js';
import { calculatedObs } from './calc.js';
import { evaluate } from './evaluate.js';
import { dnaLabFindings } from './dna-eval.js';
import { medFindings, drugGroups, takenOn } from './meds-data.js';
import { assessRisk, riskFindings } from './score2.js';
import { homeAverage } from './bp-eval.js';
import { todayIso } from './format.js';

export const state = {
  reports: [],
  obs: [],
  vaccines: [],
  profile: {}, // { sex: 'female' | 'male' | '', birthYear }
  measures: [], // daily values from devices: { id, date, kind, value, source }
  workouts: [], // { id, start, sport, durationS, distanceM, hrAvg, hrMax, kcal, load, source }
  bp: [], // { id, time: 'YYYY-MM-DDTHH:MM', sys, dia, pulse, arm, place: 'home' | 'clinic', note, source }
  genomes: [], // { id, provider, fileName, importedAt, build, total, snps: { rsid: genotype } }
  meds: [], // { id, kind: 'medicine' | 'supplement' | 'allergy', name, ingredient, dose, schedule, reason, start, stop, reaction, severity, note }
  events: [], // timeline: { id, kind, date, end, title, note } — illnesses, surgeries, travel, reminders, screenings
  dental: [], // visits: { id, date, clinic, dentist, currency, total, nextCheckup, note, items: [{ tooth, procedure, surfaces, … }], files }
  findings: [],
  reportById: new Map(),
  byMetric: new Map(), // key → { m, pts }
  obsByReport: new Map(),
};

export async function load() {
  let profile;
  [state.reports, state.obs, state.vaccines, profile, state.measures, state.workouts, state.bp, state.genomes, state.dental, state.meds, state.events] = await Promise.all([
    db.getAll('reports'), db.getAll('obs'), db.getAll('vaccines'), db.get('settings', 'profile'),
    db.getAll('measures'), db.getAll('workouts'), db.getAll('bp'), db.getAll('genomes'), db.getAll('dental'), db.getAll('meds'), db.getAll('events')]);
  state.profile = profile ?? {};
  // Results saved before a matching rule was fixed (e.g. urine values on blood tests).
  const fix = tidyStored(state.obs);
  if (fix.put.length || fix.del.length) {
    await db.write({ put: { obs: fix.put }, del: { obs: fix.del } });
    state.obs = await db.getAll('obs');
  }
  derive();
}

export function statusOf(v, lo, hi, flag) {
  if (v != null) {
    if (lo != null && v < lo) return 'low';
    if (hi != null && v > hi) return 'high';
    if (lo != null || hi != null) return 'normal';
  }
  if (flag === 'H') return 'high';
  if (flag === 'L') return 'low';
  return 'none';
}

// Synthetic catalogue entry for a test the catalogue doesn't know.
function customMetric(key, list) {
  const latest = list.reduce((a, b) => (a.date >= b.date ? a : b));
  const counts = new Map();
  for (const o of list) counts.set(normUnit(o.unit), (counts.get(normUnit(o.unit)) ?? 0) + 1);
  const cu = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const unit = list.find((o) => normUnit(o.unit) === cu)?.unit ?? '';
  return { key, cat: 'other', name: latest.name || key.slice(7), unit, cu, altN: {}, custom: true, aliases: [] };
}

// One result with its parsed and converted values.
export function point(o, m) {
  const pv = parseValue(o.valueRaw);
  const rg = parseRange(o.refRaw);
  const v = m ? convert(pv.value, o.unit, m) : null;
  return {
    o,
    m,
    t: dateMs(o.date),
    raw: pv.value,
    qualifier: pv.qualifier,
    text: pv.text,
    v,
    lo: m ? convert(rg.low, o.unit, m) : null,
    hi: m ? convert(rg.high, o.unit, m) : null,
    converted: !!m && pv.value != null && normUnit(o.unit) !== m.cu && normUnit(o.unit) !== '',
    unconvertible: pv.value != null && v == null,
    status: (pv.value == null && textStatus(o.valueRaw, o.refRaw)) || statusOf(pv.value, rg.low, rg.high, o.flag || pv.flag),
  };
}

export function derive() {
  state.reportById = new Map(state.reports.map((r) => [r.id, r]));
  const groups = new Map();
  state.obsByReport = new Map();
  for (const o of state.obs) {
    if (!groups.has(o.metric)) groups.set(o.metric, []);
    groups.get(o.metric).push(o);
    if (!state.obsByReport.has(o.reportId)) state.obsByReport.set(o.reportId, []);
    state.obsByReport.get(o.reportId).push(o);
  }
  state.byMetric = new Map();
  const add = (key, list) => {
    const m = getMetric(key) ?? customMetric(key, list);
    const pts = list.map((o) => point(o, m)).sort((a, b) => a.t - b.t);
    state.byMetric.set(key, { m, pts, last: pts[pts.length - 1] });
  };
  for (const [key, list] of groups) add(key, list);
  const calc = new Map();
  for (const o of calculatedObs((key) => state.byMetric.get(key)?.pts ?? [], state.profile)) {
    if (!calc.has(o.metric)) calc.set(o.metric, []);
    calc.get(o.metric).push(o);
  }
  for (const [key, list] of calc) add(key, list);
  state.findings = evaluate(state.byMetric, state.profile).concat(dnaLabFindings(state.genomes, state.byMetric, state.profile), medFindings(state.meds, state.genomes, todayIso()), riskFindings(riskNow()))
    // With a personal LDL goal from SCORE2, the generic "depends on your risk" note is redundant.
    .filter((f, _, all) => !(f.kind === 'guideline' && f.keys[0] === 'ldl' && f.level !== 'alert' && all.some((x) => x.kind === 'risk' && x.keys.includes('ldl'))))
    .sort((a, b) => ['alert', 'attention', 'info', 'good'].indexOf(a.level) - ['alert', 'attention', 'info', 'good'].indexOf(b.level));
}

// SCORE2 for the current data (see score2.js).
export function riskNow() {
  const today = todayIso();
  return assessRisk({ profile: state.profile, byMetric: state.byMetric, bp: state.bp, homeAvg: homeAverage(state.bp), today,
    statinOn: (date) => state.meds.some((m) => takenOn(m, date) && drugGroups(m).has('statin')) });
}

export function findingsFor(key) {
  return state.findings.filter((f) => f.keys.includes(key));
}

export async function saveProfile(profile) {
  await db.write({ put: { settings: [{ id: 'profile', ...profile }] } });
  await load();
}

export function metricOf(key) {
  return state.byMetric.get(key)?.m ?? getMetric(key);
}

export function reportPoints(reportId) {
  return (state.obsByReport.get(reportId) ?? []).map((o) => point(o, metricOf(o.metric)));
}

// Search over test names (catalogue names, aliases, printed names), labs and notes.
export function matches(query, ...texts) {
  const words = normName(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = normName(texts.flat().join(' '));
  return words.every((w) => hay.includes(w));
}

export function metricSearchText(entry) {
  const names = new Set(entry.pts.map((p) => p.o.name));
  return [entry.m.name, entry.m.key, CATEGORY_NAME[entry.m.cat], ...(entry.m.aliases ?? []), ...names];
}

export function reportSearchText(r) {
  const obs = state.obsByReport.get(r.id) ?? [];
  return [r.lab, r.note, r.date, r.type, r.doctor, r.specialty, r.summary, r.conclusion, ...(r.diagnoses ?? []), ...(r.recommendations ?? []), ...(r.medications ?? []),
    ...obs.map((o) => o.name), ...obs.map((o) => metricOf(o.metric)?.name ?? '')];
}

// ---- writes --------------------------------------------------------------

export async function saveReport(report, obs, { newFiles = [], removedFileIds = [] } = {}) {
  const oldIds = (state.obsByReport.get(report.id) ?? []).map((o) => o.id);
  const keep = new Set(obs.map((o) => o.id));
  await db.write({
    put: { reports: [report], obs, files: newFiles },
    del: { obs: oldIds.filter((id) => !keep.has(id)), files: removedFileIds },
  });
  await load();
}

export async function deleteReport(id) {
  const r = state.reportById.get(id);
  await db.write({
    del: {
      reports: [id],
      obs: (state.obsByReport.get(id) ?? []).map((o) => o.id),
      files: (r?.files ?? []).map((f) => f.id),
    },
  });
  await load();
}

// Vaccinations saved together share their photos, so a photo is only deleted
// once no vaccination refers to it any more.
function unusedFiles(ids, exceptVaccineIds) {
  const skip = new Set(exceptVaccineIds);
  const used = new Set(state.vaccines.filter((v) => !skip.has(v.id)).flatMap((v) => (v.files ?? []).map((f) => f.id)));
  return ids.filter((id) => !used.has(id));
}

export async function saveVaccines(items, { newFiles = [], removedFileIds = [] } = {}) {
  await db.write({
    put: { vaccines: items, files: newFiles },
    del: { files: unusedFiles(removedFileIds, items.map((v) => v.id)) },
  });
  await load();
}

export async function deleteVaccine(id) {
  const v = state.vaccines.find((x) => x.id === id);
  await db.write({ del: { vaccines: [id], files: unusedFiles((v?.files ?? []).map((f) => f.id), [id]) } });
  await load();
}

// Device data is keyed by source, kind and date, so re-importing replaces instead of duplicating.
export async function saveFitness({ measures = [], workouts = [] }) {
  await db.write({ put: { measures, workouts } });
  await load();
}

export async function deleteFitness(source) {
  await db.write({ del: {
    measures: state.measures.filter((m) => !source || m.source === source).map((m) => m.id),
    workouts: state.workouts.filter((w) => !source || w.source === source).map((w) => w.id),
  } });
  await load();
}

export async function saveBp(readings) {
  await db.write({ put: { bp: readings } });
  await load();
}

export async function deleteBp(ids) {
  await db.write({ del: { bp: ids } });
  await load();
}

export async function saveGenome(genome) {
  await db.write({ put: { genomes: [genome] } });
  await load();
}

export async function deleteGenome(id) {
  await db.write({ del: { genomes: [id] } });
  await load();
}

export async function saveDental(visit, { newFiles = [], removedFileIds = [] } = {}) {
  await db.write({ put: { dental: [visit], files: newFiles }, del: { files: removedFileIds } });
  await load();
}

export async function deleteDental(id) {
  const v = state.dental.find((x) => x.id === id);
  await db.write({ del: { dental: [id], files: (v?.files ?? []).map((f) => f.id) } });
  await load();
}

export async function saveMeds(items) {
  await db.write({ put: { meds: items } });
  await load();
}

export async function deleteMed(id) {
  await db.write({ del: { meds: [id] } });
  await load();
}

export async function saveEvents(items) {
  await db.write({ put: { events: items } });
  await load();
}

export async function deleteEvent(id) {
  await db.write({ del: { events: [id] } });
  await load();
}
