import { describe, expect, it } from 'vitest';
import { dragonRig } from './rig';
import { dragonBindSkeleton, type Vec3 } from './skeleton';

const rig = dragonRig();
const sk = dragonBindSkeleton(rig);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('dragon bind skeleton export', () => {
  it('carries every rig bone, in order, with its parent and pivot', () => {
    expect(sk.bones.map((b) => b.name)).toEqual(rig.bones.map((b) => b.name));
    sk.bones.forEach((b, i) => {
      const r = rig.bones[i];
      expect(b.parent).toBe(r.parent < 0 ? null : rig.bones[r.parent].name);
      expect(dist(b.head, [r.pos.x, r.pos.y, r.pos.z])).toBeLessThan(1e-5);
    });
  });

  it('gives every bone a length Blender accepts', () => {
    for (const b of sk.bones) expect(dist(b.head, b.tail)).toBeGreaterThan(0.02);
  });

  it('runs each weighted bone from its own pivot to a named point', () => {
    const byName = new Map(sk.bones.map((b) => [b.name, b]));
    for (const [bone, [a, b]] of Object.entries(sk.segments)) {
      expect(byName.has(bone)).toBe(true);
      expect(sk.points[a]).toBeDefined();
      expect(sk.points[b]).toBeDefined();
      expect(dist(sk.points[a], byName.get(bone)!.head)).toBeLessThan(1e-5);
      expect(dist(sk.points[b], byName.get(bone)!.tail)).toBeLessThan(1e-5);
    }
  });

  it('weights every limb, neck and tail bone, and leaves the helpers out', () => {
    const weighted = new Set(Object.keys(sk.segments));
    expect(weighted.size).toBe(56);
    for (const n of ['root', 'breath', 'jaw', 'fanL', 'fanR', 'foldL', 'foldR', 'gular']) expect(weighted.has(n)).toBe(false);
  });

  it('mirrors every left point onto the right', () => {
    for (const [k, p] of Object.entries(sk.points)) {
      if (!k.endsWith('L')) continue;
      const q = sk.points[k.slice(0, -1) + 'R'];
      expect(q).toBeDefined();
      expect(q[0]).toBeCloseTo(-p[0], 6);
      expect(q[1]).toBeCloseTo(p[1], 6);
      expect(q[2]).toBeCloseTo(p[2], 6);
    }
  });

  it('puts the toe tips on the soles, the wingtips at the span and the snout ahead of the head', () => {
    for (const k of ['foretipL', 'toetipL']) expect(sk.points[k][1]).toBeCloseTo(sk.ground + (k === 'foretipL' ? rig.props.foreleg.sole : rig.props.hindleg.sole), 6);
    expect(sk.points.f0tipL[0]).toBeCloseTo(sk.wingspan / 2, 5);
    expect(dist(sk.points.snout, sk.points.head)).toBeCloseTo(rig.props.shape.headLength, 5);
    expect(sk.points.snout[2]).toBeGreaterThan(sk.points.head[2]);
  });

  it('serializes to plain JSON and back unchanged', () => {
    expect(JSON.parse(JSON.stringify(sk))).toEqual(sk);
  });
});
