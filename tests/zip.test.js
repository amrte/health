import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listZip, readEntry } from '../js/zip.js';

test('reads stored and deflated entries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  writeFileSync(join(dir, 'a.json'), JSON.stringify({ hello: 'wörld' }));
  writeFileSync(join(dir, 'big.txt'), 'x'.repeat(100000));
  execFileSync('zip', ['-q', '-0', join(dir, 's.zip'), 'a.json'], { cwd: dir });
  execFileSync('zip', ['-q', '-9', join(dir, 'd.zip'), 'a.json', 'big.txt'], { cwd: dir });
  for (const z of ['s.zip', 'd.zip']) {
    const blob = new Blob([readFileSync(join(dir, z))]);
    const entries = await listZip(blob);
    const a = entries.find((e) => e.name === 'a.json');
    assert.deepEqual(JSON.parse(await readEntry(blob, a)), { hello: 'wörld' });
    const big = entries.find((e) => e.name === 'big.txt');
    if (big) assert.equal((await readEntry(blob, big)).length, 100000);
  }
  await assert.rejects(listZip(new Blob(['not a zip'])), /Not a ZIP/);
});
