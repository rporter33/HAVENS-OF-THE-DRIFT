// Final selected Windkeel adapter; unchanged existing tolerances and assertions.
import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
const checks=[
 ['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],
 ['unit',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1','--reporter=dot']],
 ['legacy-audit',['node_modules/vitest/vitest.mjs','run','--config','scripts/rider-qa.config.mjs','--maxWorkers=1']],
 ['authored-audit',['node_modules/vitest/vitest.mjs','run','--config','scripts/rider-blender-qa.config.mjs','--maxWorkers=1']],
 ['build',['node_modules/vite/bin/vite.js','build']],
];
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),phase='windkeel-resting-'+stamp;
const output=path.join('shots/rider-blender/windkeel-resting-checks',stamp),prefix=path.join(output,'windkeel-resting-final-');
await fs.mkdir(output,{recursive:true});
const report={reason:'Continuation: naturally resting selected Windkeel and thin connected shoulder cloth. Original legacy and authored garment audits remain separate required checks.',startedUtc:new Date().toISOString(),output,assetSha256:JSON.parse(await fs.readFile('docs/rider-blender-trial/ASSET_MANIFEST.json','utf8')).sha256,checks:[]};
for(const [id,args] of checks){
 console.log('Run '+id);const started=Date.now(),chunks=[];
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,RIDER_QA_PASS:phase}});child.stdout.on('data',c=>chunks.push(c));child.stderr.on('data',c=>chunks.push(c));child.once('error',reject);child.once('exit',resolve);});
 await fs.writeFile(prefix+id+'.log',Buffer.concat(chunks));report.checks.push({id,args,exitCode:code,elapsedMs:Date.now()-started});
 if(id.endsWith('-audit')){
  const dir=id==='legacy-audit'?'shots/rider-qa':'shots/rider-blender/qa-b';
  const saved=path.join(output,id);await fs.mkdir(saved,{recursive:true});
  for(const filename of [phase+'-clearance.json','contact-cpu-cost.json']){
   try{await fs.copyFile(path.join(dir,filename),path.join(saved,filename));}catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 await fs.writeFile(prefix+'checks.json',JSON.stringify(report,null,2));
 await fs.writeFile('shots/rider-blender/windkeel-resting-final-checks.json',JSON.stringify(report,null,2));
 console.log((code===0?'PASS ':'FAIL ')+id);if(code!==0){process.exitCode=1;break;}
}
