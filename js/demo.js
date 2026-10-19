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
  const { dental, files } = demoDental();
  demoHeartAndLetters(reports, obs);
  demoBody(reports, obs);
  return { reports, obs, vaccines, ...demoFitness(), bp: demoBp(), genomes: demoGenomes(), dental, meds: demoMeds(), events: demoEvents(), files };
}

export const DEMO_PROFILE = { sex: 'male', birthYear: 1980, height: 181, smoker: 'no', riskRegion: 'moderate' };

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

// Home readings morning and evening for the last 3 weeks (slightly elevated),
// and one reading at a doctor's office.
export function demoBp(today = new Date()) {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = [];
  const pad = (n) => String(n).padStart(2, '0');
  for (let i = 20; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const [time, add] of [['07:15', 4], ['07:17', 1], ['21:30', 0], ['21:32', -2]]) {
      const sys = Math.round(127 + add + rnd() * 10);
      const dia = Math.round(80 + add / 2 + rnd() * 6);
      out.push({ id: `demo:bp:${date}T${time}`, time: `${date}T${time}`, sys, dia, pulse: Math.round(60 + rnd() * 10), arm: 'left', place: 'home', note: '', source: 'demo' });
    }
  }
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 40);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  out.push({ id: `demo:bp:${date}T10:20`, time: `${date}T10:20`, sys: 142, dia: 88, pulse: 72, arm: 'right', place: 'clinic', note: 'Annual check-up', source: 'demo' });
  return out;
}

// Two made-up DNA tests that agree except for one no-call. Notable: HFE C282Y carrier,
// SLCO1B1 decreased function (relevant to his LDL), CYP2C19 *1/*17.
export function demoGenomes() {
  const snps = {
    rs1800562: 'AG', rs1799945: 'CC', rs6025: 'CC', rs1799963: 'GG', rs4149056: 'TC',
    rs4244285: 'GG', rs4986893: 'GG', rs12248560: 'CT', rs9923231: 'CT', rs1799853: 'CC', rs1057910: 'AA',
    rs1801133: 'GA', rs4988235: 'AG', rs1815739: 'CT', rs429358: 'TT', rs7412: 'CC',
  };
  const tellme = { ...snps };
  delete tellme.rs1815739;
  const at = new Date().toISOString();
  return [
    { id: 'genome:23andMe', provider: '23andMe', fileName: 'genome_Demo_Person_v5_Full.txt', importedAt: at, build: 'GRCh37', total: 638000, snps, demo: true },
    { id: 'genome:tellmeGen', provider: 'tellmeGen', fileName: 'tellmegen_demo.csv', importedAt: at, build: 'GRCh37', total: 751000, snps: tellme, demo: true },
  ];
}

// Made-up X-ray-like pictures (drawn, not real radiographs) so the gallery has something to show.
function xraySvg(kind, seed) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const W = kind === 'panoramic' ? 900 : 500;
  const H = kind === 'panoramic' ? 420 : 360;
  const n = kind === 'panoramic' ? 16 : 4;
  let teeth = '';
  for (const [row, y0, dir] of [[0, H * 0.18, 1], [1, H * 0.54, -1]]) {
    for (let i = 0; i < n; i++) {
      const x = W * 0.06 + (i * (W * 0.88)) / n;
      const curve = kind === 'panoramic' ? Math.abs(i - (n - 1) / 2) * 3 * dir : 0;
      const w = (W * 0.88) / n - 6;
      const hgt = H * 0.28;
      const fill = rnd() > 0.8 ? `<rect x="${x + w * 0.25}" y="${y0 + curve + (row ? hgt * 0.05 : hgt * 0.6)}" width="${w * 0.5}" height="${hgt * 0.22}" rx="4" fill="#f4f4f4"/>` : '';
      teeth += `<rect x="${x}" y="${y0 + curve}" width="${w}" height="${hgt}" rx="${w * 0.35}" fill="url(#g)" opacity="${0.75 + rnd() * 0.2}"/>${fill}`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#d9d9d9"/><stop offset="1" stop-color="#5a5a5a"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#0b0b0b"/>${teeth}<text x="${W - 14}" y="${H - 14}" fill="#888" font-family="sans-serif" font-size="16" text-anchor="end">DEMO · not a real X-ray</text></svg>`;
}

function billSvg(lines, total, currency) {
  const rows = lines.map(([t, p], i) => `<text x="40" y="${150 + i * 32}" font-size="18">${t}</text><text x="560" y="${150 + i * 32}" font-size="18" text-anchor="end">${p}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${220 + lines.length * 32}" width="600" height="${220 + lines.length * 32}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="40" y="60" font-size="26" font-weight="bold">Demo dental clinic — invoice</text><text x="40" y="100" font-size="16" fill="#666">Fictional document for the demo</text>${rows}<text x="40" y="${180 + lines.length * 32}" font-size="20" font-weight="bold">Total</text><text x="560" y="${180 + lines.length * 32}" font-size="20" font-weight="bold" text-anchor="end">${total} ${currency}</text></svg>`;
}

// Five dental visits in three countries, with drawn X-rays and a bill.
export function demoDental(today = new Date()) {
  const files = [];
  const file = (svg, name, meta) => {
    const id = uid();
    files.push({ id, blob: new Blob([svg], { type: 'image/svg+xml' }), type: 'image/svg+xml', name });
    return { id, type: 'image/svg+xml', name, ...meta };
  };
  const pad = (n) => String(n).padStart(2, '0');
  const d = (back) => { const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const it = (tooth, procedure, price, extra = {}) => ({ tooth, procedure, surfaces: '', material: '', price, note: '', ...extra });
  const visits = [
    { date: '2021-03-10', clinic: 'Demo dental clinic, Helsinki', dentist: 'Dr. Demo', currency: 'EUR', nextCheckup: '2022-03-10',
      items: [it('', 'checkup', 65), it('', 'xray', 0), it('36', 'filling', 120, { surfaces: 'MO', material: 'composite' }), it('46', 'filling', 95, { surfaces: 'O', material: 'composite' })],
      files: [file(xraySvg('panoramic', 3), 'panoramic-2021.svg', { kind: 'xray', xrayType: 'panoramic', teeth: [] }),
        file(billSvg([['Check-up', '65.00'], ['Filling 36 MO', '120.00'], ['Filling 46 O', '95.00']], '280.00', 'EUR'), 'bill-2021.svg', { kind: 'bill', teeth: [] })] },
    { date: '2022-09-05', clinic: 'Демо-стоматологія, Київ', dentist: '', currency: 'UAH',
      items: [it('26', 'root_canal', 4800), it('26', 'crown', 9500, { material: 'zirconia' })],
      files: [file(xraySvg('periapical', 9), 'periapical-26.svg', { kind: 'xray', xrayType: 'periapical', teeth: ['26'] })] },
    { date: '2023-11-20', clinic: 'Demo dental clinic, Helsinki', dentist: 'Dr. Demo', currency: 'EUR', nextCheckup: '2024-11-20',
      items: [it('', 'cleaning', 85), it('15', 'filling', 130, { surfaces: 'DO', material: 'composite' }), it('', 'xray', 0)],
      files: [file(xraySvg('bitewing', 17), 'bitewing-2023.svg', { kind: 'xray', xrayType: 'bitewing', teeth: ['14', '15', '16', '17', '44', '45', '46', '47'] })] },
    { date: '2025-02-14', clinic: 'Demo-Zahnarztpraxis, Berlin', dentist: '', currency: 'EUR',
      items: [it('38', 'extraction', 150, { note: 'wisdom tooth' }), it('48', 'missing', null, { note: 'never erupted' })], files: [] },
    { date: d(200), clinic: 'Demo dental clinic, Helsinki', dentist: 'Dr. Demo', currency: 'EUR', nextCheckup: d(17),
      items: [it('', 'checkup', 65), it('', 'cleaning', 85), it('17', 'watch', null, { note: 'early caries, check next time' })], files: [] },
  ].map((v) => ({ id: uid(), total: null, note: '', demo: true, ...v }));
  return { dental: visits, files };
}

// Heart records (ECG, 24-hour Holter, echo, cardiologist's letter) and a GP letter
// whose follow-up date is coming up.
function demoHeartAndLetters(reports, obs, today = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const ahead = (days) => { const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const add = (report, values) => {
    const r = { id: uid(), files: [], demo: true, note: '', created: new Date().toISOString(), diagnoses: [], recommendations: [], medications: [], ...report };
    reports.push(r);
    for (const [metric, name, valueRaw, unit, refRaw = ''] of values) obs.push({ id: uid(), reportId: r.id, date: r.date, metric, name, valueRaw, unit, refRaw, flag: '' });
  };
  add({ type: 'ecg', date: '2025-03-04', lab: 'Demo heart clinic, Helsinki', specialty: 'Cardiology', conclusion: 'Sinus rhythm. Normal ECG.',
    summary: 'Resting 12-lead ECG done because of palpitations. Normal sinus rhythm with normal intervals.' }, [
    ['ecg_hr', 'Syke', '62', '/min'], ['pr', 'PQ-aika', '168', 'ms'], ['qrs', 'QRS-kesto', '96', 'ms'], ['qt', 'QT', '402', 'ms'], ['qtc', 'QTc', '438', 'ms'], ['qrs_axis', 'Akseli', '45', '°'],
  ]);
  add({ type: 'holter', date: '2025-03-11', lab: 'Demo heart clinic, Helsinki', specialty: 'Cardiology',
    conclusion: 'Sinus rhythm throughout. Occasional monomorphic ventricular extrasystoles (1.8 %), no runs. No atrial fibrillation. No pauses over 2 s.',
    summary: '24-hour ECG for palpitations. The extra beats he felt were occasional ventricular extra beats; no atrial fibrillation and no long pauses.' }, [
    ['holter_hours', 'Recording duration', '23.6', 'h'], ['holter_hr_min', 'Minimum heart rate', '46', 'bpm'], ['holter_hr_avg', 'Mean heart rate', '68', 'bpm'],
    ['holter_hr_max', 'Maximum heart rate', '141', 'bpm'], ['pvc_count', 'VES', '1830', ''], ['pvc_pct', 'VES burden', '1.8', '%'],
    ['pac_count', 'SVES', '410', ''], ['pac_pct', 'SVES burden', '0.4', '%'], ['af_burden', 'AF burden', '0', '%'], ['pause_max', 'Longest pause', '1.9', 's'],
  ]);
  add({ type: 'echo', date: '2025-04-02', lab: 'Demo heart clinic, Helsinki', specialty: 'Cardiology', conclusion: 'Normal-sized left ventricle with normal systolic function. No valve disease.',
    summary: 'Ultrasound of the heart: normal size and pumping function, valves normal.' }, [
    ['lvef', 'EF (biplane)', '61', '%'], ['lvedd', 'LVIDd', '51', 'mm'], ['ivsd', 'IVSd', '10', 'mm'], ['lavi', 'LAVI', '28', 'ml/m2'],
  ]);
  add({ type: 'letter', date: '2025-04-10', lab: 'Demo heart clinic, Helsinki', doctor: 'Dr. Demo (cardiologist)', specialty: 'Cardiology',
    summary: 'Seen for palpitations. ECG, 24-hour ECG and echocardiogram were normal apart from occasional harmless-looking extra beats. No treatment needed.',
    diagnoses: ['Palpitations due to occasional ventricular extrasystoles'],
    recommendations: ['Reduce caffeine and alcohol', 'No medication needed', 'Contact a doctor if fainting, chest pain or a long-lasting fast heartbeat occurs'] }, []);
  add({ type: 'letter', date: '2026-05-20', lab: 'Demo health centre, Helsinki', doctor: 'Dr. Demo (GP)', specialty: 'General practice', followUp: ahead(25),
    summary: 'Annual check-up results reviewed. TSH slightly raised with normal free T4; fasting glucose and HbA1c in the prediabetes range; LDL cholesterol above target; ferritin low.',
    diagnoses: ['Subclinical hypothyroidism, to be confirmed', 'Impaired fasting glucose (prediabetes)', 'Low iron stores'],
    recommendations: ['Repeat TSH, free T4 and TPO antibodies in 2–3 months', 'More physical activity and weight control', 'Iron-rich diet; recheck ferritin with the next tests'],
    medications: [] }, []);
}

// Made-up body composition printouts (Finnish, like a gym's InBody report) and
// home scale / tape-measure readings, for the fictional man (181 cm).
function demoBody(reports, obs) {
  const add = (report, values) => {
    const r = { id: uid(), type: 'body', files: [], demo: true, note: '', created: new Date().toISOString(), ...report };
    reports.push(r);
    for (const [metric, name, valueRaw, unit, refRaw = ''] of values) obs.push({ id: uid(), reportId: r.id, date: r.date, metric, name, valueRaw, unit, refRaw, flag: '' });
  };
  const inbody = ([w, smm, fat, pbf, bmi, vfa, ffm, tbw, ecw, prot, min, bmr, whr, pa]) => [
    ['weight', 'Paino', w, 'kg', '66,8–90,4'], ['muscle_mass', 'Lihasmassa', smm, 'kg', '32,7–40,0'], ['fat_mass', 'Rasvamassa', fat, 'kg', '9,4–18,8'],
    ['body_fat_pct', 'Rasvaprosentti', pbf, '%', '10–20'], ['bmi', 'Painoindeksi (BMI)', bmi, 'kg/m²', '18,5–25'], ['visceral_fat_area', 'VFA (Visceral fat area)', vfa, 'cm²', '0–100'],
    ['lean_mass', 'Rasvaton massa', ffm, 'kg', '57,1–69,8'], ['body_water', 'Kehon vesi', tbw, 'L', '42,9–52,5'], ['ecw_tbw', 'ECW/TBW', ecw, '', '0,36–0,39'],
    ['body_protein', 'Proteiini', prot, 'kg', '11,5–14,1'], ['body_minerals', 'Mineraalit', min, 'kg', '3,97–4,85'], ['bmr', 'Perusaineenvaihdunta', bmr, 'kcal'],
    ['waist_hip', 'Vyötärö-lantiosuhde', whr, '', '0,80–0,90'], ['phase_angle', 'Koko kehon vaihekulma', pa, '°'],
  ];
  const gym = 'Demo gym, Tampere';
  add({ date: '2024-09-10', lab: gym }, inbody(['88,9', '37,1', '24,6', '27,7', '27,1', '121', '64,3', '47,0', '0,384', '12,7', '4,41', '1745', '0,97', '5,7']));
  add({ date: '2025-09-16', lab: gym }, inbody(['90,1', '37,0', '25,9', '28,7', '27,5', '128', '64,2', '46,9', '0,385', '12,7', '4,40', '1742', '0,98', '5,6']));
  add({ date: '2026-04-21', lab: gym, note: 'After four months of gym training twice a week (demo).' }, [
    ...inbody(['86,2', '37,9', '21,4', '24,8', '26,3', '104', '64,8', '47,4', '0,382', '12,8', '4,46', '1770', '0,95', '5,9']),
    ['lean_arm_r', 'Oikean käden rasvaton massa', '3,6', 'kg', '3,3–4,4'], ['lean_arm_l', 'Vasemman käden rasvaton massa', '3,5', 'kg', '3,3–4,4'],
    ['lean_trunk', 'Keskivartalon rasvaton massa', '28,4', 'kg', '25,9–31,7'], ['lean_leg_r', 'Oikean jalan rasvaton massa', '9,8', 'kg', '9,0–11,0'],
    ['lean_leg_l', 'Vasemman jalan rasvaton massa', '9,9', 'kg', '9,0–11,0'], ['fat_trunk', 'Vartalon rasvamassa', '11,6', 'kg', '4,6–9,1'],
  ]);
  for (const [date, w, waist] of [['2025-01-06', '89,4', '100'], ['2025-06-15', '89,8', '101'], ['2026-01-04', '88,7', '99'], ['2026-07-02', '86,0', '97,5'], ['2026-09-28', '85,6', '97']]) {
    add({ date, lab: 'Own measurement', source: 'manual', note: 'Morning, before breakfast (demo).' }, [['weight', 'Weight', w, 'kg'], ['waist', 'Waist', waist, 'cm']]);
  }
}

// Made-up medicines, supplements and an allergy for the fictional man.
export function demoMeds() {
  const now = new Date().toISOString();
  return [
    { kind: 'allergy', name: 'Penicillin', reaction: 'Skin rash', severity: 'mild', start: '2004-07-01', note: 'As a child, after amoxicillin (demo).' },
    { kind: 'medicine', name: 'Atorvastatin', ingredient: 'atorvastatin', dose: '20 mg', schedule: '1 tablet in the evening', reason: 'cholesterol', start: '2026-06-01' },
    { kind: 'medicine', name: 'Retafer', ingredient: 'ferrous sulfate', dose: '100 mg', schedule: '1 tablet every other day', reason: 'low ferritin', start: '2026-05-25' },
    { kind: 'supplement', name: 'Vitamin D3', ingredient: 'colecalciferol', dose: '20 µg', schedule: '1 a day, October to April', reason: 'winter', start: '2025-10-15', stop: '2026-04-15' },
    { kind: 'supplement', name: 'Vitamin D3', ingredient: 'colecalciferol', dose: '20 µg', schedule: '1 a day, October to April', reason: 'winter', start: '2026-10-01' },
    { kind: 'medicine', name: 'Ibuprofen', ingredient: 'ibuprofen', dose: '400 mg', schedule: 'as needed', reason: 'flu', start: '2025-02-03', stop: '2025-02-09' },
  ].map((m) => ({ id: uid(), ingredient: '', dose: '', schedule: '', reason: '', start: '', stop: '', reaction: '', severity: '', note: '', ...m, demo: true, created: now }));
}

// Made-up illness diary and one reminder; the latest cold matches the watch data.
export function demoEvents(today = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = (n) => { const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const now = new Date().toISOString();
  return [
    { kind: 'illness', title: 'Cold', date: '2023-11-12', end: '2023-11-17', note: 'Sore throat, no fever (demo).' },
    { kind: 'travel', title: 'Trip to Thailand', date: '2024-01-10', end: '2024-01-24', note: '' },
    { kind: 'illness', title: 'Flu', date: '2025-02-03', end: '2025-02-10', note: 'Fever up to 38.9 °C, 4 days sick leave (demo).' },
    { kind: 'illness', title: 'Cold', date: day(-6), end: day(-2), note: 'Runny nose, tired (demo).' },
    { kind: 'reminder', title: 'Repeat ferritin', date: '2026-11-20', keys: ['ferritin'], done: '', note: 'Three months on iron.', created: '2026-05-25T09:00:00.000Z' },
  ].map((e) => ({ id: uid(), end: '', note: '', created: now, ...e, demo: true }));
}
