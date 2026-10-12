// Selected Windkeel fixture. Reuse the rider's rig, atlas, dye recipes and candidate lifecycle.
// Authored Flight correction is already baked in its source and is never applied here again.
import {BufferGeometry,Color,Ray,Triangle,Vector3} from 'three';
import type {BodyCtx} from './body';
import {garmentSource} from '../../cosmetics/wardrobe';
import {SkinBuilder} from './meshKit';
import {evalRecipe,withRecipe,type ColorRecipe} from './palette';
import {B} from './rig';
import type {ImportedRiderAsset,EquipmentPart} from './importContract';
import type {HarnessAnchor,RestingHarness} from './restingHarness';
import {windkeelContact} from './windkeelContact';

export function windkeelHarness(ctx:BodyCtx,body:BufferGeometry,asset:ImportedRiderAsset):RestingHarness {
  const aerie=garmentSource(ctx.look,'top')==='travel-drape'||garmentSource(ctx.look,'waist')==='travel-drape';
  const region=asset.regions.find(r=>r.region==='equipment:windkeel-'+(aerie?'aerie':'flight'));
  if(!region?.equipmentParts||!region.sockets)throw Error('Selected Windkeel fit missing');
  const g=region.geometry.clone(),p=g.attributes.position,h=ctx.d.h,w=ctx.d.w,girth=ctx.d.g;
  const diagnostics={samples:0,misses:0,maxSurfaceOffset:0};
  const scale=(v:Vector3)=>v.set(v.x*w,v.y*h,v.z*girth);
  for(let i=0;i<p.count;i++){const v=scale(new Vector3().fromBufferAttribute(p,i));p.setXYZ(i,v.x,v.y,v.z);}
  const parts=region.equipmentParts,byName=new Map(parts.map(part=>[part.name,part]));
  const bp=body.attributes.position,index=body.index!,tri=new Triangle(),ray=new Ray(),hit=new Vector3(),bary=new Vector3();
  const faces:{ids:number[];a:Vector3;b:Vector3;c:Vector3;min:number;max:number;waist:boolean}[]=[],buckets=new Map<number,typeof faces>();
  const step=.025*h;
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    if(ctx.equipmentUnderlayers?.some(r=>ids.some(id=>id>=r.start&&id<r.end)))continue;
    const vertices=ids.map(id=>new Vector3().fromBufferAttribute(bp,id)),ys=vertices.map(v=>v.y),min=Math.min(...ys),max=Math.max(...ys);
    if(min>1.49*h||max<.77*h)continue;
    const waist=ctx.equipmentWaistLayers?.some(r=>ids.some(id=>id>=r.start&&id<r.end))??false;
    const face={ids,a:vertices[0],b:vertices[1],c:vertices[2],min,max,waist};faces.push(face);
    for(let k=Math.floor(min/step);k<=Math.floor(max/step);k++){const list=buckets.get(k)??[];list.push(face);buckets.set(k,list);}
  }
  function contact(point:Vector3,top=false,leg=0,underWaist=false):{p:Vector3;n:Vector3;skin:number[]}{
    const origin=top?new Vector3(point.x,1.30*h,point.z):new Vector3(leg*ctx.d.hipHalfWidth,point.y,leg?0:ctx.torsoAt(point.y).cz);
    const direction=top?new Vector3(0,1,0):point.clone().sub(origin).normalize();
    const preferred=point.distanceTo(origin);ray.set(origin,direction);let error=Infinity,selected:typeof faces[number]|undefined;const result=new Vector3();
    for(const f of top?faces:buckets.get(Math.floor(point.y/step))??[]){
      if(underWaist&&f.waist)continue;
      if(!ray.intersectTriangle(f.a,f.b,f.c,false,hit))continue;
      const t=hit.distanceTo(origin),e=Math.abs(t-preferred);
      if(t<.45&&e<error){error=e;selected=f;result.copy(hit);}
    }
    diagnostics.samples++;
    // At the deltoid seam a radial ray can pass through an arm opening. Use the
    // adjacent rendered triangle itself, within 4 cm, instead of inventing a surface.
    if(!selected){
      let distance=.04;
      for(const f of faces){if(underWaist&&f.waist||f.min>point.y+.04||f.max<point.y-.04)continue;
        tri.set(f.a,f.b,f.c);tri.closestPointToPoint(point,hit);const d=hit.distanceTo(point);
        if(d<distance){distance=d;selected=f;result.copy(hit);}
      }
    }
    if(!selected){diagnostics.misses++;throw Error('Windkeel fitting surface missing at '+point.toArray());}
    tri.set(selected.a,selected.b,selected.c);const n=tri.getNormal(new Vector3());if(n.dot(direction)<0)n.negate();
    tri.getBarycoord(result,bary);const weights=new Map<number,number>();
    for(let j=0;j<3;j++)for(let k=0;k<4;k++){const id=selected.ids[j],bone=body.attributes.skinIndex.getComponent(id,k),value=Math.max(0,bary.getComponent(j))*body.attributes.skinWeight.getComponent(id,k);weights.set(bone,(weights.get(bone)??0)+value);}
    const pairs=[...weights].filter(([,v])=>v>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),total=pairs.reduce((n,[,v])=>n+v,0);
    return {p:result,n,skin:pairs.flatMap(([bone,v])=>[bone,v/total])};
  }
  const deltas=new Map<string,Vector3[]>();
  // The load-bearing tail passes beneath the fixed Travel waistband before it
  // follows the thigh. Derive that hidden tuck from the actual pinned seam,
  // rather than letting a closest-body fit put it outside the seam boundary.
  function underPinnedWaist(point:Vector3):void {
    const panels=ctx.garmentCloth.filter(pc=>pc.name.startsWith('garment-travel-drape-'));
    if(!panels.length)return;
    const rootY=panels[0].rest[0].y,origin=new Vector3(0,rootY,ctx.torsoAt(rootY).cz);
    const direction=new Vector3(point.x,0,point.z-origin.z),radius=direction.length();direction.divideScalar(radius);
    let seam=Infinity;
    for(const pc of panels)for(let i=0;i<pc.cols-1;i++){
      const a=pc.rest[i],b=pc.rest[i+1],ex=b.x-a.x,ez=b.z-a.z,den=direction.x*ez-direction.z*ex;
      if(Math.abs(den)<1e-10)continue;
      const ax=a.x-origin.x,az=a.z-origin.z,t=(ax*ez-az*ex)/den,u=(ax*direction.z-az*direction.x)/den;
      if(t>0&&u>=0&&u<=1)seam=Math.min(seam,t);
    }
    if(seam<Infinity&&radius>seam-.006){point.x=direction.x*(seam-.006);point.z=origin.z+direction.z*(seam-.006);}
  }
  function strip(part:EquipmentPart,stride:number,leg=0):void {
    const shifts:Vector3[]=[];
    for(let row=0;row<part.vertices/stride;row++){
      const start=part.startVertex+row*stride,center=new Vector3();for(let k=0;k<stride;k++)center.add(new Vector3().fromBufferAttribute(p,start+k));center.multiplyScalar(1/stride);
      const shoulder=part.name.startsWith('Shoulder'),top=shoulder&&row>=7&&row<=11;
      const rear=part.name.startsWith('Hip_')&&part.name.includes('_-1_');
      const fit=contact(center,top,leg,rear),shift=fit.p.clone().addScaledVector(fit.n,.004).sub(center);shifts.push(shift);
      for(let k=0;k<stride;k++){
        const id=start+k,point=new Vector3().fromBufferAttribute(p,id).add(shift);
        // Leather has a shallow gravity curve between fastenings, without suspended bulk.
        if(part.name.startsWith('Hip_')&&row>0&&row<6)point.y-=.003*h*Math.sin(Math.PI*row/6);
        p.setXYZ(id,point.x,point.y,point.z);
      }
    }
    deltas.set(part.name,shifts);
  }
  function rigid(names:string[],support:Vector3,top=false):Vector3 {
    const fit=contact(support,top),delta=fit.p.clone().addScaledVector(fit.n,.004).sub(support);
    for(const name of names){const part=byName.get(name)!;for(let i=part.startVertex;i<part.startVertex+part.vertices;i++)p.setXYZ(i,p.getX(i)+delta.x,p.getY(i)+delta.y,p.getZ(i)+delta.z);}
    return delta;
  }
  const sockets:Record<string,HarnessAnchor>={};
  try{
    for(const part of parts){
      if(part.name.startsWith('Shoulder')&&part.role==='linen')strip(part,6);
      else if(part.name.startsWith('Shoulder')&&part.role==='blue'){
        const shifts=deltas.get(part.name.replace('_blue','_linen'))!;
        for(let i=0;i<part.vertices;i++){const id=part.startVertex+i,delta=shifts[Math.floor(i/6)];p.setXYZ(id,p.getX(id)+delta.x,p.getY(id)+delta.y,p.getZ(id)+delta.z);}
      }else if(part.name.startsWith('Waist'))strip(part,4);
      else if(part.name.startsWith('Thigh'))strip(part,4,part.name.startsWith('Thigh_1_')?1:-1);
      else if(part.name.startsWith('Hip_'))strip(part,4,part.name.startsWith('Hip_1_')?1:-1);
    }
    // A centreline fit can bridge a convex shoulder or a gathered trouser edge.
    // Correct the final flexible surface too, retaining a thin authored cross-section.
    const ringSkins=new Map<string,number[][]>();
    for(const part of parts){
      const shoulder=part.name.startsWith('Shoulder'),leg=part.name.startsWith('Thigh')||part.name.startsWith('Hip_');
      if(!shoulder&&!leg&&!part.name.startsWith('Waist'))continue;
      const stride=shoulder?6:4;
      const skins:number[][]=[];ringSkins.set(part.name,skins);
      for(let row=0;row<part.vertices/stride;row++){
        const start=part.startVertex+row*stride,center=new Vector3();for(let k=0;k<stride;k++)center.add(new Vector3().fromBufferAttribute(p,start+k));center.multiplyScalar(1/stride);
        const top=shoulder&&row>=7&&row<=11,side=leg?(part.name.includes('_1_')&&!part.name.startsWith('Hip_-')?1:-1):0;
        const rear=part.name.startsWith('Hip_')&&part.name.includes('_-1_');
        const central=contact(center,top,side,rear);
        // A leather cross-section is one strip, not six independently skinned body points.
        // Keep the authored smooth hips/thigh load path. For torso runs, share one support
        // field across each ring and its blue/linen layers so a raised arm cannot shear it.
        const ringSkin=shoulder&&part.role==='blue'
          ?ringSkins.get(part.name.replace('_blue','_linen'))![row]
          :central.skin;
        skins.push(ringSkin);
        for(let k=0;k<stride;k++){
          const id=start+k,point=new Vector3().fromBufferAttribute(p,id),depth=Math.max(0,Math.min(.003,point.clone().sub(center).dot(central.n)+.0015));
          const fit=contact(point,top,side,rear),layer=shoulder&&part.role==='blue'?.003:0;
          point.copy(fit.p).addScaledVector(fit.n,.0015+depth+layer);
          if(rear&&row<=1)underPinnedWaist(point);
          p.setXYZ(id,point.x,point.y,point.z);
          if(!leg)for(let k=0;k<4;k++){g.attributes.skinIndex.setComponent(id,k,ringSkin[k*2]??0);g.attributes.skinWeight.setComponent(id,k,ringSkin[k*2+1]??0);}
          diagnostics.maxSurfaceOffset=Math.max(diagnostics.maxSurfaceOffset,.0015+depth+layer);
        }
      }
    }
    // Translate the centered A+B motif as one rigid group; never reshape its metal.
    const dorsal=rigid(['Dorsal_linen_cushion','Dorsal_single_slate_tab','Windkeel_bronze_split_current','Windkeel_offset_leaf_ridge'],scale(new Vector3(0,1.198,-.130)));
    const guide=rigid(['Left_shoulder_flat_line_guide'],scale(new Vector3(.104,1.445,-.036)),true);
    const sideDeltas=new Map<number,Vector3>();
    for(const side of [1,-1])sideDeltas.set(side,rigid([`Side_${side}_release_eye`,`Side_${side}_leather_release_tongue`,`Riding_${side}_stowed_loop`],scale(new Vector3(side*.1576,1.072,.0761))));
    for(const s of region.sockets){
      const delta=s.name.includes('DORSAL')?dorsal:s.name.includes('GUIDE')?guide:sideDeltas.get(s.name.endsWith('LEFT')?1:-1)!;
      sockets[s.name]={p:scale(new Vector3().fromArray(s.p)).add(delta),skin:[B[s.bone],1]};
    }
    g.computeVertexNormals();const out=new SkinBuilder(true),recipes:ColorRecipe[]=[],memo=new Map<ColorRecipe,Color>();out.begin();
    for(let i=0;i<p.count;i++){
      const recipe=region.recipes[g.attributes._dw_recipe.getX(i)];recipes.push(recipe);
      const skin:number[]=[];for(let k=0;k<4;k++){const weight=g.attributes.skinWeight.getComponent(i,k);if(weight)skin.push(g.attributes.skinIndex.getComponent(i,k),weight);}
      out.vertex(new Vector3().fromBufferAttribute(p,i),withRecipe(evalRecipe(recipe,ctx.look,memo),recipe),skin,0);
    }
    for(let i=0;i<g.index!.count;i+=3)out.tri(g.index!.getX(i),g.index!.getX(i+1),g.index!.getX(i+2));out.end();out.setImportedSurface(0,g);
    const geometry=out.build();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {kind:'windkeel',geometry,recipes,sockets,correctSurface:windkeelContact(geometry,parts),anchors:{dorsal:sockets.AN_SOCKET_WINDLINE_DORSAL,leftBack:sockets.AN_SOCKET_GUIDE_LEFT,leftFront:sockets.AN_SOCKET_GUIDE_LEFT},diagnostics};
  }finally{g.dispose();}
}
