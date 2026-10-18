// Rock-form meshing: the zero surface of RockFormShape.sdf extracted with surface nets (one vertex
// per surface cell, pulled onto the surface with a Newton step), so the visible rock and the
// collision are the same function. Normals are the sdf's gradient: smooth, continuous shading with
// no facets at any LOD (the render brief's "smooth, continuous 3D surfaces"). Painted with the
// spires' rock palette through the shared terrain material: world-space strata (surf.x), moss on
// what faces up, hanging-moss streaks under overhangs (surf.w), and the cracks and the chamber
// darkened by how closed in they are, so the way through reads from a distance.
// Positions are local to the form's anchor (def.x, def.y, def.z).

import { Color, Vector3 } from 'three';
import { smoothstep } from '../../core/math';
import { noise2 } from '../../core/noise';
import type { RockFormShape } from '../rockForm';
import { MeshBuilder, SLICE, type MeshData } from './MeshBuilder';

export interface RockLodSpec {
  level: number;
  /** Switch distance (m from the form's bounds). */
  distance: number;
  /** Surface-nets cell size (m). */
  cell: number;
}

export const ROCK_LODS: RockLodSpec[] = [
  { level: 0, distance: 0, cell: 1.25 },
  { level: 1, distance: 380, cell: 2.5 },
  { level: 2, distance: 1500, cell: 7 },
];

// The islands' palette (islandPaint.ts), so the forms read as the same rock.
const CLIFF = new Color('#b9a088');
const UNDER_NEAR = new Color('#97806e');
const UNDER_MID = new Color('#756a6c');
const UNDER_DEEP = new Color('#54536a');
const ROCK_OCHRE = new Color('#ad946c');
const STONE = new Color('#aca596');
const MOSS = new Color('#4c7a35');
const LICHEN = new Color('#a3a56a');
// The perch's landing slab and the scrub fringe that outlines it (the Archway Reach render's
// ivory limestone with scrub along its ledges), and the shaded lip under the slab's edge.
const SLAB = new Color('#cfc2a3');
const SLAB_WARM = new Color('#c4aa7e');
const SLAB_STREAK = new Color('#9d8a6c');
const SCRUB = new Color('#5f7d3a');
const SCRUB_DRY = new Color('#8f9150');
const LIP = new Color('#443d2d');
const GRASS = new Color('#77a345');
const GRASS_ALT = new Color('#8e9a50');
const GRASS_DARK = new Color('#3d7234');
const BROW = new Color('#7a5c41');
const DIRT = new Color('#7a5c41');
const tmp = new Color();
const n3 = new Vector3();

/** Coarse pre-pass stride (fine cells per coarse cell). */
const COARSE = 4;

export function* buildRockFormMesh(shape: RockFormShape, spec: RockLodSpec): Generator<void, { data: MeshData }> {
  const d = shape.def;
  const h = spec.cell;
  const R = shape.maxRadius + h;
  const ox = d.x - R;
  const oy = shape.minY - h;
  const oz = d.z - R;
  const nx = Math.ceil((2 * R) / h) + 1;
  const ny = Math.ceil((shape.maxY - shape.minY + 2 * h) / h) + 1;
  const nz = nx;
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const vals = new Float32Array(nx * ny * nz);

  // --- Sample the field: coarse first, then only the coarse cells the surface can pass through ---
  const cx = Math.ceil((nx - 1) / COARSE) + 1;
  const cy = Math.ceil((ny - 1) / COARSE) + 1;
  const cz = Math.ceil((nz - 1) / COARSE) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) coarse[(k * cy + j) * cx + i] = shape.sdf(ox + i * COARSE * h, oy + j * COARSE * h, oz + k * COARSE * h);
    }
    yield;
  }
  // A coarse cell whose corners are all further from the surface than its diagonal (with the
  // sdf's Lipschitz slack) can't contain any of it: fill it from the corners (signs only matter).
  const reach = COARSE * h * Math.sqrt(3) * 1.4;
  let evals = 0;
  for (let ck = 0; ck < cz - 1; ck++) {
    for (let cj = 0; cj < cy - 1; cj++) {
      for (let ci = 0; ci < cx - 1; ci++) {
        let minAbs = Infinity;
        let corner = 0;
        for (let c = 0; c < 8; c++) {
          const v = coarse[((ck + (c >> 2)) * cy + cj + ((c >> 1) & 1)) * cx + ci + (c & 1)];
          if (Math.abs(v) < minAbs) minAbs = Math.abs(v);
          corner = v;
        }
        const empty = minAbs > reach;
        for (let k = ck * COARSE; k <= Math.min(nz - 1, (ck + 1) * COARSE); k++) {
          for (let j = cj * COARSE; j <= Math.min(ny - 1, (cj + 1) * COARSE); j++) {
            for (let i = ci * COARSE; i <= Math.min(nx - 1, (ci + 1) * COARSE); i++) {
              const idx = at(i, j, k);
              if (empty) {
                if (vals[idx] === 0) vals[idx] = corner;
              } else {
                vals[idx] = shape.sdf(ox + i * h, oy + j * h, oz + k * h);
                evals++;
              }
            }
          }
        }
        if (evals > SLICE) {
          evals = 0;
          yield;
        }
      }
    }
  }

  // --- One vertex per cell the surface crosses ------------------------------------------------
  const b = new MeshBuilder(4096);
  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellAt = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i;
  const corner = new Float64Array(8);
  const EDGES: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const v = vals[at(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))];
          corner[c] = v;
          if (v < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        // Mean of the edge crossings, in cell units.
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, c] of EDGES) {
          const va = corner[a];
          const vc = corner[c];
          if (va < 0 === vc < 0) continue;
          const t = va / (va - vc);
          sx += (a & 1) + ((c & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((c >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += (a >> 2) + ((c >> 2) - (a >> 2)) * t;
          n++;
        }
        let px = ox + (i + sx / n) * h;
        let py = oy + (j + sy / n) * h;
        let pz = oz + (k + sz / n) * h;
        // Two Newton steps onto the surface (the mesh sits on the collision surface; creases where
        // the lips are rounded need the second).
        for (let it = 0; it < 2; it++) {
          const s = shape.sdf(px, py, pz);
          shape.normal(px, py, pz, n3, Math.min(0.25, h * 0.2));
          px -= n3.x * s;
          py -= n3.y * s;
          pz -= n3.z * s;
        }
        cellVertex[cellAt(i, j, k)] = b.vertex(px - d.x, py - d.y, pz - d.z);
      }
    }
    if (k % 4 === 0) yield;
  }

  // --- Quads across every grid edge the surface crosses ---------------------------------------
  const quad = (a: number, c: number, e: number, f: number, flip: boolean) => {
    if (a < 0 || c < 0 || e < 0 || f < 0) return;
    if (flip) {
      b.tri(a, f, e);
      b.tri(a, e, c);
    } else {
      b.tri(a, c, e);
      b.tri(a, e, f);
    }
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v0 = vals[at(i, j, k)];
        const in0 = v0 < 0;
        // +x edge: cells (i, j-1..j, k-1..k).
        if (i < nx - 1 && in0 !== vals[at(i + 1, j, k)] < 0) {
          quad(cellVertex[cellAt(i, j - 1, k - 1)], cellVertex[cellAt(i, j, k - 1)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i, j - 1, k)], !in0);
        }
        // +y edge: cells (i-1..i, j, k-1..k).
        if (j < ny - 1 && in0 !== vals[at(i, j + 1, k)] < 0) {
          quad(cellVertex[cellAt(i - 1, j, k - 1)], cellVertex[cellAt(i - 1, j, k)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i, j, k - 1)], !in0);
        }
        // +z edge: cells (i-1..i, j-1..j, k).
        if (k < nz - 1 && in0 !== vals[at(i, j, k + 1)] < 0) {
          quad(cellVertex[cellAt(i - 1, j - 1, k)], cellVertex[cellAt(i, j - 1, k)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i - 1, j, k)], !in0);
        }
      }
    }
    if (k % 4 === 0) yield;
  }

  // --- Normals from the field, then paint (the islands' palette, islandPaint.ts) ------------
  const normals = new Float32Array(b.vertexCount * 3);
  const patchN = noise2(d.seed + 5);
  const mossN = noise2(d.seed + 9);
  const streakN = noise2(d.seed + 13);
  // Where the turf, the cliff and the underside meet (world y), and how deep the underside goes.
  const top = d.kind === 'crag' ? d.y : d.y + d.height / 2;
  const waist = d.kind === 'crag' ? d.y - 6 : d.y - d.height / 2;
  const deepest = shape.minY;
  if (d.kind === 'crag') PLANE.set(shape.fwd.x * Math.sin(d.slope), Math.cos(d.slope), shape.fwd.z * Math.sin(d.slope));
  // The slab's height along its own normal (the mean over the vertices lying on it), so the flank
  // just under its edge can be shaded as a lip.
  let slabH = 0;
  let slabN = 0;
  for (let v = 0; v < b.vertexCount; v++) {
    if (v % (SLICE / 2) === SLICE / 2 - 1) yield;
    const x = b.x(v) + d.x;
    const y = b.y(v) + d.y;
    const z = b.z(v) + d.z;
    shape.normal(x, y, z, n3);
    normals[v * 3] = n3.x;
    normals[v * 3 + 1] = n3.y;
    normals[v * 3 + 2] = n3.z;
    if (d.kind === 'crag' && n3.dot(PLANE) > 0.985) {
      slabH += PLANE.x * x + PLANE.y * y + PLANE.z * z;
      slabN++;
    }
  }
  if (slabN > 0) slabH /= slabN;
  for (let v = 0; v < b.vertexCount; v++) {
    if (v % (SLICE / 4) === SLICE / 4 - 1) yield;
    const x = b.x(v) + d.x;
    const y = b.y(v) + d.y;
    const z = b.z(v) + d.z;
    n3.set(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
    // How enclosed (the cracks, the chamber, under the belly): the field out along the normal is
    // short when other rock faces this point.
    // Probes out along the normal at three reaches: the near one catches corners and crack lips,
    // the others the far wall of a slot (the cracks are 8 m wide) and of the chamber.
    const o3 = smoothstep(0.4, 3, shape.sdf(x + n3.x * 3, y + n3.y * 3, z + n3.z * 3));
    const o8 = smoothstep(0.5, 8, shape.sdf(x + n3.x * 8, y + n3.y * 8, z + n3.z * 8));
    const o14 = smoothstep(0.5, 14, shape.sdf(x + n3.x * 14, y + n3.y * 14, z + n3.z * 14));
    const open = 0.45 * o3 + 0.35 * o8 + 0.2 * o14;
    const n = patchN(x * 0.03, z * 0.03 + y * 0.01) * 0.5 + 0.5;
    const plane = d.kind === 'crag' ? smoothstep(0.93, 0.985, n3.dot(PLANE)) : 0;
    if (plane > 0.5) {
      // The perch's landing plane: a bright ivory slab, wind-worn, with scrub growing along its
      // edge so the slab reads against the warmer cliff and its rim is a line you can see. Not
      // turf across it: that would read as ordinary ground.
      const rim = slabRim(shape, x, y, z, n3);
      const scrub = mossN(x * 0.35, z * 0.35) * 0.5 + 0.5;
      // Wind and water streaks run down the fall line.
      const along = (x - d.x) * shape.fwd.x + (z - d.z) * shape.fwd.z;
      const across = -(x - d.x) * shape.fwd.z + (z - d.z) * shape.fwd.x;
      const streak = smoothstep(0.35, 0.8, streakN(across * 0.55, along * 0.07) * 0.5 + 0.5);
      tmp.copy(SLAB).lerp(SLAB_WARM, 0.35 * n + 0.25 * smoothstep(-6, 6, along)).lerp(SLAB_STREAK, 0.4 * streak);
      tmp.lerp(LICHEN, 0.22 * smoothstep(0.6, 0.85, mossN(x * 0.12, z * 0.12) * 0.5 + 0.5));
      tmp.lerp(SCRUB_DRY, rim * 0.6).lerp(SCRUB, rim * smoothstep(0.25, 0.7, scrub) * 0.85);
      b.setColor(v, tmp.r, tmp.g, tmp.b);
      b.setSurf(v, 0.3 * (1 - rim), rim * 0.45, 0, rim * 0.25);
      continue;
    }
    if (d.kind === 'keyhole' && y > top - 7 && n3.y > 0.2 && open > 0.6) {
      // Turf on the islet's top, browning over its rolled brow.
      const brow = 1 - smoothstep(0.55, 0.85, n3.y);
      tmp.copy(GRASS).lerp(GRASS_ALT, smoothstep(0.3, 0.7, n)).lerp(GRASS_DARK, 0.25 * mossN(x * 0.08, z * 0.08) + 0.25);
      tmp.lerp(BROW, brow * 0.6);
      b.setColor(v, tmp.r, tmp.g, tmp.b);
      b.setSurf(v, 0, 1 - 0.4 * brow, 0, 0.5 * brow);
      b.setOver(v, DIRT.r, DIRT.g, DIRT.b, 0);
      continue;
    }
    // Rock: warm cliff stone near the top, cooling into the islands' underside palette below the
    // waist; the passage's walls in their own shade.
    const below = top - y;
    const deepT = smoothstep(0, Math.max(10, waist - deepest), waist - y);
    tmp.copy(CLIFF).lerp(UNDER_NEAR, 0.15 + 0.25 * n + 0.3 * smoothstep(4, 16, below));
    tmp.lerp(UNDER_MID, smoothstep(0, 0.5, deepT)).lerp(UNDER_DEEP, smoothstep(0.4, 1, deepT) * (0.75 + 0.25 * n));
    // Closed-in rock (the cracks, the chamber, under the belly) is darker and cooler, so the way
    // through reads as a slot from a distance and has depth inside it.
    tmp.lerp(UNDER_MID, (1 - open) * 0.3).multiplyScalar(0.5 + 0.5 * open);
    let lip = 0;
    if (d.kind === 'crag' && slabN > 0) {
      // The lip: the flank within a few metres of the slab's edge, stained dark and hung with moss
      // like rock under a spill, so the edge is outlined from the front.
      const underSlab = slabH - (PLANE.x * x + PLANE.y * y + PLANE.z * z);
      lip = smoothstep(6, 0.8, underSlab) * smoothstep(-0.5, 0.3, underSlab);
      tmp.lerp(LIP, 0.85 * lip);
    }
    // Moss where rock faces up, and creeping a little way down from the top.
    const moss = Math.max(smoothstep(0.45, 0.8, n3.y) * smoothstep(0.2, 0.6, mossN(x * 0.06, z * 0.06 + y * 0.03)), (1 - smoothstep(0.5, 6, below)) * 0.7);
    tmp.lerp(MOSS, moss * 0.5);
    b.setColor(v, tmp.r, tmp.g, tmp.b);
    // Strata on the flanks; hanging moss and root streaks under overhangs.
    const under = smoothstep(-0.25, -0.75, n3.y);
    b.setSurf(v, 1 - 0.7 * deepT, 0, 0, Math.max(under * 0.8, moss * 0.5, lip * 0.7));
  }
  return { data: b.finish(normals) };
}

const PLANE = new Vector3();

const RIM_DIRS = 8;
/**
 * 0..1 how close a point on the slab is to its edge: probes along the slab for open air within
 * about 3 m (the field beyond an edge is large, over the slab it stays at the probe's height).
 */
function slabRim(shape: RockFormShape, x: number, y: number, z: number, nrm: Vector3): number {
  let rim = 0;
  for (let i = 0; i < RIM_DIRS; i++) {
    const a = (i / RIM_DIRS) * Math.PI * 2;
    // Eight horizontal directions, each lifted onto the slab's plane through the point.
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const sx = x + ux * 3 + nrm.x * 0.4;
    const sz = z + uz * 3 + nrm.z * 0.4;
    // Keep the probe in the slab's plane: solve y from the plane through (x, y, z).
    const sy = nrm.y > 1e-3 ? y - (nrm.x * (sx - x - nrm.x * 0.4) + nrm.z * (sz - z - nrm.z * 0.4)) / nrm.y + nrm.y * 0.4 : y;
    rim = Math.max(rim, smoothstep(0.55, 1.8, shape.sdf(sx, sy, sz)));
  }
  return rim;
}
