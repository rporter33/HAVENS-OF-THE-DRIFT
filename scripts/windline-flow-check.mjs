// Approved controller-first flow and truthful HUD, through the normal production Game.
// Standard gamepad inputs are simulated; this does not certify physical hardware.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import {browserEvidence} from './browser-evidence.mjs';
const url=new URL(process.argv[2]??'http://127.0.0.1:5175/');url.search='?manual=1&quality=low';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],evidence={};
let metadata=null;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
fs.mkdirSync('shots/windline-flow',{recursive:true});
try {
 await page.goto(url.href);await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:180000});
 metadata=await browserEvidence(page,url);
 await page.evaluate(()=>{__dw.game.startGame();__dw.advance(.2);});
 // Real keyboard steering: forward carries momentum; back gradually brakes without reversal.
 await page.evaluate(()=>{
  const g=__dw.game,p=g.player;g.placeAtSpawn();p.foot.position.set(5000,900,5000);p.foot.grounded=false;p.foot.velocity.set(0,-5,18);p.foot.yaw=0;g.frame(1/120,false);g.cameraRig.snap(p);
 });
 await page.keyboard.down('w');
 evidence.keyboard=await page.evaluate(()=>{const g=__dw.game,p=g.player;for(let i=0;i<120;i++)g.frame(1/120,false);return {forward:p.foot.velocity.toArray()};});
 await page.keyboard.up('w');await page.keyboard.down('s');
 evidence.keyboard.brake=await page.evaluate(()=>{const g=__dw.game,p=g.player;let positive=true;for(let i=0;i<120;i++){g.frame(1/120,false);positive&&=p.foot.velocity.z>=0;}return {velocity:p.foot.velocity.toArray(),positive};});
 await page.keyboard.up('s');assert.ok(evidence.keyboard.forward[2]>15);assert.equal(evidence.keyboard.brake.positive,true);assert.ok(evidence.keyboard.brake.velocity[2]<1);
 // Real input polling + mapped pad edges, with LT/RT held through flight -> leap.
 evidence.leap=await page.evaluate(()=>{
  const g=__dw.game,p=g.player;
  const pad=window.__flowPad={id:'Windline flow simulated Xbox standard controller',mapping:'standard',connected:true,index:0,timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad.connected?[pad]:[]});
  window.__flowSet=(button,value)=>pad.buttons[button]={pressed:value>.5,touched:value>0,value};
  window.__flowTick=(n=1)=>{for(let i=0;i<n;i++)g.frame(1/120,false);};
  p.teleport(p.foot.position.clone().set(0,900,-90),0,'flying',30);__flowTick();__flowSet(6,.8);__flowSet(7,.8);__flowTick();
  const flight={flare:g.input.frame.flight.flare,flap:g.input.frame.flight.flap};__flowSet(3,1);__flowTick(48);
  const mode=p.mode;__flowTick(60);const held={mode:p.mode,boost:p.airBoost.remaining,equipment:p.skyLance.state};
  __flowSet(3,0);__flowSet(6,0);__flowSet(7,0);__flowTick();return {flight,mode,held};
 });
 assert.ok(evidence.leap.flight.flare>.7&&evidence.leap.flight.flap>.7);assert.equal(evidence.leap.mode,'traversing');assert.deepEqual(evidence.leap.held,{mode:'traversing',boost:0,equipment:'ready'});
 // Existing Roost underside, camera aim, solid attachment: no practice URL or added anchor.
 await page.evaluate(()=>{
  const g=__dw.game,p=g.player,s=g.world.terrain.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
  p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.velocity.set(0,0,0);__flowTick();g.cameraRig.snap(p);
  // The camera ray and harness path both need a clear view of the real underside.
  // The former straight-up view from the opposite bearing crossed a concave ridge.
  g.input.setScripted({lookActive:true,lookIsRate:false,lookX:g.cameraRig.yaw+Math.PI/2,lookY:-10});__flowTick();g.input.setScripted(null);__flowTick(60);
 });
 await page.waitForTimeout(80);
 evidence.anchorCue=await page.evaluate(()=>{const g=__dw.game;g.frame(0,true);const el=document.querySelector('#sky-lance-reticle');return {state:el.dataset.target,color:getComputedStyle(el).color,valid:el.classList.contains('is-valid'),target:g.skyLanceVisuals.target};});
 assert.equal(evidence.anchorCue.state,'aiming');assert.equal(evidence.anchorCue.color,'rgb(168, 221, 236)');assert.equal(evidence.anchorCue.valid,false);assert.equal(evidence.anchorCue.target,null);
 await page.screenshot({path:'shots/windline-flow/anchor-1280.png'});
 evidence.line=await page.evaluate(()=>{
  const g=__dw.game,p=g.player;__flowSet(7,.6);__flowTick();for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)__flowTick();
  if(!p.skyLance.rope)throw Error(`No world attachment: ${p.skyLance.reason}`);
  const rope=p.skyLance.rope;g.applySettings({...g.settings,showControlHints:false,reducedMotion:true});
  p.foot.position.copy(rope.anchor).add(p.foot.position.clone().set(0,-rope.length*.65-1,0));p.foot.velocity.set(0,0,0);__flowTick();
  const state=()=>document.querySelector('[data-line-state]').textContent;
  const slack=state();p.foot.position.copy(rope.anchor).add(p.foot.position.clone().set(0,-rope.length-1,0));p.foot.velocity.set(0,0,6);__flowTick();const taut=state();
  const energy=()=>.5*p.foot.velocity.lengthSq()+18*(p.foot.position.y+1-rope.anchor.y),initial=energy();let growth=0,previous=initial;
  __flowPad.axes[0]=.5;__flowPad.axes[2]=.5;const before=p.foot.velocity.clone();
  for(let i=0;i<24;i++){__flowTick();const next=energy();growth=Math.max(growth,next-previous);previous=next;}
  __flowPad.axes[0]=__flowPad.axes[2]=0;
  const swing={changed:p.foot.velocity.distanceTo(before),growth,roll:Math.abs(p.foot.position.clone().set(1,0,0).applyQuaternion(g.camera.quaternion).y)};
  for(const value of [.49,.3,.21,.6]){__flowSet(7,value);__flowTick();if(!p.skyLance.rope)throw Error('Trigger jitter released the line');}
  const length=rope.length;__flowSet(6,.6);__flowTick();const pull={state:state(),aria:document.querySelector('#windline-boost-hud').getAttribute('aria-label')};__flowTick(52);
  const heldPull={remaining:p.skyLance.pullTime,shortened:rope.length<length-1,cooldown:p.airBoost.cooldown};
  // Controlled obstruction presentation; physical caught-line retention is covered by Player tests.
  p.skyLance.reason='Line caught at edge';p.skyLance.pullTime=0;g.frame(0,false);
  const caught={state:state(),aria:document.querySelector('#windline-boost-hud').getAttribute('aria-label'),meterHidden:document.querySelector('#windline-boost-hud .dw-windline-meter').hidden};
  p.skyLance.reason='';g.frame(0,false);return {anchor:p.skyLance.anchorId,slack,taut,swing,pull,heldPull,caught,recallVisible:!document.querySelector('.dw-windline-call').hidden,hintsHidden:document.querySelector('.dw-windline-hints').hidden};
 });
 assert.match(evidence.line.anchor,/^rock-island-/);assert.equal(evidence.line.slack,'Slack line');assert.equal(evidence.line.taut,'Taut line');assert.ok(evidence.line.swing.changed>.1);assert.ok(evidence.line.swing.growth<1e-7);assert.ok(evidence.line.swing.roll<.001);
 assert.equal(evidence.line.pull.state,'Pulling');assert.match(evidence.line.pull.aria,/Inward pulse/);assert.deepEqual(evidence.line.heldPull,{remaining:0,shortened:true,cooldown:0});
 assert.equal(evidence.line.caught.state,'Line caught');assert.match(evidence.line.caught.aria,/blocked/);assert.equal(evidence.line.caught.meterHidden,true);assert.equal(evidence.line.recallVisible,true);assert.equal(evidence.line.hintsHidden,true);
 await page.evaluate(()=>__dw.render());await page.screenshot({path:'shots/windline-flow/tether.png'});
 evidence.boost=await page.evaluate(()=>{
  const g=__dw.game,p=g.player;const velocity=p.foot.velocity.clone();__flowSet(7,0);__flowTick();const release={rope:!!p.skyLance.rope,delta:p.foot.velocity.distanceTo(velocity),boost:p.airBoost.remaining};
  __flowSet(6,0);__flowTick();__flowSet(6,.6);__flowTick();const first={remaining:p.airBoost.remaining,state:document.querySelector('#windline-boost-hud').dataset.state};
  const clock=p.airBoost.cooldown,fuel=p.airBoost.remaining;g.pause();g.frame(.1,false);const paused={clock:p.airBoost.cooldown===clock,fuel:p.airBoost.remaining===fuel,hidden:document.querySelector('.dw-windline').hidden};g.resume();__flowTick();
  while(p.airBoost.cooldown>.09)__flowTick();__flowSet(6,0);__flowTick();__flowSet(6,.6);__flowTick();const queued={buffered:p.airBoost.buffered,state:document.querySelector('#windline-boost-hud').dataset.state};
  for(let i=0;i<20&&p.airBoost.remaining===0;i++)__flowTick();const second=p.airBoost.remaining;
  __flowTick(250);const noRepeat=p.airBoost.available&&p.airBoost.remaining===0;
  // A second pending press is cancelled by pause; held LT cannot replay after resume.
  __flowSet(6,0);__flowTick();__flowSet(6,.6);__flowTick();while(p.airBoost.cooldown>.09)__flowTick();__flowSet(6,0);__flowTick();__flowSet(6,.6);__flowTick();
  const pending=p.airBoost.buffered;g.pause();g.frame(.1,false);const cancelled=!p.airBoost.buffered;g.resume();__flowTick(24);const replay=p.airBoost.remaining;
  return {release,first,paused,queued,second,noRepeat,pending,cancelled,replay};
 });
 assert.equal(evidence.boost.release.rope,false);assert.ok(evidence.boost.release.delta<1);assert.equal(evidence.boost.release.boost,0);assert.ok(evidence.boost.first.remaining>0);assert.equal(evidence.boost.first.state,'active');assert.deepEqual(evidence.boost.paused,{clock:true,fuel:true,hidden:true});assert.deepEqual(evidence.boost.queued,{buffered:true,state:'queued'});assert.ok(evidence.boost.second>0);assert.equal(evidence.boost.noRepeat,true);assert.equal(evidence.boost.pending,true);assert.equal(evidence.boost.cancelled,true);assert.equal(evidence.boost.replay,0);
 evidence.disconnect=await page.evaluate(()=>{
  const g=__dw.game,p=g.player;__flowPad.connected=false;const event=new Event('gamepaddisconnected');Object.defineProperty(event,'gamepad',{value:__flowPad});window.dispatchEvent(event);__flowTick();
  const screen=g.screen,clock=p.airBoost.cooldown;g.frame(.1,false);const frozen=p.airBoost.cooldown===clock;
  __flowPad.connected=true;g.resume();__flowTick(12);const heldReplay=p.airBoost.remaining;__flowSet(6,0);__flowTick();__flowSet(6,.6);__flowTick();const fresh=p.airBoost.remaining;
  __flowSet(6,0);__flowTick();__flowSet(3,1);__flowTick(12);return {screen,frozen,heldReplay,fresh,hold:p.windlineHoldProgress,callVisible:!document.querySelector('.dw-windline-call').hidden};
 });
 assert.equal(evidence.disconnect.screen,'pause');assert.equal(evidence.disconnect.frozen,true);assert.equal(evidence.disconnect.heldReplay,0);assert.ok(evidence.disconnect.fresh>0);assert.ok(evidence.disconnect.hold>.2);assert.equal(evidence.disconnect.callVisible,true);
 // Readability at ordinary desktop/720p sizes and a narrow-layout safety check, no phone claims.
 evidence.layouts=[];
 for(const [width,height] of [[1280,720],[1920,1080],[617,380],[360,780]]) {
  await page.setViewportSize({width,height});await page.evaluate(()=>{__dw.game.frame(0,true);});
  await page.waitForTimeout(70);await page.evaluate(()=>{__dw.game.ui.windline.layout();});
  const rect=await page.locator('.dw-windline-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
  assert.equal(await page.locator('.dw-windline-panel').isVisible(),true,'critical recall status visible');
  assert.ok(rect.left>=0&&rect.right<=width&&rect.top>=0&&rect.bottom<=height,JSON.stringify({width,height,rect}));evidence.layouts.push({width,height,...rect});
  await page.screenshot({path:`shots/windline-flow/recall-${width}.png`});
 }
 await page.setViewportSize({width:1280,height:720});
 evidence.recall=await page.evaluate(()=>{const g=__dw.game,p=g.player;__flowTick(36);const called=p.mode;__flowTick(160);const caught=p.mode;__flowSet(3,0);__flowTick();g.pause();g.frame(0,false);return {called,caught,hidden:document.querySelector('.dw-windline').hidden,ship:!!g.scene.getObjectByName('Windhaven')};});
 assert.deepEqual(evidence.recall,{called:'falling',caught:'flying',hidden:true,ship:false});
 assert.deepEqual(errors,[]);console.log('Normal-game controller-first flow passed:',JSON.stringify(evidence));
} finally {fs.writeFileSync('/tmp/driftwing-windline-flow-browser-check.json',JSON.stringify({metadata,evidence,errors},null,2));await browser.close();}
