// Rendering of findings and the per-test knowledge cards.

import { h } from './dom.js';
import { KB, SOURCES, REVIEWED } from './knowledge.js';
import { fmtDate } from './format.js';

const LEVEL = {
  alert: ['▲', 'Discuss with a doctor'],
  attention: ['●', 'Worth a look'],
  info: ['ℹ', 'Good to know'],
  good: ['✓', 'Looks fine'],
};

function sourceLinks(ids) {
  const list = [...new Set(ids ?? [])].map((id) => SOURCES[id]).filter(Boolean);
  if (!list.length) return null;
  return h('div', { class: 'finding-src' }, 'Source: ', list.flatMap((s, i) => [i ? ' · ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.short)]));
}

export function findingItem(f, { link } = {}) {
  const [icon, word] = LEVEL[f.level] ?? LEVEL.info;
  return h('div', { class: `finding lv-${f.level}` },
    h('div', { class: 'finding-head' },
      h('span', { class: 'finding-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'finding-level' }, word)),
    link ? h('a', { class: 'finding-title', href: link }, f.title) : h('div', { class: 'finding-title' }, f.title),
    h('p', { class: 'finding-text' }, f.text),
    sourceLinks(f.sources));
}

export function findingsCard(findings, { title = 'What this means', empty } = {}) {
  if (!findings.length && !empty) return null;
  return h('section', { class: 'card findings' },
    h('h2', null, title),
    findings.length ? findings.map((f) => findingItem(f)) : h('p', { class: 'muted' }, empty));
}

// "About this test": what it measures, causes of high/low values, guideline limits, sources.
export function aboutCard(key) {
  const kb = KB[key];
  if (!kb) return null;
  const pubmed = kb.pubmed
    ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(kb.pubmed)}&filter=pubt.guideline&filter=pubt.systematicreview&filter=pubt.metaanalysis&filter=datesearch.y_5&sort=date`
    : null;
  const ids = new Set([...(kb.sources ?? []), ...(kb.thresholds ?? []).map((t) => t.source)]);
  return h('section', { class: 'card about' },
    h('h2', null, 'About this test'),
    kb.about ? h('p', null, kb.about) : null,
    kb.high ? h('p', null, h('strong', null, 'Higher values: '), kb.high) : null,
    kb.low ? h('p', null, h('strong', null, 'Lower values: '), kb.low) : null,
    kb.thresholds?.length ? h('div', null,
      h('h3', null, 'Guideline limits'),
      h('table', { class: 'limits' }, h('tbody', null, kb.thresholds.map((t) =>
        h('tr', null,
          h('td', null, t.label, h('div', { class: 'muted small' }, SOURCES[t.source]?.short ?? '')),
          h('td', { class: 'limit-value' }, t.value)))))) : null,
    kb.note ? h('p', { class: 'muted small' }, kb.note) : null,
    h('h3', null, 'Sources'),
    h('ul', { class: 'sources' }, [...ids].map((id) => SOURCES[id]).filter(Boolean).map((s) =>
      h('li', null, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title), h('span', { class: 'muted' }, ` — ${s.org}${s.year ? ', ' + s.year : ''}`)))),
    pubmed ? h('p', null, h('a', { class: 'btn', href: pubmed, target: '_blank', rel: 'noopener' }, 'Recent research on PubMed ↗')) : null,
    h('p', { class: 'muted small' }, `Guideline content reviewed ${fmtDate(REVIEWED)}. Information only — your doctor knows the context these rules don’t.`));
}
