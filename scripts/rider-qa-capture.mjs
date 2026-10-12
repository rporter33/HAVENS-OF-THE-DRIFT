// Reuses two disposable WebGL scenes for repeatable wardrobe/material/contact review.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const base=process.env.RIDER_QA_URL??'http://127.0.0.1:5204';
const phase=process.argv[2]??'development',out=path.resolve('shots/rider-qa',phase);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:1200}});
const report={phase,renderer:'WebGL 2 / Edge SwiftShader; appearance and function only',checks:[],captures:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);console.log('PASS '+name);};
const outfits=['flight','scout','courier','racer','cartographer','skyknight','travel-drape'];
async function boot(real=false,quality='high',tod='.42'){
 await page.goto(`${base}/?view=rider&manual=1&quality=${quality}&tod=${tod}&weather=clear&headgear=none&scarf=none&cape=none&outfit=travel-drape&angle=18&dist=2.5&height=.95&camUp=.1${real?'&real=1&height=.4&speed=40':''}`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
}
async function capture(name,outfit,settings={}){
 const state=await page.evaluate(({outfit,settings})=>{
  const h=window.__dw,s=window.__riderShow,r=s.actors[0]?.rider??h.game.rider;
  const look={...r.look,outfit,outfitPrimary:outfit==='travel-drape'?'#f2eada':'#2f4a6a',outfitSecondary:outfit==='travel-drape'?'#7fa8c4':'#c89048',...settings.colors,build:settings.build??'medium',wardrobe:settings.wardrobe,headgear:'none',scarf:'none',cape:'none'};
  r.setLook(look);for(const [k,v] of Object.entries(settings.params??{}))s.params.set(k,String(v));
  if(s.actors[0]){s.actors[0].action=settings.action??'idle';s.actors[0].fixedT=settings.t??.62;}
  h.advance(1);h.render();
  const c=r.model.geometry.getAttribute('c02Surface'),surfaces=Array(5).fill(0);for(let i=0;i<c.count;i++)surfaces[c.getX(i)]++;
  return {look,triangles:r.model.geometry.index.count/3,bones:r.model.rig.skeleton.bones.length,surfaces,atlas:r.model.mesh.material.map?.image.width,
   cloth:r.cloth.pieces.map(p=>({name:p.spec.name,particles:p.cloth.n,triangles:p.geo.index.count/3,guided:!!p.guide})),
   finite:r.cloth.pieces.every(p=>Array.from(p.pos).every(Number.isFinite)),errors:h.errors};
 },{outfit,settings});
 check(name+': finite cloth, shared rig, no runtime errors',state.finite&&state.bones===27&&!state.errors.length);
 await page.screenshot({path:path.join(out,name+'.png')});report.captures.push({name,state});
}
try{
 await boot();
 for(const outfit of outfits)await capture(outfit+'-front',outfit,{params:{angle:18}});
 for(const outfit of ['cartographer','courier','skyknight','travel-drape'])await capture(outfit+'-back',outfit,{params:{angle:198}});
 await capture('bell-sleeve-wave','cartographer',{action:'wave',t:.62,params:{angle:18,dist:2.2,wind:'24,-32'}});
 await boot(true);
 for(const outfit of ['cartographer','courier','skyknight','travel-drape'])for(const side of [90,270])await capture(outfit+'-mounted-'+(side===90?'left':'right'),outfit,{params:{angle:side,dist:3.2,height:.05,lean:0,crouch:0,brace:0}});
 await capture('mixed-broad-bank','courier',{build:'broad',wardrobe:{top:'cartographer-top',trousers:'racer-trousers',chest:'flight-chest',shoulderDrape:'scout-shoulderDrape',waist:'woven-sash',armWraps:'flight-armWraps',legWraps:'skyknight-legWraps',footwear:'none'},params:{angle:135,lean:.9,dist:2.5}});
 if(phase==='production'){
  for(const quality of ['low','medium','ultra']){
   await boot(false,quality);await capture('linen-'+quality,'travel-drape');
   check(quality+': expected shared atlas dimension',report.captures.at(-1).state.atlas===({low:1024,medium:2048,ultra:4096})[quality]);
  }
  await boot(false,'high','.02');
  await capture('linen-night','travel-drape');await capture('metal-night','skyknight');
  await boot(false,'high');
  await capture('worn-leather-close','flight',{colors:{outfitPrimary:'#80634d'},params:{dist:1.7,height:1.15,angle:18}});
  await capture('linen-material-close','travel-drape',{params:{dist:1.7,height:1.15,angle:18}});
  check('high: 3K shared atlas',report.captures.at(-1).state.atlas===3072);
 }
 check('no browser or shader errors',!report.errors.length);
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));await browser.close();
}
