// Curated DNA variants with plain-language interpretation. Pure data and functions.
//
// Alleles are given on the GRCh37 plus strand, as 23andMe and tellmeGen raw files
// report them. Note: for factor V Leiden (rs6025) and ACTN3 577X (rs1815739) the
// GRCh37 reference base IS the variant — never infer risk from "reference vs other".
// Checked against LOVD/ClinVar HGVS, CPIC/PharmCAT and GeneReviews in 2026-10.

export const DNA_REVIEWED = '2026-10-19';

export const DNA_SOURCES = {
  gr_hfe: { short: 'GeneReviews HFE', title: 'HFE Hemochromatosis (GeneReviews)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK1440/' },
  gr_f5: { short: 'GeneReviews F5', title: 'Factor V Leiden Thrombophilia (GeneReviews)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK1368/' },
  gr_f2: { short: 'GeneReviews F2', title: 'Prothrombin Thrombophilia (GeneReviews)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK1148/' },
  cpic_statin: { short: 'CPIC 2022 statins', title: 'CPIC guideline for SLCO1B1, ABCG2 and CYP2C9 and statin-associated musculoskeletal symptoms (2022)', url: 'https://files.cpicpgx.org/data/guideline/publication/statins/2022/publication.pdf' },
  cpic_clopi: { short: 'CPIC 2022 clopidogrel', title: 'CPIC guideline for CYP2C19 genotype and clopidogrel therapy: 2022 update', url: 'https://doi.org/10.1002/cpt.2526' },
  cpic_warfarin: { short: 'CPIC 2017 warfarin', title: 'CPIC guideline for pharmacogenetics-guided warfarin dosing: 2017 update', url: 'https://pubmed.ncbi.nlm.nih.gov/28198005/' },
  acmg_mthfr: { short: 'ACMG 2013', title: 'ACMG practice guideline: lack of evidence for MTHFR polymorphism testing', url: 'https://pubmed.ncbi.nlm.nih.gov/23288205/' },
  cv_lct: { short: 'LOVD/ClinVar', title: 'LCT/MCM6 −13910C>T (rs4988235)', url: 'https://www.ncbi.nlm.nih.gov/snp/rs4988235' },
  cv_actn3: { short: 'ClinVar ACTN3', title: 'ACTN3 R577X (ClinVar)', url: 'https://www.ncbi.nlm.nih.gov/clinvar/variation/18312' },
  aafp_apoe: { short: 'AAFP 2018', title: 'Genetic testing for Alzheimer disease (Am Fam Physician 2018)', url: 'https://www.aafp.org/pubs/afp/issues/2018/0501/p600.pdf' },
  dtc_fp: { short: 'Tandy-Connor 2018', title: 'False-positive results released by direct-to-consumer genetic tests (Genet Med 2018;20:1515–1521)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6301953/' },
};

// Each SNP: normal and variant allele on the plus strand; GRCh37 position (pos) and
// GRCh38 position (pos38, for whole-genome VCF files). The reference genome carries
// the normal allele, except where ref37 says otherwise (GRCh38 has the normal allele
// at all of these). GRCh38 positions checked against PharmCAT, LOVD and MGeND.
export const SNPS = {
  rs1800562: { gene: 'HFE', name: 'C282Y', chrom: '6', pos: 26093141, pos38: 26092913, normal: 'G', variant: 'A' },
  rs1799945: { gene: 'HFE', name: 'H63D', chrom: '6', pos: 26091179, pos38: 26090951, normal: 'C', variant: 'G' },
  rs6025: { gene: 'F5', name: 'factor V Leiden', chrom: '1', pos: 169519049, pos38: 169549811, normal: 'C', variant: 'T', ref37: 'T' },
  rs1799963: { gene: 'F2', name: 'prothrombin G20210A', chrom: '11', pos: 46761055, pos38: 46739505, normal: 'G', variant: 'A' },
  rs4149056: { gene: 'SLCO1B1', name: 'c.521T>C (*5)', chrom: '12', pos: 21331549, pos38: 21178615, normal: 'T', variant: 'C' },
  rs4244285: { gene: 'CYP2C19', name: '*2', chrom: '10', pos: 96541616, pos38: 94781859, normal: 'G', variant: 'A' },
  rs4986893: { gene: 'CYP2C19', name: '*3', chrom: '10', pos: 96540410, pos38: 94780653, normal: 'G', variant: 'A' },
  rs12248560: { gene: 'CYP2C19', name: '*17', chrom: '10', pos: 96521657, pos38: 94761900, normal: 'C', variant: 'T' },
  rs9923231: { gene: 'VKORC1', name: '−1639G>A', chrom: '16', pos: 31107689, pos38: 31096368, normal: 'C', variant: 'T' },
  rs1799853: { gene: 'CYP2C9', name: '*2', chrom: '10', pos: 96702047, pos38: 94942290, normal: 'C', variant: 'T' },
  rs1057910: { gene: 'CYP2C9', name: '*3', chrom: '10', pos: 96741053, pos38: 94981296, normal: 'A', variant: 'C' },
  rs1801133: { gene: 'MTHFR', name: 'C677T', chrom: '1', pos: 11856378, pos38: 11796321, normal: 'G', variant: 'A' },
  rs4988235: { gene: 'LCT', name: '−13910C>T', chrom: '2', pos: 136608646, pos38: 135851076, normal: 'G', variant: 'A' },
  rs1815739: { gene: 'ACTN3', name: 'R577X', chrom: '11', pos: 66328095, pos38: 66560624, normal: 'C', variant: 'T', ref37: 'T' },
  rs429358: { gene: 'APOE', name: 'rs429358', chrom: '19', pos: 45411941, pos38: 44908684, normal: 'T', variant: 'C' },
  rs7412: { gene: 'APOE', name: 'rs7412', chrom: '19', pos: 45412079, pos38: 44908822, normal: 'C', variant: 'T' },
};

export const WANTED = new Set(Object.keys(SNPS));
export const BY_POSITION = new Map(Object.entries(SNPS).map(([rs, s]) => [`${s.chrom}:${s.pos}`, rs]));

const COMP = { A: 'T', T: 'A', C: 'G', G: 'C' };

// Reads a genotype for one SNP. Returns { gt, count, flipped } where count is the
// number of variant alleles (0–2, or 0–1 for single-letter calls), or null when
// missing or not interpretable.
export function readSnp(rsid, raw) {
  const s = SNPS[rsid];
  if (!raw || !s) return null;
  const letters = raw.split('');
  if (!letters.every((x) => 'ACGT'.includes(x))) return null;
  const ok = (ls) => ls.every((x) => x === s.normal || x === s.variant);
  let ls = letters;
  let flipped = false;
  if (!ok(ls)) {
    // A file on the minus strand: complement — unless the SNP is C/G or A/T, where a flip can't be told apart.
    const ambiguous = COMP[s.normal] === s.variant;
    const comp = ls.map((x) => COMP[x]);
    if (ambiguous || !ok(comp)) return { gt: raw, count: null, unexpected: true };
    ls = comp;
    flipped = true;
  }
  return { gt: ls.join(''), count: ls.filter((x) => x === s.variant).length, flipped };
}

const F = (level, summary, text) => ({ level, summary, text });

// Panels: each interprets one or more SNPs. `g(rsid)` returns readSnp() output.
export const PANELS = [
  {
    id: 'hfe', category: 'Health', title: 'Iron overload (HFE haemochromatosis)', snps: ['rs1800562', 'rs1799945'], related: ['ferritin', 'tsat'], sources: ['gr_hfe'],
    interpret(g) {
      const c = g('rs1800562')?.count;
      const h = g('rs1799945')?.count;
      if (c == null) return null;
      if (c === 2) return F('attention', 'Two copies of C282Y', 'This is the genotype behind most hereditary haemochromatosis. Iron values (ferritin, transferrin saturation) are often raised, but many people with it never develop iron-related disease. Worth discussing with a doctor and checking iron values; confirm the genotype in a clinical lab.');
      if (c === 1 && h === 1) return F('info', 'C282Y and H63D, one copy each', 'Compound heterozygous. The chance of iron-related disease is markedly lower than with two C282Y copies. Iron values show whether it matters for you.');
      if (c === 1) return F('info', 'Carrier of C282Y (one copy)', 'Carriers usually don’t develop iron overload, but children can inherit the variant.');
      if (h === 2) return F('info', 'Two copies of H63D', 'Usually of little clinical importance on its own.');
      if (h === 1) return F('good', 'One copy of H63D', 'Common and on its own not associated with iron overload.');
      return F('good', 'No C282Y or H63D found', 'Neither of the two common HFE variants was found.');
    },
  },
  {
    id: 'clot', category: 'Health', title: 'Blood clotting (factor V Leiden, prothrombin)', snps: ['rs6025', 'rs1799963'], sources: ['gr_f5', 'gr_f2'],
    interpret(g) {
      const f5 = g('rs6025')?.count;
      const f2 = g('rs1799963')?.count;
      if (f5 == null && f2 == null) return null;
      const parts = [];
      if (f5 === 2) parts.push('two copies of factor V Leiden');
      else if (f5 === 1) parts.push('one copy of factor V Leiden');
      if (f2 === 2) parts.push('two copies of prothrombin G20210A');
      else if (f2 === 1) parts.push('one copy of prothrombin G20210A');
      if (!parts.length) return F('good', 'Neither variant found', 'No factor V Leiden or prothrombin G20210A in the tested positions.');
      return F(f5 === 2 || f2 === 2 || (f5 && f2) ? 'alert' : 'attention', parts.join(' and ').replace(/^./, (x) => x.toUpperCase()),
        'These variants raise the risk of blood clots in the veins (several-fold for one copy, more for two or for both variants). Most carriers never have a clot. It matters for doctors when considering oestrogen-containing pills or hormone therapy, around surgery, and in pregnancy — tell them, and have it confirmed in a clinical lab.');
    },
  },
  {
    id: 'statin', category: 'Medicines', title: 'Statins (SLCO1B1)', snps: ['rs4149056'], related: ['ldl'], sources: ['cpic_statin'],
    interpret(g) {
      const c = g('rs4149056')?.count;
      if (c == null) return null;
      if (c === 2) return F('attention', 'Poor function (CC)', 'CPIC recommends an alternative statin depending on the potency needed. Higher simvastatin doses carry a higher risk of muscle side effects with this genotype. Mention it if a statin is ever considered.');
      if (c === 1) return F('info', 'Decreased function (TC)', 'CPIC: prescribe an alternative statin depending on the potency needed; if simvastatin is used, keep the dose below 20 mg a day. Mention it if a statin is ever considered.');
      return F('good', 'Normal function (TT)', 'CPIC: no change from the usual statin dosing.');
    },
  },
  {
    id: 'cyp2c19', category: 'Medicines', title: 'Clopidogrel and other drugs (CYP2C19)', snps: ['rs4244285', 'rs4986893', 'rs12248560'], sources: ['cpic_clopi'],
    interpret(g) {
      const n2 = g('rs4244285')?.count;
      const n3 = g('rs4986893')?.count;
      const n17 = g('rs12248560')?.count;
      if (n2 == null && n3 == null && n17 == null) return null;
      const noFn = (n2 ?? 0) + (n3 ?? 0);
      const inc = n17 ?? 0;
      let pheno;
      if (noFn >= 2) pheno = 'Poor metabolizer';
      else if (noFn === 1) pheno = 'Intermediate metabolizer';
      else if (inc === 2) pheno = 'Ultrarapid metabolizer';
      else if (inc === 1) pheno = 'Rapid metabolizer';
      else pheno = 'Normal metabolizer';
      const missing = [n2, n3, n17].some((x) => x == null) ? ' Not all three positions were in your file, so this may be incomplete.' : '';
      if (noFn >= 1) return F('attention', pheno, `CPIC (for heart patients after a stent or acute coronary syndrome): avoid standard-dose clopidogrel if possible; prasugrel or ticagrelor are alternatives. CYP2C19 also affects how some other medicines are broken down — tell doctors and pharmacists.${missing}`);
      return F('good', pheno, `CPIC: standard clopidogrel dosing.${missing}`);
    },
  },
  {
    id: 'warfarin', category: 'Medicines', title: 'Warfarin sensitivity (VKORC1, CYP2C9)', snps: ['rs9923231', 'rs1799853', 'rs1057910'], sources: ['cpic_warfarin'],
    interpret(g) {
      const v = g('rs9923231')?.count;
      const c2 = g('rs1799853')?.count;
      const c3 = g('rs1057910')?.count;
      if (v == null && c2 == null && c3 == null) return null;
      const notes = [];
      if (v) notes.push(`${v === 2 ? 'two copies' : 'one copy'} of VKORC1 −1639A`);
      if (c2) notes.push(`CYP2C9 *2 (${c2 === 2 ? 'two copies' : 'one copy'})`);
      if (c3) notes.push(`CYP2C9 *3 (${c3 === 2 ? 'two copies' : 'one copy'})`);
      if (!notes.length) return F('good', 'No common sensitivity variants found', 'None of the tested variants that lower the warfarin dose need were found.');
      return F('info', 'May need a lower warfarin dose', `Found ${notes.join(', ')}. These variants lower the dose of warfarin people need. CPIC uses them in dosing algorithms — only relevant if warfarin is ever prescribed; the app doesn’t calculate doses.`);
    },
  },
  {
    id: 'lct', category: 'Traits', title: 'Lactose tolerance (LCT)', snps: ['rs4988235'], sources: ['cv_lct'],
    interpret(g) {
      const c = g('rs4988235')?.count;
      if (c == null) return null;
      if (c >= 1) return F('good', 'Likely lactase persistent', 'At least one copy of the variant linked to keeping lactase activity into adulthood (in people of European ancestry).');
      return F('info', 'Likely lactase non-persistent', 'No copy of the European persistence variant: lactase activity usually declines in adulthood, which can cause symptoms after milk. Other variants give persistence in some African and Middle-Eastern populations.');
    },
  },
  {
    id: 'actn3', category: 'Traits', title: 'Muscle fibre type (ACTN3 R577X)', snps: ['rs1815739'], sources: ['cv_actn3'],
    interpret(g) {
      const c = g('rs1815739')?.count;
      if (c == null) return null;
      if (c === 2) return F('info', 'XX — no α-actinin-3', 'Common and harmless. Linked in some studies to lower sprint/power performance, but the evidence is modest.');
      return F('info', c === 1 ? 'RX' : 'RR', 'Has α-actinin-3 in fast muscle fibres. Effects on sport performance are small and inconsistent between studies.');
    },
  },
  {
    id: 'mthfr', category: 'Traits', title: 'MTHFR C677T', snps: ['rs1801133'], sources: ['acmg_mthfr'],
    interpret(g) {
      const c = g('rs1801133')?.count;
      if (c == null) return null;
      const gt = c === 2 ? 'TT (two copies)' : c === 1 ? 'CT (one copy)' : 'CC (no copy)';
      return F('info', gt, 'Very common. TT goes with mildly higher homocysteine. The American College of Medical Genetics says MTHFR testing has minimal clinical utility and shouldn’t be used to assess clotting risk — it isn’t a reason for treatment on its own.');
    },
  },
  {
    id: 'apoe', category: 'Sensitive', title: 'APOE (Alzheimer’s disease risk)', snps: ['rs429358', 'rs7412'], sources: ['aafp_apoe'], optIn: true,
    interpret(g) {
      const a = g('rs429358')?.count;
      const b = g('rs7412')?.count;
      if (a == null || b == null) return null;
      // rs429358 C marks ε4; rs7412 T marks ε2. Unphased C/T + C/T is read as ε2/ε4.
      const e4 = a;
      const e2 = b;
      const alleles = [...Array(e4).fill('ε4'), ...Array(e2).fill('ε2')];
      while (alleles.length < 2) alleles.push('ε3');
      const type = alleles.sort().join('/');
      if (e4 === 0) return F('good', type, 'No ε4 allele.');
      return F('info', type, e4 === 2
        ? 'Two copies of ε4 raise the risk of Alzheimer’s disease considerably, but don’t determine it. Medical genetics societies advise against predictive APOE testing outside counselling — consider talking to a genetic counsellor.'
        : 'One copy of ε4 raises the risk of Alzheimer’s disease, but most people with one copy don’t develop it. Consider talking to a genetic counsellor about what it means for you.');
    },
  },
];
