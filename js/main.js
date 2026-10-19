// Start-up and hash router.

import { h } from './dom.js';
import { load } from './store.js';
import { viewOverview, viewMetric, viewReports, viewReport } from './views.js';
import { viewEditor, editorDirty, clearDirty } from './editor.js';
import { viewData } from './data.js';
import { viewDiscuss } from './discuss.js';
import { viewVaccines, viewVaccine, viewVaccineEditor, vaccineEditorDirty, clearVaccineDirty } from './vaccines.js';

const ROUTES = [
  [/^#?\/?$/, (root) => viewOverview(root), 'overview'],
  [/^#\/test\/(.+)$/, (root, key) => viewMetric(root, key), 'overview'],
  [/^#\/reports$/, (root) => viewReports(root), 'reports'],
  [/^#\/report\/(.+)$/, (root, id) => viewReport(root, id), 'reports'],
  [/^#\/add$/, (root) => viewEditor(root, null), 'add'],
  [/^#\/edit\/(.+)$/, (root, id) => viewEditor(root, id), 'reports'],
  [/^#\/vaccines$/, (root) => viewVaccines(root), 'vaccines'],
  [/^#\/vaccines\/add$/, (root) => viewVaccineEditor(root, null), 'vaccines'],
  [/^#\/vaccines\/edit\/(.+)$/, (root, id) => viewVaccineEditor(root, id), 'vaccines'],
  [/^#\/vaccine\/(.+)$/, (root, id) => viewVaccine(root, id), 'vaccines'],
  [/^#\/discuss(?:\/(.+))?$/, (root, key) => viewDiscuss(root, key), 'overview'],
  [/^#\/data$/, (root) => viewData(root), 'data'],
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
  try {
    await view(root, arg ? decodeURIComponent(arg) : undefined);
  } catch (err) {
    console.error(err);
    root.append(h('p', { class: 'pad warn' }, 'Something went wrong: ' + (err?.message ?? err)));
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => { if (editorDirty() || vaccineEditorDirty()) e.preventDefault(); });

try {
  await load();
} catch (err) {
  main.replaceChildren(h('p', { class: 'pad warn' }, 'Could not open the on-device database. Private browsing may block it. ' + (err?.message ?? '')));
  throw err;
}
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
