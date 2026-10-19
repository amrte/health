// Search across everything: tests, lab reports, findings, vaccinations, workouts,
// blood pressure, DNA variants and the app's own sections. Tolerates one typo
// per word (from 5 letters) and matches test names in all supported languages.

import { h, go } from './dom.js';
import { normName, CATEGORY_NAME } from './metrics.js';
import { state, metricSearchText, reportSearchText, metricOf } from './store.js';
import { fmtDate, fmtNum } from './format.js';
import { valueText } from './ui.js';
import { vaccineSearchText, TARGETS } from './vaccines.js';
import { PANELS, SNPS } from './dna-variants.js';
import { fitnessFindings } from './fitness-eval.js';
import { bpFindings } from './bp-eval.js';
import { fmtDuration } from './fitness.js';
import { pageHead } from './ui.js';
import { teethState, toothName, PROCEDURE_NAME } from './dental-data.js';

// App sections, with English and Ukrainian keywords.
const SECTIONS = [
  ['Overview', '#/', 'overview home dashboard огляд головна'],
  ['Lab reports', '#/reports', 'labs lab reports blood tests results аналізи звіти лабораторія результати кров'],
  ['Add a lab report', '#/add', 'add new report photo upload claude додати аналіз фото завантажити'],
  ['Fitness', '#/fitness', 'fitness polar watch sleep steps heart rate hrv training фітнес годинник сон кроки пульс тренування'],
  ['Blood pressure', '#/bp', 'blood pressure bp hypertension тиск артеріальний гіпертонія'],
  ['Vaccinations', '#/vaccines', 'vaccines vaccinations immunisation booster вакцини щеплення ревакцинація'],
  ['DNA', '#/dna', 'dna genetics 23andme tellmegen genome днк генетика геном'],
  ['Teeth', '#/teeth', 'teeth dental dentist tooth x-ray bill filling crown зуби стоматолог зуб рентген пломба коронка'],
  ['Heart', '#/heart', 'heart cardiology ecg ekg holter echo echocardiogram серце кардіологія екг холтер ехо'],
  ['Discuss with Claude', '#/discuss', 'discuss claude ask question summary обговорити запитати claude'],
  ['Data & backup', '#/data', 'data backup export import profile delete demo дані резервна копія експорт імпорт профіль'],
];

const TYPES = [
  ['section', 'Sections'],
  ['test', 'Tests'],
  ['finding', 'Findings'],
  ['report', 'Lab reports'],
  ['vaccine', 'Vaccinations'],
  ['dna', 'DNA'],
  ['bp', 'Blood pressure'],
  ['dental', 'Teeth'],
  ['workout', 'Workouts'],
];

export function buildIndex(st = state) {
  const items = [];
  const add = (type, title, sub, href, ...texts) =>
    items.push({ type, title, sub, href, title_n: normName(title), hay: normName([title, sub, ...texts.flat()].join(' ')) });

  for (const [title, href, kw] of SECTIONS) add('section', title, '', href, kw);

  const findings = [...st.findings, ...fitnessFindings(), ...bpFindings(st.bp)].filter((f) => f.level !== 'good');
  for (const f of findings) {
    const href = f.kind === 'fitness' ? '#/fitness' : f.kind === 'bp' ? '#/bp' : `#/test/${encodeURIComponent(f.keys[0])}`;
    add('finding', f.title, f.text, href, f.keys.map((k) => metricOf(k)?.name ?? k));
  }

  for (const e of st.byMetric.values()) {
    add('test', e.m.name, `${valueText(e.last, e.m.unit)} · ${fmtDate(e.last.o.date)}`, `#/test/${encodeURIComponent(e.m.key)}`,
      metricSearchText(e), CATEGORY_NAME[e.m.cat]);
  }

  for (const r of st.reports) {
    add('report', `${fmtDate(r.date)} · ${r.lab || 'Lab report'}`, r.note || `${(st.obsByReport.get(r.id) ?? []).length} results`,
      `#/report/${encodeURIComponent(r.id)}`, reportSearchText(r), r.date.slice(0, 4));
  }

  const targetName = Object.fromEntries(TARGETS.map(([k, n]) => [k, n]));
  for (const v of st.vaccines) {
    add('vaccine', v.name || 'Vaccination', `${fmtDate(v.date)} · ${(v.targets ?? []).map((t) => targetName[t] ?? t).join(', ')}`,
      `#/vaccine/${encodeURIComponent(v.id)}`, vaccineSearchText(v), v.date);
  }

  if (st.genomes.length) {
    for (const p of PANELS) {
      add('dna', p.title, p.snps.map((rs) => `${SNPS[rs].gene} ${SNPS[rs].name}`).join(' · '), '#/dna',
        p.snps, p.snps.map((rs) => SNPS[rs].gene), p.category);
    }
  }

  // Blood pressure: one entry per day with readings.
  const byDay = new Map();
  for (const r of st.bp) {
    const d = r.time.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  }
  for (const [d, rs] of byDay) {
    add('bp', `Blood pressure ${fmtDate(d)}`, rs.map((r) => `${r.sys}/${r.dia}`).join(', '), '#/bp', 'blood pressure тиск', d, rs.map((r) => r.note));
  }

  for (const v of st.dental ?? []) {
    const procs = [...new Set((v.items ?? []).map((it) => PROCEDURE_NAME[it.procedure] ?? it.procedure))];
    add('dental', `Dental visit ${fmtDate(v.date)}`, [v.clinic, procs.join(', ')].filter(Boolean).join(' · '), `#/teeth/visit/${encodeURIComponent(v.id)}`,
      'dental dentist teeth зуби стоматолог', v.date, v.note, v.dentist, (v.items ?? []).map((it) => [it.tooth, it.note, it.material]), (v.files ?? []).map((f) => f.xrayType ? 'x-ray ' + f.xrayType : f.kind));
  }
  for (const s of Object.values(teethState(st.dental ?? []))) {
    if (!s.history.length) continue;
    add('dental', `Tooth ${s.tooth}`, toothName(s.tooth), `#/teeth/tooth/${s.tooth}`, 'tooth зуб', s.history.map((it) => PROCEDURE_NAME[it.procedure]));
  }

  for (const w of st.workouts) {
    add('workout', `${w.sport || 'Workout'} · ${fmtDate(w.start.slice(0, 10))}`,
      [fmtDuration(w.durationS), w.distanceM ? `${fmtNum(w.distanceM / 1000)} km` : '', w.hrAvg ? `avg ${Math.round(w.hrAvg)} bpm` : ''].filter(Boolean).join(' · '),
      '#/fitness', 'workout training тренування', w.start.slice(0, 10));
  }
  return items;
}

// Edit distance ≤ 1 (one insertion, deletion or substitution).
function near(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Score of one item for the query words; 0 = no match.
function score(item, words) {
  let total = item.title_n === words.join(' ') ? 10 : 0;
  let hayWords = null;
  for (const w of words) {
    if (item.title_n.startsWith(w) || item.title_n.includes(' ' + w)) total += 6;
    else if (item.title_n.includes(w)) total += 4;
    else if (item.hay.includes(w)) total += 2;
    else if (w.length >= 5) {
      hayWords ??= item.hay.split(' ');
      if (hayWords.some((x) => near(x.slice(0, w.length + 1), w) || near(x, w))) total += 1;
      else return 0;
    } else return 0;
  }
  return total;
}

export function search(query, items = buildIndex()) {
  const words = normName(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return items.map((it) => ({ it, s: score(it, words) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || TYPES.findIndex(([t]) => t === a.it.type) - TYPES.findIndex(([t]) => t === b.it.type))
    .map((x) => x.it);
}

// Wraps the matched part of a title in <mark>, using text nodes only.
function highlight(text, query) {
  const words = String(query).toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const n = text.toLowerCase();
  for (const w of words) {
    const i = n.indexOf(w);
    if (i >= 0) return [text.slice(0, i), h('mark', null, text.slice(i, i + w.length)), text.slice(i + w.length)];
  }
  return text;
}

// Grouped result list. Rows are links, so they work with keyboard and screen readers.
export function searchResults(query, { limitPerType = 8 } = {}) {
  const results = search(query);
  if (!results.length) return h('p', { class: 'muted pad' }, `Nothing matches “${query}”.`);
  const box = h('div', { class: 'search-results' });
  for (const [type, label] of TYPES) {
    const rs = results.filter((r) => r.type === type);
    if (!rs.length) continue;
    box.append(h('section', { class: 'group' },
      h('h2', null, label, h('span', { class: 'muted' }, ` ${rs.length}`)),
      h('div', { class: 'card list' }, rs.slice(0, limitPerType).map((r) => h('a', { class: 'row search-hit', href: r.href },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, highlight(r.title, query)),
          r.sub ? h('div', { class: 'row-meta' }, r.sub) : null)))),
      rs.length > limitPerType ? h('p', { class: 'muted small pad' }, `and ${rs.length - limitPerType} more — refine the search`) : null));
  }
  return box;
}

// Up/down arrows move through the results, Enter opens one.
export function arrowKeys(input, container) {
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    const first = container.querySelector('.search-hit');
    if (!first) return;
    e.preventDefault();
    if (e.key === 'Enter') go(first.getAttribute('href'));
    else first.focus();
  });
  container.addEventListener('keydown', (e) => {
    const hits = [...container.querySelectorAll('.search-hit')];
    const i = hits.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown' && hits[i + 1]) { e.preventDefault(); hits[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (hits[i - 1] ?? input).focus(); }
    if (e.key === 'Escape') input.focus();
  });
}

let lastQuery = '';
export function viewSearch(root, q) {
  lastQuery = q ?? lastQuery;
  const input = h('input', { type: 'search', class: 'search search-big', value: lastQuery, placeholder: 'Search everything — tests, findings, vaccines, DNA…',
    'aria-label': 'Search', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    oninput: (e) => { lastQuery = e.target.value; history.replaceState(null, '', '#/search/' + encodeURIComponent(lastQuery)); render(); } });
  const out = h('div');
  root.append(pageHead('Search'), input, out);
  const render = () => out.replaceChildren(lastQuery.trim() ? searchResults(lastQuery, { limitPerType: 20 }) : h('p', { class: 'muted pad' },
    'Try a test name in any language (Hämoglobin, Гемоглобін, B-Hb), a lab, a vaccine, a year, a gene, or a section like “backup”.'));
  arrowKeys(input, out);
  const side = document.querySelector('.tabs .side-search');
  if (side && side.value !== lastQuery) side.value = lastQuery;
  render();
  // Keep typing in the sidebar box if that's where the search started.
  if (!document.activeElement?.classList.contains('side-search')) setTimeout(() => input.focus(), 0);
}
