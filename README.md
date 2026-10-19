# Health Records

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
- An "by disease" list shows the latest dose for each disease. Doses that are
  overdue or due within 90 days also appear on the overview.

**Data**
- Export and import a backup file (JSON with photos), via the iOS share sheet.
- Demo data: seven made-up check-ups from Finnish, German and Ukrainian labs
  plus a few vaccinations. You can remove it in one go.

## Trying it on a computer

Download [`dist/health-records-demo.html`](dist/health-records-demo.html) and
open it in Chrome, Edge or Firefox. It's a single self-contained file. The
first time it opens, it fills itself with a fictional person: a man born in
1980 with seven check-ups and a few vaccinations. You can remove the demo data
on the Data tab. [`dist/health-records.html`](dist/health-records.html) is the
same app, but starts empty.

Data is stored in the browser for that file, so moving or renaming the file
starts a fresh, empty app. On iPhone, the Files app only previews HTML
without running it; use the hosted version described below.

## Using it on iPhone

The app is static files (no server code), but it has to be served over HTTPS
for installing and offline use. GitHub Pages for a **private** repository
needs a paid GitHub plan. Options:

1. **Make the repository public and turn on GitHub Pages** (Settings → Pages →
   deploy from branch). The repository contains only the app's code, never your
   data, which stays on your phone.
2. Keep it private and host it free on **Cloudflare Pages** or **Netlify**,
   both of which can deploy from a private GitHub repository.

Then open the URL in Safari, tap Share → *Add to Home Screen*, and always
start the app from that icon. Safari can clear storage for websites you
haven't visited in a while, but not for Home Screen apps. Still, **export a
backup regularly**, because the data exists only on the phone.

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
| `js/data.js`, `js/demo.js` | Backup, storage, demo data |

Results are stored as printed (value, unit and range as text) and are parsed
and converted on load. Improvements to the catalogue therefore also apply to
results saved earlier.

## Planned next

- **Polar:** import the Flow data export (*Account → Download your data*) for
  resting heart rate, sleep, Nightly Recharge and training load.
- **Blood pressure:** quick entry and a trend chart.
- **DNA:** read the raw data files from 23andMe and tellmeGen and show a short
  list of well-known variants, linked to related lab tests (e.g. iron). This is
  informational only, not diagnostic.
- A timeline of check-ups, vaccinations, illnesses and medications, and a
  printable summary for doctor visits.

This app doesn't give medical advice. Reference ranges come from your labs.
