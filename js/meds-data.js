// Medicines, supplements and allergies: drug groups, links to lab tests, DNA and
// allergy checks, and extraction with Claude. Pure functions.

import { normName } from './metrics.js';
import { PANELS, readSnp } from './dna-variants.js';

export const KINDS = [['medicine', 'Medicine'], ['supplement', 'Supplement'], ['allergy', 'Allergy or intolerance']];
export const KIND_NAME = Object.fromEntries(KINDS);
export const SEVERITY = [['', 'Not known'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe (e.g. anaphylaxis)']];

// Drug groups, recognised from the active ingredient or common brand names
// (Finland, Germany, Ukraine). `metrics`: lab tests the group is known to change.
export const GROUPS = {
  statin: { name: 'Statin', metrics: ['ldl', 'chol', 'nonhdl', 'nonhdl_calc'],
    words: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'fluvastatin', 'lovastatin', 'pitavastatin', 'lipitor', 'sortis', 'crestor', 'zocor', 'zocord', 'аторвастатин', 'розувастатин', 'симвастатин'] },
  ezetimibe: { name: 'Ezetimibe', metrics: ['ldl', 'chol', 'nonhdl', 'nonhdl_calc'], words: ['ezetimib', 'ezetimibe', 'ezetrol', 'езетиміб', 'эзетимиб'] },
  clopidogrel: { name: 'Clopidogrel', metrics: [], words: ['clopidogrel', 'klopidogreeli', 'plavix', 'iscover', 'клопідогрель', 'клопидогрел'] },
  warfarin: { name: 'Warfarin', metrics: ['inr'], words: ['warfarin', 'varfariini', 'marevan', 'coumadin', 'варфарин'] },
  iron: { name: 'Iron', metrics: ['ferritin', 'hb', 'tsat', 'iron'],
    words: ['iron', 'ferrous', 'ferro', 'ferric', 'rauta', 'eisen', 'залізо', 'железо', 'sorbifer', 'tardyferon', 'retafer', 'ferrogradumet', 'ferretab', 'maltofer', 'ferinject', 'сорбіфер', 'тардиферон'] },
  vitd: { name: 'Vitamin D', metrics: ['vitd'],
    words: ['vitamin d', 'vitamin d3', 'd3', 'd vitamiini', 'd3 vitamiini', 'cholecalciferol', 'colecalciferol', 'kolekalsiferoli', 'vigantol', 'vigantoletten', 'dekristol', 'devisol', 'divisun', 'вітамін d', 'витамин d', 'аквадетрим'] },
  b12: { name: 'Vitamin B12', metrics: ['b12'],
    words: ['b12', 'b 12', 'cyanocobalamin', 'syanokobalamiini', 'hydroxocobalamin', 'cobalamin', 'behepan', 'вітамін b12', 'витамин b12', 'ціанокобаламін', 'цианокобаламин'] },
  thyroid: { name: 'Thyroid hormone', metrics: ['tsh', 'ft4', 'ft3'],
    words: ['levothyroxine', 'levothyroxin', 'levotyroksiini', 'thyroxin', 'thyroxine', 'euthyrox', 'eutirox', 'levaxin', 'l thyroxin', 'l thyroxine', 'thevier', 'еутирокс', 'эутирокс', 'левотироксин', 'l тироксин'] },
  metformin: { name: 'Metformin', metrics: ['hba1c', 'glucose'], words: ['metformin', 'metformiini', 'glucophage', 'siofor', 'метформін', 'метформин', 'сіофор', 'сиофор'] },
  folate: { name: 'Folic acid', metrics: ['folate'], words: ['folic acid', 'folsaure', 'foolihappo', 'folate', 'folat', 'фолієва кислота', 'фолиевая кислота'] },
  penicillin: { name: 'Penicillin antibiotic', metrics: [],
    words: ['penicillin', 'penisilliini', 'amoxicillin', 'amoksisilliini', 'amoxicilline', 'ampicillin', 'flucloxacillin', 'dicloxacillin', 'piperacillin', 'phenoxymethylpenicillin', 'fenoksimetyylipenisilliini', 'amoxiclav', 'augmentin', 'kåvepenin', 'kavepenin', 'amorion', 'пеніцилін', 'пенициллин', 'амоксицилін', 'амоксициллин', 'аугментин'] },
  nsaid: { name: 'Anti-inflammatory painkiller (NSAID)', metrics: [],
    words: ['ibuprofen', 'ibuprofeeni', 'naproxen', 'naprokseeni', 'diclofenac', 'diklofenaakki', 'diclofenac', 'ketoprofen', 'ketoprofeeni', 'etoricoxib', 'celecoxib', 'aspirin', 'acetylsalicylic', 'asetyylisalisyylihappo', 'acetylsalicylsaure', 'nsaid', 'nsar', 'tulehduskipulaake', 'burana', 'ibumax', 'voltaren', 'naprometin', 'ібупрофен', 'ибупрофен', 'диклофенак', 'аспірин', 'аспирин', 'нпзп', 'нпвп', 'нпвс'] },
};

const GROUP_WORDS = Object.entries(GROUPS).flatMap(([g, d]) => d.words.map((w) => [normName(w), g]));

export function drugGroups(med) {
  const hay = ` ${normName(`${med.name ?? ''} ${med.ingredient ?? ''}`)} `;
  const out = new Set();
  for (const [w, g] of GROUP_WORDS) {
    // Short words must stand alone ("d3"); longer ones may be part of a word ("atorvastatiini").
    if (w.length <= 4 ? hay.includes(` ${w} `) : hay.includes(w)) out.add(g);
  }
  return out;
}

// Day-precision helpers; dates are ISO strings, an empty stop means still taken.
export const isCurrent = (m, today) => m.kind !== 'allergy' && (!m.start || m.start <= today) && (!m.stop || m.stop >= today);
export const takenOn = (m, date) => m.kind !== 'allergy' && (!m.start || m.start <= date) && (!m.stop || m.stop >= date);

// Medicines and supplements linked to a lab test, newest first.
export function medsForMetric(meds, key) {
  return meds.filter((m) => m.kind !== 'allergy' && [...drugGroups(m)].some((g) => GROUPS[g].metrics.includes(key)))
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
}

// Strength in mg from "20 mg", "20mg", "0,5 mg"; null if not given in mg.
export function doseMg(m) {
  const x = String(m.dose ?? '').match(/(\d+(?:[.,]\d+)?)\s*mg\b/i);
  return x ? Number(x[1].replace(',', '.')) : null;
}

// ---- checks ------------------------------------------------------------------

const lookup = (genomes) => (rsid) => {
  for (const g of genomes ?? []) {
    const r = readSnp(rsid, g.snps?.[rsid]);
    if (r && r.count != null) return r;
  }
  return null;
};

// Findings: a current medicine that matches an allergy, or one with a relevant DNA result.
// Same shape as lab findings, with kind 'meds' and keys of related tests.
export function medFindings(meds, genomes, today) {
  const out = [];
  const current = meds.filter((m) => isCurrent(m, today));
  const allergies = meds.filter((m) => m.kind === 'allergy');
  for (const a of allergies) {
    const aGroups = drugGroups(a);
    const aWords = normName(a.name).split(' ').filter((w) => w.length >= 5);
    for (const m of current) {
      const mHay = normName(`${m.name} ${m.ingredient ?? ''}`);
      const sameGroup = [...drugGroups(m)].filter((g) => aGroups.has(g));
      if (!sameGroup.length && !aWords.some((w) => mHay.includes(w))) continue;
      out.push({ keys: [], kind: 'meds', level: 'alert', medId: m.id,
        title: `${m.name}: check against your allergy to ${a.name}`,
        text: `${sameGroup.length ? `Both belong to the same group (${GROUPS[sameGroup[0]].name.toLowerCase()}). ` : ''}Your list has an allergy or intolerance to ${a.name}${a.reaction ? ` (${a.reaction})` : ''}. Ask the doctor or pharmacist who prescribed ${m.name} whether it is safe for you.`, sources: [] });
    }
  }
  const g = lookup(genomes);
  if (!genomes?.length) return out;
  for (const m of current) {
    const groups = drugGroups(m);
    if (groups.has('statin')) {
      const c = g('rs4149056')?.count;
      if (c >= 1) {
        const simva = /simva|zocor/i.test(`${m.name} ${m.ingredient}`);
        const mg = doseMg(m);
        const high = simva && (c === 2 || (mg != null && mg >= 20));
        out.push({ keys: ['ldl'], kind: 'meds', level: high ? 'attention' : 'info', medId: m.id,
          title: `${m.name} and your SLCO1B1 result (${c === 2 ? 'poor' : 'decreased'} function)`,
          text: (simva
            ? c === 2 ? 'CPIC recommends a statin other than simvastatin with this genotype. ' : `CPIC: with this genotype keep simvastatin below 20 mg a day${mg != null ? ` (your list says ${mg} mg)` : ''}, or choose another statin. `
            : 'CPIC adjusts the choice and dose of some statins for this genotype. ') +
            'Show this to your doctor; don’t change the dose on your own. Muscle pain on a statin is worth reporting.',
          sources: ['cpic_statin'] });
      }
    }
    if (groups.has('clopidogrel')) {
      const noFn = (g('rs4244285')?.count ?? 0) + (g('rs4986893')?.count ?? 0);
      if (noFn >= 1) {
        out.push({ keys: [], kind: 'meds', level: 'attention', medId: m.id,
          title: `${m.name} and your CYP2C19 result (${noFn >= 2 ? 'poor' : 'intermediate'} metabolizer)`,
          text: 'CPIC: for heart patients after a stent or acute coronary syndrome, standard-dose clopidogrel works less well with this genotype; prasugrel or ticagrelor are alternatives. Discuss it with your cardiologist — never stop it on your own.',
          sources: ['cpic_clopi'] });
      }
    }
    if (groups.has('warfarin')) {
      const v = g('rs9923231')?.count;
      const c2 = g('rs1799853')?.count;
      const c3 = g('rs1057910')?.count;
      if (v || c2 || c3) {
        out.push({ keys: ['inr'], kind: 'meds', level: 'info', medId: m.id, title: `${m.name} and your VKORC1/CYP2C9 result`,
          text: 'Your DNA file has variants that lower the warfarin dose people need. CPIC uses them in dosing algorithms; your INR results remain what guides the dose. Make sure the clinic knows.',
          sources: ['cpic_warfarin'] });
      }
    }
  }
  return out;
}

export { PANELS };

// ---- Claude extraction ------------------------------------------------------------

export function buildMedsPrompt() {
  return `Read the attached medicine package(s), prescription(s), medication list or allergy card. They may be in English, German, Finnish, Ukrainian or Russian.
Reply with only one JSON code block in this format:

{"items": [{"kind": "medicine, supplement or allergy", "name": "product or substance name as printed", "ingredient": "active ingredient(s) in English", "dose": "strength per unit, e.g. 20 mg", "schedule": "how it is taken, e.g. 1 tablet in the evening", "reason": "what it is for, if written", "start": "YYYY-MM-DD if a start or prescription date is written", "stop": "YYYY-MM-DD if an end date is written", "reaction": "for allergies: the reaction, if written", "severity": "for allergies: mild, moderate, severe or empty"}]}

Rules:
- One item per medicine, supplement or allergy. Vitamins, minerals and herbal products are "supplement".
- Translate the schedule and reason to English; keep product names as printed.
- Leave out personal data (name, address, personal identity code, insurance number). Don’t add anything that isn’t in the document.`;
}

export function parseMedsReply(text) {
  const block = String(text ?? '').match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? String(text ?? '');
  const a = block.search(/[[{]/);
  const b = Math.max(block.lastIndexOf('}'), block.lastIndexOf(']'));
  if (a < 0 || b <= a) throw new Error('No JSON found. Copy Claude’s whole reply, including the code block.');
  const data = JSON.parse(block.slice(a, b + 1));
  const list = Array.isArray(data) ? data : data.items ?? data.medicines ?? [data];
  const iso = (s) => (/^\d{4}-\d\d-\d\d/.test(String(s ?? '')) ? String(s).slice(0, 10) : '');
  const str = (s) => String(s ?? '').trim();
  return list.filter((x) => x && typeof x === 'object' && str(x.name)).map((x) => ({
    kind: KIND_NAME[x.kind] ? x.kind : 'medicine',
    name: str(x.name), ingredient: str(x.ingredient), dose: str(x.dose), schedule: str(x.schedule), reason: str(x.reason),
    start: iso(x.start), stop: iso(x.stop), reaction: str(x.reaction),
    severity: SEVERITY.some(([k]) => k && k === x.severity) ? x.severity : '',
  }));
}

// Medicines written in a doctor's letter ("Atorvastatin 20 mg 1×1 in the evening")
// become draft items: name, dose and the rest as schedule.
export function medsFromLetter(lines, date) {
  return (lines ?? []).map((line) => {
    const t = String(line).trim();
    const m = t.match(/^(.*?)(\d+(?:[.,]\d+)?\s*(?:mg|µg|ug|mcg|g|ml|iu|ie|ки|мг|мкг|мл|од)\b)(.*)$/i);
    return { kind: 'medicine', name: (m ? m[1] : t).trim().replace(/[,;]$/, ''), ingredient: '', dose: m ? m[2].trim() : '', schedule: m ? m[3].replace(/^[\s,;–-]+/, '').trim() : '',
      reason: '', start: date ?? '', stop: '', reaction: '', severity: '' };
  }).filter((x) => x.name);
}
