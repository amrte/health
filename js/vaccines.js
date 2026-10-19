// Vaccinations: what was given when, which diseases it covers, and when the next dose is due.

import { h, go, toast, uid } from './dom.js';
import { normName } from './metrics.js';
import { isoDate } from './parse.js';
import { state, saveVaccines, deleteVaccine, matches } from './store.js';
import { fmtDate, todayIso, dateMs } from './format.js';
import { pageHead, thumb, openFile } from './ui.js';
import { shrinkImage, copyText } from './editor.js';

// Diseases, with words that identify them in vaccine names and certificates.
export const TARGETS = [
  ['tetanus', 'Tetanus', ['tetanus', 'tetanu', 'jaykkakouristus', 'правець', 'правц', 'столбняк', 'td', 'tdap', 'dtap', 'dtp', 'адп', 'акдп', 'акдс']],
  ['diphtheria', 'Diphtheria', ['diphth', 'diphterie', 'kurkkumata', 'дифтер', 'td', 'tdap', 'dtap', 'dtp', 'адп', 'акдп', 'акдс']],
  ['pertussis', 'Whooping cough (pertussis)', ['pertussis', 'keuchhusten', 'hinkuyska', 'кашлюк', 'коклюш', 'tdap', 'dtap', 'boostrix', 'repevax', 'adacel', 'covaxis', 'акдп', 'акдс']],
  ['polio', 'Polio', ['polio', 'ipv', 'opv', 'іпв', 'опв', 'ипв', 'revaxis', 'repevax', 'поліоміє', 'полиомие']],
  ['measles', 'Measles', ['measles', 'masern', 'tuhkarokko', 'кір', 'корь', 'mmr', 'mpr', 'kpk', 'кпк', 'priorix', 'm m r', 'proquad']],
  ['mumps', 'Mumps', ['mumps', 'sikotauti', 'паротит', 'mmr', 'mpr', 'кпк', 'priorix', 'm m r', 'proquad']],
  ['rubella', 'Rubella', ['rubella', 'roteln', 'vihurirokko', 'краснуха', 'краснух', 'mmr', 'mpr', 'кпк', 'priorix', 'm m r', 'proquad']],
  ['varicella', 'Chickenpox (varicella)', ['varicella', 'windpocken', 'vesirokko', 'вітрян', 'ветрян', 'varivax', 'varilrix', 'proquad', 'priorix tetra']],
  ['zoster', 'Shingles (zoster)', ['zoster', 'shingles', 'gurtelrose', 'vyoruusu', 'оперізуваль', 'опоясыва', 'shingrix', 'zostavax']],
  ['hepa', 'Hepatitis A', ['hepatitis a', 'hep a', 'havrix', 'vaqta', 'avaxim', 'twinrix', 'гепатит а', 'гепатит a', 'a hepatiitti']],
  ['hepb', 'Hepatitis B', ['hepatitis b', 'hep b', 'hepb', 'hbv', 'engerix', 'hbvaxpro', 'heplisav', 'twinrix', 'гепатит в', 'гепатит b', 'b hepatiitti']],
  ['hpv', 'HPV', ['hpv', 'papilloma', 'gardasil', 'cervarix', 'впл', 'папілом', 'папиллом']],
  ['influenza', 'Influenza', ['influenza', 'flu', 'grippe', 'influenssa', 'грип', 'vaxigrip', 'influvac', 'fluarix', 'flucelvax', 'efluelda', 'fluenz']],
  ['covid', 'COVID-19', ['covid', 'sars cov', 'corona', 'korona', 'comirnaty', 'spikevax', 'nuvaxovid', 'vaxzevria', 'biontech', 'moderna', 'коронав', 'ковід', 'ковид']],
  ['pneumo', 'Pneumococcal', ['pneumo', 'pneumokok', 'pneumokokki', 'пневмокок', 'prevenar', 'pneumovax', 'vaxneuvance', 'capvaxive', 'synflorix']],
  ['menacwy', 'Meningococcal ACWY', ['acwy', 'menveo', 'nimenrix', 'menquadfi', 'meningokokken acwy']],
  ['menb', 'Meningococcal B', ['menb', 'men b', 'bexsero', 'trumenba', 'meningokokken b']],
  ['tbe', 'Tick-borne encephalitis (TBE)', ['tbe', 'fsme', 'encepur', 'ticovac', 'puutiais', 'кліщов', 'клещев', 'tick borne']],
  ['rabies', 'Rabies', ['rabies', 'tollwut', 'rabipur', 'verorab', 'vesikauhu', 'сказ']],
  ['typhoid', 'Typhoid', ['typhoid', 'typhus', 'typhim', 'vivotif', 'lavantauti', 'черевний тиф', 'брюшной тиф']],
  ['cholera', 'Cholera', ['cholera', 'dukoral', 'kolera', 'холера']],
  ['yellowfever', 'Yellow fever', ['yellow fever', 'gelbfieber', 'stamaril', 'keltakuume', 'жовта гарячка', 'желтая лихорадка']],
  ['je', 'Japanese encephalitis', ['japanese encephalitis', 'japanische enzephalitis', 'ixiaro', 'японський енцефаліт', 'японский энцефалит']],
  ['hib', 'Hib', ['hib', 'haemophilus']],
  ['bcg', 'Tuberculosis (BCG)', ['bcg', 'бцж', 'tuberkul', 'туберкульоз', 'туберкулез']],
  ['rsv', 'RSV', ['rsv', 'arexvy', 'abrysvo', 'mresvia', 'beyfortus']],
  ['mpox', 'Mpox', ['mpox', 'monkeypox', 'affenpocken', 'jynneos', 'imvanex', 'imvamune']],
  ['other', 'Other', []],
];
const TARGET_NAME = Object.fromEntries(TARGETS.map(([k, n]) => [k, n]));

// Guesses the diseases from a vaccine name, e.g. "Boostrix Polio" → tetanus, diphtheria, pertussis, polio.
export function guessTargets(name) {
  const padded = ` ${normName(name)} `;
  const found = [];
  for (const [key, , words] of TARGETS) {
    if (words.some((w) => padded.includes(` ${normName(w)}`))) found.push(key);
  }
  if (found.includes('pertussis')) for (const k of ['tetanus', 'diphtheria']) if (!found.includes(k)) found.push(k);
  return found;
}

export function buildVaccinePrompt() {
  return `Read the attached vaccination record(s): a certificate, a vaccination booklet (for example a German Impfpass) or a screenshot from a health portal. They may be in English, German, Finnish, Ukrainian or Russian, and may be handwritten.
Reply with only one JSON code block in this format:

{"vaccinations": [
  {"date": "YYYY-MM-DD", "vaccine": "vaccine or product name as written", "targets": ["keys from the list below"], "dose": "dose number or booster, if shown", "lot": "batch / lot number, if shown", "place": "doctor, clinic or country, if shown", "due": "YYYY-MM-DD, only if a next dose date is written", "uncertain": false}
]}

Rules:
- One entry per vaccination given. A combined vaccine (e.g. Boostrix Polio) is one entry with several targets.
- If a date, name or number is hard to read, give your best reading and set "uncertain": true.
- Leave out personal data such as the passport number or address.
- "targets" keys: ${TARGETS.map(([k, n]) => `${k} = ${n}`).join('; ')}`;
}

export function parseVaccineReply(text) {
  const s = String(text ?? '');
  const block = s.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? s;
  const start = block.search(/[[{]/);
  const end = Math.max(block.lastIndexOf('}'), block.lastIndexOf(']'));
  if (start < 0 || end <= start) throw new Error('No JSON found. Copy Claude’s whole reply, including the code block.');
  const data = JSON.parse(block.slice(start, end + 1));
  const list = Array.isArray(data) ? data : data.vaccinations ?? [];
  const valid = new Set(TARGETS.map(([k]) => k));
  return list.filter((v) => v && typeof v === 'object').map((v) => {
    const name = String(v.vaccine ?? v.name ?? '').trim();
    let targets = (Array.isArray(v.targets) ? v.targets : []).filter((t) => valid.has(t));
    if (!targets.length) targets = guessTargets(name);
    return { name, date: isoDate(v.date), targets, dose: String(v.dose ?? '').trim(), lot: String(v.lot ?? '').trim(),
      place: String(v.place ?? '').trim(), due: isoDate(v.due), uncertain: !!v.uncertain, note: '' };
  });
}

// For each disease: latest vaccination and when the next dose is due.
export function protection() {
  const by = new Map();
  for (const v of state.vaccines) {
    for (const t of v.targets?.length ? v.targets : ['other']) {
      const cur = by.get(t);
      if (!cur || v.date > cur.date) by.set(t, v);
    }
  }
  const today = todayIso();
  const soon = dateMs(today) + 90 * 864e5;
  return [...by].map(([target, v]) => {
    const due = v.due || '';
    const status = !due ? 'none' : due < today ? 'overdue' : dateMs(due) <= soon ? 'soon' : 'ok';
    return { target, name: TARGET_NAME[target] ?? target, last: v, due, status };
  }).sort((a, b) => ({ overdue: 0, soon: 1, ok: 2, none: 3 })[a.status] - ({ overdue: 0, soon: 1, ok: 2, none: 3 })[b.status] || a.name.localeCompare(b.name));
}

// Diseases whose latest dose came from the same vaccination are shown together.
export function protectionGroups() {
  const groups = new Map();
  for (const p of protection()) {
    if (!groups.has(p.last.id)) groups.set(p.last.id, { ...p, names: [] });
    groups.get(p.last.id).names.push(p.name);
  }
  return [...groups.values()];
}

function dueChip(p) {
  if (p.status === 'overdue') return h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ' Overdue since ', fmtDate(p.due));
  if (p.status === 'soon') return h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ' Due ', fmtDate(p.due));
  if (p.status === 'ok') return h('span', { class: 'status st-normal' }, h('span', { class: 'status-icon' }, '✓'), ' Next ', fmtDate(p.due));
  return h('span', { class: 'status st-none' }, 'No next date');
}

export function protectionRow(p) {
  return h('a', { class: 'row', href: `#/vaccine/${encodeURIComponent(p.last.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title wrap' }, p.names.join(', ')),
      h('div', { class: 'row-meta' }, 'Last ', fmtDate(p.last.date), ' · ', p.last.name || 'vaccination'),
      dueChip(p)));
}

function vaccineRow(v) {
  return h('a', { class: 'row', href: `#/vaccine/${encodeURIComponent(v.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, v.name || 'Vaccination'),
      h('div', { class: 'row-meta' }, (v.targets ?? []).map((t) => TARGET_NAME[t] ?? t).join(', ') || 'No disease set')),
    h('div', { class: 'row-value' },
      h('div', { class: 'small' }, fmtDate(v.date)),
      v.dose ? h('div', { class: 'muted small' }, v.dose) : null));
}

export function vaccineSearchText(v) {
  return [v.name, v.place, v.lot, v.note, v.dose, ...(v.targets ?? []).map((t) => TARGET_NAME[t] ?? t)];
}

let query = '';
export function viewVaccines(root) {
  root.append(pageHead('Vaccinations', { actions: h('a', { class: 'btn primary', href: '#/vaccines/add' }, '+ Add') }));
  if (!state.vaccines.length) {
    root.append(h('section', { class: 'card empty' },
      h('h2', null, 'No vaccinations yet'),
      h('p', null, 'Photograph your vaccination booklet or certificate and let Claude read every entry at once, or add them one by one. Set a next-due date and the app reminds you on the overview.'),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: '#/vaccines/add' }, 'Add vaccinations'))));
    return;
  }
  root.append(h('section', { class: 'group' }, h('h2', null, 'By disease'), h('div', { class: 'card list' }, protectionGroups().map(protectionRow))));
  const list = h('div', { class: 'card list' });
  root.append(h('section', { class: 'group' }, h('h2', null, 'History'),
    h('input', { type: 'search', class: 'search', placeholder: 'Search vaccines, diseases, places', value: query, 'aria-label': 'Search vaccinations',
      oninput: (e) => { query = e.target.value; render(); } }), h('div', { style: 'height:10px' }), list));
  function render() {
    const vs = state.vaccines.filter((v) => matches(query, vaccineSearchText(v))).sort((a, b) => b.date.localeCompare(a.date));
    list.replaceChildren(...(vs.length ? vs.map(vaccineRow) : [h('p', { class: 'muted pad' }, 'No matching vaccinations.')]));
  }
  render();
}

export async function viewVaccine(root, id) {
  const v = state.vaccines.find((x) => x.id === id);
  if (!v) {
    root.append(pageHead('Not found', { back: '#/vaccines' }));
    return;
  }
  const del = async () => {
    if (!confirm(`Delete the ${v.name || 'vaccination'} from ${fmtDate(v.date)}?`)) return;
    await deleteVaccine(id);
    toast('Vaccination deleted');
    go('#/vaccines');
  };
  root.append(pageHead(v.name || 'Vaccination', {
    back: '#/vaccines',
    sub: fmtDate(v.date),
    actions: [h('a', { class: 'btn', href: `#/vaccines/edit/${encodeURIComponent(id)}` }, 'Edit'), h('button', { class: 'btn danger', onclick: del }, 'Delete')],
  }));
  const item = (label, value) => (value ? h('div', { class: 'kv' }, h('span', null, label), h('div', null, value)) : null);
  root.append(h('section', { class: 'card' },
    item('Protects against', (v.targets ?? []).map((t) => TARGET_NAME[t] ?? t).join(', ')),
    item('Dose', v.dose),
    item('Batch / lot', v.lot),
    item('Given at', v.place),
    item('Next dose due', v.due ? fmtDate(v.due) : ''),
    item('Note', v.note)));
  if (v.files?.length) {
    const grid = h('div', { class: 'thumbs' });
    root.append(h('section', { class: 'group' }, h('h2', null, 'Photos'), grid));
    for (const f of v.files) grid.append(await thumb(f.id, () => openFile(f.id)));
  }
}

// ---- editor: one vaccination when editing, any number when adding ----------

let dirty = false;
export function vaccineEditorDirty() {
  return dirty;
}
export function clearVaccineDirty() {
  dirty = false;
}

function addYears(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + n}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export async function viewVaccineEditor(root, id) {
  const existing = id ? state.vaccines.find((x) => x.id === id) : null;
  if (id && !existing) {
    root.append(pageHead('Not found', { back: '#/vaccines' }));
    return;
  }
  dirty = false;
  const touch = () => { dirty = true; };
  const blank = () => ({ id: uid(), date: todayIso(), name: '', targets: [], dose: '', lot: '', place: '', due: '', note: '', files: [] });
  const items = existing ? [structuredClone(existing)] : [blank()];
  const files = existing ? [...(existing.files ?? [])] : [];
  const newFiles = [];
  const removedFileIds = [];

  root.append(pageHead(existing ? 'Edit vaccination' : 'Add vaccinations', { back: existing ? `#/vaccine/${encodeURIComponent(id)}` : '#/vaccines' }));

  // photos (shared by all entries saved together)
  const thumbs = h('div', { class: 'thumbs' });
  const fileIn = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, class: 'offscreen', id: 'vfile-in',
    onchange: async (e) => {
      for (const f of e.target.files) {
        const blob = await shrinkImage(f);
        const rec = { id: uid(), blob, type: blob.type || f.type, name: f.name };
        newFiles.push(rec);
        files.push({ id: rec.id, type: rec.type, name: rec.name });
      }
      e.target.value = '';
      touch();
      renderThumbs();
    } });
  async function renderThumbs() {
    const out = [];
    for (const f of files) {
      const pending = newFiles.find((n) => n.id === f.id);
      let t;
      if (pending) {
        t = h('button', { class: 'thumb', type: 'button' });
        if (pending.type.startsWith('image/')) t.append(h('img', { src: URL.createObjectURL(pending.blob), alt: '' }));
        else t.append(h('span', { class: 'thumb-doc' }, 'PDF'));
      } else t = await thumb(f.id, () => openFile(f.id));
      out.push(h('div', { class: 'thumb-box' }, t, h('button', { class: 'thumb-del', type: 'button', 'aria-label': 'Remove photo', onclick: () => {
        files.splice(files.indexOf(f), 1);
        const i = newFiles.findIndex((n) => n.id === f.id);
        if (i >= 0) newFiles.splice(i, 1); else removedFileIds.push(f.id);
        touch();
        renderThumbs();
      } }, '×')));
    }
    out.push(h('label', { class: 'thumb add', for: 'vfile-in' }, h('span', null, '+'), h('small', null, 'Photo')));
    thumbs.replaceChildren(...out);
  }
  root.append(h('section', { class: 'group' }, h('h2', null, 'Certificate or booklet photos'), thumbs, fileIn));
  renderThumbs();

  if (!existing) {
    const replyIn = h('textarea', { rows: 4, placeholder: 'Paste Claude’s reply here', class: 'mono' });
    const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const ok = await copyText(buildVaccinePrompt());
      toast(ok ? 'Instructions copied' : 'Copy failed — try again');
      if (ok) copyBtn.textContent = '✓ Copied — copy again';
    } }, 'Copy instructions');
    root.append(h('section', { class: 'card claude' },
      h('h2', null, 'Read a booklet or certificate with Claude'),
      h('ol', { class: 'steps' },
        h('li', null, copyBtn),
        h('li', null, 'In the Claude app, attach the photo(s), paste the instructions and send. ',
          h('a', { href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, 'Open Claude')),
        h('li', null, 'Copy Claude’s whole reply and paste it here:', replyIn,
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            try {
              const found = parseVaccineReply(replyIn.value);
              const empty = items.length === 1 && !items[0].name && !items[0].targets.length;
              if (empty) items.length = 0;
              for (const f of found) items.push({ ...blank(), ...f, date: f.date || todayIso() });
              replyIn.value = '';
              touch();
              renderItems();
              toast(`${found.length} vaccinations added — check them below`);
            } catch (err) {
              toast(err instanceof SyntaxError ? 'The reply isn’t complete JSON. Copy the whole code block.' : err.message);
            }
          } }, 'Read vaccinations')))));
  }

  const box = h('div', { class: 'rows' });
  root.append(h('section', { class: 'group' },
    h('div', { class: 'group-head' }, h('h2', null, existing ? 'Details' : 'Vaccinations'),
      existing ? null : h('button', { class: 'btn', type: 'button', onclick: () => { items.push(blank()); touch(); renderItems(); } }, '+ Add another')),
    box));

  function renderItems() {
    box.replaceChildren(...items.map((it) => {
      const targetBox = h('div', { class: 'chips' });
      const renderTargets = () => targetBox.replaceChildren(...TARGETS.filter(([k]) => it.targets.includes(k)).map(([k, n]) =>
        h('button', { type: 'button', class: 'chip on', 'aria-label': `Remove ${n}`, onclick: () => { it.targets = it.targets.filter((x) => x !== k); touch(); renderTargets(); } }, n, ' ×')),
        h('select', { class: 'chip-add', 'aria-label': 'Add disease', onchange: (e) => {
          if (e.target.value) { it.targets.push(e.target.value); touch(); renderTargets(); }
        } }, h('option', { value: '' }, '+ disease'), TARGETS.filter(([k]) => !it.targets.includes(k)).map(([k, n]) => h('option', { value: k }, n))));
      renderTargets();
      const input = (key, label, attrs = {}) => h('label', null, h('span', null, label), h('input', { type: 'text', value: it[key], ...attrs,
        oninput: (e) => {
          const before = guessTargets(it[key]);
          it[key] = e.target.value;
          if (key === 'name' && it.targets.every((t) => before.includes(t))) { it.targets = guessTargets(it.name); renderTargets(); }
          touch();
        } }));
      const dueIn = h('input', { type: 'date', value: it.due, oninput: (e) => { it.due = e.target.value; touch(); } });
      const quick = [1, 3, 5, 10].map((n) => h('button', { type: 'button', class: 'chip', onclick: () => { it.due = addYears(it.date || todayIso(), n); dueIn.value = it.due; touch(); } }, `+${n} y`));
      return h('div', { class: 'row-edit' + (it.uncertain ? ' unknown' : '') },
        it.uncertain ? h('div', { class: 'preview warn' }, 'Claude wasn’t sure about part of this entry — compare it with the photo.') : null,
        h('div', { class: 'row-edit-head' },
          h('label', { class: 'grow' }, h('span', null, 'Date given'), h('input', { type: 'date', value: it.date, oninput: (e) => { it.date = e.target.value; touch(); } })),
          existing ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove', onclick: () => { items.splice(items.indexOf(it), 1); touch(); renderItems(); } }, '×')),
        input('name', 'Vaccine', { placeholder: 'e.g. Boostrix Polio, FSME-Immun, Comirnaty' }),
        h('div', null, h('span', { class: 'label' }, 'Protects against'), targetBox),
        h('div', { class: 'row-edit-grid two' }, input('dose', 'Dose', { placeholder: '1/3, booster…' }), input('lot', 'Batch / lot')),
        input('place', 'Given at', { placeholder: 'Doctor, clinic, country' }),
        h('label', null, h('span', null, 'Next dose due'), dueIn), h('div', { class: 'chips' }, quick),
        input('note', 'Note'));
    }));
    if (!items.length) box.append(h('p', { class: 'muted pad' }, 'Nothing to save yet.'));
  }
  renderItems();

  const save = async () => {
    const keep = items.filter((it) => it.date && (it.name.trim() || it.targets.length));
    if (!keep.length) { toast('Add a date and a vaccine name or disease'); return; }
    for (const it of keep) {
      it.files = files;
      it.name = it.name.trim();
      delete it.uncertain;
      it.updated = new Date().toISOString();
      it.created ??= it.updated;
    }
    try {
      await saveVaccines(keep, { newFiles, removedFileIds });
    } catch (err) {
      toast('Saving failed: ' + (err?.message ?? err));
      return;
    }
    dirty = false;
    toast(keep.length === 1 ? 'Vaccination saved' : `${keep.length} vaccinations saved`);
    go(keep.length === 1 ? `#/vaccine/${encodeURIComponent(keep[0].id)}` : '#/vaccines');
  };
  root.append(h('div', { class: 'save-bar' },
    h('a', { class: 'btn', href: existing ? `#/vaccine/${encodeURIComponent(id)}` : '#/vaccines' }, 'Cancel'),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')));
}
