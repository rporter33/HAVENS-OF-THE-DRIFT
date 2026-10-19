// Export the dragon's bind skeleton (src/creatures/dragon/skeleton.ts) as JSON for the Blender fit
// (gate G12a; scripts/blender/dragon_meshy_fit.py builds the armature from it). Development tool
// only: the runtime never loads this file.
//
//   node scripts/dragon-export-skeleton.mjs [--out shots/g12a/dragon-bind-skeleton.json]
//
// Loads the TypeScript rig through Vite in Node, so it needs no dev server or browser. Runs from any
// folder; a relative --out is taken from the repository root.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const out = path.resolve(root, opt('out', 'shots/g12a/dragon-bind-skeleton.json'));

const server = await createServer({
  configFile: false,
  root,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { dragonBindSkeleton } = await server.ssrLoadModule('/src/creatures/dragon/skeleton.ts');
  const sk = dragonBindSkeleton();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(sk, null, 1) + '\n');
  const p = sk.points;
  const len = (p.snout[2] - p.tailtip[2]).toFixed(2);
  console.log(`saved ${out}: ${sk.bones.length} bones, ${Object.keys(sk.segments).length} weighted, snout to tail tip ${len} m, span ${sk.wingspan} m`);
} finally {
  await server.close();
}
