import { describe, expect, it } from 'vitest';
import { Triangle, Vector3, type SkinnedMesh } from 'three';
import { DEFAULT_WYVERN } from '../../cosmetics/catalog';
import { BREED_ORDER } from '../../flight/breeds';
import { createRiderPose, createWyvernPose } from '../../player/poses';
import { Wyvern } from '../wyvern/Wyvern';
import type { SaddleInfo } from '../wyvern/parts/saddle';
import { Rider } from './Rider';
import type { RiderModel } from './model';
import { C02_LOOK } from './proof';
import { B } from './rig';

function worldVertex(mesh: SkinnedMesh, i: number): Vector3 {
  return mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
}

function triangles(mesh: SkinnedMesh, range?: [number, number], accept?: (v: number) => boolean): Triangle[] {
  const idx = mesh.geometry.index!;
  const out: Triangle[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const vertices = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
    if (range && vertices.some(v => v < range[0] || v >= range[1])) continue;
    if (accept && !vertices.every(accept)) continue;
    out.push(new Triangle(...vertices.map(v => worldVertex(mesh, v)) as [Vector3, Vector3, Vector3]));
  }
  return out;
}

/** Actual flap surface x at a leg vertex's y/z, independent of its builder's fit formula. */
function projectedX(t: Triangle, p: Vector3): number | null {
  const { a, b, c } = t;
  const by = b.y - a.y, bz = b.z - a.z, cy = c.y - a.y, cz = c.z - a.z;
  const det = by * cz - bz * cy;
  if (Math.abs(det) < 1e-9) return null;
  const u = ((p.y - a.y) * cz - (p.z - a.z) * cy) / det;
  const v = (by * (p.z - a.z) - bz * (p.y - a.y)) / det;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001 ? a.x + u * (b.x - a.x) + v * (c.x - a.x) : null;
}

const poses = [
  { name: 'ground', lean: 0, crouch: 0, brace: 0 },
  { name: 'glide', lean: 0, crouch: 0, brace: 0 },
  { name: 'left bank', lean: -.9, crouch: .25, brace: 0 },
  { name: 'right bank', lean: .9, crouch: .25, brace: 0 },
  { name: 'dive', lean: 0, crouch: .8, brace: 0 },
  { name: 'brake', lean: 0, crouch: 0, brace: 1 },
];

describe('mounted C02 leg surfaces and stirrup irons', { timeout: 120000 }, () => {
  for (const breed of BREED_ORDER) for (const saddle of ['rider', 'racing', 'royal', 'nomad']) {
    it(`${breed}/${saddle}: keeps both knee/calf surfaces outside the flap and supports the sandal across its width`, () => {
      const w = new Wyvern({ ...DEFAULT_WYVERN, breed, saddle });
      const r = new Rider(C02_LOOK, { proof: 'aerie', saddle: w.saddle, socket: (name, out) => w.socket(name, out) });
      try {
        const model = (r as unknown as { model: RiderModel }).model;
        const ranges = (w as unknown as { info: { saddle: SaddleInfo } }).info.saddle.fitRanges;
        const geo = model.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
        const legs = [1, -1].map(side => {
          const th = side === 1 ? B.thighL : B.thighR, sh = side === 1 ? B.shinL : B.shinR;
          const out: number[] = [];
          for (let i = 0; i < si.count; i++) {
            const p = new Vector3().fromBufferAttribute(geo.attributes.position, i);
            const s = model.rig.bindPos[th].y - p.y;
            let weight = 0;
            for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === th || si.getComponent(i, k) === sh) weight += sw.getComponent(i, k);
            if (side * p.x > 0 && s >= .36 && s <= .72 && weight > .99) out.push(i);
          }
          return out;
        });
        const wp = createWyvernPose(), rp = createRiderPose();
        wp.position.set(0, 300, 0); rp.mounted = true; rp.action = 'mounted';
        for (const pose of poses) {
          wp.airborne = pose.name !== 'ground'; wp.groundY = wp.airborne ? null : 300;
          wp.orientation.setFromAxisAngle(new Vector3(0, 0, 1), pose.lean * .7);
          wp.wingSpread = 1 - pose.crouch * .75; wp.flare = pose.brace;
          Object.assign(rp, { lean: pose.lean, crouch: pose.crouch, brace: pose.brace });
          for (let f = 0; f < 90; f++) { w.update(1 / 60, wp); r.update(1 / 60, rp, w.saddle); }
          const inv = w.saddle.matrixWorld.clone().invert();
          for (const [i, side] of [1, -1].entries()) {
            const flap = triangles(w.skinnedMesh!, ranges.flaps[i]).map(t => new Triangle(t.a.applyMatrix4(inv), t.b.applyMatrix4(inv), t.c.applyMatrix4(inv)));
            let minGap = Infinity, samples = 0;
            for (const v of legs[i]) {
              const p = worldVertex(model.mesh, v).applyMatrix4(inv);
              for (const t of flap) {
                const x = projectedX(t, p);
                if (x === null) continue;
                minGap = Math.min(minGap, side * (p.x - x)); samples++;
              }
            }
            expect(samples, `${pose.name}/${side} sampled actual flap`).toBeGreaterThan(0);
            expect(minGap, `${pose.name}/${side} visible knee/calf surface clearance`).toBeGreaterThan(.005);

            const ft = side === 1 ? B.footL : B.footR, toe = side === 1 ? B.toeL : B.toeR;
            const footTriangles = triangles(model.mesh, undefined, v => {
              let weight = 0;
              for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === ft || si.getComponent(v, k) === toe) weight += sw.getComponent(v, k);
              return weight > .5;
            });
            const ironTriangles = triangles(w.skinnedMesh!, ranges.irons[i]);
            const target = w.socket(side === 1 ? 'stirrupL' : 'stirrupR', new Vector3())!;
            const up = new Vector3(0, 1, 0).transformDirection(w.saddle.matrixWorld).multiplyScalar(.018);
            const across = new Vector3(1, 0, 0).transformDirection(w.saddle.matrixWorld);
            for (const x of [-.03, 0, .03]) {
              const contact = target.clone().add(up).addScaledVector(across, x);
              const point = new Vector3();
              const distance = (ts: Triangle[]) => Math.min(...ts.map(t => t.closestPointToPoint(contact, point).distanceTo(contact)));
              // The existing rounded sole rises slightly at its lateral edges; its centre
              // carries the load, while both outer samples remain within 6 mm of the tread.
              expect(distance(footTriangles), `${pose.name}/${side} sandal contact/${x}`).toBeLessThan(x === 0 ? .003 : .006);
              expect(distance(ironTriangles), `${pose.name}/${side} iron tread support/${x}`).toBeLessThan(.003);
            }
          }
        }
      } finally { r.dispose(); w.dispose(); }
    });
  }
});
