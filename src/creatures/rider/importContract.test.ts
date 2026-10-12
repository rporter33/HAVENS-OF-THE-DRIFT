import {afterEach,describe,expect,it,vi} from 'vitest';
import fixtureUrl from '../../assets/rider-blender/compatibility.glb?inline';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkinnedMesh,type Object3D} from 'three';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import {readDebugParams} from '../../debug/params';
import {buildRiderModel,recolorRiderModel,type RiderModel} from './model';
import {inspectTrialGLB,validateImportedScene,type ImportedRiderAsset} from './importContract';
import {Rider} from './Rider';
const data=Uint8Array.from(atob(fixtureUrl.split(',')[1]),c=>c.charCodeAt(0));
const buffer=()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer;
const look=withGarment(withGarment({...DEFAULT_RIDER,headgear:'none',scarf:'none',cape:'none'},'trousers','travel-drape-trousers'),'footwear','scout-footwear');
async function scene(){return (await new GLTFLoader().parseAsync(buffer(),'')).scene;}
function meshes(root:Object3D){const out:SkinnedMesh[]=[];root.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh)out.push(o as SkinnedMesh);});return out;}
function cleanup(root:Object3D){const skeletons=new Set();for(const m of meshes(root)){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();skeletons.add(m.skeleton);}for(const s of skeletons as Set<SkinnedMesh['skeleton']>)s.dispose();}
function free(asset:ImportedRiderAsset){for(const p of asset.regions)p.geometry.dispose();}
function model(r:Rider){return (r as unknown as {model:RiderModel}).model;}
afterEach(()=>vi.unstubAllGlobals());

describe('bounded uncompressed rider import',()=>{
 it('is opt-in with no saved appearance field or normal-boot import',()=>{
   expect(readDebugParams('').riderTrial).toBeUndefined();expect(readDebugParams('?riderTrial=unknown').riderTrial).toBeUndefined();
   expect(readDebugParams('?riderTrial=compatibility').riderTrial).toBe('compatibility');
   const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const rider=new Rider(look);
   try{expect(rider.trialState.status).toBe('off');expect(model(rider).importedRegions).toEqual([]);expect(fetch).not.toHaveBeenCalled();}
   finally{rider.dispose();}
 });
 it('validates real exported binds/joints/weights and replaces exactly two dressed-leg regions',async()=>{
   inspectTrialGLB(buffer());const root=await scene(),asset=validateImportedScene(root,data.length);
   const original=buildRiderModel(look),imported=buildRiderModel(look,{importedAsset:asset});
   try{
     expect(asset.kind).toBe('compatibility-fixture');expect(imported.importedRegions).toEqual(['legL','legR']);
     expect(imported.rig.skeleton.bones.map(b=>b.name)).toEqual(original.rig.skeleton.bones.map(b=>b.name));
     expect(imported.geometry.index!.count).toBe(original.geometry.index!.count);
     expect(imported.geometry.getAttribute('position').count).toBe(original.geometry.getAttribute('position').count);
     // Import recovery must not hide a duplicate surface, missing surface or lost dye.
     for(const attribute of ['position','uv','color','skinWeight','skinIndex','c02Surface','glow']){
       const a=original.geometry.getAttribute(attribute),b=imported.geometry.getAttribute(attribute);
       expect(a.count,attribute).toBe(b.count);
       let worst=0;for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)worst=Math.max(worst,Math.abs(a.getComponent(i,c)-b.getComponent(i,c)));
       expect(worst,attribute).toBeLessThan(1e-6);
     }
     expect(Array.from(imported.geometry.index!.array)).toEqual(Array.from(original.geometry.index!.array));
     const geometry=imported.geometry,skeleton=imported.rig.skeleton,material=imported.mesh.material;
     const changed={...look,skin:'#6a4230',outfitPrimary:'#94586c',armorColor:'#728d7a',leatherColor:'#503a28'};
     recolorRiderModel(imported,changed);const fresh=buildRiderModel(changed,{importedAsset:asset});
     try{expect(imported.geometry).toBe(geometry);expect(imported.rig.skeleton).toBe(skeleton);expect(imported.mesh.material).toBe(material);
       expect(Array.from(imported.geometry.getAttribute('color').array)).toEqual(Array.from(fresh.geometry.getAttribute('color').array));}
     finally{fresh.geometry.dispose();fresh.rig.skeleton.dispose();}
   }finally{original.geometry.dispose();original.rig.skeleton.dispose();imported.geometry.dispose();imported.rig.skeleton.dispose();free(asset);cleanup(root);}
 });
 it.each(['joint','inverse','weights','topology','recipe'])('rejects an invalid %s contract without accepting recovery as an authored fit',async(kind)=>{
   const root=await scene(),mesh=meshes(root)[0];
   if(kind==='joint')mesh.skeleton.bones[3].name='unknown';
   if(kind==='inverse')mesh.skeleton.boneInverses[3].elements[12]+=.1;
   if(kind==='weights')mesh.geometry.getAttribute('skinWeight').setX(0,.01);
   if(kind==='topology')mesh.geometry.index!.setX(0,mesh.geometry.index!.getX(1));
   if(kind==='recipe')mesh.geometry.getAttribute('_dw_recipe').setX(0,999999);
   try{expect(()=>validateImportedScene(root)).toThrow(/Rider import:/);}
   finally{cleanup(root);}
 });
 it('keeps unsupported builds and footwear on their original providers with explicit empty import diagnostics',async()=>{
   const root=await scene(),asset=validateImportedScene(root);
   try{for(const other of [{...look,build:'broad' as const},withGarment(look,'footwear','flight-footwear')]){
     const a=buildRiderModel(other),b=buildRiderModel(other,{importedAsset:asset});
     try{expect(b.importedRegions).toEqual([]);expect(Array.from(b.geometry.getAttribute('position').array)).toEqual(Array.from(a.geometry.getAttribute('position').array));expect(b.rig.dims.build).toBe(other.build);}
     finally{a.geometry.dispose();a.rig.skeleton.dispose();b.geometry.dispose();b.rig.skeleton.dispose();}
   }}finally{free(asset);cleanup(root);}
 });
 it('late async completion honors the latest preview/Revert and ignores a disposed rider',async()=>{
   let release!:(r:Response)=>void;
   const fetch=vi.fn((url:string)=>url.includes('rider-trial')?Promise.resolve(new Response('Expected rejected replacement',{status:404})):new Promise<Response>(resolve=>{release=resolve;}));vi.stubGlobal('fetch',fetch);
   const gone=new Rider(look,{trial:'compatibility'}),active=new Rider(look,{trial:'compatibility'}),stale=new Rider(look,{trial:'compatibility'});
   await (stale as unknown as {loadTrial(selection:'blender'):Promise<void>}).loadTrial('blender');
   gone.dispose();active.setLook(DEFAULT_RIDER);
   release(new Response(buffer()));
   await vi.waitFor(()=>expect(active.trialState.status).toBe('ready'));
   try{
     expect(gone.trialState.status).toBe('disposed');expect(fetch).toHaveBeenCalledTimes(2);
     expect(stale.trialState.status).toBe('failed');expect(model(stale).importedRegions).toEqual([]);
     expect(model(active).importedRegions).toEqual([]);expect(model(active).ctx.look).toEqual(DEFAULT_RIDER);
     active.setLook(look);expect(model(active).importedRegions).toEqual(['legL','legR']);
     const geometry=model(active).geometry,skeleton=model(active).rig.skeleton;
     await (active as unknown as {loadTrial(selection:'blender'):Promise<void>}).loadTrial('blender');
     expect(active.trialState.status).toBe('failed');expect(model(active).geometry).toBe(geometry);expect(model(active).rig.skeleton).toBe(skeleton);
     expect(model(active).importedRegions).toEqual(['legL','legR']);
   }finally{active.dispose();stale.dispose();}
 });
});
