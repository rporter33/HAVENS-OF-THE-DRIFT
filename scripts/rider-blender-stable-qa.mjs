// Pass D supplement: actual Stable controls, parent unlocks and complete preset restoration.
import fs from 'node:fs/promises';import {launchRiderBrowser,riderBrowserName} from './rider-blender-browser.mjs';
const origin=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5210';
const out='shots/rider-blender/qa-d';await fs.mkdir(out,{recursive:true});
const browser=await launchRiderBrowser();
const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),report={origin,browser:browser.version(),renderer:riderBrowserName+' SwiftShader; no hardware certification',profile:'fresh nonpersistent context; unlock fixtures affect this context only',checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
const check=(name,pass,detail)=>{report.checks.push({name,passed:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)process.exitCode=1;};
const tab=label=>page.locator('.dw-tab').filter({hasText:new RegExp('^'+label+'$')}).click();
const pick=label=>page.locator('.dw-stable-body').getByText(label,{exact:true}).last().click();
try{
 await page.goto(origin+'/?manual=1&quality=low&riderTrial=blender',{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
 const metadata=await page.evaluate(async()=>{const {cosmeticsFor,COSMETICS}=await import('/src/cosmetics/catalog.ts'),{isOptionUnlocked}=await import('/src/ui/viewModel.ts');
  const g=window.__dw.game,parents=cosmeticsFor('riderOutfit').map(o=>({id:o.id,name:o.name,locked:!isOptionUnlocked(g.save,o),pieces:COSMETICS.filter(p=>p.sourceOutfit===o.id).map(p=>({id:p.id,name:p.name,slot:p.slot,locked:!isOptionUnlocked(g.save,p)}))}));
  return {parents,wardrobeTab:(await import('/src/ui/stableModel.ts')).STABLE_TABS.find(t=>t.sections.some(s=>s.slot==='riderOutfit')).label};
 });
 check('all parent outfits consistently gate their individual pieces',metadata.parents.every(p=>p.pieces.every(x=>x.locked===p.locked)),metadata.parents);
 await page.evaluate(()=>{const g=window.__dw.game;g.openStable();g.frame(0,true);});await tab('Outfit Pieces');
 for(const parent of metadata.parents.filter(p=>p.locked)){
  const before=await page.evaluate(()=>JSON.stringify(window.__dw.game.rider.look));const choice=parent.pieces.find(p=>p.slot==='riderTop');await pick(choice.name);
  check('locked '+parent.id+' top cannot change actual preview',await page.evaluate(before=>JSON.stringify(window.__dw.game.rider.look)===before,before));
 }
 // Fixture existing unlock records in this isolated context; never rewrite the catalog/rules.
 await page.evaluate(async()=>{const {cosmeticsFor}=await import('/src/cosmetics/catalog.ts');const g=window.__dw.game;g.save.data.unlocked.push(...cosmeticsFor('riderOutfit').map(o=>'riderOutfit:'+o.id));});
 for(const parent of metadata.parents){
  await tab(metadata.wardrobeTab);await pick(parent.name);await tab('Outfit Pieces');
  const before=await page.evaluate(()=>{const r=window.__dw.game.rider;return {outfit:r.look.outfit,skin:r.look.skin,hair:r.look.hair,hairColor:r.look.hairColor,outfitPrimary:r.look.outfitPrimary,outfitSecondary:r.look.outfitSecondary};});
  await pick(parent.id==='travel-drape'?"Scout's Tunic":'Linen Chiton');
  await pick('Bare Feet');
  await pick('Restore all outfit pieces');
  const after=await page.evaluate(()=>{const r=window.__dw.game.rider;window.__dw.advance(.1);return {look:r.look,status:r.trialState.status,regions:r.model.importedRegions};});
  check('actual complete preset restoration: '+parent.id,after.look.outfit===parent.id&&!after.look.wardrobe&&Object.entries(before).every(([k,v])=>after.look[k]===v)&&after.status==='ready',after);
 }
 await page.locator('.dw-stable-foot .dw-btn').filter({hasText:'Save & leave'}).click();const saved=await page.evaluate(()=>JSON.stringify(window.__dw.game.save.data.rider));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
 check('restored complete preset saves and reloads intact',await page.evaluate(saved=>JSON.stringify(window.__dw.game.save.data.rider)===saved,saved));check('no page errors',report.errors.length===0,report.errors);
 await page.screenshot({path:out+'/stable-restoration.png',animations:'disabled'});
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}finally{await fs.writeFile(out+'/stable-transactions.json',JSON.stringify(report,null,2));await browser.close();}
