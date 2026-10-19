// Decorative olive branch and the pack-style title.

import { h } from './dom.js';

export const APP_NAME = 'Натуральний майонез оливковий 67%';

// "Натуральний" in script, "майонез" on a green ribbon, "Оливковий 67%" below.
export function logo(tag = 'div') {
  return h(tag, { class: 'logo', 'aria-label': APP_NAME },
    h('span', { class: 'logo-script', 'aria-hidden': 'true' }, 'Натуральний'),
    h('span', { class: 'logo-ribbon', 'aria-hidden': 'true' }, 'майонез'),
    h('span', { class: 'logo-line', 'aria-hidden': 'true' }, 'Оливковий', h('b', null, '67%')));
}

// Olive branch picture (transparent PNG). Decorative: hidden from screen readers
// and never placed over data. The single-file build inlines it.
export const OLIVE_SRC = 'icons/olive-branch.png';

export function leafSprig(className = 'leaf-sprig') {
  return h('img', { class: className, src: OLIVE_SRC, alt: '', 'aria-hidden': 'true', draggable: 'false', decoding: 'async' });
}

export function greeting(now = new Date()) {
  const hr = now.getHours();
  return hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}
