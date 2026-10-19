// Adult vaccination schedules of Finland (THL) and Germany (STIKO), applied to the
// user's vaccination history. Pure functions.
//
// Rules were checked against THL pages and the STIKO recommendations 2026
// (Epid Bull 4/2026, COVID-19 update 28/2026) when written (see REVIEWED).
// Each advice: { target, title, fi: Advice, de: Advice, sources: [ids] }
// Advice: { status: 'overdue' | 'due' | 'ok' | 'none' | 'unknown', due: 'YYYY-MM-DD' | '', text }

export const SCHEDULES_REVIEWED = '2026-10-19';

export const SCHEDULE_SOURCES = {
  thl_programme: { short: 'THL', title: 'Rokotusohjelma lapsille ja aikuisille', url: 'https://thl.fi/aiheet/infektiotaudit-ja-rokotukset/tietoa-rokotuksista/kansallinen-rokotusohjelma/rokotusohjelma-lapsille-ja-aikuisille' },
  thl_dt: { short: 'THL dT', title: 'Aikuisten kurkkumätä-jäykkäkouristusrokote (dT)', url: 'https://thl.fi/ohjeita-ammattilaisille/aikuisten-kurkkumata-jaykkakouristusrokote-dt' },
  thl_tbe: { short: 'THL TBE', title: 'TBE-rokote', url: 'https://thl.fi/ohjeita-ammattilaisille/tbe-rokote' },
  thl_flu: { short: 'THL influenssa', title: 'Influenssarokote', url: 'https://thl.fi/ohjeita-ammattilaisille/influenssarokote' },
  thl_covid: { short: 'THL korona 2026', title: 'Kuka tarvitsee koronarokotuksen syksyllä 2026?', url: 'https://www.julkari.fi/items/84af049c-11d9-46c1-8034-9e75b8030b2f' },
  thl_pcv: { short: 'THL PCV', title: 'Pneumokokkikonjugaattirokote — rokotusohjelman ulkopuoliset rokotukset', url: 'https://thl.fi/ohjeita-ammattilaisille/pneumokokkikonjugaattirokote-eli-pcv/rokotusohjelman-ulkopuoliset-rokotukset' },
  thl_polio: { short: 'THL polio', title: 'Poliorokote', url: 'https://thl.fi/ohjeita-ammattilaisille/poliorokote' },
  vn_zoster: { short: 'Valtioneuvosto 2026', title: 'Rokotusohjelmaa täydennetään: vyöruusurokotus riskiryhmille', url: 'https://valtioneuvosto.fi/-/1271139/rokotusohjelmaa-taydennetaan-vyoruusurokotus-riskiryhmille-ja-vesirokkorokotuksen-laajennus-aikuisille' },
  stiko2026: { short: 'STIKO 2026', title: 'STIKO-Empfehlungen 2026 (Epid Bull 4/2026)', url: 'https://www.rki.de/DE/Aktuelles/Publikationen/Epidemiologisches-Bulletin/2026/04_26.pdf' },
  stiko_covid: { short: 'STIKO COVID-19 2026', title: 'STIKO: Aktualisierung der COVID-19-Impfempfehlung (Epid Bull 28/2026)', url: 'https://www.rki.de/DE/Aktuelles/Publikationen/Epidemiologisches-Bulletin/2026/28_26.pdf' },
  rki_fsme: { short: 'RKI FSME', title: 'RKI FAQ: FSME-Impfempfehlung', url: 'https://www.rki.de/SharedDocs/FAQs/DE/Impfen/FSME-Impfung/Liste_Impfempfehlung.html' },
};

const pad = (n) => String(n).padStart(2, '0');
export function addYears(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + n}-${pad(m)}-${pad(d)}`;
}
const year = (iso) => Number(iso.slice(0, 4));
const ageOn = (profile, iso) => (profile.birthYear ? year(iso) - profile.birthYear : null);
const birthdayIn = (profile, age) => `${profile.birthYear + age}-07-01`; // birth date unknown: mid-year

function status(due, today) {
  if (!due) return 'none';
  if (due <= today) return 'overdue';
  const soon = new Date(Date.parse(today) + 90 * 864e5).toISOString().slice(0, 10);
  return due <= soon ? 'due' : 'ok';
}

const dosesFor = (vaccines, target) => vaccines.filter((v) => v.targets?.includes(target)).sort((a, b) => a.date.localeCompare(b.date));

// "1/3", "2.", "3/3" → 1, 2, 3; "booster", "tehoste", "Auffrischung" → 'booster'.
export function doseNumber(dose) {
  const s = String(dose ?? '').toLowerCase();
  if (/boost|tehost|auffrisch|ревакц|бустер/.test(s)) return 'booster';
  const m = s.match(/^\s*(\d)/);
  return m ? Number(m[1]) : null;
}

// Flu / COVID season: from 1 August.
function seasonStart(today) {
  const y = year(today) - (Number(today.slice(5, 7)) < 8 ? 1 : 0);
  return `${y}-08-01`;
}

// ---- rules ----------------------------------------------------------------

function tetanus(vaccines, profile, today) {
  const doses = dosesFor(vaccines, 'tetanus').concat(dosesFor(vaccines, 'diphtheria')).sort((a, b) => a.date.localeCompare(b.date));
  const last = doses[doses.length - 1];
  const adultPertussis = dosesFor(vaccines, 'pertussis').some((v) => (ageOn(profile, v.date) ?? 99) >= 18);
  const out = { target: 'tetanus', title: 'Tetanus & diphtheria (Td)', sources: ['thl_dt', 'stiko2026'] };
  if (!last) {
    const none = { status: 'unknown', due: '', text: 'No dose recorded. Add your last Td vaccination (check your vaccination booklet).' };
    return { ...out, fi: none, de: none };
  }
  // Germany: every 10 years; the next one once as Tdap if no pertussis dose as an adult.
  const deDue = addYears(last.date, 10);
  const de = { status: status(deDue, today), due: deDue,
    text: `Every 10 years${adultPertussis ? '' : '; the next one as Tdap (with whooping cough) once in adulthood'}.` };
  // Finland: boosters at 25, 45 and 65, then every 10 years; now if 20+ years have passed; 2+ years apart.
  let fi;
  if (!profile.birthYear) {
    const due = addYears(last.date, 20);
    fi = { status: status(due, today), due, text: 'Boosters at ages 25, 45 and 65, then every 10 years. Add your birth year for the exact date; at the latest 20 years after the last dose.' };
  } else {
    const lastAge = ageOn(profile, last.date);
    const earliest = addYears(last.date, 2);
    let due;
    if (lastAge >= 65) due = addYears(last.date, 10);
    else {
      const milestone = [25, 45, 65].map((a) => birthdayIn(profile, a)).find((d) => d >= earliest) ?? addYears(last.date, 10);
      const latest = addYears(last.date, 20);
      due = milestone < latest ? milestone : latest;
    }
    fi = { status: status(due, today), due, text: 'Boosters at ages 25, 45 and 65, then every 10 years (at least 2 years apart; at once if 20+ years have passed).' };
  }
  return { ...out, fi, de };
}

function tbe(vaccines, profile, today) {
  const doses = dosesFor(vaccines, 'tbe');
  const out = { target: 'tbe', title: 'Tick-borne encephalitis (TBE)', sources: ['thl_tbe', 'rki_fsme'] };
  if (!doses.length) return null; // only for people in risk areas — no advice without a first dose
  let third = doses.findIndex((v) => typeof doseNumber(v.dose) === 'number' && doseNumber(v.dose) >= 3);
  if (third < 0 && doses.length >= 3) third = 2;
  if (third < 0) {
    const adv = { status: 'due', due: '', text: doses.length === 1
      ? 'Basic series: dose 2 one to three months after dose 1, dose 3 after 9–12 months.'
      : 'Basic series: dose 3 nine to twelve months after dose 2.' };
    return { ...out, fi: adv, de: adv };
  }
  const boosters = doses.slice(third + 1);
  const ref = boosters.length ? boosters[boosters.length - 1].date : doses[third].date;
  const firstBooster = !boosters.length;
  const age = ageOn(profile, ref);
  let fi;
  let de;
  if (firstBooster) {
    const due = addYears(ref, 3);
    fi = { status: status(due, today), due, text: 'First booster 3 years after the basic series.' };
    de = { status: status(due, today), due, text: 'First booster 3 years after the basic series, if exposure continues.' };
  } else if (age == null) {
    const unknown = { status: 'unknown', due: '', text: 'The booster interval depends on age — add your birth year.' };
    fi = unknown;
    de = unknown;
  } else {
    const fiYears = age < 50 ? 10 : age <= 60 ? 5 : 3;
    const deYears = age < 60 ? 5 : 3;
    const fiDue = addYears(ref, fiYears);
    const deDue = addYears(ref, deYears);
    fi = { status: status(fiDue, today), due: fiDue, text: `Later boosters every ${fiYears} years at your age (under 50: 10, 50–60: 5, over 60: 3 years).` };
    de = { status: status(deDue, today), due: deDue, text: `Every ${deYears} years at your age for FSME-IMMUN (under 60: 5, 60+: 3 years). Encepur uses age 50 as the limit — check its product information.` };
  }
  return { ...out, fi, de };
}

function seasonal(vaccines, profile, today, target, title, fiAge, deAge, fiNote, deNote, sources) {
  const age = profile.birthYear ? year(today) - profile.birthYear : null;
  const out = { target, title, sources };
  if (age == null) {
    const unknown = { status: 'unknown', due: '', text: 'Recommended by age — add your birth year.' };
    return { ...out, fi: unknown, de: unknown };
  }
  const thisSeason = dosesFor(vaccines, target).some((v) => v.date >= seasonStart(today));
  const autumn = `${year(seasonStart(today))}-10-01`;
  const one = (minAge, note) => {
    if (age < minAge) return { status: 'none', due: '', text: `Routinely from age ${minAge}${note ? '; ' + note : ''}. Earlier for risk groups and some jobs.` };
    if (thisSeason) return { status: 'ok', due: '', text: `Done this season. Every autumn from age ${minAge}.` };
    return { status: status(autumn, today) === 'ok' ? 'due' : status(autumn, today), due: autumn, text: `Every autumn from age ${minAge}${note ? '; ' + note : ''}.` };
  };
  return { ...out, fi: one(fiAge, fiNote), de: one(deAge, deNote) };
}

function once(vaccines, profile, today, target, title, fi, de, sources) {
  const age = profile.birthYear ? year(today) - profile.birthYear : null;
  const done = dosesFor(vaccines, target);
  const out = { target, title, sources };
  const one = (rule) => {
    if (!rule) return { status: 'none', due: '', text: 'No general recommendation for healthy adults.' };
    if (age == null) return { status: 'unknown', due: '', text: `${rule.text} Add your birth year to check.` };
    const enough = rule.doses ? done.length >= rule.doses : done.some((v) => ageOn(profile, v.date) >= rule.age);
    if (enough) return { status: 'ok', due: '', text: `Done. ${rule.text}` };
    if (age < rule.age) return { status: 'none', due: birthdayIn(profile, rule.age), text: rule.text };
    return { status: 'due', due: '', text: rule.text };
  };
  return { ...out, fi: one(fi), de: one(de) };
}

export function scheduleAdvice(vaccines, profile = {}, today = new Date().toISOString().slice(0, 10)) {
  return [
    tetanus(vaccines, profile, today),
    tbe(vaccines, profile, today),
    seasonal(vaccines, profile, today, 'influenza', 'Influenza', 65, 60, '', 'high-dose or adjuvanted vaccine', ['thl_flu', 'stiko2026']),
    seasonal(vaccines, profile, today, 'covid', 'COVID-19', 80, 75, 'also offered at 75–79', '', ['thl_covid', 'stiko_covid']),
    once(vaccines, profile, today, 'pneumo', 'Pneumococcal',
      { age: 65, text: 'A conjugate vaccine (PCV) is recommended from 65 but is self-paid unless you are in a risk group.' },
      { age: 60, text: 'One dose of PCV20 from age 60.' }, ['thl_pcv', 'stiko2026']),
    once(vaccines, profile, today, 'zoster', 'Shingles (zoster)',
      null,
      { age: 60, doses: 2, text: 'Two doses (Shingrix) 2–6 months apart from age 60; from 18 with a higher risk.' }, ['vn_zoster', 'stiko2026']),
    once(vaccines, profile, today, 'rsv', 'RSV',
      null,
      { age: 75, text: 'One dose from age 75 (60–74 with a severe underlying disease or in a care home), in late summer or autumn.' }, ['stiko2026']),
  ].filter(Boolean);
}

export const SCHEDULE_NOTES = [
  'Polio: no routine adult boosters in either country. Finland: an IPV booster before stays of over 4 weeks in a high-risk country if the last dose was over 12 months ago. Germany: only for travel or work when indicated.',
  'Measles, mumps, rubella: Finland — adults without the diseases or vaccinations get 2 doses at least 6 months apart. Germany — one MMR dose for people born after 1970 with no or only one childhood dose, or unknown status.',
  'Finland: RSV and shingles vaccines are not in the national programme for healthy adults (shingles is free for some risk groups from 2027). From August 2026, adults without chickenpox can get a free 2-dose varicella catch-up.',
  'Risk groups, pregnancy, travel and jobs have their own recommendations — ask your doctor or occupational health service.',
];
