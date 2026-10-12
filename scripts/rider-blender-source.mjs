// Extract named fitting cages from the live baseline builders, not illustrated measurements.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5210/?manual=1&quality=low');
 await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
 const source=await page.evaluate(async()=>{
  const {SkinBuilder}=await import('/src/creatures/rider/meshKit.ts'),{makeBodyCtx}=await import('/src/creatures/rider/body.ts'),{createRig,rigDims}=await import('/src/creatures/rider/rig.ts');
  const {sculptProofProfiles,softUpperBody,softHand,softLeg,softFoot}=await import('/src/creatures/rider/softBody.ts'),{proofStyle,proofHeadShape,proofFace,C02_LOOK}=await import('/src/creatures/rider/proof.ts');
  const {riderPalette,outfitMaterialPalette}=await import('/src/creatures/rider/palette.ts'),{buildHair}=await import('/src/creatures/rider/hair.ts'),{riderClothSpecs}=await import('/src/creatures/rider/wardrobeModel.ts'),{compatibilityClothSurface}=await import('/src/creatures/rider/clothBinding.ts'),{TRAVEL_PIECES}=await import('/src/cosmetics/wardrobe.ts');
  const {shoulderFittingCage,travelBracerFittingCage}=await import('/src/creatures/rider/authoredConstruction.ts');
  const parts=[],rigs=[];
  function record(id,ctx,draw,method='delta'){
   const b=new SkinBuilder(true),c={...ctx,b,garmentCloth:[]};draw(c);const g=b.build();
   if(!g.index.count){g.dispose();return;}
   const recipes=[],ids=[],known=new Map();for(let i=0;i<b.recipes.length;i++){
    const r=b.recipes[i]??{k:'const',r:g.attributes.color.getX(i),g:g.attributes.color.getY(i),b:g.attributes.color.getZ(i)},key=JSON.stringify(r);
    if(!known.has(key)){known.set(key,recipes.length);recipes.push(r);}ids.push(known.get(key));
   }
   parts.push({id,build:ctx.d.build,method,recipes,recipeIds:ids,attributes:Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,{size:a.itemSize,values:Array.from(a.array)}])),indices:Array.from(g.index.array)});g.dispose();
  }
  for(const build of ['slight','medium','broad']){
   const d=rigDims(build),rig=createRig(d),look={...C02_LOOK,...TRAVEL_PIECES,outfit:'travel-drape',build},pal=outfitMaterialPalette(riderPalette(look),'travel-drape');
   const ctx=makeBodyCtx(new SkinBuilder(true),d,look,pal,proofHeadShape);sculptProofProfiles(ctx);
   rigs.push({build,dims:{...d,head:d.head.toArray()},bones:rig.bones.map((b,i)=>({name:b.name,parent:b.parent?.name??null,bind:rig.bindPos[i].toArray()}))});
   const style=proofStyle(ctx,'aerie');ctx.legStyle=style.leg;
   if(build==='medium'){
    record('upper',ctx,c=>softUpperBody(c,style));record('head',ctx,proofFace,'direct');
    record('ponytail-crown',ctx,c=>buildHair(c,look,false,true),'bound');
    for(const side of [1,-1]){const s=side===1?'L':'R';record('hand'+s,ctx,c=>softHand(c,style,side),'direct');record('leg'+s,ctx,c=>softLeg(c,style,side));record('foot'+s,ctx,c=>softFoot(c,style,side));record('barefoot'+s,ctx,c=>softFoot(c,style,side),'direct');}
   }
   for(const cut of ['aerie','wanderer']){
    const st=proofStyle(ctx,cut);ctx.legStyle=st.leg;
    for(const slot of ['top','chest','shoulderDrape','waist','armWraps','legWraps','footwear'])record('piece:'+slot+':'+cut,ctx,c=>slot==='shoulderDrape'?shoulderFittingCage(c,cut,x=>st.extras(x,slot)):slot==='armWraps'?travelBracerFittingCage(c):st.extras(c,slot),'bound');
    const bc={...ctx,b:new SkinBuilder(true),garmentCloth:[]};st.extras(bc,'top');
    for(const spec of riderClothSpecs(bc,cut))if(spec.guideSkin&&spec.render.kind==='sheet'&&spec.name.startsWith('garment-travel-drape-')){
     const binding=compatibilityClothSurface(spec,13,11),surf=binding.surface;
     parts.push({id:'cloth:'+spec.name+':'+cut,build,method:'cloth',cols:surf.cols,rows:surf.rows,control:{cols:spec.cols,rows:spec.rows,rest:spec.rest.map(p=>p.toArray()),anchorBone:spec.anchorBone,guideSkin:spec.guideSkin},positions:Array.from(surf.positions),pinned:Array.from(binding.pinned)});
    }
   }
   rig.skeleton.dispose();
  }
  return {contract:1,sourceHead:'8e055069703c83308d5508ee72e5ad1d15ef348e',axes:'X-left/Y-up/Z-forward',units:'meters',rigs,parts};
 });
 const output='assets/rider-blender/source/FITTING_CAGES.json';await fs.mkdir('assets/rider-blender/source',{recursive:true});const data=JSON.stringify(source);await fs.writeFile(output,data);
 console.log(JSON.stringify({file:output,parts:source.parts.length,bytes:Buffer.byteLength(data),sha256:crypto.createHash('sha256').update(data).digest('hex')}));
}finally{await browser.close();}
