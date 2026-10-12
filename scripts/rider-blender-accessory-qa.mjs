// Pass B supplement: preserve every hair/headgear/scarf/cape provider on all builds.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import {chromium} from 'playwright';
const out='shots/rider-blender/qa-b-accessories';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),report={scope:'actual Stable camera; every accessory individually with authored Travel pieces, three supported builds',captures:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:5210/?manual=1&quality=low&riderTrial=blender',{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
 await page.evaluate(()=>{const g=window.__dw.game;g.openStable();g.frame(0,true);g.cameraRig.setStableFocus('rider');window.__dw.advance(2);});
 const cases=await page.evaluate(async()=>{const {cosmeticsFor,DEFAULT_RIDER}=await import('/src/cosmetics/catalog.ts'),{TRAVEL_PIECES}=await import('/src/cosmetics/wardrobe.ts');const rows=[];
  for(const build of ['slight','medium','broad'])for(const [key,slot] of [['hair','riderHair'],['headgear','riderHeadgear'],['scarf','riderScarf'],['cape','riderCape']])for(const o of cosmeticsFor(slot))rows.push({id:build+'-'+key+'-'+o.id,look:{...DEFAULT_RIDER,...TRAVEL_PIECES,build,outfit:'flight',wardrobe:{top:'travel-drape-top',trousers:'travel-drape-trousers',chest:'slate-scales',shoulderDrape:'chlamys',waist:'woven-sash',armWraps:'linen-wraps',legWraps:'leather-wraps',footwear:'sandals'},headgear:'none',scarf:'none',cape:'none',[key]:o.id}});
  return rows;
 });
 for(const row of cases){
  const state=await page.evaluate(look=>{const h=window.__dw,g=h.game;g.setRiderLook(look);h.advance(.35);h.render();return {build:g.rider.model.ctx.d.build,status:g.rider.trialState.status,regions:g.rider.model.importedRegions,cloth:g.rider.cloth.pieces.map(p=>p.spec.name),finite:g.rider.cloth.pieces.every(p=>Array.from(p.pos).every(Number.isFinite))};},row.look);
  if(state.status!=='ready'||!state.finite||!state.regions.includes('piece:shoulderDrape:aerie')||(state.build==='medium'&&!state.regions.includes('head')))throw Error('Authored accessory case failed '+row.id);
  const filename=out+'/'+row.id+'.png';await page.screenshot({path:filename,animations:'disabled'});report.captures.push({...row,...state,sha256:crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex')});
 }
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify({captures:report.captures.length,errors:report.errors,failure:report.failure}));
