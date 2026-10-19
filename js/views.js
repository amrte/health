// Overview, test detail, report list and report detail screens.

import { h, go, toast } from './dom.js';
import { CATEGORIES, CATEGORY_NAME } from './metrics.js';
import { state, matches, metricSearchText, reportSearchText, reportPoints, deleteReport, findingsFor } from './store.js';
import { findingsCard, findingItem, aboutCard } from './insights.js';
import { discussButton } from './discuss.js';
import { searchResults, arrowKeys } from './search.js';
import { nextCheckup } from './dental.js';
import { leafSprig, greeting } from './leaves.js';
import { todayIso } from './format.js';
import { fitnessFindings } from './fitness-eval.js';
import { bpFindings } from './bp-eval.js';
import { fmtDate, fmtRange } from './format.js';
import { REPORT_TYPES, REPORT_TYPE_NAME } from './parse.js';
import { lineChart, sparkline } from './chart.js';
import { statusChip, valueText, pageHead, openFile, thumb } from './ui.js';
import { protectionGroups, protectionRow, vaccineSearchText, dueAdvice, dueAdviceRow } from './vaccines.js';

const enc = encodeURIComponent;
let overviewQuery = '';
let reportsQuery = '';
let showAllFindings = false;

function searchBox(value, placeholder, oninput) {
  return h('input', { type: 'search', class: 'search', placeholder, value, 'aria-label': placeholder,
    autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', oninput: (e) => oninput(e.target.value) });
}

function labOf(o) {
  return state.reportById.get(o.reportId)?.lab ?? '';
}

export function metricRow(entry) {
  const { m, pts, last } = entry;
  return h('a', { class: 'row', href: `#/test/${enc(m.key)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, m.name),
      h('div', { class: 'row-meta' }, fmtDate(last.o.date), pts.length > 1 ? ` · ${pts.length} results` : '')),
    sparkline(pts),
    h('div', { class: 'row-value' },
      h('div', { class: 'value' }, valueText(last, m.unit)),
      statusChip(last.status, { compact: true })));
}

function emptyState() {
  return h('section', { class: 'card empty' }, leafSprig('leaf-empty'),
    h('h2', null, 'No results yet'),
    h('p', null, 'Add a lab report: attach the photo or screenshot, let Claude read the values, check them, save. Every value you save shows up here with its trend.'),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn primary', href: '#/add' }, 'Add a lab report'),
      h('a', { class: 'btn', href: '#/data' }, 'Try with demo data')));
}

// Overview header: greeting, title and summary on a soft green banner with a leaf sprig.
function heroHead({ actions, sub }) {
  return h('header', { class: 'hero-banner' },
    leafSprig(),
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-greeting' }, greeting()),
      h('h1', null, 'Health records'),
      sub ? h('p', { class: 'sub' }, sub) : null),
    actions ? h('div', { class: 'actions' }, actions) : null);
}

export function viewOverview(root) {
  if (!state.obs.length && !state.vaccines.length && !state.measures.length && !state.workouts.length && !state.bp.length && !state.dental.length) {
    root.append(heroHead({}), emptyState());
    return;
  }
  const lastDate = state.reports.reduce((a, r) => (r.date > a ? r.date : a), '');
  const list = h('div', { class: 'overview-grid' });
  root.append(
    heroHead({ actions: [h('a', { class: 'btn primary', href: '#/add' }, '+ Lab report'), state.obs.length ? discussButton() : null], sub: [`${state.reports.length} reports · ${state.obs.length} results`, lastDate ? ` · last test ${fmtDate(lastDate)}` : '', state.vaccines.length ? ` · ${state.vaccines.length} vaccinations` : ''].join('') }),
    searchBox(overviewQuery, 'Search everything', (q) => { overviewQuery = q; render(); }),
    list);

  arrowKeys(root.querySelector('input.search'), list);
  function render() {
    // Typing in the box searches everything; the dashboard returns when it's empty.
    if (overviewQuery.trim()) { list.replaceChildren(searchResults(overviewQuery)); return; }
    const entries = [...state.byMetric.values()].filter((e) => matches(overviewQuery, metricSearchText(e)));
    const out = [];
    if (!overviewQuery) {
      // A guideline finding for a test already says it's out of range; skip the generic one.
      const strong = state.findings.filter((f) => (f.level === 'alert' || f.level === 'attention') && f.kind !== 'range');
      const important = state.findings.filter((f) => (f.level === 'alert' || f.level === 'attention') &&
        !(f.kind === 'range' && strong.some((g) => g.keys.includes(f.keys[0]))))
        .concat(fitnessFindings().filter((f) => f.level === 'alert' || f.level === 'attention'))
        .concat(bpFindings(state.bp).filter((f) => f.level === 'alert' || f.level === 'attention'))
        .sort((a, b) => (a.level === 'alert' ? 0 : 1) - (b.level === 'alert' ? 0 : 1));
      if (important.length) {
        const shown = showAllFindings ? important : important.slice(0, 4);
        out.push(h('section', { class: 'group wide' },
          h('h2', null, 'Findings'),
          h('div', { class: 'card findings' },
            shown.map((f) => findingItem(f, { link: f.kind === 'fitness' ? '#/fitness' : f.kind === 'bp' ? '#/bp' : `#/test/${enc(f.keys[0])}` })),
            important.length > shown.length
              ? h('button', { class: 'btn', type: 'button', onclick: () => { showAllFindings = true; render(); } }, `Show all ${important.length}`)
              : null)));
      }
      if (!state.profile.sex || !state.profile.birthYear) {
        out.push(h('a', { class: 'card hint-card wide', href: '#/data' },
          h('strong', null, 'Add your sex and birth year'),
          h('span', null, ' — some guideline limits (hemoglobin, HDL, ALT, kidney function) depend on them.')));
      }
    }
    const due = protectionGroups().filter((p) => p.status === 'overdue' || p.status === 'soon');
    // Schedule advice for diseases that don't already have a due date set by you.
    const dueTargets = new Set(due.flatMap((p) => p.last.targets ?? []));
    const sched = state.vaccines.length ? dueAdvice().filter((a) => !dueTargets.has(a.target)) : [];
    // Dental check-up: overdue, or within the next 30 days.
    const dent = nextCheckup();
    const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const dentRow = dent && dent.date <= soon ? h('a', { class: 'row', href: '#/teeth' }, h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, 'Dental check-up'),
      h('div', { class: 'row-meta' }, `Recommended at ${dent.visit.clinic || 'your last visit'} on ${fmtDate(dent.visit.date)}`),
      dent.date < todayIso()
        ? h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ` Overdue since ${fmtDate(dent.date)}`)
        : h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ` Due ${fmtDate(dent.date)}`))) : null;
    // Follow-ups from doctor letters: from 60 days overdue to 30 days ahead, unless a later record of the same specialty exists.
    const ago = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const follow = state.reports.filter((r) => r.followUp && r.followUp >= ago && r.followUp <= soon &&
      !state.reports.some((x) => x !== r && x.date > r.date && (x.specialty || '') === (r.specialty || '') && x.type === r.type))
      .map((r) => h('a', { class: 'row', href: `#/report/${enc(r.id)}` }, h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, `Follow-up${r.specialty ? ': ' + r.specialty : ''}`),
        h('div', { class: 'row-meta' }, `From ${REPORT_TYPE_NAME[r.type]?.toLowerCase() ?? 'record'} of ${fmtDate(r.date)}${r.doctor ? ' · ' + r.doctor : ''}`),
        r.followUp < todayIso()
          ? h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ` Was due ${fmtDate(r.followUp)}`)
          : h('span', { class: 'status st-soon' }, h('span', { class: 'status-icon' }, '●'), ` Due ${fmtDate(r.followUp)}`))));
    if ((due.length || sched.length || dentRow || follow.length) && !overviewQuery) {
      out.push(h('section', { class: 'group wide' },
        h('h2', null, 'Due and overdue'),
        h('div', { class: 'card list' }, follow, due.map(protectionRow), sched.map(dueAdviceRow), dentRow)));
    }
    const flagged = entries.filter((e) => e.last.status === 'high' || e.last.status === 'low');
    if (flagged.length && !overviewQuery) {
      out.push(h('section', { class: 'group wide' },
        h('h2', null, 'Out of range at last test'),
        h('div', { class: 'card list' }, flagged.map(metricRow))));
    }
    for (const [cat, title] of CATEGORIES) {
      const items = entries.filter((e) => e.m.cat === cat).sort((a, b) => a.m.name.localeCompare(b.m.name));
      if (items.length) out.push(h('section', { class: 'group' }, h('h2', null, title), h('div', { class: 'card list' }, items.map(metricRow))));
    }
    if (overviewQuery) {
      const reps = state.reports.filter((r) => matches(overviewQuery, reportSearchText(r))).sort((a, b) => b.date.localeCompare(a.date));
      if (reps.length) out.push(h('section', { class: 'group' }, h('h2', null, 'Reports'), h('div', { class: 'card list' }, reps.map(reportRow))));
      const vs = protectionGroups().filter((p) => matches(overviewQuery, p.names, vaccineSearchText(p.last)));
      if (vs.length) out.push(h('section', { class: 'group' }, h('h2', null, 'Vaccinations'), h('div', { class: 'card list' }, vs.map(protectionRow))));
    }
    if (!out.length) out.push(h('p', { class: 'muted pad' }, `Nothing matches “${overviewQuery}”.`));
    list.replaceChildren(...out);
  }
  render();
}

export function viewMetric(root, key) {
  const entry = state.byMetric.get(key);
  if (!entry) {
    root.append(pageHead('Not found', { back: '#/' }), h('p', { class: 'pad' }, 'No results for this test.'));
    return;
  }
  const { m, pts, last } = entry;
  const unit = m.unit;
  root.append(pageHead(m.name, { back: '#/', sub: CATEGORY_NAME[m.cat] + (m.custom ? ' · not in the test catalogue' : '') }));
  // Side by side on wide screens: latest value on the left, findings on the right.
  root.append(h('div', { class: 'split' },
    h('div', { class: 'stack' },
      h('section', { class: 'card hero' },
        h('div', { class: 'hero-label' }, 'Latest · ', fmtDate(last.o.date), labOf(last.o) ? ' · ' + labOf(last.o) : ''),
        h('div', { class: 'hero-value' }, valueText(last, unit)),
        statusChip(last.status)),
      h('div', { class: 'btn-row' }, discussButton(key))),
    findingsCard(findingsFor(key), { empty: m.custom ? null : 'No findings for this test.' })));

  const chartCard = h('section', { class: 'card' });
  root.append(chartCard);
  const chartPts = pts.map((p) => ({ ...p, lab: labOf(p.o) }));
  const info = lineChart(chartCard, { pts: chartPts, unit });
  const skipped = pts.filter((p) => p.unconvertible).length;
  chartCard.append(h('p', { class: 'caption' },
    info?.band ? `Shaded: reference range ${info.band} ${unit} from the latest report that gives one. ` : '',
    pts.some((p) => p.converted) ? `Values from labs using other units are converted to ${unit}. ` : '',
    skipped ? `${skipped} result(s) not charted: unit can't be converted.` : ''));

  root.append(h('section', { class: 'group' }, h('h2', null, 'All results'),
    h('div', { class: 'card table-wrap' }, h('table', { class: 'results' },
      h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Result'), h('th', null, 'Reference'))),
      h('tbody', null, [...pts].reverse().map((p) => h('tr', null,
        h('td', null,
          h('div', { class: 'nowrap' }, fmtDate(p.o.date)),
          h('a', { class: 'small', href: `#/report/${enc(p.o.reportId)}` }, labOf(p.o) || 'Report'),
          p.o.name && p.o.name !== m.name ? h('div', { class: 'muted small' }, p.o.name) : null),
        h('td', null,
          h('div', { class: 'value nowrap' }, valueText(p, unit)),
          p.converted || p.unconvertible ? h('div', { class: 'muted small' }, `printed ${p.o.valueRaw} ${p.o.unit}`) : null,
          statusChip(p.status, { compact: true })),
        h('td', { class: 'small' }, p.lo != null || p.hi != null ? fmtRange(p.lo, p.hi) : p.o.refRaw || '—')))))),
    h('p', { class: 'caption' }, `Results and reference ranges in ${unit || 'the printed unit'}.`)));
  root.append(aboutCard(key));
}

export function reportRow(r) {
  const pts = reportPoints(r.id);
  const out = pts.filter((p) => p.status === 'high' || p.status === 'low').length;
  const type = r.type && r.type !== 'lab' ? REPORT_TYPE_NAME[r.type] : '';
  return h('a', { class: 'row', href: `#/report/${enc(r.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, fmtDate(r.date), type ? h('span', { class: 'type-badge' }, type) : null),
      h('div', { class: 'row-meta' }, [r.lab, r.doctor, r.specialty].filter(Boolean).join(' · ') || 'No lab name', r.demo ? ' · demo' : ''),
      r.summary ? h('div', { class: 'row-meta' }, r.summary) : null),
    h('div', { class: 'row-value' },
      h('div', { class: 'small' }, pts.length ? `${pts.length} values` : '', r.files?.length ? ` · ${r.files.length} 📎` : ''),
      out ? h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ` ${out} out of range`) : null));
}

const HEART_TYPES = new Set(['ecg', 'holter', 'echo']);
export const isHeartRecord = (r) => HEART_TYPES.has(r.type) || /kardio|cardio|кардіо|кардио|sydän/i.test(r.specialty ?? '');
let reportsFilter = 'all';

export function viewReports(root) {
  const list = h('div', { class: 'card list' });
  root.append(pageHead('Records', { sub: 'Lab results, ECGs, echocardiograms and doctor letters',
    actions: [h('a', { class: 'btn', href: '#/add/letter' }, '+ Letter'), h('a', { class: 'btn primary', href: '#/add' }, '+ Lab report')] }));
  if (!state.reports.length) {
    root.append(emptyState());
    return;
  }
  const filters = [['all', 'All'], ['lab', 'Lab results'], ['heart', 'Heart'], ['letter', 'Letters']];
  const pills = h('div', { class: 'pills', role: 'group', 'aria-label': 'Show' });
  const renderPills = () => pills.replaceChildren(...filters.map(([k, label]) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(reportsFilter === k),
    onclick: () => { reportsFilter = k; renderPills(); render(); } }, label)));
  renderPills();
  root.append(searchBox(reportsQuery, 'Search labs, tests, doctors, diagnoses', (q) => { reportsQuery = q; render(); }), pills, list);
  function render() {
    const keep = (r) => reportsFilter === 'all' || (reportsFilter === 'heart' ? isHeartRecord(r) : reportsFilter === 'lab' ? (r.type ?? 'lab') === 'lab' : r.type === reportsFilter);
    const reps = state.reports.filter((r) => keep(r) && matches(reportsQuery, reportSearchText(r))).sort((a, b) => b.date.localeCompare(a.date));
    list.replaceChildren(...(reps.length ? reps.map(reportRow) : [h('p', { class: 'muted pad' }, 'No matching reports.')]));
  }
  render();
}

export async function viewReport(root, id) {
  const r = state.reportById.get(id);
  if (!r) {
    root.append(pageHead('Not found', { back: '#/reports' }));
    return;
  }
  const del = async () => {
    if (!confirm(`Delete the report from ${fmtDate(r.date)} with all its results and photos?`)) return;
    await deleteReport(id);
    toast('Report deleted');
    go('#/reports');
  };
  root.append(pageHead(fmtDate(r.date), {
    back: '#/reports',
    sub: r.lab || 'No lab name',
    actions: [h('a', { class: 'btn', href: `#/edit/${enc(id)}` }, 'Edit'), h('button', { class: 'btn danger', onclick: del }, 'Delete')],
  }));
  if (r.summary || r.conclusion || r.diagnoses?.length || r.recommendations?.length || r.medications?.length || r.followUp) {
    const list = (title, items) => (items?.length ? [h('h3', null, title), h('ul', { class: 'doc-list' }, items.map((x) => h('li', null, x)))] : []);
    root.append(h('section', { class: 'card doc' },
      h('h2', null, REPORT_TYPE_NAME[r.type] ?? 'Document', r.specialty ? ` · ${r.specialty}` : ''),
      r.doctor ? h('p', { class: 'muted small' }, r.doctor) : null,
      r.summary ? h('p', null, r.summary) : null,
      r.conclusion ? [h('h3', null, 'Conclusion as written'), h('p', { class: 'doc-quote' }, r.conclusion)] : null,
      list('Diagnoses', r.diagnoses), list('Recommendations', r.recommendations), list('Medications', r.medications),
      r.followUp ? h('p', null, h('strong', null, 'Follow-up: '), fmtDate(r.followUp)) : null,
      h('p', { class: 'muted small' }, 'Summaries made by Claude can contain mistakes — the original document attached below counts.')));
  }
  if (r.note) root.append(h('section', { class: 'card note' }, r.note));
  if (r.files?.length) {
    const grid = h('div', { class: 'thumbs' });
    root.append(h('section', { class: 'group' }, h('h2', null, 'Photos'), grid));
    for (const f of r.files) grid.append(await thumb(f.id, () => openFile(f.id)));
  }
  const pts = reportPoints(id);
  for (const [cat, title] of CATEGORIES) {
    const items = pts.filter((p) => p.m.cat === cat).sort((a, b) => a.m.name.localeCompare(b.m.name) || a.t - b.t);
    if (!items.length) continue;
    root.append(h('section', { class: 'group' }, h('h2', null, title), h('div', { class: 'card list' }, items.map((p) =>
      h('a', { class: 'row', href: `#/test/${enc(p.m.key)}` },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, p.m.name),
          h('div', { class: 'row-meta' },
            p.o.name && p.o.name !== p.m.name ? p.o.name + ' · ' : '',
            p.o.refRaw ? `ref ${p.o.refRaw}` : 'no reference range',
            p.o.date !== r.date ? ` · ${fmtDate(p.o.date)}` : '')),
        h('div', { class: 'row-value' },
          h('div', { class: 'value' }, `${p.o.valueRaw} ${p.o.unit}`.trim()),
          statusChip(p.status, { compact: true })))))));
  }
}
