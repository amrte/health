// Number and date formatting.

export function fmtNum(v) {
  if (v == null || !Number.isFinite(v)) return '';
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return String(+v.toFixed(digits));
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export function dateMs(iso) {
  return Date.parse(iso + 'T00:00:00Z');
}
export function fmtDate(iso) {
  return iso ? dateFmt.format(dateMs(iso)) : '';
}
export function fmtMonth(ms) {
  return monthFmt.format(ms);
}
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtRange(lo, hi) {
  if (lo != null && hi != null) return `${fmtNum(lo)}–${fmtNum(hi)}`;
  if (hi != null) return `< ${fmtNum(hi)}`;
  if (lo != null) return `> ${fmtNum(lo)}`;
  return '';
}

export function fmtBytes(n) {
  if (!n) return '0 MB';
  return n < 1e6 ? `${Math.max(1, Math.round(n / 1e3))} KB` : `${(n / 1e6).toFixed(1)} MB`;
}
