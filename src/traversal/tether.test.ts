import { describe, it, expect } from 'vitest';
import { Vector3 as V } from 'three';
import { constrain, integrate, resolveTether, steerSwing } from './tether';
import { LANCE as T } from './tuning';
const dt = 1 / 120;
describe('gentle swing-plane steering',()=>{
  it('preserves speed, radial velocity and length while turning toward camera intent',()=>{
    const p=new V(0,0,0),v=new V(0,-3,8),rope={anchor:new V(0,10,0),length:10};
    const speed=v.lengthSq();steerSwing(p,v,rope,1,0,0,dt);
    expect(v.x).toBeLessThan(0);expect(v.y).toBe(-3);expect(v.lengthSq()).toBeCloseTo(speed,12);expect(rope.length).toBe(10);
    expect(Math.atan2(-v.x,v.z)).toBeLessThanOrEqual(.9*dt+1e-10);
  });
  it('leaves neutral input, zero time and a still rider unchanged',()=>{
    const p=new V(),v=new V(3,2,4),r={anchor:new V(0,10,0),length:10},before=v.clone();
    steerSwing(p,v,r,0,0,0,dt);expect(v.equals(before)).toBe(true);steerSwing(p,v,r,1,0,0,0);expect(v.equals(before)).toBe(true);
    v.set(0,0,0);steerSwing(p,v,r,1,0,0,dt);expect(v.lengthSq()).toBe(0);
  });
  it('cannot grow unpowered energy during a minute of continuous steering',()=>{
    const p=new V(6,2,0),v=new V(0,0,8),r={anchor:new V(0,10,0),length:10};
    let previous=.5*v.lengthSq()+18*p.y;
    for(let i=0;i<7200;i++){
      steerSwing(p,v,r,Math.sin(i*.03),.5,0,dt);integrate(p,v,dt,r);
      const energy=.5*v.lengthSq()+18*p.y;expect(energy).toBeLessThanOrEqual(previous+1e-8);previous=energy;
      expect(p.distanceTo(r.anchor)).toBeLessThanOrEqual(r.length+1e-8);
    }
  });
});
describe('fixed-length unilateral tether', () => {
  const rope = { anchor: new V(0, 10, 0), length: 10 };
  it('permits slack and inward movement without pulling', () => {
    const p = new V(0, 5, 0), v = new V(3, 2, 0);
    expect(constrain(p, v, rope)).toBe(false); expect(p.y).toBe(5); expect(v.toArray()).toEqual([3, 2, 0]);
    p.set(0, 0, 0); constrain(p, v, rope); expect(v.toArray()).toEqual([3, 2, 0]);
  });
  it('removes outward velocity and preserves the full tangent', () => {
    const p = new V(0, -0.5, 0), v = new V(3, -7, 4);
    constrain(p, v, rope); expect(p.distanceTo(rope.anchor)).toBeCloseTo(10, 12);
    expect(v.toArray()).toEqual([3, 0, 4]);
  });
  it('swings in 3D without growing unpowered energy or length over 60 seconds', () => {
    const p = new V(6, 2, 0), v = new V(0, 0, 8);
    let last = .5 * v.lengthSq() + T.gravity * p.y, travel = 0;
    for (let i = 0; i < 7200; i++) {
      const prev = p.clone(); integrate(p, v, dt, rope);
      expect(p.distanceTo(rope.anchor)).toBeLessThanOrEqual(10 + 1e-9);
      const energy = .5 * v.lengthSq() + T.gravity * p.y;
      expect(energy).toBeLessThanOrEqual(last + 1e-8); last = energy; travel += p.distanceTo(prev);
    }
    expect(travel).toBeGreaterThan(100);
  });
  it('bounds slack-to-taut capture at high speed', () => {
    const p = new V(0, 5, 0), v = new V(20, -180, 0);
    for (let i = 0; i < 100; i++) { integrate(p, v, dt, rope); expect(p.distanceTo(rope.anchor)).toBeLessThanOrEqual(10 + 1e-8); }
    expect(v.length()).toBeLessThan(190);
  });
  it('retains release momentum before gravity without walker braking', () => {
    const p = new V(), v = new V(10, 2, 8), initial = v.clone();
    integrate(p, v, dt, null);
    expect(v.x).toBe(initial.x); expect(v.z).toBe(initial.z);
    expect(v.y).toBeCloseTo(initial.y - T.gravity * dt, 12);
  });
  it('zero-duration update is inert', () => {
    const p = new V(2, 0, 0), v = new V(3, 0, 0); integrate(p, v, 0, rope);
    expect(p.x).toBe(2); expect(v.x).toBe(3);
  });
  it('measures unpowered energy, guard activity and small-angle period over 60 seconds', () => {
    // Unit mass, metres/seconds; E is kinetic plus potential above the pendulum bottom.
    const length = 10, angle = .05, r = { anchor: new V(0, 1000, 0), length };
    const p = new V(length * Math.sin(angle), 1000 - length * Math.cos(angle), 0), v = new V();
    const energy = () => .5 * v.lengthSq() + T.gravity * (p.y - r.anchor.y + length);
    const initial = energy(), crossings: number[] = [], diagnostics = { guardClamps: 0, guardStops: 0, energyRemoved: 0 };
    let previous = initial, maxGrowth = 0, maxLengthError = 0;
    for (let i = 0; i < 7200; i++) {
      const x = p.x; integrate(p, v, dt, r, undefined, 0, diagnostics);
      const e = energy(); maxGrowth = Math.max(maxGrowth, e - previous); previous = e;
      maxLengthError = Math.max(maxLengthError, p.distanceTo(r.anchor) - length);
      if (x > 0 && p.x <= 0) crossings.push((i + x / (x - p.x)) * dt);
    }
    const expectedPeriod = 2 * Math.PI * Math.sqrt(length / T.gravity);
    const period = (crossings.at(-1)! - crossings[0]) / (crossings.length - 1);
    const loss = (initial - energy()) / initial;
    console.log('GATE_A_ENERGY', JSON.stringify({ initial, final: energy(), loss, maxGrowth, maxLengthError, period, expectedPeriod, ...diagnostics }));
    expect(maxGrowth).toBeLessThanOrEqual(1e-8); expect(maxLengthError).toBeLessThanOrEqual(1e-8);
    expect(Math.abs(period / expectedPeriod - 1)).toBeLessThan(.01);
    expect(loss).toBeLessThan(.10); expect(diagnostics.guardStops).toBe(0);
  });
  it('sweeps rope correction from the resolved position and bounds incompatible retries', () => {
    const p = new V(11, 0, 0), v = new V(4, 3, 0), r = { anchor: new V(), length: 10 };
    const starts: number[] = [];
    resolveTether(p, v, r, (from, to) => { starts.push(from.x); to.x = 10.5; });
    expect(starts).toEqual([11, 10.5, 10.5, 10.5]); expect(p.x).toBe(10.5); expect(v.y).toBe(3);
  });
});


describe('deliberate bracer pull',()=>{
  it('adds bounded radial work, retains the tangent and reels only actual inward movement',()=>{
    const p=new V(0,1000,0),v=new V(7,0,0),r={anchor:new V(0,1020,0),length:20};
    const old=r.length;integrate(p,v,dt,r,undefined,0,undefined,0,T.pullAcceleration);
    const expectedP=new V(0,1000,0),expectedV=new V(7,0,0);
    for(let i=0;i<T.substeps;i++){
      const inward=r.anchor.clone().sub(expectedP).normalize(),h=dt/T.substeps;
      expectedV.addScaledVector(inward,T.pullAcceleration*h);expectedV.y-=T.gravity*h*.5;
      expectedP.addScaledVector(expectedV,h);expectedV.y-=T.gravity*h*.5;
    }
    expect(v.distanceTo(expectedV)).toBeLessThan(1e-8);expect(v.y).toBeGreaterThan(0);expect(v.y).toBeLessThan(T.pullAcceleration*dt);
    expect(r.length).toBeLessThan(old);expect(r.length).toBeCloseTo(p.distanceTo(r.anchor),10);
    const shortened=r.length;for(let i=0;i<60;i++)integrate(p,v,dt,r);
    expect(r.length).toBe(shortened); // No automatic reeling after the action ends.
  });
  it('caps powered inward speed and remains bounded for repeated pulls',()=>{
    const p=new V(0,1000,0),v=new V(),r={anchor:new V(0,1080,0),length:80};
    for(let i=0;i<1200;i++){
      integrate(p,v,dt,r,undefined,0,undefined,0,T.pullAcceleration);
      expect(r.length).toBeGreaterThanOrEqual(T.minLength);expect(p.distanceTo(r.anchor)).toBeLessThanOrEqual(r.length+1e-8);
      expect(v.length()).toBeLessThan(T.pullSpeed+.2);expect(p.toArray().every(Number.isFinite)).toBe(true);
    }
  });
  it('cannot shorten past a swept blocking ceiling or teleport across it',()=>{
    const p=new V(0,1000,0),v=new V(),r={anchor:new V(0,1020,0),length:20};
    const collision=(from:V,to:V,velocity:V)=>{if(to.y>1002){to.y=1002;velocity.y=Math.min(0,velocity.y);}};
    for(let i=0;i<360;i++)integrate(p,v,dt,r,collision,0,undefined,0,T.pullAcceleration);
    expect(p.y).toBeLessThanOrEqual(1002);expect(r.length).toBeGreaterThanOrEqual(18);expect(v.y).toBeLessThanOrEqual(0);
  });
});


it('accounts for all powered energy while preserving the unpowered guard',()=>{
  const p=new V(0,1000,0),v=new V(7,0,0),r={anchor:new V(0,1020,0),length:20};
  const energy=()=>.5*v.lengthSq()+T.gravity*(p.y-r.anchor.y),initial=energy();
  const diagnostics={guardClamps:0,guardStops:0,energyRemoved:0,poweredWork:0};
  for(let i=0;i<360;i++){
    integrate(p,v,dt,r,undefined,0,diagnostics,0,i<48?T.pullAcceleration:0);
    expect(energy()).toBeLessThanOrEqual(initial+diagnostics.poweredWork+1e-8);
  }
  expect(diagnostics.poweredWork).toBeGreaterThan(0);expect(diagnostics.guardStops).toBe(0);
});
