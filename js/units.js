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

// ---- suggestions for unclear units ------------------------------------------------

// "mg/dl" → "mg/dL", "umol/l" → "µmol/L", "u/l" → "U/L" for showing a unit.
export function prettyUnit(u) {
  let s = String(u);
  if (/[A-ZµΜ⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s)) return s; // already written for people
  if (/^u\/l$/.test(s)) return 'U/L';
  if (/^mu\/l$/.test(s)) return 'mU/L';
  s = s.replace(/^u(?=[a-z])/, 'µ').replace(/^(µ|m)?iu/, (x, p) => `${p ?? ''}IU`);
  return s.replace(/\/dl$/, '/dL').replace(/\/ml$/, '/mL').replace(/\/l$/, '/L');
}

// How alike two written units are: 3 one contains the other ("pg/Ery" ~ "pg"),
// 2 same amount part ("mg" in "mg/dl" ~ "mg/l"), 1 same per-part, else 0.
function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0));
}
function unitLikeness(a, b) {
  if (!a || !b) return 0;
  if (a.startsWith(b) || b.startsWith(a) || oneEditApart(a, b)) return 3;
  const [an, ad] = a.split('/');
  const [bn, bd] = b.split('/');
  if (an && an === bn) return 2;
  if (ad && ad === bd) return 1;
  return 0;
}

// Units the metric understands, best first, for a value printed in `unit`.
// `typical` is a usual value for this person in the canonical unit (e.g. the
// median of earlier results), used to prefer units that give a similar value.
// Returns [{ unit, v }] with the value converted by that unit.
export function suggestUnits(unit, metric, value, typical = null) {
  if (!metric) return [];
  const raw = unitForms(unit).map((f) => f.toLowerCase().replace(/\s+/g, '')).filter(Boolean);
  const forms = [...new Set([...unitForms(unit).map(normUnit), ...raw])].filter(Boolean);
  const current = unitFor(unit, metric);
  // One candidate per conversion: "pg", "pg/Ery" and "pg/cell" are the same unit.
  const factor = (x) => JSON.stringify(normUnit(x) === metric.cu ? 1 : metric.altN[normUnit(x)]);
  const cands = [metric.unit, ...Object.keys(metric.alt ?? {})].filter((x, i, all) => all.findIndex((y) => factor(y) === factor(x)) === i);
  const scored = cands
    .filter((x) => normUnit(x) !== current && factor(x) !== factor(current === metric.cu ? metric.unit : Object.keys(metric.alt ?? {}).find((y) => normUnit(y) === current) ?? '\0'))
    .map((x) => {
      const v = value == null ? null : convert(value, x, metric);
      // All spellings of the unit ("ng/ml" for µg/L); show the one closest to the printed unit.
      const spellings = [x, normUnit(x), ...Object.keys(SYN).filter((k) => SYN[k] === normUnit(x))];
      let like = 0;
      let shown = x;
      for (const sp of spellings) {
        const l = Math.max(0, ...forms.map((f) => unitLikeness(f, sp.toLowerCase())));
        if (l > like) { like = l; shown = sp; }
      }
      const off = typical > 0 && v > 0 ? Math.abs(Math.log10(v / typical)) : null;
      return { unit: prettyUnit(shown), v, like, off, score: like - (off == null ? 0 : off * 2) };
    })
    .filter((c) => c.like > 0 || (c.off != null && c.off < 0.5));
  // A unit that looks like the printed one and fits wins over ones that only fit.
  const good = scored.some((c) => c.like > 0 && (c.off == null || c.off < 0.3));
  return scored.filter((c) => !good || c.like > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

// A convertible value far from this person's usual one (6× or more), where
// another unit would bring it close: probably the wrong unit was copied.
export function unitLooksWrong(unit, metric, value, typical) {
  if (!metric || value == null || !(typical > 0)) return [];
  const v = convert(value, unit, metric);
  if (!(v > 0) || Math.abs(Math.log10(v / typical)) < Math.log10(6)) return [];
  return suggestUnits(unit, metric, value, typical).filter((c) => c.off != null && c.off < Math.log10(1.5));
}

// Every unit the metric understands (one per conversion), with the value it gives.
export function unitOptions(metric, value) {
  if (!metric) return [];
  const factor = (x) => JSON.stringify(normUnit(x) === metric.cu ? 1 : metric.altN[normUnit(x)]);
  return [metric.unit, ...Object.keys(metric.alt ?? {})]
    .filter((x, i, all) => all.findIndex((y) => factor(y) === factor(x)) === i)
    .map((x) => ({ unit: prettyUnit(x), v: value == null ? null : convert(value, x, metric) }))
    .slice(0, 5);
}
