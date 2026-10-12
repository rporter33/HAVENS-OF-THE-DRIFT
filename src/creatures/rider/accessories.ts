// Scarves, capes, coat tails and hair that move: the static parts (the scarf wrapped around the
// neck) go into the skinned mesh; the moving parts are described as cloth specs (rest shape in
// bind space, which bone pins each anchored particle, simulation feel and how to draw it).

import { Color, Vector3 } from 'three';
import type { RiderLook } from '../../core/types';
import { B } from './rig';
import { sk2, type RingSpec, type SkinSpec } from './meshKit';
import { torsoPoint, type BodyCtx } from './body';
import { hairRoots, hairThickness } from './hair';
import { mixSrgb, tone } from './palette';
import type { ClothConfig } from './cloth';

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

export type ClothPattern = 'plain' | 'tattered' | 'feather' | 'hair' | 'scarf' | 'tail' | 'braid' | 'coat' | 'garment';

/** Colliders the rider exposes (see Rider.ts); cloth picks a subset by name. */
export type ColliderName = 'chest' | 'belly' | 'shoulders' | 'armL' | 'armR' | 'foreArmL' | 'foreArmR' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'head' | 'neck' | 'mount';

export interface ClothSpec {
  name: string;
  cols: number;
  rows: number;
  /** Rest positions in bind space, row-major. */
  rest: Vector3[];
  /** Bone pinning each anchored particle (−1 = free). */
  anchorBone: number[];
  /** Animated rest envelope for localized clothing; free particles still simulate wind/inertia. */
  guideSkin?: SkinSpec[];
  config: Omit<ClothConfig, 'cols' | 'rows' | 'rest' | 'pinned'>;
  colliders: ColliderName[];
  render: {
    kind: 'sheet' | 'tube';
    color: Color;
    trim: Color;
    pattern: ClothPattern;
    /** Tube radius from root (t = 0) to tip (t = 1). */
    radius?: (t: number) => number;
    /** Visual subdivisions per particle span. */
    subdiv?: number;
    /**
     * Ribbons (two columns): a twist (radians) built up along the length so the face shows
     * from any side instead of a string edge-on, and a minimum drawn width (m).
     */
    twist?: number;
    minWidth?: number;
    /** C02 only: shared M01 linen map, without changing the cloth solver. */
    proofLinen?: boolean;
    /** Preserve the source garment's cloth/trim colors and dye recipes on the smoothed mesh. */
    colorAt?: (u: number, v: number) => Color;
  };
}

const SHEET: ClothSpec['config'] = {
  drag: 0.9,
  dragTangent: 0.15,
  dragQuad: 0.5,
  damping: 0.6,
  bend: 0.35,
  iterations: 4,
  radius: 0.022,
  flutter: 26,
  flutterHz: 2.6,
};

export const RIBBON: ClothSpec['config'] = {
  drag: 0.9,
  dragTangent: 0.25,
  dragQuad: 0.55,
  damping: 0.5,
  bend: 0.3,
  iterations: 3,
  radius: 0.016,
  flutter: 40,
  flutterHz: 3.4,
  // A jog shouldn't hold the scarf out like a rod: half the drag on foot, and a gentle ripple.
  dragLow: 0.45,
  flutterFloor: 0.16,
};

const HAIR: ClothSpec['config'] = {
  drag: 0.6,
  dragTangent: 1,
  dragQuad: 0.3,
  damping: 2.2,
  bend: 0.55,
  iterations: 4,
  radius: 0.03,
  flutter: 10,
  flutterHz: 2.2,
  gravity: 0.8,
};

// --- Static neckwear ------------------------------------------------------------------------

/** The scarf wrapped around the neck (static, skinned). */
export function buildNeckwear(ctx: BodyCtx, look: RiderLook): void {
  if (look.scarf === 'none') return;
  const { b, d, pal } = ctx;
  const scarf = pal.scarf;
  const short = look.scarf === 'short';
  const n = 6;
  const rings: RingSpec[] = [];
  const y0 = 1.415 * d.h;
  const h = (short ? 0.05 : 0.085) * d.h;
  const bulk = short ? 0.016 : 0.03;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const y = y0 + h * f;
    const r = (0.06 * d.g + 0.012) + bulk * Math.sin(f * Math.PI) + (1 - f) * 0.014;
    rings.push({
      c: new Vector3(0, y, -0.014 + 0.012 * f),
      ax: X,
      ay: Z,
      rx: r * 1.12,
      ry: r,
      // Folds: a soft twist around the wrap.
      radial: (th) => 1 + 0.07 * Math.sin(th * 3 + f * 5) * Math.sin(f * Math.PI),
      skin: sk2(B.chest, B.neck, 0.15 + 0.55 * f),
      color: (th) => tone(scarf, 0.92 + 0.12 * Math.sin(th * 3 + f * 5)),
    });
  }
  const inner = rings
    .slice()
    .reverse()
    .map((r) => ({ ...r, rx: r.rx - 0.012, ry: r.ry - 0.012, radial: undefined, color: tone(scarf, 0.7) }));
  b.loft([...rings, ...inner], 22);
  if (short) {
    // Neckerchief: a triangular bib over the chest and a knot.
    b.sheet(
      4,
      4,
      (u, v, p, nn) => {
        const w = (1 - v) * 0.11 * d.w;
        const y = 1.42 * d.h - v * 0.13 * d.h;
        const th = Math.PI / 2 + (u - 0.5) * 2 * (w / 0.12);
        torsoPoint(ctx, Math.max(y, 1.2 * d.h), th, 0.016 + 0.004 * (1 - v), p, nn);
        p.y = y;
      },
      0.006,
      () => sk2(B.chest, B.neck, 0.1),
      (u, v, inner) => (inner ? tone(scarf, 0.7) : v > 0.8 ? tone(scarf, 0.9) : scarf),
    );
    const k = new Vector3(-0.05 * d.w, 1.43 * d.h, 0.085 * d.g + 0.01);
    b.ellipsoid(k, new Vector3(0.024, 0.02, 0.018), sk2(B.chest, B.neck, 0.3), tone(scarf, 0.95), { lat: 6, lon: 8 });
  } else {
    // A knot at the back where the tails leave.
    for (const s of look.scarf === 'twin' ? [1, -1] : [1]) {
      const k = new Vector3(s * 0.05 * d.w, 1.45 * d.h, -0.075 * d.g - 0.012);
      b.ellipsoid(k, new Vector3(0.03, 0.026, 0.022), sk2(B.chest, B.neck, 0.3), tone(scarf, 0.95), { lat: 6, lon: 8 });
    }
  }
}

// --- Cloth specs ----------------------------------------------------------------------------

/** A ribbon (two particles wide) hanging from a pinned pair. */
function ribbon(
  name: string,
  root: Vector3,
  across: Vector3,
  hang: Vector3,
  width: number,
  rows: number,
  seg: number,
  bone: number,
  color: Color,
  trim: Color,
  extra: Partial<ClothSpec['config']> = {},
  draw: { twist: number; minWidth: number } = { twist: 1.1, minWidth: 0.12 },
): ClothSpec {
  const rest: Vector3[] = [];
  const anchorBone: number[] = [];
  const h = hang.clone().normalize();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      rest.push(root.clone().addScaledVector(across, (c - 0.5) * width).addScaledVector(h, r * seg));
      anchorBone.push(r === 0 ? bone : -1);
    }
  }
  return {
    name,
    cols: 2,
    rows,
    rest,
    anchorBone,
    config: { ...RIBBON, ...extra },
    colliders: ['chest', 'shoulders', 'armL', 'armR', 'head', 'neck', 'belly', 'thighL', 'thighR', 'mount'],
    render: { kind: 'sheet', color, trim, pattern: 'scarf', subdiv: 3, twist: draw.twist, minWidth: draw.minWidth },
  };
}

export function scarfSpecs(ctx: BodyCtx, look: RiderLook): ClothSpec[] {
  const { d, pal } = ctx;
  const scarf = pal.scarf;
  const trim = mixSrgb(scarf, new Color('#fff2d8'), 0.45);
  switch (look.scarf) {
    case 'long': {
      const root = new Vector3(0.05 * d.w, 1.445 * d.h, -0.085 * d.g - 0.02);
      return [ribbon('scarf', root, new Vector3(1, 0, 0.25).normalize(), new Vector3(0.05, -1, -0.12), 0.1, 13, 0.1, B.chest, scarf, trim)];
    }
    case 'twin': {
      return [1, -1].map((s, i) =>
        ribbon(
          `scarf${i}`,
          new Vector3(s * 0.055 * d.w, 1.445 * d.h, -0.085 * d.g - 0.02),
          new Vector3(1, 0, s * 0.25).normalize(),
          new Vector3(s * 0.05, -1, -0.12),
          0.075,
          i === 0 ? 13 : 12,
          0.1,
          B.chest,
          scarf,
          trim,
          { flutterPhase: i * Math.PI * 0.85, flutterHz: 3.1 + i * 0.4 },
          { twist: i === 0 ? 1.0 : -1.0, minWidth: 0.1 },
        ),
      );
    }
    case 'short': {
      const root = new Vector3(-0.055 * d.w, 1.42 * d.h, 0.085 * d.g + 0.025);
      return [0, 1].map((i) =>
        ribbon(
          `kerchief${i}`,
          root.clone().add(new Vector3(i * -0.02, -0.005 * i, 0)),
          new Vector3(1, 0, 0),
          new Vector3(-0.25 - i * 0.3, -1, 0.2),
          0.05,
          4,
          0.065,
          B.chest,
          scarf,
          trim,
          { flutter: 30, flutterHz: 4.5, flutterPhase: i * 2 },
          { twist: 0.5, minWidth: 0.06 },
        ),
      );
    }
    default:
      return [];
  }
}

/** A sheet hanging from an arc of anchor points (capes, coat tails, long hair). */
function sheetFrom(
  name: string,
  top: Vector3[],
  hang: (c: number, r: number, topPoint: Vector3) => Vector3,
  rows: number,
  bone: number | ((c: number) => number),
  config: ClothSpec['config'],
  colliders: ColliderName[],
  render: ClothSpec['render'],
): ClothSpec {
  const cols = top.length;
  const rest: Vector3[] = [];
  const anchorBone: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rest.push(r === 0 ? top[c].clone() : hang(c, r, top[c]));
      anchorBone.push(r === 0 ? (typeof bone === 'function' ? bone(c) : bone) : -1);
    }
  }
  return { name, cols, rows, rest, anchorBone, config, colliders, render };
}

export function capeSpecs(ctx: BodyCtx, look: RiderLook): ClothSpec[] {
  const { d, pal } = ctx;
  if (look.cape === 'none') return [];
  const cape = pal.cape;
  const trim = look.cape === 'feathered' ? mixSrgb(cape, new Color('#fff4dc'), 0.35) : mixSrgb(pal.secondary, cape, 0.25);
  const half = look.cape === 'half';
  const cols = half ? 5 : 8;
  // Anchor arc from shoulder to shoulder around the back of the neck (half cape: from behind the
  // neck over the left shoulder to the chest).
  const y = 1.418 * d.h;
  const W = (ctx.bp.upperArmL.x - 0.012) * 1.0;
  const D = 0.085 * d.g;
  const z0 = -0.012;
  const top: Vector3[] = [];
  const phi0 = half ? -0.55 : -0.12;
  const phi1 = half ? Math.PI / 2 + 0.35 : Math.PI + 0.12;
  for (let c = 0; c < cols; c++) {
    const phi = phi0 + ((phi1 - phi0) * c) / (cols - 1);
    const sx = Math.cos(phi);
    const sz = Math.sin(phi);
    // Behind (sz > 0 here means toward the back); in front for the half cape's chest end.
    top.push(new Vector3(sx * W * (sz > -0.2 ? 1 : 0.85), y + 0.012 * (1 - Math.abs(sx)) - 0.01 * Math.max(0, -sz), z0 - sz * D));
  }
  const length = { half: 0.72, full: 1.22, tattered: 1.1, feathered: 0.95 }[look.cape] ?? 1.1;
  const rows = half ? 7 : look.cape === 'feathered' ? 9 : 10;
  const seg = (length * d.h) / (rows - 1);
  const flare = half ? 0.25 : 0.45;
  const back = -0.11 * d.g;
  const hang = (c: number, r: number, tp: Vector3) => {
    const f = r / (rows - 1);
    // Down over the shoulder blades, a little away from the back, widening toward the hem.
    const out = Math.min(1, r / 2);
    return new Vector3(tp.x * (1 + flare * f), tp.y - r * seg, Math.min(tp.z, back) * out + tp.z * (1 - out) - 0.035 * out - 0.05 * f);
  };
  const config: ClothSpec['config'] =
    look.cape === 'feathered'
      ? { ...SHEET, drag: 1.8, flutter: 14, bend: 0.5, damping: 0.8 }
      : look.cape === 'tattered'
        ? { ...SHEET, flutter: 34, flutterHz: 3 }
        : half
          ? { ...SHEET, flutter: 30, flutterHz: 3 }
          : SHEET;
  const pattern = look.cape === 'tattered' ? 'tattered' : look.cape === 'feathered' ? 'feather' : 'plain';
  return [
    sheetFrom(
      'cape',
      top,
      hang,
      rows,
      (c) => {
        const x = top[c].x / W;
        return x > 0.6 ? B.clavL : x < -0.6 ? B.clavR : B.chest;
      },
      config,
      ['chest', 'belly', 'shoulders', 'armL', 'armR', 'thighL', 'thighR', 'shinL', 'shinR', 'head', 'neck', 'mount'],
      { kind: 'sheet', color: cape, trim, pattern, subdiv: 3 },
    ),
  ];
}

export function coatSpecs(ctx: BodyCtx, look: RiderLook): ClothSpec[] {
  if (look.outfit !== 'courier') return [];
  const { d, pal } = ctx;
  const out: ClothSpec[] = [];
  const y = 0.99 * d.h;
  const rows = 6;
  const yBot = 0.42 * d.h;
  const seg = (y - yBot) / (rows - 1);
  for (const s of [1, -1]) {
    const top: Vector3[] = [];
    const cols = 4;
    for (let c = 0; c < cols; c++) {
      // From beside the back seam out to the side of the hip.
      const th = -Math.PI / 2 + s * (0.06 + (1.05 * c) / (cols - 1));
      top.push(torsoPoint(ctx, y, th, 0.024, new Vector3()));
    }
    out.push(
      sheetFrom(
        `coat${s > 0 ? 'L' : 'R'}`,
        top,
        (c, r, tp) => {
          const f = r / (rows - 1);
          const dir = new Vector3(tp.x, 0, tp.z).normalize();
          return new Vector3(tp.x + dir.x * 0.06 * f, tp.y - r * seg, tp.z + dir.z * 0.06 * f - 0.03 * f);
        },
        rows,
        B.hips,
        { ...SHEET, drag: .4, dragQuad:.18, flutter: 4, bend: .65, damping: 5.5, radius: .009,
          contactFriction:.2, poseStiffness:110, poseRadius:.055*d.h },
        ['belly', 'thighL', 'thighR', 'shinL', 'shinR', 'mount'],
        { kind: 'sheet', color: pal.primary, trim: pal.primaryDark, pattern: 'coat', subdiv: 3,proofLinen:true },
      ),
    );
  }
  for (const piece of out) piece.guideSkin=piece.rest.map((_,i)=>{
    const v=Math.floor(i/piece.cols)/(piece.rows-1),k=.45*v*v;
    return [B.hips,1-k,piece.name==='coatL'?B.thighL:B.thighR,k];
  });
  return out;
}

export function hairSpecs(ctx: BodyCtx, look: RiderLook): ClothSpec[] {
  const { pal, head } = ctx;
  if (look.headgear === 'hood') return [];
  const hair = pal.hair;
  const dark = tone(hair, 0.75);
  const roots = hairRoots(ctx, look);
  const colliders: ColliderName[] = ['head', 'neck', 'shoulders', 'chest', 'mount'];
  if (look.hair === 'ponytail') {
    const r = roots[0];
    const rows = 7;
    const seg = 0.06;
    const rest: Vector3[] = [];
    const anchorBone: number[] = [];
    for (let i = 0; i < rows; i++) {
      // Arc down the back of the head.
      const dir = r.dir.clone().lerp(new Vector3(0, -1, -0.2).normalize(), Math.min(1, i / 3)).normalize();
      rest.push(i === 0 ? r.p.clone() : rest[i - 1].clone().addScaledVector(dir, seg));
      anchorBone.push(i <= 1 ? B.head : -1);
    }
    return [
      {
        name: 'ponytail',
        cols: 1,
        rows,
        rest,
        anchorBone,
        config: HAIR,
        colliders,
        render: { kind: 'tube', color: hair, trim: dark, pattern: 'tail', radius: (t) => 0.024 + 0.016 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.8) - 0.03 * t * t, subdiv: 4 },
      },
    ];
  }
  if (look.hair === 'braids') {
    return roots.map((r, k) => {
      const rows = 7;
      const seg = 0.052;
      const rest: Vector3[] = [];
      const anchorBone: number[] = [];
      for (let i = 0; i < rows; i++) {
        rest.push(r.p.clone().addScaledVector(r.dir, i * seg));
        anchorBone.push(i === 0 ? B.head : -1);
      }
      return {
        name: `braid${k}`,
        cols: 1,
        rows,
        rest,
        anchorBone,
        config: { ...HAIR, drag: 1.1, damping: 1.8 },
        colliders,
        render: { kind: 'tube', color: hair, trim: pal.secondary, pattern: 'braid', radius: (t: number) => 0.017 - 0.006 * t, subdiv: 4 },
      } satisfies ClothSpec;
    });
  }
  if (look.hair === 'long') {
    const cols = 6;
    const rows = 6;
    const t = hairThickness('long');
    const top: Vector3[] = [];
    for (let c = 0; c < cols; c++) {
      const phi = 1.55 + ((2 * Math.PI - 3.1) * c) / (cols - 1);
      top.push(head.surface(new Vector3(Math.sin(phi), -0.05 - 0.22 * Math.abs(Math.cos(phi)), Math.cos(phi)), new Vector3(), t * 0.6));
    }
    const seg = 0.085;
    return [
      sheetFrom(
        'longHair',
        top,
        (c, r, tp) => {
          const out = tp.clone().sub(head.center).setY(0).normalize();
          return tp.clone().add(new Vector3(out.x * 0.03 * r, -r * seg, out.z * 0.03 * r - 0.012 * r));
        },
        rows,
        B.head,
        { ...HAIR, dragTangent: 0.4, bend: 0.5, radius: 0.025, flutter: 16 },
        colliders,
        { kind: 'sheet', color: hair, trim: dark, pattern: 'hair', subdiv: 3 },
      ),
    ];
  }
  return [];
}

export function allClothSpecs(ctx: BodyCtx, look: RiderLook): ClothSpec[] {
  return [...hairSpecs(ctx, look), ...scarfSpecs(ctx, look), ...capeSpecs(ctx, look), ...coatSpecs(ctx, look)];
}
