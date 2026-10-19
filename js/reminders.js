// Reminders: retests you set yourself, retests suggested by guideline rules,
// and national screening programmes (screening.js). Reminders are timeline events
// of kind 'reminder'; a reminder for tests counts as done once a newer result exists.

import { h, go, toast, uid } from './dom.js';
import { state, saveEvents, deleteEvent, metricOf } from './store.js';
import { pageHead } from './ui.js';
import { fmtDate, todayIso } from './format.js';
import { SOURCES } from './knowledge.js';
import { screeningStatus, SCREENING_SOURCES, SCREENING_NOTE } from './screening.js';

const enc = encodeURIComponent;
const SOON_DAYS = 30;

export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

const latestDate = (st, keys) => keys.map((k) => st.byMetric.get(k)?.last?.o.date).filter(Boolean).sort().at(-1) ?? '';

export const reminders = (st = state) => st.events.filter((e) => e.kind === 'reminder');

// 'done' | 'overdue' | 'soon' | 'later'
export function reminderStatus(e, st = state, today = todayIso()) {
  if (e.done) return 'done';
  if (e.keys?.length && latestDate(st, e.keys) > (e.created ?? '').slice(0, 10)) return 'done';
  if (e.date < today) return 'overdue';
  if (e.date <= addDays(today, SOON_DAYS)) return 'soon';
  return 'later';
}

// Retests that guideline rules call for, unless a reminder for them already exists.
export function retestSuggestions(st = state) {
  const out = [];
  const seen = new Set();
  for (const f of st.findings) {
    if (!f.retest) continue;
    const id = f.keys.join('+');
    if (seen.has(id)) continue;
    seen.add(id);
    const from = latestDate(st, f.keys);
    if (!from) continue;
    const covered = reminders(st).some((e) => e.keys?.some((k) => f.keys.includes(k)) && (e.created ?? '').slice(0, 10) >= from);
    if (!covered) out.push({ keys: f.keys, from, due: addMonths(from, f.retest.months), what: f.retest.what, source: f.retest.source, finding: f });
  }
  return out;
}

export async function addReminder({ title, date, keys = [], note = '' }) {
  const now = new Date().toISOString();
  await saveEvents([{ id: uid(), kind: 'reminder', title, date, keys, note, done: '', created: now, updated: now }]);
}

function statusTag(status, date) {
  if (status === 'overdue') return h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ` Overdue since ${fmtDate(date)}`);
  if (status === 'soon') return h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ` Due ${fmtDate(date)}`);
  if (status === 'done') return h('span', { class: 'status st-normal' }, h('span', { class: 'status-icon' }, '✓'), ' Done');
  return h('span', { class: 'muted small nowrap' }, fmtDate(date));
}

const keysText = (keys) => (keys ?? []).map((k) => metricOf(k)?.name ?? k).join(', ');

// Rows for the overview's "Due and overdue": reminders, suggested retests and screenings.
export function dueRows(st = state, today = todayIso()) {
  const soon = addDays(today, SOON_DAYS);
  const rows = [];
  for (const e of reminders(st)) {
    const s = reminderStatus(e, st, today);
    if (s === 'overdue' || s === 'soon') {
      rows.push(h('a', { class: 'row', href: '#/reminders' }, h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, e.title), h('div', { class: 'row-meta' }, e.keys?.length ? keysText(e.keys) : 'Your reminder'), statusTag(s, e.date))));
    }
  }
  for (const r of retestSuggestions(st)) {
    if (r.due > soon) continue;
    rows.push(h('a', { class: 'row', href: '#/reminders' }, h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, `Repeat ${r.what}`),
      h('div', { class: 'row-meta' }, `${SOURCES[r.source]?.short ?? 'Guideline'}: ${r.finding.title}`),
      statusTag(r.due < today ? 'overdue' : 'soon', r.due))));
  }
  for (const s of screeningStatus(st.profile, st.events, today)) {
    if ((s.status !== 'due' && s.status !== 'soon') || s.item.invite) continue;
    rows.push(h('a', { class: 'row', href: '#/reminders' }, h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, s.item.name), h('div', { class: 'row-meta' }, s.reason),
      s.status === 'due' ? h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ' Due now') : statusTag('soon', s.next))));
  }
  return rows;
}

// On a test page: set a reminder to repeat it.
export function remindButton(key) {
  const m = metricOf(key);
  const sel = h('select', { 'aria-label': 'When' }, [[1, 'in 1 month'], [3, 'in 3 months'], [6, 'in 6 months'], [12, 'in 1 year']].map(([n, l]) => h('option', { value: n }, l)));
  sel.value = '3';
  return h('div', { class: 'remind-inline' },
    h('button', { class: 'btn', type: 'button', onclick: async () => {
      const date = addMonths(todayIso(), Number(sel.value));
      await addReminder({ title: `Repeat ${m?.name ?? key}`, date, keys: [key] });
      toast(`Reminder set for ${fmtDate(date)}`);
    } }, '⏰ Remind me to retest'), sel);
}

export function viewReminders(root) {
  root.append(pageHead('Reminders & screening', { sub: 'Retests, follow-ups and check-ups from the Finnish and German programmes' }));
  const today = todayIso();

  // Add your own
  const f = { title: '', date: addMonths(today, 3), key: '' };
  const tests = [...state.byMetric.values()].sort((a, b) => a.m.name.localeCompare(b.m.name));
  root.append(h('details', { class: 'card add-event' }, h('summary', null, h('strong', null, '+ New reminder')),
    h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      const title = f.title.trim() || (f.key ? `Repeat ${metricOf(f.key)?.name}` : '');
      if (!title) { toast('Enter what to remember'); return; }
      await addReminder({ title, date: f.date, keys: f.key ? [f.key] : [] });
      toast(`Reminder set for ${fmtDate(f.date)}`);
      go('#/reminders');
    } },
      h('div', { class: 'bp-row2' },
        h('label', null, h('span', null, 'What'), h('input', { type: 'text', placeholder: 'e.g. Repeat vitamin D, book an eye check', oninput: (e) => { f.title = e.target.value; } })),
        h('label', null, h('span', null, 'When'), h('input', { type: 'date', value: f.date, oninput: (e) => { f.date = e.target.value; } }))),
      h('label', null, h('span', null, 'Test (optional — the reminder clears itself when a new result arrives)'),
        h('select', { onchange: (e) => { f.key = e.target.value; } }, h('option', { value: '' }, '—'), tests.map((t) => h('option', { value: t.m.key }, t.m.name)))),
      h('div', null, h('button', { class: 'btn primary', type: 'submit' }, 'Set reminder')))));

  // Suggested by guideline rules
  const sugg = retestSuggestions();
  if (sugg.length) {
    root.append(h('section', { class: 'group' }, h('h2', null, 'Suggested retests'),
      h('div', { class: 'card list' }, sugg.map((r) => h('div', { class: 'row act' }, h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, `Repeat ${r.what}`),
        h('div', { class: 'row-meta' }, `${r.finding.title}. `, SOURCES[r.source] ? h('a', { href: SOURCES[r.source].url, target: '_blank', rel: 'noopener' }, SOURCES[r.source].short) : null,
          ` · last tested ${fmtDate(r.from)}`)),
        statusTag(r.due < today ? 'overdue' : r.due <= addDays(today, SOON_DAYS) ? 'soon' : 'later', r.due),
        h('button', { class: 'btn small', type: 'button', onclick: async () => {
          await addReminder({ title: `Repeat ${r.what}`, date: r.due < today ? today : r.due, keys: r.keys });
          toast('Reminder set');
          go('#/reminders');
        } }, 'Remind me'))))));
  }

  // Your reminders
  const mine = reminders().map((e) => ({ e, s: reminderStatus(e) })).sort((a, b) => (a.s === 'done') - (b.s === 'done') || a.e.date.localeCompare(b.e.date));
  root.append(h('section', { class: 'group' }, h('h2', null, `Your reminders (${mine.filter((x) => x.s !== 'done').length} open)`),
    mine.length ? h('div', { class: 'card list' }, mine.map(({ e, s }) => h('div', { class: 'row four act' + (s === 'done' ? ' done' : '') },
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, e.title),
        e.keys?.length ? h('div', { class: 'row-meta' }, h('a', { href: `#/test/${enc(e.keys[0])}` }, keysText(e.keys))) : null),
      statusTag(s, e.date),
      s !== 'done' ? h('button', { class: 'btn small', type: 'button', onclick: async () => { await saveEvents([{ ...e, done: today, updated: new Date().toISOString() }]); toast('Marked as done'); go('#/reminders'); } }, 'Done') : null,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete reminder ${e.title}`, onclick: async () => { await deleteEvent(e.id); go('#/reminders'); } }, '×'))))
      : h('p', { class: 'muted pad' }, 'No reminders. Set one here or on any test page.')));

  // Screening programmes
  const scr = screeningStatus(state.profile, state.events, today);
  const box = h('section', { class: 'group' }, h('h2', null, 'Screening and check-ups'));
  if (!state.profile.sex || !state.profile.birthYear) {
    box.append(h('a', { class: 'card hint-card', href: '#/data' }, h('strong', null, 'Add your sex and birth year'), h('span', null, ' to see which programmes apply to you.')));
  } else if (!scr.length) {
    box.append(h('p', { class: 'muted pad' }, 'No programme applies at your age yet.'));
  } else {
    for (const country of ['FI', 'DE']) {
      const rows = scr.filter((x) => x.item.country === country);
      if (!rows.length) continue;
      box.append(h('h3', { class: 'sub-head' }, country === 'FI' ? 'Finland' : 'Germany'), h('div', { class: 'card list' }, rows.map((x) => screeningRow(x, today))));
    }
  }
  box.append(h('p', { class: 'muted small pad' }, SCREENING_NOTE, ' Sources: ',
    SCREENING_SOURCES.flatMap((s, i) => [i ? ' · ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.short)])));
  root.append(box);
}

function screeningRow({ item, status, last, next, reason }, today) {
  const dateIn = h('input', { type: 'date', value: today, 'aria-label': `Date of ${item.name}` });
  const tag = status === 'due' ? h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ' Due now')
    : status === 'invite' ? h('span', { class: 'muted small nowrap' }, last ? 'Next invitation due' : 'By invitation')
    : status === 'soon' ? statusTag('soon', next)
      : status === 'upcoming' ? h('span', { class: 'muted small nowrap' }, `From ${fmtDate(next)}`)
        : status === 'ok' ? h('span', { class: 'status st-normal' }, h('span', { class: 'status-icon' }, '✓'), next ? ` Next ${fmtDate(next)}` : ' Done') : null;
  return h('div', { class: 'row act screening-row' },
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, item.name),
      h('div', { class: 'row-meta' }, reason), last ? h('div', { class: 'row-meta muted small' }, `Last done ${fmtDate(last)}`) : null,
      item.invite ? h('div', { class: 'row-meta muted small' }, 'You are invited by letter; you don’t need to book it yourself.') : null),
    tag,
    status !== 'upcoming' ? h('details', { class: 'mark-done' }, h('summary', { class: 'btn small' }, 'Mark done'),
      h('div', { class: 'mark-done-box' }, dateIn, h('button', { class: 'btn small primary', type: 'button', onclick: async () => {
        if (!dateIn.value) return;
        const now = new Date().toISOString();
        await saveEvents([{ id: uid(), kind: 'screening', screen: item.key, title: item.name, date: dateIn.value, created: now, updated: now }]);
        toast('Saved');
        go('#/reminders');
      } }, 'Save'))) : null);
}
