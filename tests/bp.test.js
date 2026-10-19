import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escCategory, eshGrade, homeAverage, bpFindings } from '../js/bp-eval.js';
import { parseBpCsv, parseBpReply } from '../js/bp.js';

const r = (time, sys, dia, place = 'home') => ({ id: time, time, sys, dia, place });
const NOW = Date.parse('2026-10-19T12:00');

test('ESC 2024 categories and ESH 2023 grades', () => {
  assert.equal(escCategory(118, 68, 'home'), 'non-elevated');
  assert.equal(escCategory(118, 72, 'home'), 'elevated', 'the higher of the two decides');
  assert.equal(escCategory(134, 84, 'home'), 'elevated');
  assert.equal(escCategory(135, 80, 'home'), 'hypertension');
  assert.equal(escCategory(138, 88, 'clinic'), 'elevated');
  assert.equal(escCategory(140, 80, 'clinic'), 'hypertension');
  assert.equal(eshGrade(142, 88), 'isolated systolic hypertension, grade 1');
  assert.equal(eshGrade(150, 95), 'grade 1');
  assert.equal(eshGrade(165, 95), 'grade 2');
  assert.equal(eshGrade(120, 112), 'grade 3');
  assert.equal(eshGrade(132, 80), 'high-normal');
  assert.equal(eshGrade(125, 80), null);
});

test('home average needs at least 3 days', () => {
  const two = [r('2026-10-17T07:00', 130, 80), r('2026-10-18T07:00', 140, 90)];
  assert.equal(homeAverage(two).valid, false);
  const week = ['13', '14', '15', '16', '17', '18'].flatMap((d) => [r(`2026-10-${d}T07:00`, 138, 86), r(`2026-10-${d}T21:00`, 134, 84)]);
  const avg = homeAverage([...week, r('2026-10-01T07:00', 180, 100), r('2026-10-16T10:00', 150, 95, 'clinic')]);
  assert.equal(avg.valid, true);
  assert.equal(avg.n, 12, 'only the last 7 days, only home readings');
  assert.equal(avg.sys, 136);
  const f = bpFindings(week, NOW);
  assert.equal(f[0].title, 'Home average 136/85: hypertension range');
});

test('very high reading alert', () => {
  const f = bpFindings([r('2026-10-18T07:00', 182, 104)], NOW);
  assert.equal(f[0].level, 'alert');
  assert.match(f[0].text, /call emergency services/);
});

test('CSV from cuff apps and Claude replies', () => {
  const omron = 'Date,Time,Systolic (mmHg),Diastolic (mmHg),Pulse (bpm),Notes\n10/17/2026,07:12,131,83,64,\n18/10/2026,9:05 PM,128,80,66,';
  const rs = parseBpCsv(omron);
  assert.deepEqual(rs.map((x) => [x.time, x.sys, x.dia, x.pulse]), [['2026-10-17T07:12', 131, 83, 64], ['2026-10-18T21:05', 128, 80, 66]]);
  const de = 'Datum;Uhrzeit;Sys;Dia;Puls\n17.10.2026;07:30;125;79;61';
  assert.equal(parseBpCsv(de)[0].time, '2026-10-17T07:30');
  assert.throws(() => parseBpCsv('a,b\n1,2'), /columns/);
  const reply = '```json\n{"readings":[{"date":"2026-10-17","time":"07:10","sys":129,"dia":81,"pulse":62},{"date":"2026-10-17","time":"","sys":80,"dia":120}]}\n```';
  assert.deepEqual(parseBpReply(reply).map((x) => x.time), ['2026-10-17T07:10'], 'implausible rows dropped');
});
