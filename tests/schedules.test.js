import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleAdvice, doseNumber } from '../js/schedules.js';

const TODAY = '2026-10-19';
const vac = (date, targets, dose = '') => ({ date, targets, dose });
const byTarget = (list) => Object.fromEntries(list.map((a) => [a.target, a]));

test('dose numbers', () => {
  assert.equal(doseNumber('3/3'), 3);
  assert.equal(doseNumber('2.'), 2);
  assert.equal(doseNumber('booster'), 'booster');
  assert.equal(doseNumber('Auffrischung'), 'booster');
  assert.equal(doseNumber(''), null);
});

test('Td: Germany every 10 years, Finland at 25/45/65', () => {
  const a = byTarget(scheduleAdvice([vac('2016-09-12', ['tetanus', 'diphtheria', 'pertussis', 'polio'], 'booster')], { birthYear: 1980 }, TODAY));
  assert.equal(a.tetanus.de.due, '2026-09-12');
  assert.equal(a.tetanus.de.status, 'overdue');
  assert.doesNotMatch(a.tetanus.de.text, /Tdap/, 'pertussis already given as an adult');
  assert.equal(a.tetanus.fi.due, '2025-07-01', 'age-45 booster');
  const b = byTarget(scheduleAdvice([vac('2024-03-01', ['tetanus', 'diphtheria'])], { birthYear: 1950 }, TODAY));
  assert.equal(b.tetanus.fi.due, '2034-03-01', 'every 10 years after 65');
  assert.match(b.tetanus.de.text, /Tdap/);
});

test('TBE boosters by country and age', () => {
  const first = byTarget(scheduleAdvice([vac('2021-06-02', ['tbe'], '3/3')], { birthYear: 1980 }, TODAY));
  assert.equal(first.tbe.fi.due, '2024-06-02');
  assert.equal(first.tbe.de.due, '2024-06-02');
  const later = byTarget(scheduleAdvice([
    vac('2010-04-01', ['tbe'], '1/3'), vac('2010-05-15', ['tbe'], '2/3'), vac('2011-04-01', ['tbe'], '3/3'),
    vac('2024-04-01', ['tbe'], 'booster'),
  ], { birthYear: 1980 }, TODAY));
  assert.equal(later.tbe.fi.due, '2034-04-01', 'FI: under 50 → 10 years');
  assert.equal(later.tbe.de.due, '2029-04-01', 'DE: under 60 → 5 years');
  const old = byTarget(scheduleAdvice([vac('2015-04-01', ['tbe'], '3/3'), vac('2025-04-01', ['tbe'], 'booster')], { birthYear: 1960 }, TODAY));
  assert.equal(old.tbe.fi.due, '2028-04-01', 'FI: over 60 → 3 years');
  assert.equal(old.tbe.de.due, '2028-04-01', 'DE: 60+ → 3 years');
  const series = byTarget(scheduleAdvice([vac('2026-09-01', ['tbe'], '1/3')], { birthYear: 1980 }, TODAY));
  assert.match(series.tbe.fi.text, /dose 2/);
  assert.equal(scheduleAdvice([], {}, TODAY).find((a) => a.target === 'tbe'), undefined);
});

test('seasonal and one-off vaccines by age', () => {
  const a = byTarget(scheduleAdvice([vac('2026-09-20', ['influenza'])], { birthYear: 1955 }, TODAY));
  assert.equal(a.influenza.fi.status, 'ok');
  assert.equal(a.influenza.de.status, 'ok');
  assert.equal(a.covid.fi.status, 'none', '71 < 80 in Finland');
  assert.equal(a.covid.de.status, 'none', '71 < 75 in Germany');
  assert.equal(a.pneumo.de.status, 'due', 'PCV20 from 60');
  assert.equal(a.zoster.de.status, 'due');
  assert.equal(a.zoster.fi.status, 'none');
  const young = byTarget(scheduleAdvice([], { birthYear: 1980 }, TODAY));
  assert.equal(young.influenza.de.status, 'none');
  assert.equal(young.tetanus.de.status, 'unknown');
  const noAge = byTarget(scheduleAdvice([], {}, TODAY));
  assert.equal(noAge.influenza.fi.status, 'unknown');
});
