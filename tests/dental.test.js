import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teethState, toothBadges, costsByYear, parseDentalReply, normSurfaces, surfaceLabel, toothName, ALL_TEETH } from '../js/dental-data.js';

const visit = (date, items, extra = {}) => ({ id: date, date, items, ...extra });

test('FDI numbering', () => {
  assert.equal(ALL_TEETH.length, 32);
  assert.equal(toothName('16'), 'upper right first molar');
  assert.equal(toothName('31'), 'lower left central incisor');
  assert.equal(toothName('48'), 'lower right third molar (wisdom tooth)');
});

test('surfaces', () => {
  assert.equal(normSurfaces('m-o-d'), 'MOD');
  assert.equal(normSurfaces('VP'), 'BL', 'vestibular → buccal, palatal → lingual');
  assert.equal(normSurfaces('I'), 'O');
  assert.equal(surfaceLabel('O', '11'), 'I', 'incisal on front teeth');
  assert.equal(surfaceLabel('O', '36'), 'O');
});

test('tooth state follows the history in date order', () => {
  const st = teethState([
    visit('2024-01-01', [{ tooth: '26', procedure: 'crown' }]),
    visit('2021-01-01', [{ tooth: '36', procedure: 'filling', surfaces: 'MO' }, { tooth: '26', procedure: 'root_canal' }, { tooth: '17', procedure: 'watch' }]),
    visit('2022-01-01', [{ tooth: '36', procedure: 'filling', surfaces: 'D' }, { tooth: '38', procedure: 'extraction' }, { tooth: '17', procedure: 'filling', surfaces: 'O' }]),
    visit('2023-01-01', [{ tooth: '46', procedure: 'extraction' }, { tooth: '46', procedure: 'implant' }]),
  ]);
  assert.equal(st['36'].surfaces, 'MOD');
  assert.deepEqual(toothBadges(st['26']), ['C', 'RC']);
  assert.equal(st['38'].present, false);
  assert.deepEqual(toothBadges(st['38']), ['×']);
  assert.deepEqual(toothBadges(st['46']), ['I'], 'implant after extraction');
  assert.equal(st['17'].watch, false, 'treated after being watched');
  assert.equal(st['11'].history.length, 0);
});

test('costs and Claude replies', () => {
  const c = costsByYear([
    visit('2021-03-10', [{ price: 65 }, { price: 120 }], { currency: 'EUR' }),
    visit('2021-09-01', [], { currency: 'EUR', total: 100 }),
    visit('2022-09-05', [{ price: 4800 }], { currency: 'UAH' }),
  ]);
  assert.deepEqual(c, [{ year: '2022', currency: 'UAH', total: 4800 }, { year: '2021', currency: 'EUR', total: 285 }]);
  const [v] = parseDentalReply('```json\n{"visits":[{"date":"2026-02-03","clinic":"Zahnarzt X","currency":"€","total":"230.5","next_checkup":"2026-08-03","items":[{"tooth":"46","procedure":"filling","surfaces":"m o","price":120.5},{"tooth":"99","procedure":"teleport","price":110}]}]}\n```');
  assert.equal(v.currency, 'EUR');
  assert.equal(v.total, 230.5);
  assert.equal(v.nextCheckup, '2026-08-03');
  assert.deepEqual([v.items[0].tooth, v.items[0].surfaces, v.items[1].tooth, v.items[1].procedure], ['46', 'MO', '', 'other']);
});
