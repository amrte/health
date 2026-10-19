// Bundles the app into single HTML files that open straight from disk:
//   dist/health-records.html       empty app
//   dist/health-records-demo.html  fills itself with a fictional person on first open
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const { outputFiles } = await build({
  entryPoints: [new URL('js/main.js', root).pathname],
  bundle: true,
  format: 'esm',
  target: ['safari15', 'chrome100', 'firefox100'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await read('css/app.css');
const icon = 'data:image/svg+xml,' + encodeURIComponent(await read('icons/icon.svg'));

let html = await read('index.html');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}">`)
  .replace(/src="icons\/icon.svg"/g, `src="${icon}"`)
  .replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}</style>`)
  .replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script type="module">\n${js}</script>`);
if (html.includes('src="js/') || html.includes('href="css/')) throw new Error('Unbundled reference left in HTML');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/health-records.html', root), html);
await writeFile(new URL('dist/health-records-demo.html', root),
  html.replace('<html lang="en">', '<html lang="en" data-demo-seed="1">').replace('<title>Натуральний майонез оливковий 67%</title>', '<title>Натуральний майонез оливковий 67% (демо)</title>'));
console.log(`dist/health-records.html, dist/health-records-demo.html (${Math.round(html.length / 1024)} KB each)`);
