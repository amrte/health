// Blood group and Rh factor: read from lab results ("O (I)", "A Rh+", "rh (-)
// отрицательный", "0 Rh negativ") and kept in the profile. Pure functions.

// Roman numerals (Ukraine, Russia): I = O, II = A, III = B, IV = AB.
const ROMAN = { i: 'O', ii: 'A', iii: 'B', iv: 'AB' };

export function parseAbo(text) {
  // Cyrillic look-alikes: А, В, О and Ukrainian І.
  const s = String(text ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/а/g, 'a').replace(/в/g, 'b').replace(/о/g, 'o').replace(/і/g, 'i');
  const letters = s.replace(/\(.*?\)/g, ' ').match(/(?:^|[^a-zа-я])(ab|a|b|o|0)(?=$|[^a-zа-я])/);
  if (letters) return { a: 'A', b: 'B', ab: 'AB', o: 'O', 0: 'O' }[letters[1]];
  const roman = s.match(/(?:^|[^a-z])(iv|iii|ii|i)(?=$|[^a-z])/);
  return roman ? ROMAN[roman[1]] : '';
}

// 'pos' | 'neg' | ''. Positive words first: "Rh-positiv" has a hyphen too.
export function parseRh(text) {
  const s = String(text ?? '').toLowerCase();
  if (/pos|позит|полож|\+/.test(s)) return 'pos';
  if (/neg|негат|отриц|від[’'ʼ]?ємн|(?:^|\s|\()[-−–](?:\s|\)|$)|rh\s*[-−–]|d\s*[-−–]/.test(s)) return 'neg';
  return '';
}

export const formatBloodType = ({ abo, rh } = {}) => [abo, rh === 'pos' ? 'Rh+' : rh === 'neg' ? 'Rh−' : ''].filter(Boolean).join(' ');

// From stored results: the latest blood group and Rh rows (a blood-group row may
// carry the Rh too, e.g. "A Rh+"). Returns { abo, rh, date } or null.
export function bloodTypeFromObs(obs) {
  const latest = (key) => obs.filter((o) => o.metric === key && o.valueRaw).sort((a, b) => b.date.localeCompare(a.date))[0];
  const g = latest('blood_group');
  const r = latest('rh');
  const abo = g ? parseAbo(g.valueRaw) : '';
  const rh = (r && parseRh(r.valueRaw)) || (g && /rh|резус|[+−-]\s*$/i.test(g.valueRaw) ? parseRh(g.valueRaw) : '');
  if (!abo && !rh) return null;
  return { abo, rh, date: (g ?? r).date };
}
