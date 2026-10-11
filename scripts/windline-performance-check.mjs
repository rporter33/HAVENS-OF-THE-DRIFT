// Normal-world CPU profile. Software WebGL is recorded separately from simulation;
// these numbers do not certify a physical GPU/controller/phone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import {browserEvidence} from './browser-evidence.mjs';
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5174/');
url.search = '?manual=1&quality=low';
const label = process.argv.find(a => a.startsWith('--evidence='))?.slice(11) ?? 'profile';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(url.href); await page.waitForFunction(() => window.__dw?.ready, null, {timeout:180000});
  const metadata=await browserEvidence(page,url);
  const result = await page.evaluate(() => {
    const g=__dw.game,p=g.player,t=g.world.terrain;
    g.startGame();__dw.advance(.1);g.applySettings({...g.settings,reducedMotion:true});
    const s=t.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    const stats=()=>({frames:[],sweeps:0,sweepMs:0,rockQueries:0,rockMs:0,worldMs:0,visualMs:0,reticleMs:0,caughtSteps:0});
    let active=null;
    for(const [object,key,count,time] of [[p.skyLance.world,'sweep','sweeps','sweepMs'],[t,'rockContact','rockQueries','rockMs'],[g.world,'update',null,'worldMs'],[g.skyLanceVisuals,'update',null,'visualMs'],[g.skyLanceVisuals,'updateReticle',null,'reticleMs']]) {
      const original=object[key];object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{if(active){if(count)active[count]++;active[time]+=performance.now()-start;}}};
    }
    const tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    const aim=p.foot.position.clone().set(0,1,0);
    const setup=depth=>{g.placeAtSpawn();p.foot.position.set(x,s.bottomHeight(x,z)-depth,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();g.cameraRig.snap(p);};
    const finish=data=>{
      const sorted=[...data.frames].sort((a,b)=>a-b), n=sorted.length;
      return {...data,frames:undefined,samples:n,meanMs:sorted.reduce((a,b)=>a+b,0)/n,p50Ms:sorted[Math.floor(n*.5)],p95Ms:sorted[Math.floor(n*.95)],p99Ms:sorted[Math.min(n-1,Math.floor(n*.99))],maxMs:sorted[n-1],queriesPerStep:data.rockQueries/n,sweepsPerStep:data.sweeps/n};
    };
    const sample=(count,input)=>{active=stats();for(let i=0;i<count;i++){const start=performance.now();tick(input);active.frames.push(performance.now()-start);if(p.skyLance.reason==='Line caught at edge')active.caughtSteps++;}const result=finish(active);active=null;return result;};
    const cases=[];
    for(const depth of [18,55]) {
      setup(depth);
      const freefall=sample(60,{});setup(depth);
      active=stats();const start=performance.now();tick({pressed:{lance:true},lanceHeld:true,aim});active.frames.push(performance.now()-start);
      for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++){const start=performance.now();tick({lanceHeld:true,aim});active.frames.push(performance.now()-start);}
      const castAttach=finish(active);active=null;
      if(!p.skyLance.rope)throw Error('Normal-world attach failed: '+p.skyLance.reason);
      const anchor=p.skyLance.anchorId,length=p.skyLance.rope.length;
      const hanging=sample(360,{lanceHeld:true});p.foot.velocity.set(8,0,4);
      const swinging=sample(360,{lanceHeld:true});p.foot.velocity.set(26,4,13);
      const grazing=sample(600,{lanceHeld:true}),retained=!!p.skyLance.rope;
      tick({pressed:{lanceRelease:true}});const released=sample(120,{});
      const rendered=[];for(let i=0;i<8;i++){const start=performance.now();g.frame(1/120,true);rendered.push(performance.now()-start);}
      for(let i=0;i<49;i++)tick({callHeld:true});const called=p.mode;
      for(let i=0;i<240&&p.mode!=='flying';i++)tick();const recalled={called,caught:p.mode,rope:!!p.skyLance.rope};
      cases.push({depth,anchor,length,freefall,castAttach,hanging,swinging,grazing,released,retained,recalled,softwareRenderedMs:rendered});
    }
    const repeats=[];
    for(let run=0;run<5;run++){setup(18);const start=performance.now();tick({pressed:{lance:true},lanceHeld:true,aim});for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)tick({lanceHeld:true,aim});repeats.push({attached:!!p.skyLance.rope,ms:performance.now()-start});tick({pressed:{lanceRelease:true}});}
    return {cases,repeats,errors:__dw.errors,ship:!!g.scene.getObjectByName('Windhaven'),practice:!!document.querySelector('#sky-lance-controls')};
  });
  result.metadata=metadata;
  fs.writeFileSync(`/tmp/driftwing-windline-performance-${label}.json`,JSON.stringify(result,null,2));
  assert.equal(result.ship,false);assert.equal(result.practice,false);assert.ok(result.cases.every(c=>c.retained));assert.ok(result.repeats.every(c=>c.attached));assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
  for(const c of result.cases)assert.deepEqual(c.recalled,{called:'falling',caught:'flying',rope:false});
  if(process.argv.includes('--assert-cost'))for(const c of result.cases){
    assert.ok(c.swinging.queriesPerStep<1800,'long moving line query budget');
    assert.ok(c.hanging.queriesPerStep<100,'exact vertical hanging query budget');
    assert.ok(c.swinging.p95Ms<20,'sustained CPU step budget (software-browser test, not a GPU claim)');
  }
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
