// Blood pressure: quick entry, CSV and photo (Claude) import, chart and evaluation.

import { h, toast, go, uid } from './dom.js';
import { state, saveBp, deleteBp } from './store.js';
import { fmtDate, dateMs } from './format.js';
import { pageHead } from './ui.js';
import { bpChart } from './chart.js';
import { copyText } from './editor.js';
import { findingItem } from './insights.js';
import { bpFindings, BP_LINES, homeAverage } from './bp-eval.js';

const pad = (n) => String(n).padStart(2, '0');
export function nowLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validReading(r) {
  return r.sys >= 60 && r.sys <= 300 && r.dia >= 30 && r.dia <= 200 && r.sys > r.dia && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(r.time);
}

// ---- import -------------------------------------------------------------------------------

function splitCsv(line, sep) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

// Day-first unless impossible ("09/18/2024" can only be month-first).
function csvDate(s) {
  s = s.trim();
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/);
  if (!m) return null;
  let [, a, b, y] = m;
  if (y.length === 2) y = '20' + y;
  if (s.includes('/') && Number(b) > 12) [a, b] = [b, a];
  return `${y}-${pad(b)}-${pad(a)}`;
}
function csvTime(s) {
  const m = String(s ?? '').match(/(\d{1,2}):(\d\d)(?::\d\d)?\s*([AaPp][Mm])?/);
  if (!m) return null;
  let hh = Number(m[1]);
  if (m[3]) hh = (hh % 12) + (/p/i.test(m[3]) ? 12 : 0);
  return `${pad(hh)}:${m[2]}`;
}

// Cuff apps (Omron, Withings, Beurer, …) export CSV with differently named columns;
// columns are found by name in English, German and Finnish.
export function parseBpCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = [';', ',', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const head = splitCsv(lines[0], sep).map((x) => x.toLowerCase());
  const find = (re) => head.findIndex((x) => re.test(x));
  const iSys = find(/sys|obere|yläpaine/);
  const iDia = find(/dia|untere|alapaine/);
  const iPul = find(/pul|heart|herz|syke/);
  const iDate = find(/date|datum|päivä|aika|time|zeit|measure/);
  const iTime = head.findIndex((x, i) => i !== iDate && /^(time|zeit|uhrzeit|kellonaika|klo)\b/.test(x));
  if (iSys < 0 || iDia < 0 || iDate < 0) throw new Error('Couldn’t find date, systolic and diastolic columns in this file.');
  const out = [];
  for (const line of lines.slice(1)) {
    const c = splitCsv(line, sep);
    const date = csvDate(c[iDate] ?? '');
    const time = csvTime(iTime >= 0 ? c[iTime] : c[iDate]) ?? '00:00';
    const r = { id: '', time: `${date}T${time}`, sys: Number(c[iSys]), dia: Number(c[iDia]), pulse: iPul >= 0 ? Number(c[iPul]) || null : null,
      arm: '', place: 'home', note: '', source: 'csv' };
    if (date && validReading(r)) { r.id = `bp:${r.time}:${r.sys}/${r.dia}`; out.push(r); }
  }
  return out;
}

export function buildBpPrompt() {
  return `Read the attached blood pressure records (a handwritten diary, a printout or a screenshot of a blood pressure app or monitor). They may be in English, German, Finnish, Ukrainian or Russian.
Reply with only one JSON code block in this format:

{"readings": [{"date": "YYYY-MM-DD", "time": "HH:MM", "sys": 128, "dia": 82, "pulse": 64, "arm": "left, right or empty", "uncertain": false}]}

Rules:
- One entry per reading. Upper number = sys (systolic), lower number = dia (diastolic).
- If the time is missing, use "". If a value is hard to read, give your best reading and set "uncertain": true.
- Don't add anything that isn't in the image.`;
}

export function parseBpReply(text) {
  const block = String(text ?? '').match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? String(text ?? '');
  const a = block.search(/[[{]/);
  const b = Math.max(block.lastIndexOf('}'), block.lastIndexOf(']'));
  if (a < 0 || b <= a) throw new Error('No JSON found. Copy Claude’s whole reply, including the code block.');
  const data = JSON.parse(block.slice(a, b + 1));
  const list = Array.isArray(data) ? data : data.readings ?? [];
  return list.map((x) => {
    const date = csvDate(String(x.date ?? ''));
    const r = { id: '', time: `${date}T${csvTime(x.time) ?? '00:00'}`, sys: Number(x.sys), dia: Number(x.dia), pulse: Number(x.pulse) || null,
      arm: /^l/i.test(x.arm ?? '') ? 'left' : /^r/i.test(x.arm ?? '') ? 'right' : '', place: 'home', note: x.uncertain ? 'Check: read from photo, uncertain' : '', source: 'claude' };
    r.id = `bp:${r.time}:${r.sys}/${r.dia}`;
    return date && validReading(r) ? r : null;
  }).filter(Boolean);
}

// ---- views ----------------------------------------------------------------------------------

// Daily means for the chart.
export function bpDays(readings) {
  const by = new Map();
  for (const r of readings) {
    const d = r.time.slice(0, 10);
    if (!by.has(d)) by.set(d, []);
    by.get(d).push(r);
  }
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([d, rs]) => ({
    t: dateMs(d),
    sys: rs.reduce((a, r) => a + r.sys, 0) / rs.length,
    dia: rs.reduce((a, r) => a + r.dia, 0) / rs.length,
    n: rs.length,
    label: fmtDate(d),
  }));
}

const RANGES = [['30 days', 30], ['90 days', 90], ['1 year', 365], ['All', 0]];
let range = 90;
let showAll = false;

export function bpSummaryCard() {
  const sorted = [...state.bp].sort((a, b) => b.time.localeCompare(a.time));
  const last = sorted[0];
  const avg = homeAverage(state.bp);
  return h('a', { class: 'card hint-card', href: '#/bp' },
    h('div', { class: 'tile-label' }, 'Blood pressure'),
    last ? h('div', { class: 'bp-latest' }, `${last.sys}/${last.dia}`, h('small', { class: 'muted' }, ' mmHg')) : h('strong', null, 'Add a reading'),
    last ? h('div', { class: 'muted small' }, `Latest ${fmtDate(last.time.slice(0, 10))} ${last.time.slice(11)}`, avg ? ` · home average ${Math.round(avg.sys)}/${Math.round(avg.dia)} (${avg.n} readings)` : '') : null);
}

export function viewBp(root) {
  root.append(pageHead('Blood pressure', { back: '#/fitness' }));

  // Entry
  const f = { time: nowLocal(), sys: '', dia: '', pulse: '', arm: localStorageGet('bp-arm') ?? '', place: 'home', note: '' };
  const num = (key, label) => h('label', null, h('span', null, label),
    h('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: f[key], 'aria-label': label, oninput: (e) => { f[key] = e.target.value; } }));
  const form = h('form', { class: 'card bp-form', onsubmit: async (e) => {
    e.preventDefault();
    const r = { id: uid(), time: f.time, sys: Number(f.sys), dia: Number(f.dia), pulse: Number(f.pulse) || null, arm: f.arm, place: f.place, note: f.note.trim(), source: 'manual' };
    if (!validReading(r)) { toast('Check the numbers: upper 60–300, lower 30–200, upper above lower'); return; }
    localStorageSet('bp-arm', f.arm);
    await saveBp([r]);
    toast(`Saved ${r.sys}/${r.dia}`);
    go('#/bp');
  } },
    h('h2', null, 'New reading'),
    h('div', { class: 'bp-nums' }, num('sys', 'Upper (SYS)'), num('dia', 'Lower (DIA)'), num('pulse', 'Pulse')),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Date and time'), h('input', { type: 'datetime-local', value: f.time, oninput: (e) => { f.time = e.target.value; } })),
      h('label', null, h('span', null, 'Arm'), h('select', { value: f.arm, onchange: (e) => { f.arm = e.target.value; } },
        h('option', { value: '' }, '—'), h('option', { value: 'left' }, 'Left'), h('option', { value: 'right' }, 'Right')))),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Measured'), h('select', { value: f.place, onchange: (e) => { f.place = e.target.value; } },
        h('option', { value: 'home' }, 'At home'), h('option', { value: 'clinic' }, 'At a doctor’s office'))),
      h('label', null, h('span', null, 'Note'), h('input', { type: 'text', placeholder: 'optional', oninput: (e) => { f.note = e.target.value; } }))),
    h('div', null, h('button', { class: 'btn primary', type: 'submit' }, 'Save reading')));
  root.append(form);

  if (!state.bp.length) {
    root.append(...importCards());
    return;
  }

  const findings = bpFindings(state.bp);
  if (findings.length) root.append(h('section', { class: 'card findings' }, h('h2', null, 'What this means'), findings.map((x) => findingItem(x))));

  root.append(h('div', { class: 'pills', role: 'group', 'aria-label': 'Period' }, RANGES.map(([label, days]) =>
    h('button', { type: 'button', class: 'pill', 'aria-pressed': String(range === days), onclick: () => { range = days; go('#/bp'); } }, label))));
  const since = range ? Date.now() - range * 864e5 : 0;
  const shown = state.bp.filter((r) => Date.parse(r.time) >= since);
  const card = h('section', { class: 'card chart-card' }, h('h2', null, 'Daily average', h('small', null, 'mmHg')));
  root.append(card);
  bpChart(card, { days: bpDays(shown).map((d) => ({ ...d, flag: d.sys >= BP_LINES[0].v || d.dia >= BP_LINES[1].v })), lines: BP_LINES });
  card.append(h('p', { class: 'caption' }, `Each bar runs from the lower to the upper value; lines mark the home-measurement limits (${BP_LINES.map((l) => l.label).join(' / ')} mmHg).`));

  const all = [...state.bp].sort((a, b) => b.time.localeCompare(a.time));
  const list = showAll ? all : all.slice(0, 10);
  root.append(h('section', { class: 'group' }, h('h2', null, `Readings (${all.length})`), h('div', { class: 'card list' }, list.map((r) =>
    h('div', { class: 'row' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, `${r.sys}/${r.dia}`, r.pulse ? h('span', { class: 'muted' }, ` · pulse ${r.pulse}`) : null),
        h('div', { class: 'row-meta' }, fmtDate(r.time.slice(0, 10)), ' ', r.time.slice(11, 16), r.place === 'clinic' ? ' · doctor’s office' : '', r.arm ? ` · ${r.arm} arm` : '', r.note ? ` · ${r.note}` : '')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete reading', onclick: async () => {
        if (!confirm(`Delete ${r.sys}/${r.dia} from ${fmtDate(r.time.slice(0, 10))}?`)) return;
        await deleteBp([r.id]);
        go('#/bp');
      } }, '×'))))));
  if (all.length > list.length) root.append(h('button', { class: 'btn', type: 'button', onclick: () => { showAll = true; go('#/bp'); } }, `Show all ${all.length}`));
  root.append(...importCards());
}

function importCards() {
  const status = h('p', { class: 'muted small', role: 'status' });
  const csvIn = h('input', { type: 'file', accept: '.csv,text/csv,.txt', class: 'offscreen', id: 'bp-csv', onchange: async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rs = parseBpCsv(await file.text());
      if (!rs.length) { status.textContent = 'No readings found in that file.'; return; }
      await saveBp(rs);
      toast(`${rs.length} readings imported`);
      go('#/bp');
    } catch (err) { status.textContent = err.message; }
  } });
  const reply = h('textarea', { rows: 3, class: 'mono', placeholder: 'Paste Claude’s reply here' });
  return [
    h('section', { class: 'card' }, h('h2', null, 'Import from a blood pressure app'),
      h('p', { class: 'muted small' }, 'Export your readings as CSV from the monitor’s app (e.g. Omron Connect, Withings, Beurer) and choose the file. Columns are recognised by name.'),
      h('label', { class: 'btn', for: 'bp-csv' }, 'Choose CSV file…'), csvIn, status),
    h('section', { class: 'card claude' }, h('h2', null, 'Read a paper diary with Claude'),
      h('ol', { class: 'steps' },
        h('li', null, h('button', { class: 'btn primary', type: 'button', onclick: async () => toast((await copyText(buildBpPrompt())) ? 'Instructions copied' : 'Copy failed') }, 'Copy instructions')),
        h('li', null, 'In the Claude app, attach photos of the diary, paste and send.'),
        h('li', null, 'Paste the reply here:', reply, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          try {
            const rs = parseBpReply(reply.value);
            if (!rs.length) { toast('No readings found'); return; }
            await saveBp(rs);
            toast(`${rs.length} readings added`);
            go('#/bp');
          } catch (err) { toast(err instanceof SyntaxError ? 'The reply isn’t complete JSON' : err.message); }
        } }, 'Add readings')))),
  ];
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* not available */ } }
