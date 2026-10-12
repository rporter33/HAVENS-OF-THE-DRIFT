import {describe,expect,it} from 'vitest';
import {Vector3} from 'three';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import {createRiderPose} from '../../player/poses';
import {QUALITY} from '../../render/quality';
import {B} from './rig';
import {Rider} from './Rider';
import type {ClothRig} from './clothRig';
import {buildRiderModel,type RiderModel} from './model';
import {riderClothSpecs} from './wardrobeModel';
import {capsuleExit} from './clothContact';

const cloth=(r:Rider)=>(r as unknown as {cloth:ClothRig}).cloth;
const model=(r:Rider)=>(r as unknown as {model:RiderModel}).model;
describe('garment behavior QA',()=>{
  it('capsule exits retain the chosen surface side, including axial and spherical contacts',()=>{
    const cap={ax:0,ay:0,az:0,bx:0,by:1,bz:0,r:.1};
    expect(capsuleExit(0,.5,-.08,0,0,1,cap,.01)).toBeCloseTo(.19,8);
    expect(capsuleExit(0,.5,0,0,1,0,cap,.01)).toBeCloseTo(.61,8);
    expect(capsuleExit(0,0,0,1,0,0,{...cap,by:0},.01)).toBeCloseTo(.11,8);
  });

  it('the heavier coat has lower air coupling and flutter than light linen',()=>{
    const models=['courier','scout'].map(outfit=>buildRiderModel({...DEFAULT_RIDER,outfit}));
    try{
      const [coat,linen]=models.map(m=>riderClothSpecs(m.ctx,m.proof).filter(p=>p.guideSkin));
      expect(coat.length).toBeGreaterThan(0);
      for(const p of coat){
        expect(p.config.drag).toBeLessThan(linen[0].config.drag);
        expect(p.config.flutter).toBeLessThan(linen[0].config.flutter);
        expect(p.config.damping).toBeGreaterThan(linen[0].config.damping);
        expect(p.config.poseRadius).toBeLessThan(linen[0].config.poseRadius!);
      }
    }finally{for(const m of models){m.geometry.dispose();m.rig.skeleton.dispose();}}
  });

  it.each(['flight','racer'])('%s fitted leather is rig-supported and does not flutter as a textile sheet',outfit=>{
    const m=buildRiderModel({...DEFAULT_RIDER,outfit,hair:'short',scarf:'none',cape:'none'});
    try{expect(riderClothSpecs(m.ctx,m.proof).filter(p=>p.guideSkin)).toHaveLength(0);}
    finally{m.geometry.dispose();m.rig.skeleton.dispose();}
  });

  it.each(['slight','medium','broad'] as const)('%s bell sleeves do not develop contact fins in calm air',build=>{
    const r=new Rider({...DEFAULT_RIDER,build,outfit:'cartographer',headgear:'none',scarf:'none'},{quality:QUALITY.high}),pose=createRiderPose();
    try{
      for(let frame=0;frame<90;frame++)r.update(1/60,pose,null);
      for(const p of cloth(r).pieces.filter(p=>p.spec.name.startsWith('sleeve'))){
        let peak=0;
        for(let i=p.vu*3;i<p.pos.length;i+=3)peak=Math.max(peak,Math.hypot(p.pos[i]-p.surfaceRest![i],p.pos[i+1]-p.surfaceRest![i+1],p.pos[i+2]-p.surfaceRest![i+2]));
        expect(peak,p.spec.name).toBeLessThan(.03);
      }
    }finally{r.dispose();}
  });

  it('mixed cuirass plates retain pair distances through actual skeletal motion',()=>{
    const look=withGarment({...DEFAULT_RIDER,scarf:'none',cape:'none'},'chest','skyknight-chest');
    const r=new Rider(look,{quality:QUALITY.low}),pose=createRiderPose();
    try{
      const {mesh,geometry,ctx}=model(r),p=geometry.getAttribute('position'),s=geometry.getAttribute('c02Surface');
      const weights=geometry.getAttribute('skinWeight'),bones=geometry.getAttribute('skinIndex');
      const indices:number[]=[];
      for(let i=0;i<p.count;i++)if(s.getX(i)===4&&weights.getX(i)===1&&bones.getX(i)===B.chest&&p.getY(i)>1.045*ctx.d.h&&p.getY(i)<1.35*ctx.d.h)indices.push(i);
      expect(indices.length).toBeGreaterThan(150); // Interior rows of two 10×5 plate sheets.
      const a=indices[0],b=indices[Math.floor(indices.length*.7)],rest=new Vector3().fromBufferAttribute(p,a).distanceTo(new Vector3().fromBufferAttribute(p,b));
      for(const action of ['idle','run','wave','fall'] as const){
        pose.action=action;pose.actionTime=.62;pose.airflow.set(80,5,-70);r.update(1/60,pose,null);
        const x=mesh.applyBoneTransform(a,new Vector3().fromBufferAttribute(p,a)),y=mesh.applyBoneTransform(b,new Vector3().fromBufferAttribute(p,b));
        expect(x.distanceTo(y)).toBeCloseTo(rest,6);
      }
    }finally{r.dispose();}
  });

  it.each(['courier','cartographer','skyknight','travel-drape'])('%s retains sewn render seams and finite surfaces through gusts, hitches, ground/deck contacts and teleports',outfit=>{
    let groundY=0;
    const r=new Rider({...DEFAULT_RIDER,outfit,headgear:'none',scarf:'none'}, {quality:QUALITY.low,
      terrain:{groundAt:()=>({y:groundY,normal:new Vector3(0,1,0),islandId:0,surface:'wood'})}}),pose=createRiderPose();
    try{
      for(let frame=0;frame<240;frame++){
        if(frame===120){groundY=10;pose.position.set(100,10,100);}
        pose.action=frame%80<40?'run':'wave';pose.actionTime=(frame%40)/60;
        pose.airflow.set(frame<180?(frame%60<30?80:-80):0,5,frame<180?-70:0);
        r.update(frame%60===0?.2:1/60,pose,null);
        for(const p of cloth(r).pieces.filter(p=>p.guide)){
          expect(Array.from(p.pos).every(Number.isFinite)).toBe(true);
          for(let i=0;i<p.spec.cols;i++)for(let k=0;k<3;k++)expect(p.cloth.pos[i*3+k]).toBeCloseTo(p.targets[i*3+k],6);
          if(p.spec.config.sewEdges)for(let row=0;row<p.vv;row++){
            const a=row*p.vu*3,b=(row*p.vu+p.vu-1)*3;
            expect(Math.hypot(p.pos[a]-p.pos[b],p.pos[a+1]-p.pos[b+1],p.pos[a+2]-p.pos[b+2])).toBeLessThan(1e-6);
          }
          if(frame>5)for(let i=p.vu;i<p.pos.length/3;i++)expect(p.pos[i*3+1]+cloth(r).origin.y).toBeGreaterThanOrEqual(groundY-1e-5);
        }
      }
      const solvers=cloth(r).pieces.map(p=>p.cloth);r.setQuality(QUALITY.ultra);
      expect(cloth(r).pieces.map(p=>p.cloth)).toEqual(solvers);
      const geo=model(r).geometry;r.setLook({...DEFAULT_RIDER,outfit,headgear:'none',scarf:'none',outfitPrimary:'#8d3b52'});expect(model(r).geometry).toBe(geo);
    }finally{r.dispose();}
  });
});
