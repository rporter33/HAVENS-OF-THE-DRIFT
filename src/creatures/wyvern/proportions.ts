// Per-breed body plans. Everything the model builder and the animator need to know about a
// breed's shape lives here as plain numbers, so it can be unit-tested without WebGL.
//
// The two numbers the rest of the game relies on are honored exactly:
//   - BreedStats.wingspan is the tip-to-tip distance of the fully spread (bind) pose. The wing's
//     bones are sized to the body (WingShape.armLength) but for the wingtip finger's outer
//     phalanx, which is solved until the wingtips land at the span (A13).
//   - BreedStats.standHeight: the legs are sized so that, in the natural standing pose with the
//     body center that high, the soles of the feet rest on the ground.
//
// Body frame (see core/types.ts): +Z forward, +Y up, +X left. The origin is the body center.

import type { BreedId } from '../../core/types';
import { BREEDS } from '../../flight/breeds';
import { DEG } from '../../core/math';

export interface WingShape {
  /**
   * The arm's length, humerus plus forearm (m). It belongs to the body, not the span (A13): every
   * wing bone is sized with it (the ratios below are in its unit) except the wingtip finger's outer
   * phalanx, which is solved so the span comes out right. So a bigger wing folds to the same arm
   * (the wrist under the shoulder, the elbow at the flank, clear of the thigh) and finger bundle,
   * with a longer spar back along the body.
   */
  armLength: number;
  /** Bone length ratios: the arm, the metacarpal, and each finger's segments [proximal, distal]
   * (finger 0 forms the wingtip, 2 is innermost). Finger 0's distal is solved for the span, so its
   * ratio here is not used. */
  humerus: number;
  forearm: number;
  hand: number;
  fingers: [number, number][];
  /** Bind-pose azimuths (radians, measured from +X toward +Z: negative = swept back). */
  azHumerus: number;
  azForearm: number;
  azHand: number;
  azFingers: number[];
  /** Where the inner trailing edge meets the flank, as a fraction of torso length (− = back). */
  trailZ: number;
  /** Depth of the scalloped trailing edge between finger tips (fraction of the gap). */
  scallop: number;
  /**
   * The inner panel's (arm, finger 2 and flank) scallop, when it differs from the outer panels'
   * (Q40: the outer panels fill out; the inner one, which folds against the body, keeps its cut).
   */
  scallopInner?: number;
}

export interface BreedShape {
  torsoLength: number;
  torsoHalfWidth: number;
  torsoHalfHeight: number;
  /** Extra depth of the chest keel below the torso (m). */
  keel: number;
  neckLength: number;
  neckBaseRadius: number;
  neckTopRadius: number;
  /** Bind-pose rise of the neck above horizontal (radians). */
  neckRise: number;
  headLength: number;
  headHalfWidth: number;
  headHalfHeight: number;
  tailLength: number;
  tailBaseRadius: number;
  /** Shoulder joint: x as a fraction of torso half-width, y of half-height, z of torso length. */
  shoulder: [number, number, number];
  hip: [number, number, number];
  wing: WingShape;
  /** Bind-pose leg angles from vertical (radians, + = the lower end forward). */
  legAngles: LegAngles;
  /** Leg ratios; the leg unit is solved from standHeight. */
  thigh: number;
  shin: number;
  meta: number;
  /** Toe length as a fraction of the leg unit. */
  toe: number;
  /** Thigh radius at the hip (m). */
  thighRadius: number;
  /** Extra girth of the arm, hand and digits (the heavy-boned breed); 1 = none. */
  armBulk?: number;
  /** Eye radius as a fraction of head length. */
  eye: number;
  /** Overlapping armor plates down the back (ironback). */
  plates: boolean;
  /** The head's sculpting (a head style, see HEAD_STYLES); absent: the plain loft. */
  head?: HeadProfile;
}

/** How a head style sculpts the skull loft (parts/head.ts); 1 = the plain loft. */
export interface HeadProfile {
  /** Snout breadth and depth forward of the eye (a blunter, deeper muzzle above 1). */
  blunt: number;
  /** The brow ledge over the eye: its height and how far it juts. */
  brow: number;
  /** The jaw muscle bulging behind and below the eye. */
  cheek: number;
  /** The crown's rise between the eyes and over the back of the skull. */
  crown: number;
  /** Peg teeth (the ironback's crocodilian row) instead of recurved ones. */
  pegTeeth: boolean;
}

/**
 * Head styles (the wyvernHead cosmetic): any mount can wear any of them. A style's skull is sized
 * from the wearer's own head length (× size) with the style's own breadth and depth for that
 * length, so a head keeps its character on a smaller or a bigger body. 'native' is the breed's own.
 */
export type HeadId = 'harrier' | 'skimmer' | 'galewing' | 'ironback' | 'drake';
export interface HeadStyle {
  size: number;
  /** Half-width and half-height as fractions of the head's length. */
  width: number;
  height: number;
  /** Eye radius as a fraction of head length. */
  eye: number;
  profile: HeadProfile;
}
export const HEAD_STYLES: Record<HeadId, HeadStyle> = {
  // The breeds' heads. The harrier's is pronounced (G3, 2026-10-18: Robert asked for a more
  // pronounced, characterful head): a little bigger and deeper, a heavier brow and jaw muscle.
  harrier: { size: 1.06, width: 0.345, height: 0.345, eye: 0.095, profile: { blunt: 1.04, brow: 1.35, cheek: 1.6, crown: 1.08, pegTeeth: false } },
  skimmer: { size: 1, width: 0.35 / 1.12, height: 0.33 / 1.12, eye: 0.12, profile: { blunt: 1, brow: 1, cheek: 1, crown: 1, pegTeeth: false } },
  galewing: { size: 1, width: 0.31 / 1.45, height: 0.34 / 1.45, eye: 0.098, profile: { blunt: 1, brow: 1, cheek: 1, crown: 1, pegTeeth: false } },
  ironback: { size: 1, width: 0.66 / 1.55, height: 0.54 / 1.55, eye: 0.078, profile: { blunt: 1.12, brow: 1, cheek: 1, crown: 1, pegTeeth: true } },
  // A short, deep head with a heavy brow ledge and a broad jaw: the most expressive face.
  drake: { size: 0.97, width: 0.4, height: 0.41, eye: 0.105, profile: { blunt: 1.1, brow: 1.5, cheek: 1.8, crown: 1.12, pegTeeth: false } },
};
export const HEAD_IDS = Object.keys(HEAD_STYLES) as HeadId[];

/** The head style a look's head id names ('native' or an unknown id: the breed's own). */
export function headStyleId(breed: BreedId, head: string | undefined): HeadId {
  return head && head !== 'native' && head in HEAD_STYLES ? (head as HeadId) : breed;
}

/** The breed's shape wearing a head style: head length, breadth, depth, eye and profile replaced. */
export function shapeWithHead(breed: BreedId, head: HeadId): BreedShape {
  const s = BREED_SHAPES[breed];
  const h = HEAD_STYLES[head];
  const L = s.headLength * h.size;
  return { ...s, headLength: L, headHalfWidth: h.width * L, headHalfHeight: h.height * L, eye: h.eye, head: h.profile };
}

export interface LegAngles {
  thigh: number;
  shin: number;
  /** The metatarsus: steep on a runner, near flat on the plantigrade-leaning ironback. */
  meta: number;
}

/**
 * Bind-pose leg angles from vertical (radians, + = the lower end forward) of the default
 * (harrier) leg. Each breed has its own in BreedShape.legAngles, which the leg IK should read.
 */
export const LEG_ANGLES: Readonly<LegAngles> = { thigh: 30 * DEG, shin: -40 * DEG, meta: 24 * DEG };

/**
 * Deeper membranes (Robert, 2026-10-18, Q40: "I like the flight stats but I think deeper wings are
 * good"): the middle finger is a fifth longer and the outer panels' trailing edges sag a fifth as
 * far between the fingers, so the spread wing reads as the target renders' broad sail (the
 * harrier's membranes 24.1 m² → 26.8 m², visual aspect ratio 9.9 → 9.0). Visual only: the flight
 * model's span and area (flight/breeds.ts) are unchanged, and the span stays the breed's (finger
 * 0's outer phalanx is solved for it). The inner panel and finger 2, which fold against the body,
 * keep their cut: deepening them put the folded membrane 2 to 9 cm into the flank when kneeling,
 * and finger 1 beyond 1.2× put the skimmer's into its thigh standing (wyvern.ground.test.ts).
 */
export const WING_DEPTH = { finger1: 1.2, outerScallop: 0.2 } as const;

/** A wing with WING_DEPTH applied (see above). */
function deepen(w: WingShape): WingShape {
  return {
    ...w,
    fingers: w.fingers.map(([a, b], i) => (i === 1 ? [a * WING_DEPTH.finger1, b * WING_DEPTH.finger1] : [a, b])) as [number, number][],
    scallop: w.scallop * WING_DEPTH.outerScallop,
    scallopInner: w.scallop,
  };
}

const W = (w: Partial<WingShape> & Pick<WingShape, 'armLength'>): WingShape => deepen({
  humerus: 0.22,
  forearm: 0.36,
  hand: 0.075,
  fingers: [
    [0.235, 0.2],
    [0.225, 0.19],
    [0.205, 0.175],
  ],
  azHumerus: -16 * DEG,
  azForearm: 14 * DEG,
  azHand: -4 * DEG,
  azFingers: [-10 * DEG, -47 * DEG, -86 * DEG],
  trailZ: -0.52,
  scallop: 0.16,
  ...w,
});

export const BREED_SHAPES: Record<BreedId, BreedShape> = {
  harrier: {
    torsoLength: 3.6,
    torsoHalfWidth: 0.8,
    torsoHalfHeight: 0.92,
    keel: 0.34,
    neckLength: 2.25,
    neckBaseRadius: 0.7,
    neckTopRadius: 0.38,
    neckRise: 28 * DEG,
    headLength: 1.32,
    headHalfWidth: 0.44,
    headHalfHeight: 0.42,
    tailLength: 4.4,
    tailBaseRadius: 0.62,
    shoulder: [0.62, 0.28, 0.3],
    hip: [0.74, -0.3, -0.33],
    wing: W({ armLength: 3.27 }),
    legAngles: { ...LEG_ANGLES },
    thigh: 0.36,
    shin: 0.38,
    meta: 0.26,
    toe: 0.2,
    thighRadius: 0.52,
    eye: 0.095,
    plates: false,
  },
  skimmer: {
    torsoLength: 2.3,
    torsoHalfWidth: 0.54,
    torsoHalfHeight: 0.62,
    keel: 0.2,
    neckLength: 1.9,
    neckBaseRadius: 0.46,
    neckTopRadius: 0.28,
    neckRise: 30 * DEG,
    headLength: 1.12,
    headHalfWidth: 0.35,
    headHalfHeight: 0.33,
    tailLength: 3.2,
    tailBaseRadius: 0.44,
    // The short sprinter's torso puts the wing roots close to the rider's feet: the shoulder
    // joints sit a little further forward in the girdle.
    shoulder: [0.62, 0.28, 0.33],
    hip: [0.74, -0.3, -0.33],
    // A sprinter's broad, rounded bat-like hand-wing: short, even inner fingers fanned wide.
    wing: W({
      armLength: 3.04,
      fingers: [
        [0.2, 0.17],
        [0.21, 0.18],
        [0.2, 0.17],
      ],
      azFingers: [0 * DEG, -42 * DEG, -88 * DEG],
      scallop: 0.2,
      trailZ: -0.7,
    }),
    legAngles: { ...LEG_ANGLES },
    thigh: 0.36,
    shin: 0.4,
    meta: 0.33,
    toe: 0.22,
    thighRadius: 0.33,
    eye: 0.12,
    plates: false,
  },
  galewing: {
    torsoLength: 3.1,
    torsoHalfWidth: 0.58,
    torsoHalfHeight: 0.68,
    keel: 0.26,
    neckLength: 2.8,
    neckBaseRadius: 0.5,
    neckTopRadius: 0.29,
    neckRise: 24 * DEG,
    headLength: 1.45,
    headHalfWidth: 0.31,
    headHalfHeight: 0.34,
    tailLength: 4.5,
    tailBaseRadius: 0.44,
    shoulder: [0.62, 0.3, 0.3],
    hip: [0.74, -0.3, -0.33],
    wing: W({
      armLength: 3.73,
      humerus: 0.18,
      forearm: 0.3,
      hand: 0.07,
      fingers: [
        [0.29, 0.25],
        [0.17, 0.14],
        [0.12, 0.1],
      ],
      azHumerus: -12 * DEG,
      azForearm: 10 * DEG,
      azFingers: [-6 * DEG, -32 * DEG, -66 * DEG],
      trailZ: -0.3,
      scallop: 0.12,
    }),
    legAngles: { ...LEG_ANGLES },
    thigh: 0.36,
    shin: 0.38,
    meta: 0.26,
    toe: 0.19,
    thighRadius: 0.36,
    eye: 0.098,
    plates: false,
  },
  ironback: {
    torsoLength: 3.8,
    torsoHalfWidth: 1.1,
    torsoHalfHeight: 1.16,
    keel: 0.42,
    neckLength: 2.0,
    neckBaseRadius: 0.9,
    neckTopRadius: 0.52,
    neckRise: 20 * DEG,
    headLength: 1.55,
    headHalfWidth: 0.66,
    headHalfHeight: 0.54,
    tailLength: 4.0,
    tailBaseRadius: 0.84,
    shoulder: [0.6, 0.26, 0.3],
    hip: [0.8, -0.28, -0.32],
    // A short, broad, heavy wing: the fingers swept back, a shallow trailing edge.
    wing: W({
      armLength: 3.41,
      humerus: 0.23,
      forearm: 0.35,
      fingers: [
        [0.22, 0.19],
        [0.21, 0.18],
        [0.19, 0.16],
      ],
      azFingers: [-12 * DEG, -44 * DEG, -80 * DEG],
      trailZ: -0.6,
      scallop: 0.1,
    }),
    legAngles: { ...LEG_ANGLES, meta: 50 * DEG },
    thigh: 0.36,
    shin: 0.37,
    meta: 0.19,
    toe: 0.2,
    thighRadius: 0.7,
    armBulk: 1.25,
    eye: 0.078,
    plates: true,
  },
};

export interface ArmLengths {
  humerus: number;
  forearm: number;
  hand: number;
  fingers: [number, number][];
}

export interface LegLengths {
  thigh: number;
  shin: number;
  meta: number;
  toe: number;
  /** Ground clearance of the ankle-ball joint: the sole thickness under the toes (m). */
  sole: number;
}

export interface WyvernProportions {
  breed: BreedId;
  shape: BreedShape;
  standHeight: number;
  wingspan: number;
  /** Left shoulder joint (body space); the right one mirrors x. */
  shoulder: [number, number, number];
  /** Left hip joint (body space). */
  hip: [number, number, number];
  arm: ArmLengths;
  leg: LegLengths;
}

/** Azimuth/elevation (radians) → unit direction; azimuth from +X toward +Z. */
export function azDir(az: number, el = 0): [number, number, number] {
  const c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}

export function computeProportions(breed: BreedId, head: HeadId = breed): WyvernProportions {
  const stats = BREEDS[breed];
  const s = shapeWithHead(breed, head);
  const shoulder: [number, number, number] = [
    s.shoulder[0] * s.torsoHalfWidth,
    s.shoulder[1] * s.torsoHalfHeight,
    s.shoulder[2] * s.torsoLength,
  ];
  const hip: [number, number, number] = [s.hip[0] * s.torsoHalfWidth, s.hip[1] * s.torsoHalfHeight, s.hip[2] * s.torsoLength];

  // Wing: the spread bind pose lies flat at shoulder height. Every bone is sized with the arm
  // (armLength) but the wingtip finger's outer phalanx, which is solved so its tip sits at half
  // the wingspan: a pterosaur's span is its wing finger's. Folded, that phalanx lies back along
  // the flank, so a bigger wing folds to the same arm, hand and finger bundle with a longer spar
  // behind it; the inner fingers set the hand-wing's chord, so a longer wing is a slimmer one (the
  // flight model's span grows twice as fast as its area).
  const w = s.wing;
  const unit = w.armLength / (w.humerus + w.forearm);
  const fingers = w.fingers.map(([a, b]) => [a * unit, b * unit] as [number, number]);
  const az = w.azFingers[0];
  const inner =
    unit * (w.humerus * Math.cos(w.azHumerus) + w.forearm * Math.cos(w.azForearm) + w.hand * Math.cos(w.azHand)) +
    fingers[0][0] * Math.cos(az);
  fingers[0][1] = (stats.wingspan / 2 - shoulder[0] - inner) / Math.cos(az);
  const arm: ArmLengths = { humerus: w.humerus * unit, forearm: w.forearm * unit, hand: w.hand * unit, fingers };

  // Legs: the standing bind pose drops from the hip to the ground at standHeight.
  const sole = 0.045 * stats.standHeight;
  const drop = stats.standHeight + hip[1] - sole;
  const A = s.legAngles;
  const per = s.thigh * Math.cos(A.thigh) + s.shin * Math.cos(A.shin) + s.meta * Math.cos(A.meta);
  const legUnit = drop / per;
  const leg: LegLengths = {
    thigh: s.thigh * legUnit,
    shin: s.shin * legUnit,
    meta: s.meta * legUnit,
    toe: s.toe * legUnit,
    sole,
  };

  return { breed, shape: s, standHeight: stats.standHeight, wingspan: stats.wingspan, shoulder, hip, arm, leg };
}
