// SVG trend chart with reference band, and dashboard sparklines.

import { h, s } from './dom.js';
import { fmtNum, fmtDate, fmtMonth, fmtRange } from './format.js';
import { statusLabel } from './ui.js';

const DAY = 864e5;

function niceTicks(min, max, n = 4) {
  const step0 = (max - min) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const e = step0 / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}

function timeTicks(t0, t1, max) {
  const d0 = new Date(t0);
  for (const k of [1, 2, 3, 6, 12, 24, 60]) {
    const ticks = [];
    let y = d0.getUTCFullYear();
    let mo = Math.ceil((d0.getUTCMonth() + (d0.getUTCDate() > 1 ? 1 : 0)) / k) * k;
    for (;;) {
      y += Math.floor(mo / 12);
      mo %= 12;
      const t = Date.UTC(y, mo, 1);
      if (t > t1) break;
      if (k < 12 || mo === 0) ticks.push(t);
      mo += k;
    }
    if (ticks.length <= max) return { ticks, years: k >= 12 };
  }
  return { ticks: [], years: true };
}

function marker(p, x, y, extra = {}) {
  if (p.status === 'high' || p.status === 'low') {
    const d = p.status === 'high'
      ? `M${x},${y - 6.5}L${x + 6},${y + 4}L${x - 6},${y + 4}Z`
      : `M${x},${y + 6.5}L${x + 6},${y - 4}L${x - 6},${y - 4}Z`;
    return s('path', { d, class: 'mk mk-out', ...extra });
  }
  return s('circle', { cx: x, cy: y, r: 4.5, class: 'mk', ...extra });
}

// Draws the series into `host`. Points need { t, v, lo, hi, status, o }.
export function lineChart(host, { pts, unit, height = 220 }) {
  const data = pts.filter((p) => p.v != null);
  const band = [...data].reverse().find((p) => p.lo != null || p.hi != null);
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true });
  host.append(wrap);
  let active = -1;
  let geo;

  function show(i) {
    active = i;
    const g = wrap.querySelector('.hover');
    if (i < 0 || !geo) {
      tip.hidden = true;
      g?.replaceChildren();
      return;
    }
    const p = data[i];
    const x = geo.x(p.t);
    const y = geo.y(p.v);
    g.replaceChildren(
      s('line', { x1: x, x2: x, y1: geo.top, y2: geo.bottom, class: 'crosshair' }),
      marker(p, x, y, { class: (p.status === 'high' || p.status === 'low' ? 'mk mk-out' : 'mk') + ' mk-active' }),
    );
    const st = statusLabel(p.status);
    tip.replaceChildren(
      h('div', { class: 'tip-value' }, `${p.qualifier ?? ''}${p.display ?? fmtNum(p.v)} ${unit}`, st ? h('span', { class: `tip-status st-${p.status}` }, ' · ', st) : null),
      h('div', { class: 'tip-meta' }, fmtDate(p.o.date)),
      ...(p.lab ? [h('div', { class: 'tip-meta' }, p.lab)] : []),
    );
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(x - w / 2, 0), wrap.clientWidth - w) + 'px';
    tip.style.top = Math.max(y - tip.offsetHeight - 14, 0) + 'px';
  }

  function draw() {
    const W = Math.max(260, wrap.clientWidth);
    const H = height;
    const M = { l: 44, r: 16, t: 16, b: 28 };
    const vals = data.map((p) => p.v);
    if (band?.lo != null) vals.push(band.lo);
    if (band?.hi != null) vals.push(band.hi);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
    const pad = (max - min) * 0.08;
    const yt = niceTicks(min - pad >= 0 || min < 0 ? min - pad : 0, max + pad);
    let t0 = data[0].t;
    let t1 = data[data.length - 1].t;
    if (t1 - t0 < 60 * DAY) { t0 -= 45 * DAY; t1 += 45 * DAY; }
    const tp = (t1 - t0) * 0.04;
    t0 -= tp; t1 += tp;
    const x = (t) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
    const y = (v) => M.t + (1 - (v - yt.lo) / (yt.hi - yt.lo)) * (H - M.t - M.b);
    geo = { x, y, top: M.t, bottom: H - M.b };

    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, tabindex: 0, role: 'img',
      'aria-label': `Trend chart, ${data.length} results. Use arrow keys to step through them.` });
    if (band) {
      const top = band.hi != null ? y(band.hi) : M.t;
      const bot = band.lo != null ? y(band.lo) : H - M.b;
      svg.append(s('rect', { x: M.l, y: top, width: W - M.l - M.r, height: Math.max(0, bot - top), class: 'band' }));
    }
    for (const v of yt.ticks) {
      svg.append(
        s('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: v === yt.lo ? 'axis' : 'grid' }),
        s('text', { x: M.l - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, fmtNum(v)),
      );
    }
    const xt = timeTicks(t0, t1, Math.floor((W - M.l - M.r) / 64));
    for (const t of xt.ticks) {
      svg.append(s('text', { x: x(t), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, xt.years ? new Date(t).getUTCFullYear() : fmtMonth(t)));
    }
    if (data.length > 1) {
      svg.append(s('path', { d: data.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(''), class: 'line' }));
    }
    // Long daily series: a line only, with markers just for flagged points and the latest.
    const dense = data.length > 60;
    for (const p of data) {
      if (!dense || p === data[data.length - 1] || p.status === 'high' || p.status === 'low') svg.append(marker(p, x(p.t), y(p.v)));
    }
    const last = data[data.length - 1];
    const lx = x(last.t);
    svg.append(s('text', { x: lx > W - 70 ? lx - 10 : lx + 10, y: y(last.v) - 12, class: 'end-label',
      'text-anchor': lx > W - 70 ? 'end' : 'start' }, `${last.qualifier ?? ''}${last.display ?? fmtNum(last.v)}`));
    svg.append(s('g', { class: 'hover' }));
    const hit = s('rect', { x: M.l, y: 0, width: W - M.l - M.r, height: H, class: 'hit' });
    svg.append(hit);

    const nearest = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ev.clientX - r.left;
      let best = 0;
      for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].t) - px) < Math.abs(x(data[best].t) - px)) best = i;
      return best;
    };
    hit.addEventListener('pointermove', (ev) => show(nearest(ev)));
    hit.addEventListener('pointerdown', (ev) => show(nearest(ev)));
    hit.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') show(-1); });
    svg.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const d = ev.key === 'ArrowRight' ? 1 : -1;
        show(active < 0 ? data.length - 1 : Math.min(Math.max(active + d, 0), data.length - 1));
      } else if (ev.key === 'Escape') show(-1);
    });
    svg.addEventListener('blur', () => show(-1));
    wrap.replaceChildren(svg, tip);
    if (active >= 0) show(active);
  }

  if (!data.length) {
    wrap.append(h('p', { class: 'muted chart-empty' }, 'No numeric results to chart.'));
    return;
  }
  // Draw now if laid out, and again whenever the width changes.
  let lastW = wrap.clientWidth;
  if (lastW) draw();
  new ResizeObserver(() => {
    if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; draw(); }
  }).observe(wrap);
  return { band: band ? fmtRange(band.lo, band.hi) : '' };
}

// Tiny trend line for list rows: last 12 results, latest dot emphasised.
export function sparkline(pts) {
  const d = pts.filter((p) => p.v != null).slice(-12);
  const W = 64;
  const H = 24;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'spark', 'aria-hidden': 'true' });
  if (!d.length) return svg;
  const vs = d.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const t0 = d[0].t;
  const t1 = d[d.length - 1].t;
  const x = (t) => (t1 === t0 ? W - 4 : 3 + ((t - t0) / (t1 - t0)) * (W - 7));
  const y = (v) => (max === min ? H / 2 : 3 + (1 - (v - min) / (max - min)) * (H - 6));
  if (d.length > 1) svg.append(s('path', { d: d.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(''), class: 'spark-line' }));
  const last = d[d.length - 1];
  svg.append(s('circle', { cx: x(last.t), cy: y(last.v), r: 3, class: 'spark-dot' + (last.status === 'high' || last.status === 'low' ? ' out' : '') }));
  return svg;
}

// Columns with an optional target line, e.g. weekly activity minutes vs. a guideline.
// bars: [{ t, v, label, sub }]
export function barChart(host, { bars, unit, target, targetLabel, height = 200 }) {
  const wrap = h('div', { class: 'chart', style: `height:${height}px` });
  const tip = h('div', { class: 'tip', hidden: true });
  host.append(wrap);
  if (!bars.length) {
    wrap.append(h('p', { class: 'muted chart-empty' }, 'No data in this period.'));
    return;
  }
  function draw() {
    const W = Math.max(260, wrap.clientWidth);
    const H = height;
    const M = { l: 40, r: 12, t: 14, b: 26 };
    const max = Math.max(...bars.map((b) => b.v), target ?? 0) * 1.1 || 1;
    const yt = niceTicks(0, max);
    const y = (v) => M.t + (1 - v / yt.hi) * (H - M.t - M.b);
    const slot = (W - M.l - M.r) / bars.length;
    const bw = Math.min(24, Math.max(2, slot - 2));
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Bar chart, ${bars.length} bars` });
    for (const v of yt.ticks) {
      svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }),
        s('text', { x: M.l - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, fmtNum(v)));
    }
    const every = Math.ceil(bars.length / Math.floor((W - M.l - M.r) / 56));
    bars.forEach((b, i) => {
      const cx = M.l + slot * (i + 0.5);
      const top = y(b.v);
      const hgt = Math.max(0, y(0) - top);
      const r = Math.min(4, bw / 2, hgt);
      // rounded top, square at the baseline
      const d = `M${cx - bw / 2},${y(0)}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${y(0)}Z`;
      const bar = s('path', { d, class: 'bar' + (target != null && b.v >= target ? ' bar-met' : '') });
      const hit = s('rect', { x: M.l + slot * i, y: M.t, width: slot, height: H - M.t - M.b, class: 'hit' });
      const show = () => {
        tip.replaceChildren(h('div', { class: 'tip-value' }, `${fmtNum(b.v)} ${unit}`), h('div', { class: 'tip-meta' }, b.label), ...(b.sub ? [h('div', { class: 'tip-meta' }, b.sub)] : []));
        tip.hidden = false;
        const w = tip.offsetWidth;
        tip.style.left = Math.min(Math.max(cx - w / 2, 0), wrap.clientWidth - w) + 'px';
        tip.style.top = Math.max(top - tip.offsetHeight - 10, 0) + 'px';
      };
      hit.addEventListener('pointermove', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') tip.hidden = true; });
      svg.append(bar, hit);
      if (i % every === 0) svg.append(s('text', { x: cx, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, b.tick ?? ''));
    });
    if (target != null) {
      svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y(target), y2: y(target), class: 'target' }),
        s('text', { x: W - M.r, y: y(target) - 6, class: 'target-label', 'text-anchor': 'end' }, targetLabel ?? ''));
    }
    wrap.replaceChildren(svg, tip);
  }
  let lastW = wrap.clientWidth;
  if (lastW) draw();
  new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; draw(); } }).observe(wrap);
}

// Blood pressure: one vertical bar per day from diastolic to systolic (daily means),
// with dots at both ends and reference lines. days: [{ t, sys, dia, n, label }]
export function bpChart(host, { days, lines = [], height = 240 }) {
  const wrap = h('div', { class: 'chart', style: `height:${height}px` });
  const tip = h('div', { class: 'tip', hidden: true });
  host.append(wrap);
  if (!days.length) {
    wrap.append(h('p', { class: 'muted chart-empty' }, 'No readings in this period.'));
    return;
  }
  function draw() {
    const W = Math.max(260, wrap.clientWidth);
    const H = height;
    const M = { l: 40, r: 44, t: 14, b: 26 };
    const vals = days.flatMap((d) => [d.sys, d.dia]).concat(lines.map((l) => l.v));
    const yt = niceTicks(Math.min(...vals) - 5, Math.max(...vals) + 5);
    let t0 = days[0].t;
    let t1 = days[days.length - 1].t;
    if (t1 - t0 < 14 * DAY) { t0 -= 7 * DAY; t1 += 7 * DAY; }
    const pad = (t1 - t0) * 0.03;
    t0 -= pad; t1 += pad;
    const x = (t) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
    const y = (v) => M.t + (1 - (v - yt.lo) / (yt.hi - yt.lo)) * (H - M.t - M.b);
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Blood pressure, ${days.length} days` });
    for (const v of yt.ticks) {
      svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: v === yt.lo ? 'axis' : 'grid' }),
        s('text', { x: M.l - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, fmtNum(v)));
    }
    const xt = timeTicks(t0, t1, Math.floor((W - M.l - M.r) / 64));
    for (const t of xt.ticks) svg.append(s('text', { x: x(t), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, xt.years ? new Date(t).getUTCFullYear() : fmtMonth(t)));
    for (const l of lines) {
      svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y(l.v), y2: y(l.v), class: 'target' }),
        s('text', { x: W - M.r + 4, y: y(l.v), class: 'target-label', 'dominant-baseline': 'middle' }, l.label));
    }
    const slot = (W - M.l - M.r) / Math.max(days.length, 1);
    const r = slot < 6 ? 2 : 3.5;
    for (const d of days) {
      const cx = x(d.t);
      const over = d.flag;
      svg.append(
        s('line', { x1: cx, x2: cx, y1: y(d.sys), y2: y(d.dia), class: 'bp-bar' + (over ? ' out' : '') }),
        s('circle', { cx, cy: y(d.sys), r, class: 'bp-dot' + (over ? ' out' : '') }),
        s('circle', { cx, cy: y(d.dia), r, class: 'bp-dot' + (over ? ' out' : '') }));
    }
    const hit = s('rect', { x: M.l, y: 0, width: W - M.l - M.r, height: H, class: 'hit' });
    const show = (ev) => {
      const px = ev.clientX - svg.getBoundingClientRect().left;
      let best = days[0];
      for (const d of days) if (Math.abs(x(d.t) - px) < Math.abs(x(best.t) - px)) best = d;
      tip.replaceChildren(h('div', { class: 'tip-value' }, `${Math.round(best.sys)}/${Math.round(best.dia)} mmHg`),
        h('div', { class: 'tip-meta' }, best.label), h('div', { class: 'tip-meta' }, best.n > 1 ? `average of ${best.n} readings` : '1 reading'));
      tip.hidden = false;
      const w = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(x(best.t) - w / 2, 0), wrap.clientWidth - w) + 'px';
      tip.style.top = Math.max(y(best.sys) - tip.offsetHeight - 12, 0) + 'px';
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') tip.hidden = true; });
    svg.append(hit);
    wrap.replaceChildren(svg, tip);
  }
  let lastW = wrap.clientWidth;
  if (lastW) draw();
  new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; draw(); } }).observe(wrap);
}
