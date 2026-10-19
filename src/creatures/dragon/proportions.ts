// The dragon's body plan as plain numbers (gate G12a). One body serves every flight (Q48a).
//
// PROVISIONAL: measured on target render 08 (docs/art/targets/08-sleek-dragon-elder.png) against
// the elder beside it (about 1.75 m), with the perspective corrected by eye, so expect ±15%. Every
// number is re-measured from the approved Astra side view (model kit, sheet C) before the Meshy body
// is fitted; the method and the readings are in docs/design/WHITE_DRAGON.md.
//
// Body frame as for the wyverns (core/types.ts): +Z forward, +Y up, +X left; the origin is the body
// center. Six limbs: four walking legs, and two wings rooted on the back behind the forelegs.

import { DEG } from '../../core/math';

export interface DragonWingShape {
  /** Humerus plus forearm (m); every wing bone is sized with it except the wingtip finger's outer
   * phalanx, which is solved so the tips land at the span (as the wyvern's wing, A13). */
  armLength: number;
  humerus: number;
  forearm: number;
  hand: number;
  /** [proximal, distal] per finger, 0 (wingtip) .. 2 (innermost); finger 0's distal is solved. */
  fingers: [number, number][];
  /** Bind-pose azimuths (radians from +X toward +Z: negative = swept back). */
  azHumerus: number;
  azForearm: number;
  azHand: number;
  azFingers: number[];
  /** Where the membrane's trailing edge meets the flank, as a fraction of torso length (− = back). */
  trailZ: number;
}

export interface LimbAngles {
  /** Bind-pose angles of the three weight-bearing segments from vertical (radians, + = lower end
   * forward). */
  upper: number;
  lower: number;
  foot: number;
}

export interface DragonShape {
  torsoLength: number;
  torsoHalfWidth: number;
  torsoHalfHeight: number;
  keel: number;
  neckLength: number;
  neckBaseRadius: number;
  neckTopRadius: number;
  neckRise: number;
  headLength: number;
  headHalfWidth: number;
  headHalfHeight: number;
  tailLength: number;
  tailBaseRadius: number;
  /** Joints as fractions: x of torso half-width, y of half-height, z of torso length. */
  wingRoot: [number, number, number];
  scapula: [number, number, number];
  foreShoulder: [number, number, number];
  hip: [number, number, number];
  wing: DragonWingShape;
  /** Foreleg segments (humerus, forearm, hand) and toe, as ratios of the solved leg unit. */
  foreleg: { humerus: number; forearm: number; hand: number; toe: number; angles: LimbAngles };
  /** Hind-leg segments (thigh, shin, metatarsus) and toe, as ratios of the solved leg unit. */
  hindleg: { thigh: number; shin: number; meta: number; toe: number; angles: LimbAngles };
  /** Seat on the back, as a fraction of torso length: between the neck base and the wing roots. */
  seatZ: number;
  eye: number;
  /** Body center above the ground standing on all four feet (m). */
  standHeight: number;
  /** Tip to tip, wings spread flat in the bind pose (m). */
  wingspan: number;
}

/**
 * Readings on render 08 (elder ≈ 227 px ≈ 1.75 m at the chest's depth, ~130 px/m):
 * head ≈ 190 px ≈ 1.5 m; neck ≈ 2.5–2.8 m along its curve; chest front to rump ≈ 630 px, ≈ 5.6 m
 * with the body's turn from the image plane; tail ≈ 11 m traced around its curl at three depths;
 * folded wing: forearm ≈ 2.5 m, leading finger ≈ 6 m, so a span near 20 m, about the dragon's
 * length; wing roots mid-back, about 1.5 m behind the withers; haunch ≈ 1.5 m, hind foot ≈ 1.4 m;
 * forelimb lying, elbow to toe tips ≈ 2.0 m; lying, the back ≈ 1.9 m and the head ≈ 3.5 m above the
 * platform. Standing height is not in the render: standHeight is chosen so the legs come out at
 * those lengths.
 */
export const DRAGON_SHAPE: DragonShape = {
  torsoLength: 5.6,
  torsoHalfWidth: 0.9,
  torsoHalfHeight: 0.95,
  keel: 0.25,
  neckLength: 2.7,
  neckBaseRadius: 0.85,
  neckTopRadius: 0.42,
  neckRise: 30 * DEG,
  headLength: 1.5,
  headHalfWidth: 0.36,
  headHalfHeight: 0.34,
  tailLength: 11,
  tailBaseRadius: 0.75,
  wingRoot: [0.42, 0.88, 0.05],
  scapula: [0.5, 0.62, 0.22],
  foreShoulder: [0.62, -0.15, 0.3],
  hip: [0.74, -0.3, -0.33],
  wing: {
    armLength: 3.7,
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
    // Just ahead of the hind legs (the hip is at -0.33): the membrane never joins a leg.
    trailZ: -0.27,
  },
  // A quadruped's foreleg: the humerus slopes back to the elbow, the forearm stands near vertical,
  // the hand rakes forward onto the toes.
  foreleg: { humerus: 0.42, forearm: 0.4, hand: 0.18, toe: 0.16, angles: { upper: -25 * DEG, lower: 5 * DEG, foot: 20 * DEG } },
  // The wyverns' digitigrade hind leg angles (LEG_ANGLES in wyvern/proportions.ts), with a longer
  // foot: render 08's hind foot is about 1.4 m.
  hindleg: { thigh: 0.5, shin: 0.45, meta: 0.3, toe: 0.22, angles: { upper: 30 * DEG, lower: -40 * DEG, foot: 24 * DEG } },
  seatZ: 0.22,
  eye: 0.075,
  standHeight: 3.0,
  wingspan: 20,
};

export interface LegChain {
  /** Solved segment lengths (m): upper, lower, foot, then the toe. */
  upper: number;
  lower: number;
  foot: number;
  toe: number;
  /** Ground clearance of the ball joint: the sole under the toes (m). */
  sole: number;
}

export interface DragonProportions {
  shape: DragonShape;
  /** Left joints in body space; the right ones mirror x. */
  wingRoot: [number, number, number];
  scapula: [number, number, number];
  foreShoulder: [number, number, number];
  hip: [number, number, number];
  wing: { humerus: number; forearm: number; hand: number; fingers: [number, number][] };
  foreleg: LegChain;
  hindleg: LegChain;
}

const joint = (s: DragonShape, f: [number, number, number]): [number, number, number] => [
  f[0] * s.torsoHalfWidth,
  f[1] * s.torsoHalfHeight,
  f[2] * s.torsoLength,
];

/** Size a weight-bearing chain so its foot lands on the ground with the body at standHeight. */
function solveLeg(s: DragonShape, jointY: number, r: [number, number, number], toe: number, a: LimbAngles): LegChain {
  const sole = 0.045 * s.standHeight;
  const drop = s.standHeight + jointY - sole;
  const per = r[0] * Math.cos(a.upper) + r[1] * Math.cos(a.lower) + r[2] * Math.cos(a.foot);
  const unit = drop / per;
  return { upper: r[0] * unit, lower: r[1] * unit, foot: r[2] * unit, toe: toe * unit, sole };
}

export function computeDragonProportions(s: DragonShape = DRAGON_SHAPE): DragonProportions {
  const wingRoot = joint(s, s.wingRoot);
  const foreShoulder = joint(s, s.foreShoulder);
  const hip = joint(s, s.hip);

  // Wing: as the wyvern's (wyvern/proportions.ts), solved from the wing root rather than a shoulder.
  const w = s.wing;
  const unit = w.armLength / (w.humerus + w.forearm);
  const fingers = w.fingers.map(([a, b]) => [a * unit, b * unit] as [number, number]);
  const az = w.azFingers[0];
  const inner =
    unit * (w.humerus * Math.cos(w.azHumerus) + w.forearm * Math.cos(w.azForearm) + w.hand * Math.cos(w.azHand)) +
    fingers[0][0] * Math.cos(az);
  fingers[0][1] = (s.wingspan / 2 - wingRoot[0] - inner) / Math.cos(az);

  const F = s.foreleg;
  const H = s.hindleg;
  return {
    shape: s,
    wingRoot,
    scapula: joint(s, s.scapula),
    foreShoulder,
    hip,
    wing: { humerus: w.humerus * unit, forearm: w.forearm * unit, hand: w.hand * unit, fingers },
    foreleg: solveLeg(s, foreShoulder[1], [F.humerus, F.forearm, F.hand], F.toe, F.angles),
    hindleg: solveLeg(s, hip[1], [H.thigh, H.shin, H.meta], H.toe, H.angles),
  };
}

