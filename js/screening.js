// National screening programmes and check-ups for adults in Finland and Germany
// (checked 2026-10-19 against THL / Cancer Society of Finland and G-BA directives).
// Pure data and functions; "done" dates are timeline events of kind 'screening'.

export const SCREENING_REVIEWED = '2026-10-19';

// sex: 'female' | 'male' | '' (both). once: a single examination. invite: in Finland
// people are invited by letter and can't book it themselves.
export const SCREENING = [
  { key: 'fi_bowel', country: 'FI', name: 'Bowel cancer screening (home stool test)', sex: '', minAge: 56, maxAge: 74, years: 2, invite: true,
    note: 'Being phased in: in 2026 invitations go to people aged about 60–72; everyone aged 56–74 is covered from 2031.' },
  { key: 'fi_breast', country: 'FI', name: 'Breast cancer screening (mammography)', sex: 'female', minAge: 50, maxAge: 69, years: 2, invite: true,
    note: 'Every 20–26 months.' },
  { key: 'fi_cervix', country: 'FI', name: 'Cervical cancer screening (HPV test)', sex: 'female', minAge: 30, maxAge: 65, years: 5, invite: true,
    note: 'HPV test from 30; some regions also invite 25-year-olds.' },

  { key: 'de_checkup', country: 'DE', name: 'Gesundheits-Check-up', sex: '', minAge: 35, years: 3,
    note: 'Includes cholesterol, glucose, a urine test and a vaccination check.' },
  { key: 'de_checkup_young', country: 'DE', name: 'Gesundheits-Check-up (once between 18 and 34)', sex: '', minAge: 18, maxAge: 34, once: true },
  { key: 'de_hep', country: 'DE', name: 'Hepatitis B and C test', sex: '', minAge: 35, once: true, note: 'Done together with a Check-up.' },
  { key: 'de_skin', country: 'DE', name: 'Skin cancer screening', sex: '', minAge: 35, years: 2 },
  { key: 'de_colonoscopy', country: 'DE', name: 'Screening colonoscopy', sex: '', minAge: 50, years: 10, maxCount: 2,
    note: 'Two colonoscopies at least 10 years apart — or a stool test every 2 years instead.' },
  { key: 'de_ifobt', country: 'DE', name: 'Bowel cancer stool test (iFOBT)', sex: '', minAge: 50, years: 2, coveredBy: { key: 'de_colonoscopy', years: 10 },
    note: 'Every 2 years from 50, unless you had a colonoscopy in the last 10 years.' },
  { key: 'de_prostate', country: 'DE', name: 'Prostate cancer screening (examination)', sex: 'male', minAge: 45, years: 1 },
  { key: 'de_aaa', country: 'DE', name: 'Abdominal aortic aneurysm ultrasound', sex: 'male', minAge: 65, once: true },
  { key: 'de_breast_exam', country: 'DE', name: 'Breast examination by a doctor', sex: 'female', minAge: 30, years: 1 },
  { key: 'de_mammo', country: 'DE', name: 'Mammography screening', sex: 'female', minAge: 50, maxAge: 75, years: 2,
    note: 'Invitation by letter. From August 2027 the start age is planned to drop to 45.' },
  { key: 'de_cervix_young', country: 'DE', name: 'Cervical cancer screening (Pap test)', sex: 'female', minAge: 20, maxAge: 34, years: 1 },
  { key: 'de_cervix', country: 'DE', name: 'Cervical cancer screening (Pap + HPV test)', sex: 'female', minAge: 35, years: 3 },
  { key: 'de_lung', country: 'DE', name: 'Lung cancer screening (low-dose CT)', sex: '', minAge: 50, maxAge: 75, years: 1, smokers: true,
    note: 'Since April 2026, for current or former heavy smokers: at least 25 years of smoking and 15 pack-years. Not yet offered everywhere.' },
];

export const SCREENING_SOURCES = [
  { short: 'Syöpärekisteri', url: 'https://syoparekisteri.fi/seulonta/' },
  { short: 'Cancer Registry (FI)', url: 'https://cancerregistry.fi/screening/breast-cancer-screening/' },
  { short: 'G-BA Früherkennung', url: 'https://www.g-ba.de/themen/methodenbewertung/erwachsene/krebsfrueherkennung/' },
  { short: 'G-BA Check-up', url: 'https://www.g-ba.de/themen/methodenbewertung/erwachsene/gesundheitsuntersuchungen/' },
  { short: 'Krebsinformationsdienst', url: 'https://www.krebsinformationsdienst.de/hautkrebs/frueherkennung' },
];
export const SCREENING_NOTE = 'Finnish programmes invite you by letter; in Germany you book with your doctor and the statutory health insurance pays. Your doctor can advise earlier or more frequent checks, e.g. with a family history.';

const addYears = (iso, n) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`;
const SOON_DAYS = 60;

// One row per programme that applies now or within 10 years:
// { item, status: 'due' | 'soon' | 'ok' | 'invite' | 'upcoming', last, next, reason }.
export function screeningStatus(profile = {}, events = [], today) {
  if (!profile.birthYear || !profile.sex) return [];
  const age = Number(today.slice(0, 4)) - profile.birthYear;
  const done = (key) => events.filter((e) => e.kind === 'screening' && e.screen === key && e.date).map((e) => e.date).sort();
  const soon = new Date(Date.parse(today) + SOON_DAYS * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const item of SCREENING) {
    if (item.sex && item.sex !== profile.sex) continue;
    if (item.smokers && profile.smoker !== 'yes') continue;
    if (item.maxAge != null && age > item.maxAge) continue;
    const dates = done(item.key);
    const last = dates.at(-1) ?? '';
    const base = { item, last };
    if (age < item.minAge) {
      if (item.minAge - age <= 10) out.push({ ...base, status: 'upcoming', next: `${profile.birthYear + item.minAge}-01-01`, reason: `From age ${item.minAge}${item.note ? `. ${item.note}` : ''}` });
      continue;
    }
    const range = item.maxAge != null ? `ages ${item.minAge}–${item.maxAge}` : `from age ${item.minAge}`;
    const every = item.once ? 'Once' : item.years === 1 ? 'Every year' : `Every ${item.years} years`;
    const reason = `${every}, ${range}.${item.note ? ` ${item.note}` : ''}`;
    if (item.once || (item.maxCount && dates.length >= item.maxCount)) {
      out.push({ ...base, status: last ? 'ok' : item.invite ? 'invite' : 'due', next: '', reason });
      continue;
    }
    const cover = item.coveredBy && done(item.coveredBy.key).at(-1);
    if (cover && addYears(cover, item.coveredBy.years) > today) {
      out.push({ ...base, status: 'ok', next: addYears(cover, item.coveredBy.years), reason: `${reason} Covered by your colonoscopy of ${cover.slice(0, 4)}.` });
      continue;
    }
    if (!last) { out.push({ ...base, status: item.invite ? 'invite' : 'due', next: '', reason }); continue; }
    const next = addYears(last, item.years);
    const status = next <= today ? (item.invite ? 'invite' : 'due') : next <= soon ? 'soon' : 'ok';
    out.push({ ...base, status, next, reason });
  }
  return out;
}
