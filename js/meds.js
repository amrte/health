// Medicines, supplements and allergies: list, editor, import from Claude and from
// doctor letters, and the medicine context shown on test pages.

import { h, go, toast, uid } from './dom.js';
import { state, saveMeds, deleteMed } from './store.js';
import { pageHead } from './ui.js';
import { findingItem } from './insights.js';
import { fmtDate, todayIso } from './format.js';
import { copyText } from './editor.js';
import { KINDS, KIND_NAME, SEVERITY, GROUPS, drugGroups, isCurrent, medsForMetric, buildMedsPrompt, parseMedsReply, medsFromLetter } from './meds-data.js';
import { normName } from './metrics.js';

const enc = encodeURIComponent;
const SEVERITY_NAME = Object.fromEntries(SEVERITY);

function medMeta(m) {
  const today = todayIso();
  const when = m.stop && m.stop < today ? `${m.start ? fmtDate(m.start) : '?'} – ${fmtDate(m.stop)}`
    : m.start ? `since ${fmtDate(m.start)}${m.stop ? `, until ${fmtDate(m.stop)}` : ''}` : '';
  return [m.dose, m.schedule, m.reason ? `for ${m.reason}` : '', when].filter(Boolean).join(' · ');
}

function medRow(m) {
  const groups = [...drugGroups(m)].map((g) => GROUPS[g].name);
  return h('a', { class: 'row', href: `#/meds/edit/${enc(m.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, m.name, m.kind === 'supplement' ? h('span', { class: 'type-badge' }, 'Supplement') : null),
      h('div', { class: 'row-meta' }, m.kind === 'allergy'
        ? [m.reaction, SEVERITY_NAME[m.severity] && m.severity ? SEVERITY_NAME[m.severity] : '', m.start ? `noted ${fmtDate(m.start)}` : ''].filter(Boolean).join(' · ') || 'No details'
        : medMeta(m) || 'No details'),
      groups.length && m.kind !== 'allergy' ? h('div', { class: 'row-meta muted small' }, groups.join(', ')) : null));
}

// Pending items (from Claude or a letter): pick, then save.
function importPreview(items, { title, onDone }) {
  const keep = items.map(() => true);
  return h('section', { class: 'card' }, h('h2', null, title),
    h('div', { class: 'card list flat' }, items.map((m, i) => h('label', { class: 'row check-row' },
      h('input', { type: 'checkbox', checked: true, onchange: (e) => { keep[i] = e.target.checked; } }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, m.name, ' ', h('span', { class: 'muted small' }, KIND_NAME[m.kind])),
        h('div', { class: 'row-meta' }, m.kind === 'allergy' ? m.reaction : medMeta(m)))))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const now = new Date().toISOString();
        const chosen = items.filter((_, i) => keep[i]).map((m) => ({ id: uid(), note: '', created: now, ...m }));
        if (!chosen.length) { toast('Nothing selected'); return; }
        await saveMeds(chosen);
        toast(`Added ${chosen.length} to your list — open one to add details`);
        onDone?.();
        go('#/meds');
      } }, 'Add selected'),
      h('button', { class: 'btn', type: 'button', onclick: () => go('#/meds') }, 'Cancel')));
}

// Medicines in doctor letters that aren't on the list yet.
function lettersWithNewMeds() {
  const known = new Set(state.meds.map((m) => normName(m.name).split(' ')[0]));
  return state.reports.filter((r) => r.medications?.length)
    .map((r) => ({ r, items: medsFromLetter(r.medications, r.date).filter((m) => !known.has(normName(m.name).split(' ')[0])) }))
    .filter((x) => x.items.length)
    .sort((a, b) => b.r.date.localeCompare(a.r.date));
}

export function viewMeds(root) {
  root.append(pageHead('Medicines & allergies', { sub: 'What you take, what you took, and what you react to',
    actions: [h('a', { class: 'btn', href: '#/meds/add/allergy' }, '+ Allergy'), h('a', { class: 'btn primary', href: '#/meds/add/medicine' }, '+ Medicine')] }));
  const today = todayIso();
  const allergies = state.meds.filter((m) => m.kind === 'allergy').sort((a, b) => a.name.localeCompare(b.name));
  const current = state.meds.filter((m) => isCurrent(m, today)).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const planned = state.meds.filter((m) => m.kind !== 'allergy' && m.start > today);
  const past = state.meds.filter((m) => m.kind !== 'allergy' && m.stop && m.stop < today).sort((a, b) => b.stop.localeCompare(a.stop));

  const findings = state.findings.filter((f) => f.kind === 'meds');
  if (findings.length) root.append(h('section', { class: 'card findings' }, h('h2', null, 'What this means'), findings.map((f) => findingItem(f, { link: f.medId ? `#/meds/edit/${enc(f.medId)}` : null }))));

  root.append(h('div', { class: 'split' },
    h('section', { class: 'group' }, h('h2', null, `Allergies and intolerances (${allergies.length})`),
      allergies.length ? h('div', { class: 'card list allergy-list' }, allergies.map(medRow))
        : h('div', { class: 'card empty' }, h('p', null, 'No allergies recorded. If you have none, that is worth knowing too — add a note to your profile at the doctor’s.'))),
    h('section', { class: 'group' }, h('h2', null, `Taking now (${current.length})`),
      current.length ? h('div', { class: 'card list' }, current.map(medRow))
        : h('div', { class: 'card empty' }, h('p', null, 'Nothing on the list. Add medicines and supplements with their start date: test pages then show them next to your results, and the app checks them against your allergies and DNA.')))));

  const letters = lettersWithNewMeds();
  if (letters.length) {
    root.append(h('section', { class: 'group' }, h('h2', null, 'In doctor letters, not on your list'),
      h('div', { class: 'card list' }, letters.map(({ r, items }) => h('a', { class: 'row', href: `#/meds/import/${enc(r.id)}` },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, items.map((m) => m.name).join(', ')),
          h('div', { class: 'row-meta' }, `${fmtDate(r.date)} · ${r.doctor || r.lab || 'Letter'}`)),
        h('span', { class: 'btn small' }, 'Add…'))))));
  }

  const reply = h('textarea', { rows: 3, class: 'mono', placeholder: 'Paste Claude’s reply here' });
  const previewBox = h('div');
  root.append(h('section', { class: 'card claude' }, h('h2', null, 'Read packages, a prescription or a medication list with Claude'),
    h('ol', { class: 'steps' },
      h('li', null, h('button', { class: 'btn primary', type: 'button', onclick: async () => toast((await copyText(buildMedsPrompt())) ? 'Instructions copied' : 'Copy failed') }, 'Copy instructions')),
      h('li', null, 'In the Claude app, attach photos of the packages, the prescription (e.g. from Omakanta or the e-Rezept app) or your allergy card, paste and send.'),
      h('li', null, 'Paste the reply here:', reply, h('button', { class: 'btn primary', type: 'button', onclick: () => {
        try {
          const items = parseMedsReply(reply.value);
          if (!items.length) { toast('Nothing found'); return; }
          previewBox.replaceChildren(importPreview(items, { title: `Found ${items.length}` }));
          previewBox.scrollIntoView({ behavior: 'smooth' });
        } catch (err) { toast(err instanceof SyntaxError ? 'The reply isn’t complete JSON' : err.message); }
      } }, 'Read list')))), previewBox);

  if (planned.length) root.append(h('section', { class: 'group' }, h('h2', null, 'Starting later'), h('div', { class: 'card list' }, planned.map(medRow))));
  if (past.length) root.append(h('section', { class: 'group' }, h('h2', null, `Stopped (${past.length})`), h('div', { class: 'card list' }, past.map(medRow))));
}

export function viewMedsFromLetter(root, reportId) {
  const r = state.reportById.get(reportId);
  root.append(pageHead('Add from a letter', { back: '#/meds' }));
  if (!r?.medications?.length) { root.append(h('p', { class: 'pad' }, 'No medicines in this letter.')); return; }
  root.append(h('p', { class: 'muted' }, `${fmtDate(r.date)} · ${r.doctor || r.lab}. The letter’s date is used as start date — change it afterwards if needed.`),
    importPreview(medsFromLetter(r.medications, r.date), { title: 'Medicines in the letter' }));
}

export function viewMedEditor(root, { id, kind } = {}) {
  const existing = id ? state.meds.find((m) => m.id === id) : null;
  if (id && !existing) { root.append(pageHead('Not found', { back: '#/meds' })); return; }
  const m = existing ? { ...existing } : { id: uid(), kind: KIND_NAME[kind] ? kind : 'medicine', name: '', ingredient: '', dose: '', schedule: '', reason: '', start: kind === 'allergy' ? '' : todayIso(), stop: '', reaction: '', severity: '', note: '', created: new Date().toISOString() };
  const isAllergy = () => m.kind === 'allergy';
  root.append(pageHead(existing ? m.name : `New ${KIND_NAME[m.kind].toLowerCase()}`, { back: '#/meds' }));

  const text = (key, label, attrs = {}) => h('label', { 'data-k': key }, h('span', null, label),
    h('input', { type: 'text', value: m[key] ?? '', oninput: (e) => { m[key] = e.target.value; }, ...attrs }));
  const date = (key, label) => h('label', { 'data-k': key }, h('span', null, label),
    h('input', { type: 'date', value: m[key] ?? '', oninput: (e) => { m[key] = e.target.value; } }));
  const medFields = h('div', { class: 'stack-tight' },
    h('div', { class: 'bp-row2' }, text('ingredient', 'Active ingredient', { placeholder: 'e.g. atorvastatin' }), text('dose', 'Strength', { placeholder: 'e.g. 20 mg' })),
    h('div', { class: 'bp-row2' }, text('schedule', 'How you take it', { placeholder: 'e.g. 1 tablet in the evening' }), text('reason', 'What for', { placeholder: 'e.g. cholesterol' })),
    h('div', { class: 'bp-row2' }, date('start', 'Started'), date('stop', 'Stopped (empty = still taking)')));
  const allergyFields = h('div', { class: 'stack-tight' },
    h('div', { class: 'bp-row2' }, text('reaction', 'Reaction', { placeholder: 'e.g. rash, swelling' }),
      h('label', null, h('span', null, 'Severity'), h('select', { value: m.severity, onchange: (e) => { m.severity = e.target.value; } }, SEVERITY.map(([k, n]) => h('option', { value: k }, n))))),
    date('start', 'Noted on'));
  const sync = () => { medFields.hidden = isAllergy(); allergyFields.hidden = !isAllergy(); };
  root.append(h('form', { class: 'card form', onsubmit: async (e) => {
    e.preventDefault();
    m.name = m.name.trim();
    if (!m.name) { toast('Enter a name'); return; }
    if (!isAllergy() && m.start && m.stop && m.stop < m.start) { toast('The stop date is before the start date'); return; }
    m.updated = new Date().toISOString();
    await saveMeds([m]);
    toast('Saved');
    go('#/meds');
  } },
    h('label', null, h('span', null, 'Type'), h('select', { value: m.kind, onchange: (e) => { m.kind = e.target.value; sync(); } }, KINDS.map(([k, n]) => h('option', { value: k }, n)))),
    text('name', 'Name', { placeholder: 'As on the package, or the substance', required: true }),
    medFields, allergyFields,
    h('label', null, h('span', null, 'Note'), h('textarea', { rows: 2, value: m.note ?? '', oninput: (e) => { m.note = e.target.value; } })),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
      existing && !isAllergy() && !m.stop ? h('button', { class: 'btn', type: 'button', onclick: async () => {
        await saveMeds([{ ...m, stop: todayIso(), updated: new Date().toISOString() }]);
        toast('Marked as stopped today');
        go('#/meds');
      } }, 'Stopped today') : null,
      existing ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm(`Delete ${m.name}?`)) return;
        await deleteMed(m.id);
        toast('Deleted');
        go('#/meds');
      } }, 'Delete') : null)));
  sync();
}

// On a test page: medicines and supplements that affect this test.
export function metricMedsCard(key) {
  const list = medsForMetric(state.meds, key);
  if (!list.length) return null;
  return h('section', { class: 'card' }, h('h2', null, 'Medicines that affect this test'),
    h('div', { class: 'card list flat' }, list.map(medRow)),
    h('p', { class: 'caption' }, 'Shown as olive bars along the top of the chart, from start to stop. Illnesses from your timeline are shaded blue-grey.'));
}

export function medPeriods(key) {
  return medsForMetric(state.meds, key).map((m) => ({ start: m.start, end: m.stop, label: m.name, kind: 'med' }));
}
