// Bounded brown Windline fit. Fit the existing load paths to the current bind surface,
// then share the rider palette and skeleton. No per-frame fitting or gameplay authority.
import {BufferGeometry,Color,Ray,Triangle,Vector3} from 'three';
import {torsoPoint,type BodyCtx,type OutfitStyle} from './body';
import {SkinBuilder,type SkinSpec} from './meshKit';
import {tone} from './palette';
import {B} from './rig';
import type {Rig} from './rig';
import type {ClothRig} from './clothRig';

export interface HarnessAnchor {p:Vector3;skin:SkinSpec}
export interface RestingHarness {
  kind?:'brown'|'windkeel';
  geometry:BufferGeometry;
  recipes:SkinBuilder['recipes'];
  anchors:Record<'dorsal'|'leftBack'|'leftFront',HarnessAnchor>;
  diagnostics:{samples:number;misses:number;maxSurfaceOffset:number};
  sockets?:Record<string,HarnessAnchor>;
  correctSurface?:(pieces:ClothRig['pieces'],rig:Rig)=>void;
}
interface Face {a:Vector3;b:Vector3;c:Vector3;ids:number[];min:number;max:number}

export function restingHarness(ctx:BodyCtx,body:BufferGeometry,style:OutfitStyle):RestingHarness {
  const position=body.attributes.position,joints=body.attributes.skinIndex,weights=body.attributes.skinWeight,index=body.index!;
  const allowed=new Set<number>([B.hips,B.spine,B.chest,B.clavL,B.clavR]);
  const faces:Face[]=[],buckets=new Map<number,Face[]>(),h=ctx.d.h,step=.025*h;
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],ys=ids.map(id=>position.getY(id));
    const min=Math.min(...ys),max=Math.max(...ys);if(min>1.49*h||max<.99*h)continue;
    const support=ids.reduce((sum,id)=>sum+[0,1,2,3].reduce((n,k)=>n+(allowed.has(joints.getComponent(id,k))?weights.getComponent(id,k):0),0),0)/3;
    if(support<.55)continue;
    const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(position,id));
    const face={a,b,c,ids,min,max};faces.push(face);
    for(let k=Math.floor(min/step);k<=Math.floor(max/step);k++){const list=buckets.get(k)??[];list.push(face);buckets.set(k,list);}
  }
  const ray=new Ray(),triangle=new Triangle(),hit=new Vector3(),bary=new Vector3();
  const diagnostics={samples:0,misses:0,maxSurfaceOffset:0};
  const sample=(origin:Vector3,direction:Vector3,maxDistance:number,preferred?:number):HarnessAnchor&{n:Vector3}=>{
    ray.set(origin,direction);let distance=-Infinity,error=Infinity,selected:Face|undefined;const p=new Vector3();
    for(const f of Math.abs(direction.y)<.01?buckets.get(Math.floor(origin.y/step))??[]:faces){
      const contact=ray.intersectTriangle(f.a,f.b,f.c,false,hit);if(!contact)continue;
      const t=hit.clone().sub(origin).dot(direction),e=preferred===undefined?0:Math.abs(t-preferred);
      if(t>=0&&t<=maxDistance&&(preferred===undefined?t>distance:e<error)){distance=t;error=e;selected=f;p.copy(hit);}
    }
    diagnostics.samples++;
    if(!selected){diagnostics.misses++;throw Error('Brown harness fitting surface missing at '+origin.toArray());}
    triangle.set(selected.a,selected.b,selected.c);triangle.getBarycoord(p,bary);
    const w=new Map<number,number>();
    for(let j=0;j<3;j++)for(let k=0;k<4;k++){const id=selected.ids[j],bone=joints.getComponent(id,k);w.set(bone,(w.get(bone)??0)+Math.max(0,bary.getComponent(j))*weights.getComponent(id,k));}
    const skin=[...w].filter(([,v])=>v>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),total=skin.reduce((s,[,w])=>s+w,0);
    const n=triangle.getNormal(new Vector3());if(n.dot(direction)<0)n.negate();
    // The underside rests 1.5 mm above the rendered layer, with 3 mm of leather.
    p.addScaledVector(n,.0015);diagnostics.maxSurfaceOffset=Math.max(diagnostics.maxSurfaceOffset,.0015);
    return {p,n,skin:skin.flatMap(([bone,w])=>[bone,w/total])};
  };
  const radial=(y:number,x:number,z:number)=>{const origin=new Vector3(0,y,ctx.torsoAt(y).cz),direction=new Vector3(x,0,z-origin.z).normalize();return sample(origin,direction,.4);};
  const column=(y:number,x:number,front:boolean)=>sample(new Vector3(x,y,ctx.torsoAt(y).cz),new Vector3(0,0,front?1:-1),.4);
  const top=(x:number,z:number)=>sample(new Vector3(x,1.32*h,z),new Vector3(0,1,0),.17*h);
  const b=new SkinBuilder(true),anchors={} as RestingHarness['anchors'];
  const strips:{start:number;end:number;points:ReturnType<typeof radial>[];slack:number[]}[]=[];
  b.surface('leather',()=>{
    for(const sign of [1,-1]){
      const points:ReturnType<typeof radial>[]=[],slack:number[]=[];
      // Fasten at the belt, shoulder and dorsal ring. A shallow gravity curve between
      // those contacts lets leather hang naturally without puffing it off the rider.
      // Leather remains rig-supported; this is authored fitting, not another cloth solver.
      for(let i=0;i<=38;i++){const t=i/38,s=Math.sin(Math.PI*t);points.push(column((1.02+.377*t)*h-.004*s,sign*(.115-.01*t)*ctx.d.w,true));slack.push(.0012*s);}
      for(let i=0;i<=16;i++){points.push(top(sign*.105*ctx.d.w,(.075-.155*i/16)*ctx.d.g));slack.push(0);}
      const ringT=(1.397-1.195)/.377;
      for(let i=0;i<=38;i++){
        const t=i/38,u=t<ringT?t/ringT:(t-ringT)/(1-ringT),s=Math.sin(Math.PI*u);
        points.push(column((1.397-.377*t)*h-(t<ringT?.006:.004)*s,sign*(.105-.22*t)*ctx.d.w,false));slack.push(.0012*s);
      }
      if(sign===1){anchors.leftFront=points[38];anchors.leftBack=points[55];}
      const start=b.vertexCount;b.loft(points.map((point,i)=>{
        const tangent=points[Math.min(points.length-1,i+1)].p.clone().sub(points[Math.max(0,i-1)].p).normalize();
        const normal=point.n.clone().addScaledVector(tangent,-point.n.dot(tangent)).normalize();
        return {c:point.p.clone().addScaledVector(normal,.0015+slack[i]),ax:normal,ay:new Vector3().crossVectors(tangent,normal).normalize(),rx:.0015,ry:.014,
          exp:4,skin:point.skin,color:tone(ctx.pal.gearLeather,.88+.025*Math.sin(i*.61))};
      }),8,{capStart:true,capEnd:true,capBulge:0});
      strips.push({start,end:b.vertexCount,points,slack});
    }
  });
  // The same restrained bronze dorsal ring now sits on the back instead of a fixed box frame.
  // The rigid ring rests on the selected top, below existing back-mounted map cases.
  // A raised case face is not a body support plane for this fitting.
  const y=1.195*h,origin=new Vector3(0,y,ctx.torsoAt(y).cz),back=new Vector3(0,0,-1);
  const support=torsoPoint(ctx,y,-Math.PI/2,style.torso.inflate(y,-Math.PI/2),new Vector3());
  const dorsal=sample(origin,back,.4,support.distanceTo(origin));anchors.dorsal={p:dorsal.p.clone().addScaledVector(dorsal.n,.003),skin:[B.chest,1]};
  b.surface('bronze',()=>{
    const normal=dorsal.n,side=new Vector3(1,0,0),up=new Vector3().crossVectors(normal,side).normalize();
    b.loft(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2,across=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,Math.sin(a));
      return {c:anchors.dorsal.p.clone().addScaledVector(across,.03),ax:across,ay:normal,rx:.004,ry:.004,skin:anchors.dorsal.skin,color:ctx.pal.brass as Color};
    }),6);
  });
  const geometry=b.build(),p=geometry.attributes.position,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight;
  try{
    // Fit both strap edges too. A flat cross-section can bridge a folded collar even when
    // its centreline is seated. Rebind each final vertex after this surface correction.
    for(const strip of strips)for(let i=strip.start;i<strip.end;i++){
      const offset=i-strip.start,row=offset<strip.points.length*9?Math.floor(offset/9):offset===strip.points.length*9?0:strip.points.length-1;
      const source=strip.points[row],point=new Vector3().fromBufferAttribute(p,i),depth=Math.max(0,Math.min(.003,point.clone().sub(source.p).dot(source.n)-strip.slack[row]))+strip.slack[row];
      const fit=row>=39&&row<56?top(point.x,point.z):column(point.y,point.x,row<39);
      point.copy(fit.p).addScaledVector(fit.n,depth);p.setXYZ(i,point.x,point.y,point.z);
      for(let k=0;k<4;k++){si.setComponent(i,k,fit.skin[k*2]??0);sw.setComponent(i,k,fit.skin[k*2+1]??0);}
      diagnostics.maxSurfaceOffset=Math.max(diagnostics.maxSurfaceOffset,.0015+depth);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {geometry,recipes:b.recipes,anchors,diagnostics};
  }catch(error){geometry.dispose();throw error;}
}
