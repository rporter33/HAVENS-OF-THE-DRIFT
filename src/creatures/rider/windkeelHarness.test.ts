import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import fixtureUrl from '../../assets/rider-blender/rider-trial.glb?inline';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkinnedMesh,Triangle,Vector3} from 'three';
import {validateImportedScene,type ImportedRiderAsset} from './importContract';
import {buildRiderModel,recolorRiderModel,type RiderModel} from './model';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {Rider} from './Rider';
import {createRiderPose} from '../../player/poses';
import {B} from './rig';
let asset:ImportedRiderAsset;
beforeAll(async()=>{
 const bytes=Uint8Array.from(atob(fixtureUrl.split(',')[1]),c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');asset=validateImportedScene(gltf.scene,bytes.length);
 const skeletons=new Set<SkinnedMesh['skeleton']>();gltf.scene.traverse(o=>{const m=o as SkinnedMesh;if(!m.isMesh)return;m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();if(m.isSkinnedMesh)skeletons.add(m.skeleton);});for(const s of skeletons)s.dispose();
},120000);
afterAll(()=>asset.regions.forEach(r=>r.geometry.dispose()));
const release=(m:RiderModel)=>{m.harness?.geometry.dispose();m.geometry.dispose();m.rig.skeleton.dispose();};

it('keeps fastened leather load paths and coherent blue/linen rings during bent-limb motion',()=>{
 for(const outfit of ['travel-drape','flight']){
  const m=buildRiderModel({...DEFAULT_RIDER,outfit,build:'medium',headgear:'none',scarf:'none',cape:'none'},{importedAsset:asset});
  try{
   const fit=m.harness!,region=asset.regions.find(r=>r.region==='equipment:windkeel-'+(outfit==='travel-drape'?'aerie':'flight'))!;
   const g=fit.geometry,parts=region.equipmentParts!;
   const weights=(geometry:typeof g,id:number)=>{const result=new Map<number,number>();for(let k=0;k<4;k++){const w=geometry.attributes.skinWeight.getComponent(id,k);if(w)result.set(geometry.attributes.skinIndex.getComponent(id,k),w);}return result;};
   for(const part of parts.filter(p=>p.name.startsWith('Hip_')||p.name.startsWith('Thigh'))){
    for(let id=part.startVertex;id<part.startVertex+part.vertices;id++){
     const source=weights(region.geometry,id),actual=weights(g,id);expect([...actual.keys()].sort()).toEqual([...source.keys()].sort());
     for(const [bone,weight] of source)expect(actual.get(bone)).toBeCloseTo(weight,6);
    }
   }
   m.rig.bones[B.upperArmL].rotation.z=-1.2;m.rig.bones[B.upperArmR].rotation.z=1.1;
   m.rig.bones[B.clavL].rotation.z=-.25;m.rig.bones[B.chest].rotation.x=-.2;m.rig.bones[B.spine].rotation.x=.3;m.rig.bones[B.thighL].rotation.x=-.9;
   m.rig.root.updateMatrixWorld(true);m.rig.skeleton.update();
   for(const part of parts.filter(p=>p.name.startsWith('Shoulder')||p.name.startsWith('Waist'))){
    const stride=part.name.startsWith('Shoulder')?6:4;
    for(let row=0;row<part.vertices/stride;row++){
     const start=part.startVertex+row*stride,first=weights(g,start);
     for(let k=1;k<stride;k++){
      expect(weights(g,start+k)).toEqual(first);
      const rest=new Vector3().fromBufferAttribute(g.attributes.position,start).distanceTo(new Vector3().fromBufferAttribute(g.attributes.position,start+k));
      const posed=fit.mesh.getVertexPosition(start,new Vector3()).distanceTo(fit.mesh.getVertexPosition(start+k,new Vector3()));
      expect(posed).toBeLessThanOrEqual(rest+1e-6);
     }
     if(part.role==='blue'){
      const linen=parts.find(p=>p.name===part.name.replace('_blue','_linen'))!;
      expect(first).toEqual(weights(g,linen.startVertex+row*stride));
     }
    }
   }
  }finally{release(m);}
 }
});

it('preserves both measured fits, 23 component identities and the four named sockets',()=>{
 for(const id of ['aerie','flight']){const r=asset.regions.find(r=>r.region==='equipment:windkeel-'+id)!;
  expect(r.equipmentParts).toHaveLength(23);expect(r.geometry.attributes.position.count).toBe(1286);expect(r.geometry.index!.count/3).toBe(2504);
  expect(r.sockets?.map(s=>s.name)).toEqual(['AN_SOCKET_WINDLINE_DORSAL','AN_SOCKET_GUIDE_LEFT','AN_SOCKET_RIDING_LEFT','AN_SOCKET_RIDING_RIGHT']);
 }
});
it('seats flexible components across all seven presets and builds without changing the centered metal motif',()=>{
 const triangle=new Triangle(),point=new Vector3(),closest=new Vector3();
 for(const build of ['slight','medium','broad'] as const)for(const outfit of ['travel-drape','flight','scout','courier','racer','cartographer','skyknight']){
  const m=buildRiderModel({...DEFAULT_RIDER,outfit,build,headgear:'none',scarf:'none',cape:'none'},{importedAsset:asset});
  try{
   const fit=m.harness!,region=asset.regions.find(r=>r.region==='equipment:windkeel-'+(outfit==='travel-drape'?'aerie':'flight'))!;
   expect(fit.kind).toBe('windkeel');expect(fit.mesh.skeleton).toBe(m.rig.skeleton);expect(fit.diagnostics.misses).toBe(0);
   const body=m.geometry.attributes.position,index=m.geometry.index!,p=fit.geometry.attributes.position;
   let worst=0,detail={};
   for(const part of region.equipmentParts!.filter(c=>['blue','linen','leather'].includes(c.role)&&!c.name.startsWith('Dorsal')&&!c.name.includes('tongue'))){
    for(let i=part.startVertex;i<part.startVertex+part.vertices;i+=8){point.fromBufferAttribute(p,i);let nearest=Infinity;
     for(let j=0;j<index.count;j+=3){const a=index.getX(j),b=index.getX(j+1),c=index.getX(j+2);if(Math.max(body.getY(a),body.getY(b),body.getY(c))<.77*m.ctx.d.h||Math.min(body.getY(a),body.getY(b),body.getY(c))>1.49*m.ctx.d.h)continue;
      triangle.a.fromBufferAttribute(body,a);triangle.b.fromBufferAttribute(body,b);triangle.c.fromBufferAttribute(body,c);triangle.closestPointToPoint(point,closest);nearest=Math.min(nearest,point.distanceTo(closest));
     }
     if(nearest>worst){worst=nearest;detail={part:part.name,vertex:i,position:point.toArray()};}
    }
   }
   expect(worst,build+'/'+outfit+' '+JSON.stringify(detail)).toBeLessThan(.012);
   const motif=region.equipmentParts!.filter(c=>c.name.startsWith('Windkeel_')),source=region.geometry.attributes.position;
   const first=motif[0].startVertex,delta=new Vector3().fromBufferAttribute(p,first).sub(new Vector3(source.getX(first)*m.ctx.d.w,source.getY(first)*m.ctx.d.h,source.getZ(first)*m.ctx.d.g));
   for(const c of motif)for(let i=c.startVertex;i<c.startVertex+c.vertices;i++){const expected=new Vector3(source.getX(i)*m.ctx.d.w,source.getY(i)*m.ctx.d.h,source.getZ(i)*m.ctx.d.g).add(delta);expect(expected.distanceTo(new Vector3().fromBufferAttribute(p,i))).toBeLessThan(2e-7);}
  }finally{release(m);}
 }
},120000);
it('shares recoloring and motion once, remains mounted, and disposes rejected/replaced equipment safely',()=>{
 const rider=new Rider({...DEFAULT_RIDER,outfit:'travel-drape'}),dev=rider as unknown as {importedAsset:ImportedRiderAsset;rebuildModel():void;model:RiderModel;look:typeof DEFAULT_RIDER};dev.importedAsset=asset;dev.rebuildModel();
 try{
  const model=dev.model,fit=model.harness!,geometry=fit.geometry,material=fit.mesh.material,leather=asset.regions.find(r=>r.region==='equipment:windkeel-aerie')!.equipmentParts!.find(p=>p.name==='Hip_1_1_flex_link')!.startVertex;
  const before=geometry.attributes.color.getX(leather),blue=geometry.attributes.color.getX(114);
  recolorRiderModel(model,{...dev.look,leatherColor:'#222222'});expect(geometry.attributes.color.getX(leather)).not.toBe(before);expect(geometry.attributes.color.getX(114)).toBe(blue);expect(fit.mesh.material).toBe(material);expect(fit.mesh.skeleton).toBe(model.rig.skeleton);
  const pose=createRiderPose();pose.mounted=true;pose.position.set(20,300,5);rider.update(0,pose,null);expect(fit.mesh.visible).toBe(true);
  for(const name of Object.keys(fit.sockets!)){const a=new Vector3(),b=new Vector3();expect(rider.equipmentSocket(name,a)).toBe(true);pose.position.x+=7;rider.update(0,pose,null);rider.equipmentSocket(name,b);expect(b.x-a.x).toBeCloseTo(7,5);}
  const dispose=vi.spyOn(geometry,'dispose'),skeletonDispose=vi.spyOn(model.rig.skeleton,'dispose');rider.setLook({...dev.look,outfit:'scout'});expect(dispose).toHaveBeenCalledOnce();expect(skeletonDispose).toHaveBeenCalledOnce();expect(dev.model.harness!.kind).toBe('windkeel');
 }finally{rider.dispose();vi.restoreAllMocks();}
});
