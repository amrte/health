// One-page summary for a doctor's visit: allergies, current medicines, diagnoses,
// recent results with trends, blood pressure, heart risk, vaccinations and
// recent illnesses. Printed (or saved as PDF) with the browser's print dialog.

import { h } from './dom.js';
import { state, riskNow } from './store.js';
import { pageHead, statusLabel } from './ui.js';
import { fmtNum, fmtDate, todayIso, fmtRange } from './format.js';
import { sparkline } from './chart.js';
import { isCurrent } from './meds-data.js';
import { homeAverage } from './bp-eval.js';
import { protectionGroups } from './vaccines.js';
import { EVENT_NAME } from './timeline.js';
import { CATEGORIES, BODY_MAIN } from './metrics.js';

const DAY = 864e5;
// Tests that belong on a summary whenever they exist.
export const KEY_TESTS = ['hb', 'wbc', 'plt', 'glucose', 'hba1c', 'chol', 'ldl', 'hdl', 'trig', 'nonhdl_calc', 'crea', 'egfr', 'egfr_calc', 'alt', 'ggt',
  'tsh', 'ft4', 'ferritin', 'b12', 'vitd', 'crp', 'k', 'na', 'ntprobnp', 'weight', 'bmi', 'bmi_calc', 'waist'];

// Diagnoses from doctor letters, newest first, each listed once.
// Blood group and Rh factor, if a report had them (stored as own tests).
const BLOOD_GROUP = /група крові|группа крови|blood group|blood type|blutgruppe|veriryhmä/i;
const RHESUS = /резус|rhesus|rh[ -]?(factor|faktor|tekijä)|^rh\b/i;
export function bloodGroup(obs) {
  const latest = (re) => obs.filter((o) => re.test(o.name ?? '')).sort((a, b) => b.date.localeCompare(a.date))[0]?.valueRaw ?? '';
  const g = latest(BLOOD_GROUP).replace(/\s+/g, ' ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
  const rhRaw = latest(RHESUS);
  // Positive words first: "Rh-positiv" has a hyphen too.
  const rh = /pos|\+|пол|поз/i.test(rhRaw) ? 'Rh+' : /neg|-|−|від|отр|ei /i.test(rhRaw) ? 'Rh−' : '';
  return [g, rh].filter(Boolean).join(' ');
}

export function diagnosesFrom(reports) {
  const seen = new Set();
  const out = [];
  for (const r of [...reports].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const d of r.diagnoses ?? []) {
      const k = d.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ text: d.trim(), date: r.date, by: r.specialty || r.doctor || r.lab || '' });
    }
  }
  return out;
}

// Latest value, previous values and direction for the tests on the summary.
// mode 'key': out-of-range ones plus KEY_TESTS; 'all': every test. Only tests
// measured within `years`.
export function summaryTests(byMetric, { mode = 'key', years = 2, today = todayIso() } = {}) {
  const since = Date.parse(today) - years * 365.25 * DAY;
  const order = Object.fromEntries(CATEGORIES.map(([c], i) => [c, i]));
  return [...byMetric.values()]
    // Heart-test and body-composition details stay on their pages; the main ones are kept.
    .filter((e) => e.last.t >= since && (e.m.cat !== 'cardio' || e.m.key === 'ntprobnp') && (e.m.cat !== 'body' || BODY_MAIN.includes(e.m.key)))
    .filter((e) => mode === 'all' || KEY_TESTS.includes(e.m.key) || e.last.status === 'high' || e.last.status === 'low' || e.last.status === 'abnormal')
    // Measured or calculated BMI / eGFR: only the newer one.
    .filter((e) => {
      const twin = { bmi: 'bmi_calc', bmi_calc: 'bmi', egfr: 'egfr_calc', egfr_calc: 'egfr' }[e.m.key];
      const other = twin && byMetric.get(twin);
      return !other || other.last.t < e.last.t || (other.last.t === e.last.t && !e.m.derived);
    })
    .map((e) => {
      const num = e.pts.filter((p) => p.v != null);
      const last = e.last;
      const prev = num.filter((p) => p.t < last.t).slice(-3).reverse();
      let trend = '';
      if (prev.length && last.v != null) {
        const ch = (last.v - prev[0].v) / (Math.abs(prev[0].v) || 1);
        trend = ch > 0.05 ? '↑' : ch < -0.05 ? '↓' : '→';
      }
      return { e, last, prev, trend, pts: num };
    })
    .sort((a, b) => (order[a.e.m.cat] ?? 99) - (order[b.e.m.cat] ?? 99) || a.e.m.name.localeCompare(b.e.m.name));
}

const opts = { mode: 'key', name: '', questions: '', findings: true, vaccines: true, illnesses: true };

const short = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const val = (p, unit) => `${p.qualifier ?? ''}${p.v != null ? fmtNum(p.v) : p.text || p.o.valueRaw}${unit ? ` ${unit}` : ''}`;
const section = (title, ...body) => h('section', { class: 'ps-sec' }, h('h3', null, title), ...body);
const none = (text) => h('p', { class: 'ps-none' }, text);

function sheet() {
  const today = todayIso();
  const p = state.profile;
  const age = p.birthYear ? Number(today.slice(0, 4)) - p.birthYear : null;
  const weight = state.byMetric.get('weight')?.last;
  const allergies = state.meds.filter((m) => m.kind === 'allergy');
  const current = state.meds.filter((m) => isCurrent(m, today)).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const stoppedRecently = state.meds.filter((m) => m.kind !== 'allergy' && m.stop && m.stop < today && Date.parse(today) - Date.parse(m.stop) < 365 * DAY);
  const diags = diagnosesFrom(state.reports);
  const tests = summaryTests(state.byMetric, { mode: opts.mode, today });
  const avg = homeAverage(state.bp);
  const office = [...state.bp].filter((r) => r.place === 'clinic').sort((a, b) => b.time.localeCompare(a.time))[0];
  const risk = riskNow();
  const illnesses = state.events.filter((e) => EVENT_NAME[e.kind] && e.kind !== 'travel' && e.kind !== 'life' && e.kind !== 'note'
    && (e.kind === 'surgery' || e.kind === 'hospital' || Date.parse(today) - Date.parse(e.date) < 365 * DAY)).sort((a, b) => b.date.localeCompare(a.date));
  const findings = state.findings.filter((f) => f.level === 'alert' || f.level === 'attention').slice(0, 6);

  return h('article', { class: 'print-sheet' },
    h('header', { class: 'ps-head' },
      h('div', null, h('h2', null, 'Health summary'), opts.name ? h('div', { class: 'ps-name' }, opts.name) : null,
        h('div', { class: 'ps-dim' }, 'Compiled by the patient from personal records. Values and ranges as printed by the labs (units converted where needed); the original reports count.')),
      h('div', { class: 'ps-meta' },
        [p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : '', age != null ? `${age} years (born ${p.birthYear})` : '', p.height ? `${fmtNum(p.height)} cm` : '',
          weight ? `${fmtNum(weight.v)} kg (${fmtDate(weight.o.date)})` : '', p.smoker === 'yes' ? 'smoker' : p.smoker === 'no' ? 'non-smoker' : '',
          bloodGroup(state.obs) ? `blood group ${bloodGroup(state.obs)}` : ''].filter(Boolean).join(' · '),
        h('div', null, `Printed ${fmtDate(today)}`))),
    h('div', { class: 'ps-grid' },
      h('div', null,
        section('Allergies and intolerances', allergies.length
          ? h('ul', null, allergies.map((a) => h('li', null, h('strong', null, a.name), a.reaction ? ` — ${a.reaction}` : '', a.severity ? ` (${a.severity})` : '')))
          : none('None recorded')),
        section('Current medicines and supplements', current.length
          ? h('ul', null, current.map((m) => h('li', null, h('strong', null, m.name), [m.dose, m.schedule].filter(Boolean).length ? ` ${[m.dose, m.schedule].filter(Boolean).join(', ')}` : '',
            m.reason ? ` — ${m.reason}` : '', m.start ? h('span', { class: 'ps-dim' }, ` since ${fmtDate(m.start)}`) : '')))
          : none('None recorded'),
          stoppedRecently.length ? h('p', { class: 'ps-dim' }, 'Stopped in the last year: ', stoppedRecently.map((m) => `${m.name} (${fmtDate(m.stop)})`).join(', ')) : null),
        section('Diagnoses (from doctor letters)', diags.length
          ? h('ul', null, diags.slice(0, 8).map((d) => h('li', null, d.text, h('span', { class: 'ps-dim' }, ` — ${fmtDate(d.date)}${d.by ? `, ${d.by}` : ''}`))))
          : none('None recorded')),
        opts.illnesses && illnesses.length ? section('Illnesses (last 12 months), surgeries and hospital stays',
          h('ul', null, illnesses.slice(0, 8).map((e) => h('li', null, e.title || EVENT_NAME[e.kind], h('span', { class: 'ps-dim' }, ` — ${fmtDate(e.date)}${e.end && e.end !== e.date ? `–${fmtDate(e.end)}` : ''}`))))) : null),
      h('div', null,
        section('Blood pressure', avg || office ? h('ul', null,
          avg ? h('li', null, `Home average ${Math.round(avg.sys)}/${Math.round(avg.dia)} mmHg`, h('span', { class: 'ps-dim' }, ` — ${avg.n} readings, ${fmtDate(avg.from)}–${fmtDate(avg.to)}`)) : null,
          office ? h('li', null, `Last office reading ${office.sys}/${office.dia} mmHg`, h('span', { class: 'ps-dim' }, ` — ${fmtDate(office.time.slice(0, 10))}`)) : null) : none('No readings')),
        risk.status === 'ok' ? section('10-year cardiovascular risk',
          h('p', null, `SCORE2 ${fmtNum(risk.pct)} % — ${risk.cat} risk (ESC/EAS 2025), LDL goal < ${fmtNum(risk.goal)} mmol/L.`, h('span', { class: 'ps-dim' }, ` Region: ${risk.inputs.region.replace('_', ' ')}. Estimated by the app.`))) : null,
        opts.vaccines && state.vaccines.length ? section('Vaccinations (latest)',
          h('ul', { class: 'ps-compact' }, protectionGroups().slice(0, 10).map((g) => h('li', null, `${g.names.join(', ')}: ${fmtDate(g.last.date)}`, g.due ? h('span', { class: 'ps-dim' }, `, next ${fmtDate(g.due)}`) : '')))) : null,
        opts.findings && findings.length ? section('Flagged by the app (guideline rules)',
          h('ul', { class: 'ps-compact' }, findings.map((f) => h('li', null, f.title)))) : null)),
    h('section', { class: 'ps-sec ps-results' }, h('h3', null, `Results${opts.mode === 'key' ? ' — main tests and anything out of range, last 2 years' : ' — last 2 years'}`), tests.length
      ? h('table', { class: 'ps-table' },
        h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', null, 'Latest'), h('th', null, 'Reference'), h('th', null, 'Trend'), h('th', null, 'Earlier'))),
        h('tbody', null, tests.map(({ e, last, prev, trend, pts }) => h('tr', { class: ['high', 'low', 'abnormal'].includes(last.status) ? 'ps-out' : null },
          h('td', null, e.m.name),
          h('td', { class: 'ps-latest' }, h('strong', null, val(last, e.m.unit)), ['high', 'low', 'abnormal'].includes(last.status) ? ` ${statusLabel(last.status)}` : '', h('span', { class: 'ps-dim' }, ` · ${short(last.o.date)}`)),
          h('td', { class: 'ps-dim' }, last.lo != null || last.hi != null ? fmtRange(last.lo, last.hi) : last.o.refRaw || '—'),
          h('td', { class: 'ps-trend' }, pts.length > 1 ? sparkline(pts) : null, trend ? h('span', null, ` ${trend}`) : null),
          h('td', { class: 'ps-dim' }, prev.slice(0, 2).map((q) => `${fmtNum(+q.v.toFixed(2))} (${short(q.o.date)})`).join(', ') || '—')))))
      : none('No results in the last 2 years')),
    opts.questions.trim() ? section('Questions for today', h('p', { class: 'ps-questions' }, opts.questions.trim())) : null);
}

export function viewPrint(root) {
  root.append(pageHead('Summary for the doctor', { back: '#/', sub: 'One page to print or save as PDF for your next appointment' }));
  const host = h('div', { class: 'print-host' });
  const render = () => host.replaceChildren(sheet());
  const check = (label, key) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: opts[key], onchange: (e) => { opts[key] = e.target.checked; render(); } }), label);
  root.append(h('section', { class: 'card form no-print' },
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Name on the page (optional, not saved)'), h('input', { type: 'text', value: opts.name, autocomplete: 'name', oninput: (e) => { opts.name = e.target.value; render(); } })),
      h('label', null, h('span', null, 'Results'), h('select', { value: opts.mode, onchange: (e) => { opts.mode = e.target.value; render(); } },
        h('option', { value: 'key' }, 'Main + out of range'), h('option', { value: 'all' }, 'All, last 2 years')))),
    h('label', null, h('span', null, 'Questions for today (printed at the bottom)'),
      h('textarea', { rows: 2, value: opts.questions, placeholder: 'e.g. Should I keep taking iron? When should TSH be repeated?', oninput: (e) => { opts.questions = e.target.value; render(); } })),
    h('div', { class: 'checks-row' }, check('Vaccinations', 'vaccines'), check('Illnesses and surgeries', 'illnesses'), check('What the app flagged', 'findings')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => window.print() }, 'Print or save as PDF'),
      h('span', { class: 'muted small' }, 'On iPhone: Print → pinch the preview to share it as a PDF.'))));
  root.append(host);
  render();
}
