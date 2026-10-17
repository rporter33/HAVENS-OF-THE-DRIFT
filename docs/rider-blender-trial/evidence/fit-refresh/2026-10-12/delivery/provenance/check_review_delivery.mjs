// Scoped local review-page check; isolated temporary browser, no owner profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const trial = 'C:/Users/Robert/.codex/worktrees/rider-blender-trial/Driftwing';
const require = createRequire(path.join(trial, 'package.json'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'delivery-' + new Date().toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(out);
const url = 'http://127.0.0.1:5210/docs/rider-blender-trial/fit-refresh-2026-10-12.html';
const report = { startedUtc: new Date().toISOString(), url, scope: 'Local additive review gallery and entry links only; existing gameplay QA owns rider behavior', checks: [], errors: [] };
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ message: message.text(), location: message.location() }); });
  report.failedResponses = [];
  page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  if (!response.ok()) throw Error('Gallery did not return success');
  const links = await page.locator('nav a').evaluateAll(links => links.map(a => ({ title: a.textContent, url: a.href })));
  for (const link of links) {
    const r = await page.request.get(link.url);
    report.checks.push({ ...link, status: r.status(), passed: r.ok() });
    if (!r.ok()) throw Error('Broken local entry link: ' + link.url);
    await r.dispose();
  }
  await page.locator('img').evaluateAll(images => { for (const image of images) image.loading = 'eager'; });
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  report.images = await page.locator('img').evaluateAll(images => images.map(image => ({ url: image.src, width: image.naturalWidth, height: image.naturalHeight })));
  if (report.images.length !== 40 || report.images.some(image => image.width !== 1440 || image.height !== 1080)) throw Error('Incomplete or unexpected evidence images');
  report.checks.push({ title: 'All40 gallery images decode at original dimensions', passed: true });
  const shot = path.join(out, 'review-entry.png');
  await page.screenshot({ path: shot });
  report.screenshot = { file: shot, sha256: crypto.createHash('sha256').update(await fs.readFile(shot)).digest('hex') };
  report.browser = browser.version();
  if (report.errors.length) throw Error('Review page errors');
  await context.close();
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.finishedUtc = new Date().toISOString();
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ out, checks: report.checks, errors: report.errors, failure: report.failure }, null, 2));
