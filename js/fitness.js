// Fitness: daily values and workouts from Polar (and later other devices).

import { h, toast, go } from './dom.js';
import { state, saveFitness, deleteFitness } from './store.js';
import { fmtNum, fmtDate, dateMs } from './format.js';
import { pageHead } from './ui.js';
import { lineChart, barChart, sparkline } from './chart.js';
import { importFiles } from './polar.js';
import { findingItem } from './insights.js';
import { fitnessFindings } from './fitness-eval.js';
import { bpSummaryCard } from './bp.js';

const DAY = 864e5;

// What each daily value is, how to show it, and whether lower is better.
export const KINDS = {
  rhr: { name: 'Resting heart rate', unit: 'bpm', digits: 0, better: 'lower' },
  night_hr: { name: 'Night-time heart rate', unit: 'bpm', digits: 0, better: 'lower' },
  low_hr: { name: 'Lowest heart rate of the day', unit: 'bpm', digits: 0, better: 'lower' },
  hrv: { name: 'Heart rate variability (RMSSD)', unit: 'ms', digits: 0, better: 'higher' },
  sleep_min: { name: 'Sleep', unit: 'h', digits: 1, scale: 1 / 60, better: 'higher' },
  sleep_score: { name: 'Sleep score', unit: '', digits: 0, better: 'higher' },
  ans: { name: 'Nightly Recharge ANS charge', unit: '', digits: 1, better: 'higher' },
  breathing: { name: 'Breathing rate during sleep', unit: '/min', digits: 1 },
  steps: { name: 'Steps', unit: 'steps', digits: 0, better: 'higher' },
  active_min: { name: 'Active time', unit: 'min', digits: 0, better: 'higher' },
  kcal: { name: 'Calories', unit: 'kcal', digits: 0 },
};
const ORDER = ['rhr', 'night_hr', 'low_hr', 'hrv', 'sleep_min', 'sleep_score', 'steps', 'active_min', 'ans', 'breathing', 'kcal'];

const RANGES = [['30 days', 30], ['90 days', 90], ['1 year', 365], ['All', 0]];
let range = 90;

export function series(kind, sinceMs = 0) {
  const k = KINDS[kind];
  return state.measures.filter((m) => m.kind === kind && dateMs(m.date) >= sinceMs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ t: dateMs(m.date), v: m.value * (k?.scale ?? 1), status: 'none', qualifier: '', o: { date: m.date }, lab: m.source === 'polar' ? 'Polar' : m.source }));
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Average of the last 7 days that have data vs. the 28 days before.
export function recentVsBaseline(kind, now = Date.now()) {
  const pts = series(kind);
  if (!pts.length) return null;
  const end = pts[pts.length - 1].t;
  const recent = pts.filter((p) => p.t > end - 7 * DAY).map((p) => p.v);
  const base = pts.filter((p) => p.t <= end - 7 * DAY && p.t > end - 35 * DAY).map((p) => p.v);
  return { recent: avg(recent), base: avg(base), last: pts[pts.length - 1], stale: now - end > 14 * DAY };
}

// Monday-based weeks.
export function weekStart(ms) {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function weeklyMinutes(sinceMs = 0, now = Date.now()) {
  const weeks = new Map();
  const first = weekStart(Math.max(sinceMs, Math.min(...state.workouts.map((w) => Date.parse(w.start))) || now));
  for (let t = first; t <= now; t += 7 * DAY) weeks.set(t, { t, v: 0, n: 0 });
  for (const w of state.workouts) {
    const t = weekStart(Date.parse(w.start));
    const wk = weeks.get(t);
    if (wk) { wk.v += (w.durationS ?? 0) / 60; wk.n++; }
  }
  return [...weeks.values()];
}

function tile(kind) {
  const k = KINDS[kind];
  const r = recentVsBaseline(kind);
  if (!r) return null;
  const d = r.recent != null && r.base != null ? r.recent - r.base : null;
  const deltaText = d == null ? 'No baseline yet'
    : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtNum(Math.abs(d))} vs. previous 4 weeks`;
  return h('a', { class: 'tile', href: `#/fitness/${kind}` },
    h('div', { class: 'tile-label' }, k.name, ' · 7-day avg'),
    h('div', { class: 'tile-value' }, fmtNum(+r.recent.toFixed(k.digits)), k.unit ? h('small', null, ' ', k.unit) : null),
    h('div', { class: 'tile-delta' }, deltaText, r.stale ? ' · no recent data' : ''),
    sparkline(series(kind, r.last.t - 90 * DAY)));
}

function importCard() {
  const input = h('input', { type: 'file', accept: '.zip,.json,.csv,application/zip,application/json,text/csv', multiple: true, class: 'offscreen', id: 'polar-in',
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      status.textContent = 'Reading…';
      try {
        const res = await importFiles(files, (msg) => { status.textContent = msg; });
        await saveFitness(res);
        status.textContent = `Imported ${res.workouts.length} workouts and ${res.measures.length} daily values from ${res.stats.recognised} of ${res.stats.files} files.` +
          (res.stats.skipped.length ? ` Not recognised: ${res.stats.skipped.slice(0, 5).join(', ')}${res.stats.skipped.length > 5 ? '…' : ''}` : '');
        toast('Polar data imported');
        go('#/fitness');
      } catch (err) {
        console.error(err);
        status.textContent = 'Import failed: ' + (err?.message ?? err);
      }
    } });
  const status = h('p', { class: 'muted small', role: 'status' });
  return h('section', { class: 'card' },
    h('h2', null, 'Import from Polar'),
    h('ol', { class: 'steps plain' },
      h('li', null, 'Sign in at ', h('a', { href: 'https://account.polar.com', target: '_blank', rel: 'noopener' }, 'account.polar.com'),
        ' (works in Safari on iPhone), choose ', h('em', null, 'Download your data'), ' in the menu and then ', h('em', null, 'Download'), '.'),
      h('li', null, 'Polar prepares the export and emails you a link to a ZIP file. Save it (on iPhone: to Files).'),
      h('li', null, 'Choose the ZIP here. Training sessions exported one by one from Polar Flow (CSV or JSON) work too.')),
    h('div', { class: 'btn-row' }, h('label', { class: 'btn primary', for: 'polar-in' }, 'Choose Polar file(s)…'), input),
    status,
    h('p', { class: 'hint' }, 'Read on this device; nothing is uploaded. Imported: workouts, daily steps and active time, sleep and sleep score, Nightly Recharge (night-time heart rate, HRV, breathing rate, ANS charge) and the lowest heart rate of each day. Importing again updates days instead of duplicating them.'));
}

export function viewFitness(root) {
  root.append(pageHead('Fitness', { sub: state.measures.length || state.workouts.length
    ? `${state.workouts.length} workouts · ${new Set(state.measures.map((m) => m.date)).size} days of data` : 'Heart rate, sleep, activity and training from your watch' }));
  root.append(bpSummaryCard());
  if (!state.measures.length && !state.workouts.length) {
    root.append(importCard());
    return;
  }
  const since = range ? Date.now() - range * DAY : 0;

  const findings = fitnessFindings();
  if (findings.length) root.append(h('section', { class: 'card findings' }, h('h2', null, 'What this means'), findings.map((f) => findingItem(f))));

  root.append(h('div', { class: 'pills', role: 'group', 'aria-label': 'Period' }, RANGES.map(([label, days]) =>
    h('button', { type: 'button', class: 'pill', 'aria-pressed': String(range === days), onclick: () => { range = days; go('#/fitness'); } }, label))));

  const tiles = ORDER.map(tile).filter(Boolean);
  if (tiles.length) root.append(h('div', { class: 'tiles' }, tiles));

  if (state.workouts.length) {
    const card = h('section', { class: 'card chart-card' }, h('h2', null, 'Workout minutes per week', h('small', null, 'line: WHO 150 min')));
    root.append(card);
    const weeks = weeklyMinutes(since);
    barChart(card, {
      bars: weeks.map((w) => ({ ...w, label: `Week of ${fmtDate(new Date(w.t).toISOString().slice(0, 10))}`, sub: `${w.n} workout${w.n === 1 ? '' : 's'}`,
        tick: new Date(w.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) })),
      unit: 'min', target: 150, targetLabel: '150 min',
    });
    card.append(h('p', { class: 'caption' }, 'All recorded workouts count here. WHO recommends 150–300 minutes of moderate or 75–150 of vigorous activity a week; everyday activity outside workouts counts too.'));
  }

  for (const kind of ORDER) {
    const pts = series(kind, since);
    if (!pts.length) continue;
    const k = KINDS[kind];
    const card = h('section', { class: 'card chart-card' }, h('h2', null, k.name, h('small', null, k.unit)));
    root.append(card);
    lineChart(card, { pts: pts.map((p) => ({ ...p, display: fmtNum(+p.v.toFixed(k.digits)) })), unit: k.unit, height: 180 });
  }

  const recent = [...state.workouts].filter((w) => Date.parse(w.start) >= since).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 30);
  if (recent.length) {
    root.append(h('section', { class: 'group' }, h('h2', null, 'Workouts'), h('div', { class: 'card list' }, recent.map((w) =>
      h('div', { class: 'row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, w.sport || 'Workout'),
          h('div', { class: 'row-meta' }, fmtDate(w.start.slice(0, 10)), w.distanceM ? ` · ${fmtNum(w.distanceM / 1000)} km` : '', w.hrAvg ? ` · avg ${Math.round(w.hrAvg)} bpm` : '')),
        h('div', { class: 'row-value' },
          h('div', { class: 'value' }, fmtDuration(w.durationS)),
          w.load != null ? h('div', { class: 'muted small' }, `load ${Math.round(w.load)}`) : null))))));
  }

  root.append(importCard());
  root.append(h('section', { class: 'card' }, h('h2', null, 'Remove fitness data'),
    h('p', { class: 'muted small' }, 'Deletes all imported workouts and daily values from this device. Lab results and vaccinations stay.'),
    h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (!confirm('Delete all imported fitness data?')) return;
      await deleteFitness();
      toast('Fitness data deleted');
      go('#/fitness');
    } }, 'Delete fitness data')));
}

export function fmtDuration(s) {
  if (!s) return '';
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export function viewFitnessKind(root, kind) {
  const k = KINDS[kind];
  if (!k) { go('#/fitness'); return; }
  const pts = series(kind);
  root.append(pageHead(k.name, { back: '#/fitness', sub: pts.length ? `${pts.length} days · ${fmtDate(pts[0].o.date)} – ${fmtDate(pts[pts.length - 1].o.date)}` : '' }));
  const card = h('section', { class: 'card' });
  root.append(card);
  lineChart(card, { pts: pts.map((p) => ({ ...p, display: fmtNum(+p.v.toFixed(k.digits)) })), unit: k.unit });
  // Monthly averages as a table view of the same data.
  const months = new Map();
  for (const p of pts) {
    const key = p.o.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(p.v);
  }
  root.append(h('section', { class: 'group' }, h('h2', null, 'Monthly averages'), h('div', { class: 'card table-wrap' },
    h('table', { class: 'results' }, h('thead', null, h('tr', null, h('th', null, 'Month'), h('th', null, 'Average'), h('th', null, 'Days'))),
      h('tbody', null, [...months].reverse().map(([mo, vs]) => h('tr', null,
        h('td', null, new Date(mo + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })),
        h('td', { class: 'value' }, `${fmtNum(+avg(vs).toFixed(k.digits))} ${k.unit}`),
        h('td', null, vs.length))))))));
}
