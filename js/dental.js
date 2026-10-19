// Dental section: tooth chart, per-tooth history, visits with bills and X-rays, costs.

import { h, go, toast, uid } from './dom.js';
import { state, saveDental, deleteDental } from './store.js';
import { fmtDate, fmtNum, todayIso } from './format.js';
import { pageHead, thumb, openFile } from './ui.js';
import { shrinkImage, copyText } from './editor.js';
import {
  UPPER, LOWER, ALL_TEETH, PROCEDURES, PROCEDURE_NAME, SURFACES, toothName, surfaceLabel, normSurfaces,
  teethState, toothBadges, costsByYear, buildDentalPrompt, parseDentalReply,
} from './dental-data.js';

const enc = encodeURIComponent;
const FILE_KINDS = [['xray', 'X-ray'], ['bill', 'Bill / invoice'], ['photo', 'Photo'], ['other', 'Other document']];
const XRAY_TYPES = [['', '—'], ['panoramic', 'Panoramic (OPG)'], ['bitewing', 'Bitewing'], ['periapical', 'Periapical'], ['cbct', '3D / CBCT'], ['other', 'Other']];
const XRAY_NAME = Object.fromEntries(XRAY_TYPES);

const sortedVisits = () => [...state.dental].sort((a, b) => b.date.localeCompare(a.date));

export function nextCheckup() {
  const v = sortedVisits().find((x) => x.nextCheckup);
  return v ? { date: v.nextCheckup, visit: v } : null;
}

function toothButton(t, s, { compact = false } = {}) {
  const badges = toothBadges(s);
  const label = `Tooth ${t}, ${toothName(t)}${badges.length ? ': ' + describe(s) : ''}`;
  return h('a', { class: `tooth${s.present ? '' : ' missing'}${s.history.length ? ' treated' : ''}`, href: `#/teeth/tooth/${t}`, 'aria-label': label, title: label },
    h('span', { class: 'tooth-num' }, t),
    compact ? null : h('span', { class: 'tooth-badges' }, badges.join(' ')));
}

function describe(s) {
  if (!s.present) return 'missing';
  const parts = [];
  if (s.implant) parts.push('implant');
  if (s.crown) parts.push('crown');
  if (s.bridge) parts.push('bridge');
  if (s.rootcanal) parts.push('root canal treated');
  if (s.surfaces) parts.push(`filled (${s.surfaces.split('').map((c) => surfaceLabel(c, s.tooth)).join('')})`);
  if (s.veneer) parts.push('veneer');
  if (s.sealed) parts.push('sealant');
  if (s.watch) parts.push('to watch');
  return parts.join(', ') || 'no treatment recorded';
}

export function toothChart(st) {
  // Each jaw in two halves (your right | your left). On phones the halves stack, each with its own label.
  const half = (teeth, label) => h('div', { class: 'half', role: 'group', 'aria-label': label },
    h('div', { class: 'half-label' }, label), h('div', { class: 'half-teeth' }, teeth.map((t) => toothButton(t, st[t]))));
  const arch = (teeth, jaw) => h('div', { class: 'arch' },
    half(teeth.slice(0, 8), `${jaw} right · ${teeth[0]}–${teeth[7]}`), half(teeth.slice(8), `${jaw} left · ${teeth[8]}–${teeth[15]}`));
  return h('div', { class: 'tooth-chart' },
    arch(UPPER, 'Upper'),
    arch(LOWER, 'Lower'),
    h('p', { class: 'caption' }, 'As seen when facing you. × missing · F filling · RC root canal · C crown · I implant · B bridge · V veneer · S sealant · ! to watch'));
}

function visitRow(v) {
  const procs = [...new Set((v.items ?? []).map((it) => PROCEDURE_NAME[it.procedure] ?? it.procedure))];
  const total = Number(v.total) || (v.items ?? []).reduce((a, it) => a + (Number(it.price) || 0), 0);
  return h('a', { class: 'row', href: `#/teeth/visit/${enc(v.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, fmtDate(v.date), v.clinic ? ` · ${v.clinic}` : ''),
      h('div', { class: 'row-meta' }, procs.join(', ') || 'Visit', (v.files ?? []).length ? ` · ${(v.files ?? []).length} 📎` : '')),
    h('div', { class: 'row-value' }, total ? h('div', { class: 'value' }, `${fmtNum(total)} ${v.currency || ''}`.trim()) : null));
}

async function xrayGallery(filterTooth) {
  const xs = sortedVisits().flatMap((v) => (v.files ?? []).filter((f) => f.kind === 'xray' && (!filterTooth || !f.teeth?.length || f.teeth.includes(filterTooth))).map((f) => ({ f, v })));
  if (!xs.length) return null;
  const grid = h('div', { class: 'xray-grid' });
  for (const { f, v } of xs) {
    grid.append(h('figure', { class: 'xray' }, await thumb(f.id, () => openFile(f.id)),
      h('figcaption', null, fmtDate(v.date), f.xrayType ? ` · ${XRAY_NAME[f.xrayType]}` : '', f.teeth?.length ? ` · ${f.teeth.join(', ')}` : '')));
  }
  return h('section', { class: 'group' }, h('h2', null, `X-rays (${xs.length})`), grid);
}

export async function viewDental(root) {
  root.append(pageHead('Teeth', { actions: h('a', { class: 'btn primary', href: '#/teeth/add' }, '+ Visit') }));
  const st = teethState(state.dental);
  const next = nextCheckup();
  root.append(h('section', { class: 'card' }, toothChart(st)));
  if (!state.dental.length) {
    root.append(h('section', { class: 'card empty' },
      h('h2', null, 'No dental records yet'),
      h('p', null, 'Add a visit with its treatments, bill and X-rays — or let Claude read a dental bill or treatment record from a photo. Tap a tooth to see its history.'),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: '#/teeth/add' }, 'Add a visit'))));
    return;
  }
  const costs = costsByYear(state.dental);
  root.append(h('div', { class: 'split' },
    h('section', { class: 'card' }, h('h2', null, 'Next check-up'),
      next ? h('p', null, h('strong', null, fmtDate(next.date)), next.date < todayIso() ? h('span', { class: 'status st-high' }, ' ', h('span', { class: 'status-icon' }, '▲'), ' overdue') : '', h('br'),
        h('span', { class: 'muted small' }, `Recommended at the visit on ${fmtDate(next.visit.date)}${next.visit.clinic ? ' · ' + next.visit.clinic : ''}`))
        : h('p', { class: 'muted' }, 'No date set. Add the recall date from your last visit to get a reminder on the overview.')),
    costs.length ? h('section', { class: 'card' }, h('h2', null, 'Costs per year'),
      h('table', { class: 'results' }, h('tbody', null, costs.map((c) => h('tr', null, h('td', null, c.year), h('td', { class: 'value' }, `${fmtNum(c.total)} ${c.currency}`)))))) : h('div')));
  const gallery = await xrayGallery();
  if (gallery) root.append(gallery);
  root.append(h('section', { class: 'group' }, h('h2', null, `Visits (${state.dental.length})`), h('div', { class: 'card list' }, sortedVisits().map(visitRow))));
}

export async function viewTooth(root, t) {
  if (!ALL_TEETH.includes(t)) { go('#/teeth'); return; }
  const s = teethState(state.dental)[t];
  root.append(pageHead(`Tooth ${t}`, { back: '#/teeth', sub: `${toothName(t)} · ${describe(s)}` }));
  root.append(h('section', { class: 'group' }, h('h2', null, 'History'), s.history.length
    ? h('div', { class: 'card list' }, [...s.history].reverse().map((it) => h('a', { class: 'row', href: `#/teeth/visit/${enc(it.visitId)}` },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, PROCEDURE_NAME[it.procedure] ?? it.procedure, it.surfaces ? ` (${it.surfaces.split('').map((c) => surfaceLabel(c, t)).join('')})` : ''),
        h('div', { class: 'row-meta' }, fmtDate(it.date), it.clinic ? ` · ${it.clinic}` : '', it.material ? ` · ${it.material}` : '', it.note ? ` · ${it.note}` : '')),
      it.price ? h('div', { class: 'row-value' }, h('div', { class: 'small' }, fmtNum(it.price))) : null)))
    : h('p', { class: 'muted pad' }, 'Nothing recorded for this tooth.')));
  const gallery = await xrayGallery(t);
  if (gallery) root.append(gallery);
  root.append(h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: `#/teeth/add/${t}` }, `+ Treatment on tooth ${t}`)));
}

export async function viewDentalVisit(root, id) {
  const v = state.dental.find((x) => x.id === id);
  if (!v) { root.append(pageHead('Not found', { back: '#/teeth' })); return; }
  root.append(pageHead(fmtDate(v.date), { back: '#/teeth', sub: [v.clinic, v.dentist].filter(Boolean).join(' · ') || 'Dental visit',
    actions: [h('a', { class: 'btn', href: `#/teeth/edit/${enc(id)}` }, 'Edit'),
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm(`Delete the dental visit from ${fmtDate(v.date)} with its files?`)) return;
        await deleteDental(id);
        toast('Visit deleted');
        go('#/teeth');
      } }, 'Delete')] }));
  if (v.note) root.append(h('section', { class: 'card note' }, v.note));
  const total = Number(v.total) || (v.items ?? []).reduce((a, it) => a + (Number(it.price) || 0), 0);
  root.append(h('section', { class: 'group' }, h('h2', null, 'Treatments'), h('div', { class: 'card table-wrap' }, h('table', { class: 'results' },
    h('thead', null, h('tr', null, h('th', null, 'Tooth'), h('th', null, 'Treatment'), h('th', null, 'Price'))),
    h('tbody', null, (v.items ?? []).map((it) => h('tr', null,
      h('td', null, it.tooth ? h('a', { href: `#/teeth/tooth/${it.tooth}` }, it.tooth) : '—'),
      h('td', null, PROCEDURE_NAME[it.procedure] ?? it.procedure, it.surfaces ? ` (${it.surfaces})` : '', it.material ? h('div', { class: 'muted small' }, it.material) : null, it.note ? h('div', { class: 'muted small' }, it.note) : null),
      h('td', { class: 'value nowrap' }, it.price ? fmtNum(it.price) : '')))),
    total ? h('tfoot', null, h('tr', null, h('td'), h('td', { class: 'value' }, 'Total'), h('td', { class: 'value nowrap' }, `${fmtNum(total)} ${v.currency || ''}`))) : null))));
  if (v.nextCheckup) root.append(h('p', null, 'Next check-up: ', h('strong', null, fmtDate(v.nextCheckup))));
  if (v.files?.length) {
    const grid = h('div', { class: 'xray-grid' });
    for (const f of v.files) grid.append(h('figure', { class: 'xray' }, await thumb(f.id, () => openFile(f.id)),
      h('figcaption', null, FILE_KINDS.find(([k]) => k === f.kind)?.[1] ?? 'File', f.xrayType ? ` · ${XRAY_NAME[f.xrayType]}` : '', f.teeth?.length ? ` · ${f.teeth.join(', ')}` : '')));
    root.append(h('section', { class: 'group' }, h('h2', null, 'Bills, X-rays and photos'), grid));
  }
}

// ---- editor ------------------------------------------------------------------------------

let dirty = false;
export const dentalDirty = () => dirty;
export const clearDentalDirty = () => { dirty = false; };

export async function viewDentalEditor(root, id, presetTooth) {
  const existing = id ? state.dental.find((x) => x.id === id) : null;
  if (id && !existing) { root.append(pageHead('Not found', { back: '#/teeth' })); return; }
  dirty = false;
  const touch = () => { dirty = true; };
  const last = sortedVisits()[0];
  const v = existing ? structuredClone(existing) : { id: uid(), date: todayIso(), clinic: last?.clinic ?? '', dentist: last?.dentist ?? '', currency: last?.currency ?? 'EUR',
    total: null, nextCheckup: '', note: '', items: presetTooth ? [{ tooth: presetTooth, procedure: 'filling', surfaces: '', material: '', price: null, note: '' }] : [], files: [] };
  v.items ??= [];
  v.files ??= [];
  const newFiles = [];
  const removedFileIds = [];

  root.append(pageHead(existing ? 'Edit dental visit' : 'Add dental visit', { back: existing ? `#/teeth/visit/${enc(id)}` : '#/teeth' }));
  const inputs = {};
  const field = (key, label, attrs = {}) => h('label', null, h('span', null, label),
    (inputs[key] = h('input', { type: 'text', value: v[key] ?? '', ...attrs, oninput: (e) => { v[key] = e.target.value; touch(); } })));
  const dateIn = (inputs.date = h('input', { type: 'date', value: v.date, oninput: (e) => { v.date = e.target.value; touch(); } }));
  root.append(h('section', { class: 'card form' },
    h('div', { class: 'bp-row2' }, h('label', null, h('span', null, 'Date'), dateIn), field('clinic', 'Clinic')),
    h('div', { class: 'bp-row2' }, field('dentist', 'Dentist'), field('currency', 'Currency', { placeholder: 'EUR, UAH…' })),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Total paid (optional)'), (inputs.total = h('input', { type: 'text', inputmode: 'decimal', value: v.total ?? '', oninput: (e) => { v.total = Number(e.target.value.replace(',', '.')) || null; touch(); } }))),
      h('label', null, h('span', null, 'Next check-up'), (inputs.nextCheckup = h('input', { type: 'date', value: v.nextCheckup ?? '', oninput: (e) => { v.nextCheckup = e.target.value; touch(); } })))),
    h('label', null, h('span', null, 'Note'), h('textarea', { rows: 2, value: v.note ?? '', oninput: (e) => { v.note = e.target.value; touch(); } }))));

  // Claude
  if (!existing) {
    const reply = h('textarea', { rows: 3, class: 'mono', placeholder: 'Paste Claude’s reply here' });
    root.append(h('section', { class: 'card claude' }, h('h2', null, 'Read a dental bill or record with Claude'),
      h('ol', { class: 'steps' },
        h('li', null, h('button', { class: 'btn primary', type: 'button', onclick: async () => toast((await copyText(buildDentalPrompt())) ? 'Instructions copied' : 'Copy failed') }, 'Copy instructions')),
        h('li', null, 'In the Claude app, attach the bill or treatment record, paste and send.'),
        h('li', null, 'Paste the reply here:', reply, h('button', { class: 'btn primary', type: 'button', onclick: () => {
          try {
            const [first] = parseDentalReply(reply.value);
            if (!first) { toast('Nothing found'); return; }
            for (const k of ['date', 'clinic', 'dentist', 'currency', 'total', 'nextCheckup']) {
              if (first[k]) { v[k] = first[k]; inputs[k].value = first[k]; }
            }
            v.items.push(...first.items);
            reply.value = '';
            touch();
            renderItems();
            toast(`${first.items.length} treatments added — check them below`);
          } catch (err) { toast(err instanceof SyntaxError ? 'The reply isn’t complete JSON' : err.message); }
        } }, 'Read treatments')))));
  }

  // Items
  const box = h('div', { class: 'rows' });
  const renderItems = () => {
    box.replaceChildren(...v.items.map((it) => {
      const surf = h('div', { class: 'chips' }, SURFACES.map((c) => h('button', { type: 'button', class: 'chip' + (it.surfaces?.includes(c) ? ' on' : ''), 'aria-pressed': String(!!it.surfaces?.includes(c)),
        title: { M: 'mesial', D: 'distal', O: 'occlusal / incisal', B: 'buccal / labial', L: 'lingual / palatal' }[c],
        onclick: () => { it.surfaces = normSurfaces(it.surfaces?.includes(c) ? it.surfaces.replace(c, '') : (it.surfaces ?? '') + c); touch(); renderItems(); } }, surfaceLabel(c, it.tooth))));
      return h('div', { class: 'row-edit' },
        h('div', { class: 'row-edit-head' },
          h('select', { 'aria-label': 'Tooth', value: it.tooth ?? '', onchange: (e) => { it.tooth = e.target.value; touch(); renderItems(); } },
            h('option', { value: '' }, 'No specific tooth'), ALL_TEETH.map((t) => h('option', { value: t }, `${t} · ${toothName(t)}`))),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove', onclick: () => { v.items.splice(v.items.indexOf(it), 1); touch(); renderItems(); } }, '×')),
        h('select', { 'aria-label': 'Treatment', value: it.procedure, onchange: (e) => { it.procedure = e.target.value; touch(); renderItems(); } },
          PROCEDURES.map(([k, n]) => h('option', { value: k }, n))),
        ['filling', 'temp_filling', 'inlay'].includes(it.procedure) ? h('div', null, h('span', { class: 'label' }, 'Surfaces'), surf) : null,
        h('div', { class: 'row-edit-grid two' },
          h('label', null, h('span', null, 'Material'), h('input', { type: 'text', value: it.material ?? '', oninput: (e) => { it.material = e.target.value; touch(); } })),
          h('label', null, h('span', null, 'Price'), h('input', { type: 'text', inputmode: 'decimal', value: it.price ?? '', oninput: (e) => { it.price = Number(e.target.value.replace(',', '.')) || null; touch(); } }))),
        h('label', null, h('span', null, 'Note'), h('input', { type: 'text', value: it.note ?? '', oninput: (e) => { it.note = e.target.value; touch(); } })));
    }));
    if (!v.items.length) box.append(h('p', { class: 'muted pad' }, 'No treatments yet.'));
  };
  root.append(h('section', { class: 'group' },
    h('div', { class: 'group-head' }, h('h2', null, 'Treatments'),
      h('button', { class: 'btn', type: 'button', onclick: () => { v.items.push({ tooth: '', procedure: 'checkup', surfaces: '', material: '', price: null, note: '' }); touch(); renderItems(); } }, '+ Treatment')),
    box));
  renderItems();

  // Files
  const files = h('div', { class: 'rows' });
  const fileIn = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, class: 'offscreen', id: 'dental-in', onchange: async (e) => {
    for (const f of e.target.files) {
      const blob = await shrinkImage(f);
      const rec = { id: uid(), blob, type: blob.type || f.type, name: f.name };
      newFiles.push(rec);
      v.files.push({ id: rec.id, type: rec.type, name: rec.name, kind: /bill|rechnung|lasku|рахун|invoice/i.test(f.name) ? 'bill' : 'xray', xrayType: '', teeth: [] });
    }
    e.target.value = '';
    touch();
    renderFiles();
  } });
  const renderFiles = async () => {
    const out = [];
    for (const f of v.files) {
      const pending = newFiles.find((n) => n.id === f.id);
      const t = pending ? h('div', { class: 'thumb' }, pending.type.startsWith('image/') ? h('img', { src: URL.createObjectURL(pending.blob), alt: '' }) : h('span', { class: 'thumb-doc' }, 'PDF')) : await thumb(f.id, () => openFile(f.id));
      out.push(h('div', { class: 'row-edit file-edit' }, t, h('div', { class: 'stack' },
        h('div', { class: 'bp-row2' },
          h('select', { 'aria-label': 'Kind', value: f.kind, onchange: (e) => { f.kind = e.target.value; touch(); renderFiles(); } }, FILE_KINDS.map(([k, n]) => h('option', { value: k }, n))),
          f.kind === 'xray' ? h('select', { 'aria-label': 'X-ray type', value: f.xrayType ?? '', onchange: (e) => { f.xrayType = e.target.value; touch(); } }, XRAY_TYPES.map(([k, n]) => h('option', { value: k }, n))) : h('span')),
        f.kind === 'xray' ? h('input', { type: 'text', placeholder: 'Teeth shown, e.g. 16 17 46 (empty = all)', value: (f.teeth ?? []).join(' '),
          oninput: (e) => { f.teeth = e.target.value.split(/[\s,;]+/).filter((x) => ALL_TEETH.includes(x)); touch(); } }) : null,
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          v.files.splice(v.files.indexOf(f), 1);
          const i = newFiles.findIndex((n) => n.id === f.id);
          if (i >= 0) newFiles.splice(i, 1); else removedFileIds.push(f.id);
          touch();
          renderFiles();
        } }, 'Remove'))));
    }
    files.replaceChildren(...out);
  };
  root.append(h('section', { class: 'group' },
    h('div', { class: 'group-head' }, h('h2', null, 'Bills, X-rays and photos'), h('label', { class: 'btn', for: 'dental-in' }, '+ Add files')), fileIn, files));
  renderFiles();

  root.append(h('div', { class: 'save-bar' },
    h('a', { class: 'btn', href: existing ? `#/teeth/visit/${enc(id)}` : '#/teeth' }, 'Cancel'),
    h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      if (!v.date) { toast('Set the date'); return; }
      v.items = v.items.filter((it) => it.procedure);
      v.updated = new Date().toISOString();
      try { await saveDental(v, { newFiles, removedFileIds }); } catch (err) { toast('Saving failed: ' + (err?.message ?? err)); return; }
      dirty = false;
      toast('Visit saved');
      go(`#/teeth/visit/${enc(v.id)}`);
    } }, 'Save visit')));
}
