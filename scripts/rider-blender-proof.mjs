// Checkpoint 2 only: actual engine import/cloth adapter proof, not finished-rider QA.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const origin=process.argv[2]??'http://127.0.0.1:5210';
const output=path.resolve('shots/rider-blender/proof');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
const report={scope:'Compatibility checkpoint only; generated fixture, no authored visual improvement',renderer:'Edge SwiftShader; no hardware certification',origin,profile:'fresh nonpersistent context',checks:[],captures:[],errors:[],measurements:[]};
let phase='boot';page.on('pageerror',e=>report.errors.push({phase,error:String(e)}));
page.on('console',m=>{if(m.type()==='error')report.errors.push({phase,error:m.text()});});
const check=(name,pass,detail)=>{report.checks.push({name,passed:!!pass,detail});if(!pass){report.failure=(report.failure??'')+'Failed check: '+name+'; ';process.exitCode=1;}console.log((pass?'PASS ':'FAIL ')+name);};
async function boot(query=''){
 await page.goto(origin+'/?manual=1&quality=low&weather=clear&tod=.42&'+query,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
 if(query.includes('riderTrial='))await page.waitForFunction(()=>{const r=window.__riderShow?.actors?.[0]?.rider??window.__dw.game.rider;return r.trialState.status!=='loading';});
 await page.evaluate(()=>{window.__dw.advance(.5);window.__dw.render();});
}
async function capture(name){await page.evaluate(()=>window.__dw.render());const file=path.join(output,name+'.png');await page.screenshot({path:file});report.captures.push({name,url:page.url(),sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')});}
const state=()=>page.evaluate(()=>{const r=window.__riderShow?.actors?.[0]?.rider??window.__dw.game.rider;return {trial:r.trialState,regions:r.model.importedRegions,bodyTriangles:r.model.geometry.index.count/3,bodyVertices:r.model.geometry.attributes.position.count,patches:r.cloth.pieces.filter(p=>p.boundSurface).map(p=>({name:p.spec.name,particles:p.cloth.n,vertices:p.pos.length/3,triangles:p.geo.index.count/3,controlSignature:p.boundSurface.controlSignature,surfaceSignature:p.boundSurface.surfaceSignature}))};});
const tab=label=>page.locator('.dw-tab').filter({hasText:new RegExp('^'+label+'$')}).click();
const pick=label=>page.locator('.dw-stable-body').getByText(label,{exact:true}).last().click();
async function revert(){await page.locator('.dw-stable-foot .dw-btn').filter({hasText:'Revert'}).click();await page.locator('.dw-dialog .dw-btn').filter({hasText:/^Revert$/}).click();}
const mixed='view=rider&outfit=flight&pieceTrousers=travel-drape-trousers&pieceFootwear=scout-footwear&headgear=none&scarf=none&cape=none&dist=2.7&height=.95';
try{
 phase='normal-menu';let requests=0;page.on('request',r=>{if(r.url().includes('compatibility')&&r.url().includes('.glb'))requests++;});
 await boot();check('normal boot does not request the trial GLB',(await state()).trial.status==='off'&&requests===0);await capture('normal-menu-current');
 await boot('riderTrial=compatibility');check('explicit opt-in reaches the normal title',await page.evaluate(()=>window.__dw.game.screen==='title'));await capture('normal-menu-opt-in');
 await page.evaluate(()=>{const g=window.__dw.game;g.openStable();g.frame(0,true);});
 const entry=await page.evaluate(()=>JSON.stringify(window.__dw.game.save.data.rider));
 await tab('Outfit Pieces');await pick('Gathered Linen Trousers');await pick('Scout Boots');
 check('real Stable mixes legacy top, imported trousers and different footwear',(await state()).regions.length===2,await state());
 check('preview leaves saved appearance intact',await page.evaluate(entry=>JSON.stringify(window.__dw.game.save.data.rider)===entry,entry));await capture('stable-import-mix');
 await page.evaluate(()=>{const r=window.__dw.game.rider;window.__proofRefs={geometry:r.model.geometry,skeleton:r.model.rig.skeleton,material:r.model.mesh.material};});
 for(const row of [0,1])await page.locator('.dw-swatches').nth(row).locator('.dw-swatch:not(.is-selected)').first().click();
 check('Stable dyes keep geometry, skeleton and material in place',await page.evaluate(()=>{const r=window.__dw.game.rider,v=window.__proofRefs;return r.model.geometry===v.geometry&&r.model.rig.skeleton===v.skeleton&&r.model.mesh.material===v.material;}));
 await revert();check('real Revert restores full look and leaves saves intact',await page.evaluate(entry=>JSON.stringify(window.__dw.game.rider.look)===entry&&JSON.stringify(window.__dw.game.save.data.rider)===entry,entry));
 await page.evaluate(()=>{window.__dw.game.openStable();window.__dw.render();});await tab('Outfit Pieces');await pick('Gathered Linen Trousers');await pick('Scout Boots');
 await page.locator('.dw-stable-foot .dw-btn').filter({hasText:'Save & leave'}).click();
 const saved=await page.evaluate(()=>JSON.stringify(window.__dw.game.save.data.rider));
 check('trial adds no saved fields',!saved.includes('Trial')&&!saved.includes('imported')&&!saved.includes('blender'));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
 check('saved mix reloads through opt-in',await page.evaluate(saved=>JSON.stringify(window.__dw.game.save.data.rider)===saved&&window.__dw.game.rider.model.importedRegions.length===2,saved));
 phase='actual-gameplay';const gameplay=await page.evaluate(()=>{
   const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();g.setScreen('play');
   g.world.terrain.standingPoint(spawn[0],spawn[2],at);p.teleport(at,0,'landed');g.cameraRig.setOverride(null);g.cameraRig.snap(p);
   h.advance(.6,{flight:{flap:1}});const takeoff=p.mode;
   g.world.terrain.standingPoint(spawn[0]-6,spawn[2]+4,at);at.y+=p.breed.standHeight+3;p.teleport(at,0,'flying',4);p.model.state.velocity.y=-2;
   for(let i=0;i<180&&p.mode==='flying';i++)h.advance(1/30,{flight:{flare:1}});
   const landing=p.mode;h.advance(1);h.advance(.25,{pressed:{interact:true}});const dismount=p.mode;h.advance(1);h.render();
   return {takeoff,landing,dismount,finished:p.mode,finite:g.rider.cloth.pieces.every(pc=>Array.from(pc.pos).every(Number.isFinite)),regions:g.rider.model.importedRegions};
 });check('imported mix completes actual takeoff, landing and dismount',gameplay.takeoff==='flying'&&gameplay.landing==='landed'&&gameplay.dismount==='dismounting'&&gameplay.finished==='onFoot'&&gameplay.finite,gameplay);await capture('gameplay-after-dismount');
 // Same code, look, pose, camera and software renderer; only the explicit provider changes.
 for(const [name,query] of [['mixed-front',mixed+'&angle=0'],['mixed-side',mixed+'&angle=90'],['mixed-back',mixed+'&angle=180'],['travel-front','view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&angle=0&dist=2.7&height=.95'],['mounted-left',mixed+'&real=1&angle=90&height=.05&dist=3.2'],['mounted-right',mixed+'&real=1&angle=270&height=.05&dist=3.2']]){
   for(const variant of ['current','proof']){phase=name+'-'+variant;await boot(query+(variant==='proof'?'&riderTrial=compatibility':''));await capture(phase);
     if(name==='mixed-front'||name==='travel-front'){
       const measured=await page.evaluate(()=>{
         const h=window.__dw,r=window.__riderShow?.actors?.[0]?.rider??h.game.rider;h.advance(1);const samples=[];
         for(let i=0;i<240;i++){const t=performance.now();h.advance(1/60);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);h.render();
         const gl=h.game.renderer.gl,bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0);
         return {cpu:{median:samples[120],p95:samples[228],samples:240},render:{...gl.info.render},memory:{...gl.info.memory,programs:gl.info.programs.length},bodyBytes:bytes(r.model.geometry),clothBytes:r.cloth.pieces.reduce((n,p)=>n+bytes(p.geo),0)};
       });report.measurements.push({name,variant,...await state(),...measured});
     }
     if(variant==='proof')check(name+' reports its actual imported coverage',name==='travel-front'?(await state()).patches.length===1:(await state()).regions.length===2,await state());
   }
 }
 phase='cloth-motion';await boot('view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&riderTrial=compatibility');
 const motion=await page.evaluate(async()=>{
   const {QUALITY}=await import('/src/render/quality.ts'),r=window.__riderShow.actors[0].rider,params=window.__riderShow.params;
   const solvers=r.cloth.pieces.map(p=>p.cloth);let finite=true,maxMotion=0,maxSeam=0;
   for(let i=0;i<480;i++){
     params.set('action',i<240?'run':'idle');params.set('wind',i<360?(i%80<40?'40,-30':'-40,30'):'0,0');
     window.__dw.advance(i%90===0?.2:1/60);
     for(const p of r.cloth.pieces){finite&&=Array.from(p.pos).every(Number.isFinite);if(!p.boundSurface)continue;
       for(let j=0;j<p.cloth.n;j++){const q=j*3,delta=Math.hypot(p.cloth.pos[q]-p.guide[q],p.cloth.pos[q+1]-p.guide[q+1],p.cloth.pos[q+2]-p.guide[q+2]);if(j<p.spec.cols)maxSeam=Math.max(maxSeam,delta);else maxMotion=Math.max(maxMotion,delta);}
     }
   }
   let continuity=true;for(const q of [QUALITY.medium,QUALITY.high,QUALITY.ultra,QUALITY.low]){r.setQuality(q);r.setLook({...r.look,outfitPrimary:'#96715c',outfitSecondary:'#6b8ea0'});window.__dw.advance(1/60);continuity&&=r.cloth.pieces.every((p,i)=>p.cloth===solvers[i]);}
   const p=r.cloth.pieces.find(p=>p.boundSurface);return {finite,maxMotion,maxSeam,continuity,skinned:!!p.mesh.isSkinnedMesh,patchVertices:p.pos.length/3,controls:p.cloth.n};
 });check('live cloth survives reversals, calm, hitches, dyes and all quality tiers',motion.finite&&motion.maxMotion>.005&&motion.maxSeam<1e-6&&motion.continuity&&!motion.skinned,motion);await capture('cloth-after-motion');
 phase='offline-cached';await context.setOffline(true);check('loaded fixture supports offline local changes without additional fetches',await page.evaluate(()=>{const r=window.__riderShow.actors[0].rider;r.setLook({...r.look,outfitPrimary:'#b0a38b'});window.__dw.advance(.1);return r.trialState.status==='ready'&&r.cloth.pieces.some(p=>p.boundSurface);}));await context.setOffline(false);
 phase='late-Revert';let release;const gate=new Promise(resolve=>release=resolve);const fixture=await fs.readFile('src/assets/rider-blender/compatibility.glb');
 await page.route('**/compatibility.glb*',async route=>{await gate;await route.fulfill({status:200,body:fixture,contentType:'model/gltf-binary'});});
 await page.goto(origin+'/?manual=1&quality=low&riderTrial=compatibility',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__dw?.ready);
 await page.evaluate(()=>{const g=window.__dw.game;g.openStable();g.frame(0,true);});const beforeLate=await page.evaluate(()=>JSON.stringify(window.__dw.game.rider.look));
 await tab('Outfit Pieces');await pick('Racing Top'); // Locked parent must leave preview unchanged.
 check('locked parent still blocks its piece',await page.evaluate(entry=>JSON.stringify(window.__dw.game.rider.look)===entry,beforeLate));
 await pick("Scout's Tunic");await revert();release();await page.waitForFunction(()=>window.__dw.game.rider.trialState.status==='ready');
 check('late GLB completion honors actual Stable Revert',await page.evaluate(entry=>JSON.stringify(window.__dw.game.rider.look)===entry,beforeLate));await page.unroute('**/compatibility.glb*');
 phase='failed-load';await page.route('**/compatibility.glb*',route=>route.fulfill({status:404,body:'Expected failure proof'}));
 await boot(mixed+'&riderTrial=compatibility');const failed=await state();check('failed load retains generated surfaces and reports failure',failed.trial.status==='failed'&&failed.regions.length===0,failed);await page.unroute('**/compatibility.glb*');
 check('no unexpected browser errors',report.errors.every(e=>e.phase==='failed-load'),report.errors);
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}
finally{await context.setOffline(false);await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({checks:report.checks.length,captures:report.captures.length,errors:report.errors,failure:report.failure,measurements:report.measurements},null,2));
