import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SkyLance } from '../traversal/SkyLance';
import { AirBoost } from '../traversal/air';
import { TraversalCues, type TraversalCue } from './traversalCues';

function setup() {
  const player = { mode: 'traversing' as const, skyLance: new SkyLance({ sweep: () => null, anchorValid: () => true }), airBoost: new AirBoost() };
  const cues = new TraversalCues(), heard: TraversalCue[] = [];
  const tick = (active = true) => cues.update(player, active, cue => heard.push(cue));
  tick();
  const attach = () => { player.skyLance.state = 'anchored'; player.skyLance.rope = { anchor: new Vector3(0,20,0), length: 20 }; tick(); };
  return { player, cues, heard, tick, attach };
}

describe('traversal audio transitions', () => {
  it('sounds once per action, with no sustained or repeated-frame voices', () => {
    const s = setup(), lance = s.player.skyLance;
    lance.throw(new Vector3(),new Vector3(0,1,0),new Vector3()); s.tick(); s.tick();
    s.attach(); for (let i=0;i<300;i++) s.tick();
    lance.pull(); s.tick(); for (let i=0;i<300;i++) s.tick();
    lance.pullTime = 0; s.tick(); lance.pull(); s.tick();
    lance.detach(); s.tick(); s.tick();
    s.player.airBoost.start(new Vector3(),undefined,0); s.tick(); for (let i=0;i<300;i++) s.tick();
    expect(s.heard).toEqual(['cast','attach','pull','pull','release','boost']);
  });

  it('does not invent cues on pause, resume, equipment replacement or reset', () => {
    const s = setup();
    s.player.skyLance.state = 'anchored'; s.player.skyLance.rope = { anchor: new Vector3(), length: 20 };
    s.tick(false); s.tick(); expect(s.heard).toEqual([]);
    s.player.skyLance.reset(); s.tick(); expect(s.heard).toEqual([]);
    s.player.skyLance = new SkyLance({ sweep: () => null, anchorValid: () => true });
    s.attach(); expect(s.heard).toEqual([]);
    s.player.skyLance.detach(); s.tick(false); s.tick(); expect(s.heard).toEqual([]);
  });

  it('supports the first observed attachment after a cast finishes within one frame', () => {
    const s = setup(); s.attach(); expect(s.heard).toEqual(['attach']);
  });

  it('ignores missing equipment and an already active first observation', () => {
    const s = setup();
    s.cues.update({mode:'flying'},true,cue => s.heard.push(cue));
    s.player.airBoost.remaining = .2;
    s.cues.update(s.player,true,cue => s.heard.push(cue));
    expect(s.heard).toEqual([]);
  });
});
