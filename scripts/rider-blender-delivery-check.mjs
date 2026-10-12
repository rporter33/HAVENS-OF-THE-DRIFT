// Self-contained production/subpath proof with a fresh profile and no external network.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {launchRiderBrowser,riderBrowserName} from './rider-blender-browser.mjs';
const portOption=process.argv.find(a=>a.startsWith('--port=')),port=portOption?Number(portOption.slice(7)):5213;
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid --port');
const root=path.resolve('dist'),prefix='/rider-trial/',origin='http://127.0.0.1:'+port,output='shots/rider-blender/qa-d';await fs.mkdir(output,{recursive:true});
const report={origin,prefix,profile:'fresh nonpersistent context',renderer:riderBrowserName+' SwiftShader, no hardware certification',checks:[],requests:[],errors:[]};
const check=(name,pass)=>{report.checks.push({name,passed:!!pass});if(!pass)throw Error(name);console.log('PASS '+name);};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,decodeURIComponent(url.pathname.slice(prefix.length))||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}});
let browser,context;
async function cleanup(action,run){
 try{await run();}catch(e){
  (report.cleanupErrors??=[]).push({action,error:String(e)});
  report.failure??='Cleanup failed: '+action;process.exitCode=1;console.error(action,e);
 }
}
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 browser=await launchRiderBrowser();report.browser=browser.version();
 context=await browser.newContext({viewport:{width:1440,height:1080}});const page=await context.newPage();
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 page.on('request',r=>report.requests.push(r.url()));page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(origin+prefix+'?manual=1&quality=low&riderTrial=blender',{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
 await page.evaluate(()=>{const g=window.__dw.game;g.setRiderLook({...g.rider.look,outfit:'flight',build:'medium',wardrobe:{trousers:'travel-drape-trousers',footwear:'scout-footwear'},legWraps:'none',headgear:'none',scarf:'none',cape:'none'});window.__dw.advance(.5);window.__dw.render();});
 check('production hashed GLB and loader resolve under a subpath',report.requests.some(url=>url.includes(prefix+'assets/rider-trial-')&&url.endsWith('.glb'))&&await page.evaluate(()=>window.__dw.game.rider.model.importedRegions.includes('head')&&window.__dw.game.rider.model.importedRegions.includes('legL')));
 check('all delivery requests stay on the isolated local server',report.requests.every(url=>url.startsWith(origin+prefix)));
 await context.setOffline(true);
 check('cached GLB supports dyes and look round-trips while offline',await page.evaluate(()=>{const g=window.__dw.game,look=g.rider.look;g.setRiderLook({...look,build:'broad'});const broad=!g.rider.model.importedRegions.includes('head');g.setRiderLook({...look,outfitPrimary:'#928575'});window.__dw.advance(.1);return broad&&g.rider.model.importedRegions.includes('head')&&g.rider.model.importedRegions.includes('legL');}));
 await context.setOffline(false);await page.screenshot({path:output+'/production-subpath.png'});check('production import has no console/page errors',report.errors.length===0);
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}
finally{
 if(context){
  await cleanup('reset context offline state',()=>context.setOffline(false));
  await cleanup('close context',()=>context.close());
 }
 if(browser)await cleanup('close browser',()=>browser.close());
 if(server.listening)await cleanup('close local delivery server',()=>new Promise((resolve,reject)=>{
  server.close(error=>error?reject(error):resolve());server.closeAllConnections?.();
 }));
 await cleanup('write delivery report',()=>fs.writeFile(output+'/delivery.json',JSON.stringify(report,null,2)));
}
