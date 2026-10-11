import { describe, expect, it } from 'vitest';
import { Vector3 as V } from 'three';
import { AirBoost, openDrop, steerFreefall } from './air';
import type { TerrainQuery } from '../core/types';
const ground = (height: (x:number,z:number)=>number|null): Pick<TerrainQuery,'groundAt'> => ({groundAt(x,z) {
  const y=height(x,z);return y===null?null:{y,normal:new V(0,1,0),surface:'stone',islandId:1};
}});
describe('edge-aware freefall',()=>{
  it('keeps ordinary hops, shallow drops and narrow cracks out of freefall',()=>{
    expect(openDrop(ground(()=>0),new V(0,1,0))).toBe(false);
    expect(openDrop(ground(()=>0),new V(0,3,0))).toBe(false);
    expect(openDrop(ground((x)=>Math.abs(x)<.3?null:0),new V(0,1,0))).toBe(false);
  });
  it('requires clearance of the ledge and at least four metres of drop',()=>{
    const cliff=ground((x)=>x<0?10:0);
    expect(openDrop(cliff,new V(.2,10,0))).toBe(false);
    expect(openDrop(cliff,new V(.7,10,0))).toBe(true);
    expect(openDrop(ground(()=>0),new V(0,4,0))).toBe(true);
    expect(openDrop(ground(()=>null),new V())).toBe(true);
  });
  it('uses at most five geometry queries',()=>{
    let queries=0;openDrop(ground(()=>{queries++;return null;}),new V());expect(queries).toBe(5);
  });
});
describe('bounded body steering and waist boost',()=>{
  it('bounds braking and diagonal corrections even at inherited overspeed',()=>{
    for(const x of [0,.5,1]) {
      const v=new V(0,-13,80),before=v.clone();steerFreefall(v,x,-1,0,1/120);
      expect(v.distanceTo(before)).toBeLessThanOrEqual(26/120+1e-10);expect(v.z).toBeGreaterThan(0);expect(Math.hypot(v.x,v.z)).toBeLessThanOrEqual(80);
    }
  });
  it('carries forward momentum through a full dive and brakes without reversing',()=>{
    const v=new V(0,-18,18);for(let i=0;i<240;i++)steerFreefall(v,0,1,0,1/120);
    expect(v.toArray()).toEqual([0,-18,18]);
    const before=v.clone();steerFreefall(v,0,0,0,1/120);expect(v.equals(before)).toBe(true);
    let previous=v.z;
    for(let i=0;i<240;i++){steerFreefall(v,0,-1,0,1/120);expect(v.z).toBeGreaterThanOrEqual(0);expect(v.z).toBeLessThan(previous);previous=v.z;}
    expect(v.z).toBeLessThan(.1);expect(v.y).toBe(-18);
  });
  it('steers relative to the camera, caps input speed, and preserves overspeed without input',()=>{
    const v=new V(0,-13,10);steerFreefall(v,1,0,0,1/120);expect(v.x).toBeLessThan(0);expect(v.y).toBe(-13);
    for(let i=0;i<1200;i++)steerFreefall(v,1,1,0,1/120);expect(Math.hypot(v.x,v.z)).toBeLessThanOrEqual(18+1e-10);
    v.set(0,-13,30);steerFreefall(v,0,0,0,1/120);expect(v.toArray()).toEqual([0,-13,30]);
  });
  it('reverses and turns promptly in a stable camera frame without vertical thrust',()=>{
    const v=new V(0,-13,18);
    for(let i=0;i<120;i++)steerFreefall(v,1,0,0,1/120);
    expect(v.x).toBeLessThan(-15);expect(Math.abs(v.z)).toBeLessThan(3);expect(v.y).toBe(-13);
    for(let i=0;i<180;i++)steerFreefall(v,-1,0,0,1/120);
    expect(v.x).toBeGreaterThan(15);expect(Math.hypot(v.x,v.z)).toBeLessThanOrEqual(18+1e-10);
    const turn=new V();steerFreefall(turn,0,.5,Math.PI/2,1/120);expect(turn.x).toBeGreaterThan(0);expect(Math.abs(turn.z)).toBeLessThan(1e-10);
  });
  it.each([-50,-18,-1,0,20])('launches predictably upward from vertical speed %s with a finite horizontal budget',vertical=>{
    const boost=new AirBoost(),v=new V(0,vertical,10);expect(boost.start(v,new V(1,-1,0),0)).toBe(true);
    expect(v.y).toBe(Math.max(12,vertical));
    for(let i=0;i<60;i++)boost.step(1/120,v);
    expect(v.x).toBeCloseTo(10,10);expect(v.z).toBe(10);expect(v.y).toBe(Math.max(12,vertical));
    expect(boost.remaining).toBe(0);expect(boost.available).toBe(false);
    expect(boost.start(v,undefined,0)).toBe(false);boost.reset();expect(boost.start(v,undefined,0)).toBe(true);
  });
  it('uses horizontal aim from rest, caps added horizontal speed and retains upward momentum',()=>{
    const boost=new AirBoost(),v=new V();boost.start(v,new V(1,0,0),0);boost.step(.14,v);expect(v.x).toBeCloseTo(5,10);expect(v.y).toBe(12);
    boost.stop();expect(boost.start(v,undefined,0)).toBe(false);
    boost.reset();v.set(0,25,35);boost.start(v,undefined,0);boost.step(1,v);expect(v.z).toBe(36);expect(v.y).toBe(25);
    boost.reset();v.set(0,-18,0);boost.start(v,new V(0,1,0),Math.PI/2);boost.step(1,v);expect(v.x).toBeCloseTo(10,10);expect(v.y).toBe(12);
  });
  it('zero time cannot consume fuel or apply impulse',()=>{
    const boost=new AirBoost(),v=new V(0,0,10);boost.start(v,undefined,0);const time=boost.remaining;
    boost.step(0,v);expect(boost.remaining).toBe(time);expect(v.z).toBe(10);
  });
});

describe('1.75-second simulation recharge',()=>{
  it('buffers one near-ready fresh press, retains its direction and never repeats',()=>{
    const boost=new AirBoost(),v=new V();boost.start(v,undefined,0);boost.step(1,v);boost.tick(1.65);
    expect(boost.request(v,new V(1,0,0),0)).toBe(false);expect(boost.buffered).toBe(true);
    const clock=boost.cooldown;boost.tick(0);boost.step(0,v);expect(boost.cooldown).toBe(clock);expect(boost.remaining).toBe(0);
    for(let i=0;i<12;i++){boost.tick(1/120);boost.step(1/120,v);}
    expect(boost.remaining).toBeGreaterThan(0);expect(boost.direction.toArray()).toEqual([1,0,0]);expect(boost.buffered).toBe(false);
    for(let i=0;i<300;i++){boost.tick(1/120);boost.step(1/120,v);}
    expect(boost.available).toBe(true);expect(boost.remaining).toBe(0);
  });
  it('rejects early presses and cancels a pending action without refunding recharge',()=>{
    const boost=new AirBoost(),v=new V();boost.start(v,undefined,0);boost.step(1,v);boost.tick(1);
    boost.request(v,undefined,0);expect(boost.buffered).toBe(false);
    boost.tick(.65);boost.request(v,new V(0,1,0),Math.PI/2);expect(boost.buffered).toBe(true);
    const clock=boost.cooldown;boost.stop();expect(boost.cooldown).toBe(clock);expect(boost.buffered).toBe(false);
    boost.tick(1);boost.step(1/120,v);expect(boost.remaining).toBe(0);
  });
  it('recharges in midair at 1.75 seconds, with no landing or reset',()=>{
    const boost=new AirBoost(),v=new V();boost.start(v,undefined,0);boost.step(1,v);
    for(let i=0;i<209;i++)boost.tick(1/120);
    expect(boost.available).toBe(false);expect(boost.start(v,undefined,0)).toBe(false);
    boost.tick(1/120);expect(boost.cooldown).toBe(0);expect(boost.available).toBe(true);expect(boost.start(v,undefined,0)).toBe(true);
    expect(boost.cooldown).toBe(1.75);
  });
  it('interruptions stop thrust without refunding recharge; pause and zero time freeze the clock',()=>{
    const boost=new AirBoost(),v=new V();boost.start(v,undefined,0);boost.tick(.5);boost.stop();
    expect(boost.cooldown).toBe(1.25);expect(boost.remaining).toBe(0);boost.tick(0);boost.tick(-1);expect(boost.cooldown).toBe(1.25);
    boost.tick(1.25);expect(boost.available).toBe(true);expect(v.y).toBe(12);
  });
});
