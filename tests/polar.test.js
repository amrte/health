// Polar import, tested on made-up files in the formats of the real export
// (account.polar.com → Download your data), Polar Flow CSV and AccessLink.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseJson, parseCsv, parseCsvDate, seconds, importFiles } from '../js/polar.js';

const byKind = (ms) => Object.fromEntries(ms.map((m) => [`${m.kind}:${m.date}`, m.value]));

const SESSION_NEW = {
  identifier: { id: '9000000001' }, startTime: '2026-03-01T07:30:00', stopTime: '2026-03-01T08:15:00', name: 'Running',
  durationMillis: 2700000, distanceMeters: 7512.4, calories: 520, hrAvg: 148, hrMax: 171, timezoneOffsetMinutes: 120,
  sport: { id: '1' }, trainingLoadReport: { cardioLoad: 61.234, muscleLoad: -1.0 },
  exercises: [{ identifier: { id: '9000000002' }, durationMillis: 2700000, statistics: { statistics: [{ type: 'STATISTICS_TYPE_HEART_RATE', min: 90, avg: 148, max: 171 }] } }],
};
const SESSION_OLD = {
  exportVersion: '1.4', name: 'Cycling', startTime: '2016-06-21T15:26:00.000', stopTime: '2016-06-21T16:26:00.000',
  duration: 'PT3600S', distance: 25000, kiloCalories: 700,
  exercises: [{ sport: 'CYCLING', heartRate: { min: 80, avg: 131, max: 160 } }],
};

test('training sessions: current and old export schema', () => {
  const [w] = parseJson('training-session-2026-03-01T07:30:00-9000000001-aaaa.json', SESSION_NEW).workouts;
  assert.deepEqual(w, { id: 'polar:w:9000000001', start: '2026-03-01T07:30:00', sport: 'Running', durationS: 2700, distanceM: 7512.4,
    hrAvg: 148, hrMax: 171, kcal: 520, load: 61.2, source: 'polar' });
  const noTop = structuredClone(SESSION_NEW);
  delete noTop.hrAvg; delete noTop.hrMax; delete noTop.name; noTop.sport.id = '17';
  const [w2] = parseJson('training-session-x.json', noTop).workouts;
  assert.equal(w2.hrAvg, 148, 'falls back to exercise statistics');
  assert.equal(w2.sport, 'Sport 17');
  const [o] = parseJson('training-session-2016-06-21-1-uuid.json', SESSION_OLD).workouts;
  assert.equal(o.durationS, 3600);
  assert.equal(o.hrAvg, 131);
  assert.equal(o.kcal, 700);
  assert.equal(o.sport, 'Cycling');
  assert.equal(parseJson('training-target-2026-03-02-x.json', SESSION_NEW).workouts.length, 0, 'planned sessions are skipped');
});

test('daily activity, sleep, sleep score, Nightly Recharge, 24/7 heart rate', () => {
  const act = parseJson('activity-2026-03-01-uuid.json', { exportVersion: '2.6', date: '2026-03-01',
    summary: { stepCount: 8421, calories: 2410, activityLevels: [
      { level: 'SEDENTARY', duration: 'PT36000S' }, { level: 'LIGHT', duration: 'PT3600S' },
      { level: 'CONTINUOS_MODERATE', duration: 'PT1800S' }, { level: 'SLEEP', duration: 'PT25200S' }] } });
  assert.deepEqual(byKind(act.measures), { 'steps:2026-03-01': 8421, 'active_min:2026-03-01': 90, 'kcal:2026-03-01': 2410 });
  const noSummary = parseJson('activity-2026-03-02-uuid.json', { date: '2026-03-02', samples: { steps: [{ value: 100 }, { value: 250 }] } });
  assert.equal(byKind(noSummary.measures)['steps:2026-03-02'], 350);

  const sleep = parseJson('sleep_result_123-uuid.json', [
    { night: '2026-03-01', evaluation: { asleepDuration: 'PT6H48M', sleepSpan: 'PT7H30M' } },
    { night: '2026-03-02', sleepResult: { hypnogram: { sleepStart: '2026-03-01T23:10:00+02:00', sleepEnd: '2026-03-02T06:40:00+02:00' } } },
  ]);
  assert.deepEqual(byKind(sleep.measures), { 'sleep_min:2026-03-01': 408, 'sleep_min:2026-03-02': 450 });
  const score = parseJson('sleep_score_123-uuid.json', [{ night: '2026-03-01', sleepScoreResult: { sleepScore: 78.4 } }]);
  assert.deepEqual(byKind(score.measures), { 'sleep_score:2026-03-01': 78.4 });

  const rec = parseJson('nightly_recovery_123-uuid.json', [
    { night: '2026-03-01', ansStatus: 4.2, meanNightlyRecoveryRmssd: 48, meanNightlyRecoveryRri: 1100, meanNightlyRecoveryRespirationInterval: 4000 },
    { night: '2026-03-02', ansStatus: -1.5, meanNightlyRecoveryRMSSD: 39, meanNightlyRecoveryRRI: 1000 },
  ]);
  assert.deepEqual(byKind(rec.measures), {
    'night_hr:2026-03-01': 54.5, 'hrv:2026-03-01': 48, 'breathing:2026-03-01': 15, 'ans:2026-03-01': 4.2,
    'night_hr:2026-03-02': 60, 'hrv:2026-03-02': 39, 'ans:2026-03-02': -1.5,
  });
  assert.equal(parseJson('nightly_recovery_blob_123-uuid.json', [{ hrvData: [] }]).measures.length, 0);

  const samples = Array.from({ length: 200 }, (_, i) => ({ heartRate: 50 + (i % 60), secondsFromDayStart: i * 300 }));
  const ohr = parseJson('247ohr_2026_03-uuid.json', { deviceDays: [{ date: '2026-03-01', samples }, { date: '2026-03-02', samples: samples.slice(0, 10) }] });
  assert.deepEqual(byKind(ohr.measures), { 'low_hr:2026-03-01': 52 }, '5th percentile; days with few samples skipped');
});

test('AccessLink JSON', () => {
  const r = parseJson('nightly-recharge.json', { recharges: [{ date: '2026-03-01', heart_rate_avg: 55, heart_rate_variability_avg: 44, breathing_rate_avg: 14.2, ans_charge: 3.1 }] });
  assert.deepEqual(byKind(r.measures), { 'night_hr:2026-03-01': 55, 'hrv:2026-03-01': 44, 'breathing:2026-03-01': 14.2, 'ans:2026-03-01': 3.1 });
  const s = parseJson('sleep.json', { nights: [{ date: '2026-03-01', light_sleep: 14400, deep_sleep: 4800, rem_sleep: 5400, sleep_score: 81 }] });
  assert.deepEqual(byKind(s.measures), { 'sleep_min:2026-03-01': 410, 'sleep_score:2026-03-01': 81 });
  const e = parseJson('exercises.json', [{ id: 'x1', start_time: '2026-03-01T10:00:00', duration: 'PT1H30M', distance: 30000, calories: 900,
    heart_rate: { average: 130, maximum: 165 }, sport: 'CYCLING', training_load: 120 }]);
  assert.equal(e.workouts[0].durationS, 5400);
  assert.equal(e.workouts[0].hrAvg, 130);
  assert.equal(e.workouts[0].sport, 'Cycling');
});

test('Polar Flow CSV and its locale-dependent dates', () => {
  assert.equal(parseCsvDate('17-09-2024'), '2024-09-17');
  assert.equal(parseCsvDate('09/18/2019'), '2019-09-18');
  assert.equal(parseCsvDate('04/05/2018'), '2018-05-04', 'ambiguous → day first');
  assert.equal(seconds('00:48:45'), 2925);
  const csv = [
    'Name,Sport,Date,Start time,Duration,Total distance (km),Average heart rate (bpm),Average speed (km/h),Max speed (km/h),Average pace (min/km),Max pace (min/km),Calories,Fat percentage of calories(%),Average cadence (rpm),Average stride length (cm),Running index,Training load,Ascent (m),Descent (m),Notes,Height (cm),Weight (kg),HR max,HR sit,VO2max,',
    'Test Person,RUNNING,17-09-2024,18:06:11,00:48:45,8.72,152,10.7,19.8,05:36,03:02,624,24,80,,58,100,69,53,,180,80,190,55,52,',
    'Sample rate,Time,HR (bpm),Speed (km/h),',
    '1,00:00:00,99,4.8,',
  ].join('\n');
  const [w] = parseCsv('Test_2024-09-17_18-06-11.csv', csv).workouts;
  assert.deepEqual(w, { id: 'polar:w:2024-09-17T18:06:11', start: '2024-09-17T18:06:11', sport: 'Running', durationS: 2925, distanceM: 8720,
    hrAvg: 152, hrMax: null, kcal: 624, load: 100, source: 'polar' });
});

test('whole export ZIP', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'polar-'));
  const files = {
    'training-session-2026-03-01T07:30:00-9000000001-aaaa.json': SESSION_NEW,
    'training-target-2026-03-05-bbbb.json': SESSION_NEW,
    'activity-2026-03-01-cccc.json': { date: '2026-03-01', summary: { stepCount: 8000 } },
    'nightly_recovery_123-dddd.json': [{ night: '2026-03-01', meanNightlyRecoveryRmssd: 50 }],
    'ppi_samples_2026_03_1-eeee.json': { big: true },
    'account-data-ffff.json': { username: 'x' },
  };
  for (const [n, d] of Object.entries(files)) writeFileSync(join(dir, n), JSON.stringify(d));
  execFileSync('zip', ['-q', join(dir, 'export.zip'), ...Object.keys(files)], { cwd: dir });
  const blob = new Blob([readFileSync(join(dir, 'export.zip'))]);
  const file = Object.assign(blob, { name: 'polar-user-data-export.zip' });
  const res = await importFiles([file]);
  assert.equal(res.workouts.length, 1);
  assert.deepEqual(byKind(res.measures), { 'steps:2026-03-01': 8000, 'hrv:2026-03-01': 50 });
  assert.equal(res.stats.files, 5, 'PPI samples are not read');
  assert.deepEqual(res.stats.skipped.sort(), ['account-data-ffff.json', 'training-target-2026-03-05-bbbb.json']);
});
