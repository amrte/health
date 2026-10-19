// Decorative leaf sprig, drawn in the theme's leaf colours (adapts to dark mode).
// Purely decorative: hidden from screen readers and never placed over data.

import { s } from './dom.js';

const LEAVES = [
  [38, 118, -105, 1], [56, 111, 25, 0.95], [78, 101, -80, 0.9], [96, 92, 32, 0.85], [117, 78, -70, 0.8],
  [134, 64, 38, 0.74], [152, 49, -58, 0.68], [168, 36, 42, 0.6], [184, 22, -22, 0.55],
];

export function leafSprig(className = 'leaf-sprig') {
  return s('svg', { class: className, viewBox: '0 0 200 140', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: 'M8 132 C 60 112, 122 72, 192 16', fill: 'none', stroke: 'var(--stem)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
    LEAVES.map(([x, y, a, k], i) => s('g', { transform: `translate(${x} ${y}) rotate(${a}) scale(${k})` },
      s('path', { d: 'M0 0 C 9 -13, 31 -13, 42 0 C 31 13, 9 13, 0 0 Z', fill: i % 2 ? 'var(--leaf-2)' : 'var(--leaf)' }),
      s('path', { d: 'M3 0 L 36 0', stroke: 'var(--stem)', 'stroke-width': 1, opacity: 0.55 }))));
}

export function greeting(now = new Date()) {
  const hr = now.getHours();
  return hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}
