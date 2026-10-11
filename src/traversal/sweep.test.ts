import {describe,it,expect,vi} from 'vitest';
import {Vector3 as V} from 'three';
import {Terrain} from '../world/terrain';
import {LAYOUT} from '../world/layout';
import {TraversalWorld} from './sweep';
import {mulberry32} from '../core/rng';

/** Retained fine-sample reference: acceleration must not skip a previously detected rock. */
function dense(t:Terrain,from:V,to:V,radius:number):number|null {
  const spacing=Math.min(.02,Math.max(radius/2,.002)),r=radius+spacing/2;
  const count=Math.max(1,Math.ceil(from.distanceTo(to)/spacing)),p=new V(),push=new V(),normal=new V();
  for(let i=0;i<=count;i++)if(t.rockContact(p.lerpVectors(from,to,i/count),r,push,normal))return i/count;
  return null;
}
describe('accelerated analytic rock sweeps',()=>{
  it('matches the original fine lattice on seeded underside, rim and cross-island segments', {timeout:30000},()=>{
    const t=new Terrain(LAYOUT),w=new TraversalWorld(t),rng=mulberry32(1827);
    for(let i=0;i<120;i++){
      const s=t.islands[i%t.islands.length],a=rng()*Math.PI*2,rad=s.def.radius*(.15+.95*rng());
      const x=s.def.x+Math.cos(a)*rad,z=s.def.z+Math.sin(a)*rad,b=s.bottomHeight(x,z);
      const from=new V(x,b-5-rng()*20,z),to=from.clone().add(new V((rng()-.5)*30,10+rng()*35,(rng()-.5)*30));
      const expected=dense(t,from,to,.02),actual=w.sweep(from,to,.02);
      expect(actual?.exhausted,`query budget ${i}`).not.toBe(true);
      expect(!!actual,`hit ${i}: ${from.toArray()} -> ${to.toArray()}`).toBe(expected!==null);
      if(expected!==null)expect(actual!.fraction,`first contact ${i}`).toBeLessThanOrEqual(expected+1e-8);
    }
  });
  it('skips known empty intervals and reuses exact columns without skipping near-surface samples',()=>{
    const t=new Terrain(LAYOUT),s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z,y=s.bottomHeight(x,z);
    const w=new TraversalWorld(t),from=new V(x,Math.min(y-20,s.minY-20),z),hit=w.sweep(from,new V(x,y+2,z),.08)!;
    const query=vi.spyOn(t,'rockContact'),height=vi.spyOn(s,'bottomHeight'),normal=vi.spyOn(s,'bottomNormal');
    expect(w.sweep(from,hit.point,.02)).toBeNull();
    // Start at least 20 m below the enclosing bounds. At least 19 m of empty lattice
    // must be culled; retain the full near-surface lattice and its original contact radius.
    expect(query.mock.calls.length).toBeLessThan(Math.ceil(from.distanceTo(hit.point)/.01)-1900);
    // Preserve the fine lattice but evaluate the exact, immutable vertical column only once.
    expect(height.mock.calls.length).toBeLessThanOrEqual(5);expect(normal).toHaveBeenCalledTimes(1);
    expect(w.sweep(from,hit.point,.02)).toBeNull();
    expect(normal).toHaveBeenCalledTimes(2); // Cache expires at the end of each synchronous sweep.

  });
  it('keeps the complete conservative tether envelope while bounding long moving-line work',()=>{
    const t=new Terrain(LAYOUT),w=new TraversalWorld(t),s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    const from=new V(x,s.bottomHeight(x,z)-55,z),tip=w.sweep(from,new V(x,from.y+60,z),.08)!;
    expect(tip.anchorId).not.toBeNull();
    const query=vi.spyOn(t,'rockContact');
    const swung=from.clone().add(new V(8,-3,4));
    expect(w.sweep(swung,tip.point,.02,tip.anchorId!)).toBeNull();
    expect(query.mock.calls.length).toBeLessThan(1800);
    // Anchor identity never excludes its solid: a line through the island remains blocked.
    expect(w.sweep(from,new V(x,s.def.y+5,z),.02,tip.anchorId!)).not.toBeNull();
  });
  it('does not miss the retained fine-lattice contacts on seeded grazing tether paths',{timeout:30000},()=>{
    const t=new Terrain(LAYOUT),w=new TraversalWorld(t),rng=mulberry32(60713);
    for(let i=0;i<100;i++){
      const s=t.islands[i%t.islands.length],a=rng()*Math.PI*2,r=s.def.radius*(.1+.92*rng());
      const x=s.def.x+Math.cos(a)*r,z=s.def.z+Math.sin(a)*r,y=s.bottomHeight(x,z);
      const from=new V(x,y-2-rng()*15,z),to=from.clone().add(new V((rng()-.5)*24,2+rng()*24,(rng()-.5)*24));
      if(dense(t,from,to,.02)!==null)expect(w.sweep(from,to,.02,'line'),`grazing tether ${i}`).not.toBeNull();
    }
  });
  it('bounds the additional underside clearance at an exact vertical column',()=>{
    const t=new Terrain({...LAYOUT,islands:[LAYOUT.islands[0]],spires:[],arches:[]}),s=t.islands[0],w=new TraversalWorld(t);
    const x=s.def.x+s.def.radius*.35,z=s.def.z,bottom=s.bottomHeight(x,z),ny=-s.bottomNormal(x,z,new V()).y;
    const point=(gap:number)=>new V(x,bottom-gap/ny,z);
    // Distances are measured perpendicular to the shared contact plane, not vertically.
    for(const gap of [.02499,.02501,.03999,.04001]){
      const p=point(gap),old=dense(t,p,p,.02),hit=w.sweep(p,p,.02,'line');
      expect(old!==null,`old clearance ${gap}`).toBe(gap<.025);
      expect(!!hit,`new clearance ${gap}`).toBe(gap<.04);
      if(hit){expect(hit.point).toEqual(p);expect(hit.exhausted).not.toBe(true);}
    }
  });
  it('keeps contact and just-clear boundaries on both sides of the island angular seam',()=>{
    const t=new Terrain({...LAYOUT,islands:[LAYOUT.islands[0]],spires:[],arches:[]}),s=t.islands[0],w=new TraversalWorld(t);
    const results=[];
    for(const angle of [-Math.PI+1e-7,Math.PI-1e-7]){
      const r=s.outlineRadius(angle),x=s.def.x+Math.cos(angle)*r,z=s.def.z+Math.sin(angle)*r;
      const y=(s.bottomHeight(x,z)+s.topHeight(x,z))*.5;
      const point=(gap:number)=>new V(s.def.x+Math.cos(angle)*(r+gap),y,s.def.z+Math.sin(angle)*(r+gap));
      const result=[.02499,.02501,.03999,.04001].map(gap=>{
        const p=point(gap),old=dense(t,p,p,.02),hit=w.sweep(p,p,.02,'line');
        expect(old!==null,`seam old ${angle}/${gap}`).toBe(gap<.025);
        expect(!!hit,`seam new ${angle}/${gap}`).toBe(gap<.04);
        if(hit)expect(hit.exhausted).not.toBe(true);
        return !!hit;
      });
      results.push(result);
    }
    expect(results[0]).toEqual(results[1]);
  });
  it('covers a spire tangent between lattice samples and keeps a just-clear tangent open',()=>{
    const t=new Terrain({...LAYOUT,islands:[],arches:[],spires:[{id:912,x:0,z:0,tipY:100,bellyY:140,topY:180,bellyRadius:12,topRadius:3,seed:27}]}),s=t.spires[0],w=new TraversalWorld(t);
    const y=135,r=s.baseRadiusAt(y)*.97;
    for(const gap of [.01999,.02501,.0399,.0401]){
      // The closest point at z=0 falls between the two coarse sample endpoints.
      const from=new V(r+gap,y,-.017),to=new V(r+gap,y,.023);
      const old=dense(t,from,to,.02),hit=w.sweep(from,to,.02,'line');
      if(gap<.025)expect(old).not.toBeNull();
      expect(!!hit,`tangent ${gap}`).toBe(gap<.04);
      if(hit){expect(hit.exhausted).not.toBe(true);expect(hit.fraction).toBeGreaterThanOrEqual(0);expect(hit.fraction).toBeLessThanOrEqual(1);}
    }
  });
});
