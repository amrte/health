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

export const REPORT_TYPES = [
  ['lab', 'Lab results'],
  ['ecg', 'ECG'],
  ['holter', 'Long-term ECG (Holter)'],
  ['echo', 'Echocardiogram'],
  ['body', 'Body composition / measurements'],
  ['letter', 'Doctor’s letter or statement'],
  ['other', 'Other medical document'],
];
export const REPORT_TYPE_NAME = Object.fromEntries(REPORT_TYPES);
// Types that get a summary, diagnoses and follow-up besides the values.
export const isDocType = (type) => type !== 'lab' && type !== 'body';

const WHAT = {
  lab: 'medical lab report(s)',
  ecg: 'ECG report(s) or ECG printout(s)',
  holter: 'long-term ECG (Holter) report(s)',
  echo: 'echocardiography report(s)',
  body: 'body composition report(s) (e.g. InBody, Tanita) or body measurements',
  letter: 'doctor’s letter(s), statement(s) or discharge summary',
  other: 'medical document(s)',
};

// Instructions for Claude. Every type extracts measured values; letters and heart
// reports also get a plain-language summary, diagnoses, advice and follow-up.
export function buildPrompt(type = 'lab') {
  const only = { lab: (c) => c !== 'cardio' && c !== 'body', body: (c) => c === 'body', letter: () => true, other: () => true }[type] ?? ((c) => c === 'cardio');
  const cats = CATEGORIES.filter(([c]) => only(c));
  const list = cats.map(([cat, title]) => {
    const keys = METRICS.filter((m) => m.cat === cat && !m.derived).map((m) => `${m.key} = ${m.name}`);
    return keys.length ? `${title}: ${keys.join('; ')}` : '';
  }).filter(Boolean).join('\n');
  const doc = isDocType(type);
  return `Read the attached ${WHAT[type] ?? WHAT.other}. They may be in English, German, Finnish, Ukrainian or Russian.
${doc ? 'Summarise the document and extract every measured value' : 'Extract every test result'} and reply with only one JSON code block in this format:

{"date": "YYYY-MM-DD", "lab": "${doc ? 'clinic or hospital' : type === 'body' ? 'place or device, e.g. gym name or InBody' : 'lab or clinic name'}",${doc ? ` "doctor": "doctor's name", "specialty": "e.g. cardiology", "summary": "3–6 plain-language sentences in English: why it was done, what was found, what was concluded", "conclusion": "the document's own conclusion or rhythm description, translated to English", "diagnoses": ["…"], "recommendations": ["…"], "medications": ["name dose schedule"], "follow_up": "YYYY-MM-DD if a follow-up or control date is given, else empty",` : ''} "results": [
  {"name": "name exactly as printed", "metric": "key from the list below or null", "value": "result as printed", "unit": "unit as printed", "ref": "reference range as printed", "flag": "H, L or empty", "date": "YYYY-MM-DD, only if this row has its own date"}
]}

Rules:
- Copy values, units and reference ranges exactly as printed. Do not convert units. Decimal commas are fine.
- One entry per result. If a value is shown for several dates, add one entry per date with that row's "date".${type === 'lab' ? '\n- White cell types come as percent and as absolute count: use the _pct key for % and the _abs key for counts.\n- Use the sample date (when the blood was taken) for "date", not the print date.' : ''}${type === 'body' ? `
- Many body composition reports print the previous measurement next to the current one. Use the line "change since the previous measurement" (e.g. "Muutos edelliseen mittaukseen", "Veränderung") to tell which value is current. Give current values with the report date; give a previous value as its own entry only if its date is printed, otherwise leave it out.
- "ref": the device's normal range for that value, e.g. "62–83.8". The two numbers under a bar are usually its range.
- For segmental values (arms, trunk, legs) give the mass in kg; leave out the percentages of the reference shown under them. Leave out calorie tables for activities, and goals such as "fat mass target".` : ''}${type === 'holter' ? '\n- For extra beats give both the count (pvc_count, pac_count) and the share of all beats in % (pvc_pct, pac_pct) when shown. If atrial fibrillation is reported, give af_burden in %; if the report says there was none, give 0.' : ''}${doc ? '\n- Don’t interpret beyond the document; keep diagnoses and advice as the doctor wrote them.' : ''}
- Leave out personal data (name, address, insurance number). Don't add anything that is not in the document.
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

const strList = (x) => (Array.isArray(x) ? x : x ? [x] : []).map((s) => String(s).trim()).filter(Boolean);

// Parses Claude's reply (one or more JSON blocks) into { date, lab, rows, doc }.
// `doc` holds the letter/report fields (summary, diagnoses, …) when present.
export function parseExtraction(text) {
  const docs = extractJson(text).flatMap((d) => (Array.isArray(d) && d.some((x) => x?.results) ? d : [d]));
  let date = '';
  let lab = '';
  const rows = [];
  const doc = { doctor: '', specialty: '', summary: '', conclusion: '', diagnoses: [], recommendations: [], medications: [], followUp: '' };
  for (const d of docs) {
    if (d && !Array.isArray(d)) {
      doc.doctor ||= String(d.doctor ?? '').trim();
      doc.specialty ||= String(d.specialty ?? '').trim();
      doc.summary ||= String(d.summary ?? '').trim();
      doc.conclusion ||= String(d.conclusion ?? '').trim();
      doc.followUp ||= isoDate(d.follow_up ?? d.followUp);
      doc.diagnoses.push(...strList(d.diagnoses));
      doc.recommendations.push(...strList(d.recommendations));
      doc.medications.push(...strList(d.medications));
    }
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
  return { date, lab, rows, doc };
}
