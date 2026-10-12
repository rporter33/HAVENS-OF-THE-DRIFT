import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),report={errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:5210/?manual=1&quality=low&riderTrial=blender&view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&dist=2.7&height=.95',{timeout:120000});
 await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
 await page.waitForFunction(()=>window.__riderShow.actors[0].rider.trialState.status!=='loading',null,{timeout:120000});
 report.model=await page.evaluate(()=>{const r=window.__riderShow.actors[0].rider;window.__dw.advance(1);window.__dw.render();return {trial:r.trialState,regions:r.model.importedRegions,vertices:r.model.geometry.attributes.position.count,cloth:r.cloth.pieces.map(p=>[p.spec.name,p.vu,p.vv])};});
 await page.screenshot({path:'shots/rider-blender/first-authored.png'});
 if(report.model.trial.status!=='ready'||report.errors.length)process.exitCode=1;
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await fs.writeFile('shots/rider-blender/probe.json',JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify(report));
