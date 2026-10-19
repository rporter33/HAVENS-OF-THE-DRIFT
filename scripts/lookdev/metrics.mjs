// Look-development metrics (G3c, Q40): score game captures against the Astra target renders.
//
//   node scripts/lookdev/metrics.mjs <capture dir> [--baseline <capture dir>] [--json out.json]
//
// Walks <capture dir> for PNGs whose names start with a view prefix listed in PAIRS, measures each
// (and its target) in CIELAB on a frame resampled to 836 px wide, and prints a table: the value,
// the target's, and the share of the target reached. With --baseline, a second column set shows
// the same view in an earlier capture, so a change is scored as "before -> after".
//
// Measures (all on L* 0..100 and b*, where b* > 0 is warm/yellow and < 0 is blue):
//   range     L* 95th minus 5th percentile (tonal range)
//   floor     L* 5th percentile (how dark the darks go)
//   top       L* 95th percentile (how bright the highlights go)
//   local     mean standard deviation of L* in 9x9 windows (local contrast)
//   detail    mean Sobel magnitude of L*/100, x1000 (edge detail)
//   chroma    mean C*ab
//   split     mean b* of the brightest 10% minus the darkest 10% (warm light over cool shade > 0)
//   sky       mean b* of the top 12% of rows (blue sky < 0)
//
// No dependencies: PNGs are decoded with node:zlib (8-bit RGB/RGBA, non-interlaced, which is
// what Chromium screenshots and the target files are).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TARGETS = 'docs/art/targets';
/** Capture-name prefix → target render. */
export const PAIRS = {
  m01: '01-harrier-portrait.png',
  m02: '02-harrier-flight.png',
  m10: '10-windhaven-approach.png',
  'g-chase': '02-harrier-flight.png',
};
const WIDTH = 836;

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw Error('not a PNG');
  let off = 8;
  let w = 0, h = 0, type = 0, depth = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12];
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (type !== 2 && type !== 6)) throw Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let p = line[i];
      if (f === 1) p += a;
      else if (f === 2) p += b;
      else if (f === 3) p += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        p += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = p & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cur[x * bpp + k];
    prev = cur;
  }
  return { w, h, rgb: out };
}

/** Box-filter resample to `W` px wide (area average), returns linear-light floats per channel. */
function resample(img, W) {
  const H = Math.round((img.h * W) / img.w);
  const lin = new Float64Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  const out = new Float64Array(W * H * 3);
  const sx = img.w / W, sy = img.h / H;
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * img.w + xx) * 3;
        r += lin[img.rgb[i]]; g += lin[img.rgb[i + 1]]; b += lin[img.rgb[i + 2]]; n++;
      }
      const o = (y * W + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { w: W, h: H, lin: out };
}

function toLab(im) {
  const n = im.w * im.h;
  const L = new Float64Array(n), A = new Float64Array(n), B = new Float64Array(n);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  for (let i = 0; i < n; i++) {
    const r = im.lin[i * 3], g = im.lin[i * 3 + 1], b = im.lin[i * 3 + 2];
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const fx = f(X), fy = f(Y), fz = f(Z);
    L[i] = 116 * fy - 16; A[i] = 500 * (fx - fy); B[i] = 200 * (fy - fz);
  }
  return { w: im.w, h: im.h, L, A, B };
}

const pct = (arr, q) => { const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

export function measure(file) {
  const lab = toLab(resample(decodePng(fs.readFileSync(file)), WIDTH));
  const { w, h, L, A, B } = lab;
  const p5 = pct(L, 0.05), p95 = pct(L, 0.95), p10 = pct(L, 0.1), p90 = pct(L, 0.9);
  let hi = 0, nh = 0, lo = 0, nl = 0, chroma = 0;
  for (let i = 0; i < L.length; i++) {
    chroma += Math.hypot(A[i], B[i]);
    if (L[i] >= p90) { hi += B[i]; nh++; }
    if (L[i] <= p10) { lo += B[i]; nl++; }
  }
  // Sobel on L*/100 (kernel normalized by 1/4, as skimage), magnitude sqrt((gx^2+gy^2)/2).
  let sob = 0, ns = 0;
  const at = (x, y) => L[y * w + x] / 100;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) / 4;
    const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) / 4;
    sob += Math.sqrt((gx * gx + gy * gy) / 2); ns++;
  }
  // Local contrast: std of L* in 9x9 windows via summed-area tables.
  const S = new Float64Array((w + 1) * (h + 1)), S2 = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = L[y * w + x], i = (y + 1) * (w + 1) + x + 1;
    S[i] = v + S[i - 1] + S[i - (w + 1)] - S[i - (w + 1) - 1];
    S2[i] = v * v + S2[i - 1] + S2[i - (w + 1)] - S2[i - (w + 1) - 1];
  }
  let lc = 0, nlc = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - 4), x1 = Math.min(w, x + 5), y0 = Math.max(0, y - 4), y1 = Math.min(h, y + 5);
    const n = (x1 - x0) * (y1 - y0);
    const sum = (T) => T[y1 * (w + 1) + x1] - T[y0 * (w + 1) + x1] - T[y1 * (w + 1) + x0] + T[y0 * (w + 1) + x0];
    const m = sum(S) / n;
    lc += Math.sqrt(Math.max(0, sum(S2) / n - m * m)); nlc++;
  }
  const skyRows = Math.max(1, Math.floor(h * 0.12));
  const sky = mean(B.subarray(0, skyRows * w));
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    range: r1(p95 - p5), floor: r1(p5), top: r1(p95), local: r1(lc / nlc), detail: r1((sob / ns) * 1000),
    chroma: r1(chroma / L.length), split: r1(hi / nh - lo / nl), sky: r1(sky),
  };
}

export const KEYS = ['range', 'floor', 'top', 'local', 'detail', 'chroma', 'split', 'sky'];

function pngs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...pngs(p));
    else if (e.name.endsWith('.png') && !/\.(crop|matte|sheet)\.png$/.test(e.name)) out.push(p);
  }
  return out;
}

function prefixOf(name) {
  return Object.keys(PAIRS).sort((a, b) => b.length - a.length).find((k) => name.startsWith(k));
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (!dir) { console.error('usage: node scripts/lookdev/metrics.mjs <capture dir> [--baseline <dir>] [--json out.json]'); process.exit(2); }
  const base = opt('--baseline');
  const targets = {};
  const rows = [];
  const index = (d) => Object.fromEntries(pngs(d).map((p) => [path.basename(p), p]));
  const now = index(dir);
  const before = base ? index(base) : {};
  for (const [name, file] of Object.entries(now).sort()) {
    const pre = prefixOf(name);
    if (!pre) continue;
    const t = PAIRS[pre];
    targets[t] ??= measure(path.join(TARGETS, t));
    rows.push({ view: name.replace(/\.png$/, ''), target: t, now: measure(file), before: before[name] ? measure(before[name]) : undefined, ref: targets[t] });
  }
  const fmt = (v) => (v === undefined ? '' : String(v));
  const lines = [];
  lines.push(`| view | ${KEYS.join(' | ')} |`, `|---|${KEYS.map(() => '---').join('|')}|`);
  for (const r of rows) {
    lines.push(`| ${r.view} | ${KEYS.map((k) => (r.before ? `${fmt(r.before[k])} → ${fmt(r.now[k])}` : fmt(r.now[k]))).join(' | ')} |`);
  }
  for (const [t, m] of Object.entries(targets)) lines.push(`| **target ${t.slice(0, 2)}** | ${KEYS.map((k) => fmt(m[k])).join(' | ')} |`);
  console.log(lines.join('\n'));
  const json = opt('--json');
  if (json) fs.writeFileSync(json, JSON.stringify({ rows, targets }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
