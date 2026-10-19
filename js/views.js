// Overview, test detail, report list and report detail screens.

import { h, go, toast } from './dom.js';
import { CATEGORIES, CATEGORY_NAME } from './metrics.js';
import { state, matches, metricSearchText, reportSearchText, reportPoints, deleteReport, findingsFor } from './store.js';
import { findingsCard, findingItem, aboutCard } from './insights.js';
import { discussButton } from './discuss.js';
import { fitnessFindings } from './fitness-eval.js';
import { bpFindings } from './bp-eval.js';
import { fmtDate, fmtRange } from './format.js';
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

function metricRow(entry) {
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
  return h('section', { class: 'card empty' },
    h('h2', null, 'No results yet'),
    h('p', null, 'Add a lab report: attach the photo or screenshot, let Claude read the values, check them, save. Every value you save shows up here with its trend.'),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn primary', href: '#/add' }, 'Add a lab report'),
      h('a', { class: 'btn', href: '#/data' }, 'Try with demo data')));
}

export function viewOverview(root) {
  if (!state.obs.length && !state.vaccines.length && !state.measures.length && !state.workouts.length && !state.bp.length) {
    root.append(pageHead('Health records'), emptyState());
    return;
  }
  const lastDate = state.reports.reduce((a, r) => (r.date > a ? r.date : a), '');
  const list = h('div');
  root.append(
    pageHead('Health records', { actions: [h('a', { class: 'btn primary', href: '#/add' }, '+ Lab report'), state.obs.length ? discussButton() : null], sub: [`${state.reports.length} reports · ${state.obs.length} results`, lastDate ? ` · last test ${fmtDate(lastDate)}` : '', state.vaccines.length ? ` · ${state.vaccines.length} vaccinations` : ''].join('') }),
    searchBox(overviewQuery, 'Search tests, labs, notes', (q) => { overviewQuery = q; render(); }),
    list);

  function render() {
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
        out.push(h('section', { class: 'group' },
          h('h2', null, 'Findings'),
          h('div', { class: 'card findings' },
            shown.map((f) => findingItem(f, { link: f.kind === 'fitness' ? '#/fitness' : f.kind === 'bp' ? '#/bp' : `#/test/${enc(f.keys[0])}` })),
            important.length > shown.length
              ? h('button', { class: 'btn', type: 'button', onclick: () => { showAllFindings = true; render(); } }, `Show all ${important.length}`)
              : null)));
      }
      if (!state.profile.sex || !state.profile.birthYear) {
        out.push(h('a', { class: 'card hint-card', href: '#/data' },
          h('strong', null, 'Add your sex and birth year'),
          h('span', null, ' — some guideline limits (hemoglobin, HDL, ALT, kidney function) depend on them.')));
      }
    }
    const due = protectionGroups().filter((p) => p.status === 'overdue' || p.status === 'soon');
    // Schedule advice for diseases that don't already have a due date set by you.
    const dueTargets = new Set(due.flatMap((p) => p.last.targets ?? []));
    const sched = state.vaccines.length ? dueAdvice().filter((a) => !dueTargets.has(a.target)) : [];
    if ((due.length || sched.length) && !overviewQuery) {
      out.push(h('section', { class: 'group' },
        h('h2', null, 'Vaccinations due'),
        h('div', { class: 'card list' }, due.map(protectionRow), sched.map(dueAdviceRow))));
    }
    const flagged = entries.filter((e) => e.last.status === 'high' || e.last.status === 'low');
    if (flagged.length && !overviewQuery) {
      out.push(h('section', { class: 'group' },
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
  root.append(h('section', { class: 'card hero' },
    h('div', { class: 'hero-label' }, 'Latest · ', fmtDate(last.o.date), labOf(last.o) ? ' · ' + labOf(last.o) : ''),
    h('div', { class: 'hero-value' }, valueText(last, unit)),
    statusChip(last.status)));
  root.append(findingsCard(findingsFor(key), { empty: m.custom ? null : 'No findings for this test.' }));
  root.append(h('div', { class: 'btn-row' }, discussButton(key)));

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

function reportRow(r) {
  const pts = reportPoints(r.id);
  const out = pts.filter((p) => p.status === 'high' || p.status === 'low').length;
  return h('a', { class: 'row', href: `#/report/${enc(r.id)}` },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, fmtDate(r.date)),
      h('div', { class: 'row-meta' }, r.lab || 'No lab name', r.demo ? ' · demo' : '')),
    h('div', { class: 'row-value' },
      h('div', { class: 'small' }, `${pts.length} results`, r.files?.length ? ` · ${r.files.length} 📎` : ''),
      out ? h('span', { class: 'status st-high' }, h('span', { class: 'status-icon' }, '▲'), ` ${out} out of range`) : null));
}

export function viewReports(root) {
  const list = h('div', { class: 'card list' });
  root.append(pageHead('Lab reports', { actions: h('a', { class: 'btn primary', href: '#/add' }, '+ Add') }));
  if (!state.reports.length) {
    root.append(emptyState());
    return;
  }
  root.append(searchBox(reportsQuery, 'Search labs, tests, notes', (q) => { reportsQuery = q; render(); }), list);
  function render() {
    const reps = state.reports.filter((r) => matches(reportsQuery, reportSearchText(r))).sort((a, b) => b.date.localeCompare(a.date));
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
