// Actual rAF gameplay on the local GPU, with fresh contexts and matched production builds.
// CPU submission and frame cadence are measured; neither is a GPU timing query or VRAM total.
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='shots/rider-blender/qa-performance';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const report={browser:browser.version(),backendRequest:'ANGLE D3D11, headless Edge; no SwiftShader flag',viewport:{width:1440,height:1080},deviceScaleFactor:1,durationSeconds:20,profile:'fresh nonpersistent context per case',limits:'Dedicated local GPU only if renderer confirms it; no integrated GPU certification, no GPU timer query, no total VRAM measurement',asset:JSON.parse(await fs.readFile('docs/rider-blender-trial/ASSET_MANIFEST.json','utf8')).sha256,cases:[],errors:[]};
// This read-only inventory runs after the timed sample. It observes bound resources;
// no lazy texture getters/factories are called to discover unallocated normal maps.
async function memoryInventory(page,cycleQuality){return page.evaluate(async cycleQuality=>{
 const g=window.__dw.game,r=g.rider,renderer=g.renderer.gl,bufferIds=new WeakMap(),bufferBytes=new Map(),encounteredTextures=new Map();let nextBuffer=1;
 function bufferId(buffer){let id=bufferIds.get(buffer);if(!id){id=nextBuffer++;bufferIds.set(buffer,id);bufferBytes.set(id,buffer.byteLength);}return id;}
 const total=ids=>[...new Set(ids)].reduce((sum,id)=>sum+(bufferBytes.get(id)??0),0);
 const arrayOf=attribute=>attribute?.isInterleavedBufferAttribute?attribute.data.array:attribute?.array;
 function arraysInventory(arrays){
  const views=[...new Set(arrays.filter(a=>ArrayBuffer.isView(a)))],ids=[...new Set(views.map(a=>bufferId(a.buffer)))];
  return {arrayViews:views.length,arrayViewBytes:views.reduce((sum,a)=>sum+a.byteLength,0),uniqueArrayBuffers:ids.length,uniqueArrayBufferBytes:total(ids),bufferIds:ids};
 }
 function geometryInventory(items){
  const unique=new Map();for(const item of items)if(item.geometry&&!unique.has(item.geometry.uuid))unique.set(item.geometry.uuid,item);
  const entries=[],arrays=[];for(const {geometry,role} of unique.values()){
   const views=[...Object.values(geometry.attributes).map(arrayOf),arrayOf(geometry.index),...Object.values(geometry.morphAttributes??{}).flatMap(list=>list.map(arrayOf))].filter(Boolean);
   arrays.push(...views);entries.push({uuid:geometry.uuid,role,vertices:geometry.attributes.position?.count??0,triangles:geometry.index?geometry.index.count/3:null,...arraysInventory(views)});
  }
  return {geometries:entries.length,...arraysInventory(arrays),entries};
 }
 function imageInventory(texture){
  const image=texture.image??texture.source?.data,images=Array.isArray(image)?image:[image],views=[],dimensions=[];
  for(const item of images){if(!item)continue;const width=item.width??item.videoWidth??item.naturalWidth??null,height=item.height??item.videoHeight??item.naturalHeight??null,depth=item.depth??1;dimensions.push({width,height,depth});if(ArrayBuffer.isView(item.data))views.push(item.data);}
  for(const mip of texture.mipmaps??[])if(ArrayBuffer.isView(mip?.data))views.push(mip.data);
  let rgba8BaseEquivalent=0,rgba8MipEquivalent=0;for(const {width,height,depth} of dimensions)if(width&&height){rgba8BaseEquivalent+=width*height*depth*4;let w=width,h=height;do{rgba8MipEquivalent+=w*h*depth*4;if(!texture.generateMipmaps)break;w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));}while(w>1||h>1);if(texture.generateMipmaps&&(width>1||height>1))rgba8MipEquivalent+=depth*4;}
  return {dimensions,...arraysInventory(views),rgba8BaseEquivalentBytes:rgba8BaseEquivalent,rgba8GeneratedMipEquivalentBytes:rgba8MipEquivalent};
 }
 function textureInventory(){
  const found=new Map(),materialIds=new Set();
  const add=(texture,owner)=>{if(!texture?.isTexture)return;const previous=found.get(texture.uuid);if(previous)previous.owners.push(owner);else found.set(texture.uuid,{texture,owners:[owner]});};
  function uniformTextures(value,owner,seen=new WeakSet()){
   if(!value||typeof value!=='object')return;if(value.isTexture){add(value,owner);return;}if(ArrayBuffer.isView(value)||seen.has(value))return;seen.add(value);
   if(Array.isArray(value)){for(const item of value)uniformTextures(item,owner,seen);}else for(const [key,item] of Object.entries(value))uniformTextures(item,owner+'.'+key,seen);
  }
  g.scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
   materialIds.add(material.uuid);for(const [key,value] of Object.entries(material))if(value?.isTexture)add(value,object.name+':'+key);
   if(material.uniforms)uniformTextures(material.uniforms,object.name+':uniforms');
  }});add(g.scene.background,'scene.background');add(g.scene.environment,'scene.environment');
  const entries=[];for(const {texture,owners} of found.values()){
   const image=imageInventory(texture),uploaded=!!renderer.properties.get(texture).__webglTexture;
   const record={uuid:texture.uuid,name:texture.name,owners,format:texture.format,type:texture.type,colorSpace:texture.colorSpace,generateMipmaps:texture.generateMipmaps,minFilter:texture.minFilter,uploadedObserved:uploaded,...image};
   let historical=encounteredTextures.get(texture.uuid);if(!historical){historical={...record,firstQuality:g.settings.quality,qualities:[],disposeObserved:false};encounteredTextures.set(texture.uuid,historical);
    // The record holds metadata only. A WeakMap identifies ArrayBuffers without
    // retaining disposed source buffers solely for the QA observation.
    texture.addEventListener('dispose',()=>{historical.disposeObserved=true;});
   }
   historical.lastQuality=g.settings.quality;historical.lastUploadedObserved=uploaded;historical.bufferIds=image.bufferIds;historical.uniqueArrayBufferBytes=image.uniqueArrayBufferBytes;
   if(!historical.qualities.includes(g.settings.quality))historical.qualities.push(g.settings.quality);entries.push(record);
  }
  const ids=entries.flatMap(e=>e.bufferIds);return {textures:entries.length,materials:materialIds.size,uniqueDataArrayBuffers:new Set(ids).size,uniqueDataArrayBufferBytes:total(ids),entries};
 }
 function snapshot(label){
  const imported=r.importedAsset,sourceItems=(imported?.regions??[]).map(region=>({geometry:region.geometry,role:region.build+'/'+region.region}));
  const cachedSource=geometryInventory(sourceItems),cages=arraysInventory((imported?.regions??[]).flatMap(region=>[region.cagePositions,region.cageIndices]));
  const drawn=geometryInventory([{geometry:r.model.geometry,role:'rider body'},...r.cloth.pieces.map(pc=>({geometry:pc.geo,role:'live cloth '+pc.spec.name})),...(r.model.harness?[{geometry:r.model.harness.geometry,role:'selected '+r.model.harness.kind+' harness'}]:[])]);
  const sceneItems=[];g.scene.traverse(object=>{if(object.geometry)sceneItems.push({geometry:object.geometry,role:object.name||object.type});});const sceneGeometries=geometryInventory(sceneItems);
  const auxiliary=[];for(const pc of r.cloth.pieces){for(const value of Object.values(pc))if(ArrayBuffer.isView(value))auxiliary.push(value);for(const value of Object.values(pc.cloth))if(ArrayBuffer.isView(value))auxiliary.push(value);if(pc.boundSurface){auxiliary.push(pc.boundSurface.surface.positions);for(const value of Object.values(pc.boundSurface))if(ArrayBuffer.isView(value))auxiliary.push(value);}}
  const clothArrays=arraysInventory(auxiliary),textures=textureInventory(),decodeIds=[...cachedSource.bufferIds,...cages.bufferIds],coexistingIds=[...decodeIds,...sceneGeometries.bufferIds,...drawn.bufferIds,...clothArrays.bufferIds,...textures.entries.flatMap(t=>t.bufferIds)];
  return {label,quality:g.settings.quality,rendererMemory:{...renderer.info.memory,programs:renderer.info.programs.length},
   imported:{regionCount:imported?.regions.length??0,encodedGlbDeliveryBytes:imported?.bytes??0,encodedBytesQualification:'Delivery length only; not added to retained decoded buffers. Browser/network/raw-buffer retention is unknown.',cachedRegionGeometries:cachedSource,fittingCageArrays:cages,retainedDecodeUniqueArrayBuffers:new Set(decodeIds).size,retainedDecodeArrayBufferBytesLowerBound:total(decodeIds)},
   renderedRiderGeometries:drawn,sceneReferencedGeometries:sceneGeometries,clothAuxiliaryArrays:clothArrays,textures,
   coexistingObservedUniqueArrayBuffers:new Set(coexistingIds).size,coexistingObservedArrayBufferBytesLowerBound:total(coexistingIds),
   limits:'Scene traversal includes hidden objects/material references. Totals deduplicate ArrayBuffers across categories; logical view bytes are separate. Excludes JS objects/recipes/control arrays, driver copies, render targets/shadows/postprocessing not referenced by scene materials, browser caches and unobserved module resources. Not total RAM or VRAM.'};
 }
 const snapshots=[snapshot('after matched measurement and dye check')];
 if(cycleQuality)for(const quality of ['low','medium','high','ultra','low']){
  g.applySettings({...g.settings,quality});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  snapshots.push(snapshot('post-measurement quality '+quality));
 }
 const encountered=[...encounteredTextures.values()],undisposed=encountered.filter(t=>!t.disposeObserved),knownRiderAtlas=undisposed.filter(t=>/^C02 M01 /.test(t.name));
 return {scope:'Descriptive resource inventory after the original timed case; quality cycling happens only in the Stable trial context.',snapshots,
  qualityCycle:cycleQuality?['low','medium','high','ultra','low']:[],
  encounteredTextureCache:{textures:encountered,encounteredCount:encountered.length,disposeObservedCount:encountered.length-undisposed.length,
   undisposedEncounteredDataArrayBufferBytes:total(undisposed.flatMap(t=>t.bufferIds)),
   knownRiderAtlasCacheDataBytesLowerBound:total(knownRiderAtlas.flatMap(t=>t.bufferIds)),
   knownRiderAtlasResolutions:[...new Set(knownRiderAtlas.flatMap(t=>t.dimensions.map(d=>d.width)))].sort((a,b)=>a-b),
   qualification:'Union of bound textures encountered across changes. Dispose events are observed. Known rider atlas/material caches retain encountered atlases; unobserved/lazy normal maps are not allocated or assumed present by this inventory. Other undisposed encounters do not establish JS reachability or exact physical GPU residency. RGBA8 equivalents describe size, not measured driver allocation.'}};
 },cycleQuality);}
try{
 measurements: for(const [scene,quality] of [...['low','medium','high','ultra'].map(q=>['mounted',q]),['foot','low'],['stable','high']])for(const variant of ['current','trial']){
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1}),page=await context.newPage();const row={scene,quality,variant,durationSeconds:scene==='mounted'&&quality==='low'?60:report.durationSeconds};console.log('Measure '+JSON.stringify(row));
  page.on('pageerror',e=>report.errors.push({...row,error:String(e)}));
  try{
   const origin=variant==='current'?'http://127.0.0.1:5211':'http://127.0.0.1:5214';
   await page.goto(origin+'/?debug=1&quality='+quality+'&weather=clear&tod=.42'+(variant==='trial'?'&riderTrial=blender':''),{waitUntil:'networkidle',timeout:180000});
   await page.waitForFunction(trial=>window.__dw?.ready&&(!trial||window.__dw.game.rider.trialState.status==='ready'),variant==='trial',{timeout:180000});
   row.renderer=await page.evaluate(()=>{const gl=window.__dw.game.renderer.gl.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
   if(/swiftshader|llvmpipe|software|basic render/i.test(row.renderer.renderer))throw Error('Physical GPU not confirmed: '+row.renderer.renderer);
   await page.evaluate(scene=>{
    const g=window.__dw.game,p=g.player;g.setRiderLook({...g.rider.look,outfit:'travel-drape',build:'medium',wardrobe:undefined,headgear:'none',scarf:'none',cape:'none',outfitPrimary:'#f2eada',outfitSecondary:'#7fa8c4'});
    if(scene==='stable'){g.openStable();g.cameraRig.setStableFocus('rider');}
    else {g.setScreen('play');g.cameraRig.setOverride(null);const at=p.foot.position.clone();
     if(scene==='mounted'){at.set(0,1100,-90);p.teleport(at,0,'flying',28);g.input.setScripted({flight:{pitch:.08,roll:.15}});}
     else {const spawn=g.world.layout.spawn.position;g.world.terrain.standingPoint(spawn[0]-5,spawn[2]+4,at);p.teleport(at,0,'onFoot');g.input.setScripted({foot:{moveX:0,moveY:1,sprint:false}});}
     g.cameraRig.snap(p);
    }
   },scene);
   // Real loop warmup, then measure twenty wall-clock seconds without manual advance().
   await page.waitForTimeout(2000);
   row.measurement=await page.evaluate(seconds=>new Promise(resolve=>{
    const g=window.__dw.game,start=performance.now(),frame=g.frame.bind(g),cpu=[],cadence=[];let previous;
    g.frame=(...args)=>{const t=performance.now();const result=frame(...args);if(args[1]!==false)cpu.push(performance.now()-t);return result;};
    const sample=now=>{if(previous!==undefined)cadence.push(now-previous);previous=now;
     if(now-start<seconds*1000){requestAnimationFrame(sample);return;}
     g.frame=frame;g.input.setScripted(null);const summary=values=>{values.sort((a,b)=>a-b);return {samples:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],maxMs:values.at(-1)};};
     const gl=g.renderer.gl,r=g.rider,bytes=geo=>Object.values(geo.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(geo.index?.array.byteLength??0);
     resolve({elapsedMs:now-start,raf:summary(cadence),cpuSubmission:summary(cpu),render:{...gl.info.render},memory:{...gl.info.memory,programs:gl.info.programs.length},drawingBuffer:{width:gl.domElement.width,height:gl.domElement.height},screen:g.screen,mode:g.player.mode,trial:r.trialState?.status??'baseline',regions:r.model.importedRegions??[],bodyBytes:bytes(r.model.geometry),clothBytes:r.cloth.pieces.reduce((n,p)=>n+bytes(p.geo),0),harness:r.model.harness?{kind:r.model.harness.kind,bytes:bytes(r.model.harness.geometry),triangles:r.model.harness.geometry.index.count/3,vertices:r.model.harness.geometry.attributes.position.count,visible:r.model.harness.mesh.visible,sharedSkeleton:r.model.harness.mesh.skeleton===r.model.rig.skeleton}:null,finite:r.cloth.pieces.every(p=>Array.from(p.pos).every(Number.isFinite)),boot:window.__dw.boot,errors:window.__dw.errors});
    };requestAnimationFrame(sample);
   }),row.durationSeconds);
   if(!row.measurement.finite||row.measurement.errors.length)throw Error('Nonfinite cloth or runtime errors');
   if(scene==='mounted'&&row.measurement.mode!=='flying'||scene==='foot'&&row.measurement.mode!=='onFoot'||scene==='stable'&&row.measurement.screen!=='stable')throw Error('Measured scene changed mode: '+JSON.stringify({scene,mode:row.measurement.mode,screen:row.measurement.screen}));
   if(scene==='stable')row.recolor=await page.evaluate(()=>{const g=window.__dw.game,r=g.rider,look=r.look,geometry=r.model.geometry,skeleton=r.model.rig.skeleton,solvers=r.cloth.pieces.map(p=>p.cloth),samples=[];let retained=true;for(let i=0;i<20;i++){const start=performance.now();g.setRiderLook({...look,outfitPrimary:i%2?'#315e9c':'#f2eada',outfitSecondary:i%2?'#f2eada':'#7fa8c4',skin:i%2?'#6a4230':'#d09a74',hairColor:i%2?'#d8b070':'#3a2a20'});samples.push(performance.now()-start);retained&&=r.model.geometry===geometry&&r.model.rig.skeleton===skeleton&&r.cloth.pieces.every((p,j)=>p.cloth===solvers[j]);}g.setRiderLook(look);samples.sort((a,b)=>a-b);return {samples:20,medianMs:samples[10],p95Ms:samples[19],retained,scope:'CPU dye update only; all twenty changes include skin/hair/cloth, excludes subsequent GPU upload/render'};});
   await page.screenshot({path:out+'/'+scene+'-'+quality+'-'+variant+'.png',animations:'disabled'});
   row.memoryInventory=await memoryInventory(page,scene==='stable'&&variant==='trial');
  }catch(e){row.failure=String(e);process.exitCode=1;console.error(e);}
  finally{report.cases.push(row);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await context.close();}
  if(row.failure&&/GPU not confirmed/.test(row.failure))break measurements;
 }
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({cases:report.cases.length,failures:report.cases.filter(r=>r.failure),errors:report.errors},null,2));
