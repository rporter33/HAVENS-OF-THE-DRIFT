// Production normal-game integration check. No view=skyLance or play=1 switches, practice
// solids or replacement physics. Repositioned scenarios use the real world + Game loop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5174/';
const url = new URL(base); url.search = '?manual=1&quality=low';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage(), errors = [], evidence = {};
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.url().startsWith(url.origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
fs.mkdirSync('shots/windline-gameplay', { recursive: true });
try {
  await page.goto(url.href); await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 180000 });
  evidence.boot = await page.evaluate(() => {
    const g = __dw.game;
    const result = { screen: g.screen, mode: g.player.mode, equipped: !!g.player.skyLance,
      ship: !!g.scene.getObjectByName('Windhaven'), sources: [...g.world.terrain.colliders.sources.keys()],
      practice: !!document.querySelector('#sky-lance-controls'), tutorial: g.save.data.tutorialDone };
    g.startGame(); __dw.advance(3); return result;
  });
  assert.equal(evidence.boot.screen, 'title'); assert.equal(evidence.boot.equipped, true);
  assert.equal(evidence.boot.ship, false); assert.equal(evidence.boot.practice, false);
  assert.ok(evidence.boot.sources.includes('first-lead')); assert.ok(!evidence.boot.sources.includes('sky-lance-test'));
  assert.equal(evidence.boot.tutorial, false);
  assert.equal(await page.locator('.dw-windline').isVisible(), true);
  assert.match(await page.locator('.dw-windline-hints').innerText(), /65 m/);
  await page.evaluate(()=>__dw.render());
  await page.screenshot({ path: 'shots/windline-gameplay/normal-launch.png' });

  // Real keyboard edges at normal launch: Q casts; pause cancels; held Q cannot replay it.
  await page.keyboard.down('q');
  assert.equal(await page.evaluate(() => { __dw.game.frame(1/120,false); return __dw.game.player.skyLance.state; }), 'projectile');
  evidence.pause = await page.evaluate(() => {
    const g=__dw.game,p=g.player;g.pause();const position=p.foot.position.clone();g.frame(.1,false);
    const frozen=position.equals(p.foot.position);g.resume();for(let i=0;i<60;i++)g.frame(1/120,false);
    return { frozen, equipment:p.skyLance.state, replay:p.skyLance.charging };
  });
  assert.deepEqual(evidence.pause, { frozen:true, equipment:'ready', replay:false });
  await page.keyboard.up('q'); await page.evaluate(() => __dw.game.frame(1/120,false));

  // Mounted flight retains RT/flap. Hold F deliberately leaps; holding through the leap
  // cannot recall. Space boosts, then a released/repressed F recalls and remounts.
  await page.evaluate(() => { const g=__dw.game,p=g.player;p.teleport(p.foot.position.clone().set(0,900,-90),0,'flying',30);g.frame(1/120,false); });
  await page.keyboard.down('f');
  evidence.leap = await page.evaluate(() => {
    const g=__dw.game,p=g.player;for(let i=0;i<48;i++)g.frame(1/120,false);
    const mode=p.mode;for(let i=0;i<60;i++)g.frame(1/120,false);
    return { mode, heldMode:p.mode, rider:p.riderPose.equipment, cameraRoll:Math.abs(p.foot.position.clone().set(1,0,0).applyQuaternion(g.camera.quaternion).y) };
  });
  assert.equal(evidence.leap.mode,'traversing');assert.equal(evidence.leap.heldMode,'traversing');
  assert.equal(evidence.leap.rider,'bracer');assert.ok(evidence.leap.cameraRoll<.001);
  await page.keyboard.down('Space');
  evidence.boost = await page.evaluate(() => {
    const g=__dw.game,p=g.player;g.frame(1/120,false);const first={remaining:p.airBoost.remaining,vy:p.foot.velocity.y};
    const clock=p.airBoost.cooldown;g.pause();g.frame(.1,false);const paused=p.airBoost.cooldown===clock;g.resume();
    for(let i=0;i<211;i++)g.frame(1/120,false);
    return { first, paused, available:p.airBoost.available, remaining:p.airBoost.remaining };
  });
  assert.ok(evidence.boost.first.remaining>0);assert.ok(evidence.boost.first.vy>11);
  assert.equal(evidence.boost.paused,true);assert.equal(evidence.boost.available,true);assert.equal(evidence.boost.remaining,0);
  await page.keyboard.up('Space');await page.keyboard.up('f');await page.evaluate(()=>__dw.game.frame(1/120,false));
  await page.keyboard.down('f');
  evidence.recall = await page.evaluate(() => {
    const g=__dw.game,p=g.player;for(let i=0;i<48;i++)g.frame(1/120,false);const called=p.mode;
    for(let i=0;i<180;i++)g.frame(1/120,false);return {called,caught:p.mode,equipment:p.skyLance.state};
  });
  assert.equal(evidence.recall.called,'falling');assert.equal(evidence.recall.caught,'flying');assert.equal(evidence.recall.equipment,'ready');
  await page.keyboard.up('f');await page.evaluate(()=>__dw.game.frame(1/120,false));

  // Actual analytic Roost underside, actual camera aim and DOM Q cast/retain/release.
  await page.evaluate(() => {
    const g=__dw.game,p=g.player,s=g.world.terrain.islands[0],x=s.def.x+s.def.radius*.35,z=s.def.z;
    g.placeAtSpawn();p.foot.position.set(x,s.bottomHeight(x,z)-18,z);p.foot.grounded=false;p.foot.velocity.set(0,0,0);
    g.frame(1/120,false);g.cameraRig.snap(p);g.input.setScripted({lookActive:true,lookIsRate:false,lookY:-10});g.frame(1/120,false);g.input.setScripted(null);
  });
  await page.waitForTimeout(100);evidence.aim=await page.evaluate(()=>{
    const g=__dw.game;g.frame(0,false);
    const reticle=document.querySelector('#sky-lance-reticle');
    return {screen:g.screen,mode:g.player.mode,captures:g.ui.capturesInput,hidden:reticle.hidden,parentHidden:!!reticle.closest('[hidden]'),target:g.skyLanceVisuals.target,direction:g.camera.getWorldDirection(g.player.foot.position.clone()).toArray()};
  });
  console.log('Normal-world aim:',JSON.stringify(evidence.aim));
  assert.equal(await page.locator('#sky-lance-reticle').getAttribute('data-target'),'aiming');
  await page.keyboard.down('q');
  evidence.tether = await page.evaluate(() => {
    const g=__dw.game,p=g.player;g.frame(1/120,false);
    for(let i=0;i<240&&!p.skyLance.rope&&p.skyLance.state==='projectile';i++)g.frame(1/120,false);
    if(!p.skyLance.rope)throw Error(`No normal-world attachment: ${p.skyLance.reason}`);
    const anchor=p.skyLance.anchorId, length=p.skyLance.rope.length;
    for(let i=0;i<120;i++)g.frame(1/120,false);
    return { anchor,length,retained:!!p.skyLance.rope,mode:p.mode };
  });
  assert.match(evidence.tether.anchor,/^rock-island-/);assert.equal(evidence.tether.retained,true);assert.equal(evidence.tether.mode,'traversing');
  await page.keyboard.down('f');await page.keyboard.down('Space');
  evidence.pull = await page.evaluate(() => {
    const g=__dw.game,p=g.player;g.frame(1/120,false);for(let i=0;i<48;i++)g.frame(1/120,false);
    return { length:p.skyLance.rope?.length, mode:p.mode, boostCooldown:p.airBoost.cooldown,
      label:document.querySelector('[data-boost-text]').textContent, distance:p.foot.position.clone().add({x:0,y:1,z:0}).distanceTo(p.skyLance.rope.anchor) };
  });
  assert.ok(evidence.pull.length<evidence.tether.length-1);assert.equal(evidence.pull.mode,'traversing');
  assert.equal(evidence.pull.boostCooldown,0);assert.ok(evidence.pull.distance<=evidence.pull.length+.020001);
  await page.evaluate(()=>__dw.render());await page.screenshot({ path: 'shots/windline-gameplay/normal-world-tether.png' });
  await page.evaluate(()=>{__dw.game.pause();__dw.game.frame(.1,false);});
  await page.keyboard.up('f');await page.keyboard.up('Space');await page.keyboard.up('q');
  await page.evaluate(()=>{__dw.game.frame(.1,false);__dw.game.resume();});
  assert.equal(await page.evaluate(()=>{__dw.game.frame(1/120,false);return !!__dw.game.player.skyLance.rope;}),false);

  evidence.interruptions = await page.evaluate(() => {
    const g=__dw.game,p=g.player,tick=()=>g.frame(1/120,false);
    const results=[];
    for(let run=0;run<3;run++) {
      p.teleport(p.foot.position.clone().set(0,900,-90),0,'flying',30);tick();
      for(let i=0;i<48;i++){g.input.setScripted({callHeld:true});tick();}g.input.setScripted(null);tick();
      const leap=p.mode;g.input.setScripted({pressed:{jump:true}});tick();g.input.setScripted(null);
      const boosted=p.airBoost.remaining>0;
      g.restartRace(); // Safe when no race exists.
      g.quitToTitle();tick();g.startGame();tick();
      results.push({leap,boosted,reset:p.mode,equipment:p.skyLance.state,rope:!!p.skyLance.rope});
    }
    g.beginRace('roost-loop');tick();const raceReset=p.skyLance.state==='ready'&&!p.skyLance.rope;
    g.quitRace();g.resetProgress();tick();
    return {results,raceReset,resetGround:p.foot.grounded,ship:!!g.scene.getObjectByName('Windhaven')};
  });
  for(const r of evidence.interruptions.results)assert.deepEqual(r,{leap:'traversing',boosted:true,reset:'onFoot',equipment:'ready',rope:false});
  assert.equal(evidence.interruptions.raceReset,true);assert.equal(evidence.interruptions.resetGround,true);assert.equal(evidence.interruptions.ship,false);

  // Read the existing shrine interaction, then reload the same save with a toggle preference.
  evidence.save = await page.evaluate(() => {
    const g=__dw.game,site=g.view.tutorialShrine,point=g.player.foot.position.clone().set(site.inscription.x+Math.sin(site.yaw)*1.5,site.inscription.y,site.inscription.z+Math.cos(site.yaw)*1.5);
    g.player.teleport(point,site.yaw,'onFoot');g.frame(1/120,false);g.interactables.nearest(point).onInteract();
    g.applySettings({...g.settings,windlineToggle:true});g.save.data.firstLeadGuide='skipped';
    g.quitToTitle();g.startGame();__dw.advance(.3);g.save.save();
    return {research:g.save.data.research,guide:g.save.data.firstLeadGuide,collected:g.save.data.collected,tips:g.save.data.tips};
  });
  await page.reload();await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:180000});
  const reloaded=await page.evaluate(()=>{
    const g=__dw.game;g.startGame();g.frame(1/120,false);
    return {research:g.save.data.research,guide:g.save.data.firstLeadGuide,collected:g.save.data.collected,tips:g.save.data.tips,
      interaction:g.player.lanceInteraction,equipped:!!g.player.skyLance,rope:!!g.player.skyLance.rope,grounded:g.player.foot.grounded};
  });
  for(const key of ['research','guide','collected','tips'])assert.deepEqual(reloaded[key],evidence.save[key],key);
  assert.equal(reloaded.interaction,'toggle');assert.equal(reloaded.equipped,true);assert.equal(reloaded.rope,false);assert.equal(reloaded.grounded,true);
  evidence.reload=reloaded;
  evidence.controller=await page.evaluate(()=>{
    const g=__dw.game,p=g.player;
    const pad={id:'Windline simulated standard Xbox controller',mapping:'standard',connected:true,index:0,timestamp:0,
      axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
    const set=(button,value)=>pad.buttons[button]={pressed:!!value,touched:!!value,value};
    const tick=()=>g.frame(1/120,false);
    p.teleport(p.foot.position.clone().set(0,900,-90),0,'flying',30);tick();set(7,1);tick();
    const flightRole=g.input.frame.flight.flap>.9&&p.skyLance.state==='ready';
    set(3,1);for(let i=0;i<48;i++)tick();const leap=p.mode;
    tick();const heldFlapNoCast=p.skyLance.state==='ready';set(7,0);tick();set(7,1);tick();const cast=p.skyLance.state;
    set(7,0);tick();const retained=p.skyLance.state==='projectile';set(7,1);tick();const detached=p.skyLance.state==='spent';
    set(3,0);set(7,0);tick();delete navigator.getGamepads;
    return {flightRole,leap,heldFlapNoCast,cast,retained,detached};
  });
  assert.deepEqual(evidence.controller,{flightRole:true,leap:'traversing',heldFlapNoCast:true,cast:'projectile',retained:true,detached:true});
  await page.evaluate(()=>{const g=__dw.game;g.quitToTitle();g.startGame();g.frame(1/120,false);g.pause();g.frame(0,true);});
  assert.equal(await page.locator('.dw-windline').isVisible(),false);
  await page.getByText('Controls',{exact:true}).click();
  assert.match(await page.locator('.dw-controls').innerText(),/WINDLINE/);
  assert.match(await page.locator('.dw-controls').innerText(),/recall your wyvern/);
  assert.match(await page.locator('.dw-controls').innerText(),/press again to detach/);
  await page.screenshot({path:'shots/windline-gameplay/controls.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__dw.errors),[]);
  console.log('Normal-game Windline checks passed:',JSON.stringify(evidence));
} finally {
  fs.writeFileSync('/tmp/driftwing-windline-gameplay-browser-check.json',JSON.stringify({evidence,errors},null,2));
  await browser.close();
}
