import { Vector3 } from 'three';
import { LANCE as T } from './tuning';
import { freefallDrag } from './freefall';
export interface Tether { readonly anchor: Vector3; length: number }
const radial = new Vector3();
const before = new Vector3();
const correctionStart = new Vector3();
const steeringRadial = new Vector3(), steeringTangent = new Vector3(), steeringIntent = new Vector3(), steeringCross = new Vector3();
/** Turn the swing plane gently, preserving radial velocity and the complete kinetic budget.
 * No input is inert; steering cannot launch a still rider, reel a line or add speed. */
export function steerSwing(position: Vector3, velocity: Vector3, rope: Tether, x: number, y: number, yaw: number, dt: number): void {
  const input = Math.hypot(x,y);
  if (!(dt > 0) || input < 1e-5) return;
  steeringRadial.subVectors(position,rope.anchor);
  if (steeringRadial.lengthSq() < 1e-8) return;
  steeringRadial.normalize();
  const radialSpeed = velocity.dot(steeringRadial);
  steeringTangent.copy(velocity).addScaledVector(steeringRadial,-radialSpeed);
  if (steeringTangent.lengthSq() < 1e-8) return;
  steeringIntent.set(-Math.cos(yaw)*x+Math.sin(yaw)*y,0,Math.sin(yaw)*x+Math.cos(yaw)*y);
  steeringIntent.addScaledVector(steeringRadial,-steeringIntent.dot(steeringRadial));
  if (steeringIntent.lengthSq() < 1e-8) return;
  steeringIntent.normalize();
  const angle = Math.atan2(steeringCross.crossVectors(steeringTangent,steeringIntent).dot(steeringRadial),steeringTangent.dot(steeringIntent));
  const turn = T.swingTurn * Math.min(1,input) * dt;
  steeringTangent.applyAxisAngle(steeringRadial,Math.max(-turn,Math.min(turn,angle)));
  velocity.copy(steeringTangent).addScaledVector(steeringRadial,radialSpeed);
}
export const ROPE_EPSILON = 1e-6;
/** Sweep each projection from the actual collision-resolved position, never across a chord.
 * At most four corrections; an unresolved bound is left at the safe contact for caller detachment. */
export function resolveTether(position: Vector3, velocity: Vector3, rope: Tether,
  collide?: (from: Vector3, to: Vector3, velocity: Vector3) => void, supported = false): boolean {
  let taut = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    correctionStart.copy(position);
    taut = (supported ? constrainSupported(position, velocity, rope) : constrain(position, velocity, rope)) || taut;
    collide?.(correctionStart, position, velocity);
    if (position.distanceTo(rope.anchor) <= rope.length + ROPE_EPSILON) break;
  }
  return taut;
}
/** Ground support supplies the vertical reaction. Restrict only the horizontal supported circle. */
function constrainSupported(position: Vector3, velocity: Vector3, rope: Tether): boolean {
  const dy = position.y - rope.anchor.y;
  if (Math.abs(dy) > rope.length) return false; // Incompatible support: caller detaches safely.
  radial.subVectors(position, rope.anchor); radial.y = 0;
  const radius = Math.sqrt(Math.max(0, rope.length * rope.length - dy * dy)), d = radial.length();
  if (d < radius - 1e-9 || d < 1e-9) return false;
  radial.multiplyScalar(1 / d);
  if (d > radius) { position.x = rope.anchor.x + radial.x * radius; position.z = rope.anchor.z + radial.z * radius; }
  const outward = velocity.dot(radial);
  if (outward > 0) velocity.addScaledVector(radial, -outward);
  return true;
}
export interface TetherDiagnostics { guardClamps: number; guardStops: number; energyRemoved: number; poweredWork?: number }
/** Unilateral constraint: slack is free, inward velocity is free, only outward velocity is removed. */
export function constrain(position: Vector3, velocity: Vector3, rope: Tether): boolean {
  radial.subVectors(position, rope.anchor);
  const d = radial.length();
  if (d < rope.length - 1e-9 || d < 1e-9) return false;
  radial.multiplyScalar(1 / d);
  if (d > rope.length) position.copy(rope.anchor).addScaledVector(radial, rope.length);
  const outward = velocity.dot(radial);
  if (outward > 0) velocity.addScaledVector(radial, -outward);
  return true;
}
/** Velocity-only reaction: never performs an unswept positional projection. */
function removeOutward(position: Vector3, velocity: Vector3, rope: Tether): void {
  radial.subVectors(position, rope.anchor);
  const distance = radial.length();
  if (distance < rope.length - 1e-9 || distance < 1e-9) return;
  radial.multiplyScalar(1 / distance);
  const outward = velocity.dot(radial);
  if (outward > 0) velocity.addScaledVector(radial, -outward);
}
/** Small fixed substeps plus an energy guard: constraints may dissipate, never create energy.
 * Optional deliberate pull adds bounded radial work before the energy budget is recorded.
 * The line only shortens behind actual inward swept movement, never by projecting to a new length.
 * Collision callback resolves the swept body path and clips velocity against contact normals.
 */
export function integrate(position: Vector3, velocity: Vector3, dt: number, rope: Tether | null,
  collide?: (from: Vector3, to: Vector3, velocity: Vector3) => void, drag = 0, diagnostics?: TetherDiagnostics, terminalSpeed = 0, pullAcceleration = 0): boolean {
  if (!(dt > 0)) return false;
  let taut = false;
  const h = dt / T.substeps;
  for (let i = 0; i < T.substeps; i++) {
    before.copy(position);
    if (rope && pullAcceleration > 0) {
      radial.subVectors(rope.anchor, position);
      const distance = radial.length();
      if (distance > T.minLength + T.bodyRadius) {
        radial.multiplyScalar(1 / distance);
        const impulse = Math.min(pullAcceleration * h, Math.max(0, T.pullSpeed - velocity.dot(radial)));
        const kinetic = .5 * velocity.lengthSq();
        velocity.addScaledVector(radial, impulse);
        if (diagnostics) diagnostics.poweredWork = (diagnostics.poweredWork ?? 0) + .5 * velocity.lengthSq() - kinetic;
      }
    }
    const energy = 0.5 * velocity.lengthSq() + T.gravity * (position.y - (rope?.anchor.y ?? 0));
    velocity.y -= T.gravity * h * (rope ? .5 : 1);
    // React to radial gravity before drift, avoiding a fictitious fall/projection damping cycle.
    if (rope) removeOutward(position, velocity, rope);
    // Stable quadratic air resistance: it can dissipate energy, never add thrust.
    if (!rope && terminalSpeed > 0) freefallDrag(velocity, h, drag, terminalSpeed);
    else if (drag > 0) velocity.multiplyScalar(1 / (1 + drag * velocity.length() * h));
    position.addScaledVector(velocity, h);
    collide?.(before, position, velocity);
    if (rope) {
      taut = resolveTether(position, velocity, rope, collide) || taut;
      velocity.y -= T.gravity * h * .5;
      removeOutward(position, velocity, rope);
      if (position.distanceTo(rope.anchor) > rope.length + ROPE_EPSILON) break;
    }
    if (rope) {
      const budget = energy - T.gravity * (position.y - (rope?.anchor.y ?? 0));
      if (budget < 0) {
        if (diagnostics) diagnostics.guardStops++;
        correctionStart.copy(position); position.copy(before); velocity.set(0, 0, 0);
        collide?.(correctionStart, position, velocity);
      }
      else if (velocity.lengthSq() > 2 * budget) {
        if (diagnostics) { diagnostics.guardClamps++; diagnostics.energyRemoved += .5 * velocity.lengthSq() - budget; }
        velocity.setLength(Math.sqrt(2 * budget));
      }
    }
    if (rope && pullAcceleration > 0) rope.length = Math.min(rope.length, Math.max(T.minLength, position.distanceTo(rope.anchor)));
  }
  return taut;
}
