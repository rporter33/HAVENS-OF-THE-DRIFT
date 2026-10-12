// Fresh continuation evidence: fixed-output child scripts run in a unique directory.
// Their source, assertions, cameras and thresholds remain unchanged.
import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
const root=path.resolve('.'),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const selected=new Set((process.argv.find(a=>a.startsWith('--passes='))?.slice(9)??'a,b,accessories,stable').split(','));
const output=path.join(root,'shots/rider-blender/windkeel-resting-visuals',stamp);
await fs.mkdir(path.join(output,'docs/rider-blender-trial'),{recursive:true});
await fs.copyFile(path.join(root,'docs/rider-blender-trial/ASSET_MANIFEST.json'),path.join(output,'docs/rider-blender-trial/ASSET_MANIFEST.json'));
const report={reason:'Selected Windkeel natural fit and shoulder construction continuation.',startedUtc:new Date().toISOString(),assetSha256:JSON.parse(await fs.readFile(path.join(output,'docs/rider-blender-trial/ASSET_MANIFEST.json'),'utf8')).sha256,output:path.relative(root,output),scope:'Actual Stable and gameplay cameras plus explicitly labelled diagnostic views; software-rendered appearance evidence, no physical hardware certification.',checks:[]};
for(const [id,relative] of [['a',['scripts/rider-blender-visual-qa.mjs','a']],['b',['scripts/rider-blender-visual-qa.mjs','b']],['accessories',['scripts/rider-blender-accessory-qa.mjs']],['stable',['scripts/rider-blender-stable-qa.mjs']]].filter(([id])=>selected.has(id))){
 const args=[path.join(root,relative[0]),...relative.slice(1)];
 console.log('Run '+id);const started=Date.now(),chunks=[];
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:output,windowsHide:true});child.stdout.on('data',d=>chunks.push(d));child.stderr.on('data',d=>chunks.push(d));child.once('error',reject);child.once('exit',resolve);});
 await fs.writeFile(path.join(output,'windkeel-resting-visual-'+id+'.log'),Buffer.concat(chunks));report.checks.push({id,args:relative,exitCode:code,elapsedMs:Date.now()-started});
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(root,'shots/rider-blender/windkeel-resting-visual-checks.json'),JSON.stringify(report,null,2));console.log((code===0?'PASS ':'FAIL ')+id);if(code!==0){process.exitCode=1;break;}
}
