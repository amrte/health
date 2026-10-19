// DNA: import raw data (23andMe, tellmeGen, VCF from sequencing) and explain a short list of variants.

import { h, toast, go } from './dom.js';
import { state, saveGenome, deleteGenome } from './store.js';
import { fmtDate } from './format.js';
import { pageHead } from './ui.js';
import { readGenomeFile } from './genome.js';
import { PANELS, SNPS, WANTED, BY_POSITION, DNA_SOURCES, DNA_REVIEWED, readSnp } from './dna-variants.js';
import { getMetric } from './metrics.js';

const LEVEL = { alert: ['▲', 'Discuss with a doctor'], attention: ['●', 'Worth a look'], info: ['ℹ', 'Good to know'], good: ['✓', 'Nothing notable'] };
let showSensitive = false;

const isInferred = (g, rsid) => !!g.inferred?.includes(rsid);

// Genotype lookup that prefers the first genome having a usable call, and a call
// read from a file over one taken as the reference genome.
function lookup(genomes) {
  return (rsid) => {
    for (const pass of [false, true]) {
      for (const g of genomes) {
        if (isInferred(g, rsid) !== pass) continue;
        const r = readSnp(rsid, g.snps[rsid]);
        if (r && r.count != null) return { ...r, provider: g.provider };
      }
    }
    return null;
  };
}

// For every SNP: what each file says, and whether they agree.
export function concordance(genomes) {
  const rows = [];
  for (const rsid of Object.keys(SNPS)) {
    const calls = genomes.map((g) => ({ provider: g.provider, r: readSnp(rsid, g.snps[rsid]) }));
    const counts = calls.map((c) => c.r?.count).filter((x) => x != null);
    rows.push({ rsid, calls, agree: counts.length > 1 ? counts.every((x) => x === counts[0]) : null });
  }
  return rows;
}

export function panelResults(genomes) {
  const g = lookup(genomes);
  return PANELS.map((p) => ({ panel: p, result: p.interpret(g) }));
}

function sourceLinks(ids) {
  return h('div', { class: 'finding-src' }, 'Source: ', ids.flatMap((id, i) => [i ? ' · ' : '', h('a', { href: DNA_SOURCES[id].url, target: '_blank', rel: 'noopener' }, DNA_SOURCES[id].short)]));
}

function callsLine(panel, genomes) {
  return h('div', { class: 'dna-calls' }, panel.snps.map((rsid) => {
    const s = SNPS[rsid];
    const per = genomes.map((gm) => {
      const r = readSnp(rsid, gm.snps[rsid]);
      return `${gm.provider}: ${r ? r.gt + (r.flipped ? ' (strand flipped)' : '') + (r.unexpected ? ' (unexpected alleles)' : '') + (isInferred(gm, rsid) ? ' (not listed, so same as the reference genome)' : '') : 'not tested'}`;
    });
    return h('div', null, h('strong', null, `${s.gene} ${s.name}`), h('span', { class: 'muted' }, ` ${rsid} · ${per.join(' · ')}`));
  }));
}

function panelCard(panel, result, genomes) {
  if (panel.optIn && !showSensitive) {
    return h('div', { class: 'finding' },
      h('div', { class: 'finding-title' }, panel.title),
      h('p', { class: 'finding-text' }, 'Hidden. This result concerns the risk of Alzheimer’s disease, which can’t currently be prevented. Many people prefer not to know, and medical genetics societies recommend counselling before predictive APOE testing.'),
      h('button', { class: 'btn', type: 'button', onclick: () => {
        if (confirm('Show your APOE result? It can’t be un-seen.')) { showSensitive = true; go('#/dna'); }
      } }, 'Show APOE result'));
  }
  const [icon, word] = LEVEL[result?.level] ?? ['–', 'Not tested'];
  return h('div', { class: `finding lv-${result?.level ?? 'none'}` },
    h('div', { class: 'finding-head' }, h('span', { class: 'finding-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'finding-level' }, word)),
    h('div', { class: 'finding-title' }, panel.title, result ? `: ${result.summary}` : ''),
    h('p', { class: 'finding-text' }, result ? result.text : 'These positions weren’t in your file(s). That means “not tested” — not “normal”.'),
    callsLine(panel, genomes),
    panel.related?.length ? h('div', { class: 'finding-src' }, 'Related tests: ', panel.related.flatMap((k, i) => [i ? ' · ' : '', state.byMetric.has(k)
      ? h('a', { href: `#/test/${k}` }, getMetric(k)?.name ?? k) : (getMetric(k)?.name ?? k)])) : null,
    sourceLinks(panel.sources));
}

function importCard() {
  const status = h('p', { class: 'muted small', role: 'status' });
  const input = h('input', { type: 'file', accept: '.zip,.txt,.csv,.tsv,.vcf,.gz,application/zip,application/gzip,text/plain,text/csv', class: 'offscreen', id: 'dna-in',
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      status.textContent = 'Reading the file…';
      try {
        const res = await readGenomeFile(file, WANTED, BY_POSITION, SNPS, (f) => { status.textContent = `Reading the file… ${Math.round(f * 100)} %`; });
        const genome = { id: `genome:${res.provider}`, provider: res.provider, fileName: res.fileName, importedAt: new Date().toISOString(),
          build: res.build, total: res.total, snps: res.snps, format: res.format, inferred: res.inferred };
        await saveGenome(genome);
        const n = Object.keys(res.snps).length;
        toast(`${res.provider}: ${n} of ${WANTED.size} variants found${res.inferred?.length ? ` (${res.inferred.length} same as the reference genome)` : ''}`);
        go('#/dna');
      } catch (err) {
        console.error(err);
        status.textContent = 'Import failed: ' + (err?.message ?? err);
      }
    } });
  return h('section', { class: 'card' },
    h('h2', null, 'Import raw DNA data'),
    h('ul', { class: 'steps plain' },
      h('li', null, h('strong', null, '23andMe: '), 'request the raw data download in your account settings. You receive a ZIP with a .txt file.'),
      h('li', null, h('strong', null, 'tellmeGen: '), 'Settings → Kits → Download raw data. You receive a ZIP with a .csv file (Starter and Advanced kits).'),
      h('li', null, h('strong', null, 'Genome sequencing (Dante, Nebula and others): '), 'the VCF file with your variants (.vcf or .vcf.gz, a few hundred MB). Choose the SNP/“variants” VCF, not the BAM/CRAM or FASTQ files. GRCh37 and GRCh38 both work. Reading a whole genome takes a minute or two.')),
    h('div', { class: 'btn-row' }, h('label', { class: 'btn primary', for: 'dna-in' }, 'Choose raw data file…'), input),
    status,
    h('p', { class: 'hint' }, `The file is read on this device. Only the ${WANTED.size} positions explained below are kept — the rest of your genome is not stored. Import both providers to compare them.`));
}

export function viewDna(root) {
  root.append(pageHead('DNA', { back: '#/reports', sub: 'A few well-studied variants from your raw data' }));
  const genomes = [...state.genomes].sort((a, b) => a.provider.localeCompare(b.provider));
  const vcf = genomes.some((g) => g.format === 'VCF');

  root.append(h('section', { class: 'card note-card' },
    h('strong', null, 'Read this first. '),
    'Consumer DNA chips are made for ancestry and traits, not diagnosis. A study of raw data sent for clinical confirmation found that about 40 % of reported variants in medically important genes were false positives. Have any result that would change a medical decision confirmed in a clinical laboratory. ',
    h('a', { href: DNA_SOURCES.dtc_fp.url, target: '_blank', rel: 'noopener' }, 'Tandy-Connor et al. 2018')));

  if (!genomes.length) {
    root.append(importCard());
    return;
  }

  root.append(h('section', { class: 'card list' }, genomes.map((g) => h('div', { class: 'row' },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, g.provider),
      h('div', { class: 'row-meta' }, `${g.fileName} · ${g.total.toLocaleString('en')} ${g.format === 'VCF' ? 'lines' : 'markers'} in file · ${Object.keys(g.snps).length} of ${WANTED.size} used · imported ${fmtDate(g.importedAt.slice(0, 10))}${g.build ? ' · ' + g.build : ''}`)),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${g.provider} data`, onclick: async () => {
      if (!confirm(`Remove the ${g.provider} DNA data from this device?`)) return;
      await deleteGenome(g.id);
      go('#/dna');
    } }, '×')))));

  if (genomes.length > 1) {
    const rows = concordance(genomes).filter((r) => r.agree != null);
    const disagree = rows.filter((r) => !r.agree);
    root.append(h('section', { class: 'card' },
      h('h2', null, `${genomes.map((g) => g.provider).join(' and ')} compared`),
      h('p', null, `They agree on ${rows.length - disagree.length} of ${rows.length} variants tested by both.`),
      disagree.length ? h('p', { class: 'warn' }, 'Different results for: ', disagree.map((r) => `${SNPS[r.rsid].gene} ${SNPS[r.rsid].name}`).join(', '), '. Treat these as unreliable until confirmed in a clinical lab.') : null));
  }

  const results = panelResults(genomes);
  for (const cat of ['Health', 'Medicines', 'Traits', 'Sensitive']) {
    const items = results.filter((x) => x.panel.category === cat);
    if (!items.length) continue;
    root.append(h('section', { class: 'group' }, h('h2', null, cat === 'Medicines' ? 'Medicines (pharmacogenetics)' : cat),
      h('div', { class: 'card findings' }, items.map((x) => panelCard(x.panel, x.result, genomes)))));
  }
  root.append(h('p', { class: 'muted small pad' }, `Variant explanations reviewed ${fmtDate(DNA_REVIEWED)}. Genotypes are read on the plus strand, as the providers report them. A missing variant means it wasn’t on the chip, not that you don’t have it.`,
    vcf ? ' Sequencing VCF files list only where you differ from the reference genome, so a position not listed in a whole-genome file is taken as the reference — but only where the reference is the normal allele; a variant is never assumed from a missing line. A position with too few reads looks the same as “not listed”, so confirm anything important in a clinical lab.' : ''));
  root.append(importCard());
}
