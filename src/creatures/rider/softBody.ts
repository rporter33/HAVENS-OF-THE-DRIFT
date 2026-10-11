// Shared refined rider sculpt. The shoulder openings share actual vertices with the arm bridges;
// the chest, neck and both arms form one continuous surface on the existing 27-bone rig.
import { Vector3 } from 'three';
import { B } from './rig';
import { hermite, legSkin, stops, torsoPoint, torsoSkin, type BodyCtx, type OutfitStyle, type Side } from './body';
import { sk, sk2, type RingSpec, type SkinSpec } from './meshKit';
import { tone } from './palette';
import {legSection} from './legFit';
export const SOFT_LEG_SEGMENTS=16;

const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const REFINED_BODY_SHAPE: NonNullable<OutfitStyle['shape']> = {
  upperBody: softUpperBody, hand: softHand, foot: softFoot, leg: softLeg,
};

/** Presentation profiles only: joint locations, colliders and contact frames stay unchanged. */
export function sculptProofProfiles(ctx: BodyCtx): void {
  const armAt = ctx.armAt, torsoAt = ctx.torsoAt;
  ctx.armAt = s => {
    const r = armAt(s), t = s / ctx.d.h;
    const muscle = .27 * Math.exp(-(((t - .13) / .14) ** 2))
      + .13 * Math.exp(-(((t - .35) / .075) ** 2));
    return { rx: r.rx * (1 + muscle), rz: r.rz * (1 + muscle * .85) };
  };
  ctx.torsoAt = y => {
    const r = torsoAt(y), chest = Math.exp(-(((y / ctx.d.h - 1.3) / .105) ** 2));
    return { ...r, rx: r.rx * (1 + .035 * chest), rf: r.rf * (1 + .065 * chest) };
  };
  ctx.head.radii.multiply(V(.95, 1.015, .97));
}
function blend(a: SkinSpec, b: SkinSpec, t: number): SkinSpec {
  const weights = new Map<number, number>();
  for (const [spec, k] of [[a, 1 - t], [b, t]] as const) for (let i = 0; i < spec.length; i += 2)
    weights.set(spec[i], (weights.get(spec[i]) ?? 0) + spec[i + 1] * k);
  return [...weights].sort((x, y) => y[1] - x[1]).slice(0, 4).flat();
}
function armSkin(ctx: BodyCtx, s: number, side: Side): SkinSpec {
  const { d } = ctx, suffix = side === 1 ? 'L' : 'R';
  const up = B[`upperArm${suffix}`], fore = B[`foreArm${suffix}`], hand = B[`hand${suffix}`];
  if (s < d.upperArm - .04) return sk(up);
  if (s < d.upperArm + .04) return sk2(up, fore, smooth(d.upperArm - .04, d.upperArm + .04, s));
  return sk2(fore, hand, .35 * smooth(d.upperArm + d.foreArm - .03, d.upperArm + d.foreArm, s));
}

export function softUpperBody(ctx: BodyCtx, style: OutfitStyle): void {
  const { b, d, bp, pal } = ctx;
  const seg = 24, step = Math.PI * 2 / seg;
  // Four rows around each shoulder opening give a 16-vertex boundary. No shoulder balls,
  // capped arm tubes or overlapping neck cylinder remain in this proof.
  const heights = [...stops(.83, 1.29, .035, []), 1.32, 1.35, 1.365, 1.40, 1.44,
    1.455, 1.475, 1.50, 1.54, 1.58, 1.61].map(y => y * d.h);
  const low = heights.indexOf(1.32 * d.h), high = low + 4;
  const grid: number[][] = [], points: Vector3[][] = [], skins: SkinSpec[][] = [];
  b.begin();
  for (const y of heights) {
    const ids: number[] = [], ps: Vector3[] = [], ss: SkinSpec[] = [];
    for (let j = 0; j < seg; j++) {
      const th = j * step, p = new Vector3();
      let skin: SkinSpec;
      if (y <= 1.455 * d.h) {
        torsoPoint(ctx, y, th, style.torso.inflate(y, th), p);
        skin = torsoSkin(ctx, y, p);
      } else {
        const t = smooth(1.455 * d.h, 1.50 * d.h, y);
        const r = .047 * (.4 + .6 * d.g);
        const last = ctx.torsoAt(1.455 * d.h);
        const rx = last.rx * (1 - t) + r * t;
        const rz = (Math.sin(th) < 0 ? last.rb : last.rf) * (1 - t) + r * 1.06 * t;
        p.set(Math.cos(th) * rx, y, -.012 + .012 * smooth(1.45 * d.h, 1.6 * d.h, y) + Math.sin(th) * rz);
        skin = y < 1.50 * d.h ? sk2(B.chest, B.neck, smooth(1.43 * d.h, 1.50 * d.h, y))
          : sk2(B.neck, B.head, smooth(1.50 * d.h, 1.58 * d.h, y));
      }
      const color = style.torso.color(y, th, p);
      ids.push(b.vertex(p, color, skin, 0, [j / seg, (1.455 * d.h - y) / (.625 * d.h)],
        color === pal.skin ? 'neutral' : style.torso.surface ?? 'linen')); ps.push(p); ss.push(skin);
    }
    grid.push(ids); points.push(ps); skins.push(ss);
  }
  const col = (j: number) => (j + seg) % seg;
  for (let i = 0; i < heights.length - 1; i++) for (let j = 0; j < seg; j++) {
    const inHole = i >= low && i < high && [-2, -1, 0, 1, 10, 11, 12, 13].some(k => col(k) === j);
    if (inHole) continue;
    b.quadFacing(grid[i][j], grid[i][col(j + 1)], grid[i + 1][col(j + 1)], grid[i + 1][j], V(Math.cos((j + .5) * step), 0, Math.sin((j + .5) * step)));
  }
  for (const side of [1, -1] as const) {
    const S = side === 1 ? bp.upperArmL : bp.upperArmR;
    const angle = (j: number) => col(side === 1 ? j : 12 - j);
    const boundary = [[high, 0], [high, 1], [high, 2], [high - 1, 2], [high - 2, 2], [low + 1, 2],
      [low, 2], [low, 1], [low, 0], [low, -1], [low, -2], [low + 1, -2], [high - 2, -2],
      [high - 1, -2], [high, -2], [high, -1]];
    let previous = boundary.map(([i, j]) => grid[i][angle(j)]);
    const armSteps = stops(.08 * d.h, d.upperArm + d.foreArm, .04, [...style.arm.bounds, d.upperArm - .04, d.upperArm + .04]);
    const ringPoint = (s: number, j: number) => {
      const th = j / 16 * Math.PI * 2, r = ctx.armAt(s), inf = style.arm.inflate(s);
      return V(S.x + side * Math.cos(th) * (r.rx + inf), S.y - s, S.z + Math.sin(th) * (r.rz + inf));
    };
    const connect = (next: number[]) => {
      for (let j = 0; j < 16; j++) b.quadFacing(previous[j], previous[(j + 1) % 16], next[(j + 1) % 16], next[j],
        V(side * Math.cos((j + .5) / 16 * Math.PI * 2), 0, Math.sin((j + .5) / 16 * Math.PI * 2)));
      previous = next;
    };
    // Four curved bridge rings ease the shoulder into the arm; skinning is shared at the
    // torso edge and gradually becomes the established upper-arm field.
    for (const t of [.2, .4, .65, .85]) connect(boundary.map(([i, j], k) => {
      const start = points[i][angle(j)], end = ringPoint(armSteps[0], k);
      const outer = Math.max(0, Math.cos(k / 16 * Math.PI * 2));
      // An outer deltoid arc leaves the shoulder horizontally and meets the arm vertically.
      // Linear interpolation made a bevel with a visible hard line at the first arm ring.
      const control = start.clone().lerp(end, .5);
      control.x += (end.x - start.x) * .5 * outer;
      control.y += (start.y - end.y) * .5 * outer;
      const p = start.clone().multiplyScalar((1 - t) ** 2).addScaledVector(control, 2 * t * (1 - t)).addScaledVector(end, t * t);
      const skin = blend(skins[i][angle(j)], armSkin(ctx, armSteps[0], side), smooth(0, 1, t));
      const color = style.arm.color(.04 * d.h, k / 16 * Math.PI * 2, side);
      return b.vertex(p, color, skin, 0, [k / 16, t * .1], color === pal.skin ? 'neutral' : style.arm.surface ?? 'linen');
    }));
    for (const s of armSteps) connect(Array.from({ length: 16 }, (_, j) => {
      const color = style.arm.color(s, j / 16 * Math.PI * 2, side);
      return b.vertex(ringPoint(s, j), color, armSkin(ctx, s, side), 0, [j / 16, s / (d.upperArm + d.foreArm)],
        color === pal.skin ? 'neutral' : style.arm.surface ?? 'linen');
    }));
  }
  b.end();
}

export function softHand(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx, suffix = side === 1 ? 'L' : 'R';
  const W = bp[`hand${suffix}`], hand = B[`hand${suffix}`], f1 = B[`fingers${suffix}`], f2 = B[`fingers2${suffix}`];
  const g = .5 + .5 * d.g, full = d.palm + d.finger1 + d.finger2;
  const wrist = ctx.armAt(d.upperArm + d.foreArm);
  const keys = [[0, wrist.rx / g, wrist.rz / g], [.025, .020, .035], [.055, .019, .039],
    [d.palm, .016, .039], [d.palm + .04, .014, .036], [full - .025, .012, .032],
    [full - .009, .008, .022], [full, .002, .005]];
  const rings: RingSpec[] = stops(0, full, .02, [d.palm, d.palm + d.finger1]).map(s => {
    const skin = s < .025 ? blend(armSkin(ctx, d.upperArm + d.foreArm, side), sk(hand), smooth(0, .025, s))
      : s < d.palm + .012 ? sk2(hand, f1, smooth(d.palm - .012, d.palm + .012, s))
      : sk2(f1, f2, smooth(d.palm + d.finger1 - .012, d.palm + d.finger1 + .012, s));
    return { c: V(W.x, W.y - s, W.z + .004 * smooth(0, d.palm, s)), ax: X, ay: Z,
      rx: hermite(keys, s, 1) * g, ry: hermite(keys, s, 2) * g, exp: 2, skin, color: style.hand };
  });
  b.loft(rings, 16, { capEnd: true, capBulge: .1 });
  const T = bp[`thumb${suffix}`], dir = V(-side * .35, -.72, .6).normalize();
  const ax = new Vector3().crossVectors(Y, dir).normalize(), ay = new Vector3().crossVectors(dir, ax).normalize();
  b.loft([[-.012, .014], [.016, .0135], [.035, .012], [.050, .009], [.058, .004]].map(([s, r]) => ({
    c: T.clone().addScaledVector(dir, s), ax, ay, rx: r * g, ry: r * g * .92,
    skin: s < .016 ? sk2(hand, B[`thumb${suffix}`], smooth(-.012, .016, s)) : sk(B[`thumb${suffix}`]), color: style.hand,
  })), 10, { capStart: true, capEnd: true, capBulge: .15 });
}

export function softLeg(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp, pal } = ctx, J = side === 1 ? bp.thighL : bp.thighR;
  // Only gathered linen has a rolled trouser hem. Legacy bounds also include boot tops,
  // which must retain their own coloring/inflation rather than become exposed skin/cuffs.
  const hem = style.leg.gatherHem ?? 0;
  const L = d.thigh + d.shin;
  const rings: RingSpec[] = stops(-.07 * d.h, L + .015 * d.h, .035, [...style.leg.bounds, L - .045 * d.h, L - .015 * d.h, L]).map(s => {
    const r = legSection(ctx,s,side,style.leg), cloth = hem > 0 && s < hem;
    const gather = cloth ? .05 * Math.sin(Math.PI * Math.max(0, s) / hem) : 0;
    return { c:r.c,
      ax: X, ay: Z, rx:r.rx,ry:r.rf,ryBack:r.rb,
      radial: th => r.radial(th)*(1 + gather * Math.cos(th * 7 + s * 22)),
      surface: s>(style.leg.bootStart??Infinity)?'leather':r.cloth?'linen':'neutral',
      skin:r.skin, color: th => style.modular || !hem ? style.leg.color(s, th, side)
        : cloth ? tone(pal.primary, .92 - .055 * (1 - Math.cos(th * 7 + s * 22))) : pal.skin };
  });
  b.loft(rings, SOFT_LEG_SEGMENTS, { capStart: true, capEnd: true, capBulge: .2 });
  if (hem > 0) b.surface('linen', () => b.loft([hem - .035, hem - .02, hem - .005, hem + .006].map((s, i) => {
    const r = ctx.legAt(s), bulge = [.011, .022, .02, .006][i];
    return { c: V(J.x - side * .006, J.y - s, J.z), ax: X, ay: Z,
      rx: r.rx + bulge, ry: r.rf + bulge, ryBack: r.rb + bulge,
      radial: th => 1 + .025 * Math.cos(th * 7), skin: legSkin(d, s, side), color: tone(pal.primary, .91) };
  }), 14));
}

export function softFoot(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx, suffix = side === 1 ? 'L' : 'R';
  const A = bp[`foot${suffix}`], ft = B[`foot${suffix}`], toe = B[`toe${suffix}`], toeZ = bp[`toe${suffix}`].z;
  const g = .6 + .4 * d.g;
  // Softer heel and toe caps retain the flat sole and its existing ball-of-foot contact.
  const keys = [[-.064, .045, .008, .018], [-.05, .05, .032, .04], [-.02, .055, .041, .055],
    [.03, .055, .045, .06], [.08, .044, .049, .044], [.13, .035, .05, .034],
    [.165, .032, .047, .03], [.19, .030, .041, .026], [.203, .028, .032, .022]];
  b.loft(keys.map(([z, cy, hw, hh]) => {
    const zz = z * d.footLen / .25;
    return { c: V(A.x - side * .004 * (zz / .2), cy * d.h, A.z + zz), ax: X, ay: Y,
      rx: hw * g, ry: hh * d.h, ryBack: cy * d.h, exp: 2.2,
      skin: zz < toeZ - .035 ? sk(ft) : zz < toeZ + .01 ? sk2(ft, toe, smooth(toeZ - .035, toeZ + .01, zz)) : sk(toe),
      color: (th: number) => Math.sin(th) < -.55 ? style.foot.sole : style.foot.color };
  }), 14, { capStart: true, capEnd: true, capBulge: .1 });
}
