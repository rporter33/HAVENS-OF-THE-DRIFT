// Focused prototype browser check. Existing Game + fixed-step loop; no alternate physics stack.
// node scripts/sky-lance-check.mjs [http://localhost:5175/]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5175/';
// Verified against the 75 m/s launcher: release after the low point, not the stale
// 140-tick fixture. Keep the real unpowered landing and camera assertions unchanged.
const PRACTICE_RELEASE_STEP = 180;
async function inputChecks(page,errors){
  await page.evaluate(() => {document.querySelector('#sky-lance-controls button').click();__dw.game.frame(1/120,false);});
  console.log('DOM reset complete');await page.keyboard.down('q');console.log('DOM Q down');
  let equipment = await page.evaluate(() => { __dw.game.frame(1 / 120, false); __dw.game.frame(1 / 120, false); return __dw.game.player.skyLance.state; });
  assert.equal(equipment, 'projectile', 'DOM Q throw');console.log('DOM throw passed');
  await page.keyboard.up('q');
  await page.evaluate(() => { for (let i=0;i<45;i++) __dw.game.frame(1/120,false); });
  equipment = await page.evaluate(() => { __dw.game.frame(1 / 120, false); return __dw.game.player.skyLance.state; });
  assert.equal(equipment, 'ready', 'DOM E recover');
  await page.keyboard.press('q');
  const quickTap = await page.evaluate(() => {const g=__dw.game;g.frame(1/120,false);const state=g.player.skyLance.state;for(let i=0;i<44;i++)g.frame(1/120,false);return state;});
  assert.equal(quickTap,'spent','between-frame DOM tap does not leave an unheld tether');console.log('DOM release/recovery/tap passed');
  const padCheck = await page.evaluate(() => {
    const g = __dw.game;
    const pad = { id: 'Sky Lance simulated standard controller', mapping: 'standard', connected: true, index: 0, timestamp: 0,
      axes: [0,0,0,0], buttons: Array.from({length:17}, () => ({pressed:false,touched:false,value:0})) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    g.frame(1 / 120, false);
    pad.buttons[7] = {pressed:true,touched:true,value:1}; g.frame(1 / 120, false); const thrown = g.player.skyLance.state;
    g.frame(1 / 120, false); const held = g.player.skyLance.state;
    pad.buttons[7] = {pressed:false,touched:false,value:0}; g.frame(1 / 120, false); const launched = g.player.skyLance.state;
    for (let i=0;i<44;i++) g.frame(1/120,false); const recovered = g.player.skyLance.state;
    g.pause(); const before = g.player.foot.position.clone(), age = g.player.skyLance.age;
    g.frame(.1, false); const paused = before.equals(g.player.foot.position) && age === g.player.skyLance.age;
    g.resume();
    const p=g.player;p.teleport(p.foot.position.clone().set(5000,1000,5000),0,'flying',30);g.frame(1/120,false);
    pad.buttons[3]={pressed:true,touched:true,value:1};for(let i=0;i<12;i++)g.frame(1/30,false);
    const saddleJump=p.mode;
    pad.buttons[0]={pressed:true,touched:true,value:1};g.frame(1/120,false);const controllerBoost=p.airBoost.remaining>0;
    pad.buttons[0]={pressed:false,touched:false,value:0};for(let i=0;i<15;i++)g.frame(1/30,false);
    const heldYNoCatch=p.mode==='traversing';pad.buttons[3]={pressed:false,touched:false,value:0};g.frame(1/120,false);
    pad.buttons[3]={pressed:true,touched:true,value:1};for(let i=0;i<12;i++)g.frame(1/30,false);const controllerRescue=p.mode;
    for(let i=0;i<25;i++)g.frame(1/30,false);const controllerRemount=p.mode;
    pad.buttons[3]={pressed:false,touched:false,value:0};g.frame(1/120,false);
    document.querySelector('#sky-lance-controls button').click();const island=g.world.terrain.islands[0],x=island.def.x+island.def.radius*.35,z=island.def.z;
    p.foot.position.set(x,island.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);g.frame(1/120,false);g.cameraRig.snap(p);
    pad.axes[3]=-1;for(let i=0;i<120;i++)g.frame(1/120,false);pad.axes[3]=0;
    pad.buttons[7]={pressed:true,touched:true,value:1};g.frame(1/120,false);for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)g.frame(1/120,false);
    if(!p.skyLance.rope)throw Error('Controller underside attachment failed: '+p.skyLance.reason);const oldLength=p.skyLance.rope.length;
    pad.buttons[0]={pressed:true,touched:true,value:1};g.frame(1/120,false);const controllerPull=p.skyLance.pullTime>0;
    for(let i=0;i<60;i++)g.frame(1/120,false);const heldANoRepeat=p.skyLance.pullTime===0,reeled=p.skyLance.rope.length<oldLength,boostUnspent=p.airBoost.cooldown===0;
    pad.buttons[0]={pressed:false,touched:false,value:0};pad.buttons[7]={pressed:false,touched:false,value:0};g.frame(1/120,false);const controllerRelease=!p.skyLance.rope;
    delete navigator.getGamepads;
    return { thrown, held, launched, recovered, paused, saddleJump,controllerBoost,heldYNoCatch,controllerRescue,controllerRemount,controllerPull,heldANoRepeat,reeled,boostUnspent,controllerRelease };
  });
  assert.equal(padCheck.thrown, 'projectile'); assert.equal(padCheck.held, 'projectile'); assert.equal(padCheck.launched, 'spent');
  assert.equal(padCheck.recovered, 'ready'); assert.equal(padCheck.paused, true);
  assert.equal(padCheck.saddleJump,'traversing');assert.equal(padCheck.controllerBoost,true);assert.equal(padCheck.heldYNoCatch,true);assert.equal(padCheck.controllerRescue,'falling');assert.equal(padCheck.controllerRemount,'flying');
  for(const key of ['controllerPull','heldANoRepeat','reeled','boostUnspent','controllerRelease'])assert.equal(padCheck[key],true,key);
  console.log('Keyboard/controller/pause:',JSON.stringify(padCheck));
  assert.deepEqual(errors, []);
  return {padCheck,quickTap};
}
async function toggleChecks(page){
  await page.bringToFront();
  await page.evaluate(() => {__dw.game.pause();__dw.game.frame(0,true);});
  const toggleDom = await page.evaluate(() => {const e=document.querySelector('[data-toggle]');const r=e.getBoundingClientRect();return {visibility:getComputedStyle(e).visibility,display:getComputedStyle(e).display,width:r.width,height:r.height,panel:getComputedStyle(document.querySelector('#sky-lance-controls')).visibility};});
  console.log('Toggle DOM:',JSON.stringify(toggleDom));
  await page.locator('[data-toggle]').check({timeout:30000});
  const toggleCheck = await page.evaluate(() => {
    const g=__dw.game,p=g.player,l=p.skyLance;g.resume();
    document.querySelector('#sky-lance-controls button').click();
    const tick=(pressed={})=>{const aim=p.foot.position.clone().set(0,430,-66).sub(p.foot.position.clone().add({x:0,y:1,z:0})).normalize();g.input.setScripted({pressed,aim});g.frame(1/120,false);g.input.setScripted(null);};
    tick();tick({lance:true});for(let i=0;i<180&&!l.rope;i++)tick();
    tick({lanceRelease:true});const retained=!!l.rope;tick({lance:true});
    return {mode:p.lanceInteraction,retained,detached:!l.rope};
  });
  assert.deepEqual(toggleCheck,{mode:'toggle',retained:true,detached:true});
  return toggleCheck;
}
async function controlChecks(page,errors) {
  const air=await page.evaluate(()=>{
    const g=__dw.game,p=g.player;
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    document.querySelector('#sky-lance-controls button').click();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();
    p.foot.velocity.set(0,-13,18);g.cameraRig.snap(p);tick();const yaw=g.cameraRig.yaw;
    for(let i=0;i<120;i++)tick({foot:{moveX:1}});
    const turn={velocity:p.foot.velocity.toArray(),cameraDrift:Math.abs(Math.atan2(Math.sin(g.cameraRig.yaw-yaw),Math.cos(g.cameraRig.yaw-yaw)))};
    for(let i=0;i<120;i++)tick({lookActive:true,lookIsRate:true,lookX:1,foot:{moveY:1}});
    const manualOrbit=Math.abs(Math.atan2(Math.sin(g.cameraRig.yaw-yaw),Math.cos(g.cameraRig.yaw-yaw)));
    document.querySelector('#sky-lance-controls button').click();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();p.foot.velocity.set(0,-18,0);
    const height=p.foot.position.y;tick({pressed:{jump:true},aim:p.foot.position.clone().set(0,-1,1).normalize()});
    const launch=p.foot.velocity.toArray();let gain=0;
    for(let i=0;i<180;i++){tick();gain=Math.max(gain,p.foot.position.y-height);}
    tick({pressed:{jump:true}});
    const secondBoost=p.airBoost.remaining,clock=p.airBoost.cooldown;
    g.pause();g.frame(.1,false);const paused=p.airBoost.cooldown===clock;g.resume();
    while(p.airBoost.cooldown>1/120)tick();tick();tick({pressed:{jump:true}});
    const recharged={cooldown:p.airBoost.cooldown,vertical:p.foot.velocity.y,remaining:p.airBoost.remaining};
    return {turn,manualOrbit,launch,gain,secondBoost,paused,recharged,mode:p.mode};
  });
  console.log('Air evidence:',JSON.stringify(air));
  assert.ok(air.turn.velocity[0]<-15,'responsive camera-relative turn');assert.ok(Math.abs(air.turn.velocity[2])<3,'turn arrests old direction');
  assert.ok(air.turn.cameraDrift<1e-8,'no automatic camera steering feedback');assert.ok(air.manualOrbit>.8,'deliberate manual orbit');
  assert.ok(air.launch[1]>11.8,'falling dash launches upwards immediately');assert.ok(air.gain>3.5&&air.gain<4.1,'bounded repeatable upward jump');assert.equal(air.secondBoost,0);assert.equal(air.paused,true);assert.equal(air.recharged.cooldown,1.75);assert.ok(air.recharged.vertical>11.8);assert.ok(air.recharged.remaining>0);
  // The former harness-directed cue accepted this view even though the
  // compensated projectile meets an earlier ledge away from the centre ray.
  // Preserve that obstruction case, then explicitly look toward a clear face.
  const obstructedUnderside=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,s=g.world.terrain.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    document.querySelector('#sky-lance-controls button').click();p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    tick();tick();g.cameraRig.snap(p);tick({lookActive:true,lookIsRate:false,lookY:-10});
    g.skyLanceVisuals.nextPreview=0;g.frame(0,false);
    const el=document.querySelector('#sky-lance-reticle'),target=g.skyLanceVisuals.target,direction=g.camera.getWorldDirection(p.foot.position.clone()),relative=target.point.clone().sub(g.camera.position);
    const offRay=relative.addScaledVector(direction,-relative.dot(direction)).length();
    return {state:el.dataset.target,valid:el.classList.contains('is-valid'),target,offRay,camera:g.camera.position.toArray(),position:p.foot.position.toArray(),direction:direction.toArray()};
  });
  console.log('Obstructed underside diagnostics:',JSON.stringify(obstructedUnderside));
  assert.equal(obstructedUnderside.state,'blocked','earlier ledge cannot inherit centre-ray green');
  assert.equal(obstructedUnderside.valid,false);assert.ok(obstructedUnderside.offRay>.16);
  // Use an actual camera aim toward the real analytic island underside.
  const undersideAim=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,s=g.world.terrain.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    const y=s.bottomHeight(x,z);document.querySelector('#sky-lance-controls button').click();p.foot.position.set(x,y-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    tick();tick();g.cameraRig.snap(p);tick({lookActive:true,lookIsRate:false,lookX:g.cameraRig.yaw+Math.PI/2,lookY:-10});
    return {island:s.def.id,position:p.foot.position.toArray(),camera:g.camera.position.toArray(),direction:g.camera.getWorldDirection(p.foot.position.clone()).toArray()};
  });
  await page.waitForTimeout(150);
  const range=await page.evaluate(()=>{const g=__dw.game;g.frame(0,false);const el=document.querySelector('#sky-lance-reticle'),times=[];for(let i=0;i<10;i++){g.skyLanceVisuals.nextPreview=0;const start=performance.now();g.skyLanceVisuals.updateReticle(g.camera,g.player.foot.position,g.player.foot.velocity,g.player.skyLance);times.push(performance.now()-start);}return {state:el.dataset.target,label:el.querySelector('[data-aim-status]').textContent,target:g.skyLanceVisuals.target,previewCPU:{meanMs:times.reduce((a,b)=>a+b,0)/times.length,maxMs:Math.max(...times),samples:times.length}};});
  console.log('Clear underside diagnostics:',JSON.stringify({undersideAim,range}));
  assert.equal(range.state,'reachable','actual-trajectory underside range indicator');assert.match(range.label,/READY/);
  const attachment=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    tick({pressed:{lance:true},lanceHeld:true});for(let i=0;i<180&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true});
    const first={id:p.skyLance.anchorId,position:p.skyLance.position.toArray(),state:p.skyLance.state,reason:p.skyLance.reason};
    for(let i=0;i<120;i++)tick({lanceHeld:true,callHeld:true});
    return {first,retained:!!p.skyLance.rope,mode:p.mode,rangeState:document.querySelector('#sky-lance-reticle').dataset.target};
  });
  assert.equal(attachment.first.id,`rock-island-${undersideAim.island}`);assert.equal(attachment.retained,true);assert.equal(attachment.mode,'traversing');assert.equal(attachment.rangeState,'attached');
  const wall=await page.evaluate(()=>{
    const g=__dw.game,p=g.player;document.querySelector('#sky-lance-controls button').click();p.foot.position.set(0,410,-80);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};tick();
    const aim=p.foot.position.clone().set(4,416,-64).sub(p.foot.position.clone().add({x:0,y:1,z:0})).normalize();
    tick({pressed:{lance:true},lanceHeld:true,aim});for(let i=0;i<180&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true,aim});
    return {anchor:p.skyLance.anchorId,state:p.skyLance.state,position:p.skyLance.position.toArray(),reason:p.skyLance.reason};
  });
  assert.match(wall.anchor,/^solid-/);assert.equal(wall.state,'anchored');
  await page.evaluate(()=>{const g=__dw.game,p=g.player;document.querySelector('#sky-lance-controls button').click();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,0,0);g.cameraRig.snap(p);g.frame(0,false);});
  await page.waitForTimeout(150);
  const emptyRange=await page.evaluate(()=>{__dw.game.frame(0,false);const el=document.querySelector('#sky-lance-reticle');return {state:el.dataset.target,label:el.querySelector('[data-aim-status]').textContent};});
  assert.equal(emptyRange.state,'out-of-range');assert.match(emptyRange.label,/NO SURFACE/);assert.deepEqual(errors,[]);
  const result={air,obstructedUnderside,undersideAim,range,attachment,wall,emptyRange};
  fs.writeFileSync('/tmp/driftwing-motion-control-browser-check.json',JSON.stringify(result,null,2));console.log('Air control / upward boost / solid-surface range:',JSON.stringify(result));
}
async function motionChecks(page,errors) {
  const results=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,t=g.world.terrain;
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    const reset=()=>document.querySelector('#sky-lance-controls button').click();
    reset();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,-5,0);tick();tick({pressed:{jump:true}});
    const hud=document.querySelector('#windline-boost-hud'), cooldown={clock:p.airBoost.cooldown,state:hud.dataset.state,text:hud.querySelector('[data-boost-text]').textContent,fill:hud.querySelector('[data-boost-fill]').style.width,color:getComputedStyle(hud).color};
    for(let i=0;i<209;i++)tick();const before=p.airBoost.available;tick();const ready={available:p.airBoost.available,state:hud.dataset.state,text:hud.querySelector('[data-boost-text]').textContent,fill:hud.querySelector('[data-boost-fill]').style.width};
    g.pause();g.frame(0,false);const pausedHidden=hud.hidden;g.resume();
    const s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;reset();p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();
    g.cameraRig.snap(p);tick({lookActive:true,lookIsRate:false,lookY:-10});const upward=g.camera.getWorldDirection(p.foot.position.clone()).toArray();
    const aim=p.foot.position.clone().set(0,1,0);tick({pressed:{lance:true},lanceHeld:true,aim});
    for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true,aim});
    const start={position:p.foot.position.toArray(),length:p.skyLance.rope.length};
    tick({pressed:{jump:true},lanceHeld:true});for(let i=0;i<35;i++)tick({lanceHeld:true});
    const pull={position:p.foot.position.toArray(),length:p.skyLance.rope?.length,velocity:p.foot.velocity.toArray(),boostCooldown:p.airBoost.cooldown,hud:hud.querySelector('[data-boost-text]').textContent};
    const release=p.foot.velocity.clone();p.skyLance.detach();const momentumPreserved=release.equals(p.foot.velocity);tick();
    reset();p.teleport(p.foot.position.clone().set(0,470,-90),0,'flying',30);tick();for(let i=0;i<48;i++)tick({callHeld:true});
    p.foot.position.set(0,420,-93);p.foot.velocity.set(0,-1,0);tick();const groundedMode=p.mode;
    const dragon=p.model.state.position.clone();for(let i=0;i<48;i++)tick({callHeld:true});
    const recalling={state:p.companion.state,airborne:p.wyvernPose.airborne,travel:p.model.state.position.distanceTo(dragon),mounted:p.riderMounted};
    for(let i=0;i<720;i++)tick();const arrived={mode:p.mode,companion:p.companion.state,canMount:p.canMount};
    const poses=[];
    for(const tilt of [1,-1]){
      reset();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,-10,12);tick();for(let i=0;i<240;i++)tick({foot:{moveY:tilt}});
      const bone=name=>g.rider.group.getObjectByName(name).getWorldPosition(p.foot.position.clone());
      poses.push({tilt,velocity:p.foot.velocity.toArray(),headFromHips:bone('head').sub(bone('hips')).toArray(),handSpan:bone('handL').distanceTo(bone('handR'))});
    }
    return {cooldown,before,ready,pausedHidden,upward,start,pull,momentumPreserved,groundedMode,recalling,arrived,poses};
  });
  assert.equal(results.cooldown.clock,1.75);assert.equal(results.cooldown.state,'cooldown');assert.equal(results.cooldown.fill,'0%');assert.equal(results.before,false);
  assert.equal(results.ready.available,true);assert.equal(results.ready.state,'ready');assert.equal(results.ready.fill,'100%');assert.equal(results.pausedHidden,true);
  assert.ok(results.upward[1]>Math.sin(88*Math.PI/180));assert.ok(results.upward[2]>0,'no pole reversal');
  assert.ok(results.pull.length<results.start.length-1,'actual inward reeling');assert.ok(results.pull.velocity[1]>5,'upward momentum');assert.equal(results.pull.boostCooldown,0);assert.equal(results.momentumPreserved,true);
  assert.equal(results.groundedMode,'onFoot');assert.equal(results.recalling.state,'hop');assert.equal(results.recalling.airborne,true);assert.equal(results.recalling.mounted,false);assert.ok(results.recalling.travel<18);assert.equal(results.arrived.canMount,true);
  assert.ok(results.poses[0].headFromHips[1]<-.4);assert.ok(results.poses[0].velocity[2]>10,'a full dive retains forward motion');assert.ok(Math.abs(results.poses[1].velocity[2])<.1,'back brakes');assert.ok(Math.abs(results.poses[1].headFromHips[1])<.25);assert.ok(results.poses[1].handSpan>1.3);
  assert.deepEqual(errors,[]);fs.writeFileSync('/tmp/driftwing-motion-browser-check.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}
async function spinChecks(page,errors) {
  const result=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,t=g.world.terrain,s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    const trials=[];
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    for(const speed of [0,8,18,26]){
      document.querySelector('#sky-lance-controls button').click();p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();
      const aim=p.foot.position.clone().set(0,1,0);tick({pressed:{lance:true},lanceHeld:true,aim});
      for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true,aim});
      const start=p.foot.position.toArray(),anchor=p.skyLance.rope?.anchor.toArray();
      p.foot.velocity.set(speed,0,speed*.5);let steps=0;
      while(p.skyLance.rope&&steps<720){tick({lanceHeld:true,lookActive:true,lookIsRate:true,lookX:1});steps++;}
      trials.push({speed,start,anchor,steps,retained:!!p.skyLance.rope,reason:p.skyLance.reason,position:p.foot.position.toArray(),velocity:p.foot.velocity.toArray()});
    }
    return {trials};
  });
  assert.deepEqual(errors,[]);
  if(process.argv.includes('--expect-retained'))assert.ok(result.trials.every(t=>t.retained),'turning swing retains tether');
  const label=process.argv.find(x=>x.startsWith('--evidence='))?.split('=')[1]??'after';
  fs.writeFileSync(`/tmp/driftwing-spin-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
async function performanceChecks(page,errors) {
  const result=await page.evaluate(longLine=>{
    const g=__dw.game,p=g.player,t=g.world.terrain,s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    document.querySelector('#sky-lance-controls button').click();p.foot.position.set(x,s.bottomHeight(x,z)-(longLine?55:18),z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};tick();
    const aim=p.foot.position.clone().set(0,1,0);tick({pressed:{lance:true},lanceHeld:true,aim});
    for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true,aim});
    if(!p.skyLance.rope)throw new Error('Underside performance setup failed: '+p.skyLance.reason);
    let queries=0;const original=t.rockContact;t.rockContact=function(...args){queries++;return original.apply(this,args);};
    const harness=p.foot.position.clone().add({x:0,y:1,z:0});
    const sample=(fn,count)=>{queries=0;const times=[];for(let i=0;i<count;i++){const start=performance.now();fn();times.push(performance.now()-start);}return {meanMs:times.reduce((a,b)=>a+b,0)/count,maxMs:Math.max(...times),rockQueries:queries,queriesPerCall:queries/count,samples:count};};
    const validation=sample(()=>p.skyLance.validate(harness),10);
    const attached=sample(()=>tick({lanceHeld:true}),60);
    const anchor=p.skyLance.rope.anchor.clone(),angled=harness.clone().add({x:8,y:-3,z:5});
    const slanted=sample(()=>p.skyLance.world.sweep(angled,anchor,.02),10);
    p.foot.velocity.set(8,0,4);const swinging=sample(()=>tick({lanceHeld:true}),60);const retained=!!p.skyLance.rope;
    tick({pressed:{lanceRelease:true}});const released=sample(()=>tick(),60);
    t.rockContact=original;return {validation,attached,slanted,swinging,released,retained,errors:__dw.errors};
  },process.argv.includes('--long-line'));
  assert.equal(result.retained,true);assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
  const label=process.argv.find(x=>x.startsWith('--evidence='))?.split('=')[1]??'after';
  fs.writeFileSync(`/tmp/driftwing-tether-performance-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
async function companionChecks(page,errors) {
  const start=await page.evaluate(()=>{
    const g=__dw.game,p=g.player,t=g.world.terrain;document.querySelector('#sky-lance-controls button').click();
    const origin=p.model.state.position.clone();const islands=t.islands.filter(s=>s.topHeight(s.def.x,s.def.z)<origin.y-30).sort((a,b)=>Math.hypot(a.def.x-origin.x,a.def.z-origin.z)-Math.hypot(b.def.x-origin.x,b.def.z-origin.z));
    const s=islands[0],x=s.def.x,z=s.def.z,y=s.topHeight(x,z);p.foot.position.set(x,y+.01,z);p.foot.velocity.set(0,-1,0);p.foot.grounded=false;p.companion.called=true;
    globalThis.__companionTick=()=>{g.input.setScripted({});g.frame(1/120,false);g.input.setScripted(null);};
    for(let i=0;i<30&&p.companion.state!=='hop';i++)__companionTick();
    if(p.companion.state!=='hop')throw Error('Lower island hop not entered');
    return {island:s.def.id,origin:origin.toArray(),rider:p.foot.position.toArray(),duration:p.companion.duration};
  });
  const frames=[];const label=process.argv.find(x=>x.startsWith('--evidence='))?.split('=')[1]??'after';
  const selectedPhase=process.argv.find(x=>x.startsWith('--pose-phase='))?.split('=')[1];
  for(const phase of selectedPhase?[Number(selectedPhase)]:[.5,.9,.98,1]){
    const info=await page.evaluate(phase=>{
      const g=__dw.game,p=g.player,c=p.companion;
      while(c.state==='hop'&&c.stateTime/c.duration<phase)__companionTick();
      const up=p.foot.position.clone().set(0,1,0).applyQuaternion(p.wyvernPose.orientation);
      const point=p.model.state.position.clone();g.cameraRig.setOverride({position:point.clone().add({x:15,y:3,z:-18}),target:point.clone()});g.frame(0,true);
      const rig=g.wyvern.rig,anim=g.wyvern.animator,local=idx=>anim.boneModel(idx,p.foot.position.clone()).toArray();
      return {phase,state:c.state,airborne:p.wyvernPose.airborne,groundY:p.wyvernPose.groundY,position:point.toArray(),up:up.toArray(),airW:anim.airW,legAirW:anim.legAirW,groundRef:anim.groundRef,height:anim.frame.height,feet:rig.idx.legs.map(l=>({hip:local(l.thigh),ankle:local(l.meta)}))};
    },phase);
    frames.push(info);fs.writeFileSync(`/tmp/driftwing-companion-${label}.json`,JSON.stringify({start,frames},null,2));
    await page.screenshot({path:`/tmp/driftwing-companion-${label}-${phase}.png`,timeout:60000});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(`/tmp/driftwing-companion-${label}.json`,JSON.stringify({start,frames},null,2));console.log(JSON.stringify({start,frames},null,2));
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('?view=skyLance&play=1&manual=1&quality=low&weather=clear&tod=.5', base).href);
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 180000 });
  if(process.argv.includes('--motion-only')){
    await motionChecks(page,errors);
  }else if(process.argv.includes('--spin-only')){
    await spinChecks(page,errors);
  }else if(process.argv.includes('--companion-only')){
    await companionChecks(page,errors);
  }else if(process.argv.includes('--performance-only')){
    await performanceChecks(page,errors);
  }else if(process.argv.includes('--control-only')){
    await controlChecks(page,errors);
  }else if(process.argv.includes('--toggle-only')){
    const evidence=await toggleChecks(page);assert.deepEqual(errors,[]);fs.writeFileSync('/tmp/driftwing-fidelity-toggle-browser-check.json',JSON.stringify(evidence,null,2));console.log('Isolated accessibility toggle passed.');
  }else if(process.argv.includes('--input-only')){
    const evidence=await inputChecks(page,errors);fs.writeFileSync('/tmp/driftwing-motion-input-browser-check.json',JSON.stringify(evidence,null,2));console.log('Isolated DOM/controller checks passed.');
  }else{
  const fidelity = await page.evaluate(() => {
    const g=__dw.game,p=g.player;
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    const reset=()=>document.querySelector('#sky-lance-controls button').click();
    reset();tick();tick({pressed:{jump:true}});let normalJump=true;
    for(let i=0;i<90;i++){tick();normalJump&&=p.mode==='onFoot'&&p.riderPose.freefallTilt===undefined&&p.airBoost.available;}
    const landed=p.foot.grounded;
    // A lower-platform cast using the real orbit camera direction, not a scripted aim vector.
    reset();p.teleport(p.foot.position.clone().set(0,400,-46),Math.PI,'onFoot');g.cameraRig.snap(p);
    for(let i=0;i<5;i++)tick();
    tick({lookActive:true,lookIsRate:false,lookY:-1.08});
    const upwardDirection=g.camera.getWorldDirection(p.foot.position.clone());
    tick({pressed:{lance:true},lanceHeld:true});
    for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true});
    const upwardCast={direction:upwardDirection.toArray(),anchor:p.skyLance.anchorId,state:p.skyLance.state,reason:p.skyLance.reason};
    reset();p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(0,-5,10);
    for(let i=0;i<90;i++)tick({foot:{moveX:.8,moveY:.3}});
    const steering={vx:p.foot.velocity.x,roll:g.rider.group.getObjectByName('hips').rotation.z};
    const before=p.foot.velocity.clone();tick({pressed:{jump:true}});
    const boost={remaining:p.airBoost.remaining,available:p.airBoost.available,velocity:p.foot.velocity.toArray(),plumes:0};
    g.skyLanceVisuals.group.traverse(o=>{if(o.name==='windline-boost-plume'&&o.visible)boost.plumes++;});
    for(let i=0;i<60;i++)tick();tick({pressed:{jump:true}});boost.secondRemaining=p.airBoost.remaining;
    reset();tick();boost.recharged=p.airBoost.available;
    p.teleport(p.foot.position.clone().set(5000,1000,5000),0,'flying',30);g.cameraRig.snap(p);tick();
    for(let i=0;i<48;i++)tick({callHeld:true});const ejected={mode:p.mode,mounted:p.riderPose.mounted};
    const dragon=p.model.state.position.clone();for(let i=0;i<120;i++)tick({callHeld:true});
    const heldNoCatch=p.mode==='traversing',glide=p.model.state.position.distanceTo(dragon);
    tick();for(let i=0;i<48;i++)tick({callHeld:true});const deliberate=p.mode;
    for(let i=0;i<100;i++)tick({callHeld:true});const remounted=p.mode;
    for(let i=0;i<80;i++)tick({callHeld:true});const heldNoEject=p.mode==='flying';
    return {normalJump,landed,upwardCast,steering,boost,ejected,heldNoCatch,glide,deliberate,remounted,heldNoEject,errors:__dw.errors};
  });
  console.log('Fidelity:',JSON.stringify(fidelity));
  assert.equal(fidelity.normalJump,true);assert.equal(fidelity.landed,true);
  assert.ok(fidelity.upwardCast.direction[1]>.65,'camera aims higher than the previous limit');
  assert.equal(fidelity.upwardCast.anchor,'test-anchor-0','higher anchor reachable from the lower platform using actual camera aim');
  assert.ok(fidelity.steering.vx < -1);assert.ok(fidelity.steering.roll < -.1);
  assert.equal(fidelity.boost.available,false);assert.equal(fidelity.boost.plumes,2);assert.ok(fidelity.boost.remaining>0);
  assert.equal(fidelity.boost.secondRemaining,0);assert.equal(fidelity.boost.recharged,true);
  assert.deepEqual(fidelity.ejected,{mode:'traversing',mounted:false});assert.equal(fidelity.heldNoCatch,true);assert.ok(fidelity.glide>1);
  assert.equal(fidelity.deliberate,'falling');assert.equal(fidelity.remounted,'flying');assert.equal(fidelity.heldNoEject,true);
  assert.deepEqual(fidelity.errors,[]);assert.deepEqual(errors,[]);
  if(process.argv.includes('--fidelity-only')){
    fs.writeFileSync('/tmp/driftwing-fidelity-extra-browser-check.json',JSON.stringify(fidelity,null,2));
    console.log('Traversal fidelity production-preview checks passed (software WebGL).');
  } else {
  // Isolate the original route/input suite from the distant rescue fixture.
  await page.reload();await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:180000});
  const results = await page.evaluate(() => {
    const g = __dw.game, p = g.player, l = p.skyLance;
    const snapshots = [];
    const state = label => snapshots.push({ label, mode: p.mode, equipment: l.state, phase: p.traversalPhase,
      position: p.foot.position.toArray(), velocity: p.foot.velocity.toArray(), rope: l.rope?.length ?? null,
      distance: l.rope ? p.foot.position.clone().add({ x: 0, y: 1, z: 0 }).distanceTo(l.rope.anchor) : null, reason: l.reason });
    const frame = (pressed = {}, foot = {}, held = {}) => {
      const aim = p.foot.position.clone().set(0, 430, -66).sub(p.foot.position.clone().add({ x: 0, y: 1, z: 0 })).normalize();
      g.input.setScripted({ pressed, foot, aim, ...held }); g.frame(1 / 120, false); g.input.setScripted(null);
    };
    document.querySelector('#sky-lance-controls button').click();frame();state('spawn');
    for (let i = 0; i < 120; i++) frame({}, { moveY: 1, sprint: true });
    frame({ jump: true }, { moveY: 1, sprint: true });
    frame({ lance: true }, { moveY: 1, sprint: true });
    let i = 0; for (; i < 180 && !l.rope; i++) frame({}, { moveY: 1, sprint: true });
    state('attachment');
    let maxError = 0;
    for (let j = 0; j < 240 && l.rope; j++) {
      frame({}, { moveY: 1 });
      if (l.rope) maxError = Math.max(maxError, p.foot.position.clone().add({ x: 0, y: 1, z: 0 }).distanceTo(l.rope.anchor) - l.rope.length);
    }
    state('swing');
    const velocity = p.foot.velocity.clone(), expected = velocity.clone();
    // Release carries the current velocity; only the next fixed step's documented gravity/drag acts.
    const tilt = p.freefallTilt * Math.exp(-5 / 120);
    const open = [[0,0],[.65,0],[-.65,0],[0,.65],[0,-.65]].every(([x,z])=>{const ground=g.world.terrain.groundAt(p.foot.position.x+x,p.foot.position.z+z,p.foot.position.y+.1);return !ground||p.foot.position.y-ground.y>=4;});
    const drag = open ? .03 + (.003 - .03) * (tilt + 1) * .5 : 0;
    const terminal = 13 + tilt * (tilt < 0 ? 4 : 5);
    for (let j = 0; j < 4; j++) {
      expected.y -= 18 / 480;
      const horizontal = 1 / (1 + drag * Math.hypot(expected.x, expected.z) / 480);
      expected.x *= horizontal; expected.z *= horizontal;
      if(open){if(expected.y<0)expected.y *= 2 / (1 + Math.sqrt(1 + 4 * (18 / terminal ** 2) * Math.abs(expected.y) / 480));else expected.y /= 1+.003*Math.abs(expected.y)/480;}
    }
    frame({ lanceRelease: true }); state('release');
    const releasePhysicsError = p.foot.velocity.distanceTo(expected);
    const releaseHorizontalError = Math.hypot(p.foot.velocity.x - velocity.x, p.foot.velocity.z - velocity.z);
    for (let j = 0; j < 44; j++) frame(); state('recover');
    for (let j = 0; j < 300; j++) frame(); state('restored');
    g.input.setScripted(null); __dw.render();
    return { snapshots, maxError, releaseHorizontalError, releasePhysicsError, errors: __dw.errors, renderer: __dw.stats(), attachSteps: i };
  });
  console.log(JSON.stringify(results, null, 2));
  assert.equal(results.snapshots[1].equipment, 'anchored', 'actual attachment');
  assert.equal(results.snapshots[2].equipment, 'anchored', 'swing remains attached');
  assert.equal(results.snapshots[3].phase, 'released');
  assert.equal(results.snapshots[4].equipment, 'ready');
  assert.ok(results.maxError <= .020001, 'rope bound'); assert.ok(results.releasePhysicsError < 1e-8, 'release preserves momentum before the next gravity/drag step');
  assert.deepEqual(errors, []); assert.deepEqual(results.errors, []);
  if(process.argv.includes('--route-only')){
    const practice=await page.evaluate(releaseStep=>{
      const g=__dw.game,p=g.player,l=p.skyLance;document.querySelector('#sky-lance-controls button').click();
      let maxCameraStep=0,maxCameraRoll=0,pillarSpeed=0;const previous=g.camera.quaternion.clone();
      const tick=(pressed={},foot={})=>{const aim=p.foot.position.clone().set(0,430,-66).sub(p.foot.position.clone().add({x:0,y:1,z:0})).normalize();g.input.setScripted({pressed,foot,aim});g.frame(1/120,false);g.input.setScripted(null);
        if(p.mode==='traversing'){maxCameraStep=Math.max(maxCameraStep,previous.angleTo(g.camera.quaternion));maxCameraRoll=Math.max(maxCameraRoll,Math.abs(p.foot.position.clone().set(1,0,0).applyQuaternion(g.camera.quaternion).y));if(Math.abs(p.foot.position.z+64)<.2)pillarSpeed=Math.max(pillarSpeed,p.foot.velocity.length());}previous.copy(g.camera.quaternion);};
      tick();for(let i=0;i<120;i++)tick({},{moveY:1,sprint:true});tick({jump:true},{moveY:1,sprint:true});tick({lance:true});
      for(let i=0;i<180&&!l.rope;i++)tick();if(!l.rope)throw Error('No practice attachment');
      for(let i=0;i<releaseStep;i++)tick();
      if(!l.rope)throw Error('Practice tether lost before release');tick({lanceRelease:true});let landed=false;
      for(let i=0;i<360;i++){tick();if(p.foot.grounded&&p.foot.position.z>-55&&p.foot.position.z<-37&&Math.abs(p.foot.position.y-400)<.02){landed=true;break;}}
      return {landed,position:p.foot.position.toArray(),maxCameraStep,maxCameraRoll,pillarSpeed};
    }, PRACTICE_RELEASE_STEP);
    assert.equal(practice.landed,true);assert.ok(practice.pillarSpeed>15);assert.ok(practice.maxCameraRoll<.001);assert.ok(practice.maxCameraStep<.2);assert.deepEqual(errors,[]);
    fs.writeFileSync('/tmp/driftwing-fidelity-route-browser-check.json',JSON.stringify({fidelity,...results,practice},null,2));console.log('Isolated route passed:',JSON.stringify(practice));
  }else{
  const {padCheck,quickTap}=await inputChecks(page,errors);
  const cameraAim = await page.evaluate(() => {
    const g = __dw.game, p = g.player; document.querySelector('#sky-lance-controls button').click();
    const step = (pressed = {}, foot = {}, lookY = 0) => {
      g.input.setScripted({ pressed, foot, lookY, lookIsRate: false, lookActive: lookY !== 0 });
      g.frame(1 / 120, false); g.input.setScripted(null);
    };
    step(); step({}, {}, -.55);
    for (let i = 0; i < 120; i++) step({}, {moveY:1,sprint:true});
    step({jump:true}, {moveY:1,sprint:true}); step({lance:true}, {moveY:1,sprint:true});
    for (let i = 0; i < 180 && !p.skyLance.rope; i++) step({}, {moveY:1,sprint:true});
    return { equipment: p.skyLance.state, anchor: p.skyLance.anchorId, reason: p.skyLance.reason };
  });
  assert.equal(cameraAim.equipment, 'anchored', 'fixture reachable using the actual camera aim');
  console.log('Camera aim:',JSON.stringify(cameraAim));
  assert.deepEqual(errors, []);
  const freefallAndWindup = await page.evaluate(() => {
    const g = __dw.game, p = g.player, l = p.skyLance;
    const frame = (input = {}) => { g.input.setScripted(input); g.frame(1 / 120, false); g.input.setScripted(null); };
    document.querySelector('#sky-lance-controls button').click();
    for (let i = 0; i < 250; i++) frame({ foot: { moveY: 1, sprint: true } });
    const beforeCall = { mode: p.mode, vy: p.foot.velocity.y, companion: p.companion.state };
    for (let i = 0; i < 48; i++) frame({ callHeld: true });
    const called = p.mode;
    for (let i = 0; i < 100; i++) frame();
    const caught = p.mode;
    document.querySelector('#sky-lance-controls button').click();
    frame({ pressed: { lance: true }, lanceHeld: true });
    const immediate = { state: l.state, speed: l.velocity.length() };
    frame({ pressed: { lanceRelease: true } });
    for (let i = 0; i < 44; i++) frame();
    const automaticRecovery = l.state;
    frame({ pressed: { lance: true }, lanceHeld: true }); g.pause();
    frame({ lanceHeld: true }); g.resume();
    for (let i = 0; i < 60; i++) frame({lanceHeld:true});
    const pauseCancelled = l.state === 'ready' && !l.charging;
    const reticle = document.querySelector('#sky-lance-reticle');
    return { beforeCall, called, caught, immediate, automaticRecovery, pauseCancelled, reticle: { left: reticle.style.left, top: reticle.style.top } };
  });
  assert.equal(freefallAndWindup.beforeCall.mode, 'traversing', 'walking off stays independent');
  assert.notEqual(freefallAndWindup.beforeCall.companion, 'swoop');
  assert.equal(freefallAndWindup.called, 'falling'); assert.equal(freefallAndWindup.caught, 'flying');
  assert.equal(freefallAndWindup.immediate.state, 'projectile'); assert.ok(freefallAndWindup.immediate.speed > 41);
  assert.equal(freefallAndWindup.automaticRecovery, 'ready'); assert.equal(freefallAndWindup.pauseCancelled, true);
  assert.deepEqual(errors, []);
  const slowFall = await page.evaluate(() => {
    const g=__dw.game,p=g.player;
    document.querySelector('#sky-lance-controls button').click();
    p.foot.position.set(5000,1000,5000);p.foot.grounded=false;p.foot.velocity.set(8,0,0);
    for(let i=0;i<720;i++){g.input.setScripted({});g.frame(1/120,false);g.input.setScripted(null);}
    const seed=g.skyLanceVisuals.group.getObjectByName('windline-seed');
    return {mode:p.mode,vy:p.foot.velocity.y,tilt:p.riderPose.freefallTilt,equipment:p.riderPose.equipment,seedVisible:seed.visible};
  });
  assert.equal(slowFall.mode,'traversing');assert.ok(Math.abs(slowFall.vy+13)<.001,'neutral controlled fall reaches 13 m/s');
  assert.equal(slowFall.equipment,'bracer');assert.equal(slowFall.tilt,0);assert.equal(slowFall.seedVisible,false);
  console.log('Slow fall:',JSON.stringify(slowFall));
  const practice = await page.evaluate(lastReleaseStep => {
    const g=__dw.game,p=g.player,l=p.skyLance, attempts=[];
    let maxCameraStep=0,maxCameraRoll=0,pillarSpeed=0; const previousCamera=g.camera.quaternion.clone();
    const frame=(pressed={},foot={})=>{const aim=p.foot.position.clone().set(0,430,-66).sub(p.foot.position.clone().add({x:0,y:1,z:0})).normalize();g.input.setScripted({pressed,foot,aim});g.frame(1/120,false);g.input.setScripted(null);
      if(p.mode==='traversing') {
        maxCameraStep=Math.max(maxCameraStep,previousCamera.angleTo(g.camera.quaternion));
        maxCameraRoll=Math.max(maxCameraRoll,Math.abs(p.foot.position.clone().set(1,0,0).applyQuaternion(g.camera.quaternion).y));
        if(Math.abs(p.foot.position.z+64)<.2)pillarSpeed=Math.max(pillarSpeed,p.foot.velocity.length());
      }
      previousCamera.copy(g.camera.quaternion);
    };
    // Faster casting attaches earlier in the same unpowered swing. Sample the
    // rising arc too; landing remains a physical result, without pull or boost.
    for (const releaseStep of [20,40,60,80,100,120,140,160,lastReleaseStep,200,220,240]) {
      document.querySelector('#sky-lance-controls button').click();
      frame(); for(let i=0;i<120;i++)frame({},{moveY:1,sprint:true});
      frame({jump:true},{moveY:1,sprint:true});frame({lance:true});
      for(let i=0;i<180&&!l.rope;i++)frame();
      if(!l.rope)throw Error('Practice attachment failed');
      for(let i=0;i<releaseStep;i++)frame();
      if(!l.rope)throw Error('Practice tether lost before release');
      frame({lanceRelease:true});
      let landed=false;const releasePosition=p.foot.position.toArray();const velocity=p.foot.velocity.toArray();
      for(let i=0;i<360;i++){frame();if(p.foot.grounded&&p.foot.position.z>-55&&p.foot.position.z<-37&&Math.abs(p.foot.position.y-400)<.02){landed=true;break;}}
      attempts.push({releaseStep,landed,releasePosition,velocity,position:p.foot.position.toArray()});
      if(landed)break;
    }
    return {attempts,maxCameraStep,maxCameraRoll,pillarSpeed};
  }, PRACTICE_RELEASE_STEP);
  console.log('Practice route:',JSON.stringify(practice));
  assert.ok(practice.attempts.some(a=>a.landed),'unpowered route can land on the far platform');
  const toggleCheck=await toggleChecks(page);
  assert.ok(practice.pillarSpeed > 15, 'fast pass beside the matching pillar');
  assert.ok(practice.maxCameraRoll < .001, 'no automatic camera roll');
  assert.ok(practice.maxCameraStep < .2, 'no abrupt camera recenter during traversal');
  fs.writeFileSync('/tmp/driftwing-fidelity-browser-check.json', JSON.stringify({ ...results, padCheck, cameraAim, freefallAndWindup, practice, toggleCheck, quickTap, slowFall }, null, 2));
  console.log('Windline bracer browser loop passed (software WebGL; scripted keyboard-equivalent input).');
  }
  }
  }
} finally { await browser.close(); }
