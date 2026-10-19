// Reads consumer raw DNA files (23andMe, tellmeGen and similar "rsid, chromosome,
// position, genotype" text files) on the device. Only the variants the app explains
// are kept; the rest of the file is never stored.

import { listZip, readEntry } from './zip.js';

// Parses lines of a raw genotype file. `wanted` is a Set of rsIDs to keep.
export function createParser(wanted) {
  const snps = {};
  const meta = { total: 0, comments: [], layout: null };
  let rest = '';

  function line(l) {
    if (!l) return;
    if (l.startsWith('#')) {
      if (meta.comments.length < 40) meta.comments.push(l);
      return;
    }
    const sep = l.includes('\t') ? '\t' : l.includes(',') ? ',' : /\s+/;
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (!meta.layout) {
      // Header row (rsid/chromosome/position/genotype or allele1/allele2)?
      const lower = c.map((x) => x.toLowerCase());
      if (lower.some((x) => /^(rsid|snp|name|marker)/.test(x))) {
        meta.layout = {
          rsid: lower.findIndex((x) => /^(rsid|snp|name|marker)/.test(x)),
          gt: lower.findIndex((x) => /genotype|^result/.test(x)),
          a1: lower.findIndex((x) => /^allele ?1/.test(x)),
          a2: lower.findIndex((x) => /^allele ?2/.test(x)),
        };
        return;
      }
      meta.layout = c.length >= 5 ? { rsid: 0, gt: -1, a1: 3, a2: 4 } : { rsid: 0, gt: 3, a1: -1, a2: -1 };
    }
    const rsid = c[meta.layout.rsid];
    if (!rsid || !/^(rs|i)\d+$/i.test(rsid)) return;
    meta.total++;
    if (!wanted.has(rsid.toLowerCase())) return;
    let gt = meta.layout.gt >= 0 ? c[meta.layout.gt] : `${c[meta.layout.a1] ?? ''}${c[meta.layout.a2] ?? ''}`;
    gt = (gt ?? '').toUpperCase().replace(/[^ACGTID-]/g, '');
    if (gt && !/^-+$|^0+$/.test(gt)) snps[rsid.toLowerCase()] = gt;
  }

  return {
    push(chunk) {
      const parts = (rest + chunk).split(/\r?\n/);
      rest = parts.pop();
      for (const p of parts) line(p.trim());
    },
    end() {
      line(rest.trim());
      rest = '';
      const text = meta.comments.join('\n');
      return {
        snps,
        total: meta.total,
        provider: /23andme/i.test(text) ? '23andMe' : /tellmegen/i.test(text) ? 'tellmeGen' : '',
        build: /build 38|grch38|hg38/i.test(text) ? 'GRCh38' : /build 37|grch37|hg19/i.test(text) ? 'GRCh37' : '',
      };
    },
  };
}

async function streamText(blobOrText, parser) {
  if (typeof blobOrText === 'string') { parser.push(blobOrText); return; }
  const reader = blobOrText.stream().pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.push(value);
  }
}

// Reads a raw file (or a ZIP containing one). Returns { snps, total, provider, build, fileName }.
export async function readGenomeFile(file, wanted) {
  const parser = createParser(wanted);
  let name = file.name;
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const entries = (await listZip(file)).filter((e) => /\.(txt|csv|tsv)$/i.test(e.name)).sort((a, b) => b.size - a.size);
    if (!entries.length) throw new Error('No raw data text file found in the ZIP.');
    name = entries[0].name;
    await streamText(await readEntry(file, entries[0]), parser);
  } else {
    await streamText(file, parser);
  }
  const out = parser.end();
  if (!out.total) throw new Error('This doesn’t look like a raw DNA data file (no rsID lines found).');
  if (!out.provider) out.provider = /23andme|genome_/i.test(name) ? '23andMe' : /tellmegen/i.test(name) ? 'tellmeGen' : 'Other';
  return { ...out, fileName: name.split('/').pop() };
}
