// G4 greeting capture steps for scripts/shot.mjs: node greet-steps.mjs <baseline|arrive> <onFoot|landed> > greet.json
const init = "__dw.game.bond.reset();__dw.game.save.data.firstLeadGuide='skipped';__dw.game.save.data.tutorialDone=true";
const away = "(()=>{const g=__dw.game,p=g.player;p.teleport(p.position.clone().set(0,380,700),0,'flying',30);g.cameraRig.snap(p)})()";
const home = (mode) => `(()=>{const g=__dw.game,p=g.player;p.teleport(p.position.clone().set(10,240,30),-1.6,'${mode}');g.cameraRig.snap(p);const P=p.position.clone();g.cameraRig.setOverride({position:P.clone().set(${mode === 'landed' ? '0,244.5,27' : '3,242.6,26.5'}),target:P.clone().set(${mode === 'landed' ? '8,242,31' : '10,241.6,32'})})})()`;
const st = "(()=>{const g=__dw.game,b=g.bond,p=g.player;return {mode:p.mode,away:b.greeting.away,count:b.greeting.count,last:b.lastGreeting,since:+b.sinceGreeting.toFixed(2),d:+p.wyvernDistance.toFixed(1),cs:p.companion.state,screen:g.screen}})()";
const which = process.argv[2];
const mode = process.argv[3];
const steps = [{ advance: 0.1, eval: init }];
if (which === 'arrive') steps.push({ eval: away, advance: 9, log: st });
steps.push({ eval: home(mode), advance: 0.04, log: st });
const wait = mode === 'landed' ? 0.7 : 0.1;
steps.push({ advance: wait + 1.6, log: st, shot: `shots/g4-greet-${mode}-${which}.png` });
console.log(JSON.stringify(steps));
