// Polar import: the account data export from account.polar.com (a ZIP of JSON
// files), single sessions exported from Polar Flow (JSON or CSV), and
// AccessLink-style JSON.
//
// The export format is not documented by Polar. File names and keys follow real
// export files and open-source parsers (checked 2026-10); see tests/polar.test.js.
// Unknown files are skipped and reported back to the user.

import { listZip, readEntry } from './zip.js';

// ---- helpers ------------------------------------------------------------------

// Value at the first dotted path that exists. Keys match case-insensitively,
// because Polar's exports and SDK spell some keys differently (Rmssd / RMSSD).
export function get(obj, ...paths) {
  for (const path of paths) {
    let v = obj;
    for (const k of path.split('.')) {
      if (v == null || typeof v !== 'object') { v = undefined; break; }
      if (Array.isArray(v)) { v = /^\d+$/.test(k) ? v[Number(k)] : undefined; continue; }
      if (k in v) { v = v[k]; continue; }
      const lk = k.toLowerCase();
      const hit = Object.keys(v).find((x) => x.toLowerCase() === lk);
      v = hit ? v[hit] : undefined;
    }
    if (v != null && v !== '') return v;
  }
  return undefined;
}

// "PT1H2M3.5S" or "HH:MM:SS" → seconds.
export function seconds(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  let m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/i);
  if (m && s.length > 2) return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  m = s.match(/^(\d+):(\d\d):(\d\d(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return null;
}

const num = (v) => (v == null || v === '' || v === 'NaN' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const day = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : null);
const measure = (kind, date, value) =>
  (date && value != null && Number.isFinite(value) ? { id: `polar:${kind}:${date}`, date, kind, value, source: 'polar' } : null);
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Only "1" is confirmed across parsers; other ids keep their number.
const SPORT_IDS = { 1: 'Running' };
function sportName(o) {
  const named = get(o, 'name');
  if (named && typeof named === 'string') return named;
  const old = get(o, 'exercises.0.sport', 'detailed_sport_info', 'sport');
  if (typeof old === 'string') return pretty(old);
  const id = get(o, 'sport.id', 'exercises.0.sport.id');
  return id != null ? SPORT_IDS[id] ?? `Sport ${id}` : 'Workout';
}
function pretty(s) {
  const t = String(s).replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- training sessions ----------------------------------------------------------------

// Handles the current export schema (durationMillis, hrAvg, trainingLoadReport),
// the older "exportVersion 1.4" schema (duration "PT…S", exercises[0].heartRate)
// and AccessLink exercises (duration "PT…", heart_rate.average, training_load).
export function workoutFrom(o) {
  const start = get(o, 'startTime', 'start_time', 'exercises.0.startTime');
  if (!day(String(start ?? ''))) return null;
  const stop = get(o, 'stopTime', 'exercises.0.stopTime');
  let durationS = num(get(o, 'durationMillis', 'exercises.0.durationMillis'));
  durationS = durationS != null ? durationS / 1000 : seconds(get(o, 'duration', 'exercises.0.duration'));
  if (durationS == null && stop) durationS = (Date.parse(stop) - Date.parse(start)) / 1000 || null;
  const hrStat = (get(o, 'exercises.0.statistics.statistics') ?? []).find?.((x) => x?.type === 'STATISTICS_TYPE_HEART_RATE');
  const cardio = num(get(o, 'trainingLoadReport.cardioLoad', 'exercises.0.trainingLoadReport.cardioLoad', 'exercises.0.loadInformation.cardioLoad',
    'training_load_pro.cardio-load', 'training_load', 'trainingLoad'));
  return {
    id: `polar:w:${get(o, 'identifier.id', 'id', 'exercises.0.identifier.id') ?? start}`,
    start: String(start).slice(0, 19),
    sport: sportName(o),
    durationS: durationS != null ? Math.round(durationS) : null,
    distanceM: num(get(o, 'distanceMeters', 'distance', 'exercises.0.distanceMeters', 'exercises.0.distance')),
    hrAvg: num(get(o, 'hrAvg', 'heart_rate.average', 'averageHeartRate', 'exercises.0.hrAvg', 'exercises.0.heartRate.avg')) ?? num(hrStat?.avg),
    hrMax: num(get(o, 'hrMax', 'heart_rate.maximum', 'maximumHeartRate', 'exercises.0.hrMax', 'exercises.0.heartRate.max')) ?? num(hrStat?.max),
    kcal: num(get(o, 'calories', 'kiloCalories', 'exercises.0.calories', 'exercises.0.kiloCalories')),
    load: cardio != null && cardio >= 0 ? round1(cardio) : null,
    source: 'polar',
  };
}

// ---- daily activity -----------------------------------------------------------------------

const ACTIVE_LEVELS = /MODERATE|VIGOROUS|LIGHT/i;
export function activityFrom(o) {
  const date = day(get(o, 'date'));
  let steps = num(get(o, 'summary.stepCount', 'steps', 'active_steps'));
  if (steps == null) {
    const samples = get(o, 'samples.steps');
    if (Array.isArray(samples) && samples.length) steps = samples.reduce((a, x) => a + (num(x?.value) ?? 0), 0);
  }
  let activeMin = null;
  const levels = get(o, 'summary.activityLevels');
  if (Array.isArray(levels)) {
    activeMin = levels.filter((l) => ACTIVE_LEVELS.test(l?.level ?? '')).reduce((a, l) => a + (seconds(l.duration) ?? 0), 0) / 60;
  } else if (get(o, 'active_duration') != null) activeMin = seconds(get(o, 'active_duration')) / 60;
  return [
    measure('steps', date, steps),
    measure('active_min', date, activeMin != null ? Math.round(activeMin) : null),
    measure('kcal', date, num(get(o, 'summary.calories', 'calories'))),
  ].filter(Boolean);
}

// ---- sleep and Nightly Recharge -------------------------------------------------------------

// sleep_result_*.json (export) or AccessLink /v3/users/sleep nights.
export function sleepFrom(o) {
  const date = day(get(o, 'night', 'date'));
  let min = null;
  const asleep = seconds(get(o, 'evaluation.asleepDuration'));
  if (asleep) min = asleep / 60;
  if (min == null) {
    const parts = ['light_sleep', 'deep_sleep', 'rem_sleep'].map((k) => num(get(o, k)));
    if (parts.every((x) => x != null)) min = parts.reduce((a, b) => a + b, 0) / 60;
  }
  if (min == null) {
    const st = Date.parse(get(o, 'sleepResult.hypnogram.sleepStart', 'sleep_start_time'));
    const en = Date.parse(get(o, 'sleepResult.hypnogram.sleepEnd', 'sleep_end_time'));
    if (st && en && en > st) min = (en - st) / 60000;
  }
  return [
    measure('sleep_min', date, min != null ? Math.round(min) : null),
    measure('sleep_score', date, num(get(o, 'sleep_score'))),
  ].filter(Boolean);
}

// sleep_score_*.json
export function sleepScoreFrom(o) {
  return [measure('sleep_score', day(get(o, 'night')), num(get(o, 'sleepScoreResult.sleepScore')))].filter(Boolean);
}

// nightly_recovery_*.json (intervals in ms) or AccessLink /v3/users/nightly-recharge.
export function nightlyFrom(o) {
  const date = day(get(o, 'night', 'date'));
  const rri = num(get(o, 'meanNightlyRecoveryRri'));
  const resp = num(get(o, 'meanNightlyRecoveryRespirationInterval'));
  return [
    measure('night_hr', date, round1(num(get(o, 'heart_rate_avg')) ?? (rri ? 60000 / rri : null))),
    measure('hrv', date, round1(num(get(o, 'meanNightlyRecoveryRmssd', 'heart_rate_variability_avg')))),
    measure('breathing', date, round1(num(get(o, 'breathing_rate_avg')) ?? (resp ? 60000 / resp : null))),
    measure('ans', date, round1(num(get(o, 'ansStatus', 'ans_charge')))),
  ].filter(Boolean);
}

// 247ohr_*.json: continuous heart rate per day. Polar stores no resting value, so
// the app keeps a robust daily low (5th percentile of the day's samples).
export function lowHrFrom(o) {
  const out = [];
  for (const d of get(o, 'deviceDays') ?? []) {
    const hrs = (d?.samples ?? []).map((x) => num(x?.heartRate)).filter((v) => v != null && v > 25).sort((a, b) => a - b);
    if (hrs.length >= 50) out.push(measure('low_hr', day(d.date), hrs[Math.floor(hrs.length * 0.05)]));
  }
  return out.filter(Boolean);
}

// ---- dispatch ---------------------------------------------------------------------------------

const empty = () => ({ measures: [], workouts: [] });
function merge(a, b) {
  a.measures.push(...b.measures);
  a.workouts.push(...b.workouts);
}

// Classifies one JSON document by file name, then by its keys.
export function parseJson(name, data) {
  const n = name.split('/').pop().toLowerCase();
  const out = empty();
  if (/^training-target|^calendar|^account|^products|^sport-profiles|^favourite|nightly_recovery_blob|^ppi/.test(n)) return out;
  const list = Array.isArray(data) ? data : [data];
  for (const o of list) {
    if (!o || typeof o !== 'object') continue;
    if (Array.isArray(o.recharges)) { merge(out, parseJson('nightly_recovery', o.recharges)); continue; }
    if (Array.isArray(o.nights)) { merge(out, parseJson('sleep_result', o.nights)); continue; }
    if (Array.isArray(o.exercises) && !get(o, 'startTime', 'start_time')) { merge(out, parseJson('training-session', o.exercises)); continue; }
    if (/^247ohr/.test(n) || Array.isArray(o.deviceDays)) { out.measures.push(...lowHrFrom(o)); continue; }
    if (/^nightly_recovery|recharge/.test(n) || get(o, 'meanNightlyRecoveryRmssd', 'ans_charge', 'heart_rate_variability_avg') != null) { out.measures.push(...nightlyFrom(o)); continue; }
    if (/^sleep_score/.test(n) || o.sleepScoreResult) { out.measures.push(...sleepScoreFrom(o)); continue; }
    if (/^sleep/.test(n) || o.evaluation || o.sleepResult || get(o, 'light_sleep') != null) { out.measures.push(...sleepFrom(o)); continue; }
    if (/^activity/.test(n) || o.summary?.stepCount != null || get(o, 'active_steps') != null) { out.measures.push(...activityFrom(o)); continue; }
    if (/^training-session|exercise/.test(n) || o.exercises || get(o, 'startTime', 'start_time') != null) {
      const w = workoutFrom(o);
      if (w) out.workouts.push(w);
    }
  }
  return out;
}

// Polar Flow single-session CSV: summary header + values row, then samples.
// The date format follows the account's locale (17-09-2024, 04/04/2018, 09/18/2019).
export function parseCsvDate(s) {
  let m = s.match(/^(\d{4})-(\d\d)-(\d\d)$/);
  if (m) return s;
  m = s.match(/^(\d\d)[-./](\d\d)[-./](\d{4})$/);
  if (!m) return null;
  let [, a, b, y] = m;
  // Ambiguous slashes default to day first (European locales); "09/18" can only be month first.
  if (s.includes('/') && Number(b) > 12) [a, b] = [b, a];
  return `${y}-${b}-${a}`;
}

export function parseCsv(name, text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 || !/^Name,Sport,Date/i.test(lines[0])) return empty();
  const head = lines[0].split(',');
  const vals = lines[1].split(',');
  const col = (re) => { const i = head.findIndex((x) => re.test(x.trim())); return i >= 0 ? vals[i]?.trim() : undefined; };
  const date = parseCsvDate(col(/^date$/i) ?? '');
  if (!date) return empty();
  const time = col(/^start time$/i) || '00:00:00';
  const km = num(col(/^total distance \(km\)$/i));
  return { measures: [], workouts: [{
    id: `polar:w:${date}T${time}`,
    start: `${date}T${time}`,
    sport: pretty(col(/^sport$/i) || 'Workout'),
    durationS: seconds(col(/^duration$/i)),
    distanceM: km != null ? Math.round(km * 1000) : null,
    hrAvg: num(col(/^average heart rate/i)),
    hrMax: null,
    kcal: num(col(/^calories$/i)),
    load: num(col(/^training load$/i)),
    source: 'polar',
  }] };
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
      // PPI samples are large and not used; everything else is looked at.
      const entries = (await listZip(f)).filter((e) => /\.(json|csv)$/i.test(e.name) && !/(^|\/)ppi_samples/i.test(e.name));
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
