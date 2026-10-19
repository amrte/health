// Two values on one chart: any test, watch value, blood pressure or weekly
// workout minutes, each on its own scale, with a correlation where enough
// pairs exist.

import { h, go } from './dom.js';
import { state } from './store.js';
import { pageHead } from './ui.js';
import { dualChart } from './chart.js';
import { CATEGORY_NAME } from './metrics.js';
import { KINDS, series, weeklyMinutes } from './fitness.js';
import { bpDays } from './bp.js';
import { fmtNum } from './format.js';

const DAY = 864e5;
// Lower-case a name for use mid-sentence, but keep abbreviations (LDL, HbA1c, TSH).
const lower = (name) => (/^[A-Z][A-Z0-9]/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

// Everything that can be charted: { id, name, unit, group, daily, pts }.
export function compareOptions(st = state) {
  const out = [];
  for (const [kind, k] of Object.entries(KINDS)) {
    if (!st.measures.some((m) => m.kind === kind)) continue;
    out.push({ id: `fit:${kind}`, name: k.name, unit: k.unit, group: 'Watch', daily: true, pts: () => series(kind) });
  }
  if (st.bp.length) {
    const days = () => bpDays(st.bp);
    out.push({ id: 'bp:sys', name: 'Blood pressure, upper (daily average)', unit: 'mmHg', group: 'Blood pressure', daily: true, pts: () => days().map((d) => ({ t: d.t, v: d.sys, o: { date: new Date(d.t).toISOString().slice(0, 10) } })) });
    out.push({ id: 'bp:dia', name: 'Blood pressure, lower (daily average)', unit: 'mmHg', group: 'Blood pressure', daily: true, pts: () => days().map((d) => ({ t: d.t, v: d.dia, o: { date: new Date(d.t).toISOString().slice(0, 10) } })) });
  }
  if (st.workouts.length) {
    out.push({ id: 'wk:min', name: 'Workout minutes per week', unit: 'min', group: 'Watch', daily: false,
      pts: () => weeklyMinutes().map((w) => ({ t: w.t, v: w.v, o: { date: new Date(w.t).toISOString().slice(0, 10) } })) });
  }
  for (const e of [...st.byMetric.values()].sort((a, b) => a.m.name.localeCompare(b.m.name))) {
    if (!e.pts.some((p) => p.v != null)) continue;
    out.push({ id: `test:${e.m.key}`, name: e.m.name, unit: e.m.unit, group: CATEGORY_NAME[e.m.cat] ?? 'Tests', daily: false, pts: () => e.pts.filter((p) => p.v != null) });
  }
  return out;
}

export const PRESETS = [
  ['fit:night_hr', 'fit:sleep_min', 'Night-time heart rate & sleep'],
  ['bp:sys', 'test:weight', 'Blood pressure & weight'],
  ['fit:rhr', 'fit:hrv', 'Resting heart rate & HRV'],
  ['fit:steps', 'fit:sleep_min', 'Steps & sleep'],
  ['test:ferritin', 'test:hb', 'Ferritin & hemoglobin'],
  ['test:hba1c', 'test:weight', 'HbA1c & weight'],
  ['test:ldl', 'test:weight', 'LDL & weight'],
  ['test:tsh', 'test:ft4', 'TSH & free T4'],
];

// 7-day rolling average for noisy daily values.
export function smooth(pts, days = 7) {
  return pts.map((p, i) => {
    const win = [];
    for (let j = i; j >= 0 && p.t - pts[j].t < days * DAY; j--) win.push(pts[j].v);
    return { ...p, v: win.reduce((a, b) => a + b, 0) / win.length };
  });
}

// Pearson correlation of values paired by date (same day for daily data,
// within `maxDays` otherwise). Returns { r, n } or null with fewer than 8 pairs.
export function correlation(a, b, maxDays) {
  const pairs = [];
  let j = 0;
  for (const p of a) {
    while (j + 1 < b.length && Math.abs(b[j + 1].t - p.t) <= Math.abs(b[j].t - p.t)) j++;
    if (b[j] && Math.abs(b[j].t - p.t) <= maxDays * DAY) pairs.push([p.v, b[j].v]);
  }
  if (pairs.length < 8) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

export function correlationText(c, a, b) {
  if (!c) return '';
  const abs = Math.abs(c.r);
  const strength = abs < 0.2 ? 'No clear' : abs < 0.4 ? 'A weak' : abs < 0.7 ? 'A moderate' : 'A strong';
  const dir = abs < 0.2 ? '' : c.r > 0 ? `: higher ${lower(a.name)} tends to go with higher ${lower(b.name)}` : `: higher ${lower(a.name)} tends to go with lower ${lower(b.name)}`;
  return `${strength} link (r = ${c.r.toFixed(2)}, ${c.n} pairs)${dir}. A correlation doesn’t show that one causes the other.`;
}

// -1: the period where both values have data.
const RANGES = [['Where both have data', -1], ['90 days', 90], ['1 year', 365], ['5 years', 1826], ['All', 0]];
let range = null;
let smoothDaily = true;

export function viewCompare(root, aId, bId) {
  const options = compareOptions();
  root.append(pageHead('Compare two values', { back: '#/fitness', sub: 'Two values on one timeline, each with its own scale' }));
  if (options.length < 2) { root.append(h('p', { class: 'muted pad' }, 'Add more data first — lab results, watch data or blood pressure.')); return; }
  const byId = new Map(options.map((o) => [o.id, o]));
  const presets = PRESETS.filter(([x, y]) => byId.has(x) && byId.has(y));
  let [ai, bi] = [aId, bId];
  if (!byId.has(ai)) ai = presets[0]?.[0] ?? options[0].id;
  if (!byId.has(bi) || bi === ai) bi = presets.find(([x]) => x === ai)?.[1] ?? (presets[0]?.[0] === ai ? presets[0][1] : options.find((o) => o.id !== ai).id);
  const A = byId.get(ai);
  const B = byId.get(bi);
  const set = (x, y) => go(`#/compare/${encodeURIComponent(x)}/${encodeURIComponent(y)}`);

  const picker = (value, label, onchange) => {
    const groups = [...new Set(options.map((o) => o.group))];
    return h('label', null, h('span', null, label), h('select', { value, onchange: (e) => onchange(e.target.value) },
      groups.map((g) => h('optgroup', { label: g }, options.filter((o) => o.group === g).map((o) => h('option', { value: o.id }, o.name))))));
  };
  if (presets.length) {
    root.append(h('div', { class: 'pills', role: 'group', 'aria-label': 'Suggestions' }, presets.map(([x, y, label]) =>
      h('button', { type: 'button', class: 'pill', 'aria-pressed': String(x === ai && y === bi), onclick: () => set(x, y) }, label))));
  }
  root.append(h('section', { class: 'card form compare-pickers' },
    picker(ai, 'First value (green, left scale)', (v) => set(v, bi === v ? ai : bi)),
    picker(bi, 'Second value (amber, right scale)', (v) => set(ai === v ? bi : ai, v))));

  const both = A.daily && B.daily;
  const rawA = A.pts();
  const rawB = B.pts();
  let pa = rawA;
  let pb = rawB;
  const anyDaily = (A.daily && pa.length > 60) || (B.daily && pb.length > 60);
  if (smoothDaily) {
    if (A.daily && pa.length > 60) pa = smooth(pa);
    if (B.daily && pb.length > 60) pb = smooth(pb);
  }
  const last = Math.max(pa.at(-1)?.t ?? 0, pb.at(-1)?.t ?? 0);
  const overlap = Math.max(pa[0]?.t ?? 0, pb[0]?.t ?? 0);
  const days = range ?? (both ? 90 : -1);
  const from = days === -1 ? overlap : days ? last - days * DAY : 0;
  const card = h('section', { class: 'card' },
    h('div', { class: 'legend' }, h('span', { class: 'la' }, `${A.name}${A.unit ? ` (${A.unit})` : ''}`), h('span', { class: 'lb' }, `${B.name}${B.unit ? ` (${B.unit})` : ''}`)));
  root.append(h('div', { class: 'pills', role: 'group', 'aria-label': 'Period' }, RANGES.map(([label, d]) =>
    h('button', { type: 'button', class: 'pill', 'aria-pressed': String(days === d), onclick: () => { range = d; set(ai, bi); } }, label))), card);
  dualChart(card, { a: { ...A, pts: pa }, b: { ...B, pts: pb }, t0: from });
  const inRange = (pts) => pts.filter((p) => p.t >= from);
  // On the raw values: smoothing would make the link look stronger than it is.
  const c = correlation(inRange(rawA), inRange(rawB), both ? 0 : A.daily || B.daily ? 3 : 45);
  card.append(h('p', { class: 'caption' }, c ? correlationText(c, A, B) : 'Too few values close in time to estimate a link — at least 8 pairs are needed.',
    anyDaily && smoothDaily ? ' Daily values are shown as 7-day averages.' : ''));
  if (anyDaily) {
    root.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: smoothDaily, onchange: (e) => { smoothDaily = e.target.checked; set(ai, bi); } }), 'Smooth daily values (7-day average)'));
  }
  const count = (n, name) => `${fmtNum(n)} ${lower(name)} value${n === 1 ? '' : 's'}`;
  root.append(h('p', { class: 'muted small pad' }, `Showing ${count(inRange(pa).length, A.name)} and ${count(inRange(pb).length, B.name)}.`));
}
