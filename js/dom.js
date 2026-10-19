// Small DOM helpers. Strings always become text nodes, never HTML.

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : String(k));
  }
}

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple' || k === 'hidden') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  if (value !== undefined) el.value = value; // after <option>s exist
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v != null && v !== false) el.setAttribute(k, v);
  append(el, kids);
  return el;
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) document.body.append((el = h('div', { id: 'toast', role: 'status' })));
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function uid() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}
