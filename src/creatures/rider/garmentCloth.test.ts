import {describe,expect,it} from 'vitest';
import {type MeshToonMaterial} from 'three';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import {createRiderPose} from '../../player/poses';
import {QUALITY} from '../../render/quality';
import {Rider} from './Rider';
import {buildRiderModel} from './model';
import type {ClothRig} from './clothRig';
import {riderClothSpecs} from './wardrobeModel';
import {legPoint,legSection} from './legFit';
import {B} from './rig';

const cloth=(r:Rider)=>(r as unknown as {cloth:ClothRig}).cloth;
describe('localized hanging garments',()=>{
  it.each(['scout','courier','cartographer','skyknight','travel-drape'])('%s has free cloth hems attached at the waist, not duplicated rigid skirts',outfit=>{
    const m=buildRiderModel({...DEFAULT_RIDER,outfit});
    try{
      const panels=riderClothSpecs(m.ctx,m.proof).filter(p=>p.guideSkin);
      expect(panels.length).toBe(outfit==='skyknight'?2:outfit==='cartographer'?8:4);
      for(const p of panels){
        expect(p.anchorBone.slice(0,p.cols).every(b=>b===(p.name.startsWith('sleeve')?(p.name.endsWith('--1')?B.foreArmR:B.foreArmL):B.hips))).toBe(true);
        expect(p.anchorBone.slice(p.cols).every(b=>b===-1)).toBe(true);
        expect(p.guideSkin!.length).toBe(p.rest.length);
        expect(p.config.poseRadius).toBeGreaterThan(0);
        expect(p.colliders).toContain('mount');
        expect(p.render.proofLinen).toBe(true);
      }
      expect(new Set(panels.map(p=>p.name)).size).toBe(panels.length);
    }finally{m.geometry.dispose();m.rig.skeleton.dispose();}
  });

  it.each(['scout','courier','cartographer','skyknight','travel-drape'])('%s stays bounded through sustained gust reversals, hitches and calm recovery',outfit=>{
    const r=new Rider({...DEFAULT_RIDER,outfit,headgear:'none',scarf:'none'},{quality:QUALITY.low}),pose=createRiderPose();
    try{
      let maxOffset=0,maxSeam=0;
      for(let frame=0;frame<720;frame++){
        pose.airflow.set(frame<480?(frame%120<60?80:-80):0,frame<480?5:0,frame<480?-70:0);
        r.update(frame%90===0?.2:1/60,pose,null);
        for(const p of cloth(r).pieces.filter(p=>p.guide)){
          for(let i=0;i<p.cloth.n;i++) {
            const q=i*3,offset=Math.hypot(p.cloth.pos[q]-p.guide![q],p.cloth.pos[q+1]-p.guide![q+1],p.cloth.pos[q+2]-p.guide![q+2]);
            if(!Number.isFinite(offset))throw Error(`${outfit}/${p.spec.name}/${frame}: non-finite`);
            maxOffset=Math.max(maxOffset,offset);
          }
          if(p.spec.config.sewEdges)for(let row=0;row<p.spec.rows;row++){
            const a=row*p.spec.cols*3,b=(row*p.spec.cols+p.spec.cols-1)*3;
            maxSeam=Math.max(maxSeam,Math.hypot(p.cloth.pos[a]-p.cloth.pos[b],p.cloth.pos[a+1]-p.cloth.pos[b+1],p.cloth.pos[a+2]-p.cloth.pos[b+2]));
          }
        }
      }
      expect(maxOffset).toBeLessThan(.25);expect(maxSeam).toBeLessThan(.02);
      const states=cloth(r).pieces.map(p=>p.cloth);r.setQuality(QUALITY.ultra);
      expect(cloth(r).pieces.map(p=>p.cloth)).toEqual(states);
    }finally{r.dispose();}
  });

  it('mixed tops choose their own cloth, retain wind motion, bounded seams and solver state across quality/dyes',()=>{
    const look=withGarment(withGarment({...DEFAULT_RIDER,headgear:'none',scarf:'none'},'top','scout-top'),'footwear','sandals');
    const r=new Rider(look,{quality:QUALITY.low}),pose=createRiderPose();
    try{
      const panels=cloth(r).pieces.filter(p=>p.guide);
      expect(panels).toHaveLength(4);
      let movement=0;
      for(let i=0;i<300;i++){
        pose.action='run';pose.actionTime=i/60;pose.velocity.set(0,0,5);
        pose.airflow.set(22*Math.sin(i/17),2,-30*Math.cos(i/23));
        r.update(i%40===0?.1:1/60,pose,null);
        for(const p of panels){
          for(let k=0;k<p.cloth.n;k++){
            const q=k*3,delta=Math.hypot(p.cloth.pos[q]-p.guide![q],p.cloth.pos[q+1]-p.guide![q+1],p.cloth.pos[q+2]-p.guide![q+2]);
            expect(Number.isFinite(delta)).toBe(true);
            if(k<p.spec.cols)expect(delta).toBeLessThan(1e-6);
            else {movement=Math.max(movement,delta);expect(delta).toBeLessThan(.25);}
          }
        }
      }
      expect(movement).toBeGreaterThan(.005);
      const solvers=panels.map(p=>p.cloth);
      r.setQuality(QUALITY.high);
      const next=cloth(r).pieces.filter(p=>p.guide);
      expect(next.map(p=>p.cloth)).toEqual(solvers);
      const geometries=next.map(p=>p.geo),materials=next.map(p=>p.mesh.material);
      const recolored={...look,outfitPrimary:'#86455a',outfitSecondary:'#7fa8c4'};
      r.setLook(recolored);
      expect(next.map(p=>p.geo)).toEqual(geometries);expect(next.map(p=>p.mesh.material)).toEqual(materials);
      const fresh=new Rider(recolored,{quality:QUALITY.high});
      try{const expected=cloth(fresh).pieces.filter(p=>p.guide);
        for(let i=0;i<next.length;i++){
          expect(Array.from(next[i].geo.getAttribute('color').array)).toEqual(Array.from(expected[i].geo.getAttribute('color').array));
          expect((next[i].mesh.material as MeshToonMaterial).map).toBe((expected[i].mesh.material as MeshToonMaterial).map);
        }
      }finally{fresh.dispose();}
    }finally{r.dispose();}
  });

  it.each(['slight','medium','broad'] as const)('%s: trousers, footwear and wrap envelopes share positions and deformation at joints',build=>{
    for(const trousers of ['flight','scout','courier','racer','cartographer','skyknight','travel-drape'])
    for(const footwear of ['flight-footwear','scout-footwear','courier-footwear','racer-footwear','cartographer-footwear','skyknight-footwear','sandals','none']){
      const look=withGarment(withGarment({...DEFAULT_RIDER,build},'trousers',trousers+'-trousers'),'footwear',footwear),m=buildRiderModel(look);
      try{
        for(const side of [1,-1] as const)for(const s of [m.ctx.d.thigh-.02,m.ctx.d.thigh+.02,m.ctx.d.thigh+m.ctx.d.shin-.01]){
          const p=legPoint(m.ctx,s,Math.PI/2,side,.004),r=legSection(m.ctx,s,side);
          expect(p.p.distanceTo(r.c)).toBeCloseTo(r.rf*r.radial(Math.PI/2)+.004,6);
          expect(p.skin).toEqual(r.skin);
          expect(r.skin.filter((_,i)=>i%2).reduce((a,b)=>a+b,0)).toBeCloseTo(1,6);
        }
        expect(Array.from(m.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        expect(m.geometry.index!.count/3).toBeLessThan(32000);
        expect(m.rig.skeleton.bones.length).toBe(27);
      }finally{m.geometry.dispose();m.rig.skeleton.dispose();}
    }
  });
});
