// Measured bind construction and settled, actual Stable-camera comparisons.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const output='shots/rider-blender/construction';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),captures=[];
await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
const constructionOnly=process.argv.includes('--construction-only');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={purpose:'Construction and corrected Stable framing; not finished-rider QA',captures,errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function boot(query){await page.goto('http://127.0.0.1:5210/?manual=1&quality=low&weather=clear&tod=.42&'+query,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});if(query.includes('riderTrial'))await page.waitForFunction(()=>window.__dw.game.rider.trialState.status==='ready');}
async function capture(name){await page.evaluate(()=>{window.__dw.advance(1.5);window.__dw.render();});const file=output+'/'+name+'.png';await page.screenshot({path:file});captures.push({name,url:page.url(),sha256:hash(await fs.readFile(file))});}
try{
 let bind;
 if(constructionOnly){bind=JSON.parse(await fs.readFile('assets/rider-blender/source/BIND_MESH_REFERENCE.json','utf8'));captures.push(...JSON.parse(await fs.readFile(output+'/report.json','utf8')).captures);}
 else{
 for(const variant of ['current','proof']){
   await boot(variant==='proof'?'riderTrial=compatibility':'');
   await page.evaluate(async()=>{const {DEFAULT_RIDER}=await import('/src/cosmetics/catalog.ts'),{withGarment}=await import('/src/cosmetics/wardrobe.ts'),g=window.__dw.game;
     g.setRiderLook(withGarment(withGarment({...DEFAULT_RIDER,headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'},'trousers','travel-drape-trousers'),'footwear','scout-footwear'));g.openStable();g.frame(0,true);});
   await page.locator('.dw-tab').filter({hasText:/^Outfit Pieces$/}).click();await capture('stable-mixed-'+variant);
   const frame=await page.evaluate(async()=>{const {Vector3}=await import('/node_modules/three/build/three.module.js'),g=window.__dw.game,r=g.rider,p=r.model.rig.bones.find(b=>b.name==='head').getWorldPosition(new Vector3()).project(g.camera);return {headNdc:p.toArray(),regions:r.model.importedRegions,screen:g.screen};});
   captures.at(-1).framing=frame;if(Math.abs(frame.headNdc[0])>1||Math.abs(frame.headNdc[1])>1||frame.screen!=='stable')throw Error('Stable rider was not framed');
   await page.evaluate(()=>{const g=window.__dw.game;g.setRiderLook({...g.rider.look,outfit:'travel-drape',wardrobe:undefined});});await capture('stable-travel-pale-'+variant);
 }
 await boot('view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&dist=2.7&height=.95');
 bind=await page.evaluate(async()=>{
   const {buildRiderModel}=await import('/src/creatures/rider/model.ts'),{riderClothSpecs}=await import('/src/creatures/rider/wardrobeModel.ts'),{ClothRig}=await import('/src/creatures/rider/clothRig.ts'),{Group,Vector3}=await import('/node_modules/three/build/three.module.js');
   const m=buildRiderModel(window.__riderShow.actors[0].rider.look),parent=new Group();m.rig.root.updateMatrixWorld(true);
   const rig=new ClothRig(riderClothSpecs(m.ctx,m.proof),m.rig.bindPos,parent,{}, {detail:.35,shadows:false,proofMaps:'color'});rig.reset(m.rig.bones,m.rig.bindPos,new Vector3());rig.update(0,m.rig.bones,new Vector3(),new Vector3(),new Vector3(),0);
   const mesh=g=>({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array),colors:g.attributes.color?Array.from(g.attributes.color.array):undefined});
   const result={units:'meters',axes:'X-left/Y-up/Z-forward',space:'final mesh bind space; no animated deformation',sourceHead:'8e055069703c83308d5508ee72e5ad1d15ef348e',look:m.ctx.look,body:mesh(m.geometry),cloth:rig.pieces.map(p=>({name:p.spec.name,...mesh(p.geo),color:p.spec.render.color.toArray()})),bones:m.rig.bones.map((b,i)=>({name:b.name,parent:b.parent?.name??null,bind:m.rig.bindPos[i].toArray()}))};
   rig.dispose();m.geometry.dispose();m.rig.skeleton.dispose();return result;
 });
 await fs.writeFile('assets/rider-blender/source/BIND_MESH_REFERENCE.json',JSON.stringify(bind));
 }
 const bindFile='assets/rider-blender/source/BIND_MESH_REFERENCE.json',json=await fs.readFile(bindFile);
 const scale=360,ground=760,columns=[{name:'Front (+Z camera)',x:230,axes:[0,1,2],sign:1},{name:'Left side (+X camera)',x:625,axes:[2,1,0],sign:-1},{name:'Back (−Z camera)',x:1015,axes:[0,1,2],sign:-1}];
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 880"><rect width="1240" height="880" fill="#f2eada"/><style>text{font-family:Arial,sans-serif;fill:#263b4a} .dim{stroke:#a46e2f;stroke-width:1;fill:none}</style><text x="30" y="36" font-size="22">Driftwing · medium rider · measured bind construction</text><text x="30" y="61" font-size="13">Current generated source, metre scale. Orthographic projection; not new design approval or a Blender render.</text>';
 for(const view of columns){
   const project=p=>[view.x+view.sign*p[view.axes[0]]*scale,ground-p[1]*scale];
   const faces=[];for(const part of [bind.body,...bind.cloth])for(let t=0;t<part.indices.length;t+=3){const ids=part.indices.slice(t,t+3),points=ids.map(i=>part.positions.slice(i*3,i*3+3)),center=points.reduce((n,p)=>n+p[view.axes[2]],0)/3,
     colors=part.colors?ids.map(i=>part.colors.slice(i*3,i*3+3)).reduce((a,c)=>a.map((v,k)=>v+c[k]/3),[0,0,0]):part.color??[.8,.8,.8],rgb=colors.map(v=>Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)));
     faces.push({depth:center*(view.name.startsWith('Back')?-1:1),points:points.map(p=>project(p).map(v=>v.toFixed(2)).join(',')).join(' '),color:'rgb('+rgb.join(',')+')'});
   }
   faces.sort((a,b)=>a.depth-b.depth);svg+='<text x="'+(view.x-140)+'" y="110" font-size="16">'+view.name+'</text>';
   // Rasterize the dense reference projection; dimensions, skeleton and annotations stay editable vectors.
   // The full editable geometry is the adjacent JSON. Thousands of individual SVG polygons
   // made the first reference sheet needlessly expensive for Windows' software renderer.
   const bitmap=await page.evaluate(faces=>{const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=880;const ctx=canvas.getContext('2d');for(const f of faces){const p=f.points.split(' ').map(s=>s.split(',').map(Number));ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.fill();}return canvas.toDataURL('image/png');},faces);
   svg+='<image width="1240" height="880" href="'+bitmap+'"/>';
   for(const bone of bind.bones){const p=project(bone.bind),parent=bind.bones.find(b=>b.name===bone.parent);if(parent){const q=project(parent.bind);svg+='<path class="dim" d="M'+q.join(' ')+' L'+p.join(' ')+'"/>';}svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2" fill="#c8843a"/>';}
   for(const [height,label] of [[.075,'ankle 0.075 m'],[.96,'hips 0.960 m'],[1.23,'chest 1.230 m']]){const y=ground-height*scale;svg+='<path class="dim" d="M'+(view.x-130)+' '+y+' h260" stroke-dasharray="3 5"/><text x="'+(view.x-137)+'" y="'+(y-5)+'" font-size="10">'+label+'</text>';}
   svg+='<path class="dim" d="M'+(view.x-150)+' '+ground+' h300"/><text x="'+(view.x-140)+'" y="800" font-size="12">27 original joints · pelvis/ankle fitting boundaries</text>';
 }
 svg+='<text x="30" y="847" font-size="12">Bind mesh and full joint coordinates: BIND_MESH_REFERENCE.json + CONSTRUCTION.json. Cloth contacts and ponytail envelope remain runtime tests.</text></svg>';
 const svgFile='assets/rider-blender/source/MEASURED_CONSTRUCTION.svg';await fs.writeFile(svgFile,svg);
 report.sources=[{path:bindFile,sha256:hash(Buffer.from(json)),bytes:Buffer.byteLength(json)},{path:svgFile,sha256:hash(Buffer.from(svg)),bytes:Buffer.byteLength(svg)}];
 await page.setViewportSize({width:1240,height:880});
 await page.goto('http://127.0.0.1:5210/'+svgFile);
 report.svgViewport=await page.evaluate(()=>({root:document.documentElement.tagName,width:document.documentElement.getBoundingClientRect().width,height:document.documentElement.getBoundingClientRect().height,images:document.querySelectorAll('image').length}));
 await page.screenshot({path:output+'/measured-construction.png',fullPage:false});
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}
finally{await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
