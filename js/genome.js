// Reads raw DNA files on the device: consumer chip files (23andMe, tellmeGen and
// similar "rsid, chromosome, position, genotype" text files) and VCF files from
// genome sequencing (plain, .vcf.gz or in a ZIP). Only the variants the app explains
// are kept; the rest of the file is never stored.

import { listZip, entryStream } from './zip.js';

// Parses lines of a raw genotype file. Keeps SNPs whose rsID is in `wanted`, or
// whose GRCh37 "chromosome:position" is in `byPosition` (tellmeGen and 23andMe
// sometimes use internal IDs instead of rsIDs). `sites` (rsid → { chrom, pos, pos38,
// normal, variant, ref37 }) is used for VCF files, which often have no rsIDs.
export function createParser(wanted, byPosition = new Map(), sites = {}) {
  const snps = {};
  const meta = { total: 0, comments: [], layout: null };
  let rest = '';
  let vcf = null;

  function line(l) {
    if (!l) return;
    if (vcf) return vcf.line(l);
    if (!meta.total && (l.startsWith('##fileformat=VCF') || l.startsWith('#CHROM\t'))) {
      vcf = vcfReader(wanted, sites);
      return vcf.line(l);
    }
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
          chrom: lower.findIndex((x) => /^chr/.test(x)),
          pos: lower.findIndex((x) => /^pos/.test(x)),
          gt: lower.findIndex((x) => /genotype|^result/.test(x)),
          a1: lower.findIndex((x) => /^allele ?1/.test(x)),
          a2: lower.findIndex((x) => /^allele ?2/.test(x)),
        };
        return;
      }
      meta.layout = c.length >= 5 ? { rsid: 0, chrom: 1, pos: 2, gt: -1, a1: 3, a2: 4 } : { rsid: 0, chrom: 1, pos: 2, gt: 3, a1: -1, a2: -1 };
    }
    const id = (c[meta.layout.rsid] ?? '').toLowerCase();
    if (!id || !/^\d+$/.test(c[meta.layout.pos] ?? '')) return; // not a marker row
    meta.total++;
    const chrom = String(c[meta.layout.chrom] ?? '').replace(/^chr/i, '');
    const key = wanted.has(id) ? id : byPosition.get(`${chrom}:${c[meta.layout.pos]}`);
    if (!key) return;
    let gt = meta.layout.gt >= 0 ? c[meta.layout.gt] : `${c[meta.layout.a1] ?? ''}${c[meta.layout.a2] ?? ''}`;
    gt = (gt ?? '').toUpperCase().replace(/[^ACGTID-]/g, '');
    if (gt && !/^-+$|^0+$/.test(gt)) snps[key] = gt;
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
      if (vcf) return vcf.end();
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

// ---- VCF -------------------------------------------------------------------------
//
// One line per position: CHROM POS ID REF ALT QUAL FILTER INFO FORMAT SAMPLE. The
// genotype (GT, e.g. 0/1 or 1|1) indexes REF and ALT. Sequencing files usually list
// only positions that differ from the reference genome; gVCF files also have
// "reference blocks" (END=) covering stretches that match it.

const BUILD_BY_CHR1_LENGTH = { 249250621: 'GRCh37', 248956422: 'GRCh38' };
const SAMPLE_LINES = 20000; // lines used to tell what kind of VCF this is
const OK_FILTER = new Set(['PASS', '.', 'RefCall']);

function vcfReader(wanted, sites) {
  const snps = {};
  const seen = new Set(); // sites with a line in the file, usable or not
  const st = { total: 0, contigBuild: '', refBuild: '', sources: [], sample: null, sampled: 0, sampledRef: 0, blocks: 0, matched: { GRCh37: 0, GRCh38: 0 } };
  // Each site at its position in both builds, until the header tells which applies.
  const byChrom = new Map();
  for (const [rsid, s] of Object.entries(sites)) {
    for (const [build, pos] of [['GRCh37', s.pos], ['GRCh38', s.pos38]]) {
      if (!pos) continue;
      if (!byChrom.has(s.chrom)) byChrom.set(s.chrom, []);
      byChrom.get(s.chrom).push({ rsid, build, pos, s });
    }
  }
  const build = () => st.contigBuild || st.refBuild;
  const refBase = (s, b) => (b === 'GRCh37' ? s.ref37 ?? s.normal : s.normal);

  function header(l) {
    let m;
    if ((m = l.match(/^##contig=<ID=(?:chr)?1,(?:.*,)?length=(\d+)/i))) st.contigBuild = BUILD_BY_CHR1_LENGTH[m[1]] ?? st.contigBuild;
    else if (l.startsWith('##reference=') || l.startsWith('##assembly=')) {
      st.refBuild ||= /grch38|hg38|hs38|grch_38/i.test(l) ? 'GRCh38' : /grch37|hg19|b37|hs37|g1k_v37/i.test(l) ? 'GRCh37' : '';
    } else if (l.startsWith('##source=') && st.sources.length < 5) st.sources.push(l.slice(9));
    else if (l.startsWith('#CHROM')) st.sample = l.split('\t')[9] ?? '';
  }

  // Genotype of the first sample as allele indexes, or null (no call, no GT).
  function genotype(c) {
    const gi = (c[8] ?? '').split(':').indexOf('GT');
    if (gi < 0) return null;
    const gt = (c[9] ?? '').split(':')[gi] ?? '';
    const idx = gt.split(/[/|]/);
    return idx.some((x) => !/^\d+$/.test(x)) ? null : idx.map(Number);
  }

  function record(l) {
    st.total++;
    const t1 = l.indexOf('\t');
    const t2 = l.indexOf('\t', t1 + 1);
    const t3 = l.indexOf('\t', t2 + 1);
    const t4 = l.indexOf('\t', t3 + 1);
    const t5 = l.indexOf('\t', t4 + 1);
    if (t5 < 0) return;
    const alt = l.slice(t4 + 1, t5);
    const symbolic = alt === '.' || /^<[^>]+>(,<[^>]+>)*$/.test(alt); // reference-only line
    if (st.sampled < SAMPLE_LINES) {
      st.sampled++;
      const gt = genotype(l.split('\t'));
      if (gt && gt.every((x) => x === 0)) st.sampledRef++;
      if (symbolic && /[\t;]END=\d/.test(l)) st.blocks++;
    }
    const id = l.slice(t2 + 1, t3);
    const byId = id.length > 2 ? id.toLowerCase().split(';').find((x) => wanted.has(x) && sites[x]) : null;
    const list = byChrom.get(l.slice(0, t1).replace(/^chr/i, ''));
    if (!list && !byId) return;
    const pos = +l.slice(t1 + 1, t2);
    const refLen = t4 - t3 - 1;
    const b = build();
    if (byId) use(l, { rsid: byId, s: sites[byId], build: b }, false);
    for (const x of list ?? []) {
      if ((b && x.build !== b) || x.rsid === byId) continue;
      if (x.pos === pos) {
        if (use(l, x, false)) st.matched[x.build]++;
      } else if (pos < x.pos) {
        if (pos + refLen - 1 >= x.pos) seen.add(x.rsid); // a deletion spanning the site
        else if (symbolic && b) {
          const end = l.match(/[\t;]END=(\d+)/);
          if (end && +end[1] >= x.pos) use(l, x, true);
        }
      }
    }
  }

  // A line at (or, for a reference block, covering) a site. False when the line is
  // about something else at that position.
  function use(l, x, block) {
    const { rsid, s } = x;
    const c = l.split('\t');
    const ref = c[3].toUpperCase();
    const known = (a) => a === s.normal || a === s.variant;
    if (!block && !known(ref) && !c[4].toUpperCase().split(',').some(known)) return false; // something else at this position
    seen.add(rsid);
    const gt = OK_FILTER.has(c[6]) ? genotype(c) : null;
    if (!gt) return true;
    let calls;
    if (block) {
      if (!gt.every((i) => i === 0)) return true;
      calls = gt.map(() => refBase(s, x.build));
    } else {
      const alleles = [ref, ...c[4].toUpperCase().split(',')];
      calls = gt.map((i) => alleles[i]);
    }
    if (calls.every((a) => known(a))) snps[rsid] = calls.join('');
    return true;
  }

  return {
    line(l) {
      if (l.startsWith('#')) header(l);
      else record(l);
    },
    end() {
      if (st.sample === null && !st.total) return { snps, total: 0 };
      if (!st.sample) throw new Error('This VCF file has no genotype column (it lists variants, not your genotypes).');
      const b = build() || (st.matched.GRCh38 > st.matched.GRCh37 ? 'GRCh38' : st.matched.GRCh37 > st.matched.GRCh38 ? 'GRCh37' : '');
      // A whole-genome file that lists only differences from the reference: a site
      // with no line has the reference genotype. Only concluded where the reference is
      // the normal allele — a missing line never counts as a variant.
      const variantOnly = st.sampled > 0 && st.sampledRef / st.sampled < 0.2 && !st.blocks;
      const wholeGenome = st.total >= 1000000;
      const inferred = [];
      if (variantOnly && wholeGenome && b) {
        for (const [rsid, s] of Object.entries(sites)) {
          if (snps[rsid] || seen.has(rsid) || refBase(s, b) !== s.normal) continue;
          snps[rsid] = s.normal + s.normal;
          inferred.push(rsid);
        }
      }
      const text = st.sources.join(' ');
      return {
        snps,
        inferred,
        total: st.total,
        format: 'VCF',
        wholeGenome,
        provider: /dante/i.test(text) ? 'Dante Labs' : /nebula/i.test(text) ? 'Nebula Genomics' : /sequencing\.com/i.test(text) ? 'Sequencing.com' : '',
        build: b,
      };
    },
  };
}

// ---- reading files ----------------------------------------------------------------

const isGzip = (b) => b[0] === 0x1f && b[1] === 0x8b;
// bgzip (what .vcf.gz files use): many small gzip members, each giving its size.
const isBgzf = (b) => isGzip(b) && b[2] === 8 && (b[3] & 4) && b[12] === 66 && b[13] === 67 && b[14] === 2 && b[15] === 0;

function concat(a, b) {
  if (!a.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

// Uncompressed bytes of a stream that may be gzip-compressed. Browsers' gzip
// decoder stops after the first member, so bgzip blocks are inflated one by one.
async function* bytesOf(stream, onRead) {
  const reader = stream.getReader();
  let buf = new Uint8Array(0);
  let done = false;
  const fill = async (n) => {
    while (buf.length < n && !done) {
      const r = await reader.read();
      if (r.done) done = true;
      else {
        onRead(r.value.length);
        buf = concat(buf, r.value);
      }
    }
    return buf.length >= n;
  };
  await fill(18);
  if (!isGzip(buf)) {
    if (buf.length) yield buf;
    for (;;) {
      const r = await reader.read();
      if (r.done) return;
      onRead(r.value.length);
      yield r.value;
    }
  }
  if (!isBgzf(buf)) {
    let first = buf;
    const rest = new ReadableStream({ async pull(c) {
      if (first) { c.enqueue(first); first = null; return; }
      const r = await reader.read();
      if (r.done) c.close();
      else { onRead(r.value.length); c.enqueue(r.value); }
    } });
    const out = rest.pipeThrough(new DecompressionStream('gzip')).getReader();
    for (;;) {
      const r = await out.read();
      if (r.done) return;
      yield r.value;
    }
  }
  for (;;) {
    const blocks = [];
    while (blocks.length < 64 && (await fill(18))) {
      if (!isBgzf(buf)) throw new Error('The .gz file is damaged.');
      const size = (buf[16] | (buf[17] << 8)) + 1;
      if (!(await fill(size))) throw new Error('The .gz file ends early — was the download complete?');
      blocks.push(buf.slice(0, size));
      buf = buf.subarray(size);
    }
    if (!blocks.length) return;
    const out = await Promise.all(blocks.map((b) => new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));
    for (const o of out) yield new Uint8Array(o);
  }
}

const TEXT = /\.(txt|csv|tsv|vcf|vcf\.gz)$/i;

// Reads a raw file (or a ZIP containing one). Returns { snps, total, provider, build,
// fileName, format, inferred }. onProgress(fraction) is called while reading.
export async function readGenomeFile(file, wanted, byPosition, sites = {}, onProgress = () => {}) {
  const parser = createParser(wanted, byPosition, sites);
  let name = file.name;
  let stream;
  let size = file.size;
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const entries = (await listZip(file)).filter((e) => TEXT.test(e.name) && !/^__macosx/i.test(e.name)).sort((a, b) => b.size - a.size);
    if (!entries.length) throw new Error('No raw data text or VCF file found in the ZIP.');
    name = entries[0].name;
    size = entries[0].compSize;
    stream = await entryStream(file, entries[0]);
  } else {
    stream = file.stream();
  }
  let read = 0;
  let shown = 0;
  const decoder = new TextDecoder();
  for await (const chunk of bytesOf(stream, (n) => { read += n; })) {
    parser.push(decoder.decode(chunk, { stream: true }));
    if (size && read / size - shown >= 0.01) onProgress((shown = read / size));
  }
  parser.push(decoder.decode());
  const out = parser.end();
  if (!out.total) throw new Error('This doesn’t look like a raw DNA data file (no marker rows with a position found).');
  if (!out.provider) out.provider = out.format === 'VCF' ? (/dante/i.test(name) ? 'Dante Labs' : /nebula/i.test(name) ? 'Nebula Genomics' : out.wholeGenome ? 'Whole genome (VCF)' : 'VCF file')
    : /23andme|genome_/i.test(name) ? '23andMe' : /tellmegen/i.test(name) ? 'tellmeGen' : 'Other';
  return { ...out, fileName: name.split('/').pop() };
}
