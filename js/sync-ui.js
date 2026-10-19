// Data page: setting up and watching the sync between devices.

import { h, go, toast } from './dom.js';
import { syncConfig, connect, disconnect, updateToken, syncNow, syncStatus, onSyncStatus } from './sync.js';
import { isMemoryOnly } from './db.js';

function ago(iso) {
  if (!iso) return 'not yet';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function syncCard() {
  const box = h('section', { class: 'card form sync-card' }, h('h2', null, 'Sync between devices'));
  if (isMemoryOnly()) {
    box.append(h('p', { class: 'muted' }, 'Not available here: this browser doesn’t keep data for files opened from disk. Use the hosted app.'));
    return box;
  }
  const cfg = await syncConfig();
  if (cfg) connectedView(box, cfg);
  else setupView(box);
  return box;
}

function connectedView(box, cfg) {
  const line = h('p', { class: 'sync-line' });
  const render = (st) => {
    const err = st.state === 'error' ? st.error : '';
    line.replaceChildren(
      h('span', { class: `sync-dot ${st.state === 'syncing' ? 'busy' : err ? 'err' : 'ok'}`, 'aria-hidden': 'true' }),
      st.state === 'syncing' ? 'Syncing…' : err ? err : `Synced ${ago(st.lastSync || cfg.lastSync)}`,
    );
  };
  render({ ...syncStatus(), lastSync: syncStatus().lastSync || cfg.lastSync, error: syncStatus().error ?? cfg.lastError, state: syncStatus().state === 'off' ? (cfg.lastError ? 'error' : 'ok') : syncStatus().state });
  const off = onSyncStatus((st) => { if (!box.isConnected) off(); else render(st); });
  const tokenIn = h('input', { type: 'password', autocomplete: 'off', placeholder: 'github_pat_…', 'aria-label': 'New token' });
  box.append(
    h('p', { class: 'muted small' }, `Encrypted copy in the private repository `, h('strong', null, `${cfg.owner}/${cfg.repo}`),
      '. Changes are sent a few seconds after you make them and fetched when the app opens.'),
    line,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const r = await syncNow();
        if (r?.ok) toast(r.received || r.sent ? `Synced: ${r.received} received, ${r.sent} sent` : 'Up to date');
      } }, 'Sync now'),
      h('button', { class: 'btn', type: 'button', onclick: async () => {
        if (!confirm('Stop syncing on this device? Your data stays here and in the repository.')) return;
        await disconnect();
        toast('Sync turned off on this device');
        go('#/data');
      } }, 'Turn off on this device')),
    h('details', null, h('summary', null, 'Replace the token (e.g. after it expired)'),
      h('div', { class: 'btn-row' }, tokenIn, h('button', { class: 'btn', type: 'button', onclick: async () => {
        if (!tokenIn.value.trim()) return;
        const r = await updateToken(tokenIn.value);
        toast(r?.ok ? 'Token replaced' : r?.error ?? 'Failed');
        tokenIn.value = '';
      } }, 'Save token'))));
}

function setupView(box) {
  const f = { repo: '', token: '', pass: '', pass2: '' };
  const msg = h('p', { class: 'warn small', hidden: true });
  const input = (key, label, attrs = {}) => h('label', null, h('span', null, label),
    h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...attrs, oninput: (e) => { f[key] = e.target.value; } }));
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Connect and sync');
  box.append(
    h('p', null, 'Keeps the app on your iPhone, Mac and other browsers in step, automatically. Your data is encrypted on the device with a passphrase only you know; GitHub stores only scrambled data.'),
    h('details', { class: 'sync-steps' }, h('summary', null, h('strong', null, 'First time: set up GitHub (5 minutes)')),
      h('ol', { class: 'steps plain' },
        h('li', null, 'Create a ', h('strong', null, 'private'), ' repository, e.g. “health-data”: ', h('a', { href: 'https://github.com/new', target: '_blank', rel: 'noopener' }, 'github.com/new'), ' (tick “Private”).'),
        h('li', null, 'Create a token: ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'Settings → Developer settings → Fine-grained tokens → Generate new token'),
          '. Repository access: “Only select repositories” → your new repository. Permissions → Repository → ', h('strong', null, 'Contents: Read and write'), '. Choose a long expiration. Copy the token.'),
        h('li', null, 'Fill in the form below and choose a passphrase. On your other devices, use the same repository and the same passphrase (the same token is fine).'))),
    h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      msg.hidden = true;
      if (!f.repo.trim() || !f.token.trim()) { msg.textContent = 'Enter the repository and the token.'; msg.hidden = false; return; }
      if (f.pass.length < 10) { msg.textContent = 'Use a passphrase of at least 10 characters — e.g. four random words.'; msg.hidden = false; return; }
      if (f.pass2 && f.pass2 !== f.pass) { msg.textContent = 'The two passphrases differ.'; msg.hidden = false; return; }
      btn.disabled = true;
      btn.textContent = 'Connecting…';
      try {
        const r = await connect({ repoText: f.repo, token: f.token, passphrase: f.pass, confirm: f.pass2, apiBase: window.__SYNC_API__ });
        if (r?.ok === false) throw new Error(r.error);
        toast(`Connected: ${r.received} received, ${r.sent} sent`);
        go('#/data');
      } catch (err) {
        msg.textContent = err.message;
        msg.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Connect and sync';
      }
    } },
      input('repo', 'Repository', { placeholder: 'your-name/health-data' }),
      input('token', 'Token', { type: 'password', placeholder: 'github_pat_…' }),
      input('pass', 'Passphrase', { type: 'password' }),
      input('pass2', 'Passphrase again (first device only)', { type: 'password' }),
      h('p', { class: 'hint' }, 'The passphrase can’t be recovered — if you forget it, the copy on GitHub can’t be read (the data on your devices stays). Each device keeps only a key derived from it.'),
      msg,
      h('div', null, btn)));
}
