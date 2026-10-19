// "Discuss with Claude": pick what to share, preview it, copy it, paste it in the Claude app.

import { h, toast } from './dom.js';
import { CATEGORIES } from './metrics.js';
import { state } from './store.js';
import { pageHead } from './ui.js';
import { copyText } from './editor.js';
import { buildSummary } from './summary.js';
import { KINDS, recentVsBaseline, weeklyMinutes } from './fitness.js';
import { fmtNum } from './format.js';

export function discussButton(key) {
  return h('a', { class: 'btn', href: key ? `#/discuss/${encodeURIComponent(key)}` : '#/discuss' }, 'Discuss with Claude');
}

export function viewDiscuss(root, focusKey) {
  const all = [...state.byMetric.values()];
  if (!all.length) {
    root.append(pageHead('Discuss with Claude', { back: '#/' }), h('p', { class: 'pad muted' }, 'Add some results first.'));
    return;
  }
  // Start with the chosen test plus tests that share a finding with it, or everything.
  const keys = new Set();
  if (focusKey && state.byMetric.has(focusKey)) {
    keys.add(focusKey);
    for (const f of state.findings) if (f.keys.includes(focusKey)) f.keys.forEach((k) => state.byMetric.has(k) && keys.add(k));
  } else {
    all.forEach((e) => keys.add(e.m.key));
  }
  const opts = {
    keys,
    history: 'all',
    includeProfile: true,
    includeFindings: true,
    includeVaccines: !focusKey,
    includeFitness: !focusKey && state.measures.length + state.workouts.length > 0,
    question: '',
  };
  const fitnessLines = () => {
    const out = [];
    for (const [kind, k] of Object.entries(KINDS)) {
      const r = recentVsBaseline(kind);
      if (!r || r.recent == null) continue;
      out.push(`${k.name}: ${fmtNum(+r.recent.toFixed(k.digits))} ${k.unit}`.trim() + (r.base != null ? ` (before: ${fmtNum(+r.base.toFixed(k.digits))})` : ''));
    }
    if (state.workouts.length) {
      const weeks = weeklyMinutes(Date.now() - 35 * 864e5).slice(0, -1).slice(-4);
      if (weeks.length) out.push(`Workouts: ${fmtNum(Math.round(weeks.reduce((a, w) => a + w.v, 0) / weeks.length))} min per week (last ${weeks.length} weeks)`);
    }
    return out;
  };

  const preview = h('pre', { class: 'summary-preview' });
  const update = () => {
    preview.textContent = buildSummary(state.byMetric, { ...opts, profile: state.profile, findings: state.findings, vaccines: state.vaccines,
      fitness: opts.includeFitness ? fitnessLines() : [] });
    count.textContent = `${keys.size} of ${all.length} tests`;
  };
  const count = h('span', { class: 'muted small' });
  const check = (label, prop, extra) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: opts[prop], onchange: (e) => { opts[prop] = e.target.checked; update(); } }), label, extra);

  root.append(pageHead('Discuss with Claude', {
    back: focusKey ? `#/test/${encodeURIComponent(focusKey)}` : '#/',
    sub: 'Builds a summary to paste into the Claude app. Claude explains the results and looks up current guidelines and research. Nothing leaves this app unless you paste it.',
  }));

  const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    const ok = await copyText(preview.textContent);
    toast(ok ? 'Summary copied — paste it in Claude' : 'Copy failed — try again');
  } }, 'Copy summary');
  root.append(h('section', { class: 'card' },
    h('label', null, h('span', { class: 'label' }, 'Your question (optional)'),
      h('textarea', { rows: 3, placeholder: 'e.g. Why does my ferritin keep falling? What should I ask my doctor?', oninput: (e) => { opts.question = e.target.value; update(); } })),
    h('div', { class: 'btn-row' }, copyBtn,
      h('a', { class: 'btn', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, 'Open Claude ↗')),
    h('p', { class: 'hint' }, 'Tip: web search must be on in Claude for it to find current research.')));

  const testList = h('div', { class: 'pick' });
  function renderTests() {
    testList.replaceChildren(...CATEGORIES.map(([cat, title]) => {
      const es = all.filter((e) => e.m.cat === cat).sort((a, b) => a.m.name.localeCompare(b.m.name));
      if (!es.length) return null;
      return h('fieldset', null, h('legend', null, title), es.map((e) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: keys.has(e.m.key), onchange: (ev) => {
          if (ev.target.checked) keys.add(e.m.key); else keys.delete(e.m.key);
          update();
        } }), e.m.name)));
    }).filter(Boolean));
  }
  root.append(h('section', { class: 'card' },
    h('div', { class: 'group-head' }, h('h2', null, 'What to include'), count),
    check('Age and sex', 'includeProfile'),
    check('What the app noted (findings)', 'includeFindings'),
    check('Vaccinations', 'includeVaccines'),
    state.measures.length + state.workouts.length ? check('Watch data (heart rate, sleep, activity)', 'includeFitness') : null,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: false, onchange: (e) => { opts.history = e.target.checked ? 'recent' : 'all'; update(); } }), 'Only the last 3 results per test'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', onclick: () => { all.forEach((e) => keys.add(e.m.key)); renderTests(); update(); } }, 'All tests'),
      h('button', { class: 'btn', type: 'button', onclick: () => { keys.clear(); renderTests(); update(); } }, 'None')),
    testList));
  renderTests();

  root.append(h('section', { class: 'group' }, h('h2', null, 'Preview'), h('div', { class: 'card' }, preview)));
  update();
}
