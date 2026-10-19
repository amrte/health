// Decorative olive sprig, drawn in the theme's leaf colours (adapts to dark mode),
// and the pack-style title. The sprig is hidden from screen readers and never
// placed over data.

import { h, s } from './dom.js';

export const APP_NAME = 'Натуральний майонез оливковий 67%';

// "Натуральний" in script, "майонез" on a green ribbon, "Оливковий 67%" below.
export function logo(tag = 'div') {
  return h(tag, { class: 'logo', 'aria-label': APP_NAME },
    h('span', { class: 'logo-script', 'aria-hidden': 'true' }, 'Натуральний'),
    h('span', { class: 'logo-ribbon', 'aria-hidden': 'true' }, 'майонез'),
    h('span', { class: 'logo-line', 'aria-hidden': 'true' }, 'Оливковий', h('b', null, '67%')));
}

// Olives hanging from the stem: [x, y, rotation, fill].
const OLIVES = [[70, 118, 18, 'var(--olive-dark)'], [86, 122, -10, 'var(--olive)'], [128, 88, 24, 'var(--olive-dark)'], [160, 64, 12, 'var(--olive)']];

const LEAVES = [
  [38, 118, -105, 1], [56, 111, 25, 0.95], [78, 101, -80, 0.9], [96, 92, 32, 0.85], [117, 78, -70, 0.8],
  [134, 64, 38, 0.74], [152, 49, -58, 0.68], [168, 36, 42, 0.6], [184, 22, -22, 0.55],
];

export function leafSprig(className = 'leaf-sprig') {
  return s('svg', { class: className, viewBox: '0 0 200 140', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: 'M8 132 C 60 112, 122 72, 192 16', fill: 'none', stroke: 'var(--stem)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
    LEAVES.map(([x, y, a, k], i) => s('g', { transform: `translate(${x} ${y}) rotate(${a}) scale(${k})` },
      s('path', { d: 'M0 0 C 10 -8, 34 -8, 48 0 C 34 8, 10 8, 0 0 Z', fill: i % 2 ? 'var(--leaf-2)' : 'var(--leaf)' }),
      s('path', { d: 'M3 0 L 42 0', stroke: 'var(--stem)', 'stroke-width': 1, opacity: 0.55 }))),
    OLIVES.map(([x, y, a, fill]) => s('g', { transform: `translate(${x} ${y}) rotate(${a})` },
      s('path', { d: 'M0 -12 L 0 -4', stroke: 'var(--stem)', 'stroke-width': 1.6 }),
      s('ellipse', { cx: 0, cy: 5, rx: 6.5, ry: 9, fill }),
      s('ellipse', { class: 'olive-hi', cx: -2.2, cy: 1.5, rx: 1.8, ry: 3 }))));
}

export function greeting(now = new Date()) {
  const hr = now.getHours();
  return hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}
