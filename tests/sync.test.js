import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, fingerprints, merge, changes, referencedFiles, newMeta, keyFromMeta, encryptJson, decryptJson, encrypt, decrypt, packFile, unpackFile, toB64, fromB64 } from '../js/sync-core.js';

const r = (id, extra = {}) => ({ id, date: '2026-01-01', lab: 'Lab', ...extra });
const snap = (reports, extra = {}) => ({ reports, obs: [], ...extra });
const ids = (s) => s.reports.map((x) => x.id).sort();

test('fingerprints ignore key order', () => {
  assert.equal(hash({ a: 1, b: [1, { c: 2, d: 3 }] }), hash({ b: [1, { d: 3, c: 2 }], a: 1 }));
  assert.notEqual(hash({ a: 1 }), hash({ a: 2 }));
});

test('first sync combines both devices', () => {
  const { merged } = merge(null, snap([r('a'), r('b')]), snap([r('b'), r('c')]));
  assert.deepEqual(ids(merged), ['a', 'b', 'c']);
});

test('three-way merge: edits, additions and deletions carry over', () => {
  const baseSnap = snap([r('a'), r('b'), r('c'), r('d')]);
  const base = fingerprints(baseSnap);
  const local = snap([r('a', { lab: 'edited here' }), r('b'), r('d'), r('n1')]); // c deleted here, n1 added
  const remote = snap([r('a'), r('b', { lab: 'edited there' }), r('c'), r('n2')]); // d deleted there, n2 added
  const { merged, conflicts } = merge(base, local, remote);
  assert.equal(conflicts, 0);
  assert.deepEqual(ids(merged), ['a', 'b', 'n1', 'n2'], 'c and d stay deleted');
  assert.equal(merged.reports.find((x) => x.id === 'a').lab, 'edited here');
  assert.equal(merged.reports.find((x) => x.id === 'b').lab, 'edited there');
});

test('conflicts: the newer edit wins; an edit beats a deletion', () => {
  const base = fingerprints(snap([r('a'), r('b')]));
  const local = snap([r('a', { lab: 'mine', updated: '2026-05-02T10:00:00Z' }), r('b', { lab: 'kept' })]);
  const remote = snap([r('a', { lab: 'theirs', updated: '2026-05-03T10:00:00Z' })]); // b deleted there
  const { merged, conflicts } = merge(base, local, remote);
  assert.equal(conflicts, 1);
  assert.equal(merged.reports.find((x) => x.id === 'a').lab, 'theirs');
  assert.equal(merged.reports.find((x) => x.id === 'b').lab, 'kept', 'edited here, deleted there: keep the edit');
});

test('changes and referenced files', () => {
  const from = snap([r('a'), r('b')]);
  const to = snap([r('a', { lab: 'x' }), r('c')]);
  const c = changes(from, to);
  assert.deepEqual([c.put.reports.map((x) => x.id), c.del.reports, c.count], [['a', 'c'], ['b'], 3]);
  assert.equal(changes(from, from).count, 0);
  const files = referencedFiles({ reports: [r('a', { files: [{ id: 'f1' }] })], vaccines: [{ id: 'v', files: [{ id: 'f2' }] }], dental: [{ id: 'd', files: [] }] });
  assert.deepEqual([...files].sort(), ['f1', 'f2']);
});

test('encryption: round trip, wrong passphrase, tampering', async () => {
  const { meta, key } = await newMeta('correct horse battery staple');
  assert.equal(meta.kdf.iterations, 600000);
  assert.ok(!JSON.stringify(meta).includes('correct horse'), 'no passphrase in meta');
  const again = await keyFromMeta(meta, 'correct horse battery staple');
  const data = await encryptJson(key, { stores: { reports: [r('a', { lab: 'Секретна лабораторія' })] } });
  assert.ok(!new TextDecoder().decode(data).includes('Секретна'), 'ciphertext only');
  assert.equal((await decryptJson(again, data)).stores.reports[0].lab, 'Секретна лабораторія');
  await assert.rejects(keyFromMeta(meta, 'wrong passphrase!'), /Wrong passphrase/);
  const bad = data.slice();
  bad[bad.length - 1] ^= 1;
  await assert.rejects(decrypt(key, bad));
  const twice = [await encrypt(key, new Uint8Array([1, 2, 3])), await encrypt(key, new Uint8Array([1, 2, 3]))];
  assert.notDeepEqual(twice[0], twice[1], 'fresh IV each time');
});

test('photos are packed with type and name', async () => {
  const bytes = new Uint8Array(70000).map((_, i) => i % 251);
  const packed = await packFile({ id: 'f', type: 'image/jpeg', name: 'scan.jpg', blob: new Blob([bytes], { type: 'image/jpeg' }) });
  const back = unpackFile('f', packed);
  assert.deepEqual([back.id, back.type, back.name], ['f', 'image/jpeg', 'scan.jpg']);
  assert.deepEqual(new Uint8Array(await back.blob.arrayBuffer()), bytes);
  assert.deepEqual(fromB64(toB64(bytes)), bytes, 'base64 for large arrays');
});
