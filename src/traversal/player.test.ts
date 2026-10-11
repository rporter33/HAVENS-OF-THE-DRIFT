import { describe, it, expect, vi } from 'vitest';
import { Vector3 as V } from 'three';
import { Player } from '../player/Player';
import { Terrain } from '../world/terrain';
import { LAYOUT } from '../world/layout';
import { EventBus } from '../core/events';
import type { GameEvents } from '../core/types';
import { emptyFrame } from '../input/Input';
import { TraversalWorld } from './sweep';
import { AnchorRegistry } from './anchors';
import { PLAYER_TUNING as P } from '../player/tuning';
import type { Collider } from '../core/types';
const dt = 1 / 120;
function rig() {
  const terrain = new Terrain(LAYOUT), events = new EventBus<GameEvents>();
  const p = new Player({ terrain, env: { terrain, windAt: (_p, out) => out.set(0, 0, 0) }, events, breed: 'harrier' });
  p.placeAtSpawn(); p.enableSkyLance(new TraversalWorld(terrain));
  const tick = (lance = false, recover = false, release = false) => { const input = emptyFrame(); input.pressed.lance = lance; input.pressed.lanceRelease = release; input.pressed.recoverLance = recover; p.latchPresses(input); p.fixedUpdate(dt, input, 0); p.update(dt, 1); };
  const attach = () => {
    p.foot.position.set(5000, 1000, 5000); p.foot.grounded = false; p.foot.velocity.set(8, 0, 0);
    tick(); expect(p.mode).toBe('traversing');
    p.skyLance!.world.anchorValid = () => true;
    p.skyLance!.world.sweep = (_from, to, radius) => radius === .08 ? ({ fraction: 1, point: to.clone(), normal: new V(0, 0, -1), anchorId: 'fixture' }) : null;
    p.skyLance!.throw(new V(5000, 1011, 5000), new V(0, 0, 1), new V());
    tick();
    // World has no subsequent obstructions; the attachment itself was resolved by the real equipment step.
    p.skyLance!.world.sweep = () => null;
  };
  return { p, events, tick, attach, terrain };
}
function groundedRig(halfSize = 40) {
  const r = rig(), { p, terrain } = r;
  terrain.colliders.add({ kind: 'box', x: 5000, y: 999, z: 5000, hx: halfSize, hy: 1, hz: halfSize, yaw: 0 });
  const target: Collider = { kind: 'sphere', x: 5000, y: 1008, z: 5012, radius: 1 };
  terrain.colliders.add(target);
  p.enableSkyLance(new TraversalWorld(terrain, new AnchorRegistry([{ id: 'supported', collider: target }])));
  p.foot.position.set(5000, 1000, 5000); p.foot.velocity.set(0, 0, 0); p.foot.grounded = true;
  const origin = p.foot.position.clone().add(new V(0, 1, 0));
  p.skyLance!.throw(origin, new V(0, 7, 12), new V());
  for (let i = 0; i < 120 && !p.skyLance!.rope; i++) r.tick();
  expect(p.skyLance!.rope).not.toBeNull();
  return r;
}
function stepInput(p: Player, input = emptyFrame()) { p.latchPresses(input); p.fixedUpdate(dt, input, 0); }
describe('grounded tether ownership', () => {
  it('successful grounded cast retains walker support and integrates exactly once', () => {
    const r = groundedRig(), spy = vi.spyOn(r.p.foot, 'step');
    for (let i = 0; i < 120; i++) r.tick();
    expect(spy).toHaveBeenCalledTimes(120); expect(r.p.mode).toBe('onFoot');
    expect(r.p.foot.grounded).toBe(true); expect(r.p.foot.position.y).toBe(1000); expect(r.p.foot.velocity.y).toBe(0);
    expect(r.p.skyLance!.rope).not.toBeNull();
  });
  it('walking outward stops at the fixed bound without lifting or shortening', () => {
    const r = groundedRig(), input = emptyFrame(), length = r.p.skyLance!.rope!.length;
    input.foot.moveY = -1;
    for (let i = 0; i < 480; i++) {
      stepInput(r.p, input); expect(r.p.foot.grounded).toBe(true);
      expect(r.p.foot.position.y).toBe(1000); expect(r.p.skyLance!.rope!.length).toBe(length);
      expect(r.p.foot.position.clone().add(new V(0, 1, 0)).distanceTo(r.p.skyLance!.rope!.anchor)).toBeLessThanOrEqual(length + 1e-6);
    }
    expect(r.p.mode).toBe('onFoot'); expect(Math.abs(r.p.foot.velocity.z)).toBeLessThan(1e-8);
  });
  it('deliberate jump applies walker gravity once, then transfers airborne ownership', () => {
    const r = groundedRig(), spy = vi.spyOn(r.p.foot, 'step'), input = emptyFrame(); input.pressed.jump = true;
    stepInput(r.p, input);
    expect(spy).toHaveBeenCalledTimes(1); expect(r.p.mode).toBe('traversing'); expect(r.p.foot.grounded).toBe(false);
    expect(r.p.foot.velocity.y).toBeCloseTo(P.jumpSpeed - P.footGravity * dt, 12);
    r.tick(); expect(spy).toHaveBeenCalledTimes(1); expect(r.p.skyLance!.rope).not.toBeNull();
  });
  it('edge departure transfers only after actual support loss', () => {
    const r = groundedRig(6), input = emptyFrame(); input.foot.moveY = 1;
    for (let i = 0; i < 400 && r.p.mode === 'onFoot'; i++) stepInput(r.p, input);
    expect(r.p.mode).toBe('traversing'); expect(r.p.foot.grounded).toBe(false); expect(r.p.foot.position.z).toBeGreaterThan(5006);
    expect(r.p.skyLance!.rope).not.toBeNull();
  });
  it('a later airborne supported landing detaches, unlike initial grounded attachment', () => {
    const r = groundedRig(), input = emptyFrame(); input.pressed.jump = true; stepInput(r.p, input);
    r.p.foot.position.set(5000, 1000.01, 5000); r.p.foot.velocity.set(0, -1, 0); r.tick();
    expect(r.p.mode).toBe('onFoot'); expect(r.p.foot.grounded).toBe(true);
    expect(r.p.skyLance!.rope).toBeNull(); expect(r.p.skyLance!.reason).toBe('Landed');
  });
});
describe('rider traversal fidelity', () => {
  function supported() {
    const r=rig();r.terrain.colliders.add({kind:'box',x:5000,y:999,z:5000,hx:10,hy:1,hz:10,yaw:0});
    r.p.foot.position.set(5000,1000,5000);r.p.foot.grounded=true;return r;
  }
  it('keeps a complete normal jump upright and walker-owned over flat ground',()=>{
    const r=supported(),spy=vi.spyOn(r.p.foot,'step'),input=emptyFrame();input.pressed.jump=true;
    stepInput(r.p,input);input.pressed.jump=false;
    for(let i=0;i<120;i++){
      stepInput(r.p,input);r.p.update(dt,1);expect(r.p.mode).toBe('onFoot');expect(r.p.riderPose.freefallTilt).toBeUndefined();
      expect(r.p.airBoost.available).toBe(true);
    }
    expect(spy).toHaveBeenCalledTimes(121);expect(r.p.foot.grounded).toBe(true);expect(r.p.foot.position.y).toBe(1000);
  });
  it('keeps a shallow drop walking but transfers a clear large drop to freefall',()=>{
    const r=supported();r.p.foot.grounded=false;r.p.foot.position.y=1002;r.tick();expect(r.p.mode).toBe('onFoot');
    r.p.foot.position.y=1005;r.p.foot.velocity.y=-1;r.tick();expect(r.p.mode).toBe('traversing');r.tick();r.p.update(dt,1);
    expect(r.p.riderPose.freefallTilt).toBeDefined();
  });
  it('steers freefall, spends one burst on a fresh air jump and resets on teleport',()=>{
    const r=rig();r.p.foot.position.set(5000,1000,5000);r.p.foot.grounded=false;r.p.foot.velocity.set(0,-5,10);r.tick();
    const input=emptyFrame();input.foot.moveX=1;
    for(let i=0;i<60;i++)stepInput(r.p,input);expect(r.p.foot.velocity.x).toBeLessThan(-1);
    input.pressed.jump=true;stepInput(r.p,input);expect(r.p.airBoost.available).toBe(false);expect(r.p.airBoost.remaining).toBeGreaterThan(0);
    input.pressed.jump=false;for(let i=0;i<60;i++)stepInput(r.p,input);expect(r.p.airBoost.remaining).toBe(0);
    input.pressed.jump=true;stepInput(r.p,input);expect(r.p.airBoost.remaining).toBe(0);
    r.p.teleport(new V(5000,1000,5000),0,'onFoot');expect(r.p.airBoost.available).toBe(true);
  });
  it('pulls a slack attached line without consuming the detached boost or adding sideways steering',()=>{
    const r=rig();r.attach();r.p.foot.position.copy(r.p.skyLance!.rope!.anchor).add(new V(0,-6,0));r.p.foot.velocity.set(0,0,0);
    const input=emptyFrame();input.pressed.jump=true;input.foot.moveX=1;stepInput(r.p,input);
    expect(r.p.airBoost.available).toBe(true);expect(r.p.airBoost.remaining).toBe(0);expect(r.p.foot.velocity.x).toBe(0);
    expect(r.p.foot.velocity.y).toBeGreaterThanOrEqual(0);expect(r.p.foot.velocity.y).toBeLessThan(.1);expect(r.p.skyLance!.pullTime).toBeGreaterThan(0);
    input.pressed.jump=false;for(let i=0;i<12;i++)stepInput(r.p,input);expect(r.p.foot.velocity.y).toBeGreaterThan(0);
    expect(r.p.skyLance!.rope).not.toBeNull();
  });
  it('keeps LT away from ordinary ground jumps and exposes readonly hold progress',()=>{
    const r=supported(),input=emptyFrame();input.pressed.airAction=true;stepInput(r.p,input);
    expect(r.p.mode).toBe('onFoot');expect(r.p.foot.grounded).toBe(true);expect(r.p.foot.velocity.y).toBe(0);expect(r.p.airBoost.available).toBe(true);
    r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();input.pressed.airAction=false;input.callHeld=true;
    for(let i=0;i<12;i++)stepInput(r.p,input);
    expect(r.p.windlineHoldAction).toBe('leap');expect(r.p.windlineHoldProgress).toBeCloseTo(.25,10);
    r.p.cancelLanceWindup();expect(r.p.windlineHoldProgress).toBe(0);expect(r.p.mode).toBe('flying');
  });
  it('does not let ordinary steering fight the active horizontal boost',()=>{
    function run(side:number){
      const r=rig();r.p.foot.position.set(5000,1000,5000);r.p.foot.grounded=false;r.p.foot.velocity.set(0,-5,8);r.tick();
      const input=emptyFrame();input.pressed.airAction=true;input.aim=new V(0,0,1);stepInput(r.p,input);input.pressed.airAction=false;
      input.foot.moveX=side;for(let i=0;i<32;i++)stepInput(r.p,input);
      return r.p.foot.velocity.toArray();
    }
    expect(run(1)).toEqual(run(0));expect(run(-1)).toEqual(run(0));
  });

  it('sweeps the initial saddle hop and does not pass through an intervening contact',()=>{
    const r=rig();r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();
    const sweep=vi.spyOn(r.p.skyLance!.world,'sweep');
    sweep.mockImplementation((from,to)=>to.x>from.x?{fraction:.1,point:from.clone().lerp(to,.1),normal:new V(-1,0,0),anchorId:null}:null);
    const held=emptyFrame();held.callHeld=true;for(let i=0;i<48;i++)stepInput(r.p,held);
    expect(r.p.mode).toBe('traversing');expect(sweep).toHaveBeenCalled();expect(r.p.foot.velocity.x).toBeLessThanOrEqual(0);
  });
  it('a rider landing separately does not give its gliding wyvern grounded regeneration or rest',()=>{
    const r=rig();r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();
    const held=emptyFrame();held.callHeld=true;for(let i=0;i<48;i++)stepInput(r.p,held);
    r.terrain.colliders.add({kind:'box',x:6000,y:899,z:6000,hx:10,hy:1,hz:10,yaw:0});
    r.p.foot.position.set(6000,900,6000);r.p.foot.velocity.set(0,-1,0);r.tick();expect(r.p.mode).toBe('onFoot');
    const internals=r.p as unknown as {groundRegen(dt:number):void;groundTime:number};const regen=vi.spyOn(internals,'groundRegen');
    for(let i=0;i<30;i++)r.tick();expect(regen).not.toHaveBeenCalled();expect(internals.groundTime).toBe(0);
    expect(r.p.mode).toBe('onFoot');
  });
  it('an independently gliding dragon landing cannot mount its airborne rider',()=>{
    const r=rig();r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();
    const held=emptyFrame();held.callHeld=true;for(let i=0;i<48;i++)stepInput(r.p,held);
    const ground={y:990,normal:new V(0,1,0),surface:'stone',islandId:null};
    (r.p as unknown as {touchdown(g:unknown,sink:number):void}).touchdown(ground,2);
    r.p.update(dt,1);expect(r.p.mode).toBe('traversing');expect(r.p.riderPose.mounted).toBe(false);
  });
  it.each(['harrier','skimmer','galewing','ironback'] as const)('%s can jump off and deliberately remount without repeated held-Y transitions',breed=>{
    const r=rig();r.p.setBreed(breed);r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();
    let caught=0;r.events.on('caught',()=>caught++);
    for(let cycle=0;cycle<2;cycle++){
      const held=emptyFrame();held.callHeld=true;
      for(let i=0;i<48;i++)stepInput(r.p,held);
      r.p.update(dt,1);expect(r.p.mode).toBe('traversing');expect(r.p.riderPose.mounted).toBe(false);
      const dragon=r.p.model.state.position.clone();for(let i=0;i<120;i++)stepInput(r.p,held);
      expect(r.p.mode).toBe('traversing');expect(r.p.model.state.position.distanceTo(dragon)).toBeGreaterThan(1);expect(caught).toBe(cycle);
      r.tick();for(let i=0;i<48;i++)stepInput(r.p,held);expect(r.p.mode).toBe('falling');
      for(let i=0;i<100;i++)stepInput(r.p,held);expect(r.p.mode).toBe('flying');expect(caught).toBe(cycle+1);
      for(let i=0;i<60;i++)stepInput(r.p,held);expect(r.p.mode).toBe('flying');r.tick();
    }
  });
});
describe('Sky Lance movement ownership', () => {
  it('attachment cancels pending rescue without teleporting the companion', () => {
    const r = rig(); r.p.foot.position.set(5000, 1000, 5000); r.p.foot.grounded = false; r.tick();
    const call = emptyFrame(); call.callHeld = true;
    for (let i = 0; i < 48; i++) { r.p.latchPresses(call); r.p.fixedUpdate(dt, call, 0); }
    expect(r.p.mode).toBe('falling');
    const before = r.p.companion.position.clone();
    r.p.skyLance!.world.anchorValid = () => true;
    r.p.skyLance!.world.sweep = (_from, to, radius) => radius === .08 ? ({ fraction: 1, point: to.clone(), normal: new V(0, 0, -1), anchorId: 'fixture' }) : null;
    r.p.skyLance!.throw(r.p.foot.position.clone().add(new V(0, 11, 0)), new V(0, 0, 1), new V()); r.tick(); r.p.skyLance!.world.sweep = () => null;
    expect(r.p.mode).toBe('traversing'); expect(r.p.controllable).toBe(true);
    expect(r.p.companion.state).toBe('hop'); expect(r.p.companion.position.distanceTo(before)).toBeLessThan(2);
    let caught = 0; r.events.on('caught', () => caught++);
    for (let i = 0; i < 600; i++) r.tick();
    expect(caught).toBe(0); expect(r.p.mode).toBe('traversing'); expect(r.p.skyLance!.rope).not.toBeNull();
  });
  it('attachment beats the catch on the exact rescue-dispatch step, even with slack', () => {
    const r = rig(); r.p.foot.position.set(5000, 1000, 5000); r.p.foot.grounded = false; r.tick();
    const call = emptyFrame(); call.callHeld = true;
    for (let i = 0; i < 48; i++) stepInput(r.p, call);
    expect(r.p.mode).toBe('falling');
    for (let i = 0; i < 95; i++) r.tick(); expect(r.p.mode).toBe('falling');
    let caught = 0; r.events.on('caught', () => caught++);
    r.p.skyLance!.world.anchorValid = () => true;
    r.p.skyLance!.world.sweep = (_from, to, radius) => radius === .08 ? { fraction: 1, point: to.clone(), normal: new V(0, 0, -1), anchorId: 'fixture' } : null;
    r.p.skyLance!.throw(r.p.foot.position.clone().add(new V(0, 20, 0)), new V(0, 0, 1), new V()); r.tick();
    expect(r.p.mode).toBe('traversing'); expect(caught).toBe(0); expect(r.p.companion.state).not.toBe('swoop');
    r.p.skyLance!.world.sweep = () => null;
    r.p.foot.position.copy(r.p.skyLance!.rope!.anchor).add(new V(0, -3, 0)); r.p.foot.velocity.set(0, 0, 0);
    stepInput(r.p, call); expect(r.p.skyLance!.taut).toBe(false); expect(r.p.mode).toBe('traversing'); expect(caught).toBe(0);
  });
  it('detach itself preserves every component of world velocity', () => {
    const r = rig(); r.attach(); r.p.foot.velocity.set(8.125, -13.75, 4.5);
    const before = r.p.foot.velocity.toArray(); r.p.skyLance!.detach();
    expect(r.p.foot.velocity.toArray()).toEqual(before); expect(r.p.skyLance!.anchorId).toBeNull();
  });
  it('pause cancellation clears queued release, recover, jump, interact and cast', () => {
    const r = rig(); r.attach(); const input = emptyFrame();
    input.pressed.lance = input.pressed.lanceRelease = input.pressed.recoverLance = input.pressed.jump = input.pressed.interact = true;
    r.p.latchPresses(input); r.p.cancelLanceWindup(); const rope = r.p.skyLance!.rope;
    r.tick(); expect(r.p.skyLance!.rope).toBe(rope); expect(r.p.mode).toBe('traversing');
  });
  it('respawn/spawn reset and equipment teardown clear stale actions and anchors', () => {
    const r = rig(); r.attach(); const input = emptyFrame(); input.pressed.lance = input.pressed.jump = true;
    r.p.latchPresses(input); r.p.placeAtSpawn(); r.tick();
    expect(r.p.skyLance!.state).toBe('ready'); expect(r.p.foot.grounded).toBe(true);
    r.attach(); const velocity = r.p.foot.velocity.toArray(); r.p.disableSkyLance();
    expect(r.p.skyLance).toBeNull(); expect(r.p.foot.velocity.toArray()).toEqual(velocity);
  });
  it('mount transition immediately clears tether before a subsequent fixed step', () => {
    const r = groundedRig();
    // Exercise the real transition entry without depending on the companion pathfinding fixture.
    (r.p as unknown as { startMount(): void }).startMount();
    expect(r.p.mode).toBe('mounting'); expect(r.p.skyLance!.state).toBe('ready'); expect(r.p.skyLance!.rope).toBeNull();
    const input = emptyFrame(); input.pressed.lance = true; input.lanceHeld = true;
    stepInput(r.p, input); expect(r.p.skyLance!.charging).toBe(false);
  });
  it('detaches at a safe wall contact when the rope bound is incompatible', () => {
    const r = rig(); r.attach(); const world = new TraversalWorld(r.terrain);
    r.terrain.colliders.add({ kind: 'box', x: 5004, y: 1001, z: 5000, hx: .01, hy: 20, hz: 20, yaw: 0 });
    r.p.foot.position.set(5006, 1000, 5000); r.p.foot.velocity.set(-40, 0, 0);
    r.p.skyLance!.rope = { anchor: new V(5000, 1001, 5000), length: 3 };
    // Isolate constraint/body arbitration; obstruction rejection has separate real-world coverage.
    r.p.skyLance!.world.sweep = (from, to, radius, ignore) => radius === .02 ? null : world.sweep(from, to, radius, ignore);
    r.tick(); expect(r.p.skyLance!.rope).toBeNull(); expect(r.p.skyLance!.reason).toBe('Contact conflicts with tether');
    expect(r.p.foot.position.x).toBeGreaterThanOrEqual(5004.36); expect(r.p.skyLance!.recover()).toBe(true);
  });
  it.each(['flying', 'landed', 'mounting', 'dismounting'] as const)('%s cannot retain equipment or cast across a held-button mode change', mode => {
    const r = rig(); r.attach();
    (r.p as unknown as { setMode(mode: string): void }).setMode(mode);
    expect(r.p.skyLance!.state).toBe('ready'); expect(r.p.skyLance!.rope).toBeNull();
    const input = emptyFrame(); input.pressed.lance = true; input.lanceHeld = true; stepInput(r.p, input);
    expect(r.p.skyLance!.charging).toBe(false);
    (r.p as unknown as { setMode(mode: string): void }).setMode('onFoot');
    input.pressed.lance = false; stepInput(r.p, input);
    expect(r.p.skyLance!.state).toBe('ready'); expect(r.p.skyLance!.charging).toBe(false);
  });
  it('release remains freefall until a sustained deliberate call', () => {
    const r = rig(); r.attach(); const v = r.p.foot.velocity.clone(); r.tick(false, false, true);
    expect(r.p.skyLance!.rope).toBeNull(); expect(r.p.mode).toBe('traversing');
    // Only bounded air resistance acts during this simulation step; release adds no impulse.
    expect(r.p.foot.velocity.x).toBeLessThanOrEqual(v.x);
    expect(r.p.foot.velocity.x).toBeGreaterThan(v.x * .99);
    for (let i = 0; i < 300; i++) r.tick(); expect(r.p.mode).toBe('traversing');
    const call = emptyFrame(); call.callHeld = true;
    for (let i = 0; i < 20; i++) { r.p.latchPresses(call); r.p.fixedUpdate(dt, call, 0); }
    expect(r.p.mode).toBe('traversing'); r.tick();
    for (let i = 0; i < 47; i++) { r.p.latchPresses(call); r.p.fixedUpdate(dt, call, 0); }
    expect(r.p.mode).toBe('traversing');
    r.p.latchPresses(call); r.p.fixedUpdate(dt, call, 0); expect(r.p.mode).toBe('falling');
    for (let i = 0; i < 100; i++) r.tick(); expect(r.p.mode).toBe('flying');
  });
  it('recovers at the cloud boundary without an unsolicited swoop', () => {
    const r = rig(); let caught = 0; r.events.on('caught', () => caught++);
    r.p.foot.position.set(5000, r.terrain.layout.cloudFloor - 1, 5000); r.p.foot.grounded = false;
    r.tick(); r.tick(); expect(r.p.mode).toBe('respawning'); expect(r.p.companion.state).not.toBe('swoop'); expect(caught).toBe(0);
    expect(r.p.skyLance!.state).toBe('ready');
  });
  it('holding call cannot interrupt a valid swing', () => {
    const r = rig(); r.attach(); const call = emptyFrame(); call.callHeld = true;
    for (let i = 0; i < 180; i++) { r.p.latchPresses(call); r.p.fixedUpdate(dt, call, 0); }
    expect(r.p.skyLance!.rope).not.toBeNull(); expect(r.p.mode).toBe('traversing');
  });
  it('directional input turns an attached swing without powering it', () => {
    function run(moveX: number, moveY: number) {
      const r = rig(); r.attach(); const input = emptyFrame();
      input.foot.moveX = moveX; input.foot.moveY = moveY;
      const rope=r.p.skyLance!.rope!;
      const energy=()=>.5*r.p.foot.velocity.lengthSq()+18*(r.p.foot.position.y+1-rope.anchor.y);
      let previous=energy();
      for (let i = 0; i < 720; i++) {
        r.p.latchPresses(input); r.p.fixedUpdate(dt, input, 0);
        expect(r.p.skyLance!.rope).toBe(rope);expect(energy()).toBeLessThanOrEqual(previous+1e-7);previous=energy();
        expect(r.p.foot.position.clone().add(new V(0,1,0)).distanceTo(rope.anchor)).toBeLessThanOrEqual(rope.length+1e-6);
      }
      return [...r.p.foot.position.toArray(), ...r.p.foot.velocity.toArray()];
    }
    const neutral=run(0,0);expect(run(1,1)).not.toEqual(neutral);expect(run(-1,-1)).not.toEqual(neutral);
  });
  it('dive tilt falls faster than a spread brake pose while steering remains bounded', () => {
    function fall(tilt: number) {
      const r = rig(); r.p.foot.position.set(5000, 1000, 5000); r.p.foot.grounded = false; r.p.foot.velocity.set(8, 0, 0);
      const input = emptyFrame(); input.foot.moveY = tilt;
      for (let i = 0; i < 360; i++) { r.p.latchPresses(input); r.p.fixedUpdate(dt, input, 0); }
      return { velocity: r.p.foot.velocity.clone(), tilt: r.p.freefallTilt, mode: r.p.mode };
    }
    const dive = fall(1), brake = fall(-1);
    expect(dive.mode).toBe('traversing'); expect(brake.mode).toBe('traversing');
    expect(-dive.velocity.y).toBeGreaterThan(-brake.velocity.y * 1.5);
    expect(Math.abs(dive.velocity.x)).toBeLessThan(.01);expect(brake.velocity.x).toBeGreaterThanOrEqual(0);expect(brake.velocity.x).toBeLessThan(.01);
    expect(dive.velocity.z).toBeGreaterThan(10);expect(Math.abs(brake.velocity.z)).toBeLessThan(.01);
    expect(Math.hypot(dive.velocity.x,dive.velocity.z)).toBeLessThanOrEqual(18);expect(Math.hypot(brake.velocity.x,brake.velocity.z)).toBeLessThanOrEqual(18);
    expect(dive.tilt).toBeGreaterThan(.99); expect(brake.tilt).toBeLessThan(-.99);
  });
  it.each([[-1, 9], [0, 13], [1, 18]])('player freefall tilt %s settles to %s m/s and exposes its pose', (tilt, limit) => {
    const r = rig(); r.p.foot.position.set(5000, 1000, 5000); r.p.foot.grounded = false;
    r.p.foot.velocity.set(8, 0, 0); const input = emptyFrame(); input.foot.moveY = tilt;
    for (let i = 0; i < 1200; i++) { stepInput(r.p, input); r.p.update(dt, 1); }
    expect(r.p.mode).toBe('traversing'); expect(r.p.foot.velocity.y).toBeCloseTo(-limit, 4);
    expect(r.p.riderPose.freefallTilt).toBeCloseTo(tilt, 5);
    expect(r.p.riderPose.equipment).toBe('bracer'); expect(r.p.skyLance!.state).toBe('ready');
  });
  it('recovery never reels an attached rope and does not consume the release velocity', () => {
    const r = rig(); r.attach(); r.tick(false, true); expect(r.p.skyLance!.rope).not.toBeNull();
    r.tick(false, false, true); const v = r.p.foot.velocity.clone(); r.tick(false, true);
    expect(r.p.skyLance!.state).toBe('ready'); expect(r.p.foot.velocity.x).toBeGreaterThan(v.x * .99);
  });
  it('teleport resets equipment, queued presses and traversal', () => {
    const r = rig(); r.attach(); const input = emptyFrame(); input.pressed.lance = true; r.p.latchPresses(input);
    r.p.teleport(new V(LAYOUT.spawn.position[0], 10000, LAYOUT.spawn.position[2]), 0, 'onFoot');
    expect(r.p.mode).toBe('onFoot'); expect(r.p.skyLance!.state).toBe('ready'); r.tick(); expect(r.p.skyLance!.state).toBe('ready');
  });
  it('restores grounded walking on contact', () => {
    const r = rig(); r.attach(); r.tick(false, false, true); r.p.teleport(new V(LAYOUT.spawn.position[0], 10000, LAYOUT.spawn.position[2]), 0, 'onFoot');
    r.p.foot.position.y += .01; r.p.foot.velocity.set(0, -1, 0); r.p.foot.grounded = false;
    const input = emptyFrame(); input.pressed.lance = true; input.aim = new V(0, 1, 0);
    r.p.latchPresses(input); r.p.fixedUpdate(dt, input, 0);
    expect(r.p.mode).toBe('onFoot'); expect(r.p.foot.grounded).toBe(true);
  });
  it('retains the throw direction from a press on a frame with no fixed step', () => {
    const r = rig(), press = emptyFrame(); press.pressed.lance = true; press.aim = new V(1, 0, 0);
    r.p.latchPresses(press);
    const next = emptyFrame(); next.aim = new V(0, 0, 1); r.p.latchPresses(next);
    r.p.fixedUpdate(dt, next, 0);
    expect(r.p.skyLance!.direction.x).toBeGreaterThan(.99); expect(r.p.skyLance!.direction.z).toBe(0);
  });

  it('casts immediately, releases on button-up and automatically recovers without recasting a hold', () => {
    const r = rig(), input = emptyFrame(); input.pressed.lance = true; input.lanceHeld = true; input.aim = new V(0, 1, 0);
    stepInput(r.p, input); expect(r.p.skyLance!.state).toBe('projectile');
    expect(r.p.skyLance!.velocity.y).toBeCloseTo(119.95, 5);
    input.pressed.lance = false; stepInput(r.p, input); expect(r.p.skyLance!.state).toBe('projectile');
    input.lanceHeld = false; input.pressed.lanceRelease = true; stepInput(r.p, input);
    expect(r.p.skyLance!.state).toBe('spent'); input.pressed.lanceRelease = false;
    for (let i = 0; i < 44; i++) stepInput(r.p, input);
    expect(r.p.skyLance!.state).toBe('ready');
    input.lanceHeld = true;
    for (let i = 0; i < 60; i++) stepInput(r.p, input);
    expect(r.p.skyLance!.state).toBe('ready');
  });
  it('toggle interaction retains on release and detaches on the next fresh press', () => {
    const r = rig(); r.attach(); r.p.lanceInteraction = 'toggle';
    const input = emptyFrame(); input.pressed.lanceRelease = true; stepInput(r.p, input);
    expect(r.p.skyLance!.rope).not.toBeNull();
    input.pressed.lanceRelease = false; input.pressed.lance = true; stepInput(r.p, input);
    expect(r.p.skyLance!.rope).toBeNull(); expect(r.p.skyLance!.state).toBe('spent');
  });
  it('buffers release across a frame without a fixed step without overwriting the cast aim', () => {
    const r = rig(), press = emptyFrame(); press.pressed.lance = true; press.aim = new V(1, 0, 0);
    r.p.latchPresses(press);
    const release = emptyFrame(); release.pressed.lanceRelease = true; release.aim = new V(0, 0, 1); r.p.latchPresses(release);
    r.p.fixedUpdate(dt, emptyFrame(), 0);
    expect(r.p.skyLance!.state).toBe('spent'); expect(r.p.skyLance!.direction.x).toBe(1);
  });
  it('cancels a pending projectile on lost input ownership and requires a fresh press', () => {
    const r = rig(), input = emptyFrame(); input.pressed.lance = true; input.lanceHeld = true;
    stepInput(r.p, input); r.p.cancelLanceWindup(); input.pressed.lance = false;
    for (let i = 0; i < 120; i++) stepInput(r.p, input);
    expect(r.p.skyLance!.state).toBe('ready'); r.tick(); r.tick(true);
    expect(r.p.skyLance!.state).toBe('projectile');
  });
  it('a zero-duration step does not consume equipment input or change velocity', () => {
    const r = rig(); r.attach(); const v = r.p.foot.velocity.clone(), input = emptyFrame(); input.pressed.lanceRelease = true;
    r.p.latchPresses(input); r.p.fixedUpdate(0, input, 0);
    expect(r.p.skyLance!.rope).not.toBeNull(); expect(r.p.foot.velocity.toArray()).toEqual(v.toArray());
    r.p.fixedUpdate(dt, emptyFrame(), 0); expect(r.p.skyLance!.rope).toBeNull();
  });
});

describe('fixed simulation independent of presentation rate', () => {
  it('matches at 30/60/120/144 FPS and jittered render intervals', () => {
    function run(intervals: number[]) {
      const r = rig(); r.attach(); let acc = 0, steps = 0, frame = 0;
      while (steps < 240) {
        const elapsed = intervals[frame++ % intervals.length]; acc += elapsed;
        const input = emptyFrame(); r.p.latchPresses(input);
        while (acc + 1e-12 >= dt && steps < 240) { r.p.fixedUpdate(dt, input, 0); acc -= dt; steps++; }
        r.p.update(elapsed, Math.max(0, Math.min(1, acc / dt)));
      }
      return [...r.p.foot.position.toArray(), ...r.p.foot.velocity.toArray(), r.p.skyLance!.rope!.length];
    }
    const baseline = run([1 / 120]);
    for (const intervals of [[1 / 30], [1 / 60], [1 / 144], [.004, .021, .009, .017]]) {
      run(intervals).forEach((v, i) => expect(v).toBeCloseTo(baseline[i], 10));
    }
  });
  it('matches freefall steering and a buffered waist burst across presentation rates',()=>{
    function run(intervals:number[]){
      const r=rig();r.p.foot.position.set(5000,1000,5000);r.p.foot.grounded=false;r.p.foot.velocity.set(0,-3,8);r.tick();
      let acc=0,steps=0,frame=0,bursts=0;
      while(steps<360){const elapsed=intervals[frame++%intervals.length];acc+=elapsed;
        while(acc+1e-12>=dt&&steps<360){const input=emptyFrame();input.foot.moveX=steps<200?.5:-.5;input.foot.moveY=steps<200?.4:-.5;input.pressed.jump=steps===80||steps===280;const cooldown=r.p.airBoost.cooldown;stepInput(r.p,input);if(r.p.airBoost.cooldown>cooldown)bursts++;acc-=dt;steps++;}
        r.p.update(elapsed,Math.max(0,Math.min(1,acc/dt)));
      }
      return [...r.p.foot.position.toArray(),...r.p.foot.velocity.toArray(),r.p.airBoost.remaining,r.p.airBoost.cooldown,bursts];
    }
    const baseline=run([1/120]);expect(baseline.at(-1)).toBe(2);for(const timing of [[1/30],[1/60],[1/144],[.004,.021,.009,.017]])run(timing).forEach((v,i)=>expect(v).toBeCloseTo(baseline[i],10));
  });
  it('matches release, recovery and deliberate rescue across presentation rates', () => {
    function run(intervals: number[]) {
      const r = rig(); r.attach(); let acc = 0, steps = 0, frame = 0;
      while (steps < 360) {
        const elapsed = intervals[frame++ % intervals.length]; acc += elapsed;
        while (acc + 1e-12 >= dt && steps < 360) {
          const input = emptyFrame(); input.pressed.lanceRelease = steps === 100; input.pressed.recoverLance = steps === 110;
          input.callHeld = steps >= 160; stepInput(r.p, input); acc -= dt; steps++;
        }
        r.p.update(elapsed, Math.max(0, Math.min(1, acc / dt)));
      }
      return { mode: r.p.mode, equipment: r.p.skyLance!.state, anchor: r.p.skyLance!.anchorId,
        physical: [...r.p.foot.position.toArray(), ...r.p.foot.velocity.toArray(), ...r.p.model.state.position.toArray()] };
    }
    const baseline = run([1 / 120]); expect(baseline.mode).toBe('flying'); expect(baseline.equipment).toBe('ready');
    for (const timing of [[1 / 30], [1 / 60], [1 / 144], [.004, .021, .009, .017]]) {
      const result = run(timing); expect(result.mode).toBe(baseline.mode); expect(result.equipment).toBe(baseline.equipment);
      expect(result.anchor).toBeNull(); result.physical.forEach((value, i) => expect(value).toBeCloseTo(baseline.physical[i], 10));
    }
  });
});

describe('recharge ownership across traversal modes',()=>{
  it('recharges on the fixed clock while swinging, but cannot fire on the rope',()=>{
    const r=rig();r.attach();const input=emptyFrame();input.lanceHeld=true;
    r.p.airBoost.cooldown=.5;
    for(let i=0;i<60;i++)stepInput(r.p,input);
    expect(r.p.airBoost.available).toBe(true);expect(r.p.skyLance!.rope).not.toBeNull();
    input.pressed.jump=true;stepInput(r.p,input);expect(r.p.airBoost.available).toBe(true);expect(r.p.airBoost.remaining).toBe(0);
  });
  it('landing, mounting and saddle jumps cannot refill the cooldown; explicit reset can',()=>{
    const r=groundedRig();r.p.airBoost.cooldown=1.75;r.tick();expect(r.p.airBoost.cooldown).toBeCloseTo(1.75-dt,10);
    const modes=r.p as unknown as {setMode(mode:string):void;jumpFromWyvern():void};
    modes.setMode('mounting');expect(r.p.airBoost.available).toBe(false);modes.setMode('flying');expect(r.p.airBoost.available).toBe(false);
    modes.jumpFromWyvern();expect(r.p.airBoost.available).toBe(false);
    r.p.fixedUpdate(0,emptyFrame(),0);expect(r.p.airBoost.cooldown).toBeCloseTo(1.75-dt,10);
    r.p.teleport(new V(5000,1000,5000),0,'onFoot');expect(r.p.airBoost.available).toBe(true);
  });
  it('permits a second airborne burst after exactly 1.75 seconds of simulation',()=>{
    const r=rig();r.p.foot.position.set(5000,1000,5000);r.p.foot.grounded=false;r.tick();
    const input=emptyFrame();input.pressed.jump=true;stepInput(r.p,input);expect(r.p.airBoost.cooldown).toBe(1.75);
    input.pressed.jump=false;for(let i=0;i<209;i++)stepInput(r.p,input);expect(r.p.airBoost.available).toBe(false);
    input.pressed.jump=true;stepInput(r.p,input);expect(r.p.airBoost.cooldown).toBe(1.75);expect(r.p.foot.velocity.y).toBeGreaterThan(11.8);
  });
});

describe('one final line-obstruction check per movement step',()=>{
  it('validates static identity before dispatch and the resolved line once after movement',()=>{
    const r=rig();r.attach();const l=r.p.skyLance!,sweep=vi.spyOn(l.world,'sweep'),valid=vi.spyOn(l,'validate');
    const input=emptyFrame();input.lanceHeld=true;stepInput(r.p,input);
    expect(valid.mock.calls.map(args=>args[1]??true)).toEqual([false,true]);
    expect(sweep.mock.calls.filter(args=>args[2]===.02)).toHaveLength(1);
  });
  it('detaches an invalid identity before integration, and an obstructed final line within the step',()=>{
    const r=rig();r.attach();const l=r.p.skyLance!,input=emptyFrame();input.lanceHeld=true;
    l.world.anchorValid=()=>false;stepInput(r.p,input);expect(l.reason).toBe('Anchor invalidated');expect(l.rope).toBeNull();
    l.reset();r.attach();l.world.sweep=(from,_to,radius)=>radius===.02?{fraction:.5,point:from.clone(),normal:new V(0,1,0),anchorId:null}:null;
    stepInput(r.p,input);expect(l.reason).toBe('Tether obstructed');expect(l.rope).toBeNull();expect(r.p.mode).toBe('traversing');
  });
});


describe('manual tether pull lifecycle',()=>{
  it('runs once per fresh A press, blocks rescue and clears on release/reset',()=>{
    const r=rig();r.attach();const input=emptyFrame();input.pressed.jump=true;input.callHeld=true;
    stepInput(r.p,input);expect(r.p.skyLance!.pullTime).toBeGreaterThan(0);
    input.pressed.jump=false;for(let i=0;i<120;i++)stepInput(r.p,input);
    expect(r.p.skyLance!.pullTime).toBe(0);expect(r.p.mode).toBe('traversing');expect(r.p.skyLance!.rope).not.toBeNull();
    const v=r.p.foot.velocity.clone();r.p.skyLance!.detach();expect(r.p.foot.velocity.toArray()).toEqual(v.toArray());expect(r.p.skyLance!.pullTime).toBe(0);
    r.p.teleport(new V(5000,1000,5000),0,'flying',20);expect(r.p.skyLance!.pullTime).toBe(0);
  });
  it('keeps deliberate grounded jump authority with only one walker integration',()=>{
    const r=groundedRig(),spy=vi.spyOn(r.p.foot,'step'),input=emptyFrame();input.pressed.jump=true;
    stepInput(r.p,input);expect(spy).toHaveBeenCalledTimes(1);expect(r.p.foot.velocity.y).toBeGreaterThan(0);expect(r.p.mode).toBe('traversing');
    input.pressed.jump=false;stepInput(r.p,input);expect(spy).toHaveBeenCalledTimes(1);expect(r.p.skyLance!.pullTime).toBeGreaterThan(0);
  });
  it('is deterministic across presentation rates including repeated pulls and release',()=>{
    function run(timings:number[]){
      const r=rig();r.attach();let acc=0,n=0,frame=0;
      while(n<180){const elapsed=timings[frame++%timings.length];acc+=elapsed;
        while(acc+1e-12>=dt&&n<180){const input=emptyFrame();input.foot.moveX=.3;input.foot.moveY=.5;input.pressed.jump=n===10||n===80;input.pressed.lanceRelease=n===140;stepInput(r.p,input);acc-=dt;n++;}
        r.p.update(elapsed,Math.max(0,Math.min(1,acc/dt)));
      }
      return [...r.p.foot.position.toArray(),...r.p.foot.velocity.toArray(),r.p.skyLance!.pullTime];
    }
    const baseline=run([1/120]);for(const timings of [[1/30],[1/60],[1/144],[.004,.021,.009,.017]])run(timings).forEach((v,i)=>expect(v).toBeCloseTo(baseline[i],10));
  });
});

describe('ground recall of an independently flying dragon',()=>{
  it.each(['harrier','skimmer','galewing','ironback'] as const)('%s returns midair to its grounded rider without resetting or mounting them',breed=>{
    const r=rig();r.p.setBreed(breed);r.p.teleport(new V(5000,1000,5000),0,'flying',30);r.tick();
    const call=emptyFrame();call.callHeld=true;for(let i=0;i<48;i++)stepInput(r.p,call);
    r.terrain.colliders.add({kind:'box',x:5000,y:899,z:5050,hx:35,hy:1,hz:35,yaw:0});
    r.p.foot.position.set(5000,900,5050);r.p.foot.velocity.set(0,-1,0);r.tick();expect(r.p.mode).toBe('onFoot');r.tick();
    const before=r.p.model.state.position.clone();
    for(let i=0;i<48;i++)stepInput(r.p,call);
    expect(r.p.companion.state).toBe('hop');expect(r.p.model.state.position.distanceTo(before)).toBeLessThan(18);
    r.p.update(dt,1);expect(r.p.wyvernPose.airborne).toBe(true);expect(r.p.riderPose.mounted).toBe(false);
    for(let i=0;i<720;i++)r.tick();expect(r.p.companion.state).toBe('idle');expect(r.p.mode).toBe('onFoot');expect(r.p.canMount).toBe(true);
    r.tick();for(let i=0;i<48;i++)stepInput(r.p,call);expect(r.p.mode).toBe('mounting');
  });
});


describe('edge contact preserves an attached line',()=>{
  it('stops at the previous visible endpoint instead of dropping, and release remains deliberate',()=>{
    const r=rig();r.attach();const p=r.p,l=p.skyLance!,start=p.foot.position.clone();p.foot.velocity.set(30,0,0);
    l.world.sweep=(from,_to,radius)=>radius===.02&&from.x>start.x+.01?{fraction:.96,point:from.clone(),normal:new V(-1,0,0),anchorId:'fixture'}:null;
    const input=emptyFrame();input.lanceHeld=true;stepInput(p,input);
    expect(l.rope).not.toBeNull();expect(p.foot.position.toArray()).toEqual(start.toArray());expect(p.foot.velocity.length()).toBe(0);expect(l.reason).toBe('Line caught at edge');
    for(let i=0;i<120;i++)stepInput(p,input);expect(l.rope).not.toBeNull();expect(p.mode).toBe('traversing');
    input.pressed.lanceRelease=true;stepInput(p,input);expect(l.rope).toBeNull();expect(l.reason).toBe('Released');
  });
});


it('does not give a stalled edge contact unpowered energy or double movement ownership',()=>{
  const r=rig();r.attach();const p=r.p,l=p.skyLance!,start=p.foot.position.clone();p.foot.velocity.set(30,0,0);
  l.world.sweep=(from,_to,radius)=>radius===.02&&from.x>start.x+.01?{fraction:.96,point:from.clone(),normal:new V(-1,0,0),anchorId:'fixture'}:null;
  const energy=()=>.5*p.foot.velocity.lengthSq()+18*p.foot.position.y,initial=energy(),walker=vi.spyOn(p.foot,'step');
  const input=emptyFrame();input.lanceHeld=true;
  for(let i=0;i<120;i++){stepInput(p,input);expect(energy()).toBeLessThanOrEqual(initial+1e-8);}
  expect(walker).not.toHaveBeenCalled();expect(l.rope).not.toBeNull();
});
