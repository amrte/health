// Start-up and hash router.

import { h } from './dom.js';
import { load } from './store.js';
import { isMemoryOnly } from './db.js';
import { viewOverview, viewMetric, viewReports, viewReport } from './views.js';
import { viewEditor, editorDirty, clearDirty } from './editor.js';
import { viewData, seedDemoOnce } from './data.js';
import { viewDiscuss } from './discuss.js';
import { viewFitness, viewFitnessKind } from './fitness.js';
import { viewBp } from './bp.js';
import { viewDna } from './dna.js';
import { viewSearch } from './search.js';
import { viewVaccines, viewVaccine, viewVaccineEditor, vaccineEditorDirty, clearVaccineDirty } from './vaccines.js';

const ROUTES = [
  [/^#?\/?$/, (root) => viewOverview(root), 'overview'],
  [/^#\/test\/(.+)$/, (root, key) => viewMetric(root, key), 'overview'],
  [/^#\/reports$/, (root) => viewReports(root), 'reports'],
  [/^#\/report\/(.+)$/, (root, id) => viewReport(root, id), 'reports'],
  [/^#\/add$/, (root) => viewEditor(root, null), 'reports'],
  [/^#\/fitness$/, (root) => viewFitness(root), 'fitness'],
  [/^#\/bp$/, (root) => viewBp(root), 'fitness'],
  [/^#\/dna$/, (root) => viewDna(root), 'reports'],
  [/^#\/fitness\/(.+)$/, (root, kind) => viewFitnessKind(root, kind), 'fitness'],
  [/^#\/edit\/(.+)$/, (root, id) => viewEditor(root, id), 'reports'],
  [/^#\/vaccines$/, (root) => viewVaccines(root), 'vaccines'],
  [/^#\/vaccines\/add$/, (root) => viewVaccineEditor(root, null), 'vaccines'],
  [/^#\/vaccines\/edit\/(.+)$/, (root, id) => viewVaccineEditor(root, id), 'vaccines'],
  [/^#\/vaccine\/(.+)$/, (root, id) => viewVaccine(root, id), 'vaccines'],
  [/^#\/discuss(?:\/(.+))?$/, (root, key) => viewDiscuss(root, key), 'overview'],
  [/^#\/data$/, (root) => viewData(root), 'data'],
  [/^#\/search(?:\/(.*))?$/, (root, q) => viewSearch(root, q), 'search'],
];

const main = document.getElementById('view');
let current = location.hash;

async function route() {
  if ((editorDirty() || vaccineEditorDirty()) && location.hash !== current) {
    if (!confirm('Leave without saving?')) {
      history.replaceState(null, '', current || '#/');
      return;
    }
    clearDirty();
    clearVaccineDirty();
  }
  current = location.hash;
  const [re, view, tab] = ROUTES.find(([re]) => re.test(location.hash)) ?? ROUTES[0];
  const arg = location.hash.match(re)?.[1];
  for (const a of document.querySelectorAll('.tabs a')) a.toggleAttribute('aria-current', a.dataset.tab === tab);
  const root = h('div', { class: 'page' });
  main.replaceChildren(root);
  window.scrollTo(0, 0);
  const side = document.querySelector('.tabs .side-search');
  if (side && tab !== 'search') side.value = '';
  try {
    await view(root, arg ? decodeURIComponent(arg) : undefined);
  } catch (err) {
    console.error(err);
    root.append(h('p', { class: 'pad warn' }, 'Something went wrong: ' + (err?.message ?? err)));
  }
}

window.addEventListener('hashchange', route);

// ⌘K / Ctrl+K anywhere, or "/" outside text fields, opens search.
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
  if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
    e.preventDefault();
    const side = document.querySelector('.tabs .side-search');
    if (side && side.offsetParent) { side.focus(); side.select(); } else location.hash = '#/search';
  }
});
document.querySelector('.tabs .side-search')?.addEventListener('keydown', (e) => {
  const first = main.querySelector('.search-hit');
  if (!first) return;
  if (e.key === 'Enter') { e.preventDefault(); location.hash = first.getAttribute('href'); }
  if (e.key === 'ArrowDown') { e.preventDefault(); first.focus(); }
});
// The sidebar box (wide screens) drives the search page; typing replaces the
// history entry instead of adding one per key.
document.querySelector('.tabs .side-search')?.addEventListener('input', (e) => {
  const hash = '#/search/' + encodeURIComponent(e.target.value);
  if (location.hash.startsWith('#/search')) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = hash;
});
window.addEventListener('beforeunload', (e) => { if (editorDirty() || vaccineEditorDirty()) e.preventDefault(); });

try {
  await load();
  if (document.documentElement.dataset.demoSeed) await seedDemoOnce();
  if (isMemoryOnly()) {
    document.body.prepend(h('div', { class: 'memory-banner', role: 'alert' },
      h('strong', null, 'Not saved in this browser. '),
      'This browser doesn’t allow storage for files opened from disk, so changes are lost when you close the tab. Open the file in Chrome or Firefox, or use the hosted version of the app.'));
  }
} catch (err) {
  main.replaceChildren(h('p', { class: 'pad warn' }, 'Could not open the on-device database. Private browsing may block it. ' + (err?.message ?? '')));
  throw err;
}
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
