# Натуральний майонез оливковий 67%

A private health records app (the name and look are inspired by an olive
mayonnaise pack: white, green ribbon, olives, no red).

A private health tracker that runs in the browser. It's made for iPhone
(Safari → *Add to Home Screen*) and works on any device. All records and photos
stay in the browser's storage on that device. Nothing is uploaded, and the app
works offline.

## What it does now

**Lab results**
- Add a report with its date, lab and photos or screenshots of the printout.
- **Claude reads the values.** Tap *Copy instructions*, then in the Claude app
  attach the photo, paste and send. Copy the reply back into the app. No API
  key is needed; it runs on your normal Claude subscription. Every value is
  shown for checking before it's saved, and you can also type rows by hand.
- Test names are recognised in **English, German, Finnish, Ukrainian and
  Russian**, e.g. `B-Hb`, `Hämoglobin` and `Гемоглобін` are all hemoglobin.
- **Units are converted.** g/dL (Germany) and g/L (Finland, Ukraine), mg/dL
  and mmol/L, `/nl`, `E9/l` and `×10⁹/л` all end up on one chart. The printed
  value is kept as well.
- Overview of every test: latest value, ▲ high / ▼ low against the lab's own
  reference range, a sparkline, and a list of what was out of range at the
  last test.
- A trend chart for each test with the reference range shaded. Tap a point to
  see its value and source. A full table lists every result.
- Search across tests, labs and notes.

**Evaluation**
- Each test gets a *What this means* card. The overview lists the findings
  worth a look. Every finding shows where it comes from.
- General checks: out of the lab's range, out of range several times in a
  row, steady rises or falls, values drifting toward a limit, and old
  out-of-range results that were never re-checked.
- Guideline rules, each linked to its source:
  - WHO anaemia and ferritin cut-offs
  - ADA/WHO glucose and HbA1c ranges
  - ESC/EAS LDL goals, triglycerides and Lp(a)
  - KDIGO eGFR categories, including the 3-month rule for chronic kidney
    disease
  - ACG healthy ALT limits
  - IOM vitamin D, AHA/CDC hs-CRP, BSH folate
- Patterns across tests:
  - glucose and HbA1c both in the diabetes range
  - low hemoglobin with ferritin < 45 µg/L
  - TSH read together with free T4 (ETA)
  - ferritin read together with CRP
  - Lp(a) never measured
- The profile (sex, birth year) enables limits that differ by sex or age.
  It also lets the app calculate eGFR from creatinine (CKD-EPI 2021) and
  non-HDL cholesterol.
- *About this test*: what the test measures, common causes of high and low
  values, guideline limits, sources, and a PubMed link to guidelines and
  systematic reviews from the last 5 years.
- All guideline content is in `js/knowledge.js`, together with the date it
  was reviewed. A number goes in only once it has been checked against its
  source. Where that wasn't possible (for example HDL cut-offs, or hemoglobin
  limits above age 65), the app uses only the lab's own range.

**Fitness (Polar)**
- Import the Polar account export: at account.polar.com choose *Download
  your data*, and Polar emails a link to a ZIP. Single sessions exported from
  Polar Flow (CSV or JSON) also work. The ZIP is read on the device, one
  file at a time.
- Imported:
  - workouts (sport, duration, distance, heart rate, calories, cardio load)
  - daily steps, active time and calories
  - sleep duration and sleep score
  - Nightly Recharge: night-time heart rate, HRV (RMSSD), breathing rate and
    ANS charge
  - the lowest heart rate of each day, from 24/7 heart rate
- Re-importing updates days instead of duplicating them. Unrecognised files
  are listed after the import.
- On screen:
  - 7-day tiles compared with the previous 4 weeks
  - weekly workout minutes against WHO's 150-minute line
  - trend charts and monthly averages
- Findings: activity vs. WHO 2020, sleep vs. the AASM/SRS "7 hours or more",
  and heart rate or HRV changes against your own baseline.
- Polar doesn't document the export format. The parser follows real export
  files and open-source parsers, and is tested with made-up files in the
  same format (`tests/polar.test.js`).

**Blood pressure**
- Quick entry: upper and lower value, pulse, date and time, arm, and whether
  it was measured at home or at a doctor's office.
- Import from a cuff app's CSV export (Omron, Withings, Beurer and similar;
  columns are recognised by name), or have Claude read a paper diary from a
  photo.
- A daily chart from the lower to the upper value, with the home limits marked.
- Findings:
  - The home average (last 7 days, at least 3 days of readings) is classed by
    the ESC 2024 home categories: non-elevated, elevated, or hypertension
    from 135/85.
  - Office readings are classed by ESC 2024 and ESH 2023 grades.
  - A reading of 180/110 or more triggers an alert, with the AHA advice on
    symptoms that need emergency care.

**DNA (23andMe, tellmeGen)**
- Import the raw data file (ZIP, TXT or CSV). It's read on the device, and
  only the 16 positions the app explains are kept; the rest of the genome is
  never stored. Rows are matched by rsID or by chromosome position, since
  both providers sometimes use their own IDs.
- Variants:
  - **Health:** HFE haemochromatosis (C282Y, H63D); factor V Leiden and
    prothrombin G20210A
  - **Medicines:** statins (SLCO1B1), clopidogrel (CYP2C19), warfarin
    sensitivity (VKORC1, CYP2C9), following CPIC
  - **Traits:** lactose tolerance (LCT), ACTN3, MTHFR (with the ACMG note on
    its limited use)
  - **APOE:** hidden until you explicitly choose to see it
- Genotypes are read on the GRCh37 plus strand. Factor V Leiden and ACTN3 are
  handled specially, because the reference sequence itself carries the
  variant. Files reported on the opposite strand are detected where possible.
- With files from both providers, the app shows where they agree and where
  they disagree.
- DNA is combined with lab values: an HFE genotype together with high
  ferritin, and SLCO1B1 together with LDL.
- A clear note on accuracy (Tandy-Connor 2018: about 40 % false positives
  among reported variants in medically important genes). A missing variant
  means "not tested", not "normal".

**Teeth**
- A tooth chart in FDI numbering (11–48). Each tooth's state comes from its
  treatment history: fillings with surfaces, root canal, crown, bridge,
  implant, extraction, sealant, "to watch". The chart shows letter badges, so
  it never relies on colour alone.
- Visits store their treatments, prices, bills, X-rays (panoramic, bitewing,
  periapical, 3D) linked to teeth, and the next check-up date. Costs are added
  up per year and currency.
- Claude reads dental bills and treatment records and converts other tooth
  notations to FDI. A due or overdue check-up appears on the overview.

**Heart and doctor letters**
- Record types: lab results, ECG, long-term ECG (Holter), echocardiogram,
  doctor's letter, other document.
- For each type Claude extracts the values, and for documents it also writes
  a summary, diagnoses, recommendations, medications and the follow-up date.
  Follow-ups appear on the overview.
- New measurements with trends: QTc, PR, QRS, heart rate, Holter heart rates,
  PVC and PAC counts and burden, AF burden, longest pause, LVEF, LVEDD,
  IVSd, LAVI, NT-proBNP and troponin.
- Rules and their sources:
  - prolonged QTc ≥450 ms in men and ≥460 ms in women, >500 ms
    (AHA/ACCF/HRS 2009, AHA 2010)
  - wide QRS, and PR >200 ms
  - PVC burden ≥10 % (ESC 2022)
  - any AF recorded (ESC 2024)
  - pauses (ESC 2021)
  - LVEF categories (ESC 2021 HF, ASE/EACVI 2015)
  - heart size limits (ASE/EACVI 2015)
  - NT-proBNP rule-out level (ESC 2021)
- The Heart page brings together the findings, the heart records, the values,
  blood pressure and heart-related blood tests.

**Body measurements**
- Weight, height, waist and hip, BMI, body fat, fat and muscle mass,
  visceral fat, body water (ECW/TBW), protein, minerals, basal metabolic
  rate, phase angle and lean and fat mass per arm, leg and trunk.
- Claude reads body composition printouts (InBody, Tanita, gym or clinic
  reports such as Oma Puhti) in any of the five languages. Where a printout
  shows the previous value next to the current one, Claude keeps only the
  current value unless the previous date is printed. Device ranges are kept as
  the reference.
- Quick entry for weight, waist, hip and body fat from a scale or tape measure.
- With the height in the profile, BMI and the waist-to-height ratio are
  calculated.
- Rules and their sources:
  - BMI classes (WHO)
  - waist ≥94/102 cm for men and ≥80/88 cm for women (WHO 2008)
  - waist-to-height ratio 0.5 and 0.6 (NICE NG246)
- Values above the device's range where more is better (muscle, lean mass,
  phase angle) are not flagged.

**Medicines and allergies**
- List of medicines, supplements and allergies with dose, schedule, reason
  and start/stop dates. Claude reads packages, prescriptions (Omakanta,
  e-Rezept) and allergy cards; medicines in doctor letters can be added with
  one tap.
- Test pages show the medicines that affect them (statins → LDL, iron →
  ferritin, vitamin D, B12, thyroid hormone, metformin, folic acid) as bars on
  the chart.
- Checks: a medicine that matches an allergy (incl. penicillins and NSAIDs as
  groups), and statins, clopidogrel and warfarin against your DNA (CPIC).
- Medicines and allergies can be included in the summary for Claude.

**Heart-risk score (SCORE2)**
- 10-year risk of heart attack or stroke for ages 40–69 (SCORE2, ESC 2021),
  from age, sex, smoking, blood pressure (office readings, else home average)
  and total/HDL cholesterol. Coefficients as published (Eur Heart J
  2022;43:241); the unit tests reproduce the paper's worked examples.
- Risk region in the profile: Finland and Germany are "moderate" in SCORE2.
- Shows the ESC/EAS 2025 risk category and the LDL goal that follows from
  it, plus the ESC 2021 age-specific category.
- Not calculated with diabetes (HbA1c ≥ 48 mmol/mol), a marked condition
  (heart or vascular disease, kidney disease, familial
  hypercholesterolaemia), under 40 or from 70 (SCORE2-OP isn't implemented).

**Timeline and illness diary**
- Lab results, heart and body records, dental visits, vaccinations, medicines
  started and stopped, screenings and diary entries (illnesses, injuries,
  surgeries, hospital stays, travel, life events) in one list by year.
- Illnesses are shaded on every test chart, so a CRP spike during a cold is
  easy to spot.

**Reminders and screening**
- Reminders for retests, from any test page or by hand. A reminder for a test
  clears itself when a newer result arrives.
- Retests suggested by guideline rules: TSH, free T4 and TPO antibodies after
  2–3 months (ETA), eGFR after 3 months (KDIGO).
- Screening programmes by age and sex, Finland (bowel, breast, cervical;
  invitation by letter) and Germany (Check-up 35, hepatitis B/C, skin, bowel,
  prostate, aortic aneurysm, breast, cervical, lung for heavy smokers), with
  "mark done" and the next due date. Due items appear on the overview.

**Summary for the doctor**
- One A4 page to print or save as PDF: allergies, current medicines (and
  those stopped in the last year), diagnoses from doctor letters, illnesses
  and surgeries, blood pressure, SCORE2, vaccinations, what the app flagged,
  and a results table with the latest value, reference range, a small trend
  line, the direction and the two previous values.
- Results: the main tests plus anything out of range, or all tests from the
  last 2 years. An optional name and your questions for the visit are
  printed but not saved.

**Compare two values**
- Any two of: lab tests, body measurements, watch values (night-time heart
  rate, HRV, sleep, steps…), daily blood pressure and weekly workout minutes,
  on one timeline with a scale each.
- Suggestions such as night-time heart rate & sleep or blood pressure &
  weight; "Compare with…" on every test page.
- Daily values can be smoothed to 7-day averages. With at least 8 pairs close
  in time, the strength of the link is shown (Pearson r, from the raw
  values), with the reminder that correlation isn't causation.

**Search**
- Searches everything:
  - tests, including their names in English, German, Finnish, Ukrainian and
    Russian and the names labs print
  - lab reports, findings, vaccinations and diseases
  - DNA genes and rsIDs, blood pressure days and workouts
  - app sections (with Ukrainian keywords too, e.g. "тиск" or "щеплення")
- Forgives one typo per word from 5 letters.
- On a phone: the search box on the Overview. On wide screens: the sidebar
  box, opened with ⌘K or "/". Arrow keys move through results and Enter
  opens one.

**Discuss with Claude**
- A button on the overview and on every test page. It builds a summary to paste
  into the Claude app. You choose:
  - which tests to include (from a test page, it starts with that test and
    related ones)
  - all history or only the last 3 results
  - whether to include age and sex, the app's findings, and vaccinations
  - an optional question of your own
- The summary asks Claude to explain the results, look up current guidelines,
  systematic reviews and recent studies with links, and suggest questions for
  your doctor. Nothing is sent until you paste it.

**Vaccinations**
- Date, vaccine, diseases covered, dose, batch number, place and next-due date.
- Diseases are filled in from the vaccine name (e.g. *Boostrix Polio* →
  tetanus, diphtheria, whooping cough, polio).
- Claude can read a whole vaccination booklet (Impfpass) or certificate in one
  go. Entries Claude wasn't sure about are marked for checking.
- **National schedules, Finland (THL) and Germany (STIKO) side by side.**
  Based on your recorded doses and birth year, they cover:
  - tetanus/diphtheria boosters (Finland: ages 25/45/65, then every 10 years;
    Germany: every 10 years, once as Tdap)
  - the TBE series and boosters by age
  - yearly flu and COVID shots by age
  - pneumococcal, shingles and RSV
  - notes on polio, MMR and Finland's varicella catch-up

  Each rule links to the THL or STIKO page it came from (`js/schedules.js`).
- A "by disease" list shows the latest dose for each disease. Doses that are
  overdue or due within 90 days also appear on the overview.

**Data**
- Export and import a backup file (JSON with photos), via the iOS share sheet.
- Demo data: seven made-up check-ups from Finnish, German and Ukrainian labs
  plus a few vaccinations. You can remove it in one go.

## Trying it on a computer

Download [`dist/health-records-demo.html`](dist/health-records-demo.html) and
open it in Chrome, Edge or Firefox. On wide screens (MacBook and other
laptops) the app switches to a desktop layout: a sidebar instead of the bottom
tabs, two-column overview and charts, and side-by-side panels. If the browser
refuses storage for local files (Safari can), the app still runs but keeps
changes only until the tab is closed, and says so. It's a single self-contained file. The
first time it opens, it fills itself with a fictional person: a man born in
1980 with seven check-ups and a few vaccinations. You can remove the demo data
on the Data tab. [`dist/health-records.html`](dist/health-records.html) is the
same app, but starts empty.

Data is stored in the browser, not in the file. Browsers may share that
storage between local files, or tie it to the file's location, so use
*Export backup* before relying on it. On iPhone, the Files app only previews HTML
without running it; use the hosted version described below.

## Using it on iPhone

The app is published with GitHub Pages at **https://amrte.github.io/health/**.
The workflow in `.github/workflows/pages.yml` runs the unit tests and deploys
on every push. Only the app's code is published, never your data, which
stays on your phone.

One-time setup (repository owner):
1. Settings → General → Danger Zone → *Change visibility* → Public. GitHub
   Pages for private repositories needs a paid plan.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → *Deploy to GitHub Pages* → *Run workflow*. This is only needed
   once, if the first run failed before Pages was enabled.

Then open the URL in Safari, tap Share → *Add to Home Screen*, and always
start the app from that icon. Home Screen apps keep their data (Safari can
clear website storage after a while), and the app works offline. Still,
**export a backup regularly**, because the data exists only on the device.
On a Mac, the same URL works in Safari, Chrome or Firefox, and the data
stays separate per browser.

## Development

No build step: plain ES modules, HTML and CSS.

```sh
npm install         # only needed for the browser test
npm run serve       # http://localhost:8080/
npm run build       # single-file builds in dist/
npm test            # unit tests + headless Chromium end-to-end test
npm run icons       # re-render PNG icons from icons/icon.svg
```

Set `CHROMIUM_PATH` if Playwright's bundled browser isn't installed.

| File | Purpose |
| --- | --- |
| `js/metrics.js` | Test catalogue: canonical units, conversions, names in 5 languages |
| `js/units.js` | Unit spelling normalisation and conversion |
| `js/parse.js` | Values, reference ranges, Claude instructions and reply parsing |
| `js/store.js`, `js/db.js` | IndexedDB storage and derived data |
| `js/views.js`, `js/chart.js` | Overview, test detail, reports; SVG charts |
| `js/editor.js` | Add/edit lab report |
| `js/vaccines.js` | Vaccinations |
| `js/evaluate.js`, `js/knowledge.js` | Evaluation engine; guideline rules and sources |
| `js/calc.js`, `js/insights.js` | Calculated values (eGFR, non-HDL); findings UI |
| `js/polar.js`, `js/zip.js` | Polar import; streaming ZIP reader |
| `js/fitness.js`, `js/fitness-eval.js` | Fitness screen and findings |
| `js/bp.js`, `js/bp-eval.js` | Blood pressure entry, import, chart, ESC/ESH evaluation |
| `js/genome.js`, `js/dna-variants.js`, `js/dna.js`, `js/dna-eval.js` | Raw DNA reader, curated variants, DNA screen, DNA + lab findings |
| `js/body.js` | Body page: weight, waist, body composition, quick entry |
| `js/meds.js`, `js/meds-data.js` | Medicines and allergies; drug groups, allergy and DNA checks |
| `js/score2.js` | SCORE2 risk model, risk categories, LDL goal |
| `js/timeline.js` | Timeline and illness diary |
| `js/print.js` | One-page summary for doctor visits |
| `js/compare.js` | Two values on one chart, correlation |
| `js/reminders.js`, `js/screening.js` | Reminders, suggested retests, Finnish and German screening |
| `js/data.js`, `js/demo.js` | Backup, storage, demo data |

The logo is `icons/logo.webp` (the pack's lettering, cut out; on dark
backgrounds it sits on a cream label). The olive branch is `icons/olive-branch.png` (a
transparent 24 KB picture); the single-file build inlines it.

Results are stored as printed (value, unit and range as text) and are parsed
and converted on load. Improvements to the catalogue therefore also apply to
results saved earlier.

## Planned next

- SCORE2-OP (age 70+) once its coefficients are checked against the paper.

This app doesn't give medical advice. Reference ranges come from your labs.
