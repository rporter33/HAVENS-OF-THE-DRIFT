// Export the in-game wyvern (bind-pose geometry, region attributes as vertex colors) to a GLB for
// Blender authoring studies. Development tool only: the runtime never loads this file.
//
//   node scripts/wyvern-export-glb.mjs [--breed harrier] [--out shots/g3/harrier.glb]
//        [--base http://127.0.0.1:5173/]
//
// Needs the dev server (npm run dev). Loads ?view=wyvern with the default look, waits for the
// build, then runs three's GLTFExporter in the page on the main wyvern's group (rider hidden).

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const breed = opt('breed', 'harrier');
const out = opt('out', `shots/g3/${breed}.glb`);
const base = opt('base', 'http://127.0.0.1:5173/');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(`${base}?view=wyvern&play=1&manual=1&quality=high&pose=idle&rider=0&fresh=1&breed=${breed}`);
await page.waitForFunction(() => window.__dw?.ready === true, null, { timeout: 180000 });
await page.evaluate(() => window.__dw.advance(1));
const b64 = await page.evaluate(async () => {
  const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const w = window.__dw.game.wyvern;
  const glb = await new GLTFExporter().parseAsync(w.group, { binary: true, onlyVisible: true });
  const bytes = new Uint8Array(glb);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`saved ${out} (${fs.statSync(out).size} bytes)`);
await browser.close();
