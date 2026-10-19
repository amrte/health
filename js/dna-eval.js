// Findings that combine DNA results with lab values. Pure function over store data.

import { PANELS, readSnp } from './dna-variants.js';

const lookup = (genomes) => (rsid) => {
  for (const g of genomes) {
    const r = readSnp(rsid, g.snps?.[rsid]);
    if (r && r.count != null) return r;
  }
  return null;
};

export function dnaLabFindings(genomes, byMetric, profile = {}) {
  if (!genomes?.length) return [];
  const g = lookup(genomes);
  const out = [];
  const latest = (k) => {
    const pts = byMetric.get(k)?.pts?.filter((p) => p.v != null) ?? [];
    return pts[pts.length - 1] ?? null;
  };

  const c282y = g('rs1800562')?.count;
  const h63d = g('rs1799945')?.count;
  const ferritin = latest('ferritin');
  const tsat = latest('tsat');
  if (c282y === 2 || (c282y === 1 && h63d === 1)) {
    const over = profile.sex === 'male' ? 200 : 150;
    const ironHigh = (ferritin && ferritin.v > over) || (tsat && tsat.status === 'high');
    out.push({
      keys: ['ferritin', 'tsat'], kind: 'pattern', level: ironHigh ? 'alert' : 'info',
      title: ironHigh ? 'HFE genotype with raised iron values' : 'HFE genotype: keep an eye on iron values',
      text: `Your DNA file shows ${c282y === 2 ? 'two copies of HFE C282Y' : 'HFE C282Y and H63D'}${ironHigh ? `, and your latest ${ferritin && ferritin.v > over ? `ferritin is ${Math.round(ferritin.v)} µg/L` : 'transferrin saturation is above range'}` : ''}. ` +
        (ironHigh ? 'Together these suggest checking for iron overload with a doctor; the genotype should be confirmed in a clinical lab.' : 'Ferritin and transferrin saturation now and then show whether iron builds up.'),
      sources: [],
    });
  }

  const slco = g('rs4149056')?.count;
  if (slco >= 1 && latest('ldl')) {
    out.push({
      keys: ['ldl'], kind: 'pattern', level: 'info', title: `SLCO1B1 ${slco === 2 ? 'poor' : 'decreased'} function — relevant if a statin is considered`,
      text: 'Your DNA file shows a variant that affects how statins are handled. CPIC recommends choosing the statin and dose with it in mind (e.g. avoiding higher simvastatin doses). Mention it if cholesterol treatment is discussed.',
      sources: [],
    });
  }
  return out;
}

export { PANELS };
