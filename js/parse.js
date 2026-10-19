// Parsing of values, reference ranges and Claude's extraction replies. Pure functions.

import { METRICS, CATEGORIES, getMetric, matchMetric } from './metrics.js';

// "5,3" → 5.3, "1.234,5" → 1234.5, "1,234.5" → 1234.5. Returns null if not a number.
export function parseNumber(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s ?? '').trim().replace(/\s/g, '').replace(/[−–]/g, '-');
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? parseFloat(t) : null;
}

// A printed result: "5,3", "<0.5", "> 90", "12.1 H", "negative".
export function parseValue(raw) {
  if (typeof raw === 'number') return { value: Number.isFinite(raw) ? raw : null, qualifier: '', text: '', flag: '' };
  const s = String(raw ?? '').trim();
  let t = s;
  let qualifier = '';
  let flag = '';
  const q = t.match(/^(<=|>=|≤|≥|<|>)\s*/);
  if (q) {
    qualifier = { '<=': '≤', '>=': '≥' }[q[1]] ?? q[1];
    t = t.slice(q[0].length);
  }
  const f = t.match(/\s*(\(?[HLhl]\)?|[+-]{1,2}|[↑↓*!]+)$/);
  if (f && /\d/.test(t.slice(0, f.index))) {
    const c = f[1].replace(/[()]/g, '');
    flag = /^[Hh+↑]/.test(c) ? 'H' : /^[Ll↓-]/.test(c) ? 'L' : '';
    t = t.slice(0, f.index);
  }
  const value = parseNumber(t);
  return value == null ? { value: null, qualifier: '', text: s, flag: '' } : { value, qualifier, text: '', flag };
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const RANGE = new RegExp(String.raw`^${NUM}\s*(?:-|–|—|\.\.\.?|…|to|bis|до|−)\s*${NUM}$`, 'i');
const UPPER = new RegExp(String.raw`^(?:<=?|≤|bis|до|up\s*to|under|alle|unter|менше|менее)\s*${NUM}$`, 'i');
const LOWER = new RegExp(String.raw`^(?:>=?|≥|über|uber|ab|від|от|yli|over|above|більше|более)\s*${NUM}$`, 'i');

// "3.5–5.0", "< 5", "> 1,0", "bis 200". Returns { low, high } (either may be null).
export function parseRange(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  let m = s.match(RANGE);
  if (m) return { low: parseNumber(m[1]), high: parseNumber(m[2]) };
  m = s.match(UPPER);
  if (m) return { low: null, high: parseNumber(m[1]) };
  m = s.match(LOWER);
  if (m) return { low: parseNumber(m[1]), high: null };
  return { low: null, high: null };
}

export function isoDate(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) {
    // 14.03.2024, 14/03/2024 — labs in these countries print day first
    m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) m = [m[0], m[3], m[2], m[1]];
  }
  if (!m) return '';
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---- Claude extraction ---------------------------------------------------

export function buildPrompt() {
  const list = CATEGORIES.map(([cat, title]) => {
    const keys = METRICS.filter((m) => m.cat === cat).map((m) => `${m.key} = ${m.name}`);
    return keys.length ? `${title}: ${keys.join('; ')}` : '';
  }).filter(Boolean).join('\n');
  return `Read the attached medical lab report(s). They may be in English, German, Finnish, Ukrainian or Russian.
Extract every test result and reply with only one JSON code block in this format:

{"date": "YYYY-MM-DD", "lab": "lab or clinic name", "results": [
  {"name": "test name exactly as printed", "metric": "key from the list below or null", "value": "result as printed", "unit": "unit as printed", "ref": "reference range as printed", "flag": "H, L or empty", "date": "YYYY-MM-DD, only if this row has its own date"}
]}

Rules:
- Copy values, units and reference ranges exactly as printed. Do not convert units. Decimal commas are fine.
- One entry per result. If a test is shown for several dates (history columns or a list of earlier results), add one entry per date with that row's "date".
- White cell types come as percent and as absolute count: use the _pct key for % and the _abs key for counts.
- Use the sample date (when the blood was taken) for "date", not the print date.
- Leave out things that are not test results (patient data, addresses, comments). Don't add results that are not in the image.
- "metric": the best matching key from this list, or null if none fits:
${list}`;
}

function extractJson(text) {
  const s = String(text ?? '');
  const blocks = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const sources = blocks.length ? blocks : [s];
  const out = [];
  for (const src of sources) {
    const start = src.search(/[[{]/);
    if (start < 0) continue;
    const end = Math.max(src.lastIndexOf('}'), src.lastIndexOf(']'));
    if (end <= start) continue;
    out.push(JSON.parse(src.slice(start, end + 1)));
  }
  if (!out.length) throw new Error('No JSON found. Copy Claude’s whole reply, including the code block.');
  return out;
}

// Normalises one extracted (or manually entered) result into an editor row.
export function toRow(r) {
  const name = String(r.name ?? r.test ?? '').trim();
  const unit = String(r.unit ?? '').trim();
  const valueRaw = r.value == null ? '' : String(r.value).trim();
  let refRaw = String(r.ref ?? r.reference ?? r.range ?? '').trim();
  if (!refRaw && (r.refLow != null || r.refHigh != null)) {
    refRaw = r.refLow != null && r.refHigh != null ? `${r.refLow}–${r.refHigh}` : r.refLow != null ? `> ${r.refLow}` : `< ${r.refHigh}`;
  }
  const pv = parseValue(valueRaw);
  let metric = r.metric && getMetric(r.metric) ? r.metric : matchMetric(name, unit, pv.value);
  const flag = /^h/i.test(r.flag ?? '') ? 'H' : /^l/i.test(r.flag ?? '') ? 'L' : pv.flag;
  return { name, metric: metric ?? '', valueRaw, unit, refRaw, flag, date: isoDate(r.date) };
}

// Parses Claude's reply (one or more JSON blocks) into { date, lab, rows }.
export function parseExtraction(text) {
  const docs = extractJson(text).flatMap((d) => (Array.isArray(d) && d.some((x) => x?.results) ? d : [d]));
  let date = '';
  let lab = '';
  const rows = [];
  for (const d of docs) {
    const results = Array.isArray(d) ? d : d.results ?? [];
    const docDate = isoDate(d.date);
    date ||= docDate;
    lab ||= String(d.lab ?? '').trim();
    for (const r of results) {
      if (!r || typeof r !== 'object') continue;
      const row = toRow(r);
      if (!row.date && docDate && docDate !== date) row.date = docDate;
      if (row.name || row.metric) rows.push(row);
    }
  }
  return { date, lab, rows };
}
