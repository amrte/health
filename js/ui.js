// Shared UI pieces.

import { h } from './dom.js';
import { fmtNum } from './format.js';
import * as db from './db.js';

const STATUS = {
  high: ['▲', 'High'],
  low: ['▼', 'Low'],
  normal: ['✓', 'In range'],
};

export function statusLabel(status) {
  return STATUS[status]?.[1] ?? '';
}

// Status is always icon + word; the colour is on the icon only.
export function statusChip(status, { compact = false } = {}) {
  const st = STATUS[status];
  if (!st) return h('span', { class: 'status st-none' }, compact ? '' : 'No range');
  return h('span', { class: `status st-${status}` }, h('span', { class: 'status-icon', 'aria-hidden': 'true' }, st[0]), ' ', st[1]);
}

// "148 g/L" in canonical units, or the printed text for non-numeric results.
export function valueText(p, unit) {
  if (p.text) return p.text;
  if (p.v != null) return `${p.qualifier}${fmtNum(p.v)}${unit ? ' ' + unit : ''}`;
  if (p.raw != null) return `${p.qualifier}${fmtNum(p.raw)} ${p.o.unit}`;
  return '';
}

export function pageHead(title, { back, sub, actions } = {}) {
  return h('header', { class: 'page-head' },
    back ? h('a', { class: 'back', href: back }, '‹ Back') : null,
    h('div', { class: 'page-title-row' }, h('h1', null, title), actions ? h('div', { class: 'actions' }, actions) : null),
    sub ? h('p', { class: 'sub' }, sub) : null,
  );
}

// Full-screen viewer for a stored photo or PDF. Tap the image to zoom.
export async function openFile(fileId) {
  const rec = await db.get('files', fileId);
  if (!rec) return;
  const url = URL.createObjectURL(rec.blob);
  if (!rec.type?.startsWith('image/')) {
    window.open(url, '_blank');
    return;
  }
  const img = h('img', { src: url, alt: rec.name ?? 'Report photo' });
  const scroller = h('div', { class: 'viewer-scroll' }, img);
  const close = () => { overlay.remove(); URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'viewer', role: 'dialog', 'aria-label': 'Photo' },
    h('div', { class: 'viewer-bar' },
      h('span', { class: 'muted' }, 'Tap the photo to zoom'),
      h('button', { class: 'btn', onclick: close }, 'Close')),
    scroller);
  img.addEventListener('click', () => scroller.classList.toggle('zoomed'));
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
}

export async function thumb(fileId, onclick) {
  const rec = await db.get('files', fileId);
  const box = h('button', { class: 'thumb', type: 'button', onclick, 'aria-label': 'Open photo' });
  if (rec?.type?.startsWith('image/')) {
    const url = URL.createObjectURL(rec.blob);
    box.append(h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }));
  } else {
    box.append(h('span', { class: 'thumb-doc' }, 'PDF'));
  }
  return box;
}
