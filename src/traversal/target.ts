import { Vector3 } from 'three';
import { SkyLance } from './SkyLance';
import type { SweepWorld } from './sweep';
import { LANCE as T } from './tuning';
import { SWEEP_LIMITS, type SweepHit } from './sweep';
export interface TargetPreview {
  state: 'reachable' | 'blocked' | 'out-of-range';
  point: Vector3;
  distance: number;
  anchorId: string | null;
}

/** The fixed screen centre selects only the first solid on the camera ray. No
 * cone search, sticky candidate or render mesh participates. Compensate launch
 * origin, inherited velocity and the existing fixed-step projectile drop. */
export function centeredCast(world: SweepWorld, camera: Vector3, direction: Vector3, origin: Vector3, velocity: Vector3): { aim: Vector3; hit: SweepHit | null } {
  const ray = direction.clone().normalize(), offset = origin.clone().sub(camera);
  const forward = offset.dot(ray), perpendicular = Math.max(0, offset.lengthSq() - forward * forward);
  const reach = Math.max(0, Math.min(SWEEP_LIMITS.length, forward + Math.sqrt(Math.max(0,T.maxLength*T.maxLength-perpendicular))));
  const end = camera.clone().addScaledVector(ray, reach), hit = world.sweep(camera,end,T.tipRadius);
  const delta = (hit?.point ?? end).clone().sub(origin);
  const displaced = new Vector3();
  const residual = (time: number): number => {
    displaced.copy(delta).addScaledVector(velocity,-time);
    displaced.y += .5*T.projectileGravity*time*(time+1/120);
    return displaced.lengthSq()-T.throwSpeed*T.throwSpeed*time*time;
  };
  if (hit && (hit.exhausted || hit.fraction <= 1e-6) || delta.lengthSq()<1e-10 || residual(T.maxFlight)>=0) return {aim:ray,hit};
  let lo=0,hi: number=T.maxFlight;
  for(let i=0;i<28;i++){const mid=(lo+hi)*.5;if(residual(mid)>0)lo=mid;else hi=mid;}
  residual((lo+hi)*.5);
  return {aim:displaced.normalize(),hit};
}

/** Green feedback must agree with both the centre-ray candidate and the actual
 * swept projectile's first solid, range and unobstructed tether path. */
export function predictCenteredTarget(world: SweepWorld, camera: Vector3, direction: Vector3, origin: Vector3, velocity: Vector3): TargetPreview {
  const {aim,hit}=centeredCast(world,camera,direction,origin,velocity);
  const distance=hit?.point.distanceTo(origin) ?? T.maxLength;
  if(!hit || distance>T.maxLength) return {state:'out-of-range',point:hit?.point.clone()??origin.clone(),distance,anchorId:null};
  if(hit.exhausted || hit.fraction <= 1e-6 || !hit.anchorId || distance<T.minLength) return {state:'blocked',point:hit.point.clone(),distance,anchorId:null};
  const target=predictTarget(world,origin,aim,velocity);
  const ray=direction.clone().normalize(),relative=target.point.clone().sub(camera),along=relative.dot(ray);
  const offRay=relative.addScaledVector(ray,-along).length();
  if(target.state==='reachable'&&(target.anchorId!==hit.anchorId || along<=0 || offRay>T.tipRadius*2))target.state='blocked';
  return target;
}
/** Presentation-only forecast, using the real fixed-step projectile and first-solid validation.
 * Assumes the current harness position; future steering/motion can change actual reachability.
 * At most 240 projectile steps; never mutates the live equipment or rider. */
export function predictTarget(world: SweepWorld, origin: Vector3, aim: Vector3, velocity: Vector3): TargetPreview {
  const probe = new SkyLance(world);
  if (!probe.throw(origin,aim,velocity)) return {state:'blocked',point:origin.clone(),distance:0,anchorId:null};
  for (let i=0;i<Math.ceil(T.maxFlight*120)&&probe.state==='projectile';i++) probe.step(1/120,origin);
  return {
    state: probe.rope ? 'reachable' : probe.reason === 'Missed' || (probe.reason === 'Out of tether range' && probe.position.distanceTo(origin) >= T.minLength) ? 'out-of-range' : 'blocked',
    point: probe.position.clone(),distance:probe.position.distanceTo(origin),anchorId:probe.anchorId,
  };
}
