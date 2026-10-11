import { Vector3 } from 'three';
import type { TerrainQuery } from '../core/types';
import { LANCE as T } from './tuning';
const PROBES = [[0,0],[1,0],[-1,0],[0,1],[0,-1]] as const;
/** Five bounded queries against actual walkable world geometry. A normal hop or a shallow
 * step stays with the walker; only open space clear of the rim enables skydiving. */
export function openDrop(terrain: Pick<TerrainQuery, 'groundAt'>, feet: Vector3): boolean {
  for (const [x,z] of PROBES) {
    const ground = terrain.groundAt(feet.x + x * T.edgeMargin, feet.z + z * T.edgeMargin, feet.y + .1);
    if (ground && feet.y - ground.y < T.freefallClearance) return false;
  }
  return true;
}
/** Camera-relative intent with bounded acceleration and gradual, non-reversing braking.
 * No input preserves momentum; attached ropes never call this controller. */
export function steerFreefall(v: Vector3, x: number, y: number, yaw: number, dt: number): void {
  const input = Math.hypot(x,y);
  if (!(dt > 0) || input < 1e-5) return;
  const initialX = v.x, initialZ = v.z, budget = T.airControl * Math.min(1,input) * dt;
  // A dive changes fall posture/drag in Player; it does not erase forward momentum.
  if (y < 0) {
    const speed = Math.hypot(v.x,v.z);
    const change = Math.min(budget,speed * (1-Math.exp(T.airBrake * Math.max(-1,y) * dt)));
    const brake = speed > 1e-8 ? 1-change/speed : 1;
    v.x *= brake; v.z *= brake;
  }
  const forward = Math.max(0,y), magnitude = Math.hypot(x,forward);
  if (magnitude < 1e-5) return;
  const speed = Math.hypot(v.x,v.z), cap = y < 0 ? speed : Math.max(T.airControlSpeed, speed);
  const sx = Math.sin(yaw), cx = Math.cos(yaw);
  const dx = (-cx*x + sx*forward) / magnitude * cap - v.x;
  const dz = (sx*x + cx*forward) / magnitude * cap - v.z;
  const change = Math.hypot(dx,dz), scale = Math.min(1,budget / Math.max(1e-8,change));
  v.x += dx * scale; v.z += dz * scale;
  if (y < 0) {
    const total = Math.hypot(v.x-initialX,v.z-initialZ);
    if (total > budget) { const k=budget/total;v.x=initialX+(v.x-initialX)*k;v.z=initialZ+(v.z-initialZ)*k; }
  }
}
/** Upward launch plus a bounded horizontal burst, with simulation-time recharge. Never fires on a rope. */
export class AirBoost {
  cooldown = 0;
  private pending = 0;
  private readonly pendingAim = new Vector3();
  get buffered(): boolean { return this.pending > 0; }
  get available(): boolean { return this.cooldown === 0; }
  /** Called once per Player fixed step, including grounded, mounted and tethered modes. */
  tick(dt: number): void {
    if (!(dt > 0)) return;
    this.cooldown = this.cooldown - dt < 1e-9 ? 0 : this.cooldown - dt;
    // Preserve a valid press through the step that reaches ready. Only freefall consumes it;
    // every context interruption cancels it without refunding the recharge.
    if (!this.available) this.pending = Math.max(0,this.pending-dt);
  }
  remaining = 0;
  readonly direction = new Vector3();
  /** At most one queued fresh press, accepted only in the last 120 ms of recharge. */
  request(velocity: Vector3, aim: Vector3 | undefined, yaw: number): boolean {
    if (this.available) return this.start(velocity,aim,yaw);
    if (this.remaining > 0 || this.cooldown > T.boostBuffer || (aim && !Number.isFinite(aim.lengthSq()))) return false;
    this.pendingAim.set(aim?.x ?? Math.sin(yaw),0,aim?.z ?? Math.cos(yaw));
    if (this.pendingAim.lengthSq() < 1e-8) this.pendingAim.set(Math.sin(yaw),0,Math.cos(yaw));
    this.pendingAim.normalize();
    this.pending = T.boostBuffer;
    return false;
  }
  cancelRequest(): void { this.pending = 0; }
  start(velocity: Vector3, aim: Vector3 | undefined, yaw: number): boolean {
    if (!this.available || this.remaining > 0) return false;
    if (aim && !Number.isFinite(aim.lengthSq())) return false;
    this.direction.set(aim?.x ?? Math.sin(yaw),0,aim?.z ?? Math.cos(yaw));
    if (this.direction.lengthSq() < 1e-8) this.direction.set(Math.sin(yaw),0,Math.cos(yaw));
    this.direction.normalize();
    // A falling rider gets the same upward launch as one near the apex. Preserve faster ascent.
    velocity.y = Math.max(velocity.y,T.boostLift);
    this.pending = 0; this.cooldown = T.boostCooldown; this.remaining = T.boostDuration; return true;
  }
  step(dt: number, velocity: Vector3): void {
    if (!(dt > 0)) return;
    if (this.buffered && this.available) this.start(velocity,this.pendingAim,0);
    if (this.remaining <= 0) return;
    const time = Math.min(dt,this.remaining), cap = Math.max(T.boostMaxSpeed,Math.hypot(velocity.x,velocity.z));
    velocity.addScaledVector(this.direction,T.boostDelta * time / T.boostDuration);
    const speed = Math.hypot(velocity.x,velocity.z);
    if (speed > cap) {velocity.x *= cap / speed;velocity.z *= cap / speed;}
    this.remaining = Math.max(0,this.remaining-time);
  }
  stop(): void {this.remaining = 0;this.cancelRequest();}
  reset(): void {this.stop();this.cooldown = 0;this.direction.set(0,0,0);}
}
