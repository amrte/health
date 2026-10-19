// Timeline: one chronological view of records, vaccinations, medicines, dental
// visits, screenings and the illness diary (illnesses, injuries, surgeries, travel…).

import { h, go, toast, uid } from './dom.js';
import { state, saveEvents, deleteEvent } from './store.js';
import { pageHead } from './ui.js';
import { fmtDate, todayIso } from './format.js';
import { REPORT_TYPE_NAME } from './parse.js';
import { KIND_NAME } from './meds-data.js';

const enc = encodeURIComponent;

// Diary entries the user adds. Reminders and screenings live in the same store.
export const EVENT_KINDS = [
  ['illness', 'Illness or infection'],
  ['injury', 'Injury'],
  ['surgery', 'Surgery or procedure'],
  ['hospital', 'Hospital stay'],
  ['travel', 'Travel'],
  ['life', 'Life event (move, new job, stress…)'],
  ['note', 'Other'],
];
export const EVENT_NAME = Object.fromEntries(EVENT_KINDS);
const SHADED = new Set(['illness', 'injury', 'surgery', 'hospital']);
export const diaryEvents = (events = state.events) => events.filter((e) => EVENT_NAME[e.kind]);

// Illnesses and the like, as shaded periods on trend charts.
export function illnessPeriods(events = state.events) {
  return events.filter((e) => SHADED.has(e.kind)).map((e) => ({ start: e.date, end: e.end || e.date, label: `${e.title || EVENT_NAME[e.kind]} (${fmtDate(e.date)})`, kind: 'ill' }));
}

const FILTERS = [['all', 'All'], ['records', 'Records'], ['diary', 'Illnesses & events'], ['meds', 'Medicines'], ['vaccines', 'Vaccinations']];
let filter = 'all';

// Every dated thing, newest first: { date, end, group, icon, title, meta, href }.
export function timelineItems(st = state) {
  const items = [];
  for (const r of st.reports) {
    const n = (st.obsByReport.get(r.id) ?? []).length;
    items.push({ date: r.date, group: 'records', icon: r.type === 'body' ? '⚖' : r.type && r.type !== 'lab' ? '♡' : '⚗',
      title: r.type && r.type !== 'lab' ? `${r.type === 'body' ? 'Body measurement' : REPORT_TYPE_NAME[r.type] ?? 'Record'}${r.lab ? ` · ${r.lab}` : ''}` : `Lab results${r.lab ? ` · ${r.lab}` : ''}`,
      meta: r.summary || r.note || (n ? `${n} values` : ''), href: `#/report/${enc(r.id)}` });
  }
  for (const v of st.vaccines) items.push({ date: v.date, group: 'vaccines', icon: '✚', title: `Vaccination: ${v.name || 'vaccine'}`, meta: v.dose || '', href: `#/vaccine/${enc(v.id)}` });
  for (const m of st.meds) {
    if (m.kind === 'allergy') {
      if (m.start) items.push({ date: m.start, group: 'meds', icon: '⚠', title: `Allergy noted: ${m.name}`, meta: m.reaction || '', href: `#/meds/edit/${enc(m.id)}` });
      continue;
    }
    const what = KIND_NAME[m.kind].toLowerCase();
    if (m.start) items.push({ date: m.start, group: 'meds', icon: '℞', title: `Started ${m.name}`, meta: [m.dose, m.schedule, m.reason && `for ${m.reason}`].filter(Boolean).join(' · ') || what, href: `#/meds/edit/${enc(m.id)}` });
    if (m.stop && m.stop <= todayIso()) items.push({ date: m.stop, group: 'meds', icon: '℞', title: `Stopped ${m.name}`, meta: what, href: `#/meds/edit/${enc(m.id)}` });
  }
  for (const v of st.dental ?? []) items.push({ date: v.date, group: 'records', icon: '◡', title: `Dental visit${v.clinic ? ` · ${v.clinic}` : ''}`, meta: v.note || '', href: `#/teeth/visit/${enc(v.id)}` });
  for (const e of st.events) {
    if (EVENT_NAME[e.kind]) {
      items.push({ date: e.date, end: e.end, group: 'diary', icon: SHADED.has(e.kind) ? '✱' : '◇', title: e.title || EVENT_NAME[e.kind], meta: [EVENT_NAME[e.kind], e.note].filter(Boolean).join(' · '), href: `#/timeline/edit/${enc(e.id)}` });
    } else if (e.kind === 'screening' && e.date) {
      items.push({ date: e.date, group: 'records', icon: '✓', title: e.title || 'Screening', meta: 'Screening done', href: '#/reminders' });
    }
  }
  return items.filter((x) => x.date).sort((a, b) => b.date.localeCompare(a.date));
}

function eventForm(e, { onSaved } = {}) {
  const f = { ...e };
  return h('form', { class: 'card form', onsubmit: async (ev) => {
    ev.preventDefault();
    if (!f.date) { toast('Set the date'); return; }
    if (f.end && f.end < f.date) { toast('The end is before the start'); return; }
    f.title = (f.title ?? '').trim();
    f.updated = new Date().toISOString();
    f.created ??= f.updated;
    await saveEvents([f]);
    toast('Saved');
    onSaved?.();
  } },
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'What'), h('select', { value: f.kind, onchange: (x) => { f.kind = x.target.value; } }, EVENT_KINDS.map(([k, n]) => h('option', { value: k }, n)))),
      h('label', null, h('span', null, 'Title'), h('input', { type: 'text', value: f.title ?? '', placeholder: 'e.g. Flu, knee surgery, trip to Thailand', oninput: (x) => { f.title = x.target.value; } }))),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'From'), h('input', { type: 'date', value: f.date ?? '', oninput: (x) => { f.date = x.target.value; } })),
      h('label', null, h('span', null, 'To (optional)'), h('input', { type: 'date', value: f.end ?? '', oninput: (x) => { f.end = x.target.value; } }))),
    h('label', null, h('span', null, 'Notes'), h('textarea', { rows: 2, value: f.note ?? '', placeholder: 'Symptoms, fever, treatment, sick leave…', oninput: (x) => { f.note = x.target.value; } })),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
      e.created ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm('Delete this entry?')) return;
        await deleteEvent(e.id);
        toast('Deleted');
        go('#/timeline');
      } }, 'Delete') : null));
}

export function viewTimeline(root) {
  root.append(pageHead('Timeline', { sub: 'Check-ups, illnesses, medicines and vaccinations in one place' }));
  const blank = () => ({ id: uid(), kind: 'illness', date: todayIso(), end: '', title: '', note: '' });
  root.append(h('details', { class: 'card add-event' }, h('summary', null, h('strong', null, '+ Add an illness or event'), h('span', { class: 'muted small' }, ' — colds, infections, injuries, surgeries, travel')),
    eventForm(blank(), { onSaved: () => go('#/timeline') })));

  const list = h('div');
  const render = () => {
    const items = timelineItems().filter((x) => filter === 'all' || x.group === filter);
    if (!items.length) { list.replaceChildren(h('p', { class: 'muted pad' }, 'Nothing here yet.')); return; }
    const years = new Map();
    for (const x of items) {
      const y = x.date.slice(0, 4);
      if (!years.has(y)) years.set(y, []);
      years.get(y).push(x);
    }
    list.replaceChildren(...[...years].map(([y, xs]) => h('section', { class: 'group' }, h('h2', null, y),
      h('ol', { class: 'card timeline' }, xs.map((x) => h('li', { class: `tl-item tl-${x.group}` },
        h('span', { class: 'tl-icon', 'aria-hidden': 'true' }, x.icon),
        h('a', { class: 'tl-body', href: x.href },
          h('div', { class: 'tl-date' }, fmtDate(x.date), x.end && x.end !== x.date ? ` – ${fmtDate(x.end)}` : ''),
          h('div', { class: 'row-title' }, x.title),
          x.meta ? h('div', { class: 'row-meta' }, x.meta) : null)))))));
  };
  root.append(h('div', { class: 'pills', role: 'group', 'aria-label': 'Show' }, FILTERS.map(([k, n]) =>
    h('button', { type: 'button', class: 'pill', 'aria-pressed': String(filter === k), onclick: (e) => {
      filter = k;
      e.currentTarget.parentElement.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', String(p === e.currentTarget)));
      render();
    } }, n))), list);
  render();
}

export function viewEventEditor(root, id) {
  const e = state.events.find((x) => x.id === id);
  root.append(pageHead(e ? e.title || EVENT_NAME[e.kind] : 'Not found', { back: '#/timeline' }));
  if (e) root.append(eventForm(e, { onSaved: () => go('#/timeline') }));
}
