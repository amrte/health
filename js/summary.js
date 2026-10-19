// Builds the text a user pastes into Claude to discuss their results. Pure function.

import { CATEGORIES } from './metrics.js';
import { fmtNum, fmtRange } from './format.js';
import { SOURCES } from './knowledge.js';

const MARK = { high: ' (H)', low: ' (L)' };

function valueOf(p) {
  if (p.text) return p.text;
  if (p.v != null) return `${p.qualifier}${fmtNum(p.v)}`;
  if (p.raw != null) return `${p.qualifier}${fmtNum(p.raw)} ${p.o.unit}`;
  return p.o.valueRaw;
}

function rangeOf(pts) {
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    if (p.lo != null || p.hi != null) return fmtRange(p.lo, p.hi);
    if (p.o.refRaw) return p.o.refRaw;
  }
  return '';
}

// opts: { keys: Set, history: 'all' | 'recent', profile, includeProfile, findings, includeFindings,
//         vaccines, includeVaccines, question, now }
export function buildSummary(byMetric, opts) {
  const lines = [];
  lines.push('I keep track of my own lab results and would like help understanding them. Please:');
  lines.push('1. Explain in plain language what these results and their trends could mean, and what usually causes values like these.');
  lines.push('2. Look up current, high-quality evidence — clinical guidelines, systematic reviews and major recent studies — that applies to these values, and cite each source with a link.');
  lines.push('3. Tell me what to raise with my doctor, and suggest questions to ask.');
  lines.push('Don’t diagnose me. Say where more information or tests would be needed, and where guidelines disagree.');
  lines.push('');

  if (opts.includeProfile && (opts.profile?.sex || opts.profile?.birthYear)) {
    const age = opts.profile.birthYear ? new Date(opts.now ?? Date.now()).getFullYear() - opts.profile.birthYear : null;
    lines.push(`About me: ${[opts.profile.sex, age != null ? `${age} years old` : ''].filter(Boolean).join(', ')}.`);
  }
  if (opts.question?.trim()) lines.push(`My question: ${opts.question.trim()}`);
  if (lines[lines.length - 1] !== '') lines.push('');

  lines.push('My results (date: value; H/L = outside the lab’s reference range; units converted to the one shown):');
  for (const [cat, title] of CATEGORIES) {
    const entries = [...byMetric.values()].filter((e) => e.m.cat === cat && opts.keys.has(e.m.key))
      .sort((a, b) => a.m.name.localeCompare(b.m.name));
    if (!entries.length) continue;
    lines.push('', `${title}:`);
    for (const e of entries) {
      const pts = opts.history === 'recent' ? e.pts.slice(-3) : e.pts;
      const range = rangeOf(e.pts);
      const head = `- ${e.m.name}${e.m.unit ? ` (${e.m.unit})` : ''}${range ? `, lab range ${range}` : ''}${e.m.derived ? ', calculated' : ''}`;
      const vals = pts.map((p) => `${p.o.date}: ${valueOf(p)}${MARK[p.status] ?? ''}`).join('; ');
      const more = e.pts.length > pts.length ? ` (${e.pts.length - pts.length} older results not shown)` : '';
      lines.push(`${head}: ${vals}${more}`);
    }
  }

  if (opts.includeFindings) {
    const fs = (opts.findings ?? []).filter((f) => f.keys.some((k) => opts.keys.has(k)) && f.level !== 'good');
    if (fs.length) {
      lines.push('', 'What my tracking app noted (rule-based, may be incomplete):');
      for (const f of fs) {
        const src = f.sources.map((id) => SOURCES[id]?.short).filter(Boolean);
        lines.push(`- ${f.title}. ${f.text}${src.length ? ` [${src.join(', ')}]` : ''}`);
      }
    }
  }

  if (opts.fitness?.length) {
    lines.push('', 'Blood pressure and watch data (watch values: last 7 days vs. the 4 weeks before):');
    for (const f of opts.fitness) lines.push(`- ${f}`);
  }

  if (opts.includeMeds && opts.meds?.length) {
    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    const allergies = opts.meds.filter((m) => m.kind === 'allergy');
    const taken = opts.meds.filter((m) => m.kind !== 'allergy');
    if (allergies.length) {
      lines.push('', 'Allergies and intolerances:');
      for (const a of allergies) lines.push(`- ${a.name}${a.reaction ? `: ${a.reaction}` : ''}${a.severity ? ` (${a.severity})` : ''}`);
    }
    if (taken.length) {
      lines.push('', 'Medicines and supplements (with dates, to relate them to the results):');
      for (const m of [...taken].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) {
        const when = m.stop && m.stop < today ? `${m.start || '?'} to ${m.stop}` : m.start ? `since ${m.start}` : 'dates not recorded';
        lines.push(`- ${m.name}${m.ingredient && m.ingredient.toLowerCase() !== m.name.toLowerCase() ? ` (${m.ingredient})` : ''}${m.dose ? ` ${m.dose}` : ''}${m.schedule ? `, ${m.schedule}` : ''}${m.reason ? `, for ${m.reason}` : ''}: ${when}`);
      }
    }
  }

  if (opts.includeVaccines && opts.vaccines?.length) {
    lines.push('', 'Vaccinations:');
    for (const v of [...opts.vaccines].sort((a, b) => a.date.localeCompare(b.date))) {
      lines.push(`- ${v.date}: ${v.name || 'vaccination'}${v.targets?.length ? ` (${v.targets.join(', ')})` : ''}${v.dose ? `, ${v.dose}` : ''}`);
    }
  }
  return lines.join('\n');
}
