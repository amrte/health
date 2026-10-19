// Unit normalisation and conversion. Pure functions, used by the app and the tests.
//
// Labs print the same unit in many ways: "x10⁹/l", "E9/l", "/nl", "G/l" and
// "×10⁹/л" all mean 10^9 per litre. normUnit() reduces each spelling to one
// token, so conversion tables only need one entry per real unit.

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// Cyrillic unit words as printed by Ukrainian and Russian labs.
const CYRILLIC = [
  ['мккат', 'ukat'], ['мкмоль', 'umol'], ['ммоль', 'mmol'], ['нмоль', 'nmol'], ['пмоль', 'pmol'],
  ['мкмо', 'uiu'], ['ммо', 'miu'], ['мкг', 'ug'], ['мкл', 'ul'], ['год', 'h'], ['мін', 'min'],
  ['мин', 'min'], ['кат', 'kat'], ['мо', 'iu'], ['мг', 'mg'], ['нг', 'ng'], ['пг', 'pg'],
  ['мл', 'ml'], ['дл', 'dl'], ['фл', 'fl'], ['од', 'u'], ['мм', 'mm'], ['ч', 'h'], ['г', 'g'], ['л', 'l'],
].sort((a, b) => b[0].length - a[0].length);

// Different spellings of the same unit.
const SYN = {
  'ng/ml': 'ug/l', 'mcg/l': 'ug/l',
  'pg/ml': 'ng/l',
  'ug/ml': 'mg/l',
  'iu/l': 'u/l', 'e/l': 'u/l', 'ie/l': 'u/l',
  'uiu/ml': 'mu/l', 'miu/l': 'mu/l', 'mie/l': 'mu/l', 'uu/ml': 'mu/l', 'uie/ml': 'mu/l', 'mui/l': 'mu/l',
  'kiu/l': 'iu/ml', 'ku/l': 'iu/ml', 'u/ml': 'iu/ml',
  'meq/l': 'mmol/l',
  'mmol/molhb': 'mmol/mol',
  'mm/std': 'mm/h', 'mm/hr': 'mm/h', 'mm/1h': 'mm/h', 'mm/1.h': 'mm/h', 'mm/1.std': 'mm/h', 'mm/t': 'mm/h',
  'um3': 'fl',
  'g/100ml': 'g/dl', 'mg/100ml': 'mg/dl',
  'tsd/ul': '10^9/l', 'tsd./ul': '10^9/l', '/nl': '10^9/l', '10^3/ul': '10^9/l', '10^3/mm3': '10^9/l',
  'k/ul': '10^9/l', 'gpt/l': '10^9/l', 'giga/l': '10^9/l',
  'mio/ul': '10^12/l', 'mio./ul': '10^12/l', '/pl': '10^12/l', '10^6/ul': '10^12/l', '10^6/mm3': '10^12/l',
  'm/ul': '10^12/l', 'tpt/l': '10^12/l', 'tera/l': '10^12/l',
  '/mm3': '/ul', 'cells/ul': '/ul', 'zellen/ul': '/ul',
  '‰': 'promille',
};

export function normUnit(unit) {
  let s = String(unit ?? '').trim();
  if (!s) return '';
  // Upper-case G/l and T/l are giga and tera (cell counts); lower-case g/l is grams.
  if (/^G\s*\/\s*l$/i.test(s) && s[0] === 'G') return '10^9/l';
  if (/^T\s*\/\s*l$/i.test(s) && s[0] === 'T') return '10^12/l';
  // Same in Cyrillic: Г/л = 10⁹/L, Т/л = 10¹²/L (lower-case г/л is grams).
  if (/^Г\s*\/\s*л$/.test(s)) return '10^9/l';
  if (/^Т\s*\/\s*л$/i.test(s)) return '10^12/l';
  s = s.toLowerCase().replace(/\s+/g, '').replace(/[µμ]/g, 'u').replace(/,/g, '.');
  s = s.replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, d) => '10^' + [...d].map((c) => SUP.indexOf(c)).join(''));
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUP.indexOf(c)));
  for (const [cy, la] of CYRILLIC) s = s.split(cy).join(la);
  s = s.replace(/^[x×х*]?10(?:\^|\*\*|\*|e)(\d+)/, '10^$1');
  s = s.replace(/^e(\d+)\//, '10^$1/'); // Finnish "E9/l"
  s = s.replace(/^mc(?=[gm])/, 'u'); // mcg, mcmol
  if (s.startsWith('ml/min')) return 'ml/min/1.73m2';
  return SYN[s] ?? s;
}

// Prepares a metric's conversion table: keys normalised, canonical unit normalised.
export function prepareUnits(metric) {
  metric.cu = normUnit(metric.unit);
  metric.altN = {};
  for (const [u, f] of Object.entries(metric.alt ?? {})) metric.altN[normUnit(u)] = f;
  return metric;
}

// Labs print the unit twice: "г/л (x 10^9/L)", "фл (fL)", "мм/год (mm/hr)".
// The whole string first, then each half.
export function unitForms(unit) {
  const s = String(unit ?? '').trim();
  const m = s.match(/^(.+?)\s*\((.+)\)\s*$/);
  return m ? [s, m[1], m[2]] : [s];
}

const fits = (nu, metric) => !nu || nu === metric.cu || nu in metric.altN;

// The form of `unit` the metric understands, normalised; null if none.
export function unitFor(unit, metric) {
  if (!metric || metric.cu == null) return null;
  for (const f of unitForms(unit)) {
    const nu = normUnit(f);
    if (fits(nu, metric)) return nu;
  }
  return null;
}

// True when a value in `unit` can be shown in the metric's canonical unit.
export function canConvert(unit, metric) {
  return unitFor(unit, metric) != null;
}

// Converts value from `unit` to the metric's canonical unit. Returns null when
// the unit is unknown for that metric. A missing unit is taken as canonical.
export function convert(value, unit, metric) {
  if (value == null || !Number.isFinite(value) || !metric) return null;
  const nu = unitFor(unit, metric);
  if (nu == null) return null;
  if (!nu) return metric.unitless ? metric.unitless(value) : value;
  if (nu === metric.cu) return value;
  const f = metric.altN[nu];
  return Array.isArray(f) ? value * f[0] + f[1] : value * f;
}

// Inverse of convert(): canonical value expressed in `unit` (used for demo data).
export function convertFromCanonical(value, unit, metric) {
  const nu = normUnit(unit);
  if (!nu || nu === metric.cu) return value;
  const f = metric.altN[nu];
  if (f == null) return null;
  return Array.isArray(f) ? (value - f[1]) / f[0] : value / f;
}
