// Static hair: a cap shell clipped to a hairline plus sculpted locks (teardrop clumps) that give
// each style its silhouette. Tails, braids and long hair that move are declared here as cloth
// specs and simulated in cloth.ts.

import { Color, Quaternion, Vector3 } from 'three';
import type { RiderLook } from '../../core/types';
import { B } from './rig';
import { sk } from './meshKit';
import { shapeHead, type BodyCtx } from './body';
import { mixSrgb, tone } from './palette';
import { mulberry } from './random';

const UPV = new Vector3(0, 1, 0);

/** Hairline height (unit-sphere y) by azimuth φ (0 = front, ±π = back). */
function hairline(phi: number, style: string): number {
  const a = Math.abs(phi);
  const front = style === 'shaved' ? 0.5 : 0.36;
  // Front, temples, above the ears, nape.
  const keys: [number, number][] = [
    [0, front],
    [0.55, front - 0.1],
    [1.1, 0.05],
    [1.45, -0.32],
    [1.75, -0.28],
    [2.4, -0.55],
    [Math.PI, -0.62],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    if (a <= keys[i + 1][0]) {
      const t = (a - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      const s = t * t * (3 - 2 * t);
      return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * s;
    }
  }
  return keys[keys.length - 1][1];
}

export interface HairOpts {
  /** Hide the crown (a hood, helm or cap covers it). */
  covered: boolean;
  /** Extra clearance for headgear bands (goggles, circlet) over the hair. */
}

/** Thickness of the hair cap for a style (so headgear can sit on top of it). */
export function hairThickness(style: string): number {
  switch (style) {
    case 'curls':
      return 0.03;
    case 'shaved':
      return 0.003;
    case 'short':
      return 0.016;
    case 'long':
      return 0.015;
    default:
      return 0.011;
  }
}

export function buildHair(ctx: BodyCtx, look: RiderLook, covered: boolean, proof = false, fittedFace = false): void {
  if (proof && look.hair === 'ponytail' && !covered) return buildProofPony(ctx);
  const { b, pal, head } = ctx;
  const style = look.hair;
  const hb = sk(B.head);
  const t = hairThickness(style);
  const base = style === 'shaved' ? mixSrgb(pal.skin, pal.hair, 0.5) : pal.hair;
  const rnd = mulberry(7);
  const hairCol = (u: Vector3) => {
    // Soft painterly variation: darker toward the nape and under the locks.
    const k = 0.82 + 0.18 * Math.max(0, u.y) + 0.05 * Math.sin(u.x * 23 + u.z * 17);
    return tone(base, k);
  };

  if (!covered) {
    // Cap: an inflated copy of the cranium; outside the hairline it sinks into the head.
    b.ellipsoid(head.center, head.radii.clone().addScalar(t), hb, hairCol, {
      lat: 14,
      lon: 22,
      deform: (u) => {
        const phi = Math.atan2(u.x, u.z);
        const line = hairline(phi, style);
        const inside = 1 - Math.min(1, Math.max(0, (u.y - line) / 0.06));
        shapeHead(u);
        // The authored medium face is shallower below the preserved cranium.
        // Sink only the invisible cap interior; retain every visible hairline/lock.
        const k = (1 - inside * (t + 0.012) / 0.1) * (fittedFace ? 1 - .5 * inside : 1);
        u.multiplyScalar(k);
        // Parting for braids.
        if (style === 'braids' && Math.abs(u.x) < 0.06 && u.y > 0.3) u.multiplyScalar(0.985);
      },
    });
  }

  const lock = (root: Vector3, dir: Vector3, len: number, width: number, col: Color, curl = 0) => {
    const q = new Quaternion().setFromUnitVectors(UPV, dir.clone().normalize().negate());
    b.ellipsoid(root.clone().addScaledVector(dir, len * 0.45), new Vector3(width, len * 0.55, width * 0.6), hb, col, {
      rot: q,
      lat: 6,
      lon: 8,
      deform: (u) => {
        if (u.y < 0) {
          const k = 1 + u.y * (proof && style === 'ponytail' ? .48 : .9);
          u.x *= k;
          u.z *= k;
          u.x += curl * u.y * u.y * 0.6;
        }
      },
    });
  };
  const capPoint = (dir: Vector3, inflate: number) => head.surface(dir, new Vector3(), inflate);

  // Fringe: locks swept across the forehead (every style but shaved).
  if (style !== 'shaved') {
    const n = style === 'curls' ? 0 : style === 'long' ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const phi = -0.75 + 1.5 * f;
      const root = capPoint(new Vector3(Math.sin(phi) * 0.75, 0.62, Math.cos(phi) * 0.75), t * 0.6);
      const sweep = new Vector3(0.55 + 0.2 * Math.sin(f * 5), -0.85, 0.32).normalize();
      const len = (style === 'long' ? 0.085 : 0.07) * (0.85 + 0.3 * Math.sin(f * 3.1 + 1));
      lock(root, sweep, len, 0.022, tone(base, 0.95 + 0.1 * rnd()), 0.02);
    }
  }

  if (style === 'curls') {
    // A cloud of curls over the cap.
    for (let i = 0; i < 70; i++) {
      const y = 1 - 1.35 * ((i + 0.5) / 70);
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.39996;
      const dir = new Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r);
      const line = hairline(phi > Math.PI ? phi - 2 * Math.PI : phi, style);
      if (dir.y < line - 0.05 || (dir.z > 0.5 && dir.y < 0.45)) continue;
      const p = capPoint(dir, t * 0.7);
      const s = 0.028 + 0.012 * rnd();
      b.ellipsoid(p, new Vector3(s, s * 0.9, s), hb, tone(base, 0.85 + 0.25 * rnd()), { lat: 5, lon: 7 });
    }
    return;
  }

  if (covered) {
    // Only what peeks out under a brim: sideburns and the fringe (above).
    return;
  }

  if (style === 'short' || style === 'long' || style === 'ponytail' || style === 'braids') {
    // Crown locks combed back from the forehead, giving the cap a sculpted flow.
    const n = style === 'short' ? 22 : 16;
    for (let i = 0; i < n; i++) {
      const phi = -1.9 + 3.8 * ((i * 0.618) % 1);
      const lat = 0.2 + 0.75 * ((i * 0.381) % 1);
      const dir = new Vector3(Math.sin(phi) * Math.cos(lat), Math.sin(lat), Math.cos(phi) * Math.cos(lat));
      if (dir.y < hairline(phi, style) + 0.08) continue;
      const root = capPoint(dir, t * 0.4);
      const nrm = root.clone().sub(head.center).normalize();
      const back = new Vector3(0, -0.35, -1).addScaledVector(nrm, -nrm.dot(new Vector3(0, -0.35, -1))).normalize();
      const len = style === 'short' ? 0.075 : proof && style === 'ponytail' ? .065 : 0.09;
      lock(root, back, len, style === 'short' ? 0.024 : 0.026, tone(base, 0.9 + 0.15 * rnd()));
    }
  }

  if (style === 'short') {
    // Tufts at the nape and over the ears.
    for (let i = 0; i < 9; i++) {
      const phi = Math.PI * (0.45 + 0.55 * (i / 8)) * (i % 2 === 0 ? 1 : -1);
      const dir = new Vector3(Math.sin(phi), hairline(phi, style) + 0.12, Math.cos(phi));
      const root = capPoint(dir, t * 0.3);
      lock(root, new Vector3(Math.sin(phi) * 0.3, -1, Math.cos(phi) * 0.3), 0.05, 0.02, tone(base, 0.88));
    }
  }

  if (style === 'long') {
    // Face-framing strands down to the jaw.
    for (const s of [1, -1]) {
      for (let i = 0; i < 2; i++) {
        const root = capPoint(new Vector3(s * (0.75 + 0.1 * i), 0.15 - i * 0.1, 0.5 - i * 0.25), t * 0.5);
        lock(root, new Vector3(s * 0.12, -1, 0.05), 0.15 - i * 0.02, 0.026, tone(base, 0.92));
      }
    }
  }

  if (style === 'ponytail' || style === 'braids') {
    // Ties where the moving tails leave the head.
    for (const r of hairRoots(ctx, look)) {
      b.ellipsoid(r.p, new Vector3(0.022, 0.017, 0.022), hb, style === 'braids' ? pal.secondary : tone(pal.leather, 0.9), {
        rot: new Quaternion().setFromUnitVectors(UPV, r.dir),
        lat: 5,
        lon: 8,
      });
      b.ellipsoid(r.p.clone().addScaledVector(r.dir, -0.015), new Vector3(0.026, 0.02, 0.026), hb, base, { rot: new Quaternion().setFromUnitVectors(UPV, r.dir), lat: 5, lon: 8 });
    }
  }
}

/** Broad swept waves, rather than separate pointed cones. The moving pony is still hairSpecs. */
function buildProofPony(ctx: BodyCtx): void {
  const { b, head, pal } = ctx, bone = sk(B.head);
  b.ellipsoid(head.center, head.radii.clone().addScalar(.014), bone,
    u => tone(pal.hair, .82 + .15 * Math.max(0, u.y)), {
      lat: 12, lon: 20, deform: u => {
        const phi = Math.atan2(u.x, u.z), line = hairline(phi, 'ponytail');
        const fade = Math.min(1, Math.max(0, (u.y - line) / .07));
        shapeHead(u); u.multiplyScalar(.78 + .22 * fade);
      },
    });
  for (let lock = 0; lock < 7; lock++) {
    const phi = -1.05 + lock / 6 * 2.1;
    const points = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6, a = phi + .32 * Math.sin(t * Math.PI * 2 + lock * .45);
      const lat = .48 + .77 * Math.sin(t * Math.PI * .9) - .95 * t;
      const dir = new Vector3(Math.sin(a) * Math.cos(lat), Math.sin(lat), Math.cos(a) * Math.cos(lat));
      // Sweep over the crown toward the tied back hair mass.
      dir.z -= 1.75 * t * t; dir.normalize();
      return head.surface(dir, new Vector3(), .019 + .009 * Math.sin(t * Math.PI));
    });
    b.loft(points.map((c, i) => {
      const tangent = points[Math.min(6, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
      const normal = c.clone().sub(head.center).normalize();
      const ax = new Vector3().crossVectors(tangent, normal).normalize();
      const ay = new Vector3().crossVectors(ax, tangent).normalize();
      return { c, ax, ay, rx: .020 + .006 * Math.sin(i / 6 * Math.PI), ry: .009,
        skin: bone, color: tone(pal.hair, .88 + .08 * Math.sin(lock * 1.7 + i * .5)) };
    }), 8, { capStart: true, capEnd: true, capBulge: .1 });
  }
  // Three loose, curved forehead/temple waves break the cap's uniform edge.
  for (const [side, offset] of [[-1, 0], [1, 0], [1, -.55]]) {
    const points = Array.from({ length: 6 }, (_, i) => {
      const t = i / 5;
      const center = offset !== 0;
      return head.surface(new Vector3(center ? .35 + .15 * Math.sin(t * Math.PI) - .35 * t : side * (.66 + .13 * Math.sin(t * Math.PI)),
        center ? .85 - .48 * t : .65 - .58 * t + .08 * Math.sin(t * Math.PI * 2),
        .68 + .11 * Math.sin(t * Math.PI)), new Vector3(), .023);
    });
    b.loft(points.map((c, i) => {
      const tan = points[Math.min(5, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
      const n = c.clone().sub(head.center).normalize(), ax = new Vector3().crossVectors(tan, n).normalize();
      return { c, ax, ay: new Vector3().crossVectors(ax, tan).normalize(),
        rx: .017 * (1 - .65 * i / 5), ry: .009 * (1 - .45 * i / 5), skin: bone, color: tone(pal.hair, .94) };
    }), 6, { capStart: true, capEnd: true, capBulge: .1 });
  }
  for (const root of hairRoots(ctx, ctx.look)) {
    b.ellipsoid(root.p.clone().addScaledVector(root.dir, -.012), new Vector3(.032, .026, .03), bone, pal.hair, { lat: 6, lon: 10 });
    b.ellipsoid(root.p, new Vector3(.025, .017, .025), bone, tone(pal.leather, .85), { lat: 5, lon: 8 });
  }
}

export interface HairRoot {
  /** Bind-space root point and initial direction (unit). */
  p: Vector3;
  dir: Vector3;
}

/** Where the moving hair leaves the head (bind space). */
export function hairRoots(ctx: BodyCtx, look: RiderLook): HairRoot[] {
  const { head } = ctx;
  const t = hairThickness(look.hair);
  if (look.hair === 'ponytail') {
    const p = head.surface(new Vector3(0, 0.25, -1), new Vector3(), t + 0.006);
    return [{ p, dir: new Vector3(0, -0.6, -0.8).normalize() }];
  }
  if (look.hair === 'braids') {
    return [1, -1].map((s) => ({
      p: head.surface(new Vector3(s * 0.8, -0.35, -0.55), new Vector3(), t + 0.004),
      dir: new Vector3(s * 0.25, -1, -0.15).normalize(),
    }));
  }
  return [];
}
