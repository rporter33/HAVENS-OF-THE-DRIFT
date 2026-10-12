// Independent final-surface measurements and actual Stable/gameplay camera evidence.
// Descriptive motion samples supplement the unchanged 12 mm static / zero-crossing gates.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchRiderBrowser,riderBrowserName} from './rider-blender-browser.mjs';

const origin=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5210';
const selectedBuild=process.argv.find(a=>a.startsWith('--build='))?.split('=')[1];
if(selectedBuild&&!['slight','medium','broad'].includes(selectedBuild))throw Error('Unknown --build');
const stableOnly=process.argv.includes('--stable-only'),mixedProof=process.argv.includes('--mixed-proof');
if(mixedProof&&(!stableOnly||selectedBuild&&selectedBuild!=='medium'))throw Error('--mixed-proof requires --stable-only and the Medium build');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.resolve('shots/rider-blender/windkeel-resting-fit',stamp);
await fs.mkdir(output,{recursive:true});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const asset=JSON.parse(await fs.readFile('docs/rider-blender-trial/ASSET_MANIFEST.json','utf8'));
const report={startedUtc:new Date().toISOString(),origin,assetSha256:asset.sha256,
  mode:mixedProof?'mixed-stable-proof':stableOnly?'stable-only-fit':'full-fit',
  scope:mixedProof?'Four actual Stable rider-camera views only: Medium Flight legacy top, imported Travel Drape trousers and generated Scout Boots. Supplemental visible mix proof; does not replace the full four-case gameplay/transition fit report.':'Independent nearest final skinned surfaces, component endpoints, shoulder seam and span samples; actual Stable/follow/flight camera captures with deterministic real player state transitions.',
  renderer:'Headless '+riderBrowserName+' SwiftShader; appearance/function only, no hardware certification or physical controller playtest.',
  profile:'Fresh nonpersistent context per look; owner profiles and saves are not opened.',
  limits:'No new motion clearance tolerance is invented. Unsigned distance alone cannot prove absence of penetration. Signed values follow local triangle winding, which is not a closed-volume inside/outside test. Cloth span rays can hit a neighbouring fold and are descriptive, not a wall-thickness certificate. Visual review remains required.',
  unchangedGates:{staticFlexibleClearanceMetres:.012,liveRearLinkTriangleCrossings:0,owner:'Existing windkeelHarness.test.ts and rider-blender-windkeel-qa.mjs; run separately.'},
  sourceHashes:[],cases:[],captures:[],errors:[]};
for(const file of ['scripts/rider-blender-fit-qa.mjs','src/creatures/rider/windkeelHarness.ts','src/creatures/rider/windkeelContact.ts','src/creatures/rider/authoredConstruction.ts','src/assets/rider-blender/rider-trial.glb']){
  const bytes=await fs.readFile(file);report.sourceHashes.push({file,bytes:bytes.length,sha256:hash(bytes)});
}
const browser=await launchRiderBrowser();
report.browser=browser.version();

// Runs against the currently rendered, posed meshes. No runtime fitter or contact helper
// is imported: an exact closest-triangle BVH is built independently for each sample.
async function measure(page){return page.evaluate(async()=>{
  const {Vector3,Triangle,Ray}=await import('/node_modules/three/build/three.module.js');
  const h=window.__dw,g=h.game,r=g.rider,m=r.model,fit=m.harness;
  if(r.trialState.status!=='ready'||fit?.kind!=='windkeel')throw Error('Selected authored Windkeel is not active');
  g.scene.updateMatrixWorld(true);m.rig.skeleton.update();
  const worldVertices=mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
  const body=worldVertices(m.mesh),gear=worldVertices(fit.mesh),bp=m.geometry.attributes.position,index=m.geometry.index;
  const ranges=m.ctx.equipmentUnderlayers??[],excluded=id=>ranges.some(q=>id>=q.start&&id<q.end);
  const faces=[],linen=[],surface=m.geometry.attributes.c02Surface;
  const makeFace=(a,b,c,id)=>({ids:[a,b,c],id,a:body[a],b:body[b],c:body[c],
    min:[0,1,2].map(j=>Math.min(body[a].getComponent(j),body[b].getComponent(j),body[c].getComponent(j))),
    max:[0,1,2].map(j=>Math.max(body[a].getComponent(j),body[b].getComponent(j),body[c].getComponent(j)))});
  for(let j=0;j<index.count;j+=3){
    const ids=[0,1,2].map(k=>index.getX(j+k)),f=makeFace(...ids,j/3);
    if(ids.some(excluded)){
      if(ids.every(excluded)&&ids.every(id=>surface.getX(id)===1))linen.push(f);
    }else faces.push(f);
  }
  if(!faces.length)throw Error('No independent supporting surface');
  function tree(items){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const f of items)for(let k=0;k<3;k++){min[k]=Math.min(min[k],f.min[k]);max[k]=Math.max(max[k],f.max[k]);}
    if(items.length<=12)return {min,max,items};
    const widths=max.map((v,k)=>v-min[k]),axis=widths.indexOf(Math.max(...widths));
    items.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));const mid=Math.floor(items.length/2);
    return {min,max,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
  }
  const bvh=tree(faces),triangle=new Triangle(),closest=new Vector3(),normal=new Vector3();
  const boxDistance=(point,node)=>node.min.reduce((n,v,k)=>n+Math.max(v-point.getComponent(k),0,point.getComponent(k)-node.max[k])**2,0);
  function nearest(point){
    let squared=Infinity,selected,at=new Vector3();
    function visit(node){
      if(boxDistance(point,node)>squared)return;
      if(node.items){for(const f of node.items){triangle.set(f.a,f.b,f.c);triangle.closestPointToPoint(point,closest);const d=point.distanceToSquared(closest);if(d<squared){squared=d;selected=f;at.copy(closest);}}}
      else{const [first,second]=boxDistance(point,node.left)<=boxDistance(point,node.right)?[node.left,node.right]:[node.right,node.left];visit(first);visit(second);}
    }
    visit(bvh);triangle.set(selected.a,selected.b,selected.c).getNormal(normal);
    return {metres:Math.sqrt(squared),signedWindingMetres:point.clone().sub(at).dot(normal),supportTriangle:selected.id,supportPosition:at.toArray()};
  }
  const summarize=samples=>{const values=samples.map(s=>s.metres).sort((a,b)=>a-b);return {samples:values.length,minMetres:values[0]??null,medianMetres:values[Math.floor(values.length*.5)]??null,p95Metres:values[Math.floor(values.length*.95)]??null,maxMetres:values.at(-1)??null,
    // Reference count, never interpreted as a new motion acceptance threshold.
    samplesAboveExistingStaticReference:samples.filter(s=>s.metres>.012).length,
    negativeWindingSamples:samples.filter(s=>s.signedWindingMetres<0).length,
    worst:samples.toSorted((a,b)=>b.metres-a.metres).slice(0,8)};};
  const aerie=m.ctx.look.outfit==='travel-drape'||Object.values(m.ctx.look.wardrobe??{}).some(id=>id==='travel-drape-top'||id==='woven-sash');
  const region=r.importedAsset.regions.find(p=>p.region==='equipment:windkeel-'+(aerie?'aerie':'flight'));
  if(!region?.equipmentParts)throw Error('No explicit Windkeel component metadata');
  const parts=region.equipmentParts,gearIndex=fit.geometry.index;
  const componentFaces=parts.map(part=>{const list=[];for(let j=0;j<gearIndex.count;j+=3){const ids=[0,1,2].map(k=>gearIndex.getX(j+k));if(ids.every(i=>i>=part.startVertex&&i<part.startVertex+part.vertices))list.push(ids);}return {part,list};});
  const otherComponent=(point,own)=>{
    let best=Infinity,name,at=new Vector3();
    for(const {part,list} of componentFaces){if(part.name===own)continue;
      // Paired blue/linen ribbons deliberately overlap. Report hardware/other
      // load-path relationships instead of mistaking that overlap for a fastening.
      if(own.startsWith('Shoulder')&&part.name.replace(/_(blue|linen)$/,'')===own.replace(/_(blue|linen)$/,''))continue;
      for(const [a,b,c] of list){triangle.set(gear[a],gear[b],gear[c]);triangle.closestPointToPoint(point,closest);const d=point.distanceToSquared(closest);if(d<best){best=d;name=part.name;at.copy(closest);}}
    }
    return {component:name??null,metres:Number.isFinite(best)?Math.sqrt(best):null,position:at.toArray()};
  };
  const components=[];
  for(const part of parts){
    const samples=[];for(let i=part.startVertex;i<part.startVertex+part.vertices;i++)samples.push({vertex:i,position:gear[i].toArray(),...nearest(gear[i])});
    const stride=part.name.startsWith('Shoulder')?6:/^(Waist|Thigh|Hip)_/.test(part.name)?4:0,endpoints=[];
    if(stride&&part.vertices%stride===0){for(const [end,start] of [['first',part.startVertex],['last',part.startVertex+part.vertices-stride]]){
      const center=new Vector3();for(let k=0;k<stride;k++)center.add(gear[start+k]);center.multiplyScalar(1/stride);
      endpoints.push({end,position:center.toArray(),support:nearest(center),nearestOtherComponent:otherComponent(center,part.name)});
    }}
    components.push({name:part.name,role:part.role,range:[part.startVertex,part.startVertex+part.vertices],...summarize(samples),endpoints});
  }
  // Connectivity is measured by final bind coordinates (micrometre quantization),
  // while duplicate seam separation uses independently skinned world coordinates.
  const linenIds=[...new Set(linen.flatMap(f=>f.ids))],idToKey=new Map(),parent=new Map(),duplicates=new Map();
  for(const id of linenIds){const key=[bp.getX(id),bp.getY(id),bp.getZ(id)].map(v=>Math.round(v*1e6)).join(',');idToKey.set(id,key);if(!parent.has(key))parent.set(key,key);const group=duplicates.get(key)??[];group.push(id);duplicates.set(key,group);}
  const find=key=>{let p=key;while(parent.get(p)!==p)p=parent.get(p);let at=key;while(parent.get(at)!==p){const next=parent.get(at);parent.set(at,p);at=next;}return p;};
  for(const f of linen){const first=find(idToKey.get(f.ids[0]));for(const id of f.ids.slice(1))parent.set(find(idToKey.get(id)),first);}
  let maxSeamSeparation=0;for(const ids of duplicates.values())for(let i=1;i<ids.length;i++)maxSeamSeparation=Math.max(maxSeamSeparation,body[ids[0]].distanceTo(body[ids[i]]));
  const caps={left:[],right:[]};for(const id of linenIds){if(Math.abs(bp.getX(id))>.13*m.ctx.d.w&&bp.getY(id)>1.30*m.ctx.d.h){const side=bp.getX(id)>0?'left':'right';caps[side].push({vertex:id,position:body[id].toArray(),...nearest(body[id])});}}
  const spans=[],ray=new Ray(),hit=new Vector3(),candidateIds=linenIds.filter(id=>Math.abs(bp.getX(id))>.13*m.ctx.d.w&&bp.getY(id)>1.30*m.ctx.d.h);
  const normals=new Map();for(const f of linen){triangle.set(f.a,f.b,f.c).getNormal(normal);for(const id of f.ids){const value=normals.get(id)??new Vector3();value.add(normal);normals.set(id,value);}}
  for(let k=0;k<Math.min(24,candidateIds.length);k++){
    const id=candidateIds[Math.floor(k*candidateIds.length/Math.min(24,candidateIds.length))],point=body[id],n=normals.get(id).clone().normalize();let span=Infinity,hitTriangle;
    for(const sign of [-1,1]){ray.set(point,n.clone().multiplyScalar(sign));for(const f of linen){if(f.ids.some(v=>idToKey.get(v)===idToKey.get(id)))continue;
      if(!ray.intersectTriangle(f.a,f.b,f.c,false,hit))continue;const d=point.distanceTo(hit);if(d>1e-5&&d<span){span=d;hitTriangle=f.id;}
    }}
    spans.push({vertex:id,side:bp.getX(id)>0?'left':'right',metres:Number.isFinite(span)?span:null,hitTriangle:hitTriangle??null});
  }
  const sockets={};for(const name of Object.keys(fit.sockets??{})){const p=new Vector3();sockets[name]={available:r.equipmentSocket(name,p),world:p.toArray()};}
  return {screen:g.screen,mode:g.player.mode,camera:g.cameraRig.rig,look:r.look,actualBuild:m.ctx.d.build,
    provider:r.trialState,kind:fit.kind,harnessVisible:fit.mesh.visible,sharedSkeleton:fit.mesh.skeleton===m.rig.skeleton,
    importedRegions:m.importedRegions,bodyTriangles:index.count/3,supportTriangles:faces.length,
    excludedLooseShoulderRanges:ranges,components,sockets,
    shoulder:{linenVertices:linenIds.length,linenTriangles:linen.length,bindWeldedComponents:new Set([...parent.keys()].map(find)).size,maxDuplicateSeamSeparationMetres:maxSeamSeparation,
      capSupport:{left:summarize(caps.left),right:summarize(caps.right)},opposedSurfaceSpanSamples:spans,
      nominalConstructionThicknessMetres:.002,spanQualification:'Ray to another linen triangle along ±averaged posed normal, excluding incident/welded seam triangles; folds may also be hit, so no new thickness tolerance is asserted.'},
    contactDiagnostics:fit.geometry.userData.windkeelContact??null,
    clothPanels:r.cloth.pieces.filter(pc=>pc.spec.name.startsWith('garment-travel-drape-')).length,
    finite:body.every(p=>p.toArray().every(Number.isFinite))&&gear.every(p=>p.toArray().every(Number.isFinite))&&r.cloth.pieces.every(pc=>Array.from(pc.pos).every(Number.isFinite)),
    boot:h.boot,errors:h.errors};
});}

async function capture(page,row,name){
  const captureStarted=performance.now();
  await page.evaluate(neutral=>{const h=window.__dw;if(neutral)h.game.input.setScripted({});try{h.render();}finally{if(neutral)h.game.input.setScripted(null);}},!!row.mixedProof);
  const measured=await measure(page);
  if(!measured.finite||!measured.sharedSkeleton||!measured.harnessVisible||measured.errors.length)throw Error('Invalid authored rendered state in '+name);
  if(measured.actualBuild!==row.build)throw Error('Requested supported build was replaced in '+name);
  if(!row.flight&&!measured.importedRegions.includes('piece:shoulderDrape:aerie'))throw Error('Authored shoulder cloth is missing in '+name);
  if(row.mixedProof){
    const importedTop=measured.importedRegions.some(region=>region.startsWith('piece:top:'));
    if(measured.screen!=='stable'||measured.camera!=='stable'||measured.look.outfit!=='flight'
      ||measured.look.wardrobe?.top&&measured.look.wardrobe.top!=='outfit'
      ||measured.look.wardrobe?.trousers!=='travel-drape-trousers'||measured.look.wardrobe?.footwear!=='scout-footwear'
      ||!measured.importedRegions.includes('legL')||!measured.importedRegions.includes('legR')||importedTop)throw Error('Mixed Stable proof lost the legacy top, imported legs, Scout Boots or actual rider camera in '+name);
    row.mixedSelectionVerification={legacyTop:true,importedLegs:['legL','legR'],importedTop:false,footwear:'scout-footwear',screen:measured.screen,camera:measured.camera,qualification:'Selection/region guards plus actual Stable images; visual review required for gaps and overlaps.'};
  }
  if(!Object.values(measured.sockets).every(s=>s.available)||Object.keys(measured.sockets).length!==4)throw Error('Missing selected equipment sockets');
  const file=path.join(output,name+'.png'),screenshotStarted=performance.now();await page.screenshot({path:file,animations:'disabled'});
  const captureTiming={screenshotMs:performance.now()-screenshotStarted,totalMs:performance.now()-captureStarted};
  const entry={name,file:path.relative(process.cwd(),file),sha256:hash(await fs.readFile(file)),url:page.url(),captureTiming,...measured};
  row.samples.push(entry);report.captures.push({name,file:entry.file,sha256:entry.sha256,camera:measured.camera,screen:measured.screen,mode:measured.mode,captureTiming});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('CAPTURE '+name+' ('+measured.actualBuild+'/'+measured.mode+')');
}

try{
  const cases=mixedProof?[{id:'medium-legacy-top-travel-trousers-scout-boots',build:'medium',flight:true,mixedProof:true}]:[...['medium','slight','broad'].filter(b=>!selectedBuild||selectedBuild===b).map(build=>({id:build+'-travel',build,mix:build!=='medium'})),
    ...(!selectedBuild||selectedBuild==='medium'?[{id:'medium-flight',build:'medium',flight:true}]:[])];
  for(const item of cases){
    const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),row={...item,samples:[],transitions:[],assetResponses:[]};report.cases.push(row);
    page.on('pageerror',e=>report.errors.push({case:item.id,error:String(e)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({case:item.id,error:m.text()});});
    // Metadata only: response.body() from an asynchronous event can be evicted
    // from Chromium's inspector cache before this large GLB is read. No promise
    // escapes this callback, so such a failure cannot become unhandled.
    page.on('response',response=>{if(/rider-trial[^/]*\.glb/.test(response.url()))row.assetResponses.push({url:response.url(),status:response.status()});});
    try{
      await page.goto(origin+'/?manual=1&quality=high&weather=clear&tod=.42&riderTrial=blender',{waitUntil:'networkidle',timeout:120000});
      await page.waitForFunction(()=>window.__dw?.ready&&window.__dw.game.rider.trialState.status==='ready',null,{timeout:120000});
      if(!row.assetResponses.length)throw Error('No runtime GLB response was observed');
      const url=row.assetResponses.at(-1).url;
      // Independently GET the same delivered URL after runtime readiness. This
      // reads the local endpoint without replacing the rider's loaded asset or
      // relying on DevTools response-body retention. It certifies endpoint bytes
      // at verification time, not a retrospective hash of the browser's buffer.
      const delivered=await page.request.get(url,{timeout:120000});
      try{
        const bytes=await delivered.body();row.assetVerification={method:'Separate same-URL API GET after runtime ready',url,status:delivered.status(),bytes:bytes.length,sha256:hash(bytes)};
        if(!delivered.ok()||row.assetVerification.sha256!==report.assetSha256)throw Error('Served GLB endpoint does not match source asset manifest');
      }finally{await delivered.dispose();}
      await page.evaluate(async item=>{
        const {DEFAULT_RIDER}=await import('/src/cosmetics/catalog.ts'),g=window.__dw.game;
        const look={...DEFAULT_RIDER,outfit:item.flight||item.mix?'flight':'travel-drape',build:item.build,hair:'ponytail',headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'};
        if(item.mix)look.wardrobe={top:'travel-drape-top',trousers:'travel-drape-trousers',chest:'slate-scales',shoulderDrape:'chlamys',waist:'woven-sash',armWraps:'linen-wraps',legWraps:'leather-wraps',footwear:'sandals'};
        if(item.mixedProof)look.wardrobe={trousers:'travel-drape-trousers',footwear:'scout-footwear'};
        g.setRiderLook(look);g.openStable();g.frame(0,false);g.cameraRig.setStableFocus('rider');window.__dw.advance(2,item.mixedProof?{}:undefined);
      },item);
      if(item.mixedProof){
        await page.locator('.dw-tab').filter({hasText:/^Outfit Pieces$/}).click();
        await page.evaluate(()=>{const h=window.__dw;h.game.cameraRig.setStableFocus('rider');h.advance(1.5,{});});
      }
      // Preserve zero-dt presentation updates, but submit only capture()'s final GPU draw.
      // Queuing redundant high-quality SwiftShader frames can stall the screenshot compositor.
      for(const [view,degrees] of [['front',0],['left',90],['right',270],['back',180]]){
        await page.evaluate(({deg,neutral})=>{const h=window.__dw,g=h.game,rig=g.cameraRig.stableRig;rig.view.yaw=g.player.riderPose.yaw+deg*Math.PI/180;rig.view.pitch=.14;rig.refocus=0;rig.idle=0;rig.lookIdle=0;h.advance(.1,neutral?{}:undefined);if(neutral)g.input.setScripted({});try{g.frame(0,false);}finally{if(neutral)g.input.setScripted(null);}},{deg:degrees,neutral:!!item.mixedProof});
        await capture(page,row,item.id+'-stable-'+view);
      }
      if(stableOnly)continue;
      const takeoff=await page.evaluate(()=>{const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();g.setScreen('play');g.world.terrain.standingPoint(spawn[0],spawn[2],at);p.teleport(at,0,'landed');g.cameraRig.setOverride(null);g.cameraRig.snap(p);h.advance(.6,{flight:{flap:1}});return {mode:p.mode};});
      row.transitions.push({name:'actual-takeoff',...takeoff});if(takeoff.mode!=='flying')throw Error('Actual takeoff failed');
      for(const [side,sign] of [['left',1],['right',-1]]){
        await page.evaluate(sign=>{const h=window.__dw,g=h.game,rig=g.cameraRig.rigs.flight;rig.look.yaw=sign*Math.PI/2;rig.lookIdle=0;h.advance(.1);g.frame(0,false);},sign);
        await capture(page,row,item.id+'-gameplay-mounted-'+side);
      }
      const landing=await page.evaluate(()=>{const h=window.__dw,g=h.game,p=g.player,spawn=g.world.layout.spawn.position,at=p.foot.position.clone();g.world.terrain.standingPoint(spawn[0]-6,spawn[2]+4,at);at.y+=p.breed.standHeight+3;p.teleport(at,0,'flying',4);p.model.state.velocity.y=-2;
        for(let i=0;i<180&&p.mode==='flying';i++)h.advance(1/30,{flight:{flare:1}});const landed=p.mode;h.advance(1);h.advance(.25,{pressed:{interact:true}});const dismount=p.mode;h.advance(1);g.frame(0,false);return {landed,dismount,finished:p.mode};});
      row.transitions.push({name:'actual-landing-and-dismount',...landing});if(landing.landed!=='landed'||landing.dismount!=='dismounting'||landing.finished!=='onFoot')throw Error('Actual landing/dismount failed');
      for(const [action,sprint] of [['walk',false],['run',true]]){
        await page.evaluate(sprint=>{const h=window.__dw;h.advance(.45,{foot:{moveX:0,moveY:1,sprint}});h.game.frame(0,false);},sprint);
        await capture(page,row,item.id+'-gameplay-'+action);
      }
    }finally{await context.close();}
  }
  if(report.errors.length)throw Error('Browser errors: '+JSON.stringify(report.errors));
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);}
finally{await browser.close();report.finishedUtc=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output,cases:report.cases.length,captures:report.captures.length,errors:report.errors,failure:report.failure,visualReviewRequired:true},null,2));
