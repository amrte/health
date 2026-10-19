// Values calculated from other results. Pure functions.

import { fmtNum } from './format.js';

// CKD-EPI 2021 creatinine equation (race-free; Inker et al., N Engl J Med 2021).
// Creatinine in µmol/L, age in years, sex 'female' | 'male'. Returns mL/min/1.73 m².
export function ckdEpi2021(creaUmol, age, sex) {
  if (!(creaUmol > 0) || !(age >= 18) || (sex !== 'female' && sex !== 'male')) return null;
  const scr = creaUmol / 88.42; // mg/dL
  const female = sex === 'female';
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  return 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

function synthetic(metric, src, value, unit) {
  return {
    id: `calc:${metric}:${src.o.id}`,
    reportId: src.o.reportId,
    date: src.o.date,
    metric,
    name: 'Calculated',
    valueRaw: fmtNum(value),
    unit,
    refRaw: '',
    flag: '',
    calculated: true,
  };
}

// Builds calculated observations from points already converted to canonical units.
// `series(key)` returns a metric's points; `profile` has sex, birthYear and height (cm).
export function calculatedObs(series, profile = {}) {
  const out = [];
  const hasLab = (key, date) => series(key).some((p) => p.o.date === date && p.v != null);

  if (profile.sex && profile.birthYear) {
    for (const p of series('crea')) {
      if (p.v == null || hasLab('egfr', p.o.date)) continue;
      const age = Number(p.o.date.slice(0, 4)) - profile.birthYear;
      const v = ckdEpi2021(p.v, age, profile.sex);
      if (v != null) out.push(synthetic('egfr_calc', p, Math.round(v), 'mL/min/1.73m²'));
    }
  }

  // BMI and waist-to-height ratio need a height: the profile's, else the latest measured one.
  const measured = series('height').filter((p) => p.v != null).at(-1)?.v;
  const height = Number(profile.height) || measured;
  if (height >= 100 && height <= 250) {
    const m = height / 100;
    for (const p of series('weight')) {
      if (p.v == null || hasLab('bmi', p.o.date)) continue;
      out.push(synthetic('bmi_calc', p, Math.round((p.v / (m * m)) * 10) / 10, 'kg/m²'));
    }
    for (const p of series('waist')) {
      if (p.v != null) out.push(synthetic('whtr_calc', p, Math.round((p.v / height) * 100) / 100, ''));
    }
  }

  const hdl = series('hdl');
  for (const p of series('chol')) {
    if (p.v == null || hasLab('nonhdl', p.o.date)) continue;
    const h = hdl.find((q) => q.o.date === p.o.date && q.v != null);
    if (h) out.push(synthetic('nonhdl_calc', p, Math.round((p.v - h.v) * 10) / 10, 'mmol/L'));
  }
  return out;
}
