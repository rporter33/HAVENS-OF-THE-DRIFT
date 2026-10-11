// Approved C02 / M01 clothing. Travel Drape exposes its pieces in the Stable;
// debug proofs continue to select the Wanderer or compact Aerie cut explicitly.
import { Color, Quaternion, Vector3 } from 'three';
import type { RiderGarmentSlot, RiderLook } from '../../core/types';
import { DEFAULT_RIDER } from '../../cosmetics/catalog';
import { B } from './rig';
import { sk, sk2, type RingSpec } from './meshKit';
import { legSkin, shapeHead, torsoPoint, torsoSkin, type BodyCtx, type OutfitStyle } from './body';
import { skirtPanel, strap, stud, torsoBand, torsoPanel, torsoPath } from './garments';
import { hairSpecs, scarfSpecs, capeSpecs, type ClothSpec } from './accessories';
import { mixSrgb, tone } from './palette';
import { softUpperBody, softHand, softFoot, softLeg } from './softBody';
import {legPoint,legSection} from './legFit';

export type RiderProof = 'wanderer' | 'aerie';
export const C02_LOOK: RiderLook = {
  ...DEFAULT_RIDER, build: 'medium', hair: 'ponytail', headgear: 'none', scarf: 'none', cape: 'none',
  outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4', scarfColor: '#315E9C', capeColor: '#F2EADA',
};
export function activeRiderProof(look: RiderLook, proof?: RiderProof): RiderProof | undefined {
  // The playable outfit uses the secured riding cut on foot and in flight. The long
  // Wanderer cut remains an explicit viewer option; no flight-state or physics changes.
  if (look.outfit === 'travel-drape') return proof ?? 'aerie';
  // P1 only. Other builds/outfits continue to display their existing models when selected.
  return look.build === 'medium' && look.outfit === 'flight' ? proof : undefined;
}
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

export function proofStyle(ctx: BodyCtx, proof: RiderProof): OutfitStyle {
  const { d, pal, look } = ctx, h = d.h;
  const drape = look.shoulderDrape !== 'none', arms = look.armWraps !== 'none';
  const linen = pal.primary;
  const legHem = (proof === 'aerie' ? .34 : .39) * h;
  return {
    torso: {
      // Sleeveless linen reaches the shoulders with an open V, rather than a straight bib cutoff.
      color: (y, th) => y > chitonNeck(th) * h ? pal.skin : linen,
      inflate: (y, th) => y > chitonNeck(th) * h ? 0 : .012,
      bounds: [1.335 * h, 1.385 * h, 1.425 * h],
    },
    arm: {
      color: (s, th, side) => drape && side === 1 && s < .085 * h || arms && s > .345 * h && s < .49 * h ? linen : pal.skin,
      inflate: s => arms && s > .345 * h && s < .49 * h ? .005 : 0,
      bounds: [.085 * h, .345 * h, .49 * h],
    },
    leg: {
      color: s => s < legHem ? tone(linen, .94) : pal.skin,
      inflate: s => s < legHem ? (proof === 'aerie' ? .024 : .036) * Math.sin(Math.max(0, s / legHem) * Math.PI) + .01 * Math.min(1, Math.max(0, (legHem - s) / (.025 * h))) : 0,
      bounds: [legHem], gatherHem: legHem, clothEnd:legHem,
    },
    hand: pal.skin, foot: { color: pal.skin, sole: look.footwear === 'none' ? pal.skin : pal.gearLeather },
    head: proofFace,
    shape: { upperBody: softUpperBody, hand: softHand, foot: softFoot, leg: softLeg },
    extras: (body, part) => {
      if (!part || part === 'top') chitonBodice(body);
      // Chiton split at front/back, following each thigh instead of bridging the saddle.
      if (!part || part === 'top') body.b.surface('linen', () => {
        const cuts = [[.04, Math.PI / 2 + .07], [Math.PI / 2 - .07, Math.PI - .04],
          [Math.PI + .04, Math.PI * 1.5 - .13], [Math.PI * 1.5 + .13, Math.PI * 2 - .04]];
        for (const [th0, th1] of cuts) skirtPanel(body, {
          th0, th1, yTop: 1.015 * h, yBot: (proof === 'aerie' ? .79 : .64) * h,
          inflate: .018, flare: .1, thickness: .004, follow: 1, cols: 6, rows: 5, roundHem: .022 * h,
          folds: .009, hemSlope: Math.sin(th0) > 0 ? .14 * h : -.06 * h,
          color: (u, v, inner) => tone(linen, (inner ? .86 : 1) * (1 - .045 * Math.pow(Math.sin(u * Math.PI * 3), 2))),
        });
      });
      if (drape && (!part || part === 'shoulderDrape')) body.b.surface('linen', () => {
        // An asymmetric fold turns over the left shoulder and crosses the front ribcage.
        const cowlTop = (u: number) => 1.44 - .035 * Math.sin(u * Math.PI);
        const cowlBottom = (u: number) => 1.40 - .19 * u - .035 * Math.sin(u * Math.PI);
        body.b.sheet(18, 6, (u, v, p, n) => {
          const th = .15 + u * 2.8;
          const top = cowlTop(u), bottom = cowlBottom(u);
          const y = (top + (bottom - top) * v) * h;
          const fold = .012 * Math.sin(v * Math.PI) * Math.cos(v * Math.PI * 4 + u * 3);
          const roll = .01 * Math.exp(-(((v - .12) / .12) ** 2));
          torsoPoint(body, y, th, .060 + fold + roll, p, n);
          p.x += Math.cos(th) * .035 * (1 - v);
        }, .006, (u, v) => {
          const top = cowlTop(u), y = (top + (cowlBottom(u) - top) * v) * h;
          return torsoSkin(body, y, torsoPoint(body, y, .15 + u * 2.8, 0, new Vector3()));
        }, (u, v, inner) => tone(linen, (inner ? .82 : 1) * (1 - .105 * Math.pow(Math.sin(v * Math.PI * 2 + u * 1.5), 6))));
        // The left upper-arm cloth follows the existing shoulder skinning. Avoid a rigid
        // floating shoulder flap when the reins/wave animation rotates the upper arm.
        // Aerie's rear fold is secured above the saddle, with a thick readable turned edge.
        torsoPanel(body, {
          yTop: 1.44 * h, yBot: (proof === 'aerie' ? 1.16 : 1.23) * h, th0: v => 3.4 + .45 * v, th1: v => 6.12 - .35 * v,
          inflate: .040, thickness: .006, folds: .014, cols: 8, rows: proof === 'aerie' ? 5 : 3,
          color: (u, v, inner) => tone(linen, (inner ? .84 : 1) * (.92 + .08 * Math.cos((u * 2 + v) * Math.PI))),
        });
      });
      // Four broad overlapping slate rows. Geometry gives the hem scallop and thickness.
      if (look.chest !== 'none' && (!part || part === 'chest')) body.b.surface('scale', () => {
        for (let row = 0; row < 4; row++) {
          const top = (1.34 - row * .055) * h;
          const low = top - .066 * h;
          for (let cell = 0; cell < 4; cell++) body.b.sheet(5, 2, (u, v, p, n) => {
            const th = .8 + (cell + u) * 1.55 / 4;
            const scallop = .024 * Math.sin(u * Math.PI) ** .75 * v * v;
            const bevel = .006 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
            torsoPoint(body, top + (low - top) * v - scallop, th, .034 + .010 * v + bevel, p, n);
          }, .004, (u, v) => {
            const y = top + (low - top) * v;
            const p = torsoPoint(body, y, .8 + (cell + u) * 1.55 / 4, 0, new Vector3());
            return torsoSkin(body, y, p);
          }, (u, v, inner) => tone(pal.gearScale, inner ? .8 : (1 - .055 * row + .015 * (cell % 2)) * (1 - .12 * v ** 4)));
        }
      });
      if (look.waist !== 'none' && (!part || part === 'waist')) body.b.surface('linen', () => {
        torsoBand(body, .985 * h, 1.075 * h, .028, (th, y) => tone(pal.secondary, .84 + .16 * Math.sin((y - .985 * h) / (.09 * h) * Math.PI + .3 * Math.sin(th * 2))), { bulge: 1.4 });
        // The knot is on the right outer hip; no loose tails in the flight conversion.
        const knot = torsoPoint(body, 1.025 * h, 2.45, .04, new Vector3());
        body.b.ellipsoid(knot, V(.025, .036, .025), sk(B.hips), pal.secondary, { lat: 6, lon: 10 });
        if (proof === 'aerie') {
          strap(body, torsoPath(body, [[1.035 * h, 2.45], [.99 * h, 2.7], [1.02 * h, 3.2]], .046), .022, .004, tone(pal.secondary, .9));
        }
      });
      // One flattened spiral brooch, with the only bronze emblem on the costume.
      if (drape && (!part || part === 'shoulderDrape')) body.b.surface('bronze', () => {
        const at = torsoPoint(body, 1.405 * h, .62, .1, new Vector3(), new Vector3());
        const normal = V(.55, .15, .82).normalize();
        const bronze = new Color('#AA8656');
        stud(body, at, normal, .025, bronze, sk(B.chest), .28);
        const rings: RingSpec[] = [];
        const tangent = new Vector3().crossVectors(Y, normal).normalize();
        const up = new Vector3().crossVectors(normal, tangent).normalize();
        for (let i = 0; i < 21; i++) {
          const t = i / 20, a = t * Math.PI * 3.2, r = .002 + .017 * t;
          rings.push({ c: at.clone().addScaledVector(normal, .01).addScaledVector(tangent, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r),
            ax: normal, ay: up, rx: .0022, ry: .0022, skin: sk(B.chest), color: tone(bronze, .68) });
        }
        body.b.loft(rings, 5, { capStart: true, capEnd: true });
      });
      wrapsAndSandals(body, proof, part);
    },
  };
}

function chitonNeck(th: number): number {
  return 1.425 - (Math.sin(th) >= 0 ? .09 : .045) * Math.abs(Math.sin(th));
}

/** Two restrained linen overlaps belong to the top, so removing armor/drape leaves a finished garment. */
function chitonBodice(ctx: BodyCtx): void {
  const { b, d, pal } = ctx, h = d.h;
  b.surface('linen', () => {
    for (const [start, end, lift] of [[.36, 2.22, .017], [Math.PI - .36, .92, .022]]) {
      const center = (v: number) => start + (end - start) * v;
      const width = (v: number) => .38 + .62 * v;
      torsoPanel(ctx, {
        yTop: 1.425 * h, yBot: 1.035 * h,
        th0: v => center(v) - width(v) / 2, th1: v => center(v) + width(v) / 2,
        inflate: lift, thickness: .0025, folds: .0035, cols: 5, rows: 7,
        color: (u, v, inner) => tone(pal.primary, inner ? .85 : .96 + .035 * Math.cos(u * Math.PI * 2 + v)),
      });
      // The turned edge is broad enough to read without embroidery or another material.
      strap(ctx, torsoPath(ctx, [[1.425 * h, start - .19], [1.23 * h, center(.5) - width(.5) / 2],
        [1.035 * h, end - .5]], lift + .005), .006, .002, tone(pal.primary, .89));
    }
  });
}

function wrapsAndSandals(ctx: BodyCtx, proof: RiderProof, part?: RiderGarmentSlot): void {
  const { b, d, pal, bp, look } = ctx;
  const leather = pal.gearLeather;
  for (const side of [1, -1] as const) {
    if (look.armWraps !== 'none' && (!part || part === 'armWraps')) b.surface('linen', () => {
      // Soft tapered forearm wraps; the actual Windline tool still mounts to its existing socket.
      for (let i = 0; i < 3; i++) {
        const s = (.36 + i * .04) * d.h;
        strap(ctx, wrapPath(ctx, side, s, .018, true), .014, .003, tone(pal.primary, .88 + i * .025));
      }
    });
    b.surface('leather', () => {
      // Calf wraps leave skin showing between broad diagonal straps.
      if (look.legWraps !== 'none' && (!part || part === 'legWraps')) for (let i = 0; i < 4; i++) {
        const s = (.49 + Math.floor(i / 2) * .14 + (i % 2 ? .12 : 0)) * d.h;
        strap(ctx, wrapPath(ctx, side, s, i % 2 ? -.12 : .12, false), .014, .003, leather);
      }
      if (look.footwear !== 'none' && (!part || part === 'footwear')) {
      const ft = side === 1 ? B.footL : B.footR, toe = side === 1 ? B.toeL : B.toeR;
      const ankle = side === 1 ? bp.footL : bp.footR;
      // Reinforced thin sole and heel, retaining the original toe/foot skinning contract.
      b.bar(V(ankle.x, .012, -.05), V(ankle.x, .012, .19), X, .052, .009, sk(ft), tone(leather, .65), { exp: 4, seg: 10 });
      for (const [z, y, width] of [[.125, .073, .05], [.025, .095, .043]]) {
        const points = Array.from({ length: 9 }, (_, i) => {
          const t = i / 8 * Math.PI;
          const p = V(ankle.x + Math.cos(t) * width, .035 + Math.sin(t) * (y - .035), z);
          return { p, n: V(Math.cos(t), Math.sin(t), 0), skin: z > .1 ? sk2(ft, toe, .6) : sk(ft) };
        });
        strap(ctx, points, .014, .003, leather);
      }
      // Tapered ankle keeper meets the calf straps and curves into the heel return.
      // It follows the existing ankle deformation; sole/toe geometry and contact frames stay fixed.
      const shin = side === 1 ? B.shinL : B.shinR, thigh = side === 1 ? bp.thighL : bp.thighR;
      b.loft([.104, .11, .126, .142, .148].map((y, i) => {
        const s = thigh.y - y * d.h, r = legSection(ctx,s,side), edge = i === 0 || i === 4 ? .002 : .005;
        return { c:r.c, ax: X, ay: Z,
          rx: r.rx + edge, ry: r.rf + edge, ryBack: r.rb + edge,
          skin:r.skin, color: tone(leather, i === 0 || i === 4 ? .8 : 1) };
      }), 14);
      }
      if (proof === 'aerie' && look.armWraps !== 'none' && (!part || part === 'armWraps')) {
        const s = side === 1 ? 'L' : 'R';
        const hand = bp[`hand${s}`];
        b.loft([0, .035].map(t => ({ c: hand.clone().add(V(0, -t, 0)), ax: X, ay: Z, rx: .024, ry: .036, skin: sk(B[`hand${s}`]), color: leather })), 12);
      }
    });
  }
}

function wrapPath(ctx: BodyCtx, side: 1 | -1, start: number, drop: number, arm: boolean) {
  const joint = arm ? side === 1 ? ctx.bp.upperArmL : ctx.bp.upperArmR : side === 1 ? ctx.bp.thighL : ctx.bp.thighR;
  const bone = arm ? side === 1 ? B.foreArmL : B.foreArmR : side === 1 ? B.shinL : B.shinR;
  const count=arm?9:13;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count-1), th = t * Math.PI * 2, s = start + drop * t;
    if(!arm)return legPoint(ctx,s,th,side,.004);
    const n = V(Math.cos(th), 0, Math.sin(th));
    const radius = arm ? ctx.armAt(s) : ctx.legAt(s);
    const depth = 'rz' in radius ? radius.rz : Math.sin(th) < 0 ? radius.rb : radius.rf;
    return { p: V(joint.x + n.x * (radius.rx + .007), joint.y - s, joint.z + n.z * (depth + .007)), n, skin: sk(bone) };
  });
}

export function proofHeadShape(u: Vector3): void {
  shapeHead(u);
  const jaw = Math.min(1, Math.max(0, (-u.y - .15) / .75));
  u.x *= 1 + .38 * jaw;
  // Brow, nasal bridge, muzzle and chin grow from the same surface as the cheeks.
  if (u.z > 0) {
    u.z += .045 * Math.exp(-((Math.abs(u.x) - .35) ** 2 / .065 + (u.y - .13) ** 2 / .025));
    u.z += .11 * Math.exp(-(u.x ** 2 / .018 + (u.y + .18) ** 2 / .13));
    u.z += .19 * Math.exp(-(u.x ** 2 / .012 + (u.y + .34) ** 2 / .026));
    u.z += .055 * Math.exp(-(u.x ** 2 / .11 + (u.y + .62) ** 2 / .06));
  }
}

/** The refined face is shared by every outfit; the C02 name is retained for development tooling. */
export function proofFace(ctx: BodyCtx): void {
  const { b, pal, head } = ctx, bone = sk(B.head);
  b.ellipsoid(head.center, head.radii, bone, u => {
    const cheek = .26 * Math.exp(-((Math.abs(u.x) - .55) ** 2 + (u.y + .3) ** 2 + (u.z - .8) ** 2) / .05);
    const socket = .28 * Math.exp(-((Math.abs(u.x) - .36) ** 2 / .024 + (u.y + .03) ** 2 / .014 + (u.z - .88) ** 2 / .1));
    return mixSrgb(mixSrgb(pal.skin, pal.blush, cheek), pal.skinShade, socket);
  }, { lat: 22, lon: 28, deform: proofHeadShape });
  const point = (x: number, y: number, lift = 0) => head.surface(V(x, y, Math.sqrt(Math.max(.02, 1 - x * x - y * y))), new Vector3(), lift);
  for (const side of [1, -1]) {
    const p = point(side * .36, -.04, .001);
    const rot = new Quaternion().setFromAxisAngle(Y, side * .28);
    // A horizontal eye opening, separate iris/pupil, and shaped upper/lower lids.
    b.ellipsoid(p, V(.0175, .007, .0045), bone, mixSrgb(pal.skin, new Color('#FAF8F3'), .85), { rot, lat: 6, lon: 12 });
    b.ellipsoid(p.clone().add(V(-side * .002, 0, .004)), V(.0068, .0066, .0025), bone, new Color('#66513B'), { rot, lat: 6, lon: 10 });
    b.ellipsoid(p.clone().add(V(-side * .002, 0, .006)), V(.0034, .0048, .0015), bone, pal.eye, { rot, lat: 5, lon: 8 });
    b.ellipsoid(p.clone().add(V(-.003, .003, .009)), V(.0025, .0025, .001), bone, pal.eyeShine, { lat: 4, lon: 6, glow: .05 });
    for (const top of [true, false]) {
      const rings = Array.from({ length: 9 }, (_, i): RingSpec => {
        const t = i / 8, x = -.018 + .036 * t;
        return { c: p.clone().add(V(x, Math.sin(t * Math.PI) * (top ? .007 : -.006), .0025 - Math.abs(x) * .2)),
          ax: Y, ay: Z, rx: top ? .002 : .0015, ry: .0025, skin: bone, color: top ? tone(pal.skin, .6) : tone(pal.skin, .88) };
      });
      b.loft(rings, 6, { capStart: true, capEnd: true });
    }
    const brow = Array.from({ length: 5 }, (_, i) => point(side * (.15 + .43 * i / 4), .13 + .045 * Math.sin(i / 4 * Math.PI), .002));
    b.loft(brow.map((c, i) => ({ c, ax: Y, ay: Z, rx: i === 4 ? .0013 : .0027, ry: .002, skin: bone, color: pal.brow })), 6, { capStart: true, capEnd: true });
    b.ellipsoid(head.surface(V(side, -.12, -.08), new Vector3()).add(V(-side * .004, 0, 0)), V(.011, .027, .019), bone, pal.skinShade, { lat: 6, lon: 8 });
  }
  // Nasal bridge and tip are part of the head mesh; only the soft nostril recesses sit on it.
  for (const side of [1, -1]) b.ellipsoid(point(side * .075, -.39, .0005), V(.003, .0018, .0015), bone, tone(pal.skinShade, .9), { lat: 4, lon: 6 });
  const mouth = point(0, -.58, .001);
  b.loft(Array.from({ length: 5 }, (_, i) => {
    const x = -.23 + i * .115;
    return { c: point(x, -.58 + .025 * (x / .23) ** 2, .001), ax: Y, ay: Z,
      rx: .0012, ry: .0015, skin: bone, color: pal.lip };
  }), 6, { capStart: true, capEnd: true, capBulge: .1 });
  b.ellipsoid(mouth.clone().add(V(0, -.004, 0)), V(.013, .002, .002), bone, mixSrgb(pal.skin, pal.lip, .25), { lat: 4, lon: 8 });
}

/** The ground drape and sash use the existing solver. Aerie secures both in skinned geometry. */
export function proofClothSpecs(ctx: BodyCtx, proof: RiderProof): ClothSpec[] {
  const { d, pal, look } = ctx;
  const specs = [...hairSpecs(ctx, look), ...scarfSpecs(ctx, look), ...capeSpecs(ctx, look)]
    .map(spec => ({ ...spec, config: { ...spec.config, contactFriction: .12 } }));
  if (proof === 'aerie') return specs;
  if (look.cape === 'none' && look.shoulderDrape !== 'none') {
    const cols = 5, rows = 6, rest: Vector3[] = [], anchorBone: number[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1), v = r / (rows - 1);
      rest.push(V((.17 - .33 * u - .07 * v) * d.w,
        (1.405 - .025 * Math.sin(u * Math.PI) - (.37 + .17 * (1 - u)) * v) * d.h,
        -.12 - .025 * Math.sin(u * Math.PI * 3) - .04 * v));
      anchorBone.push(r === 0 ? B.chest : -1);
    }
    specs.push({ name: 'c02-chlamys', cols, rows, rest, anchorBone,
      config: { drag: .8, dragTangent: .2, dragQuad: .35, damping: 2, bend: .6, iterations: 5, radius: .018, flutter: 9, flutterHz: 2.2,
        dragLow: .65, flutterFloor: .12, contactFriction: .12 },
      colliders: ['chest', 'belly', 'shoulders', 'armL', 'armR', 'mount'],
      render: { kind: 'sheet', color: pal.primary, trim: tone(pal.primary, .88), pattern: 'plain', subdiv: 2, proofLinen: true } });
  }
  if (look.waist === 'none') return specs;
  const rest: Vector3[] = [], anchorBone: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
    rest.push(V(-.21 + c * .08 - .012 * r, (1.015 - .065 * r) * d.h, .11 + .005 * r));
    anchorBone.push(r === 0 ? B.hips : -1);
  }
  specs.push({ name: 'c02-sash', cols: 2, rows: 5, rest, anchorBone,
    config: { drag: .6, dragTangent: .2, dragQuad: .3, damping: 2, bend: .5, iterations: 4, radius: .014, flutter: 8, flutterHz: 2.4,
      dragLow: .65, flutterFloor: .12, contactFriction: .12 },
    colliders: ['belly', 'thighL', 'thighR', 'mount'],
    render: { kind: 'sheet', color: pal.secondary, trim: tone(pal.secondary, .9), pattern: 'plain', subdiv: 2, minWidth: .055, twist: .2, proofLinen: true } });
  return specs;
}
