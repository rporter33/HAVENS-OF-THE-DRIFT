// Run every existing verify.yml browser command, sequentially, retaining inherited failures.
// Original test sources/assertions stay unchanged. Only output locations are isolated.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
const root=path.resolve('.'),out=path.join(root,'shots/rider-blender/full-browser');await fs.mkdir(out,{recursive:true});
const option=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const origin=option('production','http://127.0.0.1:5214'),dev=option('dev','http://127.0.0.1:5210'),comparison=option('comparison','http://127.0.0.1:5211'),comparisonHead=option('comparison-head',undefined);
const commands=[['windline-gameplay-check'],['windline-flow-check'],['windline-reticle-check'],['windline-reticle-motion-check'],['editor-check'],['audio-qa','audio'],['windline-hud-layout-check'],['windline-hud-layout-check','--device=gamepad','--review-viewports'],['windline-performance-check','--assert-cost','--evidence=rider-trial'],['windhaven-smoke'],['sky-lance-check'],['sky-lance-check','--motion-only'],['sky-lance-check','--control-only'],['sky-lance-check','--input-only'],['sky-lance-check','--spin-only','--expect-retained','--evidence=rider-trial']];
const report={scope:'All existing verify.yml experimental-browser commands; normal provider opt-out, production build except existing source audio harness; dedicated authored checks are separate',backend:'Each original script retains its own browser flags. Installed Edge selected through CHROMIUM_PATH.',outputAdapter:'rider-blender-qa-output.cjs redirects hardcoded /tmp output to this trial only; assertions and thresholds unchanged',checks:[]};
async function run(name,args,url,id){
 const script=path.join(root,'scripts',name+'.mjs'),cwd=path.join(out,id,'workspace'),tmp=path.join(out,id,'tmp');await fs.mkdir(cwd,{recursive:true});await fs.mkdir(tmp,{recursive:true});
 const argv=['--require',path.join(root,'scripts/rider-blender-qa-output.cjs'),script,url,...args,...(url===comparison&&comparisonHead?['--expected-head='+comparisonHead]:[])];
 const env={...process.env,CHROMIUM_PATH:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',DW_QA_TMP:tmp,EDITOR_EVIDENCE_DIR:path.join(tmp,'editor-evidence')};
 console.log('Run '+id);const started=Date.now(),chunks=[];
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,argv,{cwd,env,windowsHide:true});child.stdout.on('data',d=>chunks.push(d));child.stderr.on('data',d=>chunks.push(d));child.once('error',reject);child.once('exit',resolve);});
 await fs.writeFile(path.join(out,id+'.log'),Buffer.concat(chunks));const result={id,script:name,sourceSha256:crypto.createHash('sha256').update(await fs.readFile(script)).digest('hex'),url,args,exitCode:code,elapsedMs:Date.now()-started};report.checks.push(result);await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log((code===0?'PASS ':'FAIL ')+id);return result;
}
try{for(let i=0;i<commands.length;i++){
 const [name,...raw]=commands[i],args=raw[0]==='audio'?[path.join(out,'audio')]:raw;
 const result=await run(name,args,name==='audio-qa'?dev:origin,String(i+1).padStart(2,'0')+'-'+name);
 if(result.exitCode!==0){process.exitCode=1;if(name!=='audio-qa'){const baselineRun=await run(name,args,comparison,'baseline-'+String(i+1).padStart(2,'0')+'-'+name);result.baselineComparison={id:baselineRun.id,exitCode:baselineRun.exitCode};}else result.baselineComparison={status:'not run: preserved production build does not expose the source-only audio helper'};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>c.exitCode!==0),failure:report.failure},null,2));
