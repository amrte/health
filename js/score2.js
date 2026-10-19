// SCORE2: 10-year risk of fatal and non-fatal cardiovascular disease for apparently
// healthy people aged 40–69 (SCORE2 working group and ESC Cardiovascular Risk
// Collaboration, Eur Heart J 2021;42:2439). Coefficients and recalibration scales
// as published to four decimals (Eur Heart J 2022;43:241); they reproduce the
// paper's worked examples. SCORE2-OP (70+) is not calculated here.
// Pure functions.

const COEF = {
  male: { age: 0.3742, smoking: 0.6012, sbp: 0.2777, diabetes: 0.6457, tc: 0.1458, hdl: -0.2698,
    ageSmoking: -0.0755, ageSbp: -0.0255, ageTc: -0.0281, ageHdl: 0.0426, ageDiabetes: -0.0983, s0: 0.9605 },
  female: { age: 0.4648, smoking: 0.7744, sbp: 0.3131, diabetes: 0.8096, tc: 0.1002, hdl: -0.2606,
    ageSmoking: -0.1088, ageSbp: -0.0277, ageTc: -0.0226, ageHdl: 0.0613, ageDiabetes: -0.1272, s0: 0.9776 },
};

// Recalibration to the four ESC risk regions: [scale1, scale2].
const SCALES = {
  male: { low: [-0.5699, 0.7476], moderate: [-0.1565, 0.8009], high: [0.3207, 0.9360], very_high: [0.5836, 0.8294] },
  female: { low: [-0.7380, 0.7019], moderate: [-0.3143, 0.7701], high: [0.5710, 0.9369], very_high: [0.9412, 0.8329] },
};

// ESC risk regions (HeartScore). Finland and Germany are "moderate" in SCORE2 —
// not "low" as in the old SCORE charts.
export const REGIONS = [['low', 'Low risk region'], ['moderate', 'Moderate (e.g. Finland, Germany)'], ['high', 'High risk region'], ['very_high', 'Very high (e.g. Ukraine)']];

// 10-year risk as a fraction, or null outside ages 40–69 or with missing inputs.
// tc and hdl in mmol/L, sbp in mmHg.
export function score2({ age, sex, smoker, sbp, tc, hdl, region = 'moderate' }) {
  const b = COEF[sex];
  if (!b || !(age >= 40 && age < 70) || ![sbp, tc, hdl].every((x) => Number.isFinite(x) && x > 0)) return null;
  const cage = (age - 60) / 5;
  const csbp = (sbp - 120) / 20;
  const ctc = tc - 6;
  const chdl = (hdl - 1.3) / 0.5;
  const sm = smoker ? 1 : 0;
  const lp = b.age * cage + b.smoking * sm + b.sbp * csbp + b.tc * ctc + b.hdl * chdl
    + b.ageSmoking * cage * sm + b.ageSbp * cage * csbp + b.ageTc * cage * ctc + b.ageHdl * cage * chdl;
  const raw = 1 - b.s0 ** Math.exp(lp);
  const [s1, s2] = SCALES[sex][region] ?? SCALES[sex].moderate;
  return 1 - Math.exp(-Math.exp(s1 + s2 * Math.log(-Math.log(1 - raw))));
}

// ESC 2021 prevention guideline: age-specific categories for apparently healthy people.
export function category2021(age, pct) {
  const [a, b] = age < 50 ? [2.5, 7.5] : [5, 10];
  return pct < a ? 'low to moderate' : pct < b ? 'high' : 'very high';
}

// ESC/EAS 2025 dyslipidaemia update: categories (not age-specific) and their LDL goals.
export function category2025(pct) {
  if (pct < 2) return { cat: 'low', goal: 3.0 };
  if (pct < 10) return { cat: 'moderate', goal: 2.6 };
  if (pct < 20) return { cat: 'high', goal: 1.8 };
  return { cat: 'very high', goal: 1.4 };
}

// ---- applied to the stored data ----------------------------------------------------

const YEAR = 365.25 * 864e5;
const latestPt = (byMetric, key) => (byMetric.get(key)?.pts ?? []).filter((p) => p.v != null).at(-1) ?? null;

// Everything needed to show the score: inputs used, what's missing, why it doesn't
// apply, the risk and its categories. `homeAvg` (home BP average) and `statinOn(date)`
// (was a statin taken that day?) come from callers.
export function assessRisk({ profile = {}, byMetric, bp = [], homeAvg = null, statinOn = () => false, today }) {
  const out = { missing: [], notes: [], inputs: {} };
  const now = Date.parse(today);
  const age = profile.birthYear ? Number(today.slice(0, 4)) - profile.birthYear : null;
  if (!profile.sex) out.missing.push('sex');
  if (age == null) out.missing.push('birth year');
  if (profile.smoker !== 'yes' && profile.smoker !== 'no') out.missing.push('smoking (in your profile)');
  if (age != null && age < 40) return { ...out, status: 'young', age };
  if (age != null && age >= 70) return { ...out, status: 'old', age };
  if (profile.highRiskCondition) return { ...out, status: 'excluded', age, reason: 'condition' };
  const a1c = latestPt(byMetric, 'hba1c');
  if (a1c && a1c.v >= 48) return { ...out, status: 'excluded', age, reason: 'diabetes', a1c };

  const tc = latestPt(byMetric, 'chol');
  const hdl = tc && (byMetric.get('hdl')?.pts ?? []).filter((p) => p.v != null && Math.abs(p.t - tc.t) <= 30 * 864e5).at(-1);
  if (!tc) out.missing.push('total cholesterol');
  if (!hdl) out.missing.push('HDL cholesterol (from the same blood test)');
  const clinic = bp.filter((r) => r.place === 'clinic' && now - Date.parse(r.time.slice(0, 10)) <= 2 * YEAR).sort((x, y) => x.time.localeCompare(y.time)).slice(-3);
  let sbp = null;
  if (clinic.length) {
    sbp = clinic.reduce((s, r) => s + r.sys, 0) / clinic.length;
    out.inputs.sbpFrom = `average of your last ${clinic.length} reading${clinic.length > 1 ? 's' : ''} at a doctor’s office`;
  } else if (homeAvg?.valid) {
    sbp = homeAvg.sys;
    out.inputs.sbpFrom = 'your home blood pressure average (SCORE2 was built on office readings, which tend to be a little higher)';
  } else out.missing.push('blood pressure (an office reading, or home readings on 3 days)');
  if (out.missing.length) return { ...out, status: 'missing', age };

  Object.assign(out.inputs, { age, sex: profile.sex, smoker: profile.smoker === 'yes', sbp, tc: tc.v, hdl: hdl.v, tcDate: tc.o.date, region: profile.riskRegion || 'moderate' });
  if (now - tc.t > 2 * YEAR) out.notes.push(`Your latest cholesterol is from ${tc.o.date.slice(0, 4)}; a new test gives a more current estimate.`);
  if (statinOn(tc.o.date)) out.notes.push('Your cholesterol was measured while taking a statin, so the score shows your risk on treatment, not without it.');
  const ldl = latestPt(byMetric, 'ldl');
  if (tc.v > 8 || (ldl && ldl.v > 4.9) || sbp >= 180) out.notes.push('One risk factor is markedly raised on its own (cholesterol above 8 mmol/L, LDL above 4.9 mmol/L or blood pressure from 180): ESC/EAS count this as at least high risk, whatever the score.');
  const risk = score2({ ...out.inputs });
  const pct = Math.round(risk * 1000) / 10;
  return { ...out, status: 'ok', age, risk, pct, cat2021: category2021(age, pct), ...category2025(pct), ldl };
}

// Finding for the LDL page and the overview: the LDL goal that applies to you.
export function riskFindings(a) {
  if (a.status !== 'ok') return [];
  const src = ['score2', 'esc2025'];
  const head = `SCORE2 ${a.pct.toLocaleString('en', { maximumFractionDigits: 1 })} % (${a.cat} risk)`;
  if (!a.ldl) return [{ keys: [], kind: 'risk', level: a.cat === 'high' || a.cat === 'very high' ? 'attention' : 'info', title: `10-year heart risk: ${head}`,
    text: `ESC/EAS 2025 set an LDL goal of < ${a.goal} mmol/L at ${a.cat} risk. Add an LDL result to compare.`, sources: src }];
  const over = a.ldl.v >= a.goal;
  return [{ keys: ['ldl'], kind: 'risk', level: over ? (a.cat === 'high' || a.cat === 'very high' ? 'attention' : 'info') : 'good',
    title: over ? `LDL above your goal: ${head}` : `LDL meets your goal: ${head}`,
    text: `Your estimated 10-year risk of heart attack or stroke is ${head.slice(7)}. For ${a.cat} risk, ESC/EAS 2025 set an LDL goal of < ${a.goal} mmol/L${a.cat === 'high' || a.cat === 'very high' ? ' and a reduction of at least 50 %' : ''}; your latest LDL is ${a.ldl.v.toLocaleString('en', { maximumFractionDigits: 1 })} mmol/L.` +
      (over ? ' Lifestyle comes first; whether medicine is needed is a decision to make with a doctor.' : '') + (a.notes.length ? ` ${a.notes[0]}` : ''),
    sources: src }];
}
