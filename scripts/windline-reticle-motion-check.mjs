// Actual Game RAF/input/physics/camera/DOM evidence. Software 3D and painted-UI
// phases are reported separately; suppressing 3D submission cannot certify GPU FPS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {browserEvidence} from './browser-evidence.mjs';
const url=new URL(process.argv[2]??'http://127.0.0.1:5175/');url.search='?debug=1&quality=low';
const out='/tmp/driftwing-reticle-motion-browser-check.json',shots='shots/windline-reticle-motion';fs.mkdirSync(shots,{recursive:true});
// Exercise full Chromium's headless compositor (the local explicit binary uses
// this mode too), rather than Playwright's default separate headless shell.
const browser=await chromium.launch({channel:'chromium',executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[],evidence={phases:[]};
evidence.browser={channel:'chromium',executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),version:browser.version(),headless:true,softwareGraphics:'SwiftShader'};console.log('RAF browser runtime:',JSON.stringify(evidence.browser));
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(url.href);await page.waitForFunction(()=>window.__dw?.ready&&!document.querySelector('#boot:not(.done)'),null,{timeout:180000});evidence.metadata=await browserEvidence(page,url);
 await page.evaluate(()=>{
  const g=__dw.game,p=g.player,v=g.skyLanceVisuals;g.startGame();g.save.data.firstLeadGuide='skipped';g.applySettings({...g.settings,reducedMotion:true});
  const pad=window.__motionPad={id:'Xbox standard controller movement QA',index:0,mapping:'standard',connected:true,timestamp:0,axes:[.9,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});g.frame(1/120,false);pad.axes[0]=0;g.frame(1/120,false);
  window.__motionPhase=null;
  const update=v.updateReticle.bind(v);v.updateReticle=(...args)=>{const phase=window.__motionPhase;if(phase)phase.inReticle=true;const start=performance.now();try{return update(...args);}finally{if(phase)phase.inReticle=false;if(phase){phase.lastQueryMs=performance.now()-start;phase.reticleMs+=phase.lastQueryMs;phase.updates++;}}};
  const sweep=p.skyLance.world.sweep;p.skyLance.world.sweep=function(...args){const phase=window.__motionPhase;if(phase){if(phase.inReticle)phase.forecasts++;else phase.physicsSweeps++;}return sweep.apply(this,args);};
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{
   const phase=window.__motionPhase,renderStart=performance.now();if(!phase?.uiOnly)render(...args);
   if(phase){const now=performance.now(),el=document.querySelector('#sky-lance-reticle'),t=v.target,r=el.getBoundingClientRect();phase.frames.push({renderMs:now-renderStart,renderFrame:g.renderer.gl.info.render.frame,visibility:document.visibilityState,color:getComputedStyle(el).color,centre:[r.left+r.width/2,r.top+r.height/2],ms:now,queryMs:phase.lastQueryMs,state:el.dataset.target,valid:el.classList.contains('is-valid'),target:t?{state:t.state,anchor:t.anchorId,distance:t.distance,point:t.point.toArray()}:null,feet:p.foot.position.toArray(),velocity:p.foot.velocity.toArray(),camera:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),yaw:g.cameraRig.yaw,revision:p.skyLance.world.revision});
    // Exercise the native standard-pad path above its deadzones. Alternate small
    // real look/steer inputs while the fixed neutral dot remains centred.
    if(phase.uiOnly){const sign=Math.floor((now-phase.start)/120)%2?1:-1;__motionPad.axes[2]=sign*.22;__motionPad.axes[0]=sign*.22;}
   }
  };
 });
 assert.equal(await page.evaluate(()=>__dw.game.input.device),'gamepad');
 for(const scenario of ['stationary-software-3d','freefall-software-3d','freefall-look-painted-ui']){
  const initial=await page.evaluate(scenario=>{
   window.__motionPhase=null;const g=__dw.game,p=g.player,pad=__motionPad,s=g.world.terrain.islands[0];pad.axes.fill(0);g.debug.freeze=false;g.cameraRig.setOverride(null);g.placeAtSpawn();g.startGame();
   const x=s.def.x+s.def.radius*.35,z=s.def.z;p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
   g.frame(1/120,false);g.frame(1/120,false);g.cameraRig.snap(p);g.input.setScripted({lookActive:true,lookIsRate:false,lookX:g.cameraRig.yaw+Math.PI/2,lookY:-10});g.frame(1/120,false);g.input.setScripted(null);
   if(scenario.startsWith('stationary')){g.debug.freeze=true;g.cameraRig.setOverride({position:g.camera.position.clone(),target:g.camera.position.clone().addScaledVector(g.camera.getWorldDirection(p.foot.position.clone()),100)});}
   if(scenario.includes('painted-ui')){pad.axes[2]=.22;pad.axes[0]=.22;}
   g.frame(0,true);
   window.__motionPhase={scenario,uiOnly:scenario.includes('painted-ui'),frames:[],reticleMs:0,updates:0,forecasts:0,physicsSweeps:0,start:performance.now()};
   return {cue:document.querySelector('#sky-lance-reticle').dataset.target,ship:!!g.scene.getObjectByName('Windhaven'),renderFrame:g.renderer.gl.info.render.frame};
  },scenario);
  // A fixed pause does not establish GPU completion: CI can take seconds to
  // finish the last full3D submission. Explicitly finish that existing work
  // outside the UI timing window. Full3D phases above remain fully submitted.
  if(scenario.includes('painted-ui')){
   let drainTimer;
   try{evidence.uiDrain=await Promise.race([page.evaluate(()=>{const renderer=__dw.game.renderer.gl,gl=renderer.getContext(),start=performance.now(),before={renderFrame:renderer.info.render.frame,contextLost:gl.isContextLost(),visibility:document.visibilityState};gl.finish();return {method:'WebGL finish before timed UI',elapsedMs:performance.now()-start,before,after:{renderFrame:renderer.info.render.frame,contextLost:gl.isContextLost()}};}),new Promise((_,reject)=>{drainTimer=setTimeout(()=>reject(new Error('Prior full3D GPU drain exceeded 120s')),120000);})]);}
   finally{clearTimeout(drainTimer);}
   console.log('Prior full3D drain:',JSON.stringify(evidence.uiDrain));assert.equal(evidence.uiDrain.before.contextLost,false);assert.equal(evidence.uiDrain.after.contextLost,false);
   // GL completion does not establish compositor presentation. Cross exactly two
   // native RAF boundaries, preserving their actual Game callbacks as startup
   // evidence. This fixed transition is not conditioned on a passing rate.
   let transitionTimer;
   try{evidence.uiTransition=await Promise.race([page.evaluate(()=>new Promise(resolve=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{const p=window.__motionPhase;resolve({method:'Two native RAF transition boundaries before timed UI',elapsedMs:performance.now()-start,frames:p.frames.slice(),forecasts:p.forecasts,renderFrame:__dw.game.renderer.gl.info.render.frame});}));})),new Promise((_,reject)=>{transitionTimer=setTimeout(()=>reject(new Error('UI compositor transition exceeded 120s')),120000);})]);}
   finally{clearTimeout(transitionTimer);}
   console.log('UI compositor transition:',JSON.stringify({method:evidence.uiTransition.method,elapsedMs:evidence.uiTransition.elapsedMs,frames:evidence.uiTransition.frames.length,forecasts:evidence.uiTransition.forecasts,renderFrame:evidence.uiTransition.renderFrame}));
   assert.ok(evidence.uiTransition.frames.length>=2);assert.equal(evidence.uiTransition.forecasts,0);assert.ok(evidence.uiTransition.frames.every(f=>f.state==='aiming'&&f.target===null&&!f.valid&&f.color==='rgb(168, 221, 236)'&&Math.abs(f.centre[0]-320)<.25&&Math.abs(f.centre[1]-180)<.25&&f.renderFrame===initial.renderFrame&&f.visibility==='visible'));
   await page.waitForTimeout(500);await page.evaluate(()=>{const p=window.__motionPhase;p.frames=[];p.reticleMs=0;p.updates=0;p.forecasts=0;p.physicsSweeps=0;p.start=performance.now();p.settlingMs=500;});
  }
  if(scenario.includes('painted-ui'))await page.waitForTimeout(2000);
  else{
   // Full SwiftShader submission can yield fewer than eleven RAF frames in 4s
   // on CI. Retain the rendered-sample requirement; collect for at least 4s and
   // until it is met, with a hard 120s deadline. Report the actual slow rate.
   try{await page.waitForFunction(()=>__motionPhase.frames.length>10&&performance.now()-__motionPhase.start>=4000,null,{timeout:120000,polling:100});}
   catch(error){evidence.collectionFailure={scenario,message:error.message,phase:await Promise.race([page.evaluate(()=>window.__motionPhase).catch(e=>({error:e.message})),new Promise(resolve=>setTimeout(()=>resolve({error:'Phase query did not respond within 2s'}),2000))])};console.error('Rendered RAF collection failure:',JSON.stringify(evidence.collectionFailure));throw error;}
  }
  const data=await page.evaluate(()=>{const phase=window.__motionPhase;window.__motionPhase=null;phase.end=performance.now();return phase;});
  await page.screenshot({path:`${shots}/${scenario}.png`,timeout:120000});
  const frames=data.frames,span=data.end-data.start,green=frames.filter(f=>f.valid).length,checking=frames.filter(f=>f.state==='checking').length,intervals=frames.slice(1).map((f,i)=>f.ms-frames[i].ms).sort((a,b)=>a-b);
  let transitions=0;for(let i=1;i<frames.length;i++)if(frames[i].valid!==frames[i-1].valid)transitions++;
  const extent=values=>Math.max(...values)-Math.min(...values),yawSpan=extent(frames.map(f=>f.yaw)),horizontalSpan=Math.hypot(extent(frames.map(f=>f.feet[0])),extent(frames.map(f=>f.feet[2]))),verticalSpan=extent(frames.map(f=>f.feet[1]));
  const summary={scenario,uiOnly:data.uiOnly,settlingMs:data.settlingMs??0,elapsedMs:span,frames:frames.length,firstCallbackDelayMs:frames[0]?.ms-data.start,callbacksPerSecond:frames.length/span*1000,green,checking,validityTransitions:transitions,reticleMsPerUpdate:data.reticleMs/data.updates,forecasts:data.forecasts,physicsSweeps:data.physicsSweeps,renderMsPerCallback:frames.reduce((n,f)=>n+f.renderMs,0)/frames.length,submittedRenderFrames:extent([initial.renderFrame,...frames.map(f=>f.renderFrame)]),visibility:[...new Set(frames.map(f=>f.visibility))],yawSpan,horizontalSpan,verticalSpan,p50CallbackMs:intervals[Math.floor(intervals.length*.5)],p95CallbackMs:intervals[Math.floor(intervals.length*.95)]};
  evidence.phases.push({initial,summary,frames});console.log('Movement cue:',JSON.stringify(summary));
  assert.equal(initial.ship,false);assert.equal(initial.cue,'aiming');assert.ok(frames.length>10);assert.equal(checking,0);assert.equal(data.forecasts,0,'zero reticle prediction queries in every ready RAF phase');assert.equal(green,0);assert.ok(frames.every(f=>f.target===null&&f.state==='aiming'&&f.color==='rgb(168, 221, 236)'&&Math.abs(f.centre[0]-320)<.25&&Math.abs(f.centre[1]-180)<.25));
  if(data.uiOnly){assert.equal(summary.submittedRenderFrames,0,'no full3D submission in the timed UI phase');assert.deepEqual(summary.visibility,['visible']);assert.ok(summary.callbacksPerSecond>=45,'high-refresh painted UI callback rate');assert.equal(green,0,'neutral dot never presents hit validity');assert.equal(transitions,0);assert.ok(summary.reticleMsPerUpdate<=2.5,'neutral dot mean CPU budget');assert.ok(yawSpan>.005,'native right stick produces real camera yaw');assert.ok(horizontalSpan>.01,'native left stick produces real steering');assert.ok(verticalSpan>.1,'actual falling poses move');}
 }
 evidence.errors=errors;assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__dw.errors),[]);
}finally{fs.writeFileSync(out,JSON.stringify(evidence,null,2));await browser.close();}
