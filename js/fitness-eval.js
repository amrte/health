// Findings for watch data: weekly activity and sleep against guidelines, and
// changes against the person's own recent baseline.

import { state } from './store.js';
import { fmtNum } from './format.js';
import { recentVsBaseline, weeklyMinutes, weekStart } from './fitness.js';

const DAY = 864e5;
const F = (level, title, text, sources = []) => ({ keys: ['fitness'], kind: 'fitness', level, title, text, sources });

export function fitnessFindings(now = Date.now()) {
  const out = [];

  // Activity: last 4 complete weeks of workouts.
  if (state.workouts.length) {
    const thisWeek = weekStart(now);
    const weeks = weeklyMinutes(thisWeek - 28 * DAY, now).filter((w) => w.t < thisWeek && w.t >= thisWeek - 28 * DAY);
    const lastWorkout = Math.max(...state.workouts.map((w) => Date.parse(w.start)));
    if (weeks.length === 4 && now - lastWorkout < 60 * DAY) {
      const mean = weeks.reduce((a, w) => a + w.v, 0) / 4;
      if (mean >= 150) out.push(F('good', 'Workouts meet the WHO weekly activity range', `About ${fmtNum(Math.round(mean))} minutes of workouts a week over the last 4 weeks. WHO recommends at least 150–300 minutes of moderate or 75–150 minutes of vigorous activity a week.`, ['who2020pa']));
      else out.push(F('info', `Workouts: ${fmtNum(Math.round(mean))} min a week`, `Over the last 4 weeks. WHO recommends 150–300 minutes of moderate or 75–150 minutes of vigorous activity a week (vigorous minutes count double). Everyday activity outside recorded workouts counts too.`, ['who2020pa']));
    }
  }

  // Sleep: average over the last 30 nights with data.
  const sleep = state.measures.filter((m) => m.kind === 'sleep_min' && now - Date.parse(m.date) < 30 * DAY);
  if (sleep.length >= 10) {
    const h = sleep.reduce((a, m) => a + m.value, 0) / sleep.length / 60;
    const short = sleep.filter((m) => m.value < 7 * 60).length;
    if (h < 7) out.push(F('attention', `Sleep averages ${fmtNum(+h.toFixed(1))} h`, `Over the last ${sleep.length} recorded nights; ${short} were under 7 hours. Sleep experts recommend that adults regularly sleep 7 hours or more per night.`, ['aasm2015']));
    else out.push(F('good', `Sleep averages ${fmtNum(+h.toFixed(1))} h`, `Over the last ${sleep.length} recorded nights — within the recommended 7 hours or more for adults${short ? ` (${short} nights were shorter)` : ''}.`, ['aasm2015']));
  }

  // Changes against your own baseline (no guideline — just your data).
  for (const kind of ['rhr', 'night_hr', 'low_hr']) {
    const r = recentVsBaseline(kind, now);
    if (r && !r.stale && r.base != null && r.recent - r.base >= 5) {
      out.push(F('info', 'Heart rate higher than your usual', `Your ${{ rhr: 'resting', night_hr: 'night-time', low_hr: 'lowest daily' }[kind]} heart rate averaged ${fmtNum(Math.round(r.recent))} bpm in the last 7 days vs. ${fmtNum(Math.round(r.base))} in the 4 weeks before. Short-term rises often go with illness, stress, alcohol, hard training or short sleep.`));
      break;
    }
  }
  const hrv = recentVsBaseline('hrv', now);
  if (hrv && !hrv.stale && hrv.base && (hrv.base - hrv.recent) / hrv.base >= 0.15) {
    out.push(F('info', 'Heart rate variability lower than your usual', `HRV averaged ${fmtNum(Math.round(hrv.recent))} ms in the last 7 days vs. ${fmtNum(Math.round(hrv.base))} ms before (−${Math.round(((hrv.base - hrv.recent) / hrv.base) * 100)} %). Lower HRV often goes with stress, illness, alcohol or hard training.`));
  }
  return out;
}
