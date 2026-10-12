// Pass A and B visual evidence. Actual Stable/follow cameras plus labeled diagnostic close-ups.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {chromium} from 'playwright';
const mode=process.argv[2]??'a',supplement=mode==='a-back-supplement';
if(!['a','b','a-back-supplement'].includes(mode))throw Error('Unknown visual QA mode: '+mode);
const generatedUtc=new Date().toISOString(),output=supplement?`shots/rider-blender/windkeel-resting-visuals/${generatedUtc.replace(/:/g,'-')}/shots/rider-blender/qa-a-gameplay-back-supplement`:'shots/rider-blender/qa-'+mode;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const asset=JSON.parse(await fs.readFile('docs/rider-blender-trial/ASSET_MANIFEST.json','utf8')).sha256;
const replacementStems=['day-high-cobalt-gameplay-back','night-medium-gameplay-back','day-ultra-blue-gameplay-back'];
const supplementContract='actual on-foot follow rig; neutral scripted input; yaw/pitch orbit control; collisions enabled; no camera override';
const standingPointId='roost-spawn-offset-24-4';
let supersedes;
if(supplement){
 const argument=process.argv.find(arg=>arg.startsWith('--supersedes-report=')),relative=argument?.slice('--supersedes-report='.length);
 if(!relative||path.isAbsolute(relative)||relative.includes('..')||relative.includes(':'))throw Error('Supplement requires a contained --supersedes-report=<repository-relative A report>');
 const originalPath=path.resolve(relative),bytes=await fs.readFile(originalPath),original=JSON.parse(bytes);
 if(original.pass!=='a'||original.asset!==asset||original.captures?.length!==46||original.failure||original.errors?.length)throw Error('Superseded report must be the complete current-asset A46 report without execution failures');
 const rejected=[];
 for(const stem of replacementStems)for(const variant of ['current','trial']){
  const name=stem+'-'+variant,record=original.captures.find(item=>item.name===name);
  if(!record?.sha256||hash(await fs.readFile(path.join(path.dirname(originalPath),name+'.png')))!==record.sha256)throw Error('Rejected capture identity mismatch: '+name);
  rejected.push({name,sha256:record.sha256,cameraContract:record.cameraContract});
 }
 supersedes={originalReport:{file:relative.replace(/\\/g,'/'),sha256:hash(bytes)},pairStems:replacementStems,captures:rejected,reason:'Three historical rear gameplay pairs rejected because the current rider was absent, occluded or differently framed. Capture-tool live-input and nearby-companion exposure are corrected for this supplement only; no runtime change.',standingPointId};
}
if(supplement)await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(output,{recursive:!supplement});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
const report={pass:mode,asset,generatedUtc,renderer:'Edge SwiftShader; no physical GPU certification',profile:'fresh nonpersistent context',captures:[],errors:[],measurements:[],...(supplement?{supersedes,scope:'Six replacement rear gameplay captures only. Original A46 report and all other matched pairs remain historical and unchanged.',sourceHashes:await Promise.all(['scripts/rider-blender-visual-qa.mjs','src/debug/hooks.ts','src/input/Input.ts','src/camera/CameraRig.ts','src/camera/followRigs.ts','src/camera/rigTypes.ts'].map(async file=>({file,sha256:hash(await fs.readFile(file))}))),captureToolFinding:{classification:'QA tool source issue; not a rider runtime defect',proof:['debug hooks advance(seconds, undefined) restores live input; an explicit {} supplies neutral scripted input.','debug hooks render() calls frame(0); mouse look gain is independent of dt, so frame zero can still consume pointer deltas.','OrbitRig also protects against the waiting wyvern; the replacement uses the same terrain standingPoint contract farther from that companion.'],limits:'Source proves the live-input exposure, not which pointer delta or companion response caused each rejected historical frame. New captures require visual review.'}}:{})};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function boot(variant='trial',extra=''){
 const origin=variant==='trial'?'http://127.0.0.1:5210':'http://127.0.0.1:5211';
 await page.goto(origin+'/?manual=1&weather=clear&'+extra+(variant==='trial'?'&riderTrial=blender':''),{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
 if(variant==='trial')await page.waitForFunction(()=>{const r=window.__riderShow?.actors?.[0]?.rider??window.__dw.game.rider;return r.trialState.status!=='loading';},null,{timeout:120000});
 const status=await page.evaluate(()=>{const r=window.__riderShow?.actors?.[0]?.rider??window.__dw.game.rider;return r.trialState?.status;});if(variant==='trial'&&status!=='ready')throw Error('Authored import failed: '+status);
}
async function capture(name,context={}){
 await page.evaluate(neutral=>{const h=window.__dw;if(neutral)h.game.input.setScripted({});try{h.render();}finally{if(neutral)h.game.input.setScripted(null);}},supplement);const file=output+'/'+name+'.png';await page.screenshot({path:file,animations:'disabled'});
 const state=await page.evaluate(()=>{const g=window.__dw.game,r=window.__riderShow?.actors?.[0]?.rider??g.rider;return {screen:g.screen,camera:g.cameraRig.rig,look:r.look,regions:r.model.importedRegions??[],bodyVertices:r.model.geometry.attributes.position.count,bodyTriangles:r.model.geometry.index.count/3,cloth:r.cloth.pieces.map(p=>({name:p.spec.name,particles:p.cloth.n,vertices:p.pos.length/3,bound:!!p.boundSurface}))};});
 const cameraState=supplement?await page.evaluate(()=>{const g=window.__dw.game,p=g.player,rig=g.cameraRig.rigs.foot,spawn=g.world.layout.spawn.position;return {standingPointId:'roost-spawn-offset-24-4',requestedOffset:[24,4],requestedXZ:[spawn[0]+24,spawn[2]+4],position:p.riderPose.position.toArray(),riderYaw:p.riderPose.yaw,mode:p.mode,screen:g.screen,rig:g.cameraRig.rig,overrideActive:g.cameraRig.override!==null,orbit:{yaw:rig.view.yaw,pitch:rig.view.pitch,lookIdle:rig.lookIdle,recenterT:rig.recenterT},cameraPosition:g.camera.position.toArray(),cameraQuaternion:g.camera.quaternion.toArray(),projection:g.camera.projectionMatrix.toArray(),input:'explicit empty scripted frame for advance and render; no pointer interaction',terrainCollision:'existing follow rig enabled'};}):undefined;
 if(supplement&&(cameraState.mode!=='onFoot'||cameraState.screen!=='play'||cameraState.rig!=='foot'||cameraState.overrideActive))throw Error('Supplement did not use the actual unoverridden on-foot camera: '+name);
 report.captures.push({name,url:page.url(),...context,...state,...(cameraState?{cameraState}:{}),sha256:hash(await fs.readFile(file))});
}
async function travel(){await page.evaluate(async()=>{const {DEFAULT_RIDER}=await import('/src/cosmetics/catalog.ts'),g=window.__dw.game;g.setRiderLook({...DEFAULT_RIDER,outfit:'travel-drape',headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'});});}
// Preserved production baseline has no /src modules: use its existing rider look instead.
async function lookTravel(variant){await page.evaluate(()=>{const g=window.__dw.game;g.setRiderLook({...g.rider.look,outfit:'travel-drape',build:'medium',wardrobe:undefined,headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'});});}
async function stable(){await page.evaluate(()=>{const g=window.__dw.game;g.openStable();g.frame(0,true);g.cameraRig.setStableFocus('rider');window.__dw.advance(2);});await page.locator('.dw-tab').filter({hasText:/^Outfit Pieces$/}).click();await page.evaluate(()=>window.__dw.advance(1.5));}
async function angle(kind,degrees){await page.evaluate(({kind,degrees})=>{const h=window.__dw,g=h.game,rig=kind==='stable'?g.cameraRig.stableRig:g.cameraRig.rigs.foot;rig.view.yaw=g.player.riderPose.yaw+degrees*Math.PI/180;rig.view.pitch=.14;rig.refocus=0;rig.idle=0;rig.lookIdle=0;h.advance(.1);h.render();},{kind,degrees});}
try{
 if(supplement){
  for(const setting of [{id:'day-high-cobalt',q:'high',tod:.42,primary:'#315e9c',secondary:'#f2eada',skin:'#6a4230',hair:'#d8b070'},{id:'night-medium',q:'medium',tod:.06,primary:'#f2eada',secondary:'#315e9c',skin:'#e6b896',hair:'#1e1a18'},{id:'day-ultra-blue',q:'ultra',tod:.5,primary:'#7fa8c4',secondary:'#a8582a',skin:'#b07a56',hair:'#e8d8b0'}])for(const variant of ['current','trial']){
   await boot(variant,`quality=${setting.q}&tod=${setting.tod}`);await lookTravel(variant);
   await page.evaluate(s=>{const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();g.setRiderLook({...g.rider.look,outfitPrimary:s.primary,outfitSecondary:s.secondary,skin:s.skin,hairColor:s.hair});g.world.terrain.standingPoint(spawn[0]+24,spawn[2]+4,at);p.teleport(at,0,'onFoot');g.setScreen('play');g.cameraRig.setOverride(null);g.cameraRig.snap(p);h.advance(.1,{});const rig=g.cameraRig.rigs.foot;rig.view.yaw=p.riderPose.yaw;rig.view.pitch=.14;rig.lookIdle=0;rig.recenterT=0;h.advance(.5,{});},setting);
   await capture(`${setting.id}-gameplay-back-${variant}`,{variant,setting,cameraContract:supplementContract,standingPointId});
  }
  if(report.captures.length!==6)throw Error('Supplement must contain exactly six replacement captures');
 }else if(mode==='a'){
  for(const setting of [{id:'day-low-pale',q:'low',tod:.42,primary:'#f2eada',secondary:'#7fa8c4',skin:'#d09a74',hair:'#3a2a20'},{id:'day-high-cobalt',q:'high',tod:.42,primary:'#315e9c',secondary:'#f2eada',skin:'#6a4230',hair:'#d8b070'},{id:'night-medium',q:'medium',tod:.06,primary:'#f2eada',secondary:'#315e9c',skin:'#e6b896',hair:'#1e1a18'},{id:'day-ultra-blue',q:'ultra',tod:.5,primary:'#7fa8c4',secondary:'#a8582a',skin:'#b07a56',hair:'#e8d8b0'}])for(const variant of ['current','trial']){
   await boot(variant,`quality=${setting.q}&tod=${setting.tod}`);await lookTravel(variant);
   await page.evaluate(s=>{const g=window.__dw.game;g.setRiderLook({...g.rider.look,outfitPrimary:s.primary,outfitSecondary:s.secondary,skin:s.skin,hairColor:s.hair});},setting);await stable();
   for(const [view,deg] of [['front',0],['side',90],['back',180]]){await angle('stable',deg);await capture(`${setting.id}-stable-${view}-${variant}`,{variant,setting,cameraContract:'actual Stable rig; yaw controls only'});}
   await page.evaluate(()=>{const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();g.world.terrain.standingPoint(spawn[0]-5,spawn[2]+4,at);p.teleport(at,0,'onFoot');g.setScreen('play');g.cameraRig.setOverride(null);g.cameraRig.snap(p);h.advance(1);});
   for(const [view,deg] of [['front',180],['back',0]]){await angle('foot',deg);await capture(`${setting.id}-gameplay-${view}-${variant}`,{variant,setting,cameraContract:'actual on-foot follow rig; orbit yaw controls only'});}
  }
  for(const [name,extra] of [['face','height=1.65&dist=1.1&camUp=-.2&angle=0'],['hands','height=.78&dist=1.15&camUp=-.2&angle=18'],['feet','height=.1&dist=1.0&camUp=-.2&angle=18']])for(const variant of ['current','trial']){
   await boot(variant,'quality=high&tod=.42&view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&'+extra);await page.evaluate(()=>window.__dw.advance(1));await capture(`${name}-${variant}`,{variant,cameraContract:'diagnostic actual-engine close-up; not the gameplay camera'});
  }
 }else if(mode==='b'){
  await boot('trial','quality=low&tod=.42');await stable();
  const cases=await page.evaluate(async()=>{
   const {cosmeticsFor,DEFAULT_RIDER}=await import('/src/cosmetics/catalog.ts'),{GARMENT_SLOTS,withGarment}=await import('/src/cosmetics/wardrobe.ts');const cases=[];
   for(const build of ['slight','medium','broad']){
    const base={...DEFAULT_RIDER,build,headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'};
    for(const outfit of cosmeticsFor('riderOutfit'))cases.push({id:build+'-preset-'+outfit.id,look:{...base,outfit:outfit.id}});
    for(const [part,slot] of Object.entries(GARMENT_SLOTS))for(const option of cosmeticsFor(slot))cases.push({id:build+'-'+part+'-'+option.id,look:withGarment(base,part,option.id)});
   }return cases;
  });
  for(const item of cases){await page.evaluate(look=>{const h=window.__dw,g=h.game;g.setRiderLook(look);h.advance(.12);h.render();},item.look);await capture(item.id,{cameraContract:'actual Stable rider camera',case:'preset / individual category choice'});}
  // High-risk silhouettes, sleeve lining and the explicit long cut.
  for(const [name,query] of [['raised-arms','action=wave&t=.62'],['wanderer-back','riderProof=wanderer&angle=180'],['bare-mixed','outfit=flight&pieceTop=travel-drape-top&pieceFootwear=none&pieceArmWraps=none'],['mixed-sleeves','outfit=flight&pieceTop=travel-drape-top&pieceArmWraps=cartographer-armWraps&action=wave&t=.62']]){
   const q=new URLSearchParams('quality=high&tod=.42&view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&dist=2.8&height=.98');for(const [key,value] of new URLSearchParams(query))q.set(key,value);
   await boot('trial',q.toString());await page.evaluate(()=>window.__dw.advance(1));await capture(name,{cameraContract:'diagnostic actual-engine view; raised-arm lining/seam review'});
  }
  // Actual wyvern saddle, reins and stirrups on every breed. Both sides include full boots.
  for(const breed of ['harrier','skimmer','galewing','ironback'])for(const [side,deg] of [['left',90],['right',270]])for(const variant of ['current','trial']){
   await boot(variant,`quality=low&tod=.42&view=rider&real=1&outfit=travel-drape&headgear=none&scarf=none&cape=none&angle=${deg}&dist=4.6&height=-.1&camUp=.05`);
   await page.evaluate(breed=>{const g=window.__dw.game;g.setWyvernLook({...g.wyvern.look,...g.save.data.wyvern,breed});window.__dw.advance(1);window.__dw.render();},breed);
   await capture(`mounted-${breed}-${side}-${variant}`,{variant,breed,side,cameraContract:'diagnostic actual-engine view of the real breed/saddle; not controller flight'});
  }
 }
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({pass:mode,output:output+'/report.json',captures:report.captures.length,errors:report.errors,failure:report.failure}));
