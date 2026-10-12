import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const likeness=process.argv.includes('--likeness'),out='shots/rider-blender/'+(likeness?'likeness':'shoulder-correction');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),report={errors:[],captures:[]};page.on('pageerror',e=>report.errors.push(String(e)));
try{
 const views=likeness?[['face-front','angle=0&height=1.65&dist=1.1&camUp=-.2'],['face-profile','angle=90&height=1.65&dist=1.1&camUp=-.2'],['body-three-quarter','angle=25']]:[['front','angle=0'],['left','angle=90'],['right','angle=270'],['back','angle=180'],['raised-front','angle=0&action=wave&t=.62'],['raised-left','angle=90&action=wave&t=.62'],['raised-right','angle=270&action=wave&t=.62'],['mounted-left','angle=90&real=1&dist=4.6&height=-.1'],['mounted-right','angle=270&real=1&dist=4.6&height=-.1']];
 for(const [name,extra] of views){
  const q=new URLSearchParams('manual=1&quality=high&riderTrial=blender&view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&dist=2.4&height=1.05&tod=.42');for(const [k,v] of new URLSearchParams(extra))q.set(k,v);
  await page.goto('http://127.0.0.1:5210/?'+q,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>window.__dw?.ready&&(window.__riderShow?.actors?.[0]?.rider??window.__dw.game.rider).trialState.status==='ready',null,{timeout:120000});
  await page.evaluate(()=>{window.__dw.advance(.5);window.__dw.render();});await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});report.captures.push(name);
 }
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify(report));
