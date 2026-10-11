// Real normal-menu/Stable and actual-engine evidence for the approved shared body rollout.
// All saves/unlocks below belong to a disposable browser context.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {preview} from 'vite';
const output=path.resolve('shots/rider-shared-body');await fs.mkdir(output,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5199,strictPort:true}});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
const report={renderer:'Production WebGL / Edge SwiftShader; not GPU timing',checks:[],captures:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push({message:m.text(),url:page.url()});});
const check=(name,pass)=>{if(!pass)throw Error(name);report.checks.push({name,passed:true});console.log('PASS '+name);};
async function open(query=''){
  const url=new URL('http://127.0.0.1:5199/?manual=1&quality=medium&weather=clear&tod=.42');
  for(const [key,value] of new URLSearchParams(query))url.searchParams.set(key,value);
  await page.goto(url.href,{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__dw?.ready&&!document.getElementById('boot'),null,{timeout:120000});
  await page.evaluate(()=>{window.__dw.advance(.5);window.__dw.render();});
}
const tab=label=>page.locator('.dw-tab').filter({hasText:new RegExp('^'+label+'$')}).click();
const pick=label=>page.locator('.dw-stable-body').getByText(label,{exact:true}).last().click();
async function state(){return page.evaluate(()=>{
  const r=window.__riderShow?.actors[0]?.rider??window.__dw.game.rider;
  return {bodyVersion:r.model.bodyVersion,outfit:r.look.outfit,build:r.model.rig.dims.build,proof:r.model.proof??null,
    triangles:r.model.geometry.index.count/3,bones:r.model.rig.skeleton.bones.length,mapSize:r.model.mesh.material.map?.image.width??null,
    finite:Object.values(r.model.geometry.attributes).every(a=>Array.from(a.array).every(Number.isFinite))&&r.cloth.pieces.every(p=>Array.from(p.cloth.pos).every(Number.isFinite)),
    look:r.look,errors:window.__dw.errors};
});}
async function capture(name){await page.evaluate(()=>{window.__dw.advance(.8);window.__dw.render();});const s=await state();
  check(name+': shared body, finite geometry/cloth and original rig',s.bodyVersion==='refined'&&s.finite&&s.bones===27&&!s.errors.length);
  await page.screenshot({path:path.join(output,name+'.png')});report.captures.push({name,url:page.url(),state:s});}
try{
  await open();
  const entry=await page.evaluate(()=>{const g=window.__dw.game;g.save.data.firstLeadGuide='skipped';g.save.data.tutorialDone=true;
    g.save.data.unlocked.push('courier','racer','cartographer','skyknight');g.save.flush();return JSON.stringify(g.save.data.rider);});
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__dw?.ready&&!document.getElementById('boot'));
  await page.evaluate(()=>{window.__dw.advance(.5);window.__dw.render();});
  check('an existing Flight Leathers save loads the refined body at the normal title without costume flags',await page.evaluate(entry=>{
    const g=window.__dw.game;return g.screen==='title'&&g.rider.model.bodyVersion==='refined'&&g.rider.look.outfit==='flight'&&!g.rider.model.proof
      &&JSON.stringify(g.save.data.rider)===entry&&!new URLSearchParams(location.search).has('riderProof');},entry));
  await page.locator('.dw-press').click();await page.locator('.dw-title-menu').getByText('Stable',{exact:true}).click();await tab('Outfit');
  for(const [id,name] of [['flight','Flight Leathers'],['scout',"Scout's Tunic"],['courier',"Courier's Coat"],['racer','Racing Suit'],
    ['cartographer',"Cartographer's Robes"],['skyknight','Skyknight Plate'],['travel-drape','Travel Drape']]){
    await pick(name);const s=await state();check(name+' keeps its identity on the refined body',s.bodyVersion==='refined'&&s.outfit===id);
    await capture('stable-'+id);
  }
  await pick('Flight Leathers');await tab('Outfit Pieces');await pick('Linen Chiton');await pick('Gathered Linen Trousers');
  await pick('No Chest Armor');await pick('No Shoulder Drape');await pick('Riding Sandals');
  check('Travel Drape pieces on a Flight Leathers base keep the refined body',await page.evaluate(()=>{const r=window.__dw.game.rider;
    return r.model.bodyVersion==='refined'&&r.look.outfit==='flight'&&!r.model.proof&&r.look.wardrobe.top==='travel-drape-top'
      &&r.look.wardrobe.trousers==='travel-drape-trousers'&&r.model.mesh.material.map.image.width===2048;}));
  await capture('stable-legacy-base-linen-mix');
  await page.evaluate(()=>{const r=window.__dw.game.rider;window.__sharedRefs={geo:r.model.geometry,bones:r.model.rig.skeleton,mat:r.model.mesh.material};});
  await page.locator('.dw-swatches').first().locator('.dw-swatch:not(.is-selected)').first().click();
  check('mixed dyes still reuse geometry, rig and material',await page.evaluate(()=>{const r=window.__dw.game.rider,p=window.__sharedRefs;
    return r.model.geometry===p.geo&&r.model.rig.skeleton===p.bones&&r.model.mesh.material===p.mat;}));
  await page.locator('.dw-stable-foot .dw-btn').filter({hasText:'Save & leave'}).click();
  const saved=await page.evaluate(()=>JSON.stringify(window.__dw.game.save.data.rider));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__dw?.ready&&!document.getElementById('boot'));
  check('saved legacy-base mix reloads with the refined body and identical choices/colors',await page.evaluate(saved=>{
    const g=window.__dw.game;return JSON.stringify(g.save.data.rider)===saved&&g.rider.model.bodyVersion==='refined';},saved));
  await page.evaluate(()=>{const g=window.__dw.game;g.setRiderLook({...g.rider.look,wardrobe:undefined,outfit:'flight'});});
  const gameplay=await page.evaluate(()=>{
    const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();
    g.world.terrain.standingPoint(spawn[0],spawn[2],at);p.teleport(at,0,'landed');g.cameraRig.setOverride(null);g.cameraRig.snap(p);
    g.setScreen('play');h.advance(.6,{flight:{flap:1}});const takeoff=p.mode;
    g.world.terrain.standingPoint(spawn[0]-6,spawn[2]+4,at);at.y+=p.breed.standHeight+3;p.teleport(at,0,'flying',4);p.model.state.velocity.y=-2;
    for(let i=0;i<180&&p.mode==='flying';i++)h.advance(1/30,{flight:{flare:1}});
    const landing=p.mode;h.advance(1);h.advance(.25,{pressed:{interact:true}});const dismount=p.mode;h.advance(1);h.render();
    return {takeoff,landing,dismount,finished:p.mode,bodyVersion:g.rider.model.bodyVersion,errors:h.errors};
  });
  check('refined Flight Leathers body completes actual takeoff, landing and dismount',gameplay.takeoff==='flying'&&gameplay.landing==='landed'
    &&gameplay.dismount==='dismounting'&&gameplay.finished==='onFoot'&&gameplay.bodyVersion==='refined'&&!gameplay.errors.length);report.gameplay=gameplay;
  const common='view=rider&headgear=none&scarf=none&cape=none&angle=18&dist=2.7&height=.95&camUp=.15';
  for(const outfit of ['flight','scout','courier','racer','cartographer','skyknight','travel-drape']){
    await open(common+'&outfit='+outfit);await capture('body-'+outfit);
  }
  for(const [name,extra] of [['flight-slight','outfit=flight&build=slight'],['skyknight-broad','outfit=skyknight&build=broad'],
    ['mounted-flight-left','outfit=flight&real=1&angle=90&speed=40&height=.4'],['mounted-flight-right','outfit=flight&real=1&angle=270&speed=40&height=.4'],
    ['mounted-mix-bank','outfit=flight&pieceTop=travel-drape-top&pieceTrousers=travel-drape-trousers&pieceFootwear=sandals&real=1&angle=135&speed=70&lean=.9&crouch=.25&height=.4']]){
    await open(common+'&'+extra);await capture(name);
  }
  check('no browser or shader errors',report.errors.length===0);
}catch(e){report.failure=String(e);await page.screenshot({path:path.join(output,'failure.png')});process.exitCode=1;console.error(e);}
finally{await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));await browser.close();await server.httpServer.close();}
