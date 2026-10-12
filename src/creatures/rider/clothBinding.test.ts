import {afterEach,describe,expect,it,vi} from 'vitest';
import fixtureUrl from '../../assets/rider-blender/compatibility.glb?inline';
import {Quaternion,Vector3} from 'three';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import {createRiderPose} from '../../player/poses';
import {QUALITY} from '../../render/quality';
import {buildRiderModel} from './model';
import {Rider} from './Rider';
import type {ClothRig} from './clothRig';
import {compatibilityClothSurface,deformClothSurface,validateClothBinding} from './clothBinding';
import {capsuleDepth} from './clothContact';
const look={...DEFAULT_RIDER,outfit:'travel-drape',headgear:'none',scarf:'none',cape:'none'};
function source(){const model=buildRiderModel(look);return {model,spec:model.ctx.garmentCloth.find(p=>p.name==='garment-travel-drape-0')!};}
function free(m:ReturnType<typeof buildRiderModel>){m.geometry.dispose();m.rig.skeleton.dispose();}
const cloth=(r:Rider)=>(r as unknown as {cloth:ClothRig}).cloth;
afterEach(()=>vi.unstubAllGlobals());
describe('coarse solver to detailed cloth proof',()=>{
 it('reproduces final rest topology and carries offsets once under rotation/translation',()=>{
   const {model,spec}=source();
   try{
     const binding=compatibilityClothSurface(spec),controls=Float64Array.from(spec.rest.flatMap(p=>p.toArray())),out=new Float32Array(binding.surface.positions.length);
     expect(spec.rest).toHaveLength(42);expect(out.length/3).toBe(525);validateClothBinding(binding,spec);
     deformClothSurface(binding,controls,out);
     let worst=0;for(let i=0;i<out.length;i++)worst=Math.max(worst,Math.abs(out[i]-binding.surface.positions[i]));expect(worst).toBeLessThan(1e-7);
     const rotation=new Quaternion().setFromAxisAngle(new Vector3(1,2,-1).normalize(),.8),translation=new Vector3(100,40,-80),p=new Vector3();
     for(let i=0;i<controls.length;i+=3)p.fromArray(controls,i).applyQuaternion(rotation).add(translation).toArray(controls,i);
     deformClothSurface(binding,controls,out);worst=0;
     for(let i=0;i<out.length;i+=3){p.fromArray(binding.surface.positions,i).applyQuaternion(rotation).add(translation);worst=Math.max(worst,p.distanceTo(new Vector3().fromArray(out,i)));}
     expect(worst).toBeLessThan(1e-5);
     expect(Array.from(binding.pinned.slice(0,25))).toEqual(new Array(25).fill(1));
   }finally{free(model);}
 });
 it.each(['controls','surface'])('invalidates %s edits after binding rather than accepting stale export data',kind=>{
   const {model,spec}=source();try{const binding=compatibilityClothSurface(spec);
     if(kind==='controls')spec.rest[5].x+=.001;else binding.surface.positions[70]+=.001;
     expect(()=>validateClothBinding(binding,spec)).toThrow(/stale topology/);
   }finally{free(model);}
 });
 it('retains live wind, seams, surface contacts, solver state and in-place dyes in the real rider',async()=>{
   const bytes=Uint8Array.from(atob(fixtureUrl.split(',')[1]),c=>c.charCodeAt(0));
   vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes)));
   const r=new Rider(look,{trial:'compatibility',quality:QUALITY.low}),pose=createRiderPose();
   try{
     await vi.waitFor(()=>expect(r.trialState.status).toBe('ready'));
     let patch=cloth(r).pieces.find(p=>p.boundSurface)!;expect(patch).toBeTruthy();
     expect((patch.mesh as unknown as {isSkinnedMesh?:boolean}).isSkinnedMesh).not.toBe(true);
     const expected=new Float32Array(patch.pos.length);let movement=0,seam=0,depth=0;
     for(let step=0;step<360;step++){
       pose.action=step<180?'run':'idle';pose.actionTime=step/60;pose.velocity.set(0,0,step<180?5:0);
       pose.airflow.set(step<240?(step%80<40?40:-40):0,0,step<240?-30:0);
       r.update(step%90===0?.2:1/60,pose,null);
       deformClothSurface(patch.boundSurface!,patch.renderParticles!,expected);
       for(let i=0;i<patch.pos.length/3;i++){
         const q=i*3;expect(Number.isFinite(patch.pos[q]+patch.pos[q+1]+patch.pos[q+2])).toBe(true);
         if(patch.surfacePinned[i])seam=Math.max(seam,Math.hypot(patch.pos[q]-expected[q],patch.pos[q+1]-expected[q+1],patch.pos[q+2]-expected[q+2]));
         else for(const cap of patch.capsules)depth=Math.max(depth,capsuleDepth(patch.pos[q],patch.pos[q+1],patch.pos[q+2],cap,patch.spec.config.radius));
       }
       for(let i=patch.spec.cols;i<patch.cloth.n;i++){const q=i*3;movement=Math.max(movement,Math.hypot(patch.cloth.pos[q]-patch.guide![q],patch.cloth.pos[q+1]-patch.guide![q+1],patch.cloth.pos[q+2]-patch.guide![q+2]));}
     }
     expect(movement).toBeGreaterThan(.005);expect(seam).toBeLessThan(1e-6);expect(depth).toBeLessThan(1e-5);
     const solver=patch.cloth;r.setQuality(QUALITY.high);patch=cloth(r).pieces.find(p=>p.boundSurface)!;expect(patch.cloth).toBe(solver);
     const geometry=patch.geo,material=patch.mesh.material;r.setLook({...look,outfitPrimary:'#9b675c',outfitSecondary:'#698da4'});
     expect(patch.geo).toBe(geometry);expect(patch.mesh.material).toBe(material);expect(patch.cloth).toBe(solver);
     // Other builds retain their body provider; the Travel top proof fits the current build.
     for(const build of ['slight','broad'] as const){
       r.setLook(withGarment({...DEFAULT_RIDER,build,headgear:'none',scarf:'none',cape:'none'},'top','travel-drape-top'));
       r.update(1/60,pose,null);const p=cloth(r).pieces.find(p=>p.boundSurface)!;
       expect(p).toBeTruthy();expect(Array.from(p.pos).every(Number.isFinite)).toBe(true);
     }
   }finally{r.dispose();}
 });
});
