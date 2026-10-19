// Evaluation of results: general checks (out of range, repeated, trends) plus
// guideline rules from knowledge.js. Pure functions over derived store data.
//
// A finding: { keys: [metric keys], level, title, text, sources: [source ids] }
// Levels, most to least urgent: 'alert' (discuss with a doctor), 'attention',
// 'info', 'good'.

import { KB, PATTERNS } from './knowledge.js';
import { fmtNum, fmtDate, fmtRange } from './format.js';

export const LEVELS = ['alert', 'attention', 'info', 'good'];
const YEAR = 365.25 * 864e5;

export function ageAt(profile, iso) {
  if (!profile?.birthYear || !iso) return null;
  return Number(iso.slice(0, 4)) - profile.birthYear;
}

// Context handed to knowledge rules.
export function makeContext(byMetric, profile = {}, now = Date.now()) {
  const latest = (key) => {
    const e = byMetric.get(key);
    if (!e) return null;
    for (let i = e.pts.length - 1; i >= 0; i--) if (e.pts[i].v != null) return e.pts[i];
    return null;
  };
  return {
    byMetric,
    profile,
    sex: profile.sex || '',
    now,
    latest,
    series: (key) => (byMetric.get(key)?.pts ?? []).filter((p) => p.v != null),
    // Latest value of `key` measured within `days` of point p (same blood draw or close to it).
    near: (key, p, days = 14) => {
      const pts = byMetric.get(key)?.pts ?? [];
      let best = null;
      for (const q of pts) {
        if (q.v == null || Math.abs(q.t - p.t) > days * 864e5) continue;
        if (!best || Math.abs(q.t - p.t) < Math.abs(best.t - p.t)) best = q;
      }
      return best;
    },
    age: (p) => ageAt(profile, p?.o?.date),
  };
}

function linearFit(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p.t / YEAR);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = pts.reduce((a, p) => a + p.v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  pts.forEach((p, i) => { sxy += (xs[i] - mx) * (p.v - my); sxx += (xs[i] - mx) ** 2; });
  const slope = sxx ? sxy / sxx : 0; // units per year
  return { slope, at: (t) => my + slope * (t / YEAR - mx) };
}

// General checks that need no guideline: lab range, repeats, trends, age of data.
export function generalFindings(key, entry, now = Date.now()) {
  const { m, pts } = entry;
  const unit = m.unit;
  const num = pts.filter((p) => p.v != null);
  const last = pts[pts.length - 1];
  const out = [];
  const range = (p) => fmtRange(p.lo, p.hi) + (unit ? ` ${unit}` : '');

  if (last.status === 'high' || last.status === 'low') {
    let n = 1;
    for (let i = pts.length - 2; i >= 0 && pts[i].status === last.status; i--) n++;
    const word = last.status === 'high' ? 'above' : 'below';
    out.push({
      keys: [key], level: 'attention', kind: 'range',
      title: `${m.name} ${word} the lab’s range`,
      text: (last.lo != null || last.hi != null ? `Latest ${fmtNum(last.v ?? last.raw)} ${unit} vs. reference ${range(last)}. ` : 'Marked by the lab as out of range. ') +
        (n > 1 ? `It was ${word} the range in the last ${n} tests in a row.` : 'One result out of range can be a fluctuation; repeat tests show whether it persists.'),
      sources: [],
    });
  }

  // Steady trend: at least 3 results, the last 3 moving the same way, fitted change ≥ 20 %.
  if (num.length >= 3) {
    const recent = num.filter((p) => p.t >= num[num.length - 1].t - 6 * YEAR).slice(-6);
    if (recent.length >= 3) {
      const [a, b, c] = recent.slice(-3).map((p) => p.v);
      const dir = Math.sign(c - b);
      const monotonic = dir !== 0 && Math.sign(b - a) === dir;
      const fit = linearFit(recent);
      const first = recent[0];
      const lastN = recent[recent.length - 1];
      const from = fit.at(first.t);
      const to = fit.at(lastN.t);
      const change = from ? (to - from) / Math.abs(from) : 0;
      if (monotonic && Math.sign(fit.slope) === dir && Math.abs(change) >= 0.2) {
        const verb = dir < 0 ? 'Falling' : 'Rising';
        let text = `${fmtNum(first.v)} → ${fmtNum(lastN.v)} ${unit} since ${fmtDate(first.o.date)} (${change > 0 ? '+' : '−'}${Math.round(Math.abs(change) * 100)} % on the trend line).`;
        let level = 'info';
        const limit = dir < 0 ? lastN.lo : lastN.hi;
        if (limit != null && lastN.status === 'normal') {
          const years = (limit - lastN.v) / fit.slope;
          if (years > 0 && years < 3) {
            level = 'attention';
            text += ` Still in range, but at this rate it would reach the ${dir < 0 ? 'lower' : 'upper'} limit (${fmtNum(limit)}) in about ${years < 1 ? Math.max(1, Math.round(years * 12)) + ' months' : fmtNum(years) + ' years'}.`;
          }
        }
        out.push({ keys: [key], level, kind: 'trend', title: `${m.name}: ${verb.toLowerCase()} steadily`, text, sources: [] });
      }
    }
  }

  // An out-of-range result that hasn't been re-checked for a long time.
  if ((last.status === 'high' || last.status === 'low') && now - last.t > 2 * YEAR) {
    out.push({ keys: [key], level: 'info', kind: 'age', title: `${m.name}: last result is ${Math.floor((now - last.t) / YEAR)} years old`,
      text: 'It was out of range then. A new test would show where it is now.', sources: [] });
  }
  return out;
}

// Runs the guideline rules for one test. Rules get (latest point, context).
export function guidelineFindings(key, entry, ctx) {
  const kb = KB[key];
  if (!kb?.rules) return [];
  const p = ctx.latest(key);
  if (!p) return [];
  const out = [];
  for (const rule of kb.rules) {
    const f = rule(p, ctx);
    if (f) out.push({ keys: [key], kind: 'guideline', sources: [], ...f });
  }
  return out;
}

export function evaluate(byMetric, profile = {}, now = Date.now()) {
  const ctx = makeContext(byMetric, profile, now);
  const out = [];
  for (const [key, entry] of byMetric) {
    out.push(...generalFindings(key, entry, now), ...guidelineFindings(key, entry, ctx));
  }
  for (const pattern of PATTERNS) {
    const f = pattern(ctx);
    if (f) out.push({ kind: 'pattern', sources: [], ...f });
  }
  // Most urgent first; within a level, cross-test patterns and guideline rules
  // before plain lab-range notes.
  const KINDS = ['pattern', 'guideline', 'trend', 'range', 'age'];
  return out.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

// Values shown as e.g. "4.2 mmol/L (162 mg/dL)" in rule texts.
export function show(v, unit) {
  return `${fmtNum(v)}${unit ? ' ' + unit : ''}`;
}
