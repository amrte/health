// Backup, restore, storage status, demo data and deleting everything.

import { h, toast, go } from './dom.js';
import * as db from './db.js';
import { state, load, saveProfile, bloodType } from './store.js';
import { REGIONS } from './score2.js';
import { syncCard } from './sync-ui.js';
import { fmtBytes, todayIso, fmtDate } from './format.js';
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
    dental: state.dental,
    meds: state.meds,
    events: state.events,
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
    bp: arr(data.bp), genomes: arr(data.genomes), dental: arr(data.dental), meds: arr(data.meds), events: arr(data.events) } });
  await load();
  toast('Backup imported');
  go('#/');
}

async function writeDemo() {
  const { reports, obs, vaccines, measures, workouts, bp, genomes, dental, meds, events, files } = demoData();
  const settings = state.profile.sex || state.profile.birthYear ? [] : [{ id: 'profile', ...DEMO_PROFILE }];
  await db.write({ put: { reports, obs, vaccines, settings, measures, workouts, bp, genomes, dental, meds, events, files } });
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
    genomes: state.genomes.filter((g) => g.demo).map((g) => g.id),
    dental: state.dental.filter((v) => v.demo).map((v) => v.id),
    meds: state.meds.filter((m) => m.demo).map((m) => m.id),
    events: state.events.filter((e) => e.demo).map((e) => e.id),
    files: state.dental.filter((v) => v.demo).flatMap((v) => (v.files ?? []).map((f) => f.id)),
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
  const p = { sex: state.profile.sex ?? '', birthYear: state.profile.birthYear ?? '', height: state.profile.height ?? '', smoker: state.profile.smoker ?? '',
    riskRegion: state.profile.riskRegion ?? 'moderate', highRiskCondition: !!state.profile.highRiskCondition, bloodGroup: bloodType()?.abo ?? '', rh: bloodType()?.rh ?? '' };
  const fromLab = bloodType()?.fromLab;
  const thisYear = new Date().getFullYear();
  return h('section', { class: 'card form' },
    h('h2', null, 'Profile'),
    h('p', { class: 'muted small' }, 'Used only on this device: for guideline limits that differ by sex or age, eGFR, BMI, your heart-risk score and which screening programmes apply.'),
    h('label', null, h('span', null, 'Sex (as used for lab reference values)'),
      h('select', { value: p.sex, onchange: (e) => { p.sex = e.target.value; } },
        h('option', { value: '' }, 'Not set'), h('option', { value: 'female' }, 'Female'), h('option', { value: 'male' }, 'Male'))),
    h('label', null, h('span', null, 'Birth year'),
      h('input', { type: 'text', inputmode: 'numeric', value: String(p.birthYear), placeholder: 'e.g. 1985', oninput: (e) => { p.birthYear = e.target.value; } })),
    h('label', null, h('span', null, 'Height (cm)'),
      h('input', { type: 'text', inputmode: 'decimal', value: String(p.height ?? ''), placeholder: 'e.g. 178', oninput: (e) => { p.height = e.target.value; } })),
    h('div', { class: 'bp-row2' },
      h('label', null, h('span', null, 'Blood group'), h('select', { value: p.bloodGroup, onchange: (e) => { p.bloodGroup = e.target.value; } },
        [['', 'Not set'], ['O', 'O (I)'], ['A', 'A (II)'], ['B', 'B (III)'], ['AB', 'AB (IV)']].map(([k, n]) => h('option', { value: k }, n)))),
      h('label', null, h('span', null, 'Rh factor'), h('select', { value: p.rh, onchange: (e) => { p.rh = e.target.value; } },
        [['', 'Not set'], ['pos', 'Rh positive (+)'], ['neg', 'Rh negative (−)']].map(([k, n]) => h('option', { value: k }, n))))),
    fromLab ? h('p', { class: 'hint' }, `From your lab result of ${fmtDate(fromLab.date)}. Save the profile to keep it.`) : null,
    h('label', null, h('span', null, 'Do you smoke?'),
      h('select', { value: p.smoker, onchange: (e) => { p.smoker = e.target.value; } },
        h('option', { value: '' }, 'Not set'), h('option', { value: 'no' }, 'No (never, or stopped)'), h('option', { value: 'yes' }, 'Yes, currently'))),
    h('label', null, h('span', null, 'Heart risk region (for SCORE2)'),
      h('select', { value: p.riskRegion, onchange: (e) => { p.riskRegion = e.target.value; } }, REGIONS.map(([k, n]) => h('option', { value: k }, n)))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.highRiskCondition, onchange: (e) => { p.highRiskCondition = e.target.checked; } }),
      'I have heart or vascular disease (e.g. heart attack, stroke), diabetes, chronic kidney disease or familial hypercholesterolaemia'),
    h('div', null, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const y = Number(p.birthYear);
      if (p.birthYear && !(y > 1900 && y <= thisYear)) { toast('Enter a 4-digit birth year'); return; }
      const ht = Number(String(p.height).replace(',', '.'));
      if (p.height && !(ht >= 100 && ht <= 250)) { toast('Enter your height in cm, e.g. 178'); return; }
      await saveProfile({ ...state.profile, sex: p.sex, birthYear: p.birthYear ? y : null, height: p.height ? ht : null, smoker: p.smoker, riskRegion: p.riskRegion, highRiskCondition: p.highRiskCondition,
        bloodGroup: p.bloodGroup, rh: p.rh });
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
    toast(ok ? 'Storage marked as permanent' : 'The browser declined — see the steps below, then try again.');
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
  // Browsers decide this themselves: Chrome and Edge grant it to installed or
  // bookmarked sites, Firefox asks, Safari keeps data of Home Screen / Dock apps.
  const ua = navigator.userAgent;
  const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/CriOS|FxiOS/.test(ua);
  const ios = /iPhone|iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
  const howTo = ios
    ? 'On iPhone, open the app from the Home Screen icon (Share → Add to Home Screen in Safari). Safari then keeps its data; in a normal Safari tab, data of sites you don’t open for a week can be deleted.'
    : chromium
      ? 'Chrome keeps data permanently for sites you install or bookmark: click the install icon at the right of the address bar (or ⋮ → Cast, save and share → Install page as app), or bookmark this page — then press the button again.'
      : /Safari/.test(ua) && !/Chrome/.test(ua)
        ? 'In Safari on a Mac, use File → Add to Dock and open the app from the Dock.'
        : 'Firefox asks you when you press the button — choose Allow.';
  root.append(h('section', { class: 'card' }, h('h2', null, 'Storage'), storageInfo, persistBtn,
    h('p', { class: 'hint' }, howTo, ' Either way, export a backup now and then — it is your copy if the browser or the device is reset.')));
  refreshStorage();

  root.append(await syncCard());

  root.append(h('section', { class: 'card' },
    h('h2', null, 'Install on iPhone'),
    h('ol', { class: 'steps plain' },
      h('li', null, 'Open this page in Safari.'),
      h('li', null, 'Tap the Share button, then “Add to Home Screen”.'),
      h('li', null, 'Open the app from the Home Screen icon from now on. It works offline, and Safari doesn’t clear its data after a week of not using it.'))));

  const hasDemo = state.reports.some((r) => r.demo) || state.vaccines.some((v) => v.demo) || state.measures.some((m) => m.source === 'demo') || state.dental.some((v) => v.demo) || state.meds.some((m) => m.demo) || state.events.some((e) => e.demo);
  root.append(h('section', { class: 'card' },
    h('h2', null, 'Demo data'),
    h('p', null, 'A fictional man born in 1980: seven check-ups from a Finnish, a German and a Ukrainian lab, each in its own language and units, a few vaccinations, blood pressure readings, six months of watch data and results from two DNA tests, five dental visits, heart examinations, body composition measurements, medicines, an allergy and a few illnesses in the diary. If no profile is set, his sex and birth year are used. Demo records are marked and can be removed in one go.'),
    h('div', { class: 'btn-row' },
      hasDemo
        ? h('button', { class: 'btn', type: 'button', onclick: async () => { await removeDemo(); go('#/data'); } }, 'Remove demo data')
        : h('button', { class: 'btn', type: 'button', onclick: loadDemo }, 'Load demo data'))));

  root.append(h('section', { class: 'card' },
    h('h2', null, 'Delete everything'),
    h('p', null, 'Removes everything this app stored on this device.'),
    h('button', { class: 'btn danger', type: 'button', onclick: deleteAll }, 'Delete all data')));

  root.append(h('p', { class: 'muted small pad' }, 'This app doesn’t give medical advice. Reference ranges come from your labs; ask your doctor what a result means for you.'));
}
