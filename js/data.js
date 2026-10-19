// Backup, restore, storage status, demo data and deleting everything.

import { h, toast, go } from './dom.js';
import * as db from './db.js';
import { state, load, saveProfile } from './store.js';
import { fmtBytes, todayIso } from './format.js';
import { pageHead } from './ui.js';
import { demoData, DEMO_PROFILE } from './demo.js';

const FORMAT = 'health-records-backup';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function exportBackup() {
  const files = await db.getAll('files');
  const payload = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    reports: state.reports,
    obs: state.obs,
    vaccines: state.vaccines,
    measures: state.measures,
    workouts: state.workouts,
    bp: state.bp,
    genomes: state.genomes,
    profile: state.profile,
    files: await Promise.all(files.map(async (f) => ({ id: f.id, type: f.type, name: f.name, data: await blobToDataUrl(f.blob) }))),
  };
  const name = `health-backup-${todayIso()}.json`;
  const file = new File([JSON.stringify(payload)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  h('a', { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('That file isn’t a backup from this app');
    return;
  }
  if (data?.format !== FORMAT || !Array.isArray(data.reports) || !Array.isArray(data.obs)) {
    toast('That file isn’t a backup from this app');
    return;
  }
  const vaccines = Array.isArray(data.vaccines) ? data.vaccines : [];
  if (!confirm(`Import ${data.reports.length} reports, ${data.obs.length} results, ${vaccines.length} vaccinations and ${data.files?.length ?? 0} photos? Records that already exist here are replaced by the backup's version.`)) return;
  const files = await Promise.all((data.files ?? []).map(async (f) => ({ id: f.id, type: f.type, name: f.name, blob: await (await fetch(f.data)).blob() })));
  const settings = data.profile && typeof data.profile === 'object' ? [{ ...data.profile, id: 'profile' }] : [];
  const arr = (x) => (Array.isArray(x) ? x : []);
  await db.write({ put: { reports: data.reports, obs: data.obs, vaccines, files, settings, measures: arr(data.measures), workouts: arr(data.workouts),
    bp: arr(data.bp), genomes: arr(data.genomes) } });
  await load();
  toast('Backup imported');
  go('#/');
}

async function writeDemo() {
  const { reports, obs, vaccines, measures, workouts, bp } = demoData();
  const settings = state.profile.sex || state.profile.birthYear ? [] : [{ id: 'profile', ...DEMO_PROFILE }];
  await db.write({ put: { reports, obs, vaccines, settings, measures, workouts, bp } });
  await load();
}

async function loadDemo() {
  await writeDemo();
  toast('Demo data added');
  go('#/');
}

// Single-file demo build: fill an empty app with the fictional person once.
export async function seedDemoOnce() {
  if (await db.get('settings', 'demoSeeded')) return;
  if (!state.reports.length && !state.vaccines.length) await writeDemo();
  await db.write({ put: { settings: [{ id: 'demoSeeded', at: new Date().toISOString() }] } });
}

async function removeDemo() {
  const ids = state.reports.filter((r) => r.demo).map((r) => r.id);
  const set = new Set(ids);
  await db.write({ del: {
    reports: ids,
    obs: state.obs.filter((o) => set.has(o.reportId)).map((o) => o.id),
    vaccines: state.vaccines.filter((v) => v.demo).map((v) => v.id),
    measures: state.measures.filter((m) => m.source === 'demo').map((m) => m.id),
    workouts: state.workouts.filter((w) => w.source === 'demo').map((w) => w.id),
    bp: state.bp.filter((r) => r.source === 'demo').map((r) => r.id),
  } });
  await load();
  toast('Demo data removed');
}

async function deleteAll() {
  if (!confirm('Delete ALL reports, results, vaccinations and photos on this device? This cannot be undone.')) return;
  if (!confirm('Really delete everything? Export a backup first if you might need it.')) return;
  await db.write({ clear: db.STORES });
  await load();
  toast('All data deleted');
  go('#/');
}

function profileCard() {
  const p = { sex: state.profile.sex ?? '', birthYear: state.profile.birthYear ?? '' };
  const thisYear = new Date().getFullYear();
  return h('section', { class: 'card form' },
    h('h2', null, 'Profile'),
    h('p', { class: 'muted small' }, 'Used only on this device, for guideline limits that differ by sex or age and to calculate eGFR from creatinine.'),
    h('label', null, h('span', null, 'Sex (as used for lab reference values)'),
      h('select', { value: p.sex, onchange: (e) => { p.sex = e.target.value; } },
        h('option', { value: '' }, 'Not set'), h('option', { value: 'female' }, 'Female'), h('option', { value: 'male' }, 'Male'))),
    h('label', null, h('span', null, 'Birth year'),
      h('input', { type: 'text', inputmode: 'numeric', value: String(p.birthYear), placeholder: 'e.g. 1985', oninput: (e) => { p.birthYear = e.target.value; } })),
    h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const y = Number(p.birthYear);
      if (p.birthYear && !(y > 1900 && y <= thisYear)) { toast('Enter a 4-digit birth year'); return; }
      await saveProfile({ sex: p.sex, birthYear: p.birthYear ? y : null });
      toast('Profile saved');
    } }, 'Save profile')));
}

export async function viewData(root) {
  root.append(pageHead('Data & backup'));
  root.append(profileCard());

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'offscreen', id: 'backup-in',
    onchange: (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; } });
  root.append(h('section', { class: 'card' },
    h('h2', null, 'Backup'),
    h('p', null, 'Your records and photos live only in this browser on this device. Export a backup now and then — and before deleting Safari data or changing phones — and keep it somewhere safe (Files, iCloud Drive, a USB stick).'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => exportBackup().catch((e) => toast('Export failed: ' + e.message)) }, 'Export backup'),
      h('label', { class: 'btn', for: 'backup-in' }, 'Import backup…'), fileIn),
    h('p', { class: 'hint' }, 'The backup file contains your results and photos unencrypted. Treat it like a medical document.')));

  const storageInfo = h('p', { class: 'muted' }, 'Checking storage…');
  const persistBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick: async () => {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'Storage marked as permanent' : 'The browser declined. Adding the app to the Home Screen helps.');
    refreshStorage();
  } }, 'Keep data permanently');
  async function refreshStorage() {
    const est = await navigator.storage?.estimate?.().catch(() => null);
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    storageInfo.textContent = `${state.reports.length} reports, ${state.obs.length} results` +
      (est?.usage != null ? ` · ${fmtBytes(est.usage)} used` : '') +
      (persisted ? ' · storage is permanent' : ' · the browser may clear storage it considers unused');
    persistBtn.hidden = !!persisted || !navigator.storage?.persist;
  }
  root.append(h('section', { class: 'card' }, h('h2', null, 'Storage'), storageInfo, persistBtn));
  refreshStorage();

  root.append(h('section', { class: 'card' },
    h('h2', null, 'Install on iPhone'),
    h('ol', { class: 'steps plain' },
      h('li', null, 'Open this page in Safari.'),
      h('li', null, 'Tap the Share button, then “Add to Home Screen”.'),
      h('li', null, 'Open the app from the Home Screen icon from now on. It works offline, and Safari doesn’t clear its data after a week of not using it.'))));

  const hasDemo = state.reports.some((r) => r.demo) || state.vaccines.some((v) => v.demo) || state.measures.some((m) => m.source === 'demo');
  root.append(h('section', { class: 'card' },
    h('h2', null, 'Demo data'),
    h('p', null, 'A fictional man born in 1980: seven check-ups from a Finnish, a German and a Ukrainian lab, each in its own language and units, a few vaccinations, blood pressure readings and six months of watch data. If no profile is set, his sex and birth year are used. Demo records are marked and can be removed in one go.'),
    h('div', { class: 'btn-row' },
      hasDemo
        ? h('button', { class: 'btn', type: 'button', onclick: async () => { await removeDemo(); go('#/data'); } }, 'Remove demo data')
        : h('button', { class: 'btn', type: 'button', onclick: loadDemo }, 'Load demo data'))));

  root.append(h('section', { class: 'card' },
    h('h2', null, 'Delete everything'),
    h('p', null, 'Removes all reports, results, vaccinations and photos from this device.'),
    h('button', { class: 'btn danger', type: 'button', onclick: deleteAll }, 'Delete all data')));

  root.append(h('p', { class: 'muted small pad' }, 'This app doesn’t give medical advice. Reference ranges come from your labs; ask your doctor what a result means for you.'));
}
