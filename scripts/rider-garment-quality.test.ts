import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import {cosmeticsFor,DEFAULT_RIDER,DEFAULT_WYVERN} from '../src/cosmetics/catalog';
import {GARMENT_SLOTS,withGarment} from '../src/cosmetics/wardrobe';
import {createRiderPose,createWyvernPose} from '../src/player/poses';
import {QUALITY} from '../src/render/quality';
import {Wyvern} from '../src/creatures/wyvern/Wyvern';
import {Rider} from '../src/creatures/rider/Rider';
import type {ClothRig} from '../src/creatures/rider/clothRig';
import type {Capsule} from '../src/creatures/rider/cloth';
import type {RiderGarmentSlot,RiderLook} from '../src/core/types';

/** Independent point/capsule distance applied to the final smoothed render vertices. */
function depth(x:number,y:number,z:number,c:Capsule,radius:number):number{
 const dx=c.bx-c.ax,dy=c.by-c.ay,dz=c.bz-c.az;
 const t=Math.max(0,Math.min(1,((x-c.ax)*dx+(y-c.ay)*dy+(z-c.az)*dz)/(dx*dx+dy*dy+dz*dz||1)));
 return c.r+radius-Math.hypot(x-c.ax-dx*t,y-c.ay-dy*t,z-c.az-dz*t);
}
describe('garment quality audit',{timeout:360000},()=>{
 it('audits rendered cloth through locomotion and real mounted poses',()=>{
  const base={...DEFAULT_RIDER,headgear:'none',scarf:'none',cape:'none'};
  const presets=['flight','scout','courier','racer','cartographer','skyknight','travel-drape'];
  const slots=Object.keys(GARMENT_SLOTS) as RiderGarmentSlot[];
  const options=slots.map(s=>cosmeticsFor(GARMENT_SLOTS[s]).filter(o=>o.id!=='outfit').map(o=>o.id));
  // Orthogonal array over prime 11: all pairs of choices in all eight slots, on all builds.
  // Repeated residues cover slots with fewer than 11 options without dropping any pair.
  expect(options.every(o=>o.length<=11)).toBe(true);
  const looks:RiderLook[]=[];
  for(const build of ['slight','medium','broad'] as const){
   looks.push(...presets.map(outfit=>({...base,build,outfit})));
   for(let a=0;a<11;a++)for(let b=0;b<11;b++){
    let look:RiderLook={...base,build,outfit:presets[(a+b)%presets.length]};
    slots.forEach((slot,j)=>{look=withGarment(look,slot,options[j][(j===0?a:(b+(j-1)*a)%11)%options[j].length]);});
    looks.push(look);
   }
  }
  const w=new Wyvern(DEFAULT_WYVERN),wp=createWyvernPose();wp.position.set(0,300,0);wp.airborne=true;
  const rows:Record<string,unknown>[]=[],worst={particle:0,render:0,triangle:0,case:'',detail:{} as Record<string,unknown>};
  try{for(const look of looks){
   const r=new Rider(look,{quality:look.build==='slight'?QUALITY.low:QUALITY.medium,saddle:w.saddle,socket:(name,out)=>w.socket(name,out)}),rp=createRiderPose();
   try{for(const action of ['idle','run','wave','bank','dive','brake']){
    rp.mounted=['glide','bank','dive','brake'].includes(action);rp.action=rp.mounted?'mounted':action as typeof rp.action;
    rp.lean=action==='bank'?.9:0;rp.crouch=action==='dive'?.85:0;rp.brace=action==='brake'?1:0;
    rp.velocity.set(0,0,action==='run'?7:action==='walk'?2:0);rp.airflow.set(18,2,rp.mounted?-65:-18);
    for(let frame=0;frame<24;frame++){rp.actionTime=frame/60;w.update(1/60,wp);r.update(1/60,rp,rp.mounted?w.saddle:null);}
    const cloth=(r as unknown as {cloth:ClothRig}).cloth;
    let particle=0,render=0,triangle=0,vertices=0;
    for(const p of cloth.pieces.filter(p=>p.spec.guideSkin)){
     for(let i=p.spec.cols;i<p.cloth.n;i++)if(p.spec.anchorBone[i]<0)for(const c of p.capsules){const k=i*3;particle=Math.max(particle,depth(p.cloth.pos[k],p.cloth.pos[k+1],p.cloth.pos[k+2],c,p.spec.config.radius));}
     // Attached root rows intentionally meet the fitted garment and are not free cloth.
     for(let i=p.vu;i<p.pos.length/3;i++)if(!p.surfacePinned[i]){vertices++;for(const c of p.capsules){const k=i*3;render=Math.max(render,depth(p.pos[k],p.pos[k+1],p.pos[k+2],c,p.spec.config.radius));}}
     const idx=p.geo.index!.array;
     for(let t=0;t<idx.length;t+=3){
      const ia=idx[t],ib=idx[t+1],ic=idx[t+2];if(p.surfacePinned[ia]||p.surfacePinned[ib]||p.surfacePinned[ic])continue;
      const a=ia*3,b=ib*3,c=ic*3;
      for(const [wa,wb,wc] of [[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3]])
       for(const cap of p.capsules){const d=depth(p.pos[a]*wa+p.pos[b]*wb+p.pos[c]*wc,p.pos[a+1]*wa+p.pos[b+1]*wb+p.pos[c+1]*wc,p.pos[a+2]*wa+p.pos[b+2]*wb+p.pos[c+2]*wc,cap,p.spec.config.radius);triangle=Math.max(triangle,d);
        if(d>worst.triangle){worst.triangle=d;worst.case=`${look.build}/${look.outfit}/${action}/${JSON.stringify(look.wardrobe)}`;worst.detail={piece:p.spec.name,capsule:p.spec.colliders[p.capsules.indexOf(cap)],cap:{...cap},indices:[ia,ib,ic],points:[Array.from(p.pos.slice(a,a+3)),Array.from(p.pos.slice(b,b+3)),Array.from(p.pos.slice(c,c+3))],grid:[p.vu,p.vv],sample:[wa,wb,wc]};}
       }
     }
     expect(Array.from(p.pos).every(Number.isFinite)).toBe(true);
    }
    rows.push({outfit:look.outfit,build:look.build,wardrobe:look.wardrobe,action,particle,render,triangle,vertices});
    worst.particle=Math.max(worst.particle,particle);worst.render=Math.max(worst.render,render);
   }}finally{r.dispose();}
  }}finally{w.dispose();}
  const phase=(process.env.RIDER_QA_PASS??'latest').replace(/[^a-z0-9-]/gi,'');
  fs.mkdirSync('shots/rider-qa',{recursive:true});fs.writeFileSync(`shots/rider-qa/${phase}-clearance.json`,JSON.stringify({coverage:{looks:looks.length,poses:looks.length*6,builds:3,garmentOptions:options.map((o,j)=>({slot:slots[j],choices:o.length})),pairwise:true,scope:'capsule proxies; sewn root/inner-vent seams excluded; free triangle edges and centroids sampled'},worst,rows},null,2));
  console.log('Rendered garment clearance audit',JSON.stringify(worst));
  expect(rows).toHaveLength(2304);
  expect(worst.particle).toBeLessThan(.001);
  expect(worst.render).toBeLessThan(.00005);
  expect(worst.triangle).toBeLessThan(.001);
 });

 it('records CPU cost of the final contact correction, separately from GPU performance',()=>{
  const rows:Record<string,unknown>[]=[];
  for(const quality of ['low','medium','high','ultra'] as const)for(const outfit of ['courier','cartographer','travel-drape']){
   const measure=(contacts:boolean)=>{
    const r=new Rider({...DEFAULT_RIDER,outfit,headgear:'none',scarf:'none'},{quality:QUALITY[quality]}),pose=createRiderPose();
    const rig=(r as unknown as {cloth:ClothRig}).cloth;
    if(!contacts)(rig as unknown as {projectGarmentSurface:()=>void}).projectGarmentSurface=()=>{};
    const times:number[]=[];
    try{for(let frame=0;frame<180;frame++){
      pose.action='run';pose.actionTime=frame/60;pose.velocity.set(0,0,7);pose.airflow.set(24,2,-32);
      const start=performance.now();r.update(1/60,pose,null);const elapsed=performance.now()-start;
      if(frame>=60)times.push(elapsed);
    }}finally{r.dispose();}
    times.sort((a,b)=>a-b);return {median:times[60],p95:times[114]};
   };
   const without=measure(false),withContacts=measure(true);
   rows.push({quality,outfit,withoutSurfaceContactMs:without,withSurfaceContactMs:withContacts,medianIncrementMs:withContacts.median-without.median});
  }
  fs.mkdirSync('shots/rider-qa',{recursive:true});fs.writeFileSync('shots/rider-qa/contact-cpu-cost.json',JSON.stringify({scope:'Node CPU Rider.update only; no WebGL, GPU, memory or end-to-end frame-rate claim',rows},null,2));
  expect(rows).toHaveLength(12);
 });
});
