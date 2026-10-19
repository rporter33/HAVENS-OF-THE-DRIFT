// The dragon's body plan as plain numbers (gate G12a). One body serves every flight (Q48a).
//
// Measured on the approved Astra side view (model kit, sheet C: white-dragon-ref-left.png, archived
// on archive/g12a-white-dragon) by three independent readers, reconciled. The sheet has no scale, so
// its size comes from target render 08 (docs/art/targets/08-sleek-dragon-elder.png, measured against
// the elder): the geometric mean of render 08's five body readings sets 86.3 px/m. The method and
// the readings are in docs/design/WHITE_DRAGON.md; the rig tests hold the skeleton to them.
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
  /** Along the neck's curve, base to skull joint (m). */
  neckLength: number;
  neckBaseRadius: number;
  neckTopRadius: number;
  /** The neck's base: [y as a fraction of torso half-height, z as a fraction of torso length]. */
  neckBase: [number, number];
  /** Rise of each neck segment above the horizontal, base to head (radians): the sheet's S. */
  neckRise: number[];
  /** Skull joint to snout tip (m). */
  headLength: number;
  /** Nose-down pitch of the head, skull joint to snout tip (radians). */
  headPitch: number;
  headHalfWidth: number;
  headHalfHeight: number;
  /** Along the tail, base to tip (m). */
  tailLength: number;
  tailBaseRadius: number;
  /** The tail's base: [y as a fraction of torso half-height, z as a fraction of torso length]. */
  tailBase: [number, number];
  /** Droop of each tail segment below the horizontal, base to tip (radians; negative curls up). */
  tailDroop: number[];
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
  /** Eye radius as a fraction of head length. */
  eye: number;
  /** Eye center in the head's frame: [x of head half-width, up of head half-height, along of head length]. */
  eyeAt: [number, number, number];
  /** Body center above the ground standing on all four feet (m). */
  standHeight: number;
  /** Tip to tip, wings spread flat in the bind pose (m). */
  wingspan: number;
}

/**
 * Side view C (1672 x 941, the dragon facing left, soles at y 800): head 132 px; neck 192 px along its
 * curve, rising straight up from the withers and bending forward under the skull; chest front to
 * rump 432 px; tail 1015 px along its line, sagging behind the haunch and curling up at the tip;
 * body 191 px deep at the center, 200 px at the chest; the body center 295 px above the soles; wing
 * root 108 px behind the withers; the near legs' joints as read (shoulder, elbow, wrist, ball, toes;
 * hip, knee, hock, ball, toes). The neck's and tail's segment angles are their centre lines
 * resampled at the rig's own joint spacing. Render 08's body readings in px/m: head 88, neck 73,
 * torso 77, tail 92, depth 105; their geometric mean, 86.3, sets the size: 20.3 m from the nose to
 * the tail tip along the skeleton, where render 08's provisional rig measured 20.6 m. Its lying leg
 * readings aren't comparable with a standing sheet and are left out.
 */
export const DRAGON_SHAPE: DragonShape = {
  torsoLength: 5.005,
  // Not in a side view: the Meshy body's chest and haunch half-widths at the fit's scale.
  torsoHalfWidth: 0.9,
  // The sheet's chest is barely deeper than its middle: no keel, half-height fitted to both depths.
  torsoHalfHeight: 1.223,
  keel: 0,
  neckLength: 2.227,
  neckBaseRadius: 0.85,
  neckTopRadius: 0.42,
  neckBase: [1.026, 0.323],
  neckRise: [82.4 * DEG, 93.7 * DEG, 91.4 * DEG, 77.5 * DEG, 60.8 * DEG, 38.5 * DEG],
  headLength: 1.532,
  headPitch: 17.6 * DEG,
  headHalfWidth: 0.36,
  headHalfHeight: 0.34,
  tailLength: 11.76,
  tailBaseRadius: 0.75,
  tailBase: [-0.045, -0.507],
  // The sheet's tail sags behind the haunch and curls up toward the tip (4.9° base to tip overall).
  tailDroop: [7.5, 12.5, 10.5, 8.3, 6.0, 3.9, 1.4, -1.9, -4.6, -8.6].map((d) => d * DEG),
  // Height and place along the back from sheet C (108 px behind the withers); how far out, from the
  // Meshy body.
  wingRoot: [0.606, 0.76, -0.093],
  scapula: [0.5, 0.62, 0.22],
  foreShoulder: [0.62, -0.045, 0.301],
  hip: [0.74, -0.158, -0.38],
  // The wing's bones from the Meshy body (both wings averaged; lengths in 3D, azimuths flattened),
  // at the fit's scale of 10.89 m per Meshy unit. Sheet C draws its raised wing too large for the
  // other views (its leading finger alone, 9 m, would spread the wings to 25 m where the front view
  // shows about 16.5 m); the Meshy body, built from all the views, spans 20.7 m as it stands and
  // 21.8 m spread flat. The hand is very short: the fingers fan straight from the wrist's knob, and
  // the leading finger's joint sits 29% of the way out.
  wing: {
    armLength: 4.677,
    humerus: 0.571,
    forearm: 0.429,
    hand: 0.051,
    fingers: [
      [0.35, 0.851],
      [0.489, 0.457],
      [0.34, 0.362],
    ],
    azHumerus: -0.4 * DEG,
    azForearm: 4.2 * DEG,
    azHand: -13.4 * DEG,
    azFingers: [-14.1 * DEG, -23.2 * DEG, -45.3 * DEG],
    // Just ahead of the hind legs (the hip is at -0.38), as the design and the Meshy body have it.
    // Sheet C ties the membrane to the top of the rump behind the hip (-0.49): clear of the leg, but
    // not where the kit asked.
    trailZ: -0.25,
  },
  // Sheet C's near foreleg: the humerus slopes back to the elbow, the forearm stands near vertical,
  // the hand rakes forward onto the toes.
  foreleg: { humerus: 0.375, forearm: 0.475, hand: 0.15, toe: 0.132, angles: { upper: -30 * DEG, lower: 6.5 * DEG, foot: 23.7 * DEG } },
  // Sheet C's near hind leg: the knee almost under the hip, the shin raking back to a high hock,
  // the long metatarsus near vertical.
  hindleg: { thigh: 0.294, shin: 0.336, meta: 0.371, toe: 0.112, angles: { upper: -4.4 * DEG, lower: -58.6 * DEG, foot: 9.4 * DEG } },
  // The middle of the flat back between the withers (0.16 T) and the wing roots.
  seatZ: 0.04,
  eye: 0.075,
  eyeAt: [0.78, 0.56, 0.468],
  standHeight: 3.415,
  // Spread flat with the bones above: the leading finger's outer phalanx is solved to it.
  wingspan: 21.8,
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

