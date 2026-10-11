// Neutral screen-centre dot; zero ready prediction; fresh actual Q/RT casts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {browserEvidence} from './browser-evidence.mjs';
const url=new URL(process.argv[2]??'http://127.0.0.1:5175/');url.search='?manual=1&quality=low';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],evidence={captures:[]};let metadata=null;
const pendingRequests=new Set();page.on('request',r=>pendingRequests.add(r.url()));page.on('requestfinished',r=>pendingRequests.delete(r.url()));page.on('requestfailed',r=>pendingRequests.delete(r.url()));
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('shots/windline-reticle',{recursive:true});
const cue=()=>page.locator('#sky-lance-reticle').evaluate(el=>{const r=el.getBoundingClientRect();return {state:el.dataset.target,color:getComputedStyle(el).color.replaceAll(' ',''),valid:el.classList.contains('is-valid'),ring:!!el.querySelector('[data-valid-ring]'),centre:[r.left+r.width/2,r.top+r.height/2],size:[r.width,r.height],viewport:[innerWidth,innerHeight]};});
const neutral=c=>{assert.equal(c.state,'aiming');assert.equal(c.color,'rgb(168,221,236)');assert.equal(c.valid,false);assert.equal(c.ring,false);assert.deepEqual(c.size,[20,20]);assert.ok(Math.abs(c.centre[0]-c.viewport[0]/2)<.25&&Math.abs(c.centre[1]-c.viewport[1]/2)<.25);};
const captureReadiness=()=>page.evaluate(()=>{const g=window.__dw?.game,gl=g?.renderer?.gl,canvas=gl?.domElement,rect=canvas?.getBoundingClientRect();return {ready:window.__dw?.ready,screen:g?.screen,device:g?.input.device,viewport:[innerWidth,innerHeight],documentReady:document.readyState,fonts:document.fonts.status,canvas:canvas?{width:canvas.width,height:canvas.height,css:[rect.width,rect.height],contextLost:gl.getContext().isContextLost(),renderFrame:gl.info.render.frame,drawCalls:gl.info.render.calls}:null,errors:window.__dw?.errors};});
async function capture(name,clip){
 const path=`shots/windline-reticle/${name}.png`,started=Date.now();
 evidence.capturePhase={name,path,clip:clip??null,requestedViewport:page.viewportSize(),startedAt:new Date(started).toISOString(),before:await captureReadiness()};
 console.log('Rendered capture readiness:',JSON.stringify(evidence.capturePhase));
 try{await page.screenshot({path,timeout:120000,...(clip?{clip}:{})});evidence.captures.push({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex'),elapsedMs:Date.now()-started});}
 catch(error){evidence.captureFailure={...evidence.capturePhase,elapsedMs:Date.now()-started,message:error.message,pendingRequests:[...pendingRequests],pageErrors:[...errors],after:await Promise.race([captureReadiness().catch(e=>({error:e.message})),new Promise(resolve=>setTimeout(()=>resolve({error:'Readiness query did not respond within2s'}),2000))])};console.error('Rendered capture failure:',JSON.stringify(evidence.captureFailure));throw error;}
}
async function readyPose(depth=18){await page.evaluate(depth=>{
 const g=__dw.game,p=g.player,s=g.world.terrain.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
 __reticlePad.buttons[7]={pressed:false,touched:false,value:0};__reticlePad.axes.fill(0);g.placeAtSpawn();p.foot.position.set(x,s.bottomHeight(x,z)-depth,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);g.frame(1/120,false);g.cameraRig.snap(p);
 g.input.setScripted({lookActive:true,lookIsRate:false,lookX:g.cameraRig.yaw+Math.PI/2,lookY:-10});g.frame(1/120,false);g.input.setScripted(null);
 for(let i=0;i<60;i++)g.frame(1/120,false);g.frame(0,true);
 },depth);}
try{
 await page.goto(url.href);await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:180000});metadata=await browserEvidence(page,url);
 await page.evaluate(()=>{
  const g=__dw.game;g.save.data.firstLeadGuide='skipped';g.startGame();__dw.advance(.1);g.applySettings({...g.settings,reducedMotion:true});
  const pad=window.__reticlePad={id:'Xbox standard neutral reticle QA',mapping:'standard',connected:true,index:0,timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
 });
 evidence.alignment=[];
 for(const device of ['keyboard','gamepad'])for(const [width,height] of [[1280,720],[1920,1080],[617,380],[360,780]]){
  await page.setViewportSize({width,height});await readyPose();
  if(device==='keyboard'){await page.keyboard.press('w');await page.evaluate(()=>__dw.game.frame(1/120,true));}
  else await page.evaluate(()=>{__reticlePad.axes[0]=.9;__dw.game.frame(1/120,true);__reticlePad.axes[0]=0;__dw.game.frame(1/120,true);});
  assert.equal(await page.evaluate(()=>__dw.game.input.device),device);const c=await cue();neutral(c);evidence.alignment.push({device,...c});await capture(`neutral-${device}-${width}`);
  if(device==='gamepad'&&width===1280)await capture('neutral-dot-zoom-source',{x:width/2-14,y:height/2-14,width:28,height:28});
 }
 await page.setViewportSize({width:1280,height:720});await readyPose();
 evidence.ready=await page.evaluate(()=>{
  const g=__dw.game,p=g.player,v=g.skyLanceVisuals,w=p.skyLance.world,sw=w.sweep,rows=[];let sweeps=0;
  w.sweep=function(...args){sweeps++;return sw.apply(this,args);};const feet=p.foot.position.clone(),cam=g.camera.position.clone(),quat=g.camera.quaternion.clone();
  try{for(const motion of ['idle','strong movement'])for(let i=0;i<240;i++){
   p.foot.position.copy(feet);g.camera.position.copy(cam);g.camera.quaternion.copy(quat);
   if(motion!=='idle'){p.foot.position.x+=i*.03;g.camera.position.x+=i*.03;g.camera.rotateY(.025*Math.sin(i/20));p.foot.velocity.set(4*Math.sin(i/17),-.2,2*Math.cos(i/13));}
   const start=performance.now();v.updateReticle(g.camera,p.foot.position,p.foot.velocity,p.skyLance);const ms=performance.now()-start,el=document.querySelector('#sky-lance-reticle');
   rows.push({motion,index:i,ms,target:v.target,state:el.dataset.target,valid:el.classList.contains('is-valid'),color:getComputedStyle(el).color,sweeps});
  }}finally{w.sweep=sw;p.foot.position.copy(feet);g.camera.position.copy(cam);g.camera.quaternion.copy(quat);p.foot.velocity.set(0,0,0);}
  return {rows,sweeps,excludedWarmupQueries:0,firstMs:rows[0].ms,meanMs:rows.reduce((a,r)=>a+r.ms,0)/rows.length};
 });
 assert.equal(evidence.ready.sweeps,0);assert.ok(evidence.ready.meanMs<2.5,'neutral moving/idle dot mean CPU budget');
 assert.ok(evidence.ready.rows.every(r=>r.target===null&&r.state==='aiming'&&!r.valid&&r.color==='rgb(168, 221, 236)'));
 console.log('Neutral idle/moving CPU:',JSON.stringify({samples:evidence.ready.rows.length,sweeps:evidence.ready.sweeps,firstMs:evidence.ready.firstMs,meanMs:evidence.ready.meanMs}));
 evidence.lifecycle=[];
 for(const action of ['pause','hud','mount-leap']){
  await readyPose();const result=await page.evaluate(action=>{
   const g=__dw.game,p=g.player,w=p.skyLance.world,el=document.querySelector('#sky-lance-reticle'),render=g.renderer.render,sw=w.sweep,update=g.skyLanceVisuals.updateReticle,paints=[];let sweeps=0,physicsSweeps=0,predicting=false;
   const snapshot=()=>{const r=el.getBoundingClientRect();return {visible:!el.hidden&&!el.closest('[hidden]'),valid:el.classList.contains('is-valid'),state:el.dataset.target,color:getComputedStyle(el).color,target:g.skyLanceVisuals.target,centre:[r.left+r.width/2,r.top+r.height/2],sweeps,mode:p.mode};};
   g.renderer.render=()=>paints.push(snapshot());g.skyLanceVisuals.updateReticle=function(...args){predicting=true;try{return update.apply(this,args);}finally{predicting=false;}};w.sweep=function(...args){if(predicting)sweeps++;else physicsSweeps++;return sw.apply(this,args);};
   const tick=pressed=>{g.input.setScripted(pressed?{pressed}:null);g.frame(0,true);g.input.setScripted(null);};
   try{
    if(action==='pause'){g.pause();tick();}else if(action==='hud')tick({toggleHud:true});else {p.teleport(p.foot.position.clone().set(5000,900,5000),0,'flying',30);g.frame(1/120,true);}
    const hidden=snapshot();
    if(action==='pause'){g.resume();tick();}else if(action==='hud')tick({toggleHud:true});else {__reticlePad.buttons[3]={pressed:true,touched:true,value:1};for(let i=0;i<48&&!paints.some(f=>f.visible);i++)g.frame(1/120,true);}
    return {action,hidden,firstVisible:paints.find(f=>f.visible),sweeps,physicsSweeps,paints};
   }finally{g.renderer.render=render;g.skyLanceVisuals.updateReticle=update;w.sweep=sw;g.input.setScripted(null);__reticlePad.buttons[3]={pressed:false,touched:false,value:0};}
  },action);
  evidence.lifecycle.push(result);assert.equal(result.hidden.visible,false);assert.ok(result.firstVisible);assert.equal(result.sweeps,0);
  assert.equal(result.firstVisible.state,'aiming');assert.equal(result.firstVisible.valid,false);assert.equal(result.firstVisible.target,null);assert.equal(result.firstVisible.color,'rgb(168, 221, 236)');assert.deepEqual(result.firstVisible.centre,[640,360]);
 }
 evidence.casts=[];
 for(const [device,depth] of [['keyboard',18],['gamepad',45]]){
  await readyPose(depth);
  const expected=await page.evaluate(()=>{const g=__dw.game,w=g.player.skyLance.world,ray=g.camera.getWorldDirection(g.player.foot.position.clone()),hit=w.sweep(g.camera.position,g.camera.position.clone().addScaledVector(ray,100),.08);return {anchor:hit?.anchorId,point:hit?.point.toArray()};});
  if(device==='keyboard')await page.keyboard.down('q');else await page.evaluate(()=>{__reticlePad.buttons[7]={pressed:true,touched:true,value:.8};});
  const cast=await page.evaluate(expected=>{
   const g=__dw.game,p=g.player,w=p.skyLance.world,sw=w.sweep;let queries=0,steps=0;
   w.sweep=function(...args){queries++;return sw.apply(this,args);};
   try{g.frame(1/120,false);steps++;while(steps<240&&p.skyLance.state==='projectile'){g.frame(1/120,false);steps++;}const point=p.skyLance.position.toArray();return {anchor:p.skyLance.anchorId,attached:!!p.skyLance.rope,length:p.skyLance.rope?.length,point,impactError:Math.hypot(...point.map((n,i)=>n-expected.point[i])),queries,seconds:steps/120,ship:!!g.scene.getObjectByName('Windhaven')};}
   finally{w.sweep=sw;}
  },expected);
  evidence.casts.push({device,expected,...cast});assert.equal(cast.attached,true);assert.equal(cast.anchor,expected.anchor);assert.ok(cast.impactError<.16);assert.ok(cast.queries>0,'actual press solves fresh physical geometry');assert.equal(cast.ship,false);neutral(await cue());
  if(device==='keyboard')await page.keyboard.up('q');else await page.evaluate(()=>{__reticlePad.buttons[7]={pressed:false,touched:false,value:0};});
  await page.evaluate(()=>__dw.game.frame(1/120,false));
 }
 // Inserting a new thin first solid after aiming must affect the actual press.
 await readyPose();const inserted=await page.evaluate(()=>{
  const g=__dw.game,ray=g.camera.getWorldDirection(g.player.foot.position.clone()),at=g.camera.position.clone().addScaledVector(ray,12),extent=[2,2,2],components=[Math.abs(ray.x),Math.abs(ray.y),Math.abs(ray.z)];extent[components.indexOf(Math.max(...components))]=.001;
  const wall={kind:'box',x:at.x,y:at.y,z:at.z,hx:extent[0],hy:extent[1],hz:extent[2],yaw:0},solids=[wall];g.world.terrain.colliders.addSource('neutral-cast-wall',()=>solids);
  const w=g.player.skyLance.world,hit=w.sweep(g.camera.position,g.camera.position.clone().addScaledVector(ray,100),.08);return {anchor:hit?.anchorId,wallId:g.world.terrain.colliders.identity(wall),point:hit?.point.toArray(),exhausted:!!hit?.exhausted};
 });
 assert.equal(inserted.anchor,inserted.wallId,'the newly inserted thin solid is the first camera-ray hit');assert.equal(inserted.exhausted,false);assert.match(inserted.wallId,/^solid-/);
 neutral(await cue());await page.evaluate(()=>{__reticlePad.buttons[7]={pressed:true,touched:true,value:.8};const g=__dw.game;g.frame(1/120,false);for(let i=0;i<240&&g.player.skyLance.state==='projectile';i++)g.frame(1/120,false);});
 evidence.newSolid=await page.evaluate(()=>({anchor:__dw.game.player.skyLance.anchorId,rope:!!__dw.game.player.skyLance.rope,point:__dw.game.player.skyLance.position.toArray()}));evidence.newSolid.expected=inserted;assert.equal(evidence.newSolid.rope,true);assert.equal(evidence.newSolid.anchor,inserted.wallId);assert.ok(Math.hypot(...evidence.newSolid.point.map((n,i)=>n-inserted.point[i]))<.16);
 await page.evaluate(()=>{__reticlePad.buttons[7]={pressed:false,touched:false,value:0};__dw.game.frame(1/120,false);__dw.game.world.terrain.colliders.removeSource('neutral-cast-wall');});
 // No surface within range: the neutral dot makes no promise and actual cast misses.
 await page.evaluate(()=>{const g=__dw.game,p=g.player;g.placeAtSpawn();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,0,0);g.frame(1/120,false);g.cameraRig.snap(p);g.frame(0,true);});neutral(await cue());await capture('neutral-empty-range');
 evidence.range=await page.evaluate(()=>{const g=__dw.game,p=g.player;__reticlePad.buttons[7]={pressed:true,touched:true,value:.8};g.frame(1/120,false);for(let i=0;i<240&&p.skyLance.state==='projectile';i++)g.frame(1/120,false);__reticlePad.buttons[7]={pressed:false,touched:false,value:0};return {rope:!!p.skyLance.rope,anchor:p.skyLance.anchorId,state:p.skyLance.state,reason:p.skyLance.reason};});assert.equal(evidence.range.rope,false);assert.equal(evidence.range.anchor,null);assert.equal(evidence.range.state,'spent');
 await readyPose(45);
 evidence.swing=await page.evaluate(()=>{
  const g=__dw.game,p=g.player,v=g.skyLanceVisuals,update=v.updateReticle,w=p.skyLance.world,sw=w.sweep;let reticleMs=0,updates=0,predicting=false,forecasts=0;
  v.updateReticle=function(...args){const t=performance.now();predicting=true;try{return update.apply(this,args);}finally{predicting=false;reticleMs+=performance.now()-t;updates++;}};w.sweep=function(...args){if(predicting)forecasts++;return sw.apply(this,args);};
  const sample=(n,held)=>{const rows=[];reticleMs=0;updates=0;const before=forecasts;__reticlePad.buttons[7]={pressed:held,touched:held,value:held?.8:0};for(let i=0;i<n;i++){__reticlePad.axes[2]=Math.sin(i/35)*.18;const t=performance.now();g.frame(1/120,false);rows.push(performance.now()-t);}rows.sort((a,b)=>a-b);return {samples:n,meanMs:rows.reduce((a,b)=>a+b,0)/n,p95Ms:rows[Math.floor(n*.95)],reticleMsPerUpdate:reticleMs/updates,forecasts:forecasts-before};};
  try{const feet=p.foot.position.clone(),velocity=p.foot.velocity.clone(),camera=g.camera.position.clone(),quaternion=g.camera.quaternion.clone(),ready=sample(120,false);p.foot.position.copy(feet);p.foot.velocity.copy(velocity);g.camera.position.copy(camera);g.camera.quaternion.copy(quaternion);__reticlePad.axes.fill(0);__reticlePad.buttons[7]={pressed:true,touched:true,value:.8};g.frame(1/120,false);for(let i=0;i<240&&p.skyLance.state==='projectile';i++)g.frame(1/120,false);if(!p.skyLance.rope)throw Error('Long actual cast failed: '+p.skyLance.reason);const length=p.skyLance.rope.length,hanging=sample(360,true);p.foot.velocity.set(8,0,4);const swinging=sample(480,true),retained=!!p.skyLance.rope;__reticlePad.buttons[7]={pressed:false,touched:false,value:0};g.frame(1/120,false);const released=sample(180,false);return {ready,length,hanging,swinging,retained,released,releasedRope:!!p.skyLance.rope};}
  finally{v.updateReticle=update;w.sweep=sw;__reticlePad.axes.fill(0);}
 });
 assert.equal(evidence.swing.retained,true);assert.equal(evidence.swing.releasedRope,false);assert.equal(evidence.swing.ready.forecasts,0);assert.equal(evidence.swing.swinging.forecasts,0);assert.ok(evidence.swing.ready.reticleMsPerUpdate<2.5);assert.ok(evidence.swing.swinging.p95Ms<20,'original sustained moving-camera swing CPU budget');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__dw.errors),[]);
 console.log('Neutral reticle, fresh casts and sustained swing passed:',JSON.stringify({alignment:evidence.alignment,casts:evidence.casts,newSolid:evidence.newSolid,range:evidence.range,swing:evidence.swing}));
}finally{fs.writeFileSync('/tmp/driftwing-windline-reticle-browser-check.json',JSON.stringify({metadata,evidence,errors},null,2));await browser.close();}
