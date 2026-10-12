// Reproduce the preserved 14-second motion review with the current runtime rider/cloth.
// This scripted seat fixture supplements real-controller gameplay QA; it is not that evidence.
import fs from 'node:fs/promises';import {launchRiderBrowser,riderBrowserName} from './rider-blender-browser.mjs';
const origin=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5210';
const base='shots/rider-blender/windkeel-resting-motion',stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=base+'/'+stamp;await fs.mkdir(out,{recursive:true});
const onlyBuild=process.argv.find(a=>a.startsWith('--build='))?.split('=')[1];if(onlyBuild&&!['medium','slight','broad'].includes(onlyBuild))throw Error('Unknown --build');
const browser=await launchRiderBrowser();
const report={origin,browser:browser.version(),renderer:riderBrowserName+' SwiftShader; no hardware certification',scope:'Current animator and live cloth continuous playback of preserved motion-fit phases; scripted stand-in seat. Exact 12.4-second capture is taken during the first playback, never reconstructed by replay.',output:out,assetSha256:JSON.parse(await fs.readFile('docs/rider-blender-trial/ASSET_MANIFEST.json','utf8')).sha256,cases:[],errors:[]};
try{
 for(const build of ['medium','slight','broad'].filter(b=>!onlyBuild||b===onlyBuild)){
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.exposeFunction('__captureWindkeel12_4',async()=>{await page.screenshot({path:out+'/'+build+'-12.4.png'});});
  await page.goto(origin+'/?manual=1&quality=high&riderTrial=blender&view=rider&outfit=flight&pieceTop=travel-drape-top&pieceTrousers=travel-drape-trousers&pieceWaist=woven-sash&pieceChest=slate-scales&pieceShoulderDrape=chlamys&pieceArmWraps=linen-wraps&pieceLegWraps=leather-wraps&pieceFootwear=sandals&build='+build+'&primary=f2eada&secondary=7fa8c4&headgear=none&scarf=none&cape=none&angle=180&dist=2.4&height=1.05',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__riderShow?.actors?.[0]?.rider.trialState.status==='ready',null,{timeout:120000});
  const result=await page.evaluate(async()=>{
   const {Vector3,Object3D,Ray,Triangle}=await import('/node_modules/three/build/three.module.js'),{PLAYER_TUNING}=await import('/src/player/tuning.ts');
   const h=window.__dw,g=h.game,a=window.__riderShow.actors[0],r=a.rider,pose=a.pose,seat=new Object3D();seat.position.copy(a.home).y+=1;seat.userData={halfWidth:.55,gripOffset:new Vector3(0,.35,.45)};g.scene.add(seat);
   const sourceRegion=r.importedAsset.regions.find(p=>p.region==='equipment:windkeel-aerie'),parts=sourceRegion.equipmentParts,hip=parts.filter(p=>/^Hip_-?1_-1_flex_link$/.test(p.name));
   const sample=t=>{pose.mounted=false;pose.action='idle';pose.actionTime=t;pose.position.copy(a.home);pose.velocity.set(0,0,0);pose.airflow.set(1,0,-2);pose.yaw=0;pose.lean=0;pose.crouch=0;pose.brace=0;pose.freefallTilt=undefined;pose.freefallSteer=undefined;pose.equipment='bracer';pose.lineTension=0;seat.rotation.set(0,0,0);
    if(t>=1&&t<3){pose.action='walk';pose.actionTime=t-1;pose.velocity.z=1.6;}
    else if(t>=3&&t<4.2){pose.action='mount';pose.actionTime=(t-3)/1.2*PLAYER_TUNING.mountTime;}
    else if(t>=4.2&&t<8){pose.mounted=true;pose.action='mounted';pose.actionTime=t-4.2;pose.lean=.9*Math.sin((t-4.2)*2.2);pose.crouch=.45*(.5+.5*Math.sin(t*2));seat.rotation.z=.35*Math.sin((t-4.2)*2.2);pose.velocity.z=25;pose.airflow.set(0,0,-20);}
    else if(t>=8){pose.action='fall';pose.actionTime=t-8;pose.velocity.y=-20;pose.airflow.set(1,8,-2);pose.freefallTilt=-.8*Math.sin((t-8)*1.3);if(t>=11){pose.equipment='tether';pose.lineTension=.8+.2*Math.sin(t*2);pose.freefallTilt=undefined;pose.freefallSteer=undefined;}}
   };
   const ray=new Ray(),hit=new Vector3(),triangle=new Triangle(),direction=new Vector3();
   const intersects=(a,b,c,d,e,f)=>{
    const edge=(x,y,u,v,w)=>{direction.subVectors(y,x);const length=direction.length();if(length<1e-9)return false;ray.set(x,direction.multiplyScalar(1/length));const p=ray.intersectTriangle(u,v,w,false,hit);if(!p)return false;const t=p.distanceTo(x);return t>1e-5&&t<length-1e-5;};
    return edge(a,b,d,e,f)||edge(b,c,d,e,f)||edge(c,a,d,e,f)||edge(d,e,a,b,c)||edge(e,f,a,b,c)||edge(f,d,a,b,c);
   };
   const frames=[];let finite=true,diagnostic12_4;
   function contact(diagnostic=false){
    g.scene.updateMatrixWorld(true);r.model.rig.skeleton.update();const fit=r.model.harness,vertices=[];
    for(let i=0;i<fit.geometry.attributes.position.count;i++)vertices.push(fit.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(fit.mesh.matrixWorld));
    const surfaces=r.cloth.pieces.filter(p=>p.spec.name.startsWith('garment-travel-drape-')).map(pc=>{const pos=pc.geo.attributes.position;return {pc,name:pc.spec.name,vertices:Array.from({length:pos.count},(_,i)=>new Vector3().fromBufferAttribute(pos,i).applyMatrix4(pc.mesh.matrixWorld)),index:pc.geo.index};});
    let crossings=0;const details=[],crossingTriangles=[];
    for(const part of hip)for(let j=0;j<fit.geometry.index.count;j+=3){const ids=[0,1,2].map(k=>fit.geometry.index.getX(j+k));if(!ids.every(i=>i>=part.startVertex&&i<part.startVertex+part.vertices))continue;
     const [a,b,c]=ids.map(i=>vertices[i]);for(const surface of surfaces)for(let k=0;k<surface.index.count;k+=3){const [d,e,f]=[0,1,2].map(n=>surface.vertices[surface.index.getX(k+n)]);
      if(Math.max(a.y,b.y,c.y)<Math.min(d.y,e.y,f.y)||Math.min(a.y,b.y,c.y)>Math.max(d.y,e.y,f.y))continue;
      if(intersects(a,b,c,d,e,f)){crossings++;if(details.length<4)details.push({part:part.name,triangle:j/3,clothTriangle:k/3,panel:surface.name});
       if(diagnostic&&crossingTriangles.length<128){const clothIds=[0,1,2].map(n=>surface.index.getX(k+n));crossingTriangles.push({part:part.name,triangle:j/3,linkIds:ids,linkRows:ids.map(id=>Math.floor((id-part.startVertex)/4)),linkWorld:[a,b,c].map(v=>v.toArray()),clothTriangle:k/3,panel:surface.name,clothIds,clothPinned:clothIds.map(id=>!!surface.pc.surfacePinned[id]),clothWorld:[d,e,f].map(v=>v.toArray()),contactDirection:surface.pc.contactDirection.toArray()});}
      }
     }
    }
    if(diagnostic){
     const model=r.model,bones=model.rig.bones,scale=v=>v.set(v.x*model.ctx.d.w,v.y*model.ctx.d.h,v.z*model.ctx.d.g);
     const skin=(geo,id)=>Array.from({length:4},(_,slot)=>({bone:geo.attributes.skinIndex.getComponent(id,slot),name:bones[geo.attributes.skinIndex.getComponent(id,slot)]?.name,weight:geo.attributes.skinWeight.getComponent(id,slot)})).filter(s=>s.weight>0);
     const excluded=id=>model.ctx.equipmentUnderlayers?.some(q=>id>=q.start&&id<q.end),waist=id=>model.ctx.equipmentWaistLayers?.some(q=>id>=q.start&&id<q.end),body=model.geometry.attributes.position,bodyIndex=model.geometry.index;
     const nearestBody=(point,omitWaist=false)=>{let distance=Infinity,result;const at=new Vector3();
      for(let j=0;j<bodyIndex.count;j+=3){const ids=[0,1,2].map(k=>bodyIndex.getX(j+k));if(ids.some(excluded)||omitWaist&&ids.some(waist))continue;
       triangle.a.fromBufferAttribute(body,ids[0]);triangle.b.fromBufferAttribute(body,ids[1]);triangle.c.fromBufferAttribute(body,ids[2]);triangle.closestPointToPoint(point,at);const d=point.distanceToSquared(at);
       if(d<distance){distance=d;result={triangle:j/3,ids,waistLayer:ids.some(waist),closestBind:at.toArray(),vertices:ids.map(id=>({id,bind:new Vector3().fromBufferAttribute(body,id).toArray(),world:model.mesh.getVertexPosition(id,new Vector3()).applyMatrix4(model.mesh.matrixWorld).toArray(),surface:model.geometry.attributes.c02Surface?.getX(id),skin:skin(model.geometry,id)}))};}
      }return {...result,metres:Math.sqrt(distance)};
     };
     const panels=surfaces.map(surface=>{const pc=surface.pc,p=pc.geo.attributes.position,binding=pc.boundSurface;
      const pinned=[];for(let id=0;id<p.count;id++)if(pc.surfacePinned[id])pinned.push({id,row:Math.floor(id/pc.vu),col:id%pc.vu,bindSurface:binding?Array.from(binding.surface.positions.slice(id*3,id*3+3)):null,solverLocal:new Vector3().fromBufferAttribute(p,id).toArray(),world:surface.vertices[id].toArray(),bindingParticles:binding?Array.from(binding.particles.slice(id*3,id*3+3)):null,bindingWeights:binding?Array.from(binding.weights.slice(id*3,id*3+3)):null});
      const controls=pc.spec.rest.map((rest,id)=>({id,row:Math.floor(id/pc.spec.cols),col:id%pc.spec.cols,bind:rest.toArray(),anchorBone:pc.spec.anchorBone[id],anchorName:bones[pc.spec.anchorBone[id]]?.name,guideSkin:pc.spec.guideSkin?.[id]?.reduce((out,n,k,arr)=>{if(k%2===0)out.push({bone:n,name:bones[n]?.name,weight:arr[k+1]});return out;},[]),posedGuideWorld:pc.guide?new Vector3().fromArray(pc.guide,id*3).applyMatrix4(pc.mesh.matrixWorld).toArray():null,simulatedWorld:new Vector3().fromArray(pc.cloth.pos,id*3).applyMatrix4(pc.mesh.matrixWorld).toArray()})).filter(c=>c.anchorBone>=0||c.row<2);
      return {name:pc.spec.name,contactDirection:pc.contactDirection.toArray(),matrixWorld:pc.mesh.matrixWorld.toArray(),renderGrid:[pc.vu,pc.vv],controlGrid:[pc.spec.cols,pc.spec.rows],controlSignature:binding?.controlSignature,surfaceSignature:binding?.surfaceSignature,pinned,controls};
     });
     const links=hip.map(part=>({name:part.name,startVertex:part.startVertex,vertices:part.vertices,firstSpan:Array.from({length:Math.min(8,part.vertices)},(_,k)=>{const id=part.startVertex+k,bind=new Vector3().fromBufferAttribute(fit.geometry.attributes.position,id),world=vertices[id],roots=panels.flatMap(panel=>panel.pinned.map(root=>({panel:panel.name,id:root.id,world:root.world,metres:world.distanceTo(new Vector3().fromArray(root.world))}))).sort((a,b)=>a.metres-b.metres).slice(0,4);
      return {id,row:Math.floor(k/4),corner:k%4,sourceBindUnscaled:new Vector3().fromBufferAttribute(sourceRegion.geometry.attributes.position,id).toArray(),sourceBindScaled:scale(new Vector3().fromBufferAttribute(sourceRegion.geometry.attributes.position,id)).toArray(),runtimeBind:bind.toArray(),sourceSkin:skin(sourceRegion.geometry,id),runtimeSkin:skin(fit.geometry,id),world:world.toArray(),nearestBodyBind:nearestBody(bind),nearestNonWaistBodyBind:nearestBody(bind,true),nearestPinnedRoots:roots};
     })}));
     diagnostic12_4={time:12.4,playback:'First continuous 120 Hz playback at frame1488; screenshot and coordinates share this exact posed cloth state.',spaces:{source:'Original equipment GLB bind coordinates before build scale or runtime fitting',runtimeBind:'Fitted equipment position attribute in rider bind coordinates',world:'Final posed/rendered world coordinates, skin applied once',cloth:'Render vertices are solver-local translated by panel.matrixWorld; bindSurface and controls.bind remain binding-space references'},build:model.ctx.d.build,dimensions:{h:model.ctx.d.h,w:model.ctx.d.w,g:model.ctx.d.g},riderMatrixWorld:model.mesh.matrixWorld.toArray(),harnessMatrixWorld:fit.mesh.matrixWorld.toArray(),clothOrigin:r.cloth.origin.toArray(),pose:{action:pose.action,actionTime:pose.actionTime,equipment:pose.equipment,lineTension:pose.lineTension,position:pose.position.toArray(),velocity:pose.velocity.toArray(),airflow:pose.airflow.toArray()},contact:fit.geometry.userData.windkeelContact,links,panels,crossingTriangles,crossingTriangleLimit:128,crossings};
    }
    return {crossings,details,contact:fit.geometry.userData.windkeelContact};
   }
   for(let frame=0;frame<=1680;frame++){const t=frame/120;sample(t);r.update(frame?1/120:0,pose,seat);finite&&=r.cloth.pieces.every(pc=>Array.from(pc.pos).every(Number.isFinite));if(t>=11&&(frame%15===0||frame===1488))frames.push({time:t,...contact(frame===1488)});
    if(frame===1488){g.scene.updateMatrixWorld(true);const center=r.model.rig.bones[1].getWorldPosition(new Vector3());g.camera.position.copy(center).add(new Vector3(1.3,.15,-2.8));g.camera.lookAt(center);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera,0);await window.__captureWindkeel12_4();}
   }
   return {build:r.model.ctx.d.build,finite,kind:r.model.harness.kind,frames,maxCrossings:Math.max(...frames.map(f=>f.crossings)),at12_4:frames.find(f=>f.time===12.4),diagnostic12_4,sockets:Object.keys(r.model.harness.sockets),clothPanels:r.cloth.pieces.filter(pc=>pc.spec.name.startsWith('garment-travel-drape-')).length};
  });
  const diagnosticFile=out+'/'+build+'-12.4-binding.json';await fs.writeFile(diagnosticFile,JSON.stringify(result.diagnostic12_4,null,2));result.diagnostic12_4={file:diagnosticFile};report.cases.push(result);await page.close();
 }
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await fs.writeFile(base+'/latest.json',JSON.stringify({output:out,report:out+'/report.json'},null,2));}
console.log(JSON.stringify({output:out,cases:report.cases.map(c=>({build:c.build,finite:c.finite,maxCrossings:c.maxCrossings,at12_4:c.at12_4,diagnostic12_4:c.diagnostic12_4,clothPanels:c.clothPanels})),errors:report.errors,failure:report.failure}));
if(report.cases.some(c=>!c.finite||c.maxCrossings>0||c.clothPanels!==4||c.kind!=='windkeel'||c.frames.some(f=>f.contact?.remaining>0))||report.errors.length)process.exitCode=1;
