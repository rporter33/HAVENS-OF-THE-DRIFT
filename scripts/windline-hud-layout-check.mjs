// Responsive normal-game HUD regression: painted siblings, not just viewport bounds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {browserEvidence} from './browser-evidence.mjs';
const url=new URL(process.argv[2]??'http://127.0.0.1:5176/');url.search='?manual=1&quality=low';
const gamepad=process.argv.includes('--device=gamepad'),review=process.argv.includes('--review-viewports');
const captureDir=`shots/hud-layout-after${gamepad?'-gamepad':''}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],evidence=[];
let metadata=null;
page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync(captureDir,{recursive:true});
try {
 await page.goto(url.href);await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:180000});
 metadata=await browserEvidence(page,url);
 await page.evaluate(()=>{const g=__dw.game;g.save.data.firstLeadGuide='skipped';g.startGame();__dw.advance(.1);g.applySettings({...g.settings,reducedMotion:true});});
 if(gamepad)await page.evaluate(()=>{
  const pad={id:'Xbox standard controller visual QA',mapping:'standard',connected:true,index:0,timestamp:0,axes:[.9,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});__dw.game.frame(1/120,false);pad.axes[0]=0;__dw.game.frame(1/120,false);
 });
 if(gamepad){assert.equal(await page.evaluate(()=>__dw.game.input.device),'gamepad');assert.notEqual(await page.locator('.dw-ui').getAttribute('data-device'),'keyboard');}
 const viewports=review?[[1280,720],[1920,1080],[617,380]]:[[1920,1080],[1280,720],[960,540],[617,380],[360,780]];
 for(const [width,height] of viewports) {
  await page.setViewportSize({width,height});
  for(const scenario of ['mounted','mounted-crowded','freefall','tether','pull','boost','recall','hints-off']) {
   await page.evaluate(scenario=>{
    const g=__dw.game,p=g.player,t=g.world.terrain,s=t.islands[0],tick=(input={})=>{g.input.setScripted(input);g.frame(1/120,false);g.input.setScripted(null);};
    g.applySettings({...g.settings,showControlHints:scenario!=='hints-off'});
    window.__layoutRestore?.();window.__layoutRestore=null;
    g.placeAtSpawn();
    if(scenario.startsWith('mounted')){p.teleport(p.foot.position.clone().set(0,900,-90),0,'flying',28);p.model.state.stamina=.45;tick();}
    else {
     const x=s.def.x+s.def.radius*.35,z=s.def.z;p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);tick();tick();
     if(scenario==='tether'||scenario==='pull'){
      const aim=p.foot.position.clone().set(0,1,0);tick({pressed:{lance:true},lanceHeld:true,aim});for(let i=0;i<240&&!p.skyLance.rope;i++)tick({lanceHeld:true,aim});if(!p.skyLance.rope)throw Error('No real-world line');
      if(scenario==='pull')tick({pressed:{jump:true},lanceHeld:true});
     }
     if(scenario==='boost'){tick({pressed:{jump:true}});tick();}
     if(scenario==='recall')for(let i=0;i<20;i++)tick({callHeld:true});
    }
    g.cameraRig.snap(p);g.frame(0,false);
    if(scenario==='mounted-crowded'){
     const snapshots=[...document.querySelectorAll('.dw-tip,.dw-prompt,.dw-toasts,.dw-flightinfo-notes,.dw-restnote,.dw-prompt-t,.dw-tip-title,.dw-tip-body')].map(el=>({el,cls:el.className,style:el.getAttribute('style'),hidden:el.hidden,html:el.matches('.dw-prompt-t,.dw-tip-title,.dw-tip-body')?el.innerHTML:null}));
     window.__layoutRestore=()=>{for(const {el,cls,style,hidden,html} of snapshots){el.className=cls;if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);el.hidden=hidden;if(html!==null)el.innerHTML=html;}};
     // Controlled presentation stress using the existing components; no save/tutorial mutation.
     for(const selector of ['.dw-tip','.dw-tip--gauge','.dw-prompt','.dw-toasts','.dw-flightinfo-notes']){
      const el=document.querySelector(selector);el.hidden=false;el.classList.add('is-on');el.style.opacity='1';el.dataset.layoutFixture='true';
     }
     document.querySelector('.dw-prompt-t').textContent='Read the Windhaven inscription and return to your companion';
     document.querySelector('.dw-tip--gauge .dw-tip-title').textContent='Glide or land to rest';
     document.querySelector('.dw-tip--gauge .dw-tip-body').textContent='Your wyvern recovers stamina while gliding. Find a calm place to rest.';
     document.querySelector('.dw-tip:not(.dw-tip--gauge) .dw-tip-title').textContent='Your first flight';
     document.querySelector('.dw-tip:not(.dw-tip--gauge) .dw-tip-body').textContent='Look around, steer gently and watch your stamina. Hold to leap when ready.';
     const notes=document.querySelector('.dw-flightinfo-notes');notes.querySelector('.dw-restnote').classList.add('is-on');notes.querySelector('.dw-restnote').style.opacity='1';
     g.ui.windline.layout();
    }
   },scenario);
   await page.waitForTimeout(70);
   await page.evaluate(()=>{__dw.game.ui.windline.layout();document.querySelector('.dw-windline-panel').getBoundingClientRect();});
   const result=await page.evaluate(()=>{
    const panel=document.querySelector('.dw-windline-panel');const painted=el=>{for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility==='hidden'||+s.opacity<.01)return false;}return el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;};
    const plain=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom});
    const blockers=[...document.querySelectorAll('.dw-readouts,.dw-gauge,.dw-flightinfo-notes,.dw-compass,.dw-compass-labels,.dw-prompt,.dw-tip,.dw-toasts,.dw-banner,.dw-stall,.dw-pointer-hint,.dw-race,.dw-gate,.dw-countdown,.dw-missed,.dw-edge')].filter(painted).flatMap(el=>{
     const boxes=[{class:el.className,...plain(el.getBoundingClientRect())}];
     if(el.classList.contains('dw-banner'))for(const pseudo of ['::before','::after']){
      const s=getComputedStyle(el,pseudo);if(s.content==='none'||s.content==='normal'||s.display==='none')continue;
      // An independent DOM probe lets Chromium resolve the pseudo-element's CSS box.
      const probe=document.createElement('i');for(const k of ['position','left','top','right','bottom','width','height','transform','boxSizing'])probe.style[k]=s[k];
      probe.style.visibility='hidden';el.append(probe);const r=probe.getBoundingClientRect();
      boxes.push({class:`dw-banner${pseudo}`,left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)});probe.remove();
     }
     return boxes;
    });
    const a=panel.getBoundingClientRect();
    const visible=painted(panel),overlaps=visible?blockers.filter(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top):[];
    const centre={left:innerWidth*.35,right:innerWidth*.65,top:innerHeight*.25,bottom:innerHeight*.75};
    return {panel:plain(a),visible,essential:panel.dataset.essential==='true',viewport:[innerWidth,innerHeight],layout:panel.dataset.layout,device:__dw.game.input.device,glyphDevice:document.querySelector('.dw-ui').dataset.device,blockers,overlaps,centralOverlap:visible&&a.left<centre.right&&a.right>centre.left&&a.top<centre.bottom&&a.bottom>centre.top,mode:__dw.game.player.mode,ship:!!__dw.game.scene.getObjectByName('Windhaven')};
   });
   const entry={width,height,scenario,...result};evidence.push(entry);
   if(result.essential&&!result.visible)console.error('Critical HUD placement diagnostics:',JSON.stringify({metadata,entry}));
   if(result.essential)assert.equal(result.visible,true,`${width}×${height} ${scenario} critical status visible`);
   else if(!result.visible)assert.equal(result.layout,'suppressed');
   assert.deepEqual(result.overlaps,[],`${width}×${height} ${scenario} overlap`);
   assert.equal(result.centralOverlap,false,`${width}×${height} ${scenario} central view`);
   if(result.visible)assert.ok(result.panel.left>=0&&result.panel.right<=width&&result.panel.top>=0&&result.panel.bottom<=height);
   assert.equal(result.ship,false);
   if(review||['mounted','mounted-crowded','tether','recall'].includes(scenario)){
    await page.evaluate(()=>{const g=__dw.game;g.renderer.render(g.scene,g.camera,0);});
    const path=`${captureDir}/${scenario}-${width}.png`;await page.screenshot({path});
    entry.capture={path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')};
   }
  }
 }
 // Force an impossible optional overlay slot: the fallback must suppress guidance,
 // never jump to an unchecked corner over the primary instruments.
 await page.evaluate(()=>{const g=__dw.game;g.player.teleport(g.player.foot.position.clone().set(0,900,-90),0,'flying',28);g.applySettings({...g.settings,showControlHints:true});g.frame(1/120,false);
  const reserve=document.querySelector('.dw-tip');window.__reserveStyle=reserve.getAttribute('style');reserve.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;opacity:1;transition:none;';g.ui.windline.layout();});
 assert.equal(await page.locator('.dw-windline-panel').getAttribute('data-layout'),'suppressed');
 assert.equal(await page.locator('.dw-windline-panel').isVisible(),false);
 await page.evaluate(()=>{const el=document.querySelector('.dw-tip');if(window.__reserveStyle===null)el.removeAttribute('style');else el.setAttribute('style',window.__reserveStyle);__dw.game.ui.windline.layout();});
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(()=>{__dw.game.ui.windline.layout();});
 assert.equal(await page.locator('.dw-windline-panel').isVisible(),true,'optional guidance returns when a safe slot is available');
 await page.evaluate(()=>{const g=__dw.game;g.pause();g.frame(0,true);});assert.equal(await page.locator('.dw-windline').isVisible(),false);
 await page.evaluate(()=>{const g=__dw.game;g.resume();g.frame(1/120,false);g.ui.hudHidden=true;g.frame(0,true);});assert.equal(await page.locator('.dw-windline').isVisible(),false);
 await page.evaluate(()=>{const g=__dw.game;g.ui.hudHidden=false;g.pause();g.ui.debugOpen('photo');g.frame(0,true);});assert.equal(await page.locator('.dw-windline').isVisible(),false);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__dw.errors),[]);
 console.log(`HUD layout checks passed: ${evidence.length} combinations, menus and hidden HUD`);
} finally {fs.writeFileSync(`/tmp/driftwing-windline-hud-layout${gamepad?'-gamepad':''}-browser-check.json`,JSON.stringify({metadata,evidence,errors},null,2));await browser.close();}
