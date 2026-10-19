// Blood pressure evaluation against ESC 2024 (home and office categories), ESH 2023
// grades and the AHA advice for very high readings. Checked 2026-10; rules whose
// source couldn't be confirmed (e.g. discarding the first day of home readings)
// are deliberately not used.

import { fmtDate } from './format.js';

// Home-measurement limit for hypertension (ESC 2024: ≥135/85, equivalent to office ≥140/90).
export const BP_LINES = [{ v: 135, label: '135' }, { v: 85, label: '85' }];

const F = (level, title, text, sources) => ({ keys: ['bp'], kind: 'bp', level, title, text, sources });

// ESC 2024 Table 5. Category follows the higher of systolic and diastolic.
export function escCategory(sys, dia, place) {
  const [hs, hd] = place === 'clinic' ? [140, 90] : [135, 85];
  if (sys >= hs || dia >= hd) return 'hypertension';
  if (sys >= 120 || dia >= 70) return 'elevated';
  return 'non-elevated';
}

// ESH 2023 office grades (only meaningful for office readings).
export function eshGrade(sys, dia) {
  if (sys >= 140 && dia < 90) return `isolated systolic hypertension, grade ${sys >= 180 ? 3 : sys >= 160 ? 2 : 1}`;
  if (sys >= 180 || dia >= 110) return 'grade 3';
  if (sys >= 160 || dia >= 100) return 'grade 2';
  if (sys >= 140 || dia >= 90) return 'grade 1';
  if (sys >= 130 || dia >= 85) return 'high-normal';
  return null;
}

// Average of home readings in the 7 days up to the latest home reading.
// Valid when they cover at least 3 days (ESC 2024: at least 3, ideally 7 days).
export function homeAverage(readings) {
  const home = readings.filter((r) => r.place !== 'clinic').sort((a, b) => a.time.localeCompare(b.time));
  if (!home.length) return null;
  const end = Date.parse(home[home.length - 1].time.slice(0, 10));
  const win = home.filter((r) => Date.parse(r.time.slice(0, 10)) > end - 7 * 864e5);
  const days = new Set(win.map((r) => r.time.slice(0, 10))).size;
  return {
    sys: win.reduce((a, r) => a + r.sys, 0) / win.length,
    dia: win.reduce((a, r) => a + r.dia, 0) / win.length,
    n: win.length,
    days,
    from: win[0].time.slice(0, 10),
    to: win[win.length - 1].time.slice(0, 10),
    valid: days >= 3,
  };
}

export function bpFindings(readings, now = Date.now()) {
  const out = [];
  if (!readings.length) return out;

  const recent = readings.filter((r) => now - Date.parse(r.time) < 30 * 864e5);
  const veryHigh = recent.filter((r) => r.sys >= 180 || r.dia >= 110).sort((a, b) => b.time.localeCompare(a.time));
  if (veryHigh.length) {
    const r = veryHigh[0];
    out.push(F('alert', `Very high reading: ${r.sys}/${r.dia} mmHg`,
      `On ${fmtDate(r.time.slice(0, 10))}. ESC 2024 recommends assessment for a hypertensive emergency at 180/110 mmHg or more. ` +
      'The American Heart Association advises: re-measure after about 5 minutes; if it stays above 180/120 and you have chest pain, shortness of breath, back pain, numbness, weakness, a change in vision or difficulty speaking, call emergency services. Without such symptoms, contact your doctor.',
      ['esc2024bp', 'aha_bp']));
  }

  const avg = homeAverage(readings);
  if (avg && now - Date.parse(avg.to) < 60 * 864e5) {
    const s = Math.round(avg.sys);
    const d = Math.round(avg.dia);
    const span = `${avg.n} home readings over ${avg.days} day${avg.days === 1 ? '' : 's'} (${fmtDate(avg.from)} – ${fmtDate(avg.to)})`;
    if (!avg.valid) {
      out.push(F('info', 'Not enough home readings for an average yet',
        `${span}. ESC recommends measuring twice in the morning and twice in the evening (1–2 minutes apart, after 5 minutes of seated rest) for at least 3 days, ideally 7, and averaging them.`, ['esc2024bp']));
    } else {
      const cat = escCategory(avg.sys, avg.dia, 'home');
      if (cat === 'hypertension') out.push(F('attention', `Home average ${s}/${d}: hypertension range`, `${span}. ESC 2024 counts a home average of 135/85 or more as hypertension (equivalent to 140/90 at the doctor’s office). Worth discussing with your doctor.`, ['esc2024bp']));
      else if (cat === 'elevated') out.push(F('info', `Home average ${s}/${d}: elevated`, `${span}. ESC 2024 calls home values of 120–134 systolic or 70–84 diastolic “elevated” — below hypertension, but where lifestyle measures and, depending on overall risk, treatment are considered.`, ['esc2024bp']));
      else out.push(F('good', `Home average ${s}/${d}: not elevated`, `${span}. Below 120/70, which ESC 2024 calls non-elevated.`, ['esc2024bp']));
    }
  }

  const clinic = readings.filter((r) => r.place === 'clinic').sort((a, b) => b.time.localeCompare(a.time))[0];
  if (clinic && now - Date.parse(clinic.time) < 365 * 864e5) {
    const cat = escCategory(clinic.sys, clinic.dia, 'clinic');
    const grade = eshGrade(clinic.sys, clinic.dia);
    if (cat !== 'non-elevated') {
      out.push(F(cat === 'hypertension' ? 'attention' : 'info', `Office reading ${clinic.sys}/${clinic.dia}: ${cat}`,
        `Measured at a doctor’s office on ${fmtDate(clinic.time.slice(0, 10))}. ESC 2024: 120–139/70–89 is elevated, 140/90 or more is hypertension${grade ? `; ESH 2023 classifies it as ${grade}` : ''}. A diagnosis rests on repeated or out-of-office measurements, not one reading.`,
        grade ? ['esc2024bp', 'esh2023'] : ['esc2024bp']));
    }
  }
  return out;
}
