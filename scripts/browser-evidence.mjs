import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const git=(...args)=>spawnSync('git',args,{encoding:'utf8'}).stdout?.trim()??'';
/** Evidence identifies the built page as well as the runner checkout. A baseline
 * comparison may deliberately target a different saved, explicitly named build. */
export async function browserEvidence(page,url){
  const runnerHead=git('rev-parse','HEAD');
  const requested=process.argv.find(a=>a.startsWith('--expected-head='))?.slice(16)??runnerHead;
  const testedHead=git('rev-parse','--verify',`${requested}^{commit}`);
  assert.match(testedHead,/^[a-f0-9]{40}$/);
  const runtime=await page.evaluate(()=>{
    const g=__dw.game;g.startGame();g.pause();g.frame(0,false);
    const buildStamp=document.querySelector('.dw-pause-build')?.textContent?.trim()??'';
    const assets=[...document.querySelectorAll('script[src]')].map(s=>s.src);
    g.quitToTitle();g.frame(0,false);
    return {buildStamp,assets,userAgent:navigator.userAgent};
  });
  assert.ok(runtime.buildStamp.startsWith(`Build ${testedHead.slice(0,7)}`),`expected ${testedHead}; loaded ${runtime.buildStamp}`);
  return {testedHead,testedTree:git('rev-parse',`${testedHead}^{tree}`),runnerHead,
    runnerDirty:git('status','--porcelain').length>0,capturedAt:new Date().toISOString(),url:url.href,...runtime};
}
