// Heart: ECG, long-term ECG and echocardiogram values, cardiology records and letters,
// with blood pressure and heart-related lab tests alongside.

import { h } from './dom.js';
import { state, riskNow } from './store.js';
import { SOURCES } from './knowledge.js';
import { REGIONS } from './score2.js';
import { fmtNum, fmtDate } from './format.js';
import { pageHead } from './ui.js';
import { findingItem, findingHref } from './insights.js';
import { bpFindings } from './bp-eval.js';
import { bpSummaryCard } from './bp.js';
import { metricRow, reportRow, isHeartRecord } from './views.js';

const GROUPS = [
  ['ECG', ['ecg_hr', 'pr', 'qrs', 'qt', 'qtc', 'qrs_axis']],
  ['Long-term ECG (Holter)', ['holter_hours', 'holter_hr_min', 'holter_hr_avg', 'holter_hr_max', 'pvc_count', 'pvc_pct', 'pac_count', 'pac_pct', 'af_burden', 'pause_max']],
  ['Echocardiogram', ['lvef', 'lvedd', 'ivsd', 'lavi']],
  ['Heart-related blood tests', ['ntprobnp', 'troponin', 'ldl', 'nonhdl_calc', 'lpa', 'trig', 'hba1c']],
];
const HEART_KEYS = new Set(GROUPS.flatMap(([, ks]) => ks));

export function viewHeart(root) {
  root.append(pageHead('Heart', { sub: 'ECG, long-term ECG, echocardiography, cardiology letters and related values',
    actions: [h('a', { class: 'btn', href: '#/add/ecg' }, '+ ECG'), h('a', { class: 'btn', href: '#/add/holter' }, '+ Holter'),
      h('a', { class: 'btn', href: '#/add/echo' }, '+ Echo'), h('a', { class: 'btn primary', href: '#/add/letter' }, '+ Letter')] }));

  const findings = state.findings.filter((f) => f.level !== 'good' && f.keys.some((k) => HEART_KEYS.has(k) && state.byMetric.get(k)?.m.cat === 'cardio'))
    .concat(bpFindings(state.bp).filter((f) => f.level === 'alert' || f.level === 'attention'));
  if (findings.length) {
    root.append(h('section', { class: 'card findings' }, h('h2', null, 'What this means'),
      findings.map((f) => findingItem(f, { link: findingHref(f) }))));
  }

  root.append(riskCard());

  const records = state.reports.filter(isHeartRecord).sort((a, b) => b.date.localeCompare(a.date));
  const groups = GROUPS.map(([title, keys]) => {
    const rows = keys.map((k) => state.byMetric.get(k)).filter(Boolean).map(metricRow);
    return rows.length ? h('section', { class: 'group' }, h('h2', null, title), h('div', { class: 'card list' }, rows)) : null;
  }).filter(Boolean);

  root.append(h('div', { class: 'split' },
    h('div', { class: 'stack' }, bpSummaryCard(),
      state.byMetric.size || state.measures.length ? h('a', { class: 'card hint-card', href: '#/fitness/night_hr' },
        h('div', { class: 'tile-label' }, 'Night-time heart rate and HRV'), h('span', { class: 'muted small' }, 'From your watch, on the Fitness page')) : null),
    h('section', { class: 'group' }, h('h2', null, `Heart records (${records.length})`), records.length
      ? h('div', { class: 'card list' }, records.map(reportRow))
      : h('div', { class: 'card empty' }, h('p', null, 'Add an ECG, a long-term ECG (Holter), an echocardiogram or a cardiologist’s letter. Attach the PDF or photo and let Claude read the values and write a short summary.')))));
  if (groups.length) root.append(h('div', { class: 'overview-grid' }, groups));
}

const REGION_NAME = Object.fromEntries(REGIONS);
const link = (id) => h('a', { href: SOURCES[id].url, target: '_blank', rel: 'noopener' }, SOURCES[id].short);

// SCORE2: the 10-year risk, its categories and the LDL goal that follows, or what's missing.
export function riskCard() {
  const a = riskNow();
  const box = h('section', { class: 'card risk-card' }, h('h2', null, '10-year heart risk (SCORE2)'));
  const srcLine = h('p', { class: 'muted small' }, 'Sources: ', link('score2'), ' · ', link('esc2021prev'), ' · ', link('esc2025'), ' · ', link('heartscore'));
  if (a.status === 'young') return box.append(h('p', null, 'SCORE2 is for people aged 40–69. Below 40 the 10-year risk is low for most people; lifetime risk matters more, and LDL, blood pressure and not smoking are what count.'), srcLine), box;
  if (a.status === 'old') return box.append(h('p', null, 'From 70, ESC uses SCORE2-OP, which this app doesn’t calculate yet. Ask your doctor for an estimate.'), srcLine), box;
  if (a.status === 'excluded') {
    box.append(h('p', null, a.reason === 'diabetes'
      ? `Your latest HbA1c (${fmtNum(Math.round(a.a1c.v))} mmol/mol, ${fmtDate(a.a1c.o.date)}) is in the diabetes range. SCORE2 isn’t meant for people with diabetes — ESC uses SCORE2-Diabetes, and a diagnosis needs a doctor.`
      : 'You marked a condition (heart or vascular disease, diabetes, kidney disease or familial hypercholesterolaemia) for which SCORE2 doesn’t apply: ESC puts people with these at high or very high risk directly. Your doctor sets your LDL goal.'), srcLine);
    return box;
  }
  if (a.status === 'missing') {
    box.append(h('p', null, 'SCORE2 estimates your risk of a heart attack or stroke in the next 10 years from age, sex, smoking, blood pressure and cholesterol. Still missing:'),
      h('ul', null, a.missing.map((m) => h('li', null, m))),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: '#/data' }, 'Profile'), h('a', { class: 'btn', href: '#/bp' }, 'Blood pressure')), srcLine);
    return box;
  }
  const i = a.inputs;
  box.append(
    h('div', { class: 'risk-head' },
      h('div', { class: 'hero-value' }, `${fmtNum(a.pct)} %`),
      h('div', null, h('div', { class: 'risk-cat' }, `${a.cat[0].toUpperCase()}${a.cat.slice(1)} risk`), h('div', { class: 'muted small' }, `LDL goal: < ${fmtNum(a.goal)} mmol/L${a.cat === 'high' || a.cat === 'very high' ? ' and −50 %' : ''} (ESC/EAS 2025)`))),
    h('p', null, `Estimated chance of a heart attack or stroke (fatal or not) within 10 years. ESC/EAS 2025 call under 2 % low, 2–10 % moderate, 10–20 % high and 20 % or more very high risk; the ESC 2021 prevention guideline, which uses age-specific cut-offs, calls it “${a.cat2021}” at ${a.age}.`),
    a.ldl ? h('p', null, a.ldl.v >= a.goal ? `Your latest LDL, ${fmtNum(a.ldl.v)} mmol/L (${fmtDate(a.ldl.o.date)}), is above that goal.` : `Your latest LDL, ${fmtNum(a.ldl.v)} mmol/L (${fmtDate(a.ldl.o.date)}), meets that goal.`) : null,
    a.notes.map((n) => h('p', { class: 'warn small' }, n)),
    h('details', null, h('summary', null, 'Values used'),
      h('ul', { class: 'small' },
        h('li', null, `Age ${i.age}, ${i.sex}, ${i.smoker ? 'smoker' : 'non-smoker'}`),
        h('li', null, `Systolic blood pressure ${Math.round(i.sbp)} mmHg — ${i.sbpFrom}`),
        h('li', null, `Total cholesterol ${fmtNum(i.tc)} and HDL ${fmtNum(i.hdl)} mmol/L (${fmtDate(i.tcDate)})`),
        h('li', null, `Risk region: ${REGION_NAME[i.region]} — change it in your profile`))),
    h('p', { class: 'muted small' }, 'For people without heart or vascular disease, diabetes, kidney disease or familial hypercholesterolaemia. A risk score is an estimate for a group of similar people, not a prediction for you.'),
    srcLine);
  return box;
}
