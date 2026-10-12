// Trial-only construction cage. The original front/back drape left the deltoid uncovered.
// One continuous, closed shoulder wrap replaces those separate cloth sheets for this provider.
import {Color,Vector3} from 'three';
import type {BodyCtx} from './body';
import {torsoPoint,torsoSkin} from './body';
import {B} from './rig';
import {SkinBuilder,sk,type SkinSpec} from './meshKit';
import {stud} from './garments';
import {tone,withRecipe} from './palette';
import type {RiderProof} from './proof';
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Parameter-space winding stays fixed when a thicker legacy top changes the fit.
// Geometry-dependent edge winding would invalidate otherwise identical authored bindings.
function constructionSheet(b:SkinBuilder,cols:number,rows:number,at:(u:number,v:number,p:Vector3,n:Vector3)=>void,thickness:number,skin:(u:number,v:number)=>SkinSpec,color:(u:number,v:number,inner:boolean)=>Color):void {
  b.begin();const start=b.vertexCount,w=cols+1,count=w*(rows+1),p=new Vector3(),n=new Vector3();
  for(const inner of [false,true])for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows;at(u,v,p,n);if(inner)p.addScaledVector(n,-thickness);b.vertex(p,color(u,v,inner),skin(u,v),0,[u,v]);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=start+j*w+i,c=a+w+1,d=a+w; b.tri(a,a+1,c);b.tri(a,c,d);
    b.tri(a+count,c+count,a+1+count);b.tri(a+count,d+count,c+count);
  }
  const edge=(a:number,c:number)=>{a+=start;c+=start;b.tri(c,a,a+count);b.tri(c,a+count,c+count);};
  for(let i=0;i<cols;i++){edge(i,i+1);edge(rows*w+i+1,rows*w+i);}
  for(let j=0;j<rows;j++){edge((j+1)*w,j*w);edge(j*w+cols,(j+1)*w+cols);}
  b.end();
}
export function shoulderFittingCage(ctx:BodyCtx,cut:RiderProof,legacy:(ctx:BodyCtx)=>void):void {
  const {b,d,pal}=ctx,h=d.h;
  const at=(u:number,v:number,out:Vector3,n?:Vector3)=>{
    const th=u*Math.PI*2,front=Math.sin(th)>=0,fu=Math.max(0,Math.min(1,(th-.15)/2.8));
    const top=front?1.44-.035*Math.sin(fu*Math.PI):1.44;
    const frontHem=1.40-.19*fu-.035*Math.sin(fu*Math.PI);
    const left=Math.pow(Math.max(0,Math.cos(th)),4),right=Math.pow(Math.max(0,-Math.cos(th)),4),side=left+right;
    const rearHem=cut==='aerie'?1.16:1.23;
    const lower=(front?frontHem:rearHem)*(1-side)+1.27*left+1.32*right;
    const y=(top+(lower-top)*v)*h;
    const fold=.005*Math.sin(v*Math.PI)*Math.cos(v*Math.PI*5+th*.85);
    // The front rests over the scale layer; the back rests over the linen underlayer.
    torsoPoint(ctx,y,th,(front?.052:.014)+fold,out,n);
    // Rest on the actual shoulder bridge, not an inflated torso/pauldron shell.
    // Match its quadratic deltoid arc, then let the left hem fall down the upper arm.
    const sign=Math.cos(th)>=0?1:-1,S=sign===1?ctx.bp.upperArmL:ctx.bp.upperArmR;
    const capT=Math.min(1,v/(sign===1?.72:1)),start=torsoPoint(ctx,1.44*h,th,.018,new Vector3());
    const r=ctx.armAt(.08*h),end=new Vector3(S.x+Math.cos(th)*(r.rx+.009),S.y-.08*h,S.z+Math.sin(th)*(r.rz+.009));
    const control=start.clone().lerp(end,.5);control.x+=(end.x-start.x)*.5;control.y+=(start.y-end.y)*.5;
    const cap=start.clone().multiplyScalar((1-capT)**2).addScaledVector(control,2*capT*(1-capT)).addScaledVector(end,capT*capT);
    if(sign===1&&v>.72)cap.y-=(v-.72)/.28*.05*h;
    out.lerp(cap,side);
    if(n)n.lerp(new Vector3(sign*capT,.65*(1-capT),Math.sin(th)).normalize(),side).normalize();
    return out;
  };
  const skin=(u:number,v:number)=>{
    const p=at(u,v,new Vector3()),base=torsoSkin(ctx,p.y,p),side=Math.pow(Math.abs(Math.cos(u*Math.PI*2)),4),t=Math.min(1,v/(p.x>=0?.72:1)),arm=side*smooth(0,1,t)*.96;
    const bone=p.x>=0?B.upperArmL:B.upperArmR,weights=new Map<number,number>();for(let i=0;i<base.length;i+=2)weights.set(base[i],base[i+1]*(1-arm));weights.set(bone,(weights.get(bone)??0)+arm);
    return [...weights].sort((a,b)=>b[1]-a[1]).slice(0,4).flat();
  };
  b.surface('linen',()=>constructionSheet(b,48,16,(u,v,p,n)=>{at(u,v,p,n);},.002,skin,(u,v,inner)=>tone(pal.primary,(inner?.84:1)*(1-.025*Math.sin(v*Math.PI*2+u*Math.PI)**4))));
  // A narrow, worn leather keeper crosses the short right cap and secures its ends.
  // It shares the cloth fit/weights, so it cannot float off during raised-arm poses.
  const keeper=(u:number,v:number)=>{const th=2.45+u*1.38;return [th/(Math.PI*2),.07+.76*Math.pow(Math.abs(th-Math.PI)/.69,1.4)+(v-.5)*.065] as const;};
  b.surface('leather',()=>constructionSheet(b,24,2,(u,v,p,n)=>{const [a,c]=keeper(u,v);at(a,c,p,n);p.addScaledVector(n,.0025);},.0015,(u,v)=>{const [a,c]=keeper(u,v);return skin(a,c);},(u,v,inner)=>tone(pal.leather,inner?.72:.88+.07*Math.cos(u*Math.PI*8))));
  b.surface('bronze',()=>{for(const u of [.06,.94]){const [a,c]=keeper(u,.5),p=new Vector3(),n=new Vector3();at(a,c,p,n);p.addScaledVector(n,.004);stud(ctx,p,n,.0045,pal.brass,skin(a,c),.35);}});
  // Keep the approved spiral brooch and its chest attachment; omit the disconnected sheets.
  const original=new SkinBuilder(true);legacy({...ctx,b:original});const g=original.build(),a=g.attributes,map=new Map<number,number>();
  const oldBrooch=torsoPoint(ctx,1.405*h,.62,.1,new Vector3()),broochShift=at(.62/(Math.PI*2),.28,new Vector3()).add(new Vector3(.55,.15,.82).normalize().multiplyScalar(.005)).sub(oldBrooch);
  try{b.surface('bronze',()=>{b.begin();
    for(let i=0;i<a.position.count;i++)if(a.c02Surface.getX(i)===4){
      const color=withRecipe(new Color().fromBufferAttribute(a.color,i),original.recipes[i]??undefined),skin:number[]=[];
      for(let j=0;j<4;j++)if(a.skinWeight.getComponent(i,j)>0)skin.push(a.skinIndex.getComponent(i,j),a.skinWeight.getComponent(i,j));
      map.set(i,b.vertex(new Vector3().fromBufferAttribute(a.position,i).add(broochShift),color,skin,a.glow.getX(i)));
    }
    for(let i=0;i<g.index!.count;i+=3){const ids=[0,1,2].map(j=>map.get(g.index!.getX(i+j)));if(ids.every(v=>v!==undefined))b.tri(ids[0]!,ids[1]!,ids[2]!);}
    b.end();});
  }finally{g.dispose();}
}

/** Same mixable Travel arm-wrap region, interpreted as the concept's thin worn bracers. */
export function travelBracerFittingCage(ctx:BodyCtx):void {
  const {b,d,bp,pal}=ctx;
  b.surface('leather',()=>{for(const side of [1,-1] as const){
    const suffix=side===1?'L':'R',joint=bp[`upperArm${suffix}`];
    b.loft([.345,.35,.38,.43,.485,.49].map((t,i)=>{const s=t*d.h,r=ctx.armAt(s),edge=i===0||i===5;
      return {c:new Vector3(joint.x,joint.y-s,joint.z),ax:new Vector3(1,0,0),ay:new Vector3(0,0,1),rx:r.rx+(edge?.007:.009),ry:r.rz+(edge?.007:.009),skin:sk(B[`foreArm${suffix}`]),color:tone(pal.gearLeather,edge?.72:.91+.035*Math.sin(i*2))};
    }),20);
  }});
}
