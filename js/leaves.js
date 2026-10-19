// The pack-style logo and the decorative olive branch.

import { h } from './dom.js';

export const APP_NAME = 'Натуральний майонез оливковий 67%';

// The pack-style logo picture; its alt text carries the name.
export const LOGO_SRC = 'icons/logo.webp';

export function logo(tag = 'div') {
  return h(tag, { class: 'logo' }, h('img', { class: 'logo-img', src: LOGO_SRC, alt: APP_NAME, draggable: 'false' }));
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
