import {expect,it} from 'vitest';
import {BufferAttribute,BufferGeometry,Matrix4,Mesh,Ray,SkinnedMesh,Vector3} from 'three';
import {windkeelContact} from './windkeelContact';
import {B,createRig,rigDims} from './rig';
import type {ClothRig} from './clothRig';
import type {EquipmentPart} from './importContract';

type Piece=ClothRig['pieces'][number];
function fixture(){
 const geometry=new BufferGeometry(),vertices:number[]=[],joints:number[]=[],weights:number[]=[],indices:number[]=[];
 for(let row=0;row<7;row++)for(const [dx,dz] of [[-.008,-.001],[.008,-.001],[.008,.001],[-.008,.001]]){
  vertices.push(.14+dx,1.04-.038*row,-.085+dz);joints.push(B.hips,B.thighL,0,0);weights.push(1-row/6,row/6,0,0);
 }
 for(let row=0;row<6;row++)for(let side=0;side<4;side++){
  const a=row*4+side,b=row*4+(side+1)%4,c=b+4,d=a+4;indices.push(a,b,c,a,c,d);
 }
 indices.push(0,2,1,0,3,2,24,25,26,24,26,27);
 geometry.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));
 geometry.setAttribute('skinIndex',new BufferAttribute(new Uint16Array(joints),4));
 geometry.setAttribute('skinWeight',new BufferAttribute(new Float32Array(weights),4));geometry.setIndex(indices);
 const parts:EquipmentPart[]=[{name:'Hip_1_-1_flex_link',startVertex:0,vertices:28,triangles:52,role:'leather'}];
 const rig=createRig(rigDims('medium'));rig.root.updateMatrixWorld(true);
 const mesh=new SkinnedMesh(geometry);mesh.bindMode='detached';mesh.bind(rig.skeleton,new Matrix4());
 return {geometry,rig,mesh,correct:windkeelContact(geometry,parts),dispose(){geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();rig.skeleton.dispose();}};
}
function piece(values:number[],indices:number[],pinned:Uint8Array,name='garment-travel-drape-2'):Piece {
 const geo=new BufferGeometry(),pos=new Float32Array(values);geo.setAttribute('position',new BufferAttribute(pos,3));geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=new Mesh(geo),particles=new Float64Array([.12,1.04,-.09,.14,.84,-.09]);
 return {geo,mesh,pos,surfacePinned:pinned,contactDirection:new Vector3(0,0,-1),spec:{name},cloth:{pos:particles,prev:new Float64Array(particles)}} as unknown as Piece;
}
function grid():Piece {
 const cols=7,rows=9,vertices:number[]=[],indices:number[]=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)vertices.push(.08+.12*col/(cols-1),1.09-.33*row/(rows-1),-.085);
 for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++){const a=row*cols+col,b=a+1,c=b+cols,d=a+cols;indices.push(a,b,c,a,c,d);}
 const pinned=new Uint8Array(cols*rows);pinned.fill(1,0,cols);return piece(vertices,indices,pinned);
}
const vertices=(pc:Piece)=>Array.from({length:pc.geo.attributes.position.count},(_,i)=>new Vector3().fromBufferAttribute(pc.geo.attributes.position,i).applyMatrix4(pc.mesh.matrixWorld));
/** Independent rendered triangle/triangle check, also used by the retained motion replay. */
function crossings(harness:SkinnedMesh,pc:Piece):number {
 const a=Array.from({length:harness.geometry.attributes.position.count},(_,i)=>harness.getVertexPosition(i,new Vector3()));
 const b=vertices(pc),ai=harness.geometry.index!,bi=pc.geo.index!,ray=new Ray(),hit=new Vector3(),direction=new Vector3();
 function edge(x:Vector3,y:Vector3,u:Vector3,v:Vector3,w:Vector3):boolean {
  direction.subVectors(y,x);const length=direction.length();if(length<1e-9)return false;
  ray.set(x,direction.multiplyScalar(1/length));if(!ray.intersectTriangle(u,v,w,false,hit))return false;
  const t=hit.distanceTo(x);return t>1e-5&&t<length-1e-5;
 }
 let count=0;
 for(let i=0;i<ai.count;i+=3)for(let j=0;j<bi.count;j+=3){
  const [p,q,r]=[a[ai.getX(i)],a[ai.getX(i+1)],a[ai.getX(i+2)]],[u,v,w]=[b[bi.getX(j)],b[bi.getX(j+1)],b[bi.getX(j+2)]];
  if(edge(p,q,u,v,w)||edge(q,r,u,v,w)||edge(r,p,u,v,w)||edge(u,v,p,q,r)||edge(v,w,p,q,r)||edge(w,u,p,q,r))count++;
 }
 return count;
}
function dispose(pc:Piece){pc.geo.dispose();const mat=pc.mesh.material;for(const m of Array.isArray(mat)?mat:[mat])m.dispose();}

it('lays the rendered skirt over fastened leather without moving its pins or solver state',()=>{
 const f=fixture(),pc=grid(),leather=Array.from(f.geometry.attributes.position.array),seam=Array.from(pc.pos.slice(0,7*3));
 const particles=Array.from(pc.cloth.pos),previous=Array.from(pc.cloth.prev);
 try{
  expect(crossings(f.mesh,pc)).toBeGreaterThan(0);f.correct([pc],f.rig);
  expect(crossings(f.mesh,pc)).toBe(0);expect(Array.from(f.geometry.attributes.position.array)).toEqual(leather);
  expect(Array.from(pc.pos.slice(0,7*3))).toEqual(seam);expect(Array.from(pc.cloth.pos)).toEqual(particles);expect(Array.from(pc.cloth.prev)).toEqual(previous);
  expect(f.geometry.userData.windkeelContact.remaining).toBe(0);expect(f.geometry.userData.windkeelContact.maxApplied).toBeLessThan(.012);
  expect(Array.from(pc.geo.attributes.normal.array).every(Number.isFinite)).toBe(true);expect(pc.geo.boundingBox).not.toBeNull();expect(pc.geo.boundingSphere).not.toBeNull();
 }finally{dispose(pc);f.dispose();}
});

it('clears bent hips/thigh links and face-interior folds rather than relying on vertex samples',()=>{
 const f=fixture(),pc=piece([-.1,1.18,-.093,.4,1.18,-.079,.15,.74,-.082],[0,1,2],new Uint8Array(3));
 f.rig.bones[B.thighL].rotation.x=.22;f.rig.root.updateMatrixWorld(true);
 try{
  expect(crossings(f.mesh,pc)).toBeGreaterThan(0);f.correct([pc],f.rig);
  expect(crossings(f.mesh,pc)).toBe(0);expect(f.geometry.userData.windkeelContact.remaining).toBe(0);
  expect(f.geometry.userData.windkeelContact.maxApplied).toBeLessThanOrEqual(.10);
 }finally{dispose(pc);f.dispose();}
});

it('does not accumulate contact drift or apply world translation twice',()=>{
 const f=fixture(),pc=grid(),other=grid();other.spec.name='unrelated-coat';const untouched=Array.from(other.pos);
 try{
  f.correct([pc,other],f.rig);const fitted=Array.from(pc.pos),leather=Array.from(f.geometry.attributes.position.array);
  for(let repeat=0;repeat<30;repeat++)f.correct([pc,other],f.rig);
  for(let i=0;i<fitted.length;i++)expect(pc.pos[i]).toBeCloseTo(fitted[i],6);
  expect(Array.from(other.pos)).toEqual(untouched);expect(Array.from(f.geometry.attributes.position.array)).toEqual(leather);
  const translated=grid();f.rig.root.position.add(new Vector3(120,300,-40));f.rig.root.updateMatrixWorld(true);translated.mesh.matrixWorld.makeTranslation(120,300,-40);
  try{f.correct([translated],f.rig);for(let i=0;i<fitted.length;i++)expect(translated.pos[i]).toBeCloseTo(fitted[i],5);expect(crossings(f.mesh,translated)).toBe(0);}finally{dispose(translated);}
 }finally{dispose(pc);dispose(other);f.dispose();}
});

it('reports a blocked pinned contact and keeps the hard surface correction bound',()=>{
 const f=fixture(),pc=grid(),before=Array.from(pc.pos);pc.surfacePinned.fill(1);
 try{
  f.correct([pc],f.rig);expect(Array.from(pc.pos)).toEqual(before);expect(f.geometry.userData.windkeelContact.pinned).toBeGreaterThan(0);
  pc.surfacePinned.fill(0);f.rig.root.position.z=-.3;f.rig.root.updateMatrixWorld(true);f.correct([pc],f.rig);
  expect(f.geometry.userData.windkeelContact.rejected).toBeGreaterThan(0);expect(f.geometry.userData.windkeelContact.maxApplied).toBeLessThanOrEqual(.10);
  for(let i=0;i<pc.pos.length;i+=3)expect(Math.abs(pc.pos[i+2]-before[i+2])).toBeLessThanOrEqual(.100001);
 }finally{dispose(pc);f.dispose();}
});

it('does not make a cloth fin beside an incompatible pinned waistband',()=>{
 const f=fixture(),pc=piece([.132,1.04,-.08,.148,1.04,-.08,.148,1.038,-.08,.132,1.038,-.08],[0,1,2,0,2,3],new Uint8Array([1,1,0,0]));
 const before=Array.from(pc.pos),pinDistance=Math.abs(before[1]-before[10]);
 try{
  f.correct([pc],f.rig);
  expect(Array.from(pc.pos.slice(0,6))).toEqual(before.slice(0,6));
  expect(f.geometry.userData.windkeelContact.pinned).toBeGreaterThan(0);expect(f.geometry.userData.windkeelContact.remaining).toBeGreaterThan(0);
  // The seam cannot move and the two free vertices are only2mm away. A failed rest
  // fitting must not amplify that tiny free region into the previous10cm contact fin.
  expect(f.geometry.userData.windkeelContact.maxApplied).toBeLessThanOrEqual(.65*pinDistance);
  for(const i of [2,3])expect(Math.abs(pc.pos[i*3+2]-before[i*3+2])).toBeLessThanOrEqual(.65*pinDistance+1e-7);
 }finally{dispose(pc);f.dispose();}
});
