// "More" (phones): the sections that don't fit in the tab bar.

import { h } from './dom.js';
import { pageHead } from './ui.js';

const ITEMS = [
  ['#/search', 'Search', 'Tests, findings, vaccines, DNA, sections'],
  ['#/heart', 'Heart', 'ECG, long-term ECG, echocardiogram, cardiology letters'],
  ['#/teeth', 'Teeth', 'Tooth chart, treatments, bills, X-rays'],
  ['#/bp', 'Blood pressure', 'Readings and home averages'],
  ['#/dna', 'DNA', '23andMe and tellmeGen raw data'],
  ['#/discuss', 'Discuss with Claude', 'A summary to paste into the Claude app'],
  ['#/data', 'Data & backup', 'Profile, backup, demo data, storage'],
];

export function viewMore(root) {
  root.append(pageHead('More'), h('div', { class: 'card list more-list' }, ITEMS.map(([href, title, sub]) =>
    h('a', { class: 'row', href }, h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), h('div', { class: 'row-meta' }, sub)), h('span', { class: 'muted', 'aria-hidden': 'true' }, '›')))));
}
