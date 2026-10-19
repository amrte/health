import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, derive } from '../js/store.js';
import { demoData } from '../js/demo.js';
import { search, buildIndex } from '../js/search.js';

const d = demoData();
Object.assign(state, { reports: d.reports, obs: d.obs, vaccines: d.vaccines, measures: d.measures, workouts: d.workouts, bp: d.bp, genomes: d.genomes, profile: { sex: 'male', birthYear: 1980 } });
derive();
const items = buildIndex();
const first = (q) => search(q, items)[0];

test('test names in any language', () => {
  for (const q of ['ferritin', 'Феритин', 'P-Ferrit', 'ferr']) assert.equal(first(q).title, 'Ferritin', q);
  assert.equal(first('Hämoglobin').title, 'Hemoglobin');
  assert.equal(first('гемоглобін').title, 'Hemoglobin');
});

test('one typo is forgiven from 5 letters', () => {
  assert.equal(first('feritin').title, 'Ferritin');
  assert.equal(first('ферітин').title, 'Ferritin', 'Ukrainian spelling with і');
  assert.equal(first('hemoglobn').title, 'Hemoglobin');
  assert.equal(search('xyzzy', items).length, 0);
});

test('every kind of record is found', () => {
  const types = (q) => new Set(search(q, items).map((r) => r.type));
  assert.ok(types('boostrix').has('vaccine'));
  assert.ok(types('tetanus').has('vaccine'));
  assert.ok(types('HFE').has('dna'));
  assert.ok(types('rs4149056').has('dna'));
  assert.ok(types('running').has('workout'));
  assert.ok(types('Berlin').has('report'));
  assert.ok(types('thyroid').has('finding') || types('hypothyroidism').has('finding'));
  assert.equal(first('backup').href, '#/data');
  assert.equal(first('тиск').href, '#/bp');
  assert.equal(first('щеплення').href, '#/vaccines');
});

test('all words must match', () => {
  const r = search('ldl berlin', items);
  assert.ok(r.length >= 1);
  assert.ok(r.every((x) => /berlin/i.test(x.hay) && /ldl/i.test(x.hay)));
});
