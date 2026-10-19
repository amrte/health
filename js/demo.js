// Made-up demo data for a fictional man born in 1980: seven check-ups at a Finnish, a German and a Ukrainian lab,
// each with its own test names and units, so conversion and matching are visible.

import { getMetric } from './metrics.js';
import { convertFromCanonical } from './units.js';
import { uid } from './dom.js';

const DATES = ['2022-03-14', '2023-02-07', '2023-11-20', '2024-06-03', '2025-01-15', '2025-10-02', '2026-05-12'];
const LAB_AT = ['ua', 'de', 'fi', 'fi', 'de', 'fi', 'fi'];
const LABS = { fi: 'Demo lab, Helsinki', de: 'Demo-Labor, Berlin', ua: 'Демо-лабораторія, Київ' };

// Canonical values per date (index matches DATES). null = not tested.
const TRUE = {
  hb: [151, 149, 153, 147, 150, 146, 148],
  wbc: [5.8, 6.4, 5.2, 7.1, 5.9, 6.3, 5.5],
  plt: [240, 255, 230, 262, 248, 239, 251],
  hct: [44, 43.5, 45, 43, 44, 42.5, 43.5],
  mcv: [89, 90, 88, 89, 91, 90, 90],
  glucose: [5.1, 5.4, 5.3, 5.6, 5.8, 5.7, 6.1],
  hba1c: [null, 36, 37, 38, 39, 40, 41],
  chol: [4.8, 5.1, 5.3, 5.2, 5.6, 5.4, 5.5],
  ldl: [2.8, 3.1, 3.3, 3.2, 3.5, 3.3, 3.4],
  hdl: [1.4, 1.3, 1.4, 1.35, 1.3, 1.4, 1.45],
  trig: [1.1, 1.4, 1.2, 1.5, 1.6, 1.3, 1.2],
  crea: [84, 88, 86, 91, 89, 92, 90],
  alt: [28, 35, 31, 52, 38, 33, 29],
  ferritin: [145, 120, 98, 76, 61, 48, 27],
  tsh: [1.8, 2.1, 1.9, 2.4, 2.2, 2.6, 4.4],
  ft4: [15, 14, 15, 14, 14, 13, 13],
  vitd: [48, 62, 55, 88, 52, 71, 79],
  crp: [1.2, 0.8, 4.1, 1.0, 0.6, 1.5, 0.9],
  esr: [6, null, null, null, null, null, null],
  b12: [null, 310, null, null, 280, null, null],
};

// Per lab: printed name, unit, decimals, reference range (in that unit).
const FORMAT = {
  fi: {
    hb: ['B-Hb', 'g/l', 0, '134–167'], wbc: ['B-Leuk', 'E9/l', 1, '3.4–8.2'], plt: ['B-Trom', 'E9/l', 0, '150–360'],
    hct: ['B-HKR', '', 2, '0.39–0.50'], mcv: ['E-MCV', 'fl', 0, '82–98'], glucose: ['fP-Gluk', 'mmol/l', 1, '4.0–6.0'],
    hba1c: ['B-GHbA1C', 'mmol/mol', 0, '20–42'], chol: ['fP-Kol', 'mmol/l', 1, '< 5.0'], ldl: ['fP-Kol-LDL', 'mmol/l', 1, '< 3.0'],
    hdl: ['fP-Kol-HDL', 'mmol/l', 2, '> 1.0'], trig: ['fP-Trigly', 'mmol/l', 1, '< 1.7'], crea: ['P-Krea', 'µmol/l', 0, '60–100'],
    alt: ['P-ALAT', 'U/l', 0, '< 50'], ferritin: ['P-Ferrit', 'µg/l', 0, '30–400'], tsh: ['P-TSH', 'mU/l', 2, '0.5–3.6'], ft4: ['P-T4-V', 'pmol/l', 0, '9–19'],
    vitd: ['fS-D-25', 'nmol/l', 0, '50–125'], crp: ['P-CRP', 'mg/l', 1, '< 3'],
  },
  de: {
    hb: ['Hämoglobin', 'g/dl', 1, '13,5–17,5'], wbc: ['Leukozyten', '/nl', 1, '3,9–10,2'], plt: ['Thrombozyten', '/nl', 0, '146–328'],
    hct: ['Hämatokrit', '%', 1, '40–52'], mcv: ['MCV', 'fl', 0, '80–99'], glucose: ['Glukose nüchtern', 'mg/dl', 0, '70–100'],
    hba1c: ['HbA1c', '%', 1, '4,0–5,6'], chol: ['Cholesterin gesamt', 'mg/dl', 0, '< 200'], ldl: ['LDL-Cholesterin', 'mg/dl', 0, '< 116'],
    hdl: ['HDL-Cholesterin', 'mg/dl', 0, '> 40'], trig: ['Triglyceride', 'mg/dl', 0, '< 150'], crea: ['Kreatinin', 'mg/dl', 2, '0,70–1,20'],
    alt: ['GPT (ALT)', 'U/l', 0, '< 50'], ferritin: ['Ferritin', 'ng/ml', 0, '30–400'], tsh: ['TSH basal', 'µIU/ml', 2, '0,27–4,20'], ft4: ['fT4', 'pmol/l', 1, '12,0–22,0'],
    vitd: ['25-OH-Vitamin D', 'ng/ml', 0, '30–100'], crp: ['CRP', 'mg/dl', 2, '< 0,50'], b12: ['Vitamin B12', 'pg/ml', 0, '197–771'],
  },
  ua: {
    hb: ['Гемоглобін', 'г/л', 0, '130–160'], wbc: ['Лейкоцити', '×10⁹/л', 1, '4,0–9,0'], plt: ['Тромбоцити', '×10⁹/л', 0, '180–320'],
    hct: ['Гематокрит', '%', 1, '40–48'], mcv: ['MCV', 'фл', 0, '80–100'], glucose: ['Глюкоза', 'ммоль/л', 1, '3,3–5,5'],
    chol: ['Холестерин загальний', 'ммоль/л', 1, '< 5,2'], ldl: ['Холестерин ЛПНЩ', 'ммоль/л', 1, '< 3,0'],
    hdl: ['Холестерин ЛПВЩ', 'ммоль/л', 2, '> 1,0'], trig: ['Тригліцериди', 'ммоль/л', 2, '< 1,7'], crea: ['Креатинін', 'мкмоль/л', 0, '62–106'],
    alt: ['АЛТ', 'Од/л', 0, '< 41'], ferritin: ['Феритин', 'нг/мл', 0, '30–400'], tsh: ['ТТГ', 'мкМО/мл', 2, '0,4–4,0'], ft4: ['Т4 вільний', 'пмоль/л', 1, '12,0–22,0'],
    vitd: ['Вітамін D (25-OH)', 'нг/мл', 0, '30–100'], crp: ['С-реактивний білок', 'мг/л', 1, '< 5'], esr: ['ШОЕ', 'мм/год', 0, '2–15'],
  },
};

export function demoData() {
  const reports = [];
  const obs = [];
  DATES.forEach((date, i) => {
    const lab = LAB_AT[i];
    const report = { id: uid(), date, lab: LABS[lab], note: i === 2 ? 'Had a cold the week before (demo).' : '', files: [], demo: true, created: new Date().toISOString() };
    reports.push(report);
    for (const [key, series] of Object.entries(TRUE)) {
      const fmt = FORMAT[lab][key];
      const v = series[i];
      if (!fmt || v == null) continue;
      const [name, unit, digits, refRaw] = fmt;
      const m = getMetric(key);
      const local = key === 'hct' && unit === '' ? v / 100 : convertFromCanonical(v, unit, m);
      let valueRaw = local.toFixed(digits);
      if (lab !== 'fi') valueRaw = valueRaw.replace('.', ',');
      obs.push({ id: uid(), reportId: report.id, date, metric: key, name, valueRaw, unit, refRaw, flag: '' });
    }
  });
  const vaccines = [
    ['2016-09-12', 'Boostrix Polio', ['tetanus', 'diphtheria', 'pertussis', 'polio'], 'booster', '2026-09-12'],
    ['2021-06-02', 'FSME-Immun', ['tbe'], '3/3', '2024-06-02'],
    ['2023-04-18', 'Twinrix', ['hepa', 'hepb'], '3/3', ''],
    ['2025-11-03', 'Comirnaty', ['covid'], 'booster', ''],
    ['2025-11-03', 'Vaxigrip Tetra', ['influenza'], '', ''],
  ].map(([date, name, targets, dose, due]) => ({ id: uid(), date, name, targets, dose, lot: '', place: 'Demo clinic', due, note: '', files: [], demo: true }));
  return { reports, obs, vaccines, ...demoFitness() };
}

export const DEMO_PROFILE = { sex: 'male', birthYear: 1980 };

// Six months of made-up watch data: night-time heart rate, HRV, sleep, steps and
// 2–4 workouts a week. The last week shows a cold: higher heart rate, lower HRV.
export function demoFitness(today = new Date()) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const measures = [];
  const workouts = [];
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - 864e5;
  const sports = [['Running', 45, 8500, 148], ['Cycling', 70, 24000, 132], ['Strength training', 40, 0, 112], ['Walking', 55, 4800, 104]];
  for (let i = 182; i >= 0; i--) {
    const t = end - i * 864e5;
    const date = new Date(t).toISOString().slice(0, 10);
    const sick = i < 6;
    const add = (kind, value) => measures.push({ id: `demo:${kind}:${date}`, date, kind, value, source: 'demo' });
    add('night_hr', Math.round(52 + rnd() * 4 - i / 120 + (sick ? 7 : 0)));
    add('hrv', Math.round(46 + rnd() * 10 + i / 60 - (sick ? 14 : 0)));
    add('sleep_min', Math.round(6.4 * 60 + rnd() * 80 - (new Date(t).getUTCDay() === 0 ? -40 : 0)));
    add('steps', Math.round(5200 + rnd() * 7000 - (sick ? 3000 : 0)));
    const dow = new Date(t).getUTCDay();
    if (!sick && (dow === 2 || dow === 6 || (dow === 4 && rnd() > 0.4))) {
      const [sport, min, dist, hr] = sports[Math.floor(rnd() * sports.length)];
      const dur = Math.round((min + rnd() * 20 - 10) * 60);
      workouts.push({ id: `demo:w:${date}`, start: `${date}T17:30:00`, sport, durationS: dur, distanceM: dist ? Math.round(dist * (dur / 60 / min)) : null,
        hrAvg: Math.round(hr + rnd() * 8 - 4), hrMax: Math.round(hr + 22 + rnd() * 8), kcal: Math.round(dur / 60 * 9), load: Math.round(dur / 60 * (hr - 90) / 12), source: 'demo' });
    }
  }
  return { measures, workouts };
}
