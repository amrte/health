// Dental records: FDI tooth numbering, treatment types, per-tooth state and
// invoice/treatment-record extraction with Claude. Pure functions.

// FDI two-digit notation: quadrant (1 upper right, 2 upper left, 3 lower left,
// 4 lower right) + tooth 1–8 from the midline. Shown as seen when facing the patient.
export const UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
export const LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
export const ALL_TEETH = [...UPPER, ...LOWER];

const KIND = ['', 'central incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'third molar (wisdom tooth)'];
const SIDE = { 1: 'upper right', 2: 'upper left', 3: 'lower left', 4: 'lower right' };
export function toothName(t) {
  return `${SIDE[t[0]] ?? ''} ${KIND[Number(t[1])] ?? ''}`.trim();
}
export const isAnterior = (t) => Number(t[1]) <= 3;

// Treatments; `effect` is how the tooth's state changes.
export const PROCEDURES = [
  ['checkup', 'Check-up', null],
  ['cleaning', 'Cleaning / hygiene', null],
  ['xray', 'X-ray', null],
  ['filling', 'Filling', 'filled'],
  ['temp_filling', 'Temporary filling', 'filled'],
  ['inlay', 'Inlay / onlay', 'filled'],
  ['root_canal', 'Root canal treatment', 'rootcanal'],
  ['crown', 'Crown', 'crown'],
  ['bridge', 'Bridge', 'bridge'],
  ['veneer', 'Veneer', 'veneer'],
  ['implant', 'Implant', 'implant'],
  ['extraction', 'Extraction', 'missing'],
  ['sealant', 'Fissure sealant', 'sealed'],
  ['missing', 'Missing (status only)', 'missing'],
  ['watch', 'To watch (status only)', 'watch'],
  ['other', 'Other treatment', null],
];
export const PROCEDURE_NAME = Object.fromEntries(PROCEDURES.map(([k, n]) => [k, n]));
const EFFECT = Object.fromEntries(PROCEDURES.map(([k, , e]) => [k, e]));

// Surfaces: Mesial, Distal, Occlusal (back teeth) / Incisal (front teeth),
// Buccal / labial (outer), Lingual / palatal (inner).
export const SURFACES = ['M', 'D', 'O', 'B', 'L'];
export function surfaceLabel(s, tooth) {
  return s === 'O' && tooth && isAnterior(tooth) ? 'I' : s;
}
export function normSurfaces(s) {
  const map = { I: 'O', V: 'B', F: 'B', P: 'L' };
  return [...new Set(String(s ?? '').toUpperCase().replace(/[^MDOBLIVFP]/g, '').split('').map((c) => map[c] ?? c))].join('');
}

// State of every tooth from all visits, applied in date order.
export function teethState(visits) {
  const st = Object.fromEntries(ALL_TEETH.map((t) => [t, { tooth: t, present: true, surfaces: '', rootcanal: false, crown: false, implant: false, bridge: false, veneer: false, sealed: false, watch: false, history: [] }]));
  const items = visits.flatMap((v) => (v.items ?? []).map((it) => ({ ...it, date: v.date, visitId: v.id, clinic: v.clinic })))
    .filter((it) => st[it.tooth]).sort((a, b) => a.date.localeCompare(b.date));
  for (const it of items) {
    const s = st[it.tooth];
    s.history.push(it);
    const e = EFFECT[it.procedure];
    if (e && e !== 'watch') s.watch = false;
    switch (e) {
      case 'missing': Object.assign(s, { present: false, surfaces: '', rootcanal: false, crown: false, implant: false, veneer: false, sealed: false }); break;
      case 'implant': Object.assign(s, { present: true, implant: true, surfaces: '', rootcanal: false }); break;
      case 'filled': s.present = true; s.surfaces = normSurfaces(s.surfaces + (it.surfaces ?? '')); break;
      case 'rootcanal': s.rootcanal = true; break;
      case 'crown': s.crown = true; break;
      case 'bridge': s.bridge = true; break;
      case 'veneer': s.veneer = true; break;
      case 'sealed': s.sealed = true; break;
      case 'watch': s.watch = true; break;
      default:
    }
  }
  return st;
}

// Short labels shown on the chart, so state never relies on colour alone.
export function toothBadges(s) {
  if (!s.present) return ['×'];
  const b = [];
  if (s.implant) b.push('I');
  if (s.crown) b.push('C');
  if (s.bridge) b.push('B');
  if (s.rootcanal) b.push('RC');
  if (s.surfaces && !s.crown) b.push('F');
  if (s.veneer) b.push('V');
  if (s.sealed && !s.surfaces) b.push('S');
  if (s.watch) b.push('!');
  return b;
}

// Totals per year and currency.
export function costsByYear(visits) {
  const by = new Map();
  for (const v of visits) {
    const total = Number(v.total) || (v.items ?? []).reduce((a, it) => a + (Number(it.price) || 0), 0);
    if (!total) continue;
    const key = `${v.date.slice(0, 4)} ${v.currency || '€'}`;
    by.set(key, (by.get(key) ?? 0) + total);
  }
  return [...by].map(([k, total]) => ({ year: k.slice(0, 4), currency: k.slice(5), total })).sort((a, b) => b.year.localeCompare(a.year));
}

// ---- Claude extraction ------------------------------------------------------------

export function buildDentalPrompt() {
  return `Read the attached dental document(s): an invoice/bill, a treatment record, a treatment plan or a dental chart. They may be in English, German, Finnish, Ukrainian or Russian.
Reply with only one JSON code block in this format:

{"visits": [{"date": "YYYY-MM-DD", "clinic": "clinic name", "dentist": "dentist name", "currency": "EUR, UAH, …", "total": 123.45,
  "items": [{"tooth": "FDI number like 16, or empty", "procedure": "key from the list below", "surfaces": "e.g. MOD", "material": "e.g. composite", "code": "billing code if shown", "price": 45.0, "text": "line as printed"}],
  "next_checkup": "YYYY-MM-DD if a next appointment or recall date is written"}]}

Rules:
- Use FDI two-digit tooth numbers (11–48). Convert other notations (e.g. Universal 1–32, Palmer) to FDI; if unsure, leave "tooth" empty and keep the original in "text".
- Surfaces: M mesial, D distal, O occlusal or I incisal, B buccal/labial/vestibular, L lingual/palatal.
- One item per treatment line; a treatment on several teeth becomes one item per tooth (split the price evenly if needed).
- Prices as numbers with a dot as decimal separator. Leave out personal data such as address or insurance number.
- "procedure" keys: ${PROCEDURES.map(([k, n]) => `${k} = ${n}`).join('; ')}`;
}

export function parseDentalReply(text) {
  const block = String(text ?? '').match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? String(text ?? '');
  const a = block.search(/[[{]/);
  const b = Math.max(block.lastIndexOf('}'), block.lastIndexOf(']'));
  if (a < 0 || b <= a) throw new Error('No JSON found. Copy Claude’s whole reply, including the code block.');
  const data = JSON.parse(block.slice(a, b + 1));
  const list = Array.isArray(data) ? data : data.visits ?? [data];
  const iso = (s) => (/^\d{4}-\d\d-\d\d/.test(String(s ?? '')) ? String(s).slice(0, 10) : '');
  return list.filter((v) => v && typeof v === 'object').map((v) => ({
    date: iso(v.date),
    clinic: String(v.clinic ?? '').trim(),
    dentist: String(v.dentist ?? '').trim(),
    currency: String(v.currency ?? '').trim().toUpperCase().replace('€', 'EUR'),
    total: Number(v.total) || null,
    nextCheckup: iso(v.next_checkup),
    items: (v.items ?? []).map((it) => ({
      tooth: ALL_TEETH.includes(String(it.tooth ?? '').trim()) ? String(it.tooth).trim() : '',
      procedure: PROCEDURE_NAME[it.procedure] ? it.procedure : 'other',
      surfaces: normSurfaces(it.surfaces),
      material: String(it.material ?? '').trim(),
      code: String(it.code ?? '').trim(),
      price: Number(it.price) || null,
      note: String(it.text ?? '').trim(),
    })),
  }));
}
