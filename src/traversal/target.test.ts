import { describe,expect,it } from 'vitest';
import { Vector3 as V } from 'three';
import { Terrain } from '../world/terrain';
import { LAYOUT } from '../world/layout';
import { TraversalWorld } from './sweep';
import { centeredCast, predictCenteredTarget, predictTarget } from './target';
import { SkyLance } from './SkyLance';
describe('ballistic static-surface range indicator',()=>{
  it('forecasts the actual first solid and attachment point without moving live equipment',()=>{
    const t=new Terrain({...LAYOUT,islands:[],spires:[],arches:[]});
    t.colliders.add({kind:'box',x:0,y:1000,z:20,hx:4,hy:5,hz:.001,yaw:0});
    t.colliders.add({kind:'sphere',x:0,y:1000,z:30,radius:2});
    const world=new TraversalWorld(t),origin=new V(0,1000,0),aim=new V(0,0,1),v=new V(0,-4,3),live=new SkyLance(world);
    const forecast=predictTarget(world,origin,aim,v);expect(forecast.state).toBe('reachable');expect(forecast.distance).toBeLessThan(21);
    live.throw(origin,aim,v);for(let i=0;i<240&&live.state==='projectile';i++)live.step(1/120,origin);
    expect(live.anchorId).toBe(forecast.anchorId);expect(live.position.toArray()).toEqual(forecast.point.toArray());expect(origin.toArray()).toEqual([0,1000,0]);expect(v.toArray()).toEqual([0,-4,3]);
  });
  it('keeps physical anchor identity independent of render/preview discovery order',()=>{
    function run(preview:boolean){
      const t=new Terrain({...LAYOUT,islands:[],spires:[],arches:[]});
      t.colliders.add({kind:'sphere',x:0,y:1000,z:12,radius:2});t.colliders.add({kind:'sphere',x:10,y:1000,z:12,radius:2});
      const w=new TraversalWorld(t),p=new V(0,1000,0),aim=new V(0,0,1);
      if(preview)predictTarget(w,new V(10,1000,0),aim,new V());
      const live=new SkyLance(w);live.throw(p,aim,new V());for(let i=0;i<240&&live.state==='projectile';i++)live.step(1/120,p);
      return {id:live.anchorId,anchor:live.rope!.anchor.toArray(),length:live.rope!.length};
    }
    expect(run(true)).toEqual(run(false));
  });
  it('reports no in-range surface, too-close obstruction, and malformed aim',()=>{
    const t=new Terrain({...LAYOUT,islands:[],spires:[],arches:[]}),w=new TraversalWorld(t),p=new V(0,1000,0);
    expect(predictTarget(w,p,new V(0,0,1),new V()).state).toBe('out-of-range');
    t.colliders.add({kind:'box',x:0,y:1000,z:1,hx:2,hy:2,hz:.001,yaw:0});
    expect(predictTarget(w,p,new V(0,0,1),new V()).state).toBe('blocked');
    expect(predictTarget(w,p,new V(NaN,0,1),new V()).state).toBe('blocked');
  });
  it('predicts an island underside and respects the maximum line length',()=>{
    const t=new Terrain(LAYOUT),s=t.islands[0],y=s.bottomHeight(s.def.x,s.def.z),w=new TraversalWorld(t);
    const p=new V(s.def.x,y-20,s.def.z),near=predictTarget(w,p,new V(0,1,0),new V());
    expect(near.state).toBe('reachable');expect(near.anchorId).toMatch(/^rock-island-/);expect(near.distance).toBeLessThan(20);
    p.y=y-70;expect(predictTarget(w,p,new V(0,1,0),new V()).state).toBe('out-of-range');
  });
});

describe('fixed centre targeting',()=>{
  const empty=()=>new Terrain({...LAYOUT,islands:[],spires:[],arches:[]});
  it('agrees with the centre-ray surface and real projectile with an offset camera and inherited movement',()=>{
    const t=empty();t.colliders.add({kind:'box',x:0,y:1000,z:25,hx:10,hy:10,hz:.001,yaw:0});
    const w=new TraversalWorld(t),camera=new V(-2,1002,-6),origin=new V(1,1000,0),direction=new V(0,0,1),velocity=new V(12,-9,3);
    const selected=centeredCast(w,camera,direction,origin,velocity),cue=predictCenteredTarget(w,camera,direction,origin,velocity);
    expect(cue.state).toBe('reachable');expect(selected.hit?.anchorId).toBe(cue.anchorId);
    const live=new SkyLance(w);live.throw(origin,selected.aim,velocity);
    for(let i=0;i<240&&live.state==='projectile';i++)live.step(1/120,origin);
    expect(live.anchorId).toBe(cue.anchorId);expect(live.position.toArray()).toEqual(cue.point.toArray());
    expect(live.position.x).toBeCloseTo(camera.x,2);expect(live.position.y).toBeCloseTo(camera.y,2);
    expect(camera.toArray()).toEqual([-2,1002,-6]);expect(origin.toArray()).toEqual([1,1000,0]);expect(velocity.toArray()).toEqual([12,-9,3]);
  });
  it('does not select a nearby surface outside the centre ray',()=>{
    const t=empty();t.colliders.add({kind:'sphere',x:3,y:1000,z:20,radius:1});
    const w=new TraversalWorld(t),camera=new V(0,1000,-6),origin=new V(2,1000,0),direction=new V(0,0,1);
    expect(centeredCast(w,camera,direction,origin,new V()).hit).toBeNull();
    expect(predictCenteredTarget(w,camera,direction,origin,new V()).state).toBe('out-of-range');
  });
  it('attaches near the unchanged 65 m limit in under 0.56 seconds',()=>{
    const t=empty();t.colliders.add({kind:'box',x:0,y:1000,z:65,hx:4,hy:4,hz:.001,yaw:0});
    const w=new TraversalWorld(t),origin=new V(0,1000,0),selected=centeredCast(w,new V(0,1000,-6),new V(0,0,1),origin,new V()),live=new SkyLance(w);
    live.throw(origin,selected.aim,new V());let steps=0;
    while(steps<240&&live.state==='projectile'){live.step(1/120,origin);steps++;}
    expect(live.rope).not.toBeNull();expect(steps/120).toBeLessThan(.56);expect(steps/120).toBeGreaterThan(.5);
    expect(live.rope!.length).toBeLessThanOrEqual(65);
  });
  it('keeps green off when an intervening solid blocks the harness projectile despite a clear camera ray',()=>{
    const t=empty();t.colliders.add({kind:'box',x:0,y:1000,z:30,hx:8,hy:8,hz:.001,yaw:0});
    t.colliders.add({kind:'box',x:1.55,y:1000,z:7.5,hx:.3,hy:2,hz:.15,yaw:0});
    const w=new TraversalWorld(t),camera=new V(0,1000,-6),origin=new V(2,1000,0),direction=new V(0,0,1);
    const selected=centeredCast(w,camera,direction,origin,new V()),cue=predictCenteredTarget(w,camera,direction,origin,new V());
    expect(selected.hit?.point.z).toBeGreaterThan(29);expect(cue.state).toBe('blocked');expect(cue.anchorId).not.toBe(selected.hit?.anchorId);
  });
  it('rejects camera-inside, too-close and out-of-range candidates',()=>{
    for(const z of [-6,1,66]){
      const t=empty();t.colliders.add({kind:'box',x:0,y:1000,z,hx:4,hy:4,hz:z===-6?1:.001,yaw:0});
      const w=new TraversalWorld(t),cue=predictCenteredTarget(w,new V(0,1000,-6),new V(0,0,1),new V(0,1000,0),new V());
      expect(cue.state).toBe(z===66?'out-of-range':'blocked');
    }
  });
  it('rejects an earlier island ledge off the centre ray even when its anchor is the same island',()=>{
    const world=new TraversalWorld(new Terrain(LAYOUT));
    const camera=new V(58.95,89.437,-5.1626),origin=new V(59.5,89.6075,0);
    const direction=new V(0,Math.cos(Math.PI/180),Math.sin(Math.PI/180)),velocity=new V(0,-.3,0);
    const selected=centeredCast(world,camera,direction,origin,velocity);
    const physical=predictTarget(world,origin,selected.aim,velocity);
    const cue=predictCenteredTarget(world,camera,direction,origin,velocity);
    expect(physical.state).toBe('reachable');expect(physical.anchorId).toBe(selected.hit?.anchorId);
    const relative=physical.point.clone().sub(camera);
    expect(relative.addScaledVector(direction,-relative.dot(direction)).length()).toBeGreaterThan(.16);
    expect(cue.state).toBe('blocked');
  });
});
