// Real WebAudio capture and bounded normal-game audio QA; no autoplay-policy override.
// node scripts/audio-qa.mjs [http://127.0.0.1:5175/] [output-directory] [--baseline]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5175/';
const output = process.argv[3] ?? '/tmp/driftwing-audio-qa';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
page.setDefaultTimeout(120000);
await page.addInitScript(() => {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    const result = connect.call(this, destination, ...args);
    if (destination instanceof AudioDestinationNode && !window.__capture) {
      const ctx = this.context;
      const processor = ctx.createScriptProcessor(4096, 2, 2);
      connect.call(this, processor); connect.call(processor, destination);
      let recording = false, chunks = [];
      processor.onaudioprocess = e => {
        // The monitor's output remains zero; it does not double the audible game mix.
        if (recording) chunks.push([e.inputBuffer.getChannelData(0).slice(), e.inputBuffer.getChannelData(1).slice()]);
      };
      window.__capture = {
        begin() { chunks = []; recording = true; },
        finish() {
          recording = false;
          const count = chunks.reduce((n, c) => n + c[0].length, 0);
          const bytes = new ArrayBuffer(44 + count * 4), v = new DataView(bytes);
          const str = (offset, s) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
          str(0, 'RIFF'); v.setUint32(4, 36 + count * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
          v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
          v.setUint32(24, ctx.sampleRate, true); v.setUint32(28, ctx.sampleRate * 4, true);
          v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, count * 4, true);
          let pos = 44, peak = 0, sum = 0, nonfinite = 0, clipped = 0;
          for (const c of chunks) for (let i = 0; i < c[0].length; i++) for (let channel = 0; channel < 2; channel++) {
            const x = c[channel][i]; peak = Math.max(peak, Math.abs(x)); sum += x * x;
            if (!Number.isFinite(x)) nonfinite++; if (Math.abs(x) >= .999) clipped++;
            v.setInt16(pos, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true); pos += 2;
          }
          let binary = ''; const array = new Uint8Array(bytes);
          for (let i = 0; i < array.length; i += 8192) binary += String.fromCharCode(...array.subarray(i, i + 8192));
          return { wav: btoa(binary), seconds: count / ctx.sampleRate, peakDb: peak ? 20 * Math.log10(peak) : -180,
            rmsDb: sum ? 10 * Math.log10(sum / (count * 2)) : -180, nonfinite, clipped };
        },
      };
    }
    return result;
  };
});

const report = { baseline: '193e56f', listening: false, checks: [], captures: {}, errors };
function check(name, actual, expected = true) { assert.deepEqual(actual, expected, name); report.checks.push({ name, actual }); console.log(`PASS ${name}`); }
async function capture(name, action, seconds = 2) {
  await page.evaluate(() => window.__capture.begin());
  if (action) await action();
  await page.waitForTimeout(seconds * 1000);
  const { wav, ...metrics } = await page.evaluate(() => window.__capture.finish());
  fs.writeFileSync(path.join(output, `${name}.wav`), Buffer.from(wav, 'base64'));
  report.captures[name] = metrics;
  check(`${name}: finite and unclipped`, metrics.nonfinite === 0 && metrics.clipped === 0);
  check(`${name}: ${name === 'muted' ? 'silent' : 'nonzero playback'}`, name === 'muted' ? metrics.rmsDb < -90 : metrics.rmsDb > -80);
  console.log(name, JSON.stringify(metrics));
}
const state = () => page.evaluate(() => {
  const g = __dw.game, a = g.audio;
  return { screen: g.screen, mode: g.player.mode, running: a.running, titleSource: !!a.titleMusic?.source,
    titleDuration: a.titleMusic?.buffer?.duration, master: a.liveEngine?.master.gain.value,
    music: a.liveEngine?.music.dry.gain.value, sfx: a.liveEngine?.sfx.dry.gain.value };
});
try {
  await page.goto(`${base}?debug=1&manual=1&quality=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dw?.ready && !document.getElementById('boot'));
  check('no audio context before gesture', (await state()).running, false);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => __dw.game.audio.titleMusic?.source && __dw.game.audio.running);
  report.title = await state();
  await capture('title', null, 3);
  await page.evaluate(() => { const s = __dw.game.audio.titleMusic.source; window.__titleSource = s; window.__titleEnded = 0; s.addEventListener('ended', () => window.__titleEnded++); s.playbackRate.value = 128; });
  await page.waitForTimeout(4000);
  check('title loops across multiple recording lengths', await page.evaluate(() => __dw.game.audio.titleMusic.source === window.__titleSource && window.__titleEnded === 0));
  await page.evaluate(() => { window.__titleSource.playbackRate.value = 1; __dw.game.frame(0,false); __dw.game.ui.debugOpen('settings', 3); });
  check('title music continues through Settings sheet', (await state()).titleSource);
  await page.locator('.dw-settings .dw-track').first().click({position:{x:1,y:2},timeout:5000});
  check('Master slider applies mute through the actual Settings sheet', await page.evaluate(() => __dw.game.settings.masterVolume), 0);
  await page.evaluate(() => { __dw.game.applySettings({...__dw.game.settings,masterVolume:.8}); __dw.game.ui.pop(); });
  await page.evaluate(() => { __dw.game.startGame(); __dw.game.frame(1 / 60, false); });
  check('title source stopped on gameplay entry', (await state()).titleSource, false);
  await capture('gameplay-ground', () => page.evaluate(() => { for (let i = 0; i < 60; i++) __dw.game.frame(1 / 60, false); }), 3);
  await page.evaluate(() => { const g = __dw.game; g.player.teleport(g.player.position.clone().set(5000,1000,5000),0,'flying',35); g.frame(1 / 60,false); });
  await capture('flight', () => page.evaluate(() => { const g = __dw.game; for (let i = 0; i < 90; i++) { g.input.setScripted({ flight: { flap: true } }); g.frame(1 / 60,false); } g.input.setScripted(null); }), 3);
  await capture('pause', () => page.evaluate(() => { __dw.game.pause(); __dw.game.frame(1 / 60,false); }), 2);
  check('pause retains running audio', (await state()).running);
  await page.evaluate(() => { __dw.game.resume(); __dw.game.frame(1 / 60,false); });
  for (const field of ['musicVolume','sfxVolume','masterVolume']) {
    await page.evaluate(field => { const g = __dw.game; g.applySettings({ ...g.settings, [field]: 0 }); }, field);
    await page.waitForFunction(field => { const e = __dw.game.audio.liveEngine; return e[{musicVolume:'music',sfxVolume:'sfx'}[field]]?.dry.gain.value < .0001 || (field === 'masterVolume' && e.master.gain.value < .0001); }, field);
    const s = await state();
    check(`${field}: gain approaches zero`, s[{musicVolume:'music',sfxVolume:'sfx',masterVolume:'master'}[field]] < .0001);
    if (field === 'masterVolume') await capture('muted', null, 3);
  }
  await page.reload();
  await page.waitForFunction(() => window.__dw?.ready && !document.getElementById('boot'));
  check('all mute settings persist after reload', await page.evaluate(() => { const s = __dw.game.settings; return [s.masterVolume,s.musicVolume,s.sfxVolume]; }), [0,0,0]);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => __dw.game.audio.running);
  await page.evaluate(() => { const g = __dw.game; g.applySettings({...g.settings, masterVolume:.8,musicVolume:.6,sfxVolume:.9}); g.startGame(); g.frame(1 / 60,false); });
  await page.waitForTimeout(1600);
  report.restored = await state();
  check('restored volumes remain applied after unlock fade', report.restored.master > .63 && report.restored.music > .21 && report.restored.sfx > .80);
  await page.evaluate(() => {
    const e = __dw.game.audio.liveEngine, strip = e.strip.bind(e);
    window.__sfxStrips = 0;
    e.strip = (bus, ...args) => { if (bus === e.sfx) window.__sfxStrips++; return strip(bus, ...args); };
    window.__audioTick = (input = {}) => { const g = __dw.game; g.input.setScripted(input); g.frame(1 / 120, false); g.input.setScripted(null); };
    window.__audioFixture = () => {
      const g = __dw.game, p = g.player, island = g.world.terrain.islands[0];
      const x = island.def.x + island.def.radius * .35, z = island.def.z;
      p.teleport(p.position.clone().set(x,island.topHeight(x,z),z),0,'onFoot');
      p.foot.position.set(x,island.bottomHeight(x,z)-18,z); p.foot.grounded = false; p.foot.velocity.set(0,0,0);
      __audioTick(); g.cameraRig.snap(p); window.__sfxStrips = 0;
    };
    window.__audioFixture();
  });
  report.actions = {};
  await capture('grapple-attach', () => page.evaluate(() => {
    const p = __dw.game.player, aim = p.foot.position.clone().set(0,1,0);
    __audioTick({pressed:{lance:true},lanceHeld:true,aim});
    for(let i=0;i<180 && !p.skyLance.rope && p.skyLance.state === 'projectile';i++) __audioTick({lanceHeld:true,aim});
    if (!p.skyLance.rope) throw Error(`No actual-world attachment: ${p.skyLance.reason}`);
  }));
  report.actions.castAndAttachStrips = await page.evaluate(() => window.__sfxStrips);
  report.audioCpu = await page.evaluate(() => {
    const g = __dw.game, times = [], strips = window.__sfxStrips;
    for(let i=0;i<500;i++) { const start = performance.now(); g.audio.update(1/60,g.camera,g.player,g.weather,g.sky); times.push(performance.now()-start); }
    times.sort((a,b)=>a-b);
    return { mode:g.player.mode, attached:!!g.player.skyLance.rope, samples:times.length,
      meanMs:times.reduce((a,b)=>a+b,0)/times.length, p95Ms:times[Math.floor(times.length*.95)], maxMs:times.at(-1), repeatedSfxStrips:window.__sfxStrips-strips };
  });
  check('sustained tether does not add repeated SFX voices', report.audioCpu.repeatedSfxStrips, 0);
  await page.evaluate(() => { window.__sfxStrips = 0; });
  await capture('grapple-pull', () => page.evaluate(() => {
    __audioTick({pressed:{jump:true},lanceHeld:true});
    if (!(__dw.game.player.skyLance.pullTime > 0)) throw Error('Pull did not activate');
    for(let i=0;i<35;i++) __audioTick({lanceHeld:true});
  }));
  report.actions.pullStrips = await page.evaluate(() => window.__sfxStrips);
  await page.evaluate(() => { window.__sfxStrips = 0; });
  await capture('grapple-release', () => page.evaluate(() => {
    __audioTick({pressed:{lanceRelease:true}});
    if (__dw.game.player.skyLance.rope) throw Error('Release retained rope');
  }));
  report.actions.releaseStrips = await page.evaluate(() => window.__sfxStrips);
  await page.evaluate(() => { const p = __dw.game.player; p.foot.position.set(5000,1000,5000); p.foot.velocity.set(0,-13,18); p.foot.grounded=false; __audioTick(); window.__sfxStrips = 0; });
  await capture('boost', () => page.evaluate(() => {
    __audioTick({pressed:{jump:true}});
    if (!(__dw.game.player.airBoost.remaining > 0)) throw Error('Boost did not activate');
    for(let i=0;i<35;i++) __audioTick();
  }));
  report.actions.boostStrips = await page.evaluate(() => window.__sfxStrips);
  await page.evaluate(() => { window.__sfxStrips = 0; });
  await capture('recall', () => page.evaluate(() => {
    for(let i=0;i<51;i++) __audioTick({callHeld:true});
    if (__dw.game.player.mode !== 'falling') throw Error('Recall did not enter rescue');
    for(let i=0;i<180 && __dw.game.player.mode !== 'flying';i++) __audioTick();
    if (__dw.game.player.mode !== 'flying') throw Error('Recall did not catch rider');
  }), 3);
  report.actions.recallStrips = await page.evaluate(() => window.__sfxStrips);
  check('recall triggers existing rescue cues', report.actions.recallStrips > 0);
  const expectCues = !process.argv.includes('--baseline');
  for (const name of ['castAndAttachStrips','pullStrips','releaseStrips','boostStrips'])
    check(`${name}: ${expectCues ? 'cue supplied' : 'baseline missing cue confirmed'}`, expectCues ? report.actions[name] > 0 : report.actions[name] === 0);
  console.log('action strips', JSON.stringify(report.actions));
  report.repeated = [];
  for(let cycle=0;cycle<3;cycle++) {
    const strips = await page.evaluate(() => {
      __audioFixture();
      const p = __dw.game.player, aim = p.foot.position.clone().set(0,1,0);
      __audioTick({pressed:{lance:true},lanceHeld:true,aim});
      for(let i=0;i<180 && !p.skyLance.rope && p.skyLance.state === 'projectile';i++) __audioTick({lanceHeld:true,aim});
      if(!p.skyLance.rope) throw Error('Repeated attachment failed');
      __audioTick({pressed:{jump:true},lanceHeld:true}); for(let i=0;i<55;i++) __audioTick({lanceHeld:true});
      __audioTick({pressed:{lanceRelease:true}});
      p.foot.position.set(5000,1000,5000);p.foot.velocity.set(0,-13,18);__audioTick();
      __audioTick({pressed:{jump:true}});for(let i=0;i<220;i++)__audioTick();
      return window.__sfxStrips;
    });
    check(`repeat cycle ${cycle+1}: one cue per action`, strips, expectCues ? 5 : 0);
    report.repeated.push(strips);
    await page.waitForTimeout(800);
  }
  // Offline reference scenes use the exact engine graph, independent of software GPU speed.
  report.offline = await page.evaluate(async () => (await import('/src/audio/offline.ts')).runAudioCheck());
  check('all existing offline scenes audible, finite and unclipped', report.offline.ok);
  check('no browser errors', errors, []);
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
