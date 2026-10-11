/** Rider traversal values; independent of wyvern tuning. SI units. */
export const LANCE = Object.freeze({ gravity: 18, throwSpeed: 120, projectileGravity: 6,
  tipRadius: 0.08, maxFlight: 2, maxLength: 65, minLength: 2,
  recoveryTime: 0.36, castTime: 0.22, harnessHeight: 1, callHold: 0.4, chargeTime: 0.8, chargedSpeed: 144, chargedLength: 95,
  spreadDrag: 0.03, diveDrag: 0.003,
  brakeFallSpeed: 9, neutralFallSpeed: 13, diveFallSpeed: 18,
  freefallClearance: 4, edgeMargin: .65, airControl: 26, airControlSpeed: 18, airBrake: 3.5,
  boostDelta: 10, boostLift: 12, boostDuration: .28, boostCooldown: 1.75, boostMaxSpeed: 36,
  boostBuffer: .12, swingTurn: .9,
  pullAcceleration: 60, pullSpeed: 18, pullDuration: .4, pullRise: .08,
  bodyRadius: 0.35, substeps: 4, skin: 0.002 });
