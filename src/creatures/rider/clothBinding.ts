// Development proof: a detailed regular sheet driven by the existing coarse cloth.
// Bind in rest space after final topology. Draw in the solver frame, never skin it again.
import {Vector3} from 'three';
import type {ClothSpec} from './accessories';

export interface ClothSurface {
  cols:number;
  rows:number;
  positions:Float32Array;
}
export interface ClothSurfaceBinding {
  surface:ClothSurface;
  controlSignature:string;
  surfaceSignature:string;
  particles:Uint32Array;
  weights:Float64Array;
  offsets:Float64Array;
  pinned:Uint8Array;
  restFrames:Float64Array;
}
function signature(values:Iterable<number>):string {
  let hash=2166136261;
  for(const v of values){if(!Number.isFinite(v))throw Error('Cloth binding: nonfinite source');
    const n=Math.round(v*1e6);hash=Math.imul(hash^(n|0),16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
function controlSignature(spec:ClothSpec):string {
  return signature([spec.cols,spec.rows,...spec.rest.flatMap(p=>p.toArray()),...spec.anchorBone,
    ...(spec.guideSkin??[]).flatMap(s=>[s.length,...s])]);
}
function surfaceSignature(s:ClothSurface):string{return signature([s.cols,s.rows,...s.positions]);}
const a=new Vector3(),b=new Vector3(),c=new Vector3(),u=new Vector3(),v=new Vector3(),n=new Vector3(),d=new Vector3();
function frame(ax:number,ay:number,az:number,bx:number,by:number,bz:number,cx:number,cy:number,cz:number):boolean {
  u.set(bx-ax,by-ay,bz-az);v.set(cx-ax,cy-ay,cz-az);n.crossVectors(u,v);
  if(u.lengthSq()<1e-16||n.lengthSq()<1e-16)return false;
  u.normalize();n.normalize();v.crossVectors(n,u);return true;
}

export function bindClothSurface(spec:ClothSpec,surface:ClothSurface):ClothSurfaceBinding {
  if(spec.render.kind!=='sheet'||spec.cols<3||spec.rows<2||!spec.guideSkin||spec.config.sewEdges)
    throw Error('Cloth binding: proof requires an open guided sheet');
  if(!Number.isInteger(surface.cols)||!Number.isInteger(surface.rows)||surface.cols<2||surface.rows<2||
    surface.positions.length!==surface.cols*surface.rows*3)throw Error('Cloth binding: invalid detailed grid');
  const count=surface.cols*surface.rows,particles=new Uint32Array(count*3),weights=new Float64Array(count*3),
    offsets=new Float64Array(count*3),pinned=new Uint8Array(count),restFrames=new Float64Array(count*9);
  for(let j=0;j<surface.rows;j++)for(let i=0;i<surface.cols;i++){
    const k=j*surface.cols+i,q=k*3,x=i/(surface.cols-1)*(spec.cols-1),y=j/(surface.rows-1)*(spec.rows-1),
      col=Math.min(spec.cols-2,Math.floor(x)),row=Math.min(spec.rows-2,Math.floor(y)),fx=x-col,fy=y-row,
      p=row*spec.cols+col,tri=fx+fy<=1?[p,p+1,p+spec.cols]:[p+1,p+spec.cols+1,p+spec.cols],
      w=fx+fy<=1?[1-fx-fy,fx,fy]:[1-fy,fx+fy-1,1-fx];
    particles.set(tri,q);weights.set(w,q);
    a.copy(spec.rest[tri[0]]);b.copy(spec.rest[tri[1]]);c.copy(spec.rest[tri[2]]);
    if(!frame(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z))throw Error('Cloth binding: degenerate rest triangle');
    d.fromArray(surface.positions,q).addScaledVector(a,-w[0]).addScaledVector(b,-w[1]).addScaledVector(c,-w[2]);
    if(d.length()>.015)throw Error('Cloth binding: proof offset exceeds 15 mm');
    offsets.set([d.dot(u),d.dot(v),d.dot(n)],q);
    restFrames.set([...u.toArray(),...v.toArray(),...n.toArray()],k*9);
    pinned[k]=tri.every((p,t)=>w[t]<1e-9||spec.anchorBone[p]>=0)?1:0;
    if(pinned[k]&&d.length()>1e-6)throw Error('Cloth binding: authored seam must match its pinned controls');
  }
  return {surface,particles,weights,offsets,pinned,restFrames,controlSignature:controlSignature(spec),surfaceSignature:surfaceSignature(surface)};
}

/** Run at asset attachment/export validation, not every frame. */
export function validateClothBinding(binding:ClothSurfaceBinding,spec:ClothSpec):void {
  if(binding.controlSignature!==controlSignature(spec)||binding.surfaceSignature!==surfaceSignature(binding.surface))
    throw Error('Cloth binding: stale topology or fitting source; regenerate the binding');
}

export function deformClothSurface(binding:ClothSurfaceBinding,controls:ArrayLike<number>,out:Float32Array):void {
  if(out.length!==binding.surface.positions.length)throw Error('Cloth binding: output topology mismatch');
  for(let k=0;k<out.length/3;k++){
    const q=k*3,ia=binding.particles[q]*3,ib=binding.particles[q+1]*3,ic=binding.particles[q+2]*3,
      wa=binding.weights[q],wb=binding.weights[q+1],wc=binding.weights[q+2];
    if(!frame(controls[ia],controls[ia+1],controls[ia+2],controls[ib],controls[ib+1],controls[ib+2],controls[ic],controls[ic+1],controls[ic+2])){
      u.fromArray(binding.restFrames,k*9);v.fromArray(binding.restFrames,k*9+3);n.fromArray(binding.restFrames,k*9+6);
    }
    for(let t=0;t<3;t++)out[q+t]=controls[ia+t]*wa+controls[ib+t]*wb+controls[ic+t]*wc+
      u.getComponent(t)*binding.offsets[q]+v.getComponent(t)*binding.offsets[q+1]+n.getComponent(t)*binding.offsets[q+2];
  }
}

/** Integration fixture only. These small offsets are not a finished authored garment. */
export function compatibilityClothSurface(spec:ClothSpec,cols=25,rows=21):ClothSurfaceBinding {
  const positions=new Float32Array(cols*rows*3);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=i/(cols-1)*(spec.cols-1),y=j/(rows-1)*(spec.rows-1),
      col=Math.min(spec.cols-2,Math.floor(x)),row=Math.min(spec.rows-2,Math.floor(y)),fx=x-col,fy=y-row,p=row*spec.cols+col,
      tri=fx+fy<=1?[p,p+1,p+spec.cols]:[p+1,p+spec.cols+1,p+spec.cols],w=fx+fy<=1?[1-fx-fy,fx,fy]:[1-fy,fx+fy-1,1-fx];
    a.copy(spec.rest[tri[0]]);b.copy(spec.rest[tri[1]]);c.copy(spec.rest[tri[2]]);
    frame(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    const offset=.0035*Math.sin(i/(cols-1)*Math.PI*8)*Math.sin(j/(rows-1)*Math.PI);
    d.set(0,0,0).addScaledVector(a,w[0]).addScaledVector(b,w[1]).addScaledVector(c,w[2]).addScaledVector(n,offset);
    d.toArray(positions,(j*cols+i)*3);
  }
  return bindClothSurface(spec,{cols,rows,positions});
}
