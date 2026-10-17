// G4 lean capture steps for scripts/shot.mjs: node lean-steps.mjs > lean.json
const tp = "(()=>{const g=__dw.game,p=g.player;p.teleport(p.position.clone().set(-300,380,-40),Math.PI/2,'flying',30);g.cameraRig.snap(p)})()";
const st = "(()=>{const g=__dw.game,b=g.bond,a=b.anticipation,p=g.player,l=b.store.data.landmarks.roost;return {passing:a.passing,passes:l?.passes,sites:l?.sites.map(s=>[Math.round(s.x),Math.round(s.y),Math.round(s.z),s.dir,s.seen]),value:+a.value.toFixed(3),last:a.last,pos:p.wyvernPose.position.toArray().map(Math.round),q:p.flight.orientation.toArray().map(v=>+v.toFixed(6)),errs:__dw.errors.length}})()";
const BANK = 9, PRE = 0.1;
const steps = [{ advance: 0.1, eval: "__dw.game.bond.reset();__dw.game.save.data.firstLeadGuide='skipped';__dw.game.save.data.tutorialDone=true" }];
for (let pass = 1; pass <= 4; pass++) {
  steps.push({ eval: tp, advance: 0.04 });
  if (pass >= 3) {
    steps.push({ advance: BANK - 0.6, shot: `shots/g4-lean-pass${pass}-before.png`, log: st });
    steps.push({ advance: 0.6 - PRE, shot: `shots/g4-lean-pass${pass}.png`, log: st });
    steps.push({ advance: PRE });
  } else steps.push({ advance: BANK, log: st });
  steps.push({ advance: 0.8, input: { flight: { pitch: 0, roll: 1, yaw: 0, flap: 0, tuck: 0, flare: 0 } }, log: st });
  steps.push({ advance: 14, log: st });
}
console.log(JSON.stringify(steps));
