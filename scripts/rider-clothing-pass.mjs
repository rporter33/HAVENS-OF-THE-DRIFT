// Localized garment-cloth and lower-leg review. Browser storage is disposable.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {preview} from 'vite';
const phase=process.argv[2]??'after',out=path.resolve('shots/rider-clothing',phase);
await fs.mkdir(out,{recursive:true});
const server=phase==='before'?null:await preview({preview:{host:'127.0.0.1',port:5201,strictPort:true}});
const origin=phase==='before'?'http://127.0.0.1:5193':'http://127.0.0.1:5201';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
const report={phase,renderer:'Production WebGL / Edge SwiftShader; no hardware timing claim',checks:[],captures:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push({message:m.text(),url:page.url()});});
const check=(name,ok)=>{if(!ok)throw Error(name);report.checks.push({name,passed:true});console.log('PASS '+name);};
const looks=['flight','scout','courier','racer','cartographer','skyknight','travel-drape'];
const captures=looks.map(id=>[id,`outfit=${id}&angle=18&dist=2.7&height=.95&camUp=.15`]);
captures.push(
 ['linen-flight-boots','outfit=travel-drape&pieceFootwear=flight-footwear&angle=30&dist=1.45&height=.43&camUp=.03'],
 ['flight-linen-wraps','outfit=flight&pieceLegWraps=leather-wraps&pieceFootwear=sandals&angle=30&dist=1.45&height=.43&camUp=.03'],
 ['linen-skyknight-boots','outfit=flight&pieceTrousers=travel-drape-trousers&pieceFootwear=skyknight-footwear&pieceLegWraps=skyknight-legWraps&angle=30&dist=1.45&height=.43&camUp=.03'],
 ['racing-scout-boots','outfit=racer&pieceFootwear=scout-footwear&pieceLegWraps=scout-legWraps&angle=30&dist=1.45&height=.43&camUp=.03'],
 ['scout-mounted-left','outfit=scout&real=1&angle=90&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['scout-mounted-right','outfit=scout&real=1&angle=270&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['robe-mounted-bank','outfit=cartographer&real=1&angle=135&dist=2.7&height=.4&camUp=.15&lean=.9&speed=70'],
 ['tabard-mounted-brake','outfit=skyknight&real=1&angle=270&dist=2.7&height=.4&camUp=.15&brace=1&speed=12'],
 ['linen-mounted-left','outfit=travel-drape&real=1&angle=90&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['linen-mounted-right','outfit=travel-drape&real=1&angle=270&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['courier-mounted-left','outfit=courier&real=1&angle=90&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['courier-mounted-right','outfit=courier&real=1&angle=270&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['robe-mounted-left','outfit=cartographer&real=1&angle=90&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['robe-mounted-right','outfit=cartographer&real=1&angle=270&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['tabard-mounted-left','outfit=skyknight&real=1&angle=90&dist=2.7&height=.4&camUp=.15&speed=40'],
 ['robe-wave','outfit=cartographer&action=wave&t=.62&wind=18,-25&angle=18&dist=2.2&height=1&camUp=.1'],
 ['scout-walk','outfit=scout&action=walk&speed=2&wind=18,-25&angle=18&dist=2.7&height=.95&camUp=.15']
);
try{
 for(const [name,q] of captures){
  await page.goto(origin+'/?view=rider&manual=1&quality=medium&weather=clear&tod=.42&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&'+q,{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
  const s=await page.evaluate(()=>{const h=window.__dw;h.advance(2);h.render();const r=window.__riderShow?.actors[0]?.rider??h.game.rider;
   return {look:r.look,triangles:r.model.geometry.index.count/3,bones:r.model.rig.skeleton.bones.length,cloth:r.cloth.pieces.map(p=>({name:p.spec.name,particles:p.cloth.n,triangles:p.geo.index.count/3,guided:!!p.spec.guideSkin})),finite:Object.values(r.model.geometry.attributes).every(a=>Array.from(a.array).every(Number.isFinite))&&r.cloth.pieces.every(p=>Array.from(p.cloth.pos).every(Number.isFinite)),errors:h.errors};});
  check(name+': finite body/cloth and unchanged rig',s.finite&&s.bones===27&&!s.errors.length);
  await page.screenshot({path:path.join(out,name+'.png')});report.captures.push({name,url:page.url(),state:s});
 }
 if(phase!=='before')for(const outfit of ['scout','courier','cartographer','skyknight','travel-drape']) {
  await page.goto(origin+'/?view=rider&manual=1&quality=low&weather=clear&tod=.42&headgear=none&scarf=none&cape=none&outfit='+outfit+'&wind=0,0',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__dw?.ready,null,{timeout:120000});
  const motion=await page.evaluate(()=>{
    const h=window.__dw,r=window.__riderShow.actors[0].rider;h.advance(2);
    const panels=r.cloth.pieces.filter(p=>p.guide),start=panels.map(p=>Array.from(p.cloth.pos));
    let maxTravel=0,maxSeam=0,finite=true;
    for(const wind of ['24,-32','-30,24','0,0']){
      window.__riderShow.params.set('wind',wind);
      for(let frame=0;frame<120;frame++){
        h.advance(frame%60===0?.12:1/60);
        for(const p of panels)for(let i=0;i<p.cloth.n;i++){
          const q=i*3,delta=Math.hypot(p.cloth.pos[q]-p.guide[q],p.cloth.pos[q+1]-p.guide[q+1],p.cloth.pos[q+2]-p.guide[q+2]);
          finite&&=Number.isFinite(delta);maxTravel=Math.max(maxTravel,delta);
          if(i<p.spec.cols)maxSeam=Math.max(maxSeam,delta);
        }
      }
    }
    const moved=Math.max(...panels.flatMap((p,k)=>Array.from(p.cloth.pos,(v,i)=>Math.abs(v-start[k][i]))));
    return {outfit:r.look.outfit,panels:panels.length,moved,maxTravel,maxSeam,finite};
  });
  check(outfit+': real WebGL cloth responds to gust reversals with attached, bounded seams',motion.panels>0&&motion.moved>.001&&motion.maxTravel<.25&&motion.maxSeam<1e-6&&motion.finite);
  (report.motion??=[]).push(motion);
 }
 check('no browser or shader errors',!report.errors.length);
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));await browser.close();if(server)await server.httpServer.close();}
