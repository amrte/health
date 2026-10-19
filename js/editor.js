// Add / edit a lab report: date, lab, photos, and the results table.
//
// Results come from Claude (copy the instructions, send them with the photo in
// the Claude app, paste the reply back) or are typed in. Every row is shown for
// checking before anything is saved.

import { h, go, toast, uid } from './dom.js';
import { METRICS, CATEGORIES, getMetric, matchMetric, customKey } from './metrics.js';
import { canConvert, convert, suggestUnits, unitLooksWrong, unitOptions } from './units.js';
import { parseValue, parseRange, parseExtraction, buildPrompt, REPORT_TYPES, REPORT_TYPE_NAME, isDocType, textStatus } from './parse.js';
import { state, saveReport, statusOf } from './store.js';
import { fmtNum, fmtRange, todayIso, fmtDate } from './format.js';
import { pageHead, statusChip, thumb, openFile } from './ui.js';

let dirty = false;
export function editorDirty() {
  return dirty;
}
export function clearDirty() {
  dirty = false;
}

export async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { class: 'offscreen' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function metricSelect(row, onchange) {
  return h('select', { class: 'metric-select', 'aria-label': 'Test', value: row.metric.startsWith('custom:') ? 'custom' : row.metric || 'custom',
    onchange: (e) => onchange(e.target.value) },
    h('option', { value: 'custom' }, 'Not in list — keep printed name'),
    CATEGORIES.map(([cat, title]) => {
      const ms = METRICS.filter((m) => m.cat === cat && !m.derived);
      return ms.length ? h('optgroup', { label: title }, ms.map((m) => h('option', { value: m.key }, `${m.name} (${m.unit || 'no unit'})`))) : null;
    }));
}

// Buttons that set the row's unit to a suggested one, with the value it gives.
function unitChoices(cands, m, onUnit) {
  return h('div', { class: 'unit-choices' }, cands.map((c) => h('button', { class: 'btn small', type: 'button', onclick: () => onUnit(c.unit) },
    c.unit, c.v != null ? h('span', { class: 'muted' }, ` → ${fmtNum(+c.v.toPrecision(3))} ${m.unit}`) : null)));
}

// What the row will be saved as, e.g. "→ 148 g/L · ref 134–167 · ✓ In range".
// `typical`: this person's usual value for the test, to spot a wrong unit.
function rowPreview(row, reportDate, { typical = null, onUnit = () => {} } = {}) {
  const m = row.metric && !row.metric.startsWith('custom:') ? getMetric(row.metric) : null;
  const pv = parseValue(row.valueRaw);
  const rg = parseRange(row.refRaw);
  const out = [];
  if (!row.valueRaw.trim()) return h('div', { class: 'preview warn' }, 'No value — this row will be skipped.');
  if (!m) {
    out.push(h('span', null, row.name.trim() ? `Saved as its own test “${row.nameEn && row.nameEn.toLowerCase() !== row.name.trim().toLowerCase() ? `${row.nameEn}” (printed “${row.name.trim()}”)` : `${row.name.trim()}”`}.` : 'Pick a test or type the printed name.'));
  } else if (pv.value != null && !canConvert(row.unit, m)) {
    const sugg = suggestUnits(row.unit, m, pv.value, typical);
    const all = sugg.length ? sugg : unitOptions(m, pv.value);
    return h('div', { class: 'preview warn' }, `Unit “${row.unit}” isn’t clear for ${m.name}. `,
      sugg.length ? 'Did you mean:' : `Units for ${m.name}:`, unitChoices(all, m, onUnit));
  } else if (pv.value != null) {
    const v = convert(pv.value, row.unit, m);
    const lo = convert(rg.low, row.unit, m);
    const hi = convert(rg.high, row.unit, m);
    out.push(h('span', null, `→ ${pv.qualifier}${fmtNum(v)} ${m.unit}`, lo != null || hi != null ? ` · ref ${fmtRange(lo, hi)}` : ''));
    const wrong = unitLooksWrong(row.unit, m, pv.value, typical);
    if (wrong.length) {
      out.push(h('div', { class: 'warn small' }, `Unusual for you — your results are usually about ${fmtNum(+typical.toPrecision(3))} ${m.unit}. Is the unit perhaps:`, unitChoices(wrong, m, onUnit)));
    }
  } else {
    out.push(h('span', null, `Text result “${pv.text}”`));
  }
  const ts = pv.value == null ? textStatus(row.valueRaw, row.refRaw) : null;
  if (row.refRaw.trim() && rg.low == null && rg.high == null && !ts) out.push(h('span', { class: 'warn' }, ' · reference not understood'));
  const st = ts ?? statusOf(pv.value, rg.low, rg.high, row.flag || pv.flag);
  if (st !== 'none') out.push(' · ', statusChip(st));
  if (row.date && row.date !== reportDate) out.push(h('span', null, ` · dated ${fmtDate(row.date)}`));
  return h('div', { class: 'preview' }, out);
}

export async function viewEditor(root, id, presetType) {
  const existing = id ? state.reportById.get(id) : null;
  if (id && !existing) {
    root.append(pageHead('Not found', { back: '#/reports' }));
    return;
  }
  dirty = false;
  const report = existing ? structuredClone(existing) : { id: uid(), type: REPORT_TYPE_NAME[presetType] ? presetType : 'lab', date: todayIso(), lab: '', note: '', files: [], created: new Date().toISOString() };
  report.files ??= [];
  report.type ??= 'lab';
  for (const k of ['diagnoses', 'recommendations', 'medications']) report[k] ??= [];
  const rows = existing
    ? (state.obsByReport.get(id) ?? []).map((o) => ({ id: o.id, name: o.name, nameEn: o.nameEn ?? '', metric: o.metric, valueRaw: o.valueRaw, unit: o.unit, refRaw: o.refRaw, flag: o.flag ?? '', date: o.date === report.date ? '' : o.date }))
    : [];
  const newFiles = [];
  const removedFileIds = [];
  const touch = () => { dirty = true; };

  root.append(pageHead(existing ? 'Edit record' : `New: ${REPORT_TYPE_NAME[report.type]}`, { back: existing ? `#/report/${encodeURIComponent(id)}` : '#/' }));

  // --- report details
  const dateIn = h('input', { type: 'date', value: report.date, required: true, oninput: (e) => { report.date = e.target.value; touch(); renderRows(); } });
  const labIn = h('input', { type: 'text', value: report.lab, placeholder: 'e.g. city clinic, lab name', list: 'labs', oninput: (e) => { report.lab = e.target.value; touch(); } });
  const labs = [...new Set(state.reports.map((r) => r.lab).filter(Boolean))];
  // Letter / heart-report fields (doctor, summary, diagnoses, …), hidden for plain lab results.
  const docInputs = {};
  const docField = (key, label, multi) => h('label', null, h('span', null, label),
    (docInputs[key] = multi
      ? h('textarea', { rows: 3, value: (report[key] ?? []).join('\n'), placeholder: 'One per line', oninput: (e) => { report[key] = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); touch(); } })
      : h(key === 'summary' || key === 'conclusion' ? 'textarea' : 'input', { type: key === 'followUp' ? 'date' : 'text', rows: 3, value: report[key] ?? '', oninput: (e) => { report[key] = e.target.value; touch(); } })));
  const docBox = h('details', { class: 'doc-fields', hidden: !isDocType(report.type), open: !!(report.summary || report.diagnoses?.length) },
    h('summary', null, 'Summary, diagnoses, advice and follow-up', h('span', { class: 'muted small' }, ' — Claude fills these in')),
    h('div', { class: 'bp-row2' }, docField('doctor', 'Doctor'), docField('specialty', 'Specialty')),
    docField('summary', 'Summary'),
    docField('conclusion', 'Conclusion as written'),
    docField('diagnoses', 'Diagnoses', true),
    docField('recommendations', 'Recommendations', true),
    docField('medications', 'Medications', true),
    docField('followUp', 'Follow-up / control date'));
  const fillDoc = (d) => {
    for (const k of ['doctor', 'specialty', 'summary', 'conclusion', 'followUp']) if (d[k] && !report[k]) { report[k] = d[k]; docInputs[k].value = d[k]; }
    for (const k of ['diagnoses', 'recommendations', 'medications']) if (d[k]?.length) { report[k] = [...new Set([...(report[k] ?? []), ...d[k]])]; docInputs[k].value = report[k].join('\n'); }
    docBox.open = true;
  };
  root.append(h('section', { class: 'card form' },
    h('label', null, h('span', null, 'Type'), h('select', { value: report.type, onchange: (e) => {
      report.type = e.target.value;
      docBox.hidden = !isDocType(report.type);
      copyBtn.textContent = 'Copy instructions';
      touch();
    } }, REPORT_TYPES.map(([k, n]) => h('option', { value: k }, n)))),
    h('label', null, h('span', null, report.type === 'lab' ? 'Sample date — used for all results below' : 'Date — used for all values below'), dateIn),
    h('label', null, h('span', null, 'Lab, clinic or hospital'), labIn, h('datalist', { id: 'labs' }, labs.map((l) => h('option', { value: l })))),
    docBox,
    h('label', null, h('span', null, 'Note'), h('textarea', { rows: 2, value: report.note, placeholder: 'Optional: why it was done, how you felt…', oninput: (e) => { report.note = e.target.value; touch(); } }))));

  // --- photos
  const thumbs = h('div', { class: 'thumbs' });
  const fileIn = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, class: 'offscreen', id: 'file-in',
    onchange: async (e) => {
      for (const f of e.target.files) {
        const blob = await shrinkImage(f);
        const rec = { id: uid(), blob, type: blob.type || f.type, name: f.name };
        newFiles.push(rec);
        report.files.push({ id: rec.id, type: rec.type, name: rec.name });
      }
      e.target.value = '';
      touch();
      renderThumbs();
    } });
  async function renderThumbs() {
    const items = [];
    for (const f of report.files) {
      const pending = newFiles.find((n) => n.id === f.id);
      let t;
      if (pending) {
        t = h('button', { class: 'thumb', type: 'button' });
        if (pending.type.startsWith('image/')) t.append(h('img', { src: URL.createObjectURL(pending.blob), alt: '' }));
        else t.append(h('span', { class: 'thumb-doc' }, 'PDF'));
      } else {
        t = await thumb(f.id, () => openFile(f.id));
      }
      items.push(h('div', { class: 'thumb-box' }, t, h('button', { class: 'thumb-del', type: 'button', 'aria-label': 'Remove photo',
        onclick: () => {
          report.files = report.files.filter((x) => x.id !== f.id);
          const i = newFiles.findIndex((n) => n.id === f.id);
          if (i >= 0) newFiles.splice(i, 1); else removedFileIds.push(f.id);
          touch();
          renderThumbs();
        } }, '×')));
    }
    items.push(h('label', { class: 'thumb add', for: 'file-in' }, h('span', null, '+'), h('small', null, 'Photo')));
    thumbs.replaceChildren(...items);
  }
  root.append(h('section', { class: 'group' }, h('h2', null, 'Photos & screenshots'),
    h('p', { class: 'hint' }, 'Kept with the report so you can always check the original.'), thumbs, fileIn));
  renderThumbs();

  // --- Claude extraction
  const replyIn = h('textarea', { rows: 4, placeholder: 'Paste Claude’s reply here', class: 'mono' });
  const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    const ok = await copyText(buildPrompt(report.type));
    toast(ok ? 'Instructions copied' : 'Copy failed — try again');
    if (ok) copyBtn.textContent = '✓ Copied — copy again';
  } }, 'Copy instructions');
  const readBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
    try {
      const res = parseExtraction(replyIn.value);
      if (res.date && (!existing || !rows.length)) { report.date = res.date; dateIn.value = res.date; }
      if (res.lab && !report.lab) { report.lab = res.lab; labIn.value = res.lab; }
      if (isDocType(report.type)) fillDoc(res.doc);
      for (const r of res.rows) {
        if (r.date === report.date) r.date = '';
        rows.push({ id: uid(), ...r, metric: r.metric || (r.name ? customKey(r.name) : '') });
      }
      replyIn.value = '';
      touch();
      renderRows();
      toast(!isDocType(report.type) ? `${res.rows.length} results added — check them below` : `Summary and ${res.rows.length} values added — check them`);
      rowsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast(err instanceof SyntaxError ? 'The reply isn’t complete JSON. Copy the whole code block.' : err.message);
    }
  } }, 'Read results');
  root.append(h('section', { class: 'card claude' },
    h('h2', null, 'Read it with Claude'),
    h('ol', { class: 'steps' },
      h('li', null, copyBtn),
      h('li', null, 'Open the Claude app, start a new chat, attach the photo(s) or PDF of this document, paste the instructions and send. ',
        h('a', { href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, 'Open Claude')),
      h('li', null, 'Copy Claude’s whole reply (the copy button under the code block) and paste it here:', replyIn, readBtn)),
    h('p', { class: 'hint' }, 'Several photos of one report can go in the same chat. For screenshots that list several dates, each result keeps its own date.')));

  // --- results
  const rowsBox = h('div', { class: 'rows' });
  const countEl = h('span', { class: 'muted' });
  root.append(h('section', { class: 'group' },
    h('div', { class: 'group-head' }, h('h2', null, 'Results ', countEl),
      h('button', { class: 'btn', type: 'button', onclick: () => { rows.push({ id: uid(), name: '', metric: '', valueRaw: '', unit: '', refRaw: '', flag: '', date: '' }); touch(); renderRows(); rowsBox.lastElementChild?.querySelector('select')?.focus(); } }, '+ Add row')),
    rowsBox));

  // Median of this person's earlier results for a test (other reports), in its canonical unit.
  const typicalFor = (key) => {
    const vs = (state.byMetric.get(key)?.pts ?? []).filter((p) => p.v != null && p.o.reportId !== report.id).map((p) => p.v).sort((a, b) => a - b);
    return vs.length ? vs[Math.floor(vs.length / 2)] : null;
  };

  function renderRows() {
    countEl.textContent = rows.length ? `(${rows.length})` : '';
    if (!rows.length) {
      rowsBox.replaceChildren(h('p', { class: 'muted pad' }, 'No results yet. Use Claude above, or add rows by hand.'));
      return;
    }
    rowsBox.replaceChildren(...rows.map((row) => {
      const preview = h('div');
      const refresh = () => preview.replaceChildren(rowPreview(row, report.date, { typical: typicalFor(row.metric),
        onUnit: (u) => { row.unit = u; touch(); renderRows(); } }));
      const field = (key, label, attrs = {}) => h('label', { class: 'f-' + key }, h('span', null, label),
        h('input', { type: 'text', value: row[key], ...attrs, oninput: (e) => {
          row[key] = e.target.value;
          if (key === 'name' && (!row.metric || row.metric.startsWith('custom:'))) {
            const k = matchMetric(row.name, row.unit, parseValue(row.valueRaw).value);
            row.metric = k ?? (row.name ? customKey(row.name) : '');
            sel.value = k ?? 'custom';
          }
          touch();
          refresh();
        } }));
      const sel = metricSelect(row, (v) => {
        row.metric = v === 'custom' ? (row.name ? customKey(row.name) : '') : v;
        if (v !== 'custom' && !row.unit) row.unit = getMetric(v)?.unit ?? '';
        touch();
        renderRows();
      });
      // Rows use the report's date; a row only gets its own date when it differs
      // (e.g. a screenshot listing several dates).
      function rowDate() {
        const box = h('div', { class: 'f-date' });
        const show = (open) => box.replaceChildren(open
          ? h('label', null, h('span', null, 'Date of this result'), h('div', { class: 'date-own' },
            h('input', { type: 'date', value: row.date || report.date, oninput: (e) => { row.date = e.target.value === report.date ? '' : e.target.value; touch(); refresh(); } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Use the report date', title: 'Use the report date', onclick: () => { row.date = ''; touch(); refresh(); show(false); } }, '×')))
          : h('div', null, h('span', { class: 'f-label' }, 'Date'), h('button', { class: 'btn small link-btn', type: 'button', onclick: () => show(true) },
            report.date ? `${fmtDate(report.date)} (report date) · change` : 'Report date · change')));
        show(!!row.date && row.date !== report.date);
        return box;
      }
      const unknown = !row.metric || row.metric.startsWith('custom:');
      const card = h('div', { class: 'row-edit' + (unknown ? ' unknown' : '') },
        h('div', { class: 'row-edit-head' }, sel,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove row', onclick: () => { rows.splice(rows.indexOf(row), 1); touch(); renderRows(); } }, '×')),
        h('div', { class: 'row-edit-grid' },
          field('valueRaw', 'Value', { inputmode: 'decimal' }),
          field('unit', 'Unit'),
          field('refRaw', 'Reference', { placeholder: 'e.g. 3.5–5.0' })),
        h('div', { class: 'row-edit-grid two' },
          field('name', 'Printed name'),
          rowDate()),
        preview);
      refresh();
      return card;
    }));
  }
  renderRows();

  // --- save
  const save = async () => {
    if (!report.date) { toast('Set the sample date'); dateIn.focus(); return; }
    const obs = [];
    for (const row of rows) {
      if (!row.valueRaw.trim()) continue;
      const metric = row.metric || (row.name.trim() ? customKey(row.name) : '');
      if (!metric) continue;
      obs.push({ id: row.id ?? uid(), reportId: report.id, date: row.date || report.date, metric,
        name: row.name.trim() || getMetric(metric)?.name || '', ...(row.nameEn && metric.startsWith('custom:') ? { nameEn: row.nameEn } : {}),
        valueRaw: row.valueRaw.trim(), unit: row.unit.trim(), refRaw: row.refRaw.trim(), flag: row.flag ?? '' });
    }
    if (!obs.length && !report.files.length && !confirm('This report has no results and no photos. Save anyway?')) return;
    report.updated = new Date().toISOString();
    try {
      await saveReport(report, obs, { newFiles, removedFileIds });
    } catch (err) {
      toast('Saving failed: ' + (err?.message ?? err));
      return;
    }
    dirty = false;
    toast(`Saved ${obs.length} results`);
    go(`#/report/${encodeURIComponent(report.id)}`);
  };
  root.append(h('div', { class: 'save-bar' },
    h('a', { class: 'btn', href: existing ? `#/report/${encodeURIComponent(id)}` : '#/' }, 'Cancel'),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')));
}
