import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import fixtureUrl from '../../assets/rider-blender/rider-trial.glb?inline';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkinnedMesh,Triangle,Vector3} from 'three';
import {validateImportedScene,type ImportedRiderAsset} from './importContract';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import * as models from './model';
import {Rider} from './Rider';
import {QUALITY} from '../../render/quality';
import {createRiderPose} from '../../player/poses';
import {SkyLanceVisuals} from '../../traversal/SkyLanceVisuals';
import {SkyLance} from '../../traversal/SkyLance';
let asset:ImportedRiderAsset;
let preservedRegions:ImportedRiderAsset['regions'];
beforeAll(async()=>{
  const raw=Uint8Array.from(atob(fixtureUrl.split(',')[1]),c=>c.charCodeAt(0));
  const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength) as ArrayBuffer,'');
  const imported=validateImportedScene(gltf.scene,raw.length);preservedRegions=imported.regions;
  // This regression exercises the preserved brown provider. The selected Windkeel
  // regions have their own tests; adding them must not silently replace this fixture.
  asset={...imported,regions:imported.regions.filter(r=>!r.region.startsWith('equipment:'))};const skeletons=new Set<SkinnedMesh['skeleton']>();
  gltf.scene.traverse(o=>{const m=o as SkinnedMesh;if(!m.isMesh)return;m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();if(m.isSkinnedMesh)skeletons.add(m.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
},120000);
afterAll(()=>{for(const part of preservedRegions)part.geometry.dispose();vi.restoreAllMocks();});
const inside=(r:Rider)=>r as unknown as {model:models.RiderModel;look:typeof DEFAULT_RIDER;importedAsset:ImportedRiderAsset;rebuildModel():void};

describe('resting brown harness',()=>{
  it('fits the actual rendered bind surfaces of all presets and supported builds',()=>{
    const triangle=new Triangle(),point=new Vector3(),closest=new Vector3();
    for(const build of ['slight','medium','broad'] as const)for(const outfit of ['travel-drape','flight','scout','courier','racer','cartographer','skyknight']){
      const look={...DEFAULT_RIDER,outfit,build,headgear:'none',scarf:'none',cape:'none'};
      const model=models.buildRiderModel(look,{importedAsset:asset}),fit=model.harness!;
      try{
        expect(fit.mesh.skeleton).toBe(model.rig.skeleton);expect(fit.diagnostics.misses).toBe(0);
        const body=model.geometry.attributes.position,index=model.geometry.index!,strap=fit.geometry.attributes.position;
        // Independent closest-triangle distances, rather than trusting the fitting diagnostics.
        let maxGap=0,worst={};
        for(let i=4;i<strap.count;i+=8){point.fromBufferAttribute(strap,i);let nearest=Infinity,location:number[]=[];
          for(let j=0;j<index.count;j+=3){const a=index.getX(j),b=index.getX(j+1),c=index.getX(j+2);if(Math.max(body.getY(a),body.getY(b),body.getY(c))<.95*model.ctx.d.h)continue;
            triangle.a.fromBufferAttribute(body,a);triangle.b.fromBufferAttribute(body,b);triangle.c.fromBufferAttribute(body,c);triangle.closestPointToPoint(point,closest);const distance=point.distanceTo(closest);if(distance<nearest){nearest=distance;location=closest.toArray();}
          }if(nearest>maxGap){maxGap=nearest;worst={vertex:i,surface:fit.geometry.attributes.c02Surface.getX(i),position:point.toArray(),nearest:location};}
        }
        expect(maxGap,build+'/'+outfit+' '+JSON.stringify(worst)).toBeLessThan(.012);
      }finally{fit.geometry.dispose();model.geometry.dispose();model.rig.skeleton.dispose();}
    }
  },120000);
  it('retains working fitted equipment on rejected rebuilds, recolors in place and shares motion once',()=>{
    const r=new Rider({...DEFAULT_RIDER,outfit:'travel-drape'}),dev=inside(r),visuals=new SkyLanceVisuals(),lance=new SkyLance({anchorValid:()=>true,sweep:()=>null}),pose=createRiderPose();
    expect(r.hasRestingHarness).toBe(false);dev.importedAsset=asset;dev.rebuildModel();
    try{
      const before=dev.model,fit=before.harness!,skeleton=fit.mesh.skeleton,geometry=fit.geometry,first=geometry.attributes.color.getX(0);
      r.setLook({...dev.look,leatherColor:'#222222'});r.setQuality(QUALITY.high);
      expect(dev.model).toBe(before);expect(dev.model.harness!.geometry).toBe(geometry);expect(fit.mesh.skeleton).toBe(skeleton);
      expect(geometry.attributes.color.getX(0)).not.toBe(first);expect(fit.mesh.material).toBe(before.mesh.material);
      const previousLook=dev.look,dispose=vi.spyOn(geometry,'dispose'),rigDispose=vi.spyOn(skeleton,'dispose');
      vi.spyOn(models,'buildRiderModel').mockImplementationOnce(()=>{throw Error('Deliberate rejected candidate');});
      expect(()=>r.setLook(withGarment(dev.look,'top','courier-top'))).toThrow('Deliberate rejected candidate');
      expect(dev.model).toBe(before);expect(dev.look).toEqual(previousLook);expect(dispose).not.toHaveBeenCalled();expect(rigDispose).not.toHaveBeenCalled();
      pose.mounted=false;pose.position.set(2,300,4);r.update(0,pose,null);visuals.update(lance,r,pose,1);
      expect(fit.mesh.visible).toBe(true);expect(visuals.group.getObjectByName('windline-harness')!.visible).toBe(false);
      const a=new Vector3(),b=new Vector3();expect(r.equipmentFittedPoint('dorsal',a)).toBe(true);
      pose.position.x+=7;r.update(0,pose,null);r.equipmentFittedPoint('dorsal',b);expect(b.x-a.x).toBeCloseTo(7,5);
      const ring=fit.anchors.dorsal.p.clone().applyMatrix4(skeleton.boneInverses[2]).applyMatrix4(skeleton.bones[2].matrixWorld);expect(b.distanceTo(ring)).toBeLessThan(1e-6);
      pose.mounted=true;r.update(0,pose,null);expect(fit.mesh.visible).toBe(false);
      r.dispose();expect(dispose).toHaveBeenCalledOnce();expect(rigDispose).toHaveBeenCalledOnce();
    }finally{visuals.dispose();if(r.trialState.status!=='disposed')r.dispose();vi.restoreAllMocks();}
  });
});
