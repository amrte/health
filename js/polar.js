// Polar import: the account data export (ZIP of JSON files), single training
// sessions exported from Polar Flow (JSON/CSV), and AccessLink-style JSON.
//
// Parsers are deliberately tolerant: they look for known keys in several
// spellings and skip what they don't recognise, reporting it back to the user.

import { listZip, readEntry } from './zip.js';

// ---- helpers ------------------------------------------------------------------

export function get(obj, ...paths) {
  for (const path of paths) {
    let v = obj;
    for (const k of path.split('.')) {
      if (v == null) break;
      v = Array.isArray(v) && /^\d+$/.test(k) ? v[Number(k)] : v[k];
    }
    if (v != null && v !== '') return v;
  }
  return undefined;
}

// "PT1H2M3.5S", 3723500 (ms), "01:02:03" → seconds.
export function seconds(v, { msIfNumber = true } = {}) {
  if (v == null) return null;
  if (typeof v === 'number') return msIfNumber ? v / 1000 : v;
  const s = String(v).trim();
  let m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/i);
  if (m && s.length > 1) return (Number(m[1] ?? 0) * 86400) + (Number(m[2] ?? 0) * 3600) + (Number(m[3] ?? 0) * 60) + Number(m[4] ?? 0);
  m = s.match(/^(\d+):(\d\d):(\d\d(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return null;
}

const num = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const day = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : null);
const measure = (kind, date, value) => (date && value != null && Number.isFinite(value) ? { id: `polar:${kind}:${date}`, date, kind, value, source: 'polar' } : null);

function prettySport(s) {
  if (!s) return '';
  const t = String(s).replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- parsers --------------------------------------------------------------------

function workoutFrom(o, idHint) {
  const start = get(o, 'startTime', 'start_time', 'start', 'exercises.0.startTime');
  if (!start || !day(String(start))) return null;
  const ex = get(o, 'exercises.0') ?? {};
  const durationS = seconds(get(o, 'duration', 'exercises.0.duration', 'durationMillis') ?? get(ex, 'duration'),
    { msIfNumber: get(o, 'durationMillis') != null || typeof get(o, 'duration') === 'number' });
  const sport = get(o, 'sport', 'detailed_sport_info', 'exercises.0.sport', 'name', 'sport.name', 'exercises.0.sport.name');
  return {
    id: `polar:w:${get(o, 'id', 'identifier.id', 'exercises.0.id') ?? idHint ?? start}`,
    start: String(start).slice(0, 19),
    sport: prettySport(typeof sport === 'object' ? get(sport, 'name', 'id') : sport),
    durationS,
    distanceM: num(get(o, 'distance', 'distanceMeters', 'exercises.0.distance', 'exercises.0.distanceMeters')),
    hrAvg: num(get(o, 'heart_rate.average', 'heartRate.avg', 'heartRate.average', 'averageHeartRate', 'exercises.0.heartRate.avg', 'exercises.0.heartRate.average', 'hrAvg')),
    hrMax: num(get(o, 'heart_rate.maximum', 'heartRate.max', 'heartRate.maximum', 'maximumHeartRate', 'exercises.0.heartRate.max', 'exercises.0.heartRate.maximum', 'hrMax')),
    kcal: num(get(o, 'calories', 'kiloCalories', 'exercises.0.kiloCalories', 'exercises.0.calories')),
    load: num(get(o, 'training_load', 'trainingLoad', 'cardioLoad', 'loadInformation.cardioLoad.value', 'exercises.0.loadInformation.cardioLoad.value', 'exercises.0.trainingLoad')),
    source: 'polar',
  };
}

function nightlyFrom(o) {
  const date = day(get(o, 'date', 'night', 'sleepResultDate', 'created'));
  return [
    measure('night_hr', date, num(get(o, 'heart_rate_avg', 'heartRateAvg', 'meanNightlyRecoveryHeartRate', 'heartRate.avg'))),
    measure('hrv', date, num(get(o, 'heart_rate_variability_avg', 'heartRateVariabilityAvg', 'meanNightlyRecoveryRmssd', 'meanNightlyRecoveryRMSSD', 'rmssd'))),
    measure('breathing', date, num(get(o, 'breathing_rate_avg', 'breathingRateAvg', 'meanNightlyRecoveryRespirationInterval'))),
    measure('ans', date, num(get(o, 'ans_charge', 'ansCharge', 'ansRate'))),
  ].filter(Boolean);
}

function sleepFrom(o) {
  const date = day(get(o, 'date', 'night', 'sleepDate', 'sleep_end_time', 'sleepEndTime'));
  let min = null;
  const light = seconds(get(o, 'light_sleep', 'lightSleep'), { msIfNumber: false });
  const deep = seconds(get(o, 'deep_sleep', 'deepSleep'), { msIfNumber: false });
  const rem = seconds(get(o, 'rem_sleep', 'remSleep'), { msIfNumber: false });
  if (light != null && deep != null && rem != null) min = (light + deep + rem) / 60;
  const total = get(o, 'totalSleepDuration', 'sleepDuration', 'sleep_duration', 'asleepDuration');
  if (min == null && total != null) min = seconds(total) / 60;
  if (min == null) {
    const st = Date.parse(get(o, 'sleep_start_time', 'sleepStartTime', 'sleepStart'));
    const en = Date.parse(get(o, 'sleep_end_time', 'sleepEndTime', 'sleepEnd'));
    if (st && en && en > st) min = (en - st) / 60000;
  }
  return [
    measure('sleep_min', date, min != null ? Math.round(min) : null),
    measure('sleep_score', date, num(get(o, 'sleep_score', 'sleepScore', 'sleepScore.value'))),
  ].filter(Boolean);
}

function activityFrom(o) {
  const date = day(get(o, 'date', 'day', 'created'));
  return [
    measure('steps', date, num(get(o, 'active_steps', 'steps', 'activeSteps', 'summary.steps', 'stepCount'))),
    measure('active_min', date, (() => { const s = seconds(get(o, 'active_duration', 'activeDuration', 'summary.activeDuration')); return s != null ? Math.round(s / 60) : null; })()),
    measure('kcal', date, num(get(o, 'calories', 'kiloCalories', 'summary.calories'))),
  ].filter(Boolean);
}

// Classifies one JSON document (by file name first, then by its keys).
export function parseJson(name, data) {
  const n = name.toLowerCase();
  const list = Array.isArray(data) ? data : [data];
  const out = { measures: [], workouts: [] };
  for (const o of list) {
    if (!o || typeof o !== 'object') continue;
    if (Array.isArray(o.nights) || Array.isArray(o.recharges)) { const r = parseJson(name, o.nights ?? o.recharges); merge(out, r); continue; }
    if (Array.isArray(o.exercises) && !o.startTime && !o.start_time) { merge(out, parseJson('training', o.exercises)); continue; }
    if (/training|exercise|session/.test(n) || o.exercises || o.sport || o.detailed_sport_info) {
      const w = workoutFrom(o, n);
      if (w) { out.workouts.push(w); continue; }
    }
    if (/recharge|recovery|nightly/.test(n) || get(o, 'ans_charge', 'heart_rate_variability_avg', 'meanNightlyRecoveryRmssd') != null) { out.measures.push(...nightlyFrom(o)); continue; }
    if (/sleep/.test(n) || get(o, 'sleep_start_time', 'light_sleep', 'sleepStartTime') != null) { out.measures.push(...sleepFrom(o)); continue; }
    if (/activity|daily/.test(n) || get(o, 'active_steps', 'steps') != null) { out.measures.push(...activityFrom(o)); continue; }
  }
  return out;
}

function merge(a, b) {
  a.measures.push(...b.measures);
  a.workouts.push(...b.workouts);
}

// Polar Flow single-session CSV: a summary header row + values row, then samples.
export function parseCsv(name, text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return { measures: [], workouts: [] };
  const head = lines[0].split(',');
  const vals = lines[1].split(',');
  const col = (re) => { const i = head.findIndex((h) => re.test(h)); return i >= 0 ? vals[i] : undefined; };
  const date = col(/^date$/i);
  const time = col(/^start time$/i);
  if (!date) return { measures: [], workouts: [] };
  const iso = /^\d{2}-\d{2}-\d{4}$/.test(date) ? `${date.slice(6)}-${date.slice(3, 5)}-${date.slice(0, 2)}` : date;
  const w = {
    id: `polar:w:${iso}T${time ?? ''}`,
    start: `${iso}T${time ?? '00:00:00'}`,
    sport: prettySport(col(/^sport$/i)),
    durationS: seconds(col(/^duration$/i)),
    distanceM: num(col(/^total distance \(km\)$/i)) != null ? num(col(/^total distance \(km\)$/i)) * 1000 : null,
    hrAvg: num(col(/^average heart rate/i)),
    hrMax: num(col(/^max(imum)? heart rate/i)),
    kcal: num(col(/^calories/i)),
    load: num(col(/^training load/i)),
    source: 'polar',
  };
  return { measures: [], workouts: [w] };
}

// Imports any mix of ZIP, JSON and CSV files. Skips per-second sample files.
export async function importFiles(files, progress = () => {}) {
  const out = { measures: [], workouts: [], stats: { files: 0, recognised: 0, skipped: [] } };
  const take = async (name, text) => {
    out.stats.files++;
    let r = { measures: [], workouts: [] };
    try {
      if (/\.csv$/i.test(name)) r = parseCsv(name, text);
      else if (/\.json$/i.test(name)) r = parseJson(name, JSON.parse(text));
    } catch { /* unreadable file: reported as skipped */ }
    if (r.measures.length || r.workouts.length) { out.stats.recognised++; merge(out, r); } else out.stats.skipped.push(name.split('/').pop());
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      const entries = (await listZip(f)).filter((e) => /\.(json|csv)$/i.test(e.name) && !/(^|\/)(ppi|247ohr|samples)/i.test(e.name));
      let i = 0;
      for (const e of entries) {
        if (++i % 25 === 0) progress(`Reading ${i} of ${entries.length} files…`);
        await take(e.name, await readEntry(f, e));
      }
    } else {
      await take(f.name, await f.text());
    }
  }
  // The same day may come from several files; keep the last value per id.
  out.measures = [...new Map(out.measures.map((m) => [m.id, m])).values()];
  out.workouts = [...new Map(out.workouts.map((w) => [w.id, w])).values()];
  return out;
}
