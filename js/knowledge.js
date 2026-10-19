// Guideline knowledge per test: plain explanation, guideline limits, rules and sources.
//
// Every number here was checked against its source when this file was written
// (see REVIEWED). Where a source wasn't confirmed, no rule was written — the app
// then falls back to the lab's own reference range. Values are in the catalogue's
// canonical units (mostly SI); conventional units are given in the texts.
//
// A rule is (latestPoint, ctx) → finding | null, where a finding is
// { level: 'alert' | 'attention' | 'info' | 'good', title, text, sources: [ids] }.

import { fmtNum, fmtDate } from './format.js';
import { normUnit } from './units.js';

export const REVIEWED = '2026-10-19';

export const SOURCES = {
  esc2019: { short: 'ESC/EAS 2019', org: 'European Society of Cardiology / European Atherosclerosis Society', year: 2019,
    title: 'Guidelines for the management of dyslipidaemias (Eur Heart J 2020;41:111–188)', url: 'https://academic.oup.com/eurheartj/article/41/1/111/5556353' },
  esc2025: { short: 'ESC/EAS 2025', org: 'ESC / EAS', year: 2025,
    title: 'Focused update of the 2019 dyslipidaemia guidelines (Eur Heart J 2025;46:4359–4378)', url: 'https://academic.oup.com/eurheartj/article/46/42/4359/8234482' },
  eas2022: { short: 'EAS 2022', org: 'European Atherosclerosis Society', year: 2022,
    title: 'Lipoprotein(a) consensus statement (Eur Heart J 2022;43:3925–3946)', url: 'https://academic.oup.com/eurheartj/article/43/39/3925/6670882' },
  ada2026: { short: 'ADA 2026', org: 'American Diabetes Association', year: 2026,
    title: 'Standards of Care in Diabetes — 2. Diagnosis and Classification (Diabetes Care 2026;49 Suppl 1)', url: 'https://diabetesjournals.org/care/article/49/Supplement_1/S27/163926/2-Diagnosis-and-Classification-of-Diabetes' },
  who2006: { short: 'WHO 2006', org: 'World Health Organization / IDF', year: 2006,
    title: 'Definition and diagnosis of diabetes mellitus and intermediate hyperglycaemia', url: 'https://www.who.int/publications/i/item/definition-and-diagnosis-of-diabetes-mellitus-and-intermediate-hyperglycaemia' },
  who2011: { short: 'WHO 2011', org: 'World Health Organization', year: 2011,
    title: 'Use of glycated haemoglobin (HbA1c) in the diagnosis of diabetes mellitus', url: 'https://iris.who.int/server/api/core/bitstreams/db9b9d3d-f95e-4797-9d2b-c78dcef0133f/content' },
  who2020: { short: 'WHO 2020', org: 'World Health Organization', year: 2020,
    title: 'Guideline on use of ferritin concentrations to assess iron status', url: 'https://www.who.int/publications/i/item/9789240000124' },
  who2024: { short: 'WHO 2024', org: 'World Health Organization', year: 2024,
    title: 'Guideline on haemoglobin cutoffs to define anaemia', url: 'https://www.who.int/publications/i/item/9789240088542' },
  aga2020: { short: 'AGA 2020', org: 'American Gastroenterological Association', year: 2020,
    title: 'Gastrointestinal evaluation of iron deficiency anemia (Gastroenterology 2020;159:1085–1094)', url: 'https://gastro.org/clinical-guidance/gastrointestinal-evaluation-of-iron-deficiency-anemia/' },
  kdigo2024: { short: 'KDIGO 2024', org: 'Kidney Disease: Improving Global Outcomes', year: 2024,
    title: 'Clinical Practice Guideline for the Evaluation and Management of CKD', url: 'https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf' },
  ckdepi2021: { short: 'CKD-EPI 2021', org: 'Inker et al., N Engl J Med', year: 2021,
    title: 'New creatinine- and cystatin C–based equations to estimate GFR without race', url: 'https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults' },
  iom2011: { short: 'IOM 2011', org: 'Institute of Medicine (National Academies)', year: 2011,
    title: 'Dietary Reference Intakes for Calcium and Vitamin D', url: 'https://www.nationalacademies.org/read/13050/chapter/8' },
  es2024: { short: 'Endocrine Society 2024', org: 'Endocrine Society', year: 2024,
    title: 'Vitamin D for the prevention of disease (J Clin Endocrinol Metab 2024;109:1907)', url: 'https://academic.oup.com/jcem/article/109/8/1907/7685305' },
  aha2003: { short: 'AHA/CDC 2003', org: 'American Heart Association / CDC', year: 2003,
    title: 'Markers of inflammation and cardiovascular disease (Circulation 2003;107:499–511)', url: 'https://pubmed.ncbi.nlm.nih.gov/12551878/' },
  acg2017: { short: 'ACG 2017', org: 'American College of Gastroenterology', year: 2017,
    title: 'Evaluation of abnormal liver chemistries (Am J Gastroenterol 2017;112:18–35)', url: 'https://pubmed.ncbi.nlm.nih.gov/27995906/' },
  eta2013: { short: 'ETA 2013', org: 'European Thyroid Association', year: 2013,
    title: 'Management of subclinical hypothyroidism (Eur Thyroid J 2013;2:215–228)', url: 'https://www.eurothyroid.com/files/download/ETA-Guideline-Management-of-Subclinical-Hypothyroidism.pdf' },
  eta2015: { short: 'ETA 2015', org: 'European Thyroid Association', year: 2015,
    title: 'Diagnosis and management of endogenous subclinical hyperthyroidism (Eur Thyroid J 2015;4:149–163)', url: 'https://doi.org/10.1159/000438750' },
  bsh2014: { short: 'BSH 2014', org: 'British Society for Haematology', year: 2014,
    title: 'Diagnosis and treatment of cobalamin and folate disorders (Br J Haematol 2014;166:496–513)', url: 'https://b-s-h.org.uk/guidelines/guidelines/diagnosis-of-b12-and-folate-deficiency' },
  who2020pa: { short: 'WHO 2020', org: 'World Health Organization', year: 2020,
    title: 'Guidelines on physical activity and sedentary behaviour', url: 'https://www.who.int/publications/i/item/9789240015128' },
  aasm2015: { short: 'AASM/SRS 2015', org: 'American Academy of Sleep Medicine / Sleep Research Society', year: 2015,
    title: 'Recommended amount of sleep for a healthy adult (J Clin Sleep Med 2015;11:591–592)', url: 'https://pubmed.ncbi.nlm.nih.gov/25979105/' },
  esc2024bp: { short: 'ESC 2024', org: 'European Society of Cardiology', year: 2024,
    title: 'Guidelines for the management of elevated blood pressure and hypertension (Eur Heart J 2024;45:3912–4018)', url: 'https://doi.org/10.1093/eurheartj/ehae178' },
  esh2023: { short: 'ESH 2023', org: 'European Society of Hypertension', year: 2023,
    title: 'Guidelines for the management of arterial hypertension (J Hypertens 2023;41:1874–2071)', url: 'https://doi.org/10.1097/HJH.0000000000003480' },
  aha_bp: { short: 'AHA', org: 'American Heart Association', year: null,
    title: 'Understanding blood pressure readings', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings' },
  aha2009qt: { short: 'AHA/ACCF/HRS 2009', org: 'American Heart Association / ACCF / Heart Rhythm Society', year: 2009,
    title: 'ECG standardization and interpretation, Part IV: ST segment, T and U waves, and the QT interval (Circulation 2009;119:e241)', url: 'https://www.ahajournals.org/doi/10.1161/circulationaha.108.191096' },
  aha2009qrs: { short: 'AHA/ACCF/HRS 2009', org: 'American Heart Association / ACCF / Heart Rhythm Society', year: 2009,
    title: 'ECG standardization and interpretation, Part III: intraventricular conduction disturbances (Circulation 2009;119:e235)', url: 'https://doi.org/10.1161/CIRCULATIONAHA.108.191095' },
  aha2010tdp: { short: 'AHA/ACCF 2010', org: 'American Heart Association / ACCF', year: 2010,
    title: 'Prevention of torsade de pointes in hospital settings (Circulation 2010;121:1047–1060)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3056123/' },
  acc2018brady: { short: 'ACC/AHA/HRS 2018', org: 'ACC / AHA / Heart Rhythm Society', year: 2018,
    title: 'Guideline on the evaluation and management of bradycardia and cardiac conduction delay', url: 'https://doi.org/10.1161/CIR.0000000000000628' },
  esc2022va: { short: 'ESC 2022', org: 'European Society of Cardiology', year: 2022,
    title: 'Guidelines for ventricular arrhythmias and the prevention of sudden cardiac death (Eur Heart J 2022;43:3997)', url: 'https://academic.oup.com/eurheartj/article/43/40/3997/6675633' },
  esc2024af: { short: 'ESC 2024', org: 'European Society of Cardiology', year: 2024,
    title: 'Guidelines for the management of atrial fibrillation (Eur Heart J 2024;45:3314)', url: 'https://doi.org/10.1093/eurheartj/ehae176' },
  esc2021pace: { short: 'ESC 2021', org: 'European Society of Cardiology', year: 2021,
    title: 'Guidelines on cardiac pacing and cardiac resynchronization therapy (Eur Heart J 2021;42:3427)', url: 'https://doi.org/10.1093/eurheartj/ehab364' },
  esc2021hf: { short: 'ESC 2021 HF', org: 'European Society of Cardiology', year: 2021,
    title: 'Guidelines for the diagnosis and treatment of acute and chronic heart failure (Eur Heart J 2021;42:3599)', url: 'https://doi.org/10.1093/eurheartj/ehab368' },
  ase2015: { short: 'ASE/EACVI 2015', org: 'American Society of Echocardiography / EACVI', year: 2015,
    title: 'Recommendations for cardiac chamber quantification by echocardiography in adults', url: 'https://academic.oup.com/ehjcimaging/article/16/3/233/2400086' },
  who_bmi: { short: 'WHO Europe', org: 'World Health Organization, Regional Office for Europe', year: null,
    title: 'A healthy lifestyle – WHO recommendations (BMI classification for adults)', url: 'https://www.who.int/europe/news-room/fact-sheets/item/a-healthy-lifestyle---who-recommendations' },
  who2008waist: { short: 'WHO 2008', org: 'World Health Organization', year: 2008,
    title: 'Waist circumference and waist–hip ratio: report of a WHO expert consultation (published 2011)', url: 'https://www.who.int/publications/i/item/9789241501491' },
  nice246: { short: 'NICE NG246', org: 'National Institute for Health and Care Excellence', year: 2025,
    title: 'Overweight and obesity management: identifying and assessing overweight, obesity and central adiposity', url: 'https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity' },
  nice239: { short: 'NICE NG239', org: 'National Institute for Health and Care Excellence', year: 2024,
    title: 'Vitamin B12 deficiency in over 16s: diagnosis and management', url: 'https://www.nice.org.uk/guidance/ng239' },
};

const ML = (slug, title) => ({ short: 'MedlinePlus', org: 'U.S. National Library of Medicine', year: null, title: `MedlinePlus: ${title}`, url: `https://medlineplus.gov/${slug}` });
Object.assign(SOURCES, {
  ml_hb: ML('lab-tests/hemoglobin-test/', 'Hemoglobin test'),
  ml_ferritin: ML('lab-tests/ferritin-blood-test/', 'Ferritin blood test'),
  ml_cbc: ML('lab-tests/complete-blood-count-cbc/', 'Complete blood count'),
  ml_chol: ML('lab-tests/cholesterol-levels/', 'Cholesterol levels'),
  ml_trig: ML('lab-tests/triglycerides-test/', 'Triglycerides test'),
  ml_a1c: ML('lab-tests/hemoglobin-a1c-hba1c-test/', 'Hemoglobin A1C test'),
  ml_glucose: ML('lab-tests/blood-glucose-test/', 'Blood glucose test'),
  ml_crea: ML('lab-tests/creatinine-test/', 'Creatinine test'),
  ml_gfr: ML('lab-tests/glomerular-filtration-rate-gfr-test/', 'GFR test'),
  ml_alt: ML('lab-tests/alt-blood-test/', 'ALT blood test'),
  ml_tsh: ML('lab-tests/tsh-thyroid-stimulating-hormone-test/', 'TSH test'),
  ml_t4: ML('lab-tests/thyroxine-t4-test/', 'Thyroxine (T4) test'),
  ml_crp: ML('lab-tests/c-reactive-protein-crp-test/', 'C-reactive protein test'),
  ml_vitd: ML('lab-tests/vitamin-d-test/', 'Vitamin D test'),
  ml_b: ML('lab-tests/vitamin-b-test/', 'Vitamin B test'),
  ml_wbc: ML('lab-tests/white-blood-count-wbc/', 'White blood count'),
  ml_plt: ML('lab-tests/platelet-tests/', 'Platelet tests'),
  ml_hct: ML('lab-tests/hematocrit-test/', 'Hematocrit test'),
  ml_mcv: ML('lab-tests/mcv-mean-corpuscular-volume/', 'MCV'),
  ml_indices: ML('lab-tests/red-blood-cell-rbc-indices/', 'Red blood cell indices'),
});

const v = (x, unit) => `${fmtNum(x)} ${unit}`;
const F = (level, title, text, sources) => ({ level, title, text, sources });

// ---- per-test knowledge ----------------------------------------------------

export const KB = {
  hb: {
    about: 'Hemoglobin is the oxygen-carrying protein in red blood cells. It is the main measure for anaemia.',
    low: 'Anaemia, e.g. from iron, B12 or folate deficiency, blood loss or chronic disease.',
    high: 'Dehydration, smoking, living at high altitude, lung or heart conditions, or rarely a bone-marrow disorder.',
    thresholds: [
      { label: 'Anaemia, men 15–65 y', value: '< 130 g/L (13.0 g/dL)', source: 'who2024' },
      { label: 'Anaemia, non-pregnant women 15–65 y', value: '< 120 g/L (12.0 g/dL)', source: 'who2024' },
      { label: 'Moderate / severe anaemia', value: '80–109 / < 80 g/L', source: 'who2024' },
    ],
    note: 'WHO adjusts the cut-offs for smoking (−3 to −6 g/L) and altitude above 500 m. No separate WHO cut-off was confirmed for age 65 and over; the app uses the lab range there.',
    sources: ['ml_hb'],
    pubmed: 'hemoglobin anaemia diagnosis adults',
    rules: [(p, c) => {
      const age = c.age(p);
      if (!c.sex || age == null || age < 15 || age > 65) return null;
      const cut = c.sex === 'male' ? 130 : 120;
      if (p.v >= cut) return F('good', 'Hemoglobin: no anaemia by WHO criteria', `${v(p.v, 'g/L')} is at or above the WHO cut-off of ${cut} g/L for ${c.sex === 'male' ? 'men' : 'non-pregnant women'} aged 15–65.`, ['who2024']);
      const sev = p.v < 80 ? 'severe' : p.v < 110 ? 'moderate' : 'mild';
      return F(sev === 'mild' ? 'attention' : 'alert', `Hemoglobin: ${sev} anaemia range (WHO)`,
        `${v(p.v, 'g/L')} is below the WHO cut-off of ${cut} g/L. WHO grades it as ${sev}. Common causes are iron, B12 or folate deficiency and blood loss — the cause needs to be found.`, ['who2024']);
    }],
  },

  ferritin: {
    about: 'Ferritin reflects the body’s iron stores. It also rises with inflammation, infection and liver disease, so a normal value doesn’t always rule out iron deficiency.',
    low: 'Low iron stores: blood loss (including menstruation), low intake, poor absorption (e.g. coeliac disease).',
    high: 'Inflammation or infection, liver disease, alcohol, metabolic syndrome, or iron overload (e.g. haemochromatosis).',
    thresholds: [
      { label: 'Iron deficiency, healthy adults', value: '< 15 µg/L', source: 'who2020' },
      { label: 'Iron deficiency with infection or inflammation', value: '< 70 µg/L', source: 'who2020' },
      { label: 'Iron deficiency in people with anaemia', value: '< 45 µg/L', source: 'aga2020' },
      { label: 'Risk of iron overload, menstruating women', value: '> 150 µg/L', source: 'who2020' },
      { label: 'Risk of iron overload, men and other women', value: '> 200 µg/L', source: 'who2020' },
    ],
    note: 'WHO recommends measuring an inflammation marker (CRP) together with ferritin.',
    sources: ['ml_ferritin'],
    pubmed: 'serum ferritin iron deficiency threshold',
    rules: [(p, c) => {
      const crp = c.near('crp', p) ?? c.near('hscrp', p);
      const inflamed = crp && crp.status === 'high';
      if (p.v < 15) return F('attention', 'Ferritin: iron deficiency range (WHO)', `${v(p.v, 'µg/L')} is below 15 µg/L, which WHO uses to define iron deficiency in healthy adults.`, ['who2020']);
      if (inflamed && p.v < 70) return F('attention', 'Ferritin: possible iron deficiency despite inflammation',
        `CRP was raised (${v(crp.v, 'mg/L')}) at the same time. Inflammation raises ferritin, so WHO uses < 70 µg/L in that case — ${v(p.v, 'µg/L')} is below it.`, ['who2020']);
      if (!crp && p.v < 70) return F('info', 'Ferritin: no CRP measured with it',
        'Inflammation can raise ferritin and hide iron deficiency. WHO recommends measuring CRP together with ferritin.', ['who2020']);
      const over = c.sex === 'male' ? 200 : c.sex === 'female' ? 150 : null;
      if (over && p.v > over) return F('attention', 'Ferritin above the WHO iron-overload screening level',
        `${v(p.v, 'µg/L')} is above ${over} µg/L${c.sex === 'female' ? ' (the cut-off for menstruating women; 200 µg/L applies after menopause)' : ''}. Inflammation, liver disease and alcohol raise ferritin too; transferrin saturation helps tell them apart.`, ['who2020']);
      return null;
    }],
  },

  glucose: {
    about: 'Plasma glucose (blood sugar). Limits below apply to fasting samples (at least 8 hours without food).',
    high: 'Prediabetes or diabetes, a non-fasting sample, stress, illness, some medicines (e.g. steroids).',
    low: 'Long fasting, some medicines (e.g. insulin), rarely other conditions.',
    thresholds: [
      { label: 'Impaired fasting glucose (ADA)', value: '5.6–6.9 mmol/L (100–125 mg/dL)', source: 'ada2026' },
      { label: 'Impaired fasting glucose (WHO)', value: '6.1–6.9 mmol/L (110–125 mg/dL)', source: 'who2006' },
      { label: 'Diabetes range (ADA, WHO)', value: '≥ 7.0 mmol/L (126 mg/dL)', source: 'ada2026' },
    ],
    note: 'A diabetes diagnosis needs confirmation: two abnormal results from different tests (e.g. glucose and HbA1c, even from the same blood draw) or the same test on two occasions.',
    sources: ['ml_glucose'],
    pubmed: 'fasting plasma glucose diagnosis prediabetes',
    rules: [(p) => {
      if (p.v >= 7.0) return F('alert', 'Glucose in the diabetes range (if fasting)', `${v(p.v, 'mmol/L')} is at or above 7.0 mmol/L (126 mg/dL). If the sample was fasting, this is in the diabetes range; ADA requires a second abnormal result to confirm.`, ['ada2026', 'who2006']);
      if (p.v >= 6.1) return F('attention', 'Glucose: impaired fasting glucose (if fasting)', `${v(p.v, 'mmol/L')} is in the impaired fasting glucose range by both WHO (6.1–6.9) and ADA (5.6–6.9).`, ['who2006', 'ada2026']);
      if (p.v >= 5.6) return F('info', 'Glucose: ADA prediabetes range (if fasting)', `${v(p.v, 'mmol/L')} is within ADA’s impaired fasting glucose range (5.6–6.9 mmol/L) but below WHO’s (from 6.1). HbA1c gives a longer-term picture.`, ['ada2026', 'who2006']);
      return null;
    }],
  },

  hba1c: {
    about: 'HbA1c shows the average blood sugar over the past 2–3 months. No fasting needed. Some conditions affecting red blood cells (anaemia, haemoglobin variants) can distort it.',
    thresholds: [
      { label: 'Prediabetes (ADA)', value: '39–47 mmol/mol (5.7–6.4 %)', source: 'ada2026' },
      { label: 'Diabetes range (ADA, WHO)', value: '≥ 48 mmol/mol (6.5 %)', source: 'who2011' },
    ],
    note: 'WHO has no HbA1c category below the diabetes cut-off; the prediabetes range is ADA’s.',
    sources: ['ml_a1c'],
    pubmed: 'HbA1c diagnosis diabetes prediabetes',
    rules: [(p) => {
      const pct = (p.v + 23.5) / 10.929;
      if (p.v >= 48) return F('alert', 'HbA1c in the diabetes range', `${v(p.v, 'mmol/mol')} (${pct.toFixed(1)} %) is at or above 48 mmol/mol (6.5 %), the diagnostic cut-off of WHO and ADA. A second abnormal result is needed to confirm.`, ['who2011', 'ada2026']);
      if (p.v >= 39) return F('attention', 'HbA1c: prediabetes range (ADA)', `${v(p.v, 'mmol/mol')} (${pct.toFixed(1)} %) is within ADA’s prediabetes range of 39–47 mmol/mol (5.7–6.4 %).`, ['ada2026']);
      return F('good', 'HbA1c below the prediabetes range', `${v(p.v, 'mmol/mol')} (${pct.toFixed(1)} %) is below 39 mmol/mol (5.7 %).`, ['ada2026']);
    }],
  },

  ldl: {
    about: 'LDL cholesterol carries cholesterol into artery walls and is the main target for preventing heart attack and stroke. Which level is “good enough” depends on a person’s overall cardiovascular risk.',
    high: 'Diet, genetics (familial hypercholesterolaemia), hypothyroidism, kidney or liver conditions, some medicines.',
    thresholds: [
      { label: 'Goal at low risk', value: '< 3.0 mmol/L (116 mg/dL)', source: 'esc2019' },
      { label: 'Goal at moderate risk', value: '< 2.6 mmol/L (100 mg/dL)', source: 'esc2019' },
      { label: 'Goal at high risk', value: '< 1.8 mmol/L (70 mg/dL) and −50 %', source: 'esc2019' },
      { label: 'Goal at very high risk', value: '< 1.4 mmol/L (55 mg/dL) and −50 %', source: 'esc2019' },
      { label: 'High risk on its own', value: '> 4.9 mmol/L (190 mg/dL)', source: 'esc2019' },
    ],
    note: 'The 2025 focused update kept these goals. Your risk category comes from age, blood pressure, smoking, diabetes, kidney function and existing disease — a doctor can estimate it.',
    sources: ['ml_chol', 'esc2025'],
    pubmed: 'LDL cholesterol target cardiovascular prevention',
    rules: [(p) => {
      if (p.v > 4.9) return F('alert', 'LDL cholesterol markedly raised', `${v(p.v, 'mmol/L')} is above 4.9 mmol/L (190 mg/dL). ESC/EAS count this alone as high cardiovascular risk and advise considering familial hypercholesterolaemia.`, ['esc2019']);
      const goals = [[3.0, 'low'], [2.6, 'moderate'], [1.8, 'high'], [1.4, 'very high']].filter(([g]) => p.v < g).map(([, r]) => r);
      if (!goals.length) return F('info', 'LDL above all ESC/EAS goals', `${v(p.v, 'mmol/L')} is above even the goal for people at low cardiovascular risk (< 3.0 mmol/L). Whether that calls for action depends on your overall risk.`, ['esc2019']);
      return F('good', 'LDL within an ESC/EAS goal', `${v(p.v, 'mmol/L')} meets the goal for people at ${goals.join(', ')} risk.`, ['esc2019']);
    }],
  },

  nonhdl_calc: {
    about: 'Non-HDL cholesterol is total cholesterol minus HDL: all cholesterol in particles that can cause atherosclerosis. Calculated here from your total and HDL results. ESC/EAS use it as a secondary goal, especially when triglycerides are high.',
    thresholds: [
      { label: 'Secondary goal at high risk', value: '< 2.6 mmol/L (100 mg/dL)', source: 'esc2019' },
      { label: 'Secondary goal at very high risk', value: '< 2.2 mmol/L (85 mg/dL)', source: 'esc2019' },
    ],
    sources: ['ml_chol'],
    pubmed: 'non-HDL cholesterol cardiovascular risk',
  },

  chol: {
    about: 'Total cholesterol is the sum of LDL, HDL and other cholesterol. Guidelines base decisions on LDL (and non-HDL) rather than on the total.',
    sources: ['ml_chol', 'esc2019'],
    pubmed: 'total cholesterol cardiovascular risk',
  },

  hdl: {
    about: 'HDL cholesterol carries cholesterol away from the arteries. Low HDL goes with higher cardiovascular risk, but raising HDL with medicines hasn’t been shown to help. Very high HDL (> 2.3 mmol/L) has also been linked to higher risk.',
    sources: ['ml_chol', 'esc2019'],
    pubmed: 'HDL cholesterol cardiovascular risk',
  },

  trig: {
    about: 'Triglycerides are blood fats that rise after meals, with alcohol, excess weight and insulin resistance. Usually measured fasting.',
    thresholds: [
      { label: 'Lower cardiovascular risk', value: '< 1.7 mmol/L (150 mg/dL)', source: 'esc2019' },
      { label: 'Pancreatitis risk clinically significant', value: '> 10 mmol/L (≈ 880 mg/dL)', source: 'esc2019' },
    ],
    sources: ['ml_trig'],
    pubmed: 'triglycerides cardiovascular risk',
    rules: [(p) => {
      if (p.v > 10) return F('alert', 'Triglycerides very high', `${v(p.v, 'mmol/L')} is above 10 mmol/L, where ESC/EAS consider the risk of pancreatitis clinically significant.`, ['esc2019']);
      if (p.v >= 1.7) return F('info', 'Triglycerides above 1.7 mmol/L', `ESC/EAS set no goal for triglycerides, but values below 1.7 mmol/L (150 mg/dL) indicate lower risk. ${v(p.v, 'mmol/L')} is above that.`, ['esc2019']);
      return null;
    }],
  },

  lpa: {
    about: 'Lipoprotein(a) is a cholesterol-carrying particle whose level is mostly inherited and stays fairly stable for life. High Lp(a) raises the risk of heart attack, stroke and aortic valve narrowing.',
    thresholds: [
      { label: 'High risk unlikely', value: '< 75 nmol/L (< 30 mg/dL)', source: 'eas2022' },
      { label: 'Grey zone', value: '75–125 nmol/L (30–50 mg/dL)', source: 'eas2022' },
      { label: 'Risk-enhancing factor', value: '> 105 nmol/L (> 50 mg/dL)', source: 'esc2025' },
    ],
    note: 'There is no exact conversion between mg/dL and nmol/L; the two sources round differently. Measuring Lp(a) at least once in adulthood is recommended.',
    sources: ['eas2022', 'esc2025'],
    pubmed: 'lipoprotein(a) cardiovascular risk',
    rules: [(p) => {
      const mgdl = normUnit(p.o.unit) === 'mg/dl' ? p.raw : null;
      const nmol = p.v;
      const high = nmol != null ? nmol > 105 : mgdl != null && mgdl > 50;
      const low = nmol != null ? nmol < 75 : mgdl != null && mgdl < 30;
      const shown = nmol != null ? v(nmol, 'nmol/L') : mgdl != null ? v(mgdl, 'mg/dL') : null;
      if (!shown) return null;
      if (high) return F('attention', 'Lp(a) raised', `${shown} is above 50 mg/dL (≈ 105 nmol/L), which the 2025 ESC/EAS update counts as a factor that increases cardiovascular risk. It’s largely inherited, so it can be relevant for close relatives too.`, ['esc2025', 'eas2022']);
      if (low) return F('good', 'Lp(a) low', `${shown} is in the range where EAS considers high risk from Lp(a) unlikely.`, ['eas2022']);
      return F('info', 'Lp(a) in the grey zone', `${shown} is in the EAS grey zone (30–50 mg/dL, 75–125 nmol/L).`, ['eas2022']);
    }],
  },

  egfr: {
    about: 'eGFR estimates how much blood the kidneys filter per minute, calculated from creatinine (and sometimes cystatin C), age and sex. Short-term dips happen with dehydration or after heavy exercise or meat meals.',
    thresholds: [
      { label: 'G1 normal or high', value: '≥ 90', source: 'kdigo2024' },
      { label: 'G2 mildly decreased', value: '60–89', source: 'kdigo2024' },
      { label: 'G3a mildly–moderately decreased', value: '45–59', source: 'kdigo2024' },
      { label: 'G3b moderately–severely decreased', value: '30–44', source: 'kdigo2024' },
      { label: 'G4 severely decreased', value: '15–29', source: 'kdigo2024' },
      { label: 'G5 kidney failure', value: '< 15', source: 'kdigo2024' },
    ],
    note: 'Chronic kidney disease means abnormal kidney structure or function for at least 3 months. G1–G2 alone, without signs of kidney damage (e.g. albumin in urine), is not CKD.',
    sources: ['ml_gfr', 'ckdepi2021'],
    pubmed: 'estimated glomerular filtration rate CKD classification',
    rules: [(p, c) => egfrRule(p, c, 'egfr')],
  },

  crea: {
    about: 'Creatinine is a waste product from muscle, cleared by the kidneys. Its level depends on muscle mass, so it’s turned into eGFR for judging kidney function. With your sex and birth year in the profile, the app calculates eGFR (CKD-EPI 2021) for creatinine results that came without one.',
    sources: ['ml_crea', 'ckdepi2021'],
    pubmed: 'serum creatinine kidney function',
  },

  alt: {
    about: 'ALT is an enzyme mainly found in the liver; it leaks into the blood when liver cells are damaged. Fatty liver, alcohol, medicines and hepatitis are common causes of raised values. Hard exercise can raise it briefly.',
    thresholds: [
      { label: 'Healthy upper limit, men', value: '29–33 U/L', source: 'acg2017' },
      { label: 'Healthy upper limit, women', value: '19–25 U/L', source: 'acg2017' },
    ],
    note: 'Many labs use higher upper limits. ACG advises assessing ALT above these “true healthy” limits.',
    sources: ['ml_alt'],
    pubmed: 'alanine aminotransferase upper limit of normal',
    rules: [(p, c) => {
      if (!c.sex || p.status === 'high') return null;
      const lim = c.sex === 'male' ? 33 : 25;
      if (p.v > lim) return F('info', 'ALT above the ACG healthy limit', `${v(p.v, 'U/L')} is within the lab’s range but above ${lim} U/L, the upper end of the healthy ALT range ACG gives for ${c.sex === 'male' ? 'men' : 'women'}. ACG suggests looking into ALT above this level.`, ['acg2017']);
      return null;
    }],
  },

  tsh: {
    about: 'TSH is the pituitary signal that drives the thyroid. High TSH usually means an underactive thyroid, low TSH an overactive one. It’s interpreted together with free T4.',
    thresholds: [
      { label: 'Subclinical hypothyroidism', value: 'TSH above range, free T4 normal', source: 'eta2013' },
      { label: 'Subclinical hyperthyroidism', value: 'TSH below range, free T4 (and T3) normal', source: 'eta2015' },
      { label: 'Grade 1 / grade 2 low TSH', value: '0.1–0.39 / < 0.1 mU/L', source: 'eta2015' },
    ],
    sources: ['ml_tsh'],
    pubmed: 'TSH subclinical thyroid dysfunction',
  },

  ft4: {
    about: 'Free T4 is the active, unbound thyroid hormone. Read together with TSH.',
    sources: ['ml_t4'],
    pubmed: 'free thyroxine thyroid function',
  },

  crp: {
    about: 'C-reactive protein rises within hours of infection, injury or inflammation and falls again as it settles. A standard CRP test is for inflammation; the high-sensitivity test (hs-CRP) is used for cardiovascular risk.',
    sources: ['ml_crp'],
    pubmed: 'C-reactive protein interpretation',
  },

  hscrp: {
    about: 'High-sensitivity CRP measures low CRP levels and is used as a marker of cardiovascular risk. Ideally the average of two tests, taken when you’re free of infection, is used.',
    thresholds: [
      { label: 'Low cardiovascular risk', value: '< 1 mg/L', source: 'aha2003' },
      { label: 'Average risk', value: '1–3 mg/L', source: 'aha2003' },
      { label: 'High risk', value: '> 3 mg/L', source: 'aha2003' },
      { label: 'Repeat, look for infection/inflammation', value: '≥ 10 mg/L', source: 'aha2003' },
    ],
    sources: ['ml_crp'],
    pubmed: 'high-sensitivity C-reactive protein cardiovascular risk',
    rules: [(p) => {
      if (p.v >= 10) return F('attention', 'hs-CRP 10 mg/L or more', `${v(p.v, 'mg/L')} is too high to judge cardiovascular risk. AHA/CDC advise repeating the test and looking for infection or inflammation.`, ['aha2003']);
      const cat = p.v < 1 ? 'low' : p.v <= 3 ? 'average' : 'high';
      return F(cat === 'high' ? 'info' : 'good', `hs-CRP: ${cat} cardiovascular risk category`, `${v(p.v, 'mg/L')} falls in the AHA/CDC “${cat} risk” category (< 1, 1–3, > 3 mg/L).`, ['aha2003']);
    }],
  },

  vitd: {
    about: '25-hydroxyvitamin D shows vitamin D status. It’s lower in winter and with little sun exposure. Expert bodies disagree on the ideal level.',
    thresholds: [
      { label: 'Risk of deficiency', value: '< 30 nmol/L (12 ng/mL)', source: 'iom2011' },
      { label: 'Risk of inadequacy', value: '30–49 nmol/L', source: 'iom2011' },
      { label: 'Sufficient for nearly everyone', value: '≥ 50 nmol/L (20 ng/mL)', source: 'iom2011' },
      { label: 'Potential for adverse effects', value: '> 125 nmol/L (50 ng/mL)', source: 'iom2011' },
    ],
    note: 'The Endocrine Society (2024) no longer endorses specific target levels and advises against routine testing in healthy people.',
    sources: ['ml_vitd', 'es2024'],
    pubmed: '25-hydroxyvitamin D status threshold',
    rules: [(p) => {
      if (p.v > 125) return F('attention', 'Vitamin D above 125 nmol/L', `${v(p.v, 'nmol/L')} is above the level where IOM saw reason for concern about adverse effects. Usually from high-dose supplements.`, ['iom2011']);
      if (p.v < 30) return F('attention', 'Vitamin D: risk of deficiency (IOM)', `${v(p.v, 'nmol/L')} is below 30 nmol/L (12 ng/mL).`, ['iom2011']);
      if (p.v < 50) return F('info', 'Vitamin D: possibly inadequate (IOM)', `${v(p.v, 'nmol/L')} is in IOM’s 30–49 nmol/L range; 50 nmol/L covers the needs of nearly everyone.`, ['iom2011', 'es2024']);
      return F('good', 'Vitamin D sufficient (IOM)', `${v(p.v, 'nmol/L')} is at or above 50 nmol/L (20 ng/mL).`, ['iom2011']);
    }],
  },

  b12: {
    about: 'Vitamin B12 is needed for blood cells and nerves. Low levels come from low intake (vegan diet), poor absorption (pernicious anaemia, stomach surgery) or medicines such as metformin and acid blockers. Results in the low-normal range can be inconclusive; active B12 or methylmalonic acid (MMA) then helps.',
    sources: ['ml_b', 'nice239'],
    pubmed: 'vitamin B12 deficiency diagnosis',
  },

  folate: {
    about: 'Folate is needed for blood cell production. Low levels come from low intake of greens and legumes, alcohol, malabsorption or some medicines.',
    thresholds: [{ label: 'Folate deficiency', value: '< 7 nmol/L (3 µg/L)', source: 'bsh2014' }],
    sources: ['ml_b'],
    pubmed: 'folate deficiency diagnosis',
    rules: [(p) => (p.v < 7 ? F('attention', 'Folate in the deficiency range', `${v(p.v, 'nmol/L')} is below 7 nmol/L (3 µg/L), the BSH cut-off for folate deficiency.`, ['bsh2014']) : null)],
  },

  wbc: { about: 'White blood cells fight infection. Counts rise with infection, inflammation, stress, smoking and some medicines, and fall with some viral infections, medicines or bone-marrow problems.', sources: ['ml_wbc'], pubmed: 'white blood cell count interpretation' },
  plt: { about: 'Platelets help blood clot. Counts can rise with inflammation or iron deficiency and fall with some infections, medicines, liver disease or immune conditions.', sources: ['ml_plt'], pubmed: 'platelet count interpretation' },
  hct: { about: 'Hematocrit is the share of blood volume made up of red cells. It moves together with hemoglobin.', sources: ['ml_hct'], pubmed: 'hematocrit interpretation' },
  mcv: { about: 'MCV is the average size of red blood cells. Small cells (low MCV) suggest iron deficiency or thalassaemia trait; large cells (high MCV) suggest B12 or folate deficiency, alcohol, liver disease or some medicines.', sources: ['ml_mcv', 'ml_indices'], pubmed: 'mean corpuscular volume anemia classification' },
};
// ---- heart ---------------------------------------------------------------------------
Object.assign(KB, {
  qtc: {
    about: 'The QT interval is the time the heart’s chambers take to recharge electrically; QTc corrects it for heart rate. A long QTc can come from medicines, low potassium or magnesium, or inherited conditions, and raises the risk of a dangerous rhythm.',
    thresholds: [
      { label: 'Prolonged, men', value: '≥ 450 ms', source: 'aha2009qt' },
      { label: 'Prolonged, women', value: '≥ 460 ms', source: 'aha2009qt' },
      { label: 'Short', value: '≤ 390 ms', source: 'aha2009qt' },
      { label: 'Clearly higher risk of torsade de pointes', value: '> 500 ms', source: 'aha2010tdp' },
    ],
    note: 'Machine-measured QTc values vary with the correction formula; a cardiologist’s reading counts.',
    sources: ['aha2009qt'],
    pubmed: 'QTc prolongation risk',
    rules: [(p, c) => {
      if (p.v > 500) return F('alert', 'QTc above 500 ms', `${v(p.v, 'ms')}. A QT above 500 ms is associated with a two- to threefold higher risk of torsade de pointes. Check medicines that prolong QT and potassium/magnesium with a doctor promptly.`, ['aha2010tdp']);
      const lim = c.sex === 'female' ? 460 : c.sex === 'male' ? 450 : 460;
      if (p.v >= lim) return F('attention', 'QTc prolonged', `${v(p.v, 'ms')} is at or above ${lim} ms, the AHA/ACCF/HRS limit for a prolonged QTc${c.sex ? ` in ${c.sex === 'male' ? 'men' : 'women'}` : ''}. Worth reviewing medicines and electrolytes.`, ['aha2009qt']);
      if (!c.sex && p.v >= 450) return F('info', 'QTc borderline', `${v(p.v, 'ms')} counts as prolonged for men (≥ 450 ms) but not for women (≥ 460 ms). Add your sex in the profile for the right limit.`, ['aha2009qt']);
      if (p.v <= 390) return F('info', 'QTc short', `${v(p.v, 'ms')} is at or below 390 ms, which AHA/ACCF/HRS call a short QT interval.`, ['aha2009qt']);
      return F('good', 'QTc in the normal range', `${v(p.v, 'ms')}.`, ['aha2009qt']);
    }],
  },
  qt: { about: 'Uncorrected QT interval. It depends on heart rate, so QTc (corrected) is used for judging it.', sources: ['aha2009qt'], pubmed: 'QT interval' },
  pr: {
    about: 'The PR (PQ) interval is the time the electrical signal takes from the atria to the ventricles.',
    thresholds: [{ label: 'Usual range', value: '120–200 ms', source: 'aha2009qrs' }, { label: 'First-degree AV block', value: '> 200 ms', source: 'aha2009qrs' }],
    note: 'These limits come from reviews of the AHA/ACCF/HRS recommendations.',
    sources: ['aha2009qrs'],
    pubmed: 'PR interval first-degree atrioventricular block',
    rules: [(p) => (p.v > 200 ? F('info', 'PR interval over 200 ms', `${v(p.v, 'ms')} — the pattern called first-degree AV block. It can be a normal finding; mention it to your doctor, especially when medicines that slow the heart are considered.`, ['aha2009qrs']) : null)],
  },
  qrs: {
    about: 'QRS duration is how long the ventricles take to activate. A wide QRS can mean a bundle branch block.',
    thresholds: [{ label: 'Incomplete bundle branch block (adults)', value: '110–119 ms', source: 'aha2009qrs' }, { label: 'Complete bundle branch block (adults)', value: '≥ 120 ms', source: 'aha2009qrs' }],
    sources: ['aha2009qrs'],
    pubmed: 'QRS duration bundle branch block',
    rules: [(p) => {
      if (p.v >= 120) return F('attention', 'Wide QRS (≥ 120 ms)', `${v(p.v, 'ms')} is in the range of a complete bundle branch block. The ECG report says which one — ask your doctor what it means for you.`, ['aha2009qrs']);
      if (p.v >= 110) return F('info', 'QRS 110–119 ms', `${v(p.v, 'ms')} — the range of an incomplete bundle branch block.`, ['aha2009qrs']);
      return null;
    }],
  },
  ecg_hr: {
    about: 'Heart rate measured on the resting ECG.',
    thresholds: [{ label: 'Sinus bradycardia', value: '< 50 bpm', source: 'acc2018brady' }],
    sources: ['acc2018brady'],
    pubmed: 'resting heart rate',
    rules: [(p) => (p.v < 50 ? F('info', 'Heart rate below 50', `${v(p.v, 'bpm')}. Below 50 counts as sinus bradycardia. It can be normal, e.g. in fit people; it matters more with dizziness, fainting or tiredness.`, ['acc2018brady']) : null)],
  },
  pvc_pct: {
    about: 'The share of all heartbeats over the recording that were ventricular extra beats (PVCs, VES). A few are normal; a very high share over a long time can weaken the heart muscle.',
    thresholds: [{ label: 'Follow heart function; PVC cardiomyopathy possible', value: '≥ 10 %', source: 'esc2022va' }],
    sources: ['esc2022va'],
    pubmed: 'premature ventricular contraction burden cardiomyopathy',
    rules: [(p) => (p.v >= 10 ? F('attention', `PVC burden ${fmtNum(p.v)} %`, `ESC 2022: with a PVC burden of about 10 % or more, heart function (LVEF) should be followed up regularly, because frequent PVCs can weaken the heart muscle over time.`, ['esc2022va']) : null)],
  },
  af_burden: {
    about: 'Share of the recording spent in atrial fibrillation (AF).',
    thresholds: [{ label: 'Diagnosis of AF', value: 'AF on ECG for ≥ 30 s', source: 'esc2024af' }],
    sources: ['esc2024af'],
    pubmed: 'atrial fibrillation burden',
    rules: [(p) => (p.v > 0 ? F('alert', 'Atrial fibrillation recorded', `${fmtNum(p.v)} % of the recording. ESC: AF documented on an ECG for at least 30 seconds is diagnostic. A recorded AF episode should be discussed with a doctor — including whether stroke prevention is needed.`, ['esc2024af']) : null)],
  },
  pause_max: {
    about: 'The longest gap between two heartbeats during the recording.',
    thresholds: [{ label: 'Relevant when assessing fainting', value: '> 3 s with symptoms, > 6 s without', source: 'esc2021pace' }],
    sources: ['esc2021pace'],
    pubmed: 'sinus pause ambulatory ECG',
    rules: [(p) => (p.v > 3 ? F(p.v > 6 ? 'attention' : 'info', `Longest pause ${fmtNum(p.v)} s`, `The ESC pacing guideline considers pauses over 3 s (with symptoms) or over 6 s (without) when deciding about a pacemaker in people who faint. Whether it matters depends on symptoms and when it happened (e.g. during sleep).`, ['esc2021pace']) : null)],
  },
  lvef: {
    about: 'Left ventricular ejection fraction: the share of blood pumped out with each beat — the main measure of the heart’s pumping strength.',
    thresholds: [
      { label: 'Normal, men / women', value: '52–72 % / 54–74 %', source: 'ase2015' },
      { label: 'Heart failure with mildly reduced EF', value: '41–49 %', source: 'esc2021hf' },
      { label: 'Heart failure with reduced EF', value: '≤ 40 %', source: 'esc2021hf' },
    ],
    note: 'The heart-failure categories apply only together with symptoms and signs of heart failure.',
    sources: ['ase2015', 'esc2021hf'],
    pubmed: 'left ventricular ejection fraction',
    rules: [(p, c) => {
      if (p.v <= 40) return F('alert', `LVEF ${fmtNum(p.v)} %: reduced`, 'At or below 40 % — the range ESC calls reduced ejection fraction. This needs cardiology care.', ['esc2021hf']);
      if (p.v < 50) return F('attention', `LVEF ${fmtNum(p.v)} %: mildly reduced`, 'ESC calls 41–49 % mildly reduced ejection fraction.', ['esc2021hf']);
      const lo = c.sex === 'female' ? 54 : 52;
      if (p.v < lo) return F('info', `LVEF ${fmtNum(p.v)} %: just below normal`, `ASE/EACVI give ${c.sex === 'female' ? '54–74 % for women' : '52–72 % for men'} as normal.`, ['ase2015']);
      return F('good', `LVEF ${fmtNum(p.v)} %: normal`, 'Within the normal range (ASE/EACVI 2015).', ['ase2015']);
    }],
  },
  lvedd: {
    about: 'Inner diameter of the left ventricle when relaxed. A large value can mean the ventricle is dilated.',
    thresholds: [{ label: 'Normal, men', value: '42–58 mm', source: 'ase2015' }, { label: 'Normal, women', value: '38–52 mm', source: 'ase2015' }],
    sources: ['ase2015'],
    pubmed: 'left ventricular end-diastolic diameter',
    rules: [(p, c) => {
      if (!c.sex) return null;
      const hi = c.sex === 'male' ? 58.4 : 52.2;
      return p.v > hi ? F('attention', 'Left ventricle larger than normal', `${v(p.v, 'mm')} is above the ASE/EACVI upper limit of ${hi} mm for ${c.sex === 'male' ? 'men' : 'women'}.`, ['ase2015']) : null;
    }],
  },
  ivsd: {
    about: 'Thickness of the wall between the ventricles. Thicker walls are seen with long-standing high blood pressure, among other causes.',
    thresholds: [{ label: 'Normal, men / women', value: '6–10 mm / 6–9 mm', source: 'ase2015' }],
    sources: ['ase2015'],
    pubmed: 'interventricular septal thickness hypertrophy',
    rules: [(p, c) => {
      if (!c.sex) return null;
      const hi = c.sex === 'male' ? 10 : 9;
      return p.v > hi ? F('info', 'Septum thicker than normal', `${v(p.v, 'mm')} is above ${hi} mm, the upper normal value ASE/EACVI give for ${c.sex === 'male' ? 'men' : 'women'}.`, ['ase2015']) : null;
    }],
  },
  lavi: {
    about: 'Volume of the left atrium relative to body size. It grows with long-standing high filling pressure, e.g. from high blood pressure or valve disease.',
    thresholds: [{ label: 'Normal', value: '≤ 34 mL/m²', source: 'ase2015' }],
    sources: ['ase2015'],
    pubmed: 'left atrial volume index',
    rules: [(p) => (p.v > 34 ? F('info', 'Left atrium enlarged', `${v(p.v, 'mL/m²')} is above 34 mL/m², the ASE/EACVI upper normal limit.`, ['ase2015']) : null)],
  },
  ntprobnp: {
    about: 'NT-proBNP is released by the heart when its walls are stretched. It’s used to rule heart failure out.',
    thresholds: [{ label: 'Heart failure unlikely (not acute)', value: '< 125 ng/L (pg/mL)', source: 'esc2021hf' }, { label: 'Heart failure unlikely (acute)', value: '< 300 ng/L', source: 'esc2021hf' }],
    sources: ['esc2021hf'],
    pubmed: 'NT-proBNP heart failure diagnosis',
    rules: [(p) => (p.v >= 125 ? F('info', 'NT-proBNP 125 ng/L or more', `${v(p.v, 'ng/L')} — above the level ESC uses to rule heart failure out in a non-acute setting. That doesn’t mean heart failure; it means it can’t be ruled out by this test alone.`, ['esc2021hf']) : null)],
  },
});

KB.egfr_calc = {
  ...KB.egfr,
  about: 'Calculated by the app from your creatinine, age and sex with the CKD-EPI 2021 equation (without race), as recommended internationally. Your lab may report its own eGFR, which takes precedence.',
  rules: [(p, c) => egfrRule(p, c, 'egfr_calc')],
};

function egfrRule(p, c, key) {
  if (p.v >= 60) return null;
  const low = c.series(key).filter((q) => q.v < 60);
  const span = low.length > 1 ? (low[low.length - 1].t - low[0].t) / 864e5 : 0;
  const cat = p.v >= 45 ? 'G3a' : p.v >= 30 ? 'G3b' : p.v >= 15 ? 'G4' : 'G5';
  if (span >= 90) return F('alert', `eGFR below 60 for over 3 months (${cat})`,
    `Results below 60 from ${fmtDate(low[0].o.date)} to ${fmtDate(low[low.length - 1].o.date)}. A reduced eGFR lasting at least 3 months meets the KDIGO definition of chronic kidney disease.`, ['kdigo2024']);
  return F('attention', `eGFR in category ${cat}`, `${v(p.v, 'mL/min/1.73m²')} is below 60. KDIGO speaks of chronic kidney disease only if this persists for at least 3 months, so a repeat test matters.`, ['kdigo2024']);
}

// ---- patterns across tests ---------------------------------------------------

// ---- Body measurements ----------------------------------------------------------

function bmiRule(p) {
  const b = p.v;
  const muscle = ' BMI doesn’t tell fat from muscle; with a lot of muscle it overstates body fat — the waist measure and body fat % help here.';
  if (b < 18.5) return F('attention', `BMI ${fmtNum(b)}: underweight`, 'Below 18.5 kg/m², which WHO classes as underweight.', ['who_bmi']);
  if (b < 25) return F('good', `BMI ${fmtNum(b)}: healthy range`, 'Within 18.5–24.9 kg/m² (WHO).', ['who_bmi']);
  if (b < 30) return F('info', `BMI ${fmtNum(b)}: overweight`, 'WHO classes 25–29.9 kg/m² as overweight (pre-obesity).' + muscle, ['who_bmi']);
  const cls = b < 35 ? 'I' : b < 40 ? 'II' : 'III';
  return F('attention', `BMI ${fmtNum(b)}: obesity class ${cls}`, `WHO classes ${cls === 'I' ? '30–34.9' : cls === 'II' ? '35–39.9' : '40 or more'} kg/m² as obesity class ${cls}. Worth discussing with a doctor, together with blood pressure, lipids and HbA1c.`, ['who_bmi']);
}
const BMI_KB = {
  about: 'Body mass index: weight in kg divided by height in metres squared. A quick screen for under- and overweight in adults.',
  thresholds: [
    { label: 'Underweight', value: '< 18.5 kg/m²', source: 'who_bmi' },
    { label: 'Healthy range', value: '18.5–24.9 kg/m²', source: 'who_bmi' },
    { label: 'Overweight (pre-obesity)', value: '25–29.9 kg/m²', source: 'who_bmi' },
    { label: 'Obesity class I / II / III', value: '30–34.9 / 35–39.9 / ≥ 40 kg/m²', source: 'who_bmi' },
  ],
  note: 'Lower cut-offs are used for people of South Asian, Chinese and some other Asian backgrounds. BMI overstates fat in very muscular people.',
  sources: ['who_bmi', 'nice246'],
  pubmed: 'body mass index mortality',
  rules: [bmiRule],
};
// Only the newer of measured and calculated BMI is evaluated, so it isn't reported twice.
const newest = (own, other, rule) => (p, c) => {
  const q = c.latest(other);
  return q && (q.t > p.t || (q.t === p.t && own === 'bmi_calc')) ? null : rule(p, c);
};

Object.assign(KB, {
  bmi: { ...BMI_KB, rules: [newest('bmi', 'bmi_calc', bmiRule)] },
  bmi_calc: { ...BMI_KB, about: BMI_KB.about + ' Calculated here from your weight and the height in your profile.', rules: [newest('bmi_calc', 'bmi', bmiRule)] },
  waist: {
    about: 'Waist circumference shows fat around the belly, which is more closely tied to diabetes and heart disease than weight alone. Measure midway between the lowest rib and the top of the hip bone, after breathing out.',
    thresholds: [
      { label: 'Increased risk, men / women', value: '≥ 94 cm / ≥ 80 cm', source: 'who2008waist' },
      { label: 'Substantially increased risk, men / women', value: '≥ 102 cm / ≥ 88 cm', source: 'who2008waist' },
    ],
    note: 'These cut-offs are for European populations; lower ones are used for some Asian populations.',
    sources: ['who2008waist'],
    pubmed: 'waist circumference cardiovascular risk',
    rules: [(p, c) => {
      if (!c.sex) return null;
      const [a, b] = c.sex === 'male' ? [94, 102] : [80, 88];
      if (p.v >= b) return F('attention', `Waist ${v(p.v, 'cm')}: substantially increased risk`, `At or above ${b} cm, the level WHO links to a substantially increased risk of metabolic complications for ${c.sex === 'male' ? 'men' : 'women'}.`, ['who2008waist']);
      if (p.v >= a) return F('info', `Waist ${v(p.v, 'cm')}: increased risk`, `At or above ${a} cm, the level WHO links to an increased risk for ${c.sex === 'male' ? 'men' : 'women'} (substantially increased from ${b} cm).`, ['who2008waist']);
      return F('good', `Waist ${v(p.v, 'cm')}: below the risk threshold`, `Below ${a} cm (WHO, ${c.sex === 'male' ? 'men' : 'women'}).`, ['who2008waist']);
    }],
  },
  whtr_calc: {
    about: 'Waist circumference divided by height. NICE’s simple rule: keep your waist below half your height. Calculated here from your waist and the height in your profile.',
    thresholds: [
      { label: 'Healthy', value: '0.4–0.49', source: 'nice246' },
      { label: 'Increased central fat', value: '0.5–0.59', source: 'nice246' },
      { label: 'High central fat', value: '≥ 0.6', source: 'nice246' },
    ],
    note: 'For adults with a BMI under 35, both sexes and all ethnic backgrounds, including people with a lot of muscle.',
    sources: ['nice246'],
    pubmed: 'waist-to-height ratio',
    rules: [(p) => {
      if (p.v >= 0.6) return F('attention', `Waist-to-height ratio ${fmtNum(p.v)}: high`, '0.6 or more is what NICE calls high central adiposity, with further increased risk of type 2 diabetes, high blood pressure and heart disease.', ['nice246']);
      if (p.v >= 0.5) return F('info', `Waist-to-height ratio ${fmtNum(p.v)}: increased`, '0.5–0.59 is what NICE calls increased central adiposity. The aim is a waist below half your height.', ['nice246']);
      if (p.v >= 0.4) return F('good', `Waist-to-height ratio ${fmtNum(p.v)}: healthy`, 'Below 0.5 — your waist is less than half your height (NICE).', ['nice246']);
      return null;
    }],
  },
  body_fat_pct: {
    about: 'Share of body weight that is fat, estimated by bioimpedance (a weak current through the body) or other methods. There is no single guideline range; each device uses its own, usually by sex and age.',
    note: 'Readings vary with hydration, meals, exercise and time of day. Compare measurements made on the same device under the same conditions.',
    sources: [],
    pubmed: 'body fat percentage bioelectrical impedance',
  },
  visceral_fat_area: {
    about: 'Estimated area of fat around the organs inside the belly, in cm² at waist level. Visceral fat is the type most closely tied to metabolic risk. Body composition devices commonly use 100 cm² as their upper limit.',
    note: 'Bioimpedance only estimates visceral fat; CT or MRI measure it directly.',
    sources: [],
    pubmed: 'visceral fat area bioelectrical impedance',
  },
  muscle_mass: {
    about: 'Mass of the muscles attached to the skeleton (arms, legs, trunk), estimated by the device. Keeping it up with strength training matters more with age.',
    sources: [],
    pubmed: 'skeletal muscle mass health outcomes',
  },
  phase_angle: {
    about: 'A bioimpedance value that reflects cell health and cell mass; higher is generally better. It falls with age and illness.',
    sources: [],
    pubmed: 'phase angle bioelectrical impedance',
  },
  ecw_tbw: {
    about: 'Share of body water outside the cells. A higher value can mean fluid retention or swelling. Each device prints its own balanced range.',
    sources: [],
    pubmed: 'extracellular water total body water ratio',
  },
  weight: {
    about: 'Body weight. Weigh at the same time of day, ideally in the morning before eating, to compare readings. Unexplained weight loss is worth discussing with a doctor.',
    sources: [],
    pubmed: 'body weight change mortality',
  },
});

export const PATTERNS = [
  // Glucose and HbA1c both in the diabetes range around the same time.
  (c) => {
    const g = c.latest('glucose');
    const a = g && c.near('hba1c', g, 30);
    if (!g || !a || g.v < 7.0 || a.v < 48) return null;
    return { keys: ['glucose', 'hba1c'], level: 'alert', title: 'Glucose and HbA1c both in the diabetes range',
      text: `Fasting glucose ${v(g.v, 'mmol/L')} and HbA1c ${v(a.v, 'mmol/mol')} around ${fmtDate(g.o.date)}. ADA counts two abnormal results from different tests as confirming diabetes — to be discussed with a doctor.`, sources: ['ada2026'] };
  },
  // Low hemoglobin with ferritin < 45: iron deficiency anaemia pattern.
  (c) => {
    const hb = c.latest('hb');
    const fe = hb && c.near('ferritin', hb, 30);
    if (!hb || !fe || hb.status !== 'low' || fe.v >= 45) return null;
    return { keys: ['hb', 'ferritin'], level: 'alert', title: 'Pattern of iron deficiency anaemia',
      text: `Low hemoglobin (${v(hb.v, 'g/L')}) with ferritin ${v(fe.v, 'µg/L')}. In people with anaemia, AGA uses ferritin below 45 µg/L to diagnose iron deficiency and recommends finding the cause (e.g. a source of blood loss).`, sources: ['aga2020'] };
  },
  // Thyroid: TSH out of range, classified with free T4.
  (c) => {
    const t = c.latest('tsh');
    if (!t || (t.status !== 'high' && t.status !== 'low')) return null;
    const f = c.near('ft4', t, 14);
    if (!f) {
      return { keys: ['tsh'], level: 'attention', title: `TSH ${t.status === 'high' ? 'above' : 'below'} range without free T4`,
        text: 'Thyroid guidelines classify an abnormal TSH together with free T4. Measuring free T4 with the next TSH makes the result interpretable.', sources: [t.status === 'high' ? 'eta2013' : 'eta2015'] };
    }
    if (t.status === 'high' && f.status === 'normal') {
      return { keys: ['tsh', 'ft4'], level: t.v > 10 ? 'alert' : 'attention', title: 'Pattern of subclinical hypothyroidism',
        text: `TSH ${v(t.v, 'mU/L')} above range with normal free T4. ETA recommends repeating TSH and free T4 (with TPO antibodies) after 2–3 months.` + (t.v > 10 ? ' With TSH above 10 mU/L, ETA recommends treatment for people under 65–70 even without symptoms.' : ''), sources: ['eta2013'] };
    }
    if (t.status === 'low' && f.status === 'normal') {
      return { keys: ['tsh', 'ft4'], level: 'attention', title: `Pattern of subclinical hyperthyroidism (grade ${t.v < 0.1 ? 2 : 1})`,
        text: `TSH ${v(t.v, 'mU/L')} below range with normal free T4. ETA grades TSH 0.1–0.39 as grade 1 and below 0.1 as grade 2; free T3 completes the picture.`, sources: ['eta2015'] };
    }
    if ((t.status === 'high' && f.status === 'low') || (t.status === 'low' && f.status === 'high')) {
      const hypo = t.status === 'high';
      return { keys: ['tsh', 'ft4'], level: 'alert', title: hypo ? 'Pattern of an underactive thyroid' : 'Pattern of an overactive thyroid',
        text: `TSH ${hypo ? 'high' : 'low'} (${v(t.v, 'mU/L')}) with free T4 ${hypo ? 'low' : 'high'} (${v(f.v, 'pmol/L')}). This combination needs medical assessment.`, sources: [hypo ? 'eta2013' : 'eta2015'] };
    }
    return null;
  },
  // Lipids measured but never Lp(a).
  (c) => {
    if (c.latest('lpa') || !(c.latest('ldl') || c.latest('chol'))) return null;
    return { keys: ['ldl'], level: 'info', title: 'Lp(a) has never been measured',
      text: 'The 2025 ESC/EAS update recommends measuring lipoprotein(a) at least once in every adult’s lifetime. It is mostly inherited, so one test is usually enough.', sources: ['esc2025', 'eas2022'] };
  },
];
