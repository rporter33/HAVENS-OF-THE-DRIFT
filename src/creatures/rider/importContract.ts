// Narrow, versioned trial contract. Never part of RiderLook or the saved catalog.
import { BufferAttribute, BufferGeometry, Color, Matrix4, SkinnedMesh, Vector3, type Object3D } from 'three';
import { BONE_NAMES, createRig, rigDims } from './rig';
import { evalRecipe, withRecipe, type ColorRecipe, type ColorSlot } from './palette';
import type { BodyCtx, OutfitStyle, Side } from './body';
import { garmentSource } from '../../cosmetics/wardrobe';
import { softLeg } from './softBody';
import type { RiderLook } from '../../core/types';
import type { ClothSpec } from './accessories';

export type TrialSelection = 'compatibility' | 'blender';
export interface EquipmentPart {name:string;startVertex:number;vertices:number;triangles:number;role:'blue'|'linen'|'leather'|'bronze'|'slate'}
export interface EquipmentSocket {name:string;bone:typeof BONE_NAMES[number];p:number[]}
export interface ImportedRegion {
  region: string;
  build: RiderLook['build'];
  fitKey: string;
  geometry: BufferGeometry;
  recipes: ColorRecipe[];
  topology: string;
  method?: 'direct'|'delta'|'bound'|'cloth';
  sourceLayout?: string;
  cagePositions?: Float32Array;
  cageIndices?: Uint32Array;
  cols?:number;
  rows?:number;
  equipmentParts?:EquipmentPart[];
  sockets?:EquipmentSocket[];
  control?:Pick<ClothSpec,'cols'|'rows'|'rest'|'anchorBone'|'guideSkin'>;
}
export interface ImportedRiderAsset {
  kind: 'compatibility-fixture' | 'blender-authored';
  regions: ImportedRegion[];
  source: string;
  bytes: number;
}
const slots: readonly ColorSlot[] = ['skin','hairColor','outfitPrimary','outfitSecondary','scarfColor','capeColor','armorColor','leatherColor'];
function recipeValid(r: unknown, depth=0): r is ColorRecipe {
  if(!r || typeof r!=='object' || depth>16) return false;
  const v=r as Record<string,unknown>,number=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
  if(v.k==='slot')return slots.includes(v.s as ColorSlot);
  if(v.k==='const')return [v.r,v.g,v.b].every(number);
  if(v.k==='tone'||v.k==='scale')return number(v.f)&&recipeValid(v.a,depth+1);
  if(v.k==='mix'||v.k==='lmix')return number(v.t)&&Number(v.t)>=0&&Number(v.t)<=1&&recipeValid(v.a,depth+1)&&recipeValid(v.b,depth+1);
  return false;
}
function invariant(pass:unknown,reason:string):asserts pass {if(!pass)throw Error('Rider import: '+reason);}

/** Includes final position/index order; binding must be regenerated after topology edits. */
export function topologySignature(geometry:BufferGeometry):string {
  const p=geometry.getAttribute('position'),index=geometry.index;
  let hash=2166136261;
  const word=(value:number)=>{hash=Math.imul(hash^(value>>>0),16777619)>>>0;};
  word(p.count);word(index?.count??0);
  // Micrometer quantization survives glTF float serialization without hiding a topology edit.
  for(let i=0;i<p.count;i++)for(let c=0;c<3;c++)word(Math.round(p.getComponent(i,c)*1e6));
  if(index)for(let i=0;i<index.count;i++)word(index.getX(i));
  return hash.toString(16).padStart(8,'0');
}
/** Index identity is independent of a supported fit's positions and dyes. */
export function layoutSignature(geometry:BufferGeometry):string {
  let hash=2166136261;const word=(n:number)=>{hash=Math.imul(hash^(n>>>0),16777619)>>>0;};
  word(geometry.attributes.position.count);word(geometry.index?.count??0);
  if(geometry.index)for(let i=0;i<geometry.index.count;i++)word(geometry.index.getX(i));
  return hash.toString(16).padStart(8,'0');
}
const authoredNames=['upper','head','ponytail-crown','handL','handR','legL','legR','footL','footR','barefootL','barefootR',
  ...['aerie','wanderer'].flatMap(cut=>[
    ...['top','chest','shoulderDrape','waist','armWraps','legWraps','footwear'].map(slot=>`piece:${slot}:${cut}`),
    ...[0,1,2,3].map(i=>`cloth:garment-travel-drape-${i}:${cut}`)])];
const equipmentNames=['equipment:windkeel-aerie','equipment:windkeel-flight'];

/** Reject external resources/compression before GLTFLoader can request anything else. */
export function inspectTrialGLB(buffer:ArrayBuffer):void {
  const view=new DataView(buffer);
  invariant(buffer.byteLength>=20,'truncated GLB');
  invariant(view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2,'expected glTF 2 GLB');
  invariant(view.getUint32(8,true)===buffer.byteLength,'GLB length mismatch');
  invariant(view.getUint32(16,true)===0x4e4f534a,'missing JSON chunk');
  const size=view.getUint32(12,true);invariant(size<=buffer.byteLength-20,'truncated JSON chunk');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,size)));
  invariant(!(json.buffers??[]).some((b:{uri?:string})=>b.uri),'external/data buffer unsupported');
  invariant(!(json.images??[]).length,'maps must use the shared painterly atlas');
  invariant(!(json.animations??[]).length,'runtime animator owns motion');
  invariant(!(json.extensionsRequired??[]).length,'compressed/required extensions unsupported in first proof');
}

/** Flatten exported object axes once and rebind by validated joint identity/rest positions. */
export function validateImportedScene(scene:Object3D,bytes=0):ImportedRiderAsset {
  scene.updateMatrixWorld(true);
  let contract=scene.userData.driftwing;
  scene.traverse(o=>{if(!contract&&o.userData.driftwing?.kind)contract=o.userData.driftwing;});
  invariant(contract?.contract===1&&contract.units==='meters'&&contract.axes==='X-left/Y-up/Z-forward','unknown scene contract/axes/units');
  invariant(contract.kind==='compatibility-fixture'||contract.kind==='blender-authored','missing asset provenance');
  const rigs={slight:createRig(rigDims('slight')),medium:createRig(rigDims('medium')),broad:createRig(rigDims('broad'))},identity=new Matrix4(),product=new Matrix4(),position=new Vector3(),point=new Vector3();
  const regions:ImportedRegion[]=[],allocated:BufferGeometry[]=[];
  try {
    scene.traverse(object=>{
      if(!(object as SkinnedMesh).isSkinnedMesh)return;
      const mesh=object as SkinnedMesh,meta=mesh.userData.driftwing;
      const authored=contract.kind==='blender-authored';
      invariant(meta?.contract===1&&(authored?[...authoredNames,...equipmentNames]:['legL','legR']).includes(meta.region),'unknown mesh region');
      invariant(meta.coverage===(authored?'owned-region':'whole-dressed-leg'),'missing explicit region coverage');
      invariant((authored?['slight','medium','broad']:['medium']).includes(meta.build)&&typeof meta.fitKey==='string','missing fitting boundary');
      invariant(!regions.some(p=>p.region===meta.region&&p.fitKey===meta.fitKey&&p.build===meta.build),'duplicate body region');
      const rig=rigs[meta.build as keyof typeof rigs];
      const skeleton=mesh.skeleton;
      invariant(skeleton.bones.length===BONE_NAMES.length&&skeleton.boneInverses.length===BONE_NAMES.length,'joint count');
      const names=skeleton.bones.map(b=>b.userData.driftwingJoint??b.name);
      invariant(new Set(names).size===27&&BONE_NAMES.every(n=>names.includes(n)),'joint identity');
      const mapping=names.map(n=>BONE_NAMES.indexOf(n as typeof BONE_NAMES[number]));
      for(let i=0;i<names.length;i++){
        const bone=skeleton.bones[i],canonical=mapping[i];
        position.setFromMatrixPosition(bone.matrixWorld);
        invariant(position.distanceTo(rig.bindPos[canonical])<1e-5,`bind position ${bone.name}`);
        let parent=bone.parent;while(parent&&!(parent as {isBone?:boolean}).isBone)parent=parent.parent;
        invariant((parent?.userData.driftwingJoint??parent?.name??null)===(rig.bones[canonical].parent?.name??null),`joint hierarchy ${bone.name}`);
        product.multiplyMatrices(bone.matrixWorld,skeleton.boneInverses[i]);
        invariant(product.elements.every((v,j)=>Math.abs(v-identity.elements[j])<1e-5),`inverse bind ${bone.name}`);
      }
      const original=mesh.geometry,p=original.getAttribute('position'),weights=original.getAttribute('skinWeight'),joints=original.getAttribute('skinIndex');
      invariant(p&&p.itemSize===3&&p.count>0&&p.count<100000,'position count');
      invariant(weights?.count===p.count&&joints?.count===p.count,'skin attribute count');
      invariant(weights.itemSize===4&&joints.itemSize===4,'four-influence contract');
      const geometry=original.clone();
      allocated.push(geometry);
      // Verify true glTF bind behavior as well as named joints. Never copy the imported animator.
      skeleton.update();
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i);const expected=point.clone().applyMatrix4(mesh.matrixWorld);
        mesh.applyBoneTransform(i,point).applyMatrix4(mesh.matrixWorld);
        invariant(point.distanceTo(expected)<1e-5,`bind deformation vertex ${i}`);
        let total=0;
        for(let j=0;j<4;j++){
          const weight=weights.getComponent(i,j),index=joints.getComponent(i,j);
          invariant(Number.isFinite(weight)&&weight>=0&&Number.isInteger(index)&&index>=0&&index<27,`weights vertex ${i}`);total+=weight;
          (geometry.getAttribute('skinIndex') as BufferAttribute).setComponent(i,j,mapping[index]);
        }
        invariant(Math.abs(total-1)<1e-4,`unnormalized weights vertex ${i}`);
      }
      geometry.applyMatrix4(mesh.matrixWorld);
      const surface=geometry.getAttribute('_dw_surface'),glow=geometry.getAttribute('_dw_glow'),recipe=geometry.getAttribute('_dw_recipe');
      invariant(surface?.count===p.count&&glow?.count===p.count&&recipe?.count===p.count&&geometry.getAttribute('uv')?.count===p.count,'surface/dye/UV attributes');
      invariant(Array.isArray(meta.recipes)&&meta.recipes.length>0&&meta.recipes.every((r:unknown)=>recipeValid(r)),'invalid dye recipes');
      for(let i=0;i<p.count;i++){
        invariant(Number.isInteger(surface.getX(i))&&surface.getX(i)>=0&&surface.getX(i)<=4,'material identity');
        invariant(Number.isInteger(recipe.getX(i))&&recipe.getX(i)>=0&&recipe.getX(i)<meta.recipes.length,'recipe mapping');
      }
      invariant(geometry.index&&geometry.index.count%3===0,'triangle topology');
      for(let i=0;i<geometry.index.count;i++)invariant(Number.isInteger(geometry.index.getX(i))&&geometry.index.getX(i)>=0&&geometry.index.getX(i)<p.count,'index range');
      for(const attr of Object.values(geometry.attributes))for(let i=0;i<attr.count;i++)for(let c=0;c<attr.itemSize;c++)invariant(Number.isFinite(attr.getComponent(i,c)),'nonfinite attribute');
      invariant(meta.topology===topologySignature(geometry),'stale exported topology/binding metadata');
      const part:ImportedRegion={region:meta.region,build:meta.build,fitKey:meta.fitKey,geometry,recipes:meta.recipes,topology:meta.topology};
      if(equipmentNames.includes(meta.region)){
        invariant(meta.build==='medium'&&meta.method==='direct','Windkeel authored fitting boundary');
        invariant(Array.isArray(meta.equipmentParts)&&meta.equipmentParts.length===23,'Windkeel component identity');
        let end=0,triangles=0;const names=new Set<string>();
        for(const c of meta.equipmentParts){
          invariant(typeof c.name==='string'&&!names.has(c.name)&&c.startVertex===end&&Number.isInteger(c.vertices)&&c.vertices>0&&Number.isInteger(c.triangles)&&c.triangles>0&&['blue','linen','leather','bronze','slate'].includes(c.role),'Windkeel component range');
          end+=c.vertices;triangles+=c.triangles;names.add(c.name);
        }
        invariant(end===p.count&&triangles*3===geometry.index.count,'Windkeel component topology');
        const socketNames=['AN_SOCKET_WINDLINE_DORSAL','AN_SOCKET_GUIDE_LEFT','AN_SOCKET_RIDING_LEFT','AN_SOCKET_RIDING_RIGHT'];
        invariant(Array.isArray(meta.sockets)&&meta.sockets.length===4&&socketNames.every(n=>meta.sockets.filter((s:EquipmentSocket)=>s.name===n).length===1),'Windkeel four sockets');
        invariant(meta.sockets.every((s:EquipmentSocket)=>BONE_NAMES.includes(s.bone)&&Array.isArray(s.p)&&s.p.length===3&&s.p.every(Number.isFinite)),'Windkeel socket frames');
        part.equipmentParts=meta.equipmentParts;part.sockets=meta.sockets;
      }
      if(authored){
        invariant(meta.fitKey==='authored-v1'&&['direct','delta','bound','cloth'].includes(meta.method),'authored fitting method');
        const source=new BufferGeometry();
        try{
          invariant(Array.isArray(meta.cagePositions)&&meta.cagePositions.length%3===0&&meta.cagePositions.every(Number.isFinite),'fitting cage positions');
          invariant(Array.isArray(meta.cageIndices)&&meta.cageIndices.length%3===0&&meta.cageIndices.every((n:number)=>Number.isInteger(n)&&n>=0&&n<meta.cagePositions.length/3),'fitting cage indices');
          source.setAttribute('position',new BufferAttribute(new Float32Array(meta.cagePositions),3));source.setIndex(meta.cageIndices);
          invariant(meta.sourceLayout===layoutSignature(source)&&meta.sourceTopology===topologySignature(source),'stale fitting source');
          part.method=meta.method;part.sourceLayout=meta.sourceLayout;part.cagePositions=source.attributes.position.array as Float32Array;part.cageIndices=new Uint32Array(meta.cageIndices);
          const cage=geometry.attributes._dw_cage,bary=geometry.attributes._dw_bary,offset=geometry.attributes._dw_offset;
          invariant([cage,bary,offset].every(a=>a?.itemSize===3&&a.count===p.count),'missing final-topology binding');
          for(let i=0;i<p.count;i++){
            let sum=0;for(let j=0;j<3;j++){const n=cage.getComponent(i,j),w=bary.getComponent(i,j);invariant(Number.isInteger(n)&&n>=0&&n<source.attributes.position.count&&w>=0&&w<=1,'invalid surface binding');sum+=w;}
            invariant(Math.abs(sum-1)<1e-4,'surface binding weights');
          }
          if(part.method==='delta')invariant(layoutSignature(geometry)===meta.sourceLayout,'delta topology changed');
          if(part.method==='cloth'){
            invariant(Number.isInteger(meta.cols)&&Number.isInteger(meta.rows)&&meta.cols*meta.rows===p.count,'cloth grid topology');
            const c=meta.control;
            invariant(c&&Number.isInteger(c.cols)&&Number.isInteger(c.rows)&&c.rest.length===c.cols*c.rows&&c.anchorBone.length===c.rest.length&&c.guideSkin?.length===c.rest.length,'cloth control source');
            invariant(c.rest.every((p:number[])=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))&&c.anchorBone.every((b:number)=>Number.isInteger(b)&&b>=-1&&b<27),'cloth control data');
            part.cols=meta.cols;part.rows=meta.rows;part.control={...c,rest:c.rest.map((p:number[])=>new Vector3().fromArray(p))};
          }
        }finally{source.dispose();}
      }
      regions.push(part);
    });
    if(contract.kind==='compatibility-fixture')invariant(regions.length===2&&regions.some(p=>p.region==='legL')&&regions.some(p=>p.region==='legR'),'incomplete region pair');
    else invariant(authoredNames.every(name=>(name.startsWith('piece:')||name.startsWith('cloth:')?['slight','medium','broad']:['medium']).every(build=>regions.some(p=>p.region===name&&p.build===build))),'incomplete authored provider');
    if(regions.some(p=>equipmentNames.includes(p.region)))invariant(equipmentNames.every(name=>regions.some(p=>p.region===name)),'incomplete Windkeel fit pair');
    return {kind:contract.kind,source:String(contract.source),regions,bytes};
  }catch(e){for(const geometry of allocated)geometry.dispose();throw e;}
  finally{for(const rig of Object.values(rigs))rig.skeleton.dispose();}
}

const loads=new Map<string,Promise<ImportedRiderAsset>>();
export function loadImportedRider(url:string):Promise<ImportedRiderAsset> {
  const prior=loads.get(url);if(prior)return prior;
  const pending=(async()=>{
    const response=await fetch(url);if(!response.ok)throw Error(`Rider import: HTTP ${response.status}`);
    const buffer=await response.arrayBuffer();inspectTrialGLB(buffer);
    const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf=await new GLTFLoader().parseAsync(buffer,'');
    try{return validateImportedScene(gltf.scene,buffer.byteLength);}
    finally{
      const skeletons=new Set<SkinnedMesh['skeleton']>();
      gltf.scene.traverse(o=>{const m=o as SkinnedMesh;if(!m.isMesh)return;m.geometry.dispose();
        for(const material of Array.isArray(m.material)?m.material:[m.material])material.dispose();if(m.isSkinnedMesh)skeletons.add(m.skeleton);});
      for(const skeleton of skeletons)skeleton.dispose();
    }
  })();
  loads.set(url,pending);pending.catch(()=>loads.delete(url));return pending;
}

/** One surface replaces one generated region; remaining wardrobe/accessories stay generated. */
export function importedLeg(asset:ImportedRiderAsset,used:string[]):NonNullable<OutfitStyle['shape']>['leg'] {
  return (ctx:BodyCtx,style:OutfitStyle,side:Side)=>{
    const fit=`${garmentSource(ctx.look,'trousers')}-trousers/${garmentSource(ctx.look,'footwear')}-footwear/${garmentSource(ctx.look,'legWraps')??'none'}-legWraps`;
    const region=side===1?'legL':'legR';
    const part=asset.regions.find(p=>p.region===region&&p.build===ctx.d.build&&p.fitKey===fit);
    if(!part){softLeg(ctx,style,side);return;}
    const {b}=ctx,g=part.geometry,attrs=g.attributes,memo=new Map<ColorRecipe,Color>(),base=b.vertexCount;
    b.begin();
    for(let i=0;i<attrs.position.count;i++){
      const recipe=part.recipes[attrs._dw_recipe.getX(i)],color=withRecipe(evalRecipe(recipe,ctx.look,memo),recipe);
      const skin:number[]=[];for(let j=0;j<4;j++)if(attrs.skinWeight.getComponent(i,j)>0)skin.push(attrs.skinIndex.getComponent(i,j),attrs.skinWeight.getComponent(i,j));
      // UVs are already atlas addresses. Append the raw attributes after constructing the region.
      b.vertex(new Vector3().fromBufferAttribute(attrs.position,i),color,skin,attrs._dw_glow.getX(i));
    }
    for(let i=0;i<g.index!.count;i+=3)b.tri(base+g.index!.getX(i),base+g.index!.getX(i+1),base+g.index!.getX(i+2));
    b.end();
    b.setImportedSurface(base,g);
    used.push(region);
  };
}
