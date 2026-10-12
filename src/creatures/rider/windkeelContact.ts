// Rig-supported leather rests over the trousers. The free Travel skirt rests over that
// leather; contact must never pull the fastened links away from the rider. Only the final
// drawn cloth changes here: its solver, pinned seams and skeleton remain authoritative.
import {Matrix4,Vector3,type BufferGeometry} from 'three';
import type {Rig} from './rig';
import type {ClothRig} from './clothRig';
import type {EquipmentPart} from './importContract';

const CLEARANCE=.003,MAX_CORRECTION=.10,EPSILON=1e-6;
type Point={x:number;y:number;z:number};
type Face={ids:number[];minX:number;maxX:number;minY:number;maxY:number;area:number};
type Surface={world:Vector3[];projected:Point[];faces:Face[];offset:Float64Array;budget:Float64Array;spans:{a:number;b:number;length:number}[]};

const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function face(ids:number[],p:Point[]):Face {
 const [a,b,c]=ids.map(i=>p[i]);
 return {ids,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),area:cross(a,b,c)};
}
function barycentric(p:Point,a:Point,b:Point,c:Point,area:number):number[]{
 const w0=cross(b,c,p)/area,w1=cross(c,a,p)/area;
 return [w0,w1,1-w0-w1];
}
/** The overlap polygon includes face interiors and exact span/edge intersections. Vertex
 * or midpoint rays alone miss a narrow leather link crossing a large folded cloth face. */
function overlap(cloth:Point[],support:Point[],orientation:number):Point[]{
 let polygon=cloth;
 for(let edge=0;edge<3&&polygon.length;edge++){
  const a=support[edge],b=support[(edge+1)%3],next:Point[]=[];
  let previous=polygon[polygon.length-1],previousSide=cross(a,b,previous)*orientation;
  for(const current of polygon){
   const side=cross(a,b,current)*orientation;
   if((side>=0)!==(previousSide>=0)){
    const t=previousSide/(previousSide-side);
    next.push({x:previous.x+(current.x-previous.x)*t,y:previous.y+(current.y-previous.y)*t,z:0});
   }
   if(side>=0)next.push(current);
   previous=current;previousSide=side;
  }
  polygon=next;
 }
 return polygon;
}

export function windkeelContact(geometry:BufferGeometry,parts:EquipmentPart[]){
 const position=geometry.attributes.position,joints=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
 const selected=new Set<number>();
 for(const part of parts.filter(p=>/^Hip_-?1_-1_flex_link$/.test(p.name)))for(let k=0;k<part.vertices;k++)selected.add(part.startVertex+k);
 const linkIds=[...selected],linkIndex=new Map(linkIds.map((id,k)=>[id,k])),linkWorld=linkIds.map(()=>new Vector3()),linkProjected=linkIds.map(()=>({x:0,y:0,z:0}));
 const linkFaces:number[][]=[],index=geometry.index;
 if(index)for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(ids.every(id=>selected.has(id)))linkFaces.push(ids.map(id=>linkIndex.get(id)!));}
 const surfaces=new WeakMap<BufferGeometry,Surface>(),bone=new Matrix4(),rest=new Vector3(),posed=new Vector3();
 const normal=new Vector3(),across=new Vector3(),up=new Vector3(),axis=new Vector3(),inverse=new Matrix4();
 return (pieces:ClothRig['pieces'],rig:Rig):void=>{
  const diagnostic={maxRequested:0,maxApplied:0,rejected:0,pinned:0,remaining:0};geometry.userData.windkeelContact=diagnostic;
  const panels=pieces.filter(pc=>pc.spec.name.startsWith('garment-travel-drape-'));
  if(!panels.length||!linkFaces.length)return;
  // Skin support geometry once. Cloth already contains its posed, contacted final surface;
  // it is drawn in the translation-only solver frame and must never be skinned here again.
  for(let k=0;k<linkIds.length;k++){
   const id=linkIds[k],out=linkWorld[k];out.set(0,0,0);rest.fromBufferAttribute(position,id);
   for(let j=0;j<4;j++){
    const weight=weights.getComponent(id,j);if(!weight)continue;
    const joint=joints.getComponent(id,j);bone.multiplyMatrices(rig.bones[joint].matrixWorld,rig.skeleton.boneInverses[joint]);
    posed.copy(rest).applyMatrix4(bone);out.addScaledVector(posed,weight);
   }
  }
  for(const pc of panels){
   const p=pc.geo.attributes.position,idx=pc.geo.index;if(!idx)continue;
   normal.copy(pc.contactDirection).normalize();if(normal.lengthSq()<.5)continue;
   axis.set(0,1,0);if(Math.abs(normal.dot(axis))>.95)axis.set(1,0,0);
   across.crossVectors(axis,normal).normalize();up.crossVectors(normal,across).normalize();
   const project=(v:Vector3,out:Point)=>{out.x=v.dot(across);out.y=v.dot(up);out.z=v.dot(normal);};
   for(let k=0;k<linkWorld.length;k++)project(linkWorld[k],linkProjected[k]);
   const supports=linkFaces.map(ids=>face(ids,linkProjected)).filter(f=>Math.abs(f.area)>1e-12);
   let surface=surfaces.get(pc.geo);
   if(!surface||surface.world.length!==p.count){
    const world=Array.from({length:p.count},()=>new Vector3()),projected=world.map(()=>({x:0,y:0,z:0}));
    const faces:Face[]=[],spans:Surface['spans']=[],edges=new Set<string>();
    for(let i=0;i<idx.count;i+=3){
     const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];faces.push(face(ids,projected));
     for(let j=0;j<3;j++){const a=Math.min(ids[j],ids[(j+1)%3]),b=Math.max(ids[j],ids[(j+1)%3]),key=a+':'+b;if(!edges.has(key)){edges.add(key);spans.push({a,b,length:0});}}
    }
    surface={world,projected,faces,offset:new Float64Array(p.count),budget:new Float64Array(p.count),spans};surfaces.set(pc.geo,surface);
   }
   const s=surface;s.offset.fill(0);
   for(let i=0;i<p.count;i++){s.world[i].fromBufferAttribute(p,i).applyMatrix4(pc.mesh.matrixWorld);project(s.world[i],s.projected[i]);}
   for(let i=0;i<s.faces.length;i++)s.faces[i]=face(s.faces[i].ids,s.projected);
   for(const span of s.spans)span.length=s.world[span.a].distanceTo(s.world[span.b]);
   // A fixed seam cannot supply outward displacement. Bound neighbouring repairs by
   // the shortest drawn-edge path to that seam and the existing contact slope. Otherwise
   // a tiny free barycentric weight can turn millimetres of contact into a large cloth fin.
   s.budget.fill(MAX_CORRECTION);for(let i=0;i<p.count;i++)if(pc.surfacePinned[i])s.budget[i]=0;
   for(let pass=0;pass<p.count;pass++){
    let changed=false;
    for(const edge of s.spans){
     const length=.65*edge.length;
     if(s.budget[edge.a]>s.budget[edge.b]+length){s.budget[edge.a]=s.budget[edge.b]+length;changed=true;}
     if(s.budget[edge.b]>s.budget[edge.a]+length){s.budget[edge.b]=s.budget[edge.a]+length;changed=true;}
    }
    if(!changed)break;
   }
   // Projection coordinates remain fixed while corrections move only outward. Cache exact
   // face-overlap constraints once; repeated monotone solves cannot undo an earlier contact.
   const constraints:{ids:number[];weights:number[];target:number;feasible?:boolean}[]=[];
   for(const clothFace of s.faces)for(const support of supports){
    if(clothFace.maxX<support.minX||clothFace.minX>support.maxX||clothFace.maxY<support.minY||clothFace.minY>support.maxY)continue;
    const cloth=clothFace.ids.map(i=>s.projected[i]),leather=support.ids.map(i=>linkProjected[i]);
    const polygon=overlap(cloth,leather,Math.sign(support.area));
    for(const point of polygon){
     const sw=barycentric(point,...leather as [Point,Point,Point],support.area),supportDepth=sw.reduce((v,w,k)=>v+w*leather[k].z,0)+CLEARANCE;
     if(Math.abs(clothFace.area)>1e-12){
      const cw=barycentric(point,...cloth as [Point,Point,Point],clothFace.area).map(w=>Math.max(0,Math.min(1,w)));
      const total=cw.reduce((v,w)=>v+w,0);for(let k=0;k<3;k++)cw[k]/=total;
      constraints.push({ids:clothFace.ids,weights:cw,target:supportDepth-cw.reduce((v,w,k)=>v+w*cloth[k].z,0)});
     }else{
      // Edge-on folds have no unique projected barycentric coordinate. Clearing the full
      // face against the support depth is conservative and still preserves every pin.
      for(let k=0;k<3;k++)constraints.push({ids:[clothFace.ids[k]],weights:[1],target:supportDepth-cloth[k].z});
     }
    }
   }
   for(const c of constraints){
    diagnostic.maxRequested=Math.max(diagnostic.maxRequested,c.target);
    const possible=c.weights.reduce((v,w,k)=>v+w*s.budget[c.ids[k]],0);
    c.feasible=c.target<=possible+EPSILON;
   }
   for(let pass=0;pass<48;pass++){
    let changed=false;
    for(const c of constraints){
     // Do not deform free neighbours toward an impossible pinned contact. Keep that
     // construction failure visible in diagnostics instead of making a detached fin.
     if(!c.feasible)continue;
     const current=c.weights.reduce((v,w,k)=>v+w*s.offset[c.ids[k]],0),need=c.target-current;if(need<=EPSILON)continue;
     const free=c.weights.reduce((v,w,k)=>v+(s.offset[c.ids[k]]+EPSILON>=s.budget[c.ids[k]]?0:w*w),0);
     if(free<1e-12)continue;
     for(let k=0;k<c.ids.length;k++){
      const id=c.ids[k];if(pc.surfacePinned[id])continue;
      const next=Math.min(s.budget[id],s.offset[id]+need*c.weights[k]/free);
      if(next>s.offset[id]+EPSILON*.1){s.offset[id]=next;changed=true;}
     }
    }
    // Spread only outward displacement, as the existing cloth surface contact does, to
    // avoid a narrow support making a sharp fin. Fixed seams never participate in repair.
    for(const edge of s.spans)for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){
     if(pc.surfacePinned[a])continue;
     const next=Math.min(s.budget[a],s.offset[b]-.65*edge.length);
     if(next>s.offset[a]+EPSILON){s.offset[a]=next;changed=true;}
    }
    if(!changed)break;
   }
   for(const c of constraints){
    const remaining=c.target-c.weights.reduce((v,w,k)=>v+w*s.offset[c.ids[k]],0);
    if(remaining>EPSILON*4){
     diagnostic.remaining++;
     if(!c.feasible&&c.ids.some((id,k)=>s.budget[id]<MAX_CORRECTION&&c.weights[k]>1e-9))diagnostic.pinned++;
     else diagnostic.rejected++;
    }
   }
   let touched=false;inverse.copy(pc.mesh.matrixWorld).invert();
   for(let i=0;i<p.count;i++){
    const amount=s.offset[i];if(amount<=0||pc.surfacePinned[i])continue;
    posed.copy(s.world[i]).addScaledVector(normal,amount).applyMatrix4(inverse);p.setXYZ(i,posed.x,posed.y,posed.z);touched=true;
    diagnostic.maxApplied=Math.max(diagnostic.maxApplied,amount);
   }
   if(touched){p.needsUpdate=true;pc.geo.computeVertexNormals();pc.geo.computeBoundingBox();pc.geo.computeBoundingSphere();}
  }
 };
}
