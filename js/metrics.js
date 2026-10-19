// Catalogue of lab tests: canonical unit, unit conversions and the names labs
// print for them in English, German, Finnish, Ukrainian and Russian.
//
// Each test is stored in its canonical unit (mostly SI, as Finnish and Ukrainian
// labs report them). `alt` maps other units to a factor (canonical = value × f)
// or to [a, b] for affine conversions (canonical = value × a + b).
// `not` lists name fragments that rule a match out, e.g. "LDL" for total cholesterol.

import { normUnit, prepareUnits } from './units.js';

export const CATEGORIES = [
  ['cbc', 'Blood count'],
  ['diff', 'White cell differential'],
  ['metabolic', 'Glucose & metabolism'],
  ['lipids', 'Lipids'],
  ['kidney', 'Kidney'],
  ['liver', 'Liver & pancreas'],
  ['electrolytes', 'Electrolytes & minerals'],
  ['iron', 'Iron'],
  ['thyroid', 'Thyroid'],
  ['inflammation', 'Inflammation'],
  ['vitamins', 'Vitamins'],
  ['hormones', 'Hormones'],
  ['coag', 'Coagulation'],
  ['other', 'Other'],
];
export const CATEGORY_NAME = Object.fromEntries(CATEGORIES);

const COUNT = { 'g/l': 1, '/ul': 0.001 }; // 10⁹/L cell counts
const URINE = ['urin', 'harn', 'сеч', 'моч', 'virtsa'];

const DEFS = [
  // Blood count
  { key: 'hb', cat: 'cbc', name: 'Hemoglobin', unit: 'g/L', alt: { 'g/dl': 10, 'mmol/l': 16.114 },
    aliases: ['hb', 'hgb', 'hemoglobin', 'haemoglobin', 'hämoglobin', 'hemoglobiini', 'гемоглобін', 'гемоглобин'],
    not: ['a1c', 'glyk', 'glyc', 'глік', 'глик', 'mch', 'ghb'] },
  { key: 'rbc', cat: 'cbc', name: 'Red blood cells', unit: '10¹²/L', alt: { 't/l': 1 },
    aliases: ['rbc', 'erythrocytes', 'red blood cells', 'red blood cell count', 'erythrozyten', 'erytrosyytit', 'eryt', 'ery', 'еритроцити', 'эритроциты'],
    not: ['senk', 'sediment', 'осідан', 'оседан', 'ширин', 'width', 'verteil', 'distribution', 'rdw', 'mch', 'mcv', 'volum', 'об єм', 'объем', 'вміст', 'содерж', 'концентр'] },
  { key: 'hct', cat: 'cbc', name: 'Hematocrit', unit: '%', alt: { 'l/l': 100, ratio: 100 },
    unitless: (v) => (v < 1.5 ? v * 100 : v),
    aliases: ['hct', 'hkt', 'hkr', 'ht', 'hematocrit', 'haematocrit', 'hämatokrit', 'hematokriitti', 'гематокрит'] },
  { key: 'mcv', cat: 'cbc', name: 'MCV (mean red cell volume)', unit: 'fL',
    aliases: ['mcv', 'mean corpuscular volume', 'mittleres zellvolumen', 'mittleres korpuskuläres volumen', 'середній об єм еритроцита', 'середній об єм еритроцитів', 'средний объем эритроцита', 'средний объем эритроцитов'] },
  { key: 'mch', cat: 'cbc', name: 'MCH (mean red cell hemoglobin)', unit: 'pg', alt: { fmol: 16.114 },
    aliases: ['mch', 'hbe', 'mean corpuscular hemoglobin', 'mittlerer hb gehalt', 'середній вміст гемоглобіну', 'средний уровень гемоглобина', 'среднее содержание гемоглобина'],
    not: ['mchc', 'konz', 'conc', 'концентр'] },
  { key: 'mchc', cat: 'cbc', name: 'MCHC', unit: 'g/L', alt: { 'g/dl': 10, 'mmol/l': 16.114 },
    aliases: ['mchc', 'mean corpuscular hemoglobin concentration', 'mittlere hb konzentration', 'середня концентрація гемоглобіну', 'средняя концентрация гемоглобина'] },
  { key: 'rdw', cat: 'cbc', name: 'RDW', unit: '%',
    aliases: ['rdw', 'rdw cv', 'ery verteilungsbreite', 'erythrozytenverteilungsbreite', 'red cell distribution width', 'ширина розподілу еритроцитів', 'ширина распределения эритроцитов'],
    not: ['sd'] },
  { key: 'plt', cat: 'cbc', name: 'Platelets', unit: '10⁹/L', alt: COUNT,
    aliases: ['plt', 'platelets', 'platelet count', 'thrombocytes', 'thrombozyten', 'trombosyytit', 'trom', 'tromb', 'тромбоцити', 'тромбоциты'],
    not: ['mpv', 'volum', 'объем', 'об єм', 'pdw', 'pct', 'крит', 'aggreg'] },
  { key: 'mpv', cat: 'cbc', name: 'MPV (mean platelet volume)', unit: 'fL',
    aliases: ['mpv', 'mean platelet volume', 'mittleres thrombozytenvolumen', 'середній об єм тромбоцитів', 'средний объем тромбоцитов'] },
  { key: 'wbc', cat: 'cbc', name: 'White blood cells', unit: '10⁹/L', alt: COUNT,
    aliases: ['wbc', 'white blood cells', 'white blood cell count', 'leukocytes', 'leucocytes', 'leukozyten', 'leukosyytit', 'leuk', 'leuko', 'лейкоцити', 'лейкоциты'],
    not: [...URINE, 'formel', 'формула'] },
  { key: 'esr', cat: 'cbc', name: 'ESR (sedimentation rate)', unit: 'mm/h',
    aliases: ['esr', 'sed rate', 'erythrocyte sedimentation rate', 'bsg', 'bsr', 'blutsenkung', 'blutkörperchensenkung', 'blutsenkungsgeschwindigkeit', 'la', 'lasko', 'шое', 'шзе', 'соэ', 'швидкість осідання еритроцитів', 'скорость оседания эритроцитов', 'шое по вестергрену'] },
  { key: 'retic', cat: 'cbc', name: 'Reticulocytes', unit: '%', alt: { promille: 0.1 },
    aliases: ['reticulocytes', 'retikulozyten', 'retikulosyytit', 'retic', 'ретикулоцити', 'ретикулоциты'] },

  // Glucose & metabolism
  { key: 'glucose', cat: 'metabolic', name: 'Glucose', unit: 'mmol/L', alt: { 'mg/dl': 0.0555 },
    aliases: ['glucose', 'fasting glucose', 'blood glucose', 'glukose', 'glucose nüchtern', 'glukose nüchtern', 'nüchternglukose', 'blutzucker', 'glukoosi', 'gluk', 'gluc', 'glu', 'глюкоза', 'глюкоза крові', 'глюкоза натще'],
    not: [...URINE, 'a1c', 'toleran', 'ogtt'] },
  { key: 'hba1c', cat: 'metabolic', name: 'HbA1c', unit: 'mmol/mol', alt: { '%': [10.929, -23.5] },
    aliases: ['hba1c', 'hb a1c', 'a1c', 'ghba1c', 'ghb a1c', 'hba1c ifcc', 'hba1c dcct', 'glykohemoglobiini', 'glykiertes hämoglobin', 'glycated hemoglobin', 'glycated haemoglobin', 'глікований гемоглобін', 'гликированный гемоглобин', 'глікозильований гемоглобін', 'гликозилированный гемоглобин'] },
  { key: 'insulin', cat: 'metabolic', name: 'Insulin', unit: 'mU/L', alt: { 'pmol/l': 1 / 6 },
    aliases: ['insulin', 'insuliini', 'інсулін', 'инсулин'], not: ['resist', 'homa', 'antik', 'antib'] },
  { key: 'homa', cat: 'metabolic', name: 'HOMA-IR', unit: '',
    aliases: ['homa', 'homa ir', 'індекс homa', 'индекс homa'] },

  // Lipids
  { key: 'chol', cat: 'lipids', name: 'Total cholesterol', unit: 'mmol/L', alt: { 'mg/dl': 0.02586 },
    aliases: ['cholesterol', 'total cholesterol', 'cholesterin', 'gesamtcholesterin', 'cholesterin gesamt', 'kolesteroli', 'kol', 'chol', 'tc', 'холестерин', 'холестерин загальний', 'загальний холестерин', 'общий холестерин', 'холестерин общий'],
    not: ['ldl', 'hdl', 'лпнщ', 'лпвщ', 'лпднщ', 'лпнп', 'лпвп', 'лпонп', 'non', 'nicht', 'низьк', 'висок', 'низк', 'высок', 'ratio', 'quotient', 'verhält', 'співвід', 'соотнош', 'index', 'індекс', 'индекс', 'не лп'] },
  { key: 'ldl', cat: 'lipids', name: 'LDL cholesterol', unit: 'mmol/L', alt: { 'mg/dl': 0.02586 },
    aliases: ['ldl', 'ldl c', 'ldl cholesterol', 'ldl cholesterin', 'kol ldl', 'ldl kolesteroli', 'лпнщ', 'лпнп', 'холестерин лпнщ', 'холестерин лпнп', 'низької щільності', 'низкой плотности'],
    not: ['vldl', 'лпднщ', 'лпонп', 'дуже', 'очень', 'ratio', 'quotient', 'verhält', 'співвід', 'соотнош'] },
  { key: 'hdl', cat: 'lipids', name: 'HDL cholesterol', unit: 'mmol/L', alt: { 'mg/dl': 0.02586 },
    aliases: ['hdl', 'hdl c', 'hdl cholesterol', 'hdl cholesterin', 'kol hdl', 'hdl kolesteroli', 'лпвщ', 'лпвп', 'холестерин лпвщ', 'холестерин лпвп', 'високої щільності', 'высокой плотности'],
    not: ['non', 'nicht', 'ratio', 'quotient', 'verhält', 'співвід', 'соотнош', 'не лп'] },
  { key: 'nonhdl', cat: 'lipids', name: 'Non-HDL cholesterol', unit: 'mmol/L', alt: { 'mg/dl': 0.02586 },
    aliases: ['non hdl', 'non hdl c', 'non hdl cholesterol', 'non hdl cholesterin', 'nicht hdl cholesterin', 'kol non hdl', 'холестерин не лпвщ', 'не лпвщ', 'холестерин не лпвп'] },
  { key: 'trig', cat: 'lipids', name: 'Triglycerides', unit: 'mmol/L', alt: { 'mg/dl': 0.01129 },
    aliases: ['triglycerides', 'triglyceride', 'triglyzeride', 'triglyseridit', 'trigly', 'tg', 'тригліцериди', 'триглицериды'] },
  { key: 'apob', cat: 'lipids', name: 'Apolipoprotein B', unit: 'g/L', alt: { 'mg/dl': 0.01 },
    aliases: ['apob', 'apo b', 'apolipoprotein b', 'аполіпопротеїн b', 'аполипопротеин b'] },
  { key: 'lpa', cat: 'lipids', name: 'Lipoprotein(a)', unit: 'nmol/L',
    aliases: ['lp a', 'lipoprotein a', 'lipoproteiini a', 'ліпопротеїн а', 'липопротеин а', 'ліпопротеїн a', 'липопротеин a'] },

  // Kidney
  { key: 'crea', cat: 'kidney', name: 'Creatinine', unit: 'µmol/L', alt: { 'mg/dl': 88.42 },
    aliases: ['creatinine', 'kreatinin', 'kreatiniini', 'krea', 'crea', 'creat', 'креатинін', 'креатинин'],
    not: ['gfr', 'clear', 'кліренс', 'клиренс', 'скф', 'шкф', ...URINE, 'ratio', 'kinase', 'kinaasi', 'кіназ', 'киназ'] },
  { key: 'egfr', cat: 'kidney', name: 'eGFR', unit: 'mL/min/1.73m²',
    aliases: ['egfr', 'gfr', 'gfre', 'ckd epi', 'egfr ckd epi', 'gfr ckd epi', 'gfr mdrd', 'skf', 'шкф', 'скф', 'швидкість клубочкової фільтрації', 'скорость клубочковой фильтрации'] },
  { key: 'urea', cat: 'kidney', name: 'Urea', unit: 'mmol/L', alt: { 'mg/dl': 0.1665 },
    aliases: ['urea', 'harnstoff', 'karbamidi', 'сечовина', 'мочевина'], not: ['nitrogen', 'stickstoff', 'bun'] },
  { key: 'bun', cat: 'kidney', name: 'BUN (urea nitrogen)', unit: 'mg/dL',
    aliases: ['bun', 'urea nitrogen', 'blood urea nitrogen', 'harnstoff stickstoff', 'азот сечовини', 'азот мочевины'] },
  { key: 'uric', cat: 'kidney', name: 'Uric acid', unit: 'µmol/L', alt: { 'mg/dl': 59.48 },
    aliases: ['uric acid', 'urate', 'harnsäure', 'uraatti', 'сечова кислота', 'мочевая кислота'] },
  { key: 'cysc', cat: 'kidney', name: 'Cystatin C', unit: 'mg/L',
    aliases: ['cystatin c', 'cystatin', 'kystatiini c', 'kystatiini', 'цистатин c', 'цистатин с'] },

  // Liver & pancreas
  { key: 'alt', cat: 'liver', name: 'ALT', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['alt', 'alat', 'gpt', 'alt gpt', 'alat gpt', 'gpt alt', 'alanine aminotransferase', 'alanin aminotransferase', 'алт', 'аланінамінотрансфераза', 'аланинаминотрансфераза'] },
  { key: 'ast', cat: 'liver', name: 'AST', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['ast', 'asat', 'got', 'ast got', 'asat got', 'got ast', 'aspartate aminotransferase', 'aspartat aminotransferase', 'аст', 'аспартатамінотрансфераза', 'аспартатаминотрансфераза'] },
  { key: 'ggt', cat: 'liver', name: 'GGT', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['ggt', 'gt', 'gamma gt', 'γ gt', 'y gt', 'gamma glutamyltransferase', 'gamma glutamyl transferase', 'ггт', 'гамма гт', 'гамма глутамілтрансфераза', 'гамма глутамилтрансфераза', 'гамма глутамілтранспептидаза', 'гамма глутамилтранспептидаза'] },
  { key: 'alp', cat: 'liver', name: 'Alkaline phosphatase (ALP)', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['alp', 'ap', 'afos', 'alkaline phosphatase', 'alkalische phosphatase', 'alkalinen fosfataasi', 'лужна фосфатаза', 'щелочная фосфатаза', 'лф', 'щф'] },
  { key: 'bili', cat: 'liver', name: 'Bilirubin (total)', unit: 'µmol/L', alt: { 'mg/dl': 17.1 },
    aliases: ['bilirubin', 'bilirubin total', 'total bilirubin', 'gesamtbilirubin', 'bilirubin gesamt', 'bilirubiini', 'bil', 'білірубін', 'білірубін загальний', 'загальний білірубін', 'билирубин', 'билирубин общий', 'общий билирубин'],
    not: ['direkt', 'direct', 'konj', 'conj', 'прям', 'indirekt', 'indirect', 'unkonj', 'kj', ...URINE] },
  { key: 'bili_direct', cat: 'liver', name: 'Bilirubin (direct)', unit: 'µmol/L', alt: { 'mg/dl': 17.1 },
    aliases: ['direct bilirubin', 'bilirubin direct', 'bilirubin direkt', 'direktes bilirubin', 'bilirubin konjugiert', 'konjugoitu bilirubiini', 'bil kj', 'білірубін прямий', 'прямий білірубін', 'билирубин прямой', 'прямой билирубин'],
    not: ['indirekt', 'indirect', 'непрям'] },
  { key: 'bili_indirect', cat: 'liver', name: 'Bilirubin (indirect)', unit: 'µmol/L', alt: { 'mg/dl': 17.1 },
    aliases: ['indirect bilirubin', 'bilirubin indirect', 'bilirubin indirekt', 'indirektes bilirubin', 'білірубін непрямий', 'непрямий білірубін', 'билирубин непрямой', 'непрямой билирубин'] },
  { key: 'alb', cat: 'liver', name: 'Albumin', unit: 'g/L', alt: { 'g/dl': 10 },
    aliases: ['albumin', 'albumiini', 'alb', 'альбумін', 'альбумин'],
    not: [...URINE, 'micro', 'mikro', 'ratio', 'quotient', 'креат', 'krea', 'crea', 'globulin'] },
  { key: 'protein', cat: 'liver', name: 'Total protein', unit: 'g/L', alt: { 'g/dl': 10 },
    aliases: ['total protein', 'protein', 'protein gesamt', 'gesamteiweiss', 'gesamtprotein', 'proteiini', 'prot', 'загальний білок', 'білок загальний', 'общий белок', 'белок общий'],
    not: ['reakt', 'reactiv', 'reaktiiv', 'реактив', 'crp', 'срб', ...URINE, 'binding', 'apolipo'] },
  { key: 'ldh', cat: 'liver', name: 'LDH', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['ldh', 'ld', 'lactate dehydrogenase', 'laktatdehydrogenase', 'laktaattidehydrogenaasi', 'лдг', 'лактатдегідрогеназа', 'лактатдегидрогеназа'] },
  { key: 'ck', cat: 'liver', name: 'Creatine kinase (CK)', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['ck', 'cpk', 'creatine kinase', 'kreatinkinase', 'kreatiinikinaasi', 'креатинкіназа', 'креатинкиназа', 'кфк'],
    not: ['mb'] },
  { key: 'lipase', cat: 'liver', name: 'Lipase', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['lipase', 'lipaasi', 'ліпаза', 'липаза'], not: ['lipoprotein'] },
  { key: 'amylase', cat: 'liver', name: 'Amylase', unit: 'U/L', alt: { 'ukat/l': 60 },
    aliases: ['amylase', 'alpha amylase', 'amylaasi', 'pankreasamylase', 'амілаза', 'амилаза', 'альфа амілаза', 'альфа амилаза'], not: URINE },

  // Electrolytes & minerals
  { key: 'na', cat: 'electrolytes', name: 'Sodium', unit: 'mmol/L',
    aliases: ['sodium', 'natrium', 'na', 'натрій', 'натрий'], not: URINE },
  { key: 'k', cat: 'electrolytes', name: 'Potassium', unit: 'mmol/L',
    aliases: ['potassium', 'kalium', 'k', 'калій', 'калий'], not: URINE },
  { key: 'cl', cat: 'electrolytes', name: 'Chloride', unit: 'mmol/L',
    aliases: ['chloride', 'chlorid', 'kloridi', 'cl', 'хлор', 'хлориди', 'хлориды'], not: URINE },
  { key: 'ca', cat: 'electrolytes', name: 'Calcium', unit: 'mmol/L', alt: { 'mg/dl': 0.2495 },
    aliases: ['calcium', 'kalzium', 'kalsium', 'ca', 'total calcium', 'calcium gesamt', 'кальцій', 'кальций', 'кальцій загальний', 'кальций общий'],
    not: ['ion', 'іоніз', 'иониз', 'free', 'frei', 'korr', 'corr', 'albumin', ...URINE] },
  { key: 'ca_ion', cat: 'electrolytes', name: 'Ionized calcium', unit: 'mmol/L',
    aliases: ['ionized calcium', 'ionised calcium', 'ca ion', 'ca ion 7 4', 'ionisiertes calcium', 'calcium ionisiert', 'іонізований кальцій', 'кальцій іонізований', 'ионизированный кальций', 'кальций ионизированный'] },
  { key: 'mg', cat: 'electrolytes', name: 'Magnesium', unit: 'mmol/L', alt: { 'mg/dl': 0.4114 },
    aliases: ['magnesium', 'mg', 'магній', 'магний'], not: URINE },
  { key: 'phos', cat: 'electrolytes', name: 'Phosphate', unit: 'mmol/L', alt: { 'mg/dl': 0.3229 },
    aliases: ['phosphate', 'phosphat', 'phosphor', 'phosphorus', 'fosfaatti', 'pi', 'фосфор', 'фосфати', 'фосфаты', 'фосфор неорганічний', 'фосфор неорганический'],
    not: ['phosphatase', 'fosfataasi', 'фосфатаз', ...URINE] },

  // Iron
  { key: 'ferritin', cat: 'iron', name: 'Ferritin', unit: 'µg/L',
    aliases: ['ferritin', 'ferritiini', 'ferrit', 'феритин', 'ферритин'] },
  { key: 'iron', cat: 'iron', name: 'Iron', unit: 'µmol/L', alt: { 'ug/dl': 0.1791 },
    aliases: ['iron', 'serum iron', 'eisen', 'rauta', 'fe', 'залізо', 'железо', 'залізо сироваткове', 'сироваткове залізо', 'железо сывороточное', 'сывороточное железо'],
    not: ['bind', 'capac', 'tibc', 'ferrit', 'satur', 'sätt', 'saturaat', 'насич', 'насыщ', 'зв язув', 'связыв', 'transferr', 'sitomis'] },
  { key: 'transferrin', cat: 'iron', name: 'Transferrin', unit: 'g/L', alt: { 'mg/dl': 0.01 },
    aliases: ['transferrin', 'transferriini', 'трансферин', 'трансферрин'],
    not: ['sätt', 'satur', 'saturaat', 'kyllä', 'насич', 'насыщ', 'rezept', 'recept', 'resept'] },
  { key: 'tsat', cat: 'iron', name: 'Transferrin saturation', unit: '%',
    aliases: ['transferrin saturation', 'tsat', 'tf sat', 'transferrinsättigung', 'transferrin sättigung', 'transferriinin saturaatio', 'transferriinin kyllästeisyys', 'насичення трансферину', 'коефіцієнт насичення трансферину', 'насыщение трансферрина', 'коэффициент насыщения трансферрина'] },
  { key: 'tibc', cat: 'iron', name: 'Total iron-binding capacity', unit: 'µmol/L', alt: { 'ug/dl': 0.1791 },
    aliases: ['tibc', 'total iron binding capacity', 'eisenbindungskapazität', 'raudansitomiskyky', 'загальна залізозв язувальна здатність', 'ожсс'] },

  // Thyroid
  { key: 'tsh', cat: 'thyroid', name: 'TSH', unit: 'mU/L',
    aliases: ['tsh', 'tsh basal', 'basal tsh', 'thyrotropin', 'thyreotropin', 'tyreotropiini', 'ттг', 'тиреотропний гормон', 'тиреотропный гормон'] },
  { key: 'ft4', cat: 'thyroid', name: 'Free T4', unit: 'pmol/L', alt: { 'ng/dl': 12.87 },
    aliases: ['ft4', 'free t4', 't4 free', 'freies t4', 'ft4 freies thyroxin', 'freies thyroxin', 't4v', 't4 v', 'vapaa t4', 'free thyroxine', 'тироксин вільний', 'вільний тироксин', 'т4 вільний', 'вільний т4', 'т4 свободный', 'свободный т4', 'свободный тироксин', 'тироксин свободный'] },
  { key: 'ft3', cat: 'thyroid', name: 'Free T3', unit: 'pmol/L', alt: { 'ng/l': 1.536 },
    aliases: ['ft3', 'free t3', 't3 free', 'freies t3', 'freies trijodthyronin', 't3v', 't3 v', 'vapaa t3', 'free triiodothyronine', 'т3 вільний', 'вільний т3', 'трийодтиронін вільний', 'т3 свободный', 'свободный т3', 'трийодтиронин свободный'] },
  { key: 'tpo', cat: 'thyroid', name: 'Anti-TPO antibodies', unit: 'IU/mL',
    aliases: ['anti tpo', 'tpo ak', 'tpo antibodies', 'tpo ab', 'tpoab', 'tpo vasta aineet', 'anti tpo antikörper', 'ат тпо', 'ат до тпо', 'антитіла до тпо', 'антитела к тпо', 'антитіла до тиреопероксидази', 'антитела к тиреопероксидазе'] },

  // Inflammation
  { key: 'crp', cat: 'inflammation', name: 'CRP', unit: 'mg/L', alt: { 'mg/dl': 10 },
    aliases: ['crp', 'c reactive protein', 'c reaktives protein', 'c reaktiivinen proteiini', 'срб', 'с реактивний білок', 'c реактивний білок', 'с реактивный белок', 'c реактивный белок'],
    not: ['hs', 'high sens', 'hochsens', 'ultra', 'ультра', 'високочутл', 'высокочувств'] },
  { key: 'hscrp', cat: 'inflammation', name: 'hs-CRP', unit: 'mg/L', alt: { 'mg/dl': 10 },
    aliases: ['hs crp', 'hscrp', 'crp hs', 'high sensitivity crp', 'hochsensitives crp', 'crp ultrasensitiv', 'вч срб', 'срб високочутливий', 'срб высокочувствительный'] },

  // Vitamins
  { key: 'vitd', cat: 'vitamins', name: 'Vitamin D (25-OH)', unit: 'nmol/L', alt: { 'ug/l': 2.496 },
    aliases: ['vitamin d', 'vitamin d3', '25 oh vitamin d', '25 oh d', '25 oh d3', '25 hydroxy vitamin d', '25 hydroxyvitamin d', 'calcidiol', 'd vitamiini', 'd 25', 'd25', 'вітамін d', 'вітамін д', 'витамин d', 'витамин д', '25 он вітамін d', '25 он витамин d', 'вітамін d 25 он', 'витамин d 25 он', 'вітамін d3', 'витамин d3', '25 oh vitamin d3'] },
  { key: 'b12', cat: 'vitamins', name: 'Vitamin B12', unit: 'pmol/L', alt: { 'ng/l': 0.7378 },
    aliases: ['vitamin b12', 'vitamin b 12', 'b12', 'b 12', 'cobalamin', 'b12 vitamiini', 'kobalamiini', 'вітамін b12', 'витамин b12', 'вітамін в12', 'витамин в12', 'ціанокобаламін', 'цианокобаламин', 'кобаламін'],
    not: ['holo', 'active', 'aktiv', 'aktiiv', 'tc2', 'активн'] },
  { key: 'holotc', cat: 'vitamins', name: 'Holotranscobalamin (active B12)', unit: 'pmol/L',
    aliases: ['holotranscobalamin', 'holo tc', 'holotc', 'active b12', 'aktives vitamin b12', 'aktives b12', 'aktiivinen b12', 'b12 tc2', 'holotranskobalamiini', 'активний b12', 'активный b12', 'голотранскобаламін', 'голотранскобаламин'] },
  { key: 'folate', cat: 'vitamins', name: 'Folate', unit: 'nmol/L', alt: { 'ug/l': 2.266 },
    aliases: ['folate', 'folic acid', 'folsäure', 'folat', 'folaatti', 'fola', 'фолієва кислота', 'фолиевая кислота', 'фолати', 'фолаты'] },

  // Hormones
  { key: 'testo', cat: 'hormones', name: 'Testosterone', unit: 'nmol/L', alt: { 'ng/dl': 0.03467, 'ug/l': 3.467 },
    aliases: ['testosterone', 'total testosterone', 'testosteron', 'testosteron gesamt', 'testosteroni', 'тестостерон', 'тестостерон загальний', 'тестостерон общий'],
    not: ['free', 'frei', 'vapaa', 'вільн', 'свобод', 'bio'] },
  { key: 'shbg', cat: 'hormones', name: 'SHBG', unit: 'nmol/L',
    aliases: ['shbg', 'sex hormone binding globulin', 'sexualhormon bindendes globulin', 'гзсг', 'гспг'] },
  { key: 'cortisol', cat: 'hormones', name: 'Cortisol', unit: 'nmol/L', alt: { 'ug/dl': 27.59 },
    aliases: ['cortisol', 'kortisol', 'kortisoli', 'кортизол'], not: URINE },
  { key: 'psa', cat: 'hormones', name: 'PSA', unit: 'µg/L',
    aliases: ['psa', 'psa total', 'gesamt psa', 'prostate specific antigen', 'prostataspezifisches antigen', 'пса', 'пса загальний', 'пса общий', 'простатспецифічний антиген', 'простатспецифический антиген'],
    not: ['free', 'frei', 'vapaa', 'вільн', 'свобод', 'quotient', 'ratio', 'fpsa'] },
  { key: 'estradiol', cat: 'hormones', name: 'Estradiol', unit: 'pmol/L', alt: { 'ng/l': 3.671 },
    aliases: ['estradiol', 'östradiol', 'oestradiol', 'estradioli', 'e2', 'естрадіол', 'эстрадиол'] },
  { key: 'dheas', cat: 'hormones', name: 'DHEA-S', unit: 'µmol/L', alt: { 'ug/dl': 0.02714 },
    aliases: ['dhea s', 'dheas', 'dhea so4', 'dhea sulfat', 'dhea sulfate', 'дгеа с', 'дгэа с', 'дгеа сульфат', 'дгэа сульфат'] },

  // Coagulation
  { key: 'inr', cat: 'coag', name: 'INR', unit: '',
    aliases: ['inr', 'pt inr', 'tt inr', 'quick inr', 'мно', 'мнв'] },
  { key: 'fibrinogen', cat: 'coag', name: 'Fibrinogen', unit: 'g/L', alt: { 'mg/dl': 0.01 },
    aliases: ['fibrinogen', 'fibrinogeeni', 'фібриноген', 'фибриноген'] },
];

// White cell differential: each cell type exists as % and as absolute count.
const DIFF = [
  ['neut', 'Neutrophils', ['neutrophils', 'neutrophil', 'neutrophile', 'neutrophile granulozyten', 'neutrofiilit', 'neut', 'neu', 'ne', 'нейтрофіли', 'нейтрофилы'],
    ['паличк', 'палочк', 'сегмент', 'stab', 'segment', 'band', 'lymph']],
  ['lymph', 'Lymphocytes', ['lymphocytes', 'lymphozyten', 'lymfosyytit', 'lymf', 'lym', 'lymph', 'ly', 'лімфоцити', 'лимфоциты'], ['atyp', 'reakt']],
  ['mono', 'Monocytes', ['monocytes', 'monozyten', 'monosyytit', 'mono', 'mon', 'mo', 'моноцити', 'моноциты'], []],
  ['eos', 'Eosinophils', ['eosinophils', 'eosinophile', 'eosinophile granulozyten', 'eosinofiilit', 'eos', 'eo', 'еозинофіли', 'эозинофилы'], []],
  ['baso', 'Basophils', ['basophils', 'basophile', 'basophile granulozyten', 'basofiilit', 'baso', 'bas', 'ba', 'базофіли', 'базофилы'], []],
];
for (const [base, name, aliases, not] of DIFF) {
  DEFS.push({ key: base + '_pct', cat: 'diff', name: name + ' %', unit: '%', aliases, not, pair: base });
  DEFS.push({ key: base + '_abs', cat: 'diff', name: name + ' (count)', unit: '10⁹/L', alt: COUNT, aliases: [], not, pair: base });
}
DEFS.push(
  { key: 'neut_band_pct', cat: 'diff', name: 'Band neutrophils %', unit: '%',
    aliases: ['band neutrophils', 'stabkernige', 'stabkernige neutrophile', 'stabkernige granulozyten', 'sauvat', 'паличкоядерні', 'нейтрофіли паличкоядерні', 'палочкоядерные', 'нейтрофилы палочкоядерные'] },
  { key: 'neut_seg_pct', cat: 'diff', name: 'Segmented neutrophils %', unit: '%',
    aliases: ['segmented neutrophils', 'segs', 'segmentkernige', 'segmentkernige neutrophile', 'segmentkernige granulozyten', 'сегментоядерні', 'нейтрофіли сегментоядерні', 'сегментоядерные', 'нейтрофилы сегментоядерные'] },
);

export const METRICS = DEFS.map(prepareUnits);
const BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export function getMetric(key) {
  return BY_KEY.get(key) ?? null;
}

// ---- name matching -------------------------------------------------------

export function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Finnish result names start with the specimen: B- blood, P- plasma, fP- fasting
// plasma, S- serum, E- red cells. Urine (U-, dU-, PU-) is not in the catalogue.
const SPECIMEN = new Set(['b', 'fb', 'p', 'fp', 's', 'fs', 'e', 'pt', 'vb', 'ab', 'sb', 'cb']);
const URINE_SPECIMEN = new Set(['u', 'du', 'pu', 'fu']);

const EXACT = new Map();
const CONTAINS = [];
for (const m of METRICS) {
  m.notN = (m.not ?? []).map(normName).filter(Boolean);
  const names = new Set([m.key, m.name, ...m.aliases].map(normName).filter(Boolean));
  if (m.pair && m.key.endsWith('_abs')) continue; // matched through the % twin
  for (const a of names) {
    if (!EXACT.has(a)) EXACT.set(a, m.key);
    if (a.length >= 3) CONTAINS.push([a, m.key]);
  }
}
CONTAINS.sort((a, b) => b[0].length - a[0].length);

function excluded(m, n) {
  return m.notN.some((x) => n.includes(x));
}

// Picks % or absolute count for a white-cell differential match.
function pickVariant(key, raw, unit, value) {
  const m = BY_KEY.get(key);
  if (!m?.pair || !BY_KEY.has(m.pair + '_abs')) return key;
  const nu = normUnit(unit);
  let pct;
  if (nu === '%' || /%/.test(raw)) pct = true;
  else if (nu || /#|\babs/i.test(raw)) pct = false;
  else pct = value != null && value > 10;
  return m.pair + (pct ? '_pct' : '_abs');
}

// Returns the catalogue key for a printed test name, or null when unsure.
export function matchMetric(name, unit = '', value = null) {
  const raw = String(name ?? '');
  const n = normName(raw);
  if (!n) return null;
  const tokens = n.split(' ');
  if (tokens.length > 1 && URINE_SPECIMEN.has(tokens[0])) return null;
  // Try the name without a Finnish specimen prefix too ("B-Hb" → "hb"), but
  // keep the full name first so "B 12" still means vitamin B12.
  const forms = [n];
  if (tokens.length > 1 && SPECIMEN.has(tokens[0])) forms.push(tokens.slice(1).join(' '));

  let key = null;
  for (const f of forms) {
    const k = EXACT.get(f);
    if (k && !excluded(BY_KEY.get(k), f)) { key = k; break; }
  }
  for (const f of key ? [] : forms) {
    const padded = ` ${f} `;
    const hit = CONTAINS.find(([a, k]) => padded.includes(` ${a} `) && !excluded(BY_KEY.get(k), f));
    if (hit) { key = hit[1]; break; }
  }
  return key ? pickVariant(key, raw, unit, value) : null;
}

// Key for a test the catalogue doesn't know; results with the same printed name share it.
export function customKey(name) {
  return 'custom:' + normName(name).replace(/ /g, '-');
}
