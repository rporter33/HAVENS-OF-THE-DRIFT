// One dressed-leg envelope for trousers, boot cuffs, stripes and wraps.
import {Vector3} from 'three';
import {legSkin, type BodyCtx, type OutfitStyle, type Side} from './body';
import {B} from './rig';
import type {SkinSpec} from './meshKit';
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function legSection(ctx:BodyCtx,s:number,side:Side,style=ctx.legStyle){
  const {d,bp}=ctx,J=side===1?bp.thighL:bp.thighR,L=d.thigh+d.shin;
  const foot=side===1?B.footL:B.footR,ankle=smooth(L-.045*d.h,L+.015*d.h,s);
  const r=ctx.legAt(s),h=.006*d.h;
  const inf=style? (style.inflate(s-h)+2*style.inflate(s)+style.inflate(s+h))/4:0;
  const end=style?.clothEnd??style?.gatherHem??style?.bootStart??Infinity;
  const cloth=s<end,hemFade=Number.isFinite(end)?1-smooth(end-.035*d.h,end,s):1;
  const fade=smooth(-.04*d.h,.08*d.h,s)*hemFade;
  const fold=cloth ? .022*fade+.016*Math.exp(-(((s-d.thigh)/(.07*d.h))**2)) : 0;
  const weights=new Map<number,number>();
  const original=legSkin(d,s,side);
  for(let i=0;i<original.length;i+=2)weights.set(original[i],original[i+1]*(1-ankle));
  weights.set(foot,(weights.get(foot)??0)+ankle);
  const skin:SkinSpec=[...weights].filter(([,w])=>w>0).flat();
  return {c:new Vector3(J.x-side*.006*smooth(0,d.thigh,s)*(1-ankle),J.y-s,
    J.z+.004*Math.sin(Math.min(1,Math.max(0,s/d.thigh))*Math.PI)),
    rx:r.rx*(1-.08*ankle)+inf,rf:r.rf*(1-.1*ankle)+inf,rb:r.rb*(1-.1*ankle)+inf,
    radial:(th:number)=>1+fold*Math.cos(th*6+s/d.h*28),skin,cloth};
}
export function legPoint(ctx:BodyCtx,s:number,th:number,side:Side,lift=0){
  const r=legSection(ctx,s,side),m=r.radial(th),n=new Vector3(Math.cos(th),0,Math.sin(th));
  const p=r.c.clone().add(new Vector3(n.x*(r.rx*m+lift),0,n.z*((n.z<0?r.rb:r.rf)*m+lift)));
  return {p,n,skin:r.skin};
}
