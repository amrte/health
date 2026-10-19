// Heart: ECG, long-term ECG and echocardiogram values, cardiology records and letters,
// with blood pressure and heart-related lab tests alongside.

import { h } from './dom.js';
import { state } from './store.js';
import { pageHead } from './ui.js';
import { findingItem } from './insights.js';
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
      findings.map((f) => findingItem(f, { link: f.kind === 'bp' ? '#/bp' : `#/test/${encodeURIComponent(f.keys[0])}` }))));
  }

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
