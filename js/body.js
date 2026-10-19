// Body: weight, waist and body composition (InBody, Tanita and other analysers),
// with a quick entry for scale and tape-measure readings.

import { h, go, toast, uid } from './dom.js';
import { state, saveReport } from './store.js';
import { pageHead, valueText } from './ui.js';
import { findingItem } from './insights.js';
import { lineChart, sparkline } from './chart.js';
import { fmtNum, fmtDate, todayIso } from './format.js';
import { metricRow, reportRow } from './views.js';
import { parseNumber } from './parse.js';

export const BODY_GROUPS = [
  ['Weight and size', ['weight', 'height', 'bmi', 'bmi_calc', 'waist', 'hip', 'waist_hip', 'whtr_calc', 'target_weight']],
  ['Fat', ['body_fat_pct', 'fat_mass', 'fmi', 'visceral_fat_area', 'visceral_fat_level']],
  ['Muscle and lean mass', ['muscle_mass', 'lean_mass', 'soft_lean', 'body_protein', 'body_minerals', 'bone_mineral', 'body_cell_mass']],
  ['Body water', ['body_water', 'icw', 'ecw', 'ecw_tbw']],
  ['Arms, trunk and legs', ['lean_arm_r', 'lean_arm_l', 'lean_trunk', 'lean_leg_r', 'lean_leg_l', 'fat_arm_r', 'fat_arm_l', 'fat_trunk', 'fat_leg_r', 'fat_leg_l']],
  ['Other device values', ['bmr', 'phase_angle', 'body_age', 'body_score']],
];
const TILES = ['weight', ['bmi', 'bmi_calc'], 'body_fat_pct', 'waist', 'muscle_mass', 'visceral_fat_area'];

// Fields of the quick entry, with plausible limits.
const QUICK = [
  ['weight', 'Weight', 'kg', 20, 400],
  ['waist', 'Waist', 'cm', 40, 250],
  ['hip', 'Hip', 'cm', 40, 250],
  ['body_fat_pct', 'Body fat', '%', 2, 75],
];

export const isBodyRecord = (r) => r.type === 'body';

// The newer of two entries (e.g. measured BMI vs. BMI calculated from weight).
function latestOf(keys) {
  const es = [].concat(keys).map((k) => state.byMetric.get(k)).filter(Boolean);
  return es.sort((a, b) => b.last.t - a.last.t)[0] ?? null;
}

function tile(keys) {
  const e = latestOf(keys);
  if (!e) return null;
  const num = e.pts.filter((p) => p.v != null);
  const last = num.at(-1) ?? e.last;
  const prev = num.at(-2);
  const d = prev && last.v != null ? last.v - prev.v : null;
  const digits = Math.abs(d ?? 0) < 1 ? 2 : 1;
  return h('a', { class: 'tile', href: `#/test/${encodeURIComponent(e.m.key)}` },
    h('div', { class: 'tile-label' }, e.m.name.replace(' (body mass index)', '').replace(' (calculated)', '')),
    h('div', { class: 'tile-value' }, valueText(last, e.m.unit)),
    h('div', { class: 'tile-delta' }, d == null ? fmtDate(last.o.date)
      : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtNum(+Math.abs(d).toFixed(digits))} since ${fmtDate(prev.o.date)}`),
    sparkline(num));
}

function quickEntry() {
  const f = { date: todayIso(), note: '' };
  const field = ([key, label, unit]) => h('label', null, h('span', null, `${label} (${unit})`),
    h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `${label} in ${unit}`, oninput: (e) => { f[key] = e.target.value; } }));
  return h('form', { class: 'card bp-form', onsubmit: async (e) => {
    e.preventDefault();
    const report = { id: uid(), type: 'body', date: f.date, lab: 'Own measurement', note: f.note.trim(), files: [], source: 'manual', created: new Date().toISOString() };
    const obs = [];
    for (const [key, label, unit, lo, hi] of QUICK) {
      if (!String(f[key] ?? '').trim()) continue;
      const v = parseNumber(f[key]);
      if (v == null || v < lo || v > hi) { toast(`Check ${label.toLowerCase()}: ${lo}–${hi} ${unit}`); return; }
      obs.push({ id: uid(), reportId: report.id, date: f.date, metric: key, name: label, valueRaw: String(v), unit, refRaw: '', flag: '' });
    }
    if (!f.date) { toast('Set the date'); return; }
    if (!obs.length) { toast('Enter at least one value'); return; }
    report.updated = report.created;
    await saveReport(report, obs);
    toast(`Saved ${obs.map((o) => `${o.valueRaw} ${o.unit}`).join(', ')}`);
    go('#/body');
  } },
    h('h2', null, 'New measurement'),
    h('div', { class: 'bp-nums' }, QUICK.slice(0, 2).map(field)),
    h('div', { class: 'bp-nums' }, QUICK.slice(2).map(field)),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Date'), h('input', { type: 'date', value: f.date, oninput: (e) => { f.date = e.target.value; } })),
      h('label', null, h('span', null, 'Note'), h('input', { type: 'text', placeholder: 'optional, e.g. morning, before breakfast', oninput: (e) => { f.note = e.target.value; } }))),
    h('div', null, h('button', { class: 'btn primary', type: 'submit' }, 'Save measurement')));
}

export function viewBody(root) {
  root.append(pageHead('Body', { sub: 'Weight, waist and body composition',
    actions: [h('a', { class: 'btn primary', href: '#/add/body' }, '+ Body composition report')] }));

  const keys = new Set(BODY_GROUPS.flatMap(([, ks]) => ks));
  const has = [...keys].some((k) => state.byMetric.has(k));
  const records = state.reports.filter(isBodyRecord).sort((a, b) => b.date.localeCompare(a.date));
  const needHeight = !state.profile.height && !state.byMetric.has('height') && (state.byMetric.has('weight') || state.byMetric.has('waist'));

  if (!has) {
    root.append(h('div', { class: 'split' },
      h('section', { class: 'card empty' },
        h('h2', null, 'No body measurements yet'),
        h('p', null, 'Add a body composition report (InBody, Tanita, a gym or clinic printout): attach the PDF or photo and let Claude read the values. Or enter weight and waist below — BMI and waist-to-height ratio are calculated from the height in your profile.'),
        h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: '#/add/body' }, 'Add a report'), h('a', { class: 'btn', href: '#/data' }, 'Set your height'))),
      quickEntry()));
    return;
  }

  const tiles = TILES.map(tile).filter(Boolean);
  if (tiles.length) root.append(h('div', { class: 'tiles' }, tiles));
  if (needHeight) {
    root.append(h('a', { class: 'card hint-card', href: '#/data' },
      h('div', { class: 'tile-label' }, 'Add your height'), h('span', { class: 'muted small' }, 'In your profile, to calculate BMI and waist-to-height ratio')));
  }

  const findings = state.findings.filter((f) => f.keys.some((k) => keys.has(k)) && (f.level !== 'good' || f.kind === 'guideline'));
  const weight = state.byMetric.get('weight');
  const chartCard = h('section', { class: 'card' }, h('h2', null, 'Weight'));
  root.append(h('div', { class: 'split' },
    h('div', { class: 'stack' },
      findings.length ? h('section', { class: 'card findings' }, h('h2', null, 'What this means'),
        findings.map((f) => findingItem(f, { link: `#/test/${encodeURIComponent(f.keys[0])}` }))) : null,
      weight ? chartCard : null),
    quickEntry()));
  if (weight) lineChart(chartCard, { pts: weight.pts.map((p) => ({ ...p, lab: state.reportById.get(p.o.reportId)?.lab ?? '' })), unit: 'kg', height: 200 });

  const groups = BODY_GROUPS.map(([title, ks]) => {
    const rows = ks.map((k) => state.byMetric.get(k)).filter(Boolean).map(metricRow);
    return rows.length ? h('section', { class: 'group' }, h('h2', null, title), h('div', { class: 'card list' }, rows)) : null;
  }).filter(Boolean);
  root.append(h('div', { class: 'overview-grid' }, groups));

  root.append(h('section', { class: 'group' }, h('h2', null, `Measurements (${records.length})`),
    records.length ? h('div', { class: 'card list' }, records.map(reportRow)) : h('p', { class: 'muted pad' }, 'No reports yet.')));
  root.append(h('p', { class: 'muted small pad' }, 'Body composition devices estimate fat, muscle and water from a weak electric current. Results shift with hydration, meals, exercise and time of day, and differ between devices — compare measurements made the same way.'));
}
