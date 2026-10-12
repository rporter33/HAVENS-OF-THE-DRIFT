// Bounded Blender provider. Generated fitting surfaces retain wardrobe coverage and materials;
// authored geometry replaces its named region or deforms that region before the shared skin pass.
import {BufferAttribute,BufferGeometry,Color,Vector3,type BufferAttribute as Attr,type InterleavedBufferAttribute} from 'three';
import type {RiderGarmentSlot} from '../../core/types';
import {garmentSource} from '../../cosmetics/wardrobe';
import {SkinBuilder} from './meshKit';
import {evalRecipe,recipeOf,surfaceOf,withRecipe,type ColorRecipe} from './palette';
import {softUpperBody,softHand,softLeg,softFoot} from './softBody';
import {proofFace,type RiderProof} from './proof';
import {buildHair} from './hair';
import {layoutSignature,type ImportedRegion,type ImportedRiderAsset} from './importContract';
import {bindClothSurface,deformClothSurface,type ClothSurfaceBinding} from './clothBinding';
import type {BodyCtx,OutfitStyle} from './body';
import type {ClothSpec} from './accessories';
import {proofUV,type ProofSurface} from './proofMaterials';
import {shoulderFittingCage,travelBracerFittingCage} from './authoredConstruction';

const a=new Vector3(),b=new Vector3(),c=new Vector3(),u=new Vector3(),v=new Vector3(),n=new Vector3(),p=new Vector3();
function basis(pos:Attr|InterleavedBufferAttribute,ia:number,ib:number,ic:number):void {
  a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);
  u.subVectors(b,a);n.crossVectors(u,v.subVectors(c,a));
  if(u.lengthSq()<1e-16||n.lengthSq()<1e-16)throw Error('Rider authoring: degenerate fitting triangle');
  u.normalize();n.normalize();v.crossVectors(n,u);
}
function constant(g:BufferGeometry,i:number):ColorRecipe {const color=g.attributes.color;return {k:'const',r:color.getX(i),g:color.getY(i),b:color.getZ(i)};}
function weightedRecipe(rs:ColorRecipe[],ws:number[]):ColorRecipe {
  let total=0,result:ColorRecipe|undefined;
  for(let i=0;i<3;i++)if(ws[i]>1e-7){result=result?{k:'lmix',a:result,b:rs[i],t:ws[i]/(total+ws[i])}:rs[i];total+=ws[i];}
  return result!;
}
function append(ctx:BodyCtx,g:BufferGeometry,recipes:(ColorRecipe|null)[],uniform?:Color):void {
  const {b:out}=ctx,base=out.vertexCount,at=g.attributes,memo=new Map<ColorRecipe,Color>();out.begin();
  for(let i=0;i<at.position.count;i++){
    const recipe=uniform?recipeOf(uniform):recipes[i]??constant(g,i),color=uniform??withRecipe(evalRecipe(recipe!,ctx.look,memo),recipe!);
    const skin:number[]=[];for(let j=0;j<4;j++)if(at.skinWeight.getComponent(i,j)>0)skin.push(at.skinIndex.getComponent(i,j),at.skinWeight.getComponent(i,j));
    out.vertex(p.fromBufferAttribute(at.position,i),color,skin,(at.glow??at._dw_glow).getX(i));
  }
  for(let i=0;i<g.index!.count;i+=3)out.tri(base+g.index!.getX(i),base+g.index!.getX(i+1),base+g.index!.getX(i+2));
  out.end();
  // Uniform gloves use their existing semantic tile while preserving authored UVs/normals.
  if(uniform){
    const copy=g.clone(),kind=surfaceOf(uniform)??'neutral',surface=['neutral','linen','scale','leather','bronze'].indexOf(kind),uv=new Float32Array(at.position.count*2);
    for(let i=0;i<at.position.count;i++)uv.set(proofUV(kind as ProofSurface,.5,.5),i*2);
    copy.setAttribute('uv',new BufferAttribute(uv,2));copy.setAttribute('_dw_surface',new BufferAttribute(new Float32Array(at.position.count).fill(surface),1));out.setImportedSurface(base,copy);copy.dispose();
  }else{if(!g.attributes._dw_surface)g.setAttribute('_dw_surface',g.attributes.c02Surface);out.setImportedSurface(base,g);}
}

/** A spatially indexed, small sculpt delta supports the existing style-dependent topology. */
class SculptField {
  private cells=new Map<string,number[]>();
  private readonly size=.04;
  constructor(private part:ImportedRegion){
    const base=part.cagePositions!;
    for(let i=0;i<base.length/3;i++){const key=this.key(base[i*3],base[i*3+1],base[i*3+2]),list=this.cells.get(key)??[];list.push(i);this.cells.set(key,list);}
  }
  private key(x:number,y:number,z:number):string{return `${Math.floor(x/this.size)},${Math.floor(y/this.size)},${Math.floor(z/this.size)}`;}
  apply(geometry:BufferGeometry):void {
    const base=this.part.cagePositions!,edited=this.part.geometry.attributes.position,pos=geometry.attributes.position;
    const exact=layoutSignature(geometry)===this.part.sourceLayout;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);let dx=0,dy=0,dz=0,total=0;
      if(exact){dx=edited.getX(i)-base[i*3];dy=edited.getY(i)-base[i*3+1];dz=edited.getZ(i)-base[i*3+2];}
      else{
        const cell=[x,y,z].map(n=>Math.floor(n/this.size)),nearest:{id:number,d:number}[]=[];
        for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
          const ids=this.cells.get(`${cell[0]+a},${cell[1]+b},${cell[2]+c}`);if(!ids)continue;
          for(const id of ids){const d=(x-base[id*3])**2+(y-base[id*3+1])**2+(z-base[id*3+2])**2;
            if(d>.0036)continue;nearest.push({id,d});nearest.sort((a,b)=>a.d-b.d);if(nearest.length>4)nearest.pop();}
        }
        for(const {id,d} of nearest){const w=1/Math.max(1e-10,d);dx+=(edited.getX(id)-base[id*3])*w;dy+=(edited.getY(id)-base[id*3+1])*w;dz+=(edited.getZ(id)-base[id*3+2])*w;total+=w;}
        if(total){dx/=total;dy/=total;dz/=total;}
      }
      pos.setXYZ(i,x+dx,y+dy,z+dz);
    }
    geometry.computeVertexNormals();
  }
}
const fields=new WeakMap<ImportedRegion,SculptField>();
function sculpted(ctx:BodyCtx,part:ImportedRegion,draw:(c:BodyCtx)=>void):void {
  const builder=new SkinBuilder(true);draw({...ctx,b:builder});const geometry=builder.build();
  try{let field=fields.get(part);if(!field){field=new SculptField(part);fields.set(part,field);}field.apply(geometry);append(ctx,geometry,builder.recipes);}
  finally{geometry.dispose();}
}
function direct(ctx:BodyCtx,part:ImportedRegion,uniform?:Color):void {
  const g=part.geometry;append(ctx,g,Array.from({length:g.attributes.position.count},(_,i)=>part.recipes[g.attributes._dw_recipe.getX(i)]),uniform);
}
function bareFoot(ctx:BodyCtx,part:ImportedRegion,style:OutfitStyle):void {
  const g=part.geometry.clone(),pos=g.attributes.position,surfaces=new Float32Array(pos.count),uv=new Float32Array(pos.count*2),recipes:ColorRecipe[]=[];
  try{for(let i=0;i<pos.count;i++){
    const color=pos.getY(i)<.012?style.foot.sole:style.foot.color,kind=surfaceOf(color)??'neutral';
    recipes.push(recipeOf(color)??{k:'const',r:color.r,g:color.g,b:color.b});surfaces[i]=['neutral','linen','scale','leather','bronze'].indexOf(kind);uv.set(proofUV(kind,.5,.5),i*2);
  }g.setAttribute('_dw_surface',new BufferAttribute(surfaces,1));g.setAttribute('uv',new BufferAttribute(uv,2));append(ctx,g,recipes);}finally{g.dispose();}
}
function fitted(ctx:BodyCtx,part:ImportedRegion,draw:(c:BodyCtx)=>void):void {
  const builder=new SkinBuilder(true);draw({...ctx,b:builder});const cage=builder.build(),g=part.geometry.clone();
  try{
    if(layoutSignature(cage)!==part.sourceLayout)throw Error(`Rider authoring: fitting topology changed for ${part.build}/${part.region}: ${layoutSignature(cage)} != ${part.sourceLayout}; ${cage.attributes.position.count} vertices / ${cage.index!.count} indices; ${JSON.stringify(ctx.look.wardrobe)}; regenerate the source`);
    const pos=g.attributes.position,source=cage.attributes.position,ids=g.attributes._dw_cage,bary=g.attributes._dw_bary,offset=g.attributes._dw_offset,recipes:ColorRecipe[]=[];
    for(let i=0;i<pos.count;i++){
      const tri=[0,1,2].map(j=>ids.getComponent(i,j)),w=[0,1,2].map(j=>bary.getComponent(i,j));basis(source,tri[0],tri[1],tri[2]);
      p.copy(a).multiplyScalar(w[0]).addScaledVector(b,w[1]).addScaledVector(c,w[2]).addScaledVector(u,offset.getX(i)).addScaledVector(v,offset.getY(i)).addScaledVector(n,offset.getZ(i));pos.setXYZ(i,p.x,p.y,p.z);
      recipes.push(weightedRecipe(tri.map(k=>builder.recipes[k]??constant(cage,k)),w));
    }
    g.computeVertexNormals();append(ctx,g,recipes);
  }finally{cage.dispose();g.dispose();}
}

export function authoredProvider(asset:ImportedRiderAsset,ctx:BodyCtx,cut:RiderProof|undefined,used:string[]):{shape:NonNullable<OutfitStyle['shape']>,head:(c:BodyCtx)=>void,hair:(covered:boolean)=>void} {
  const find=(id:string,build=ctx.d.build)=>asset.regions.find(p=>p.region===id&&p.build===build);
  const edit=(id:string,c:BodyCtx,draw:(c:BodyCtx)=>void)=>{const part=find(id);if(!part){draw(c);return;}sculpted(c,part,draw);used.push(id);};
  ctx.authoredGarment=(component,slot,draw)=>{
    const id=`piece:${slot}:${cut??'aerie'}`,part=find(id);
    if(!part)throw Error('Rider authoring: missing supported garment '+id);
    fitted(component,part,slot==='shoulderDrape'?c=>shoulderFittingCage(c,cut??'aerie',draw):slot==='armWraps'?travelBracerFittingCage:draw);used.push(id);
  };
  return {
    shape:{upperBody:(c,s)=>{const styled=garmentSource(c.look,'armWraps')==='travel-drape'?{...s,arm:{...s.arm,color:(t:number,th:number,side:1|-1)=>t>.345*c.d.h&&t<.49*c.d.h?c.pal.gearLeather:s.arm.color(t,th,side)}}:s;edit('upper',c,x=>softUpperBody(x,styled));},
      hand:(c,s,side)=>{const id=side===1?'handL':'handR',part=find(id);if(part){direct(c,part,s.hand);used.push(id);}else softHand(c,s,side);},
      leg:(c,s,side)=>{const id=side===1?'legL':'legR';if(garmentSource(c.look,'trousers')==='travel-drape')edit(id,c,x=>softLeg(x,s,side));else softLeg(c,s,side);},
      foot:(c,s,side)=>{const source=garmentSource(c.look,'footwear'),id=side===1?'barefootL':'barefootR',part=find(id);
        if(part&&(!source||source==='travel-drape')){bareFoot(c,part,s);used.push(id);}else edit(side===1?'footL':'footR',c,x=>softFoot(x,s,side));}},
    head:c=>{const part=find('head');if(part){direct(c,part);used.push('head');}else proofFace(c);},
    hair:covered=>{if(ctx.look.hair==='ponytail'&&!covered){const part=find('ponytail-crown');if(part){fitted(ctx,part,c=>buildHair(c,c.look,false,true));used.push('ponytail-crown');}else buildHair(ctx,ctx.look,covered,true);}else buildHair(ctx,ctx.look,covered,true,!!find('head'));},
  };
}

const clothBindings=new WeakMap<ImportedRegion,ClothSurfaceBinding>();
/** Bind authored offsets onto each current fitting cage. Solver positions are never skinned twice. */
export function authoredClothSurface(asset:ImportedRiderAsset,build:BodyCtx['d']['build'],cut:RiderProof|undefined,spec:ClothSpec):ClothSurfaceBinding|undefined {
  if(!spec.name.startsWith('garment-travel-drape-'))return;
  const part=asset.regions.find(p=>p.build===build&&p.region===`cloth:${spec.name}:${cut??'aerie'}`);
  if(!part?.control)throw Error('Rider authoring: missing cloth fitting source '+spec.name);
  let original=clothBindings.get(part);
  if(!original){const source={...spec,...part.control};original=bindClothSurface(source,{cols:part.cols!,rows:part.rows!,positions:new Float32Array(part.geometry.attributes.position.array)});clothBindings.set(part,original);}
  if(spec.cols!==part.control.cols||spec.rows!==part.control.rows||spec.anchorBone.some((b,i)=>b!==part.control!.anchorBone[i]))throw Error('Rider authoring: cloth controls changed; regenerate bindings');
  const positions=new Float32Array(original.surface.positions.length);deformClothSurface(original,spec.rest.flatMap(p=>p.toArray()),positions);
  return bindClothSurface(spec,{cols:part.cols!,rows:part.rows!,positions});
}
