// Renders icons/icon.svg to the PNG sizes iOS and the manifest need.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  // iOS rounds the corners itself, so the touch icon is a full square.
  const body = name.startsWith('apple') ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><div style="width:${size}px;height:${size}px;padding:${pad}px">${body.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`);
  await page.screenshot({ path: new URL(`../icons/${name}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
