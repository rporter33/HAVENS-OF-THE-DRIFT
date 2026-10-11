import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Quaternion, Scene, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { EventBus } from '../core/events';
import type { BreedStats, GameEvents, PlayerMode } from '../core/types';
import type { GhostRecording, PlayerSystem } from '../game/contracts';
import { BREEDS } from '../flight/breeds';
import { createFlightState } from '../flight/FlightModel';
import { createRiderPose, createWyvernPose } from '../player/poses';
import { QUALITY } from '../render/quality';
import { DEFAULT_SETTINGS } from '../game/settings';
import { LocalSaveStore, MemoryGhostStore, defaultSave } from '../progression/save';
import { ColliderIndex, deckCollider } from '../world/colliders';
import { Dressing } from '../world/dressing/Dressing';
import { LAYOUT } from '../world/layout';
import { Terrain } from '../world/terrain';
import { roostPlan } from '../world/dressing/structures/roostPlan';
import { COURSES } from './courses';
import { GATE_HALF_HEIGHT, GATE_HALF_WIDTH, gateRing, RACE_START } from './courseMath';
import { handsOffDrop, RUNUP_CLEARANCE, START_AIM_ABOVE, START_CLEARANCE, START_SINK_MARGIN } from './flyCourse';
import { GhostRecorder } from './ghost';
import { ARMING, Races } from './Races';

const DT = 1 / 120;

/** Just enough of a player for the race system: a point that flies where it's told. */
class FakePlayer {
  mode: PlayerMode = 'flying';
  breed: BreedStats = BREEDS.harrier;
  flight = createFlightState();
  wyvernPose = createWyvernPose();
  riderPose = createRiderPose();
  riderPosition = new Vector3();
  prevPosition = new Vector3();
  position = new Vector3();
  controllable = true;
  fade = 0;
  teleports: { position: Vector3; yaw: number; speed?: number }[] = [];
  setBreed() {}
  fixedUpdate() {}
  update() {}
  teleport(position: Vector3, yaw: number, _mode: string, speed?: number): void {
    this.teleports.push({ position: position.clone(), yaw, speed });
    this.prevPosition.copy(position);
    this.position.copy(position);
    this.flight.position.copy(position);
    this.flight.velocity.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed ?? 25);
  }
}

function setup() {
  const events = new EventBus<GameEvents>();
  const log: { type: string; payload: any }[] = [];
  for (const type of ['raceArmed', 'raceDisarmed', 'raceCountdown', 'raceStart', 'ringPassed', 'ringMissed', 'raceFinish', 'raceAbort', 'unlock'] as const) {
    events.on(type, (payload) => log.push({ type, payload }));
  }
  const save = new LocalSaveStore({ storage: null, ghosts: new MemoryGhostStore() });
  const player = new FakePlayer();
  const races = new Races({
    scene: new Scene(),
    events,
    save,
    player: player as unknown as PlayerSystem,
    quality: QUALITY.low,
    settings: () => DEFAULT_SETTINGS,
  });
  /** Fly in a straight line to `to` at `speed`, stepping the race system at 120 Hz. */
  const flyTo = (to: Vector3, speed = 30) => {
    const from = player.position.clone();
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    player.flight.velocity.copy(dir).multiplyScalar(speed);
    const steps = Math.max(1, Math.ceil(dist / (speed * DT)));
    for (let i = 1; i <= steps; i++) {
      player.prevPosition.copy(player.position);
      player.position.lerpVectors(from, to, i / steps);
      player.flight.position.copy(player.position);
      races.fixedUpdate(DT, player as unknown as PlayerSystem);
    }
  };
  /** Fly straight in from far out so the approach is a deliberate one (airborne a while). */
  const approach = (to: Vector3, speed = 30) => {
    const dir = gatePoint(0).sub(to).setY(0).normalize();
    player.teleport(to.clone().addScaledVector(dir, -speed * (ARMING.airborne + 1)), Math.atan2(dir.x, dir.z), 'flying', speed);
    flyTo(to, speed);
  };
  /** Hold still in the air for a few fixed steps (time passes). */
  const idle = (seconds: number) => {
    for (let i = 0; i < seconds * 120; i++) races.fixedUpdate(DT, player as unknown as PlayerSystem);
  };
  return { events, log, save, player, races, flyTo, approach, idle };
}

const loop = COURSES.find((c) => c.id === 'roost-loop')!;
const ringPoint = (i: number, along: number, side = 0) => {
  const r = loop.rings[i];
  const n = new Vector3(...r.normal).normalize();
  const s = new Vector3(n.z, 0, -n.x).normalize();
  return new Vector3(...r.position).addScaledVector(n, along).addScaledVector(s, side);
};
const gatePoint = (along: number) => {
  const g = gateRing(loop);
  return new Vector3(g.cx, g.cy, g.cz).addScaledVector(new Vector3(g.nx, g.ny, g.nz), along);
};

describe('Races: a full run of the Roost Loop', () => {
  it('arms on approach, starts at the gate, counts rings in order and records the finish', async () => {
    const { log, save, races, flyTo, approach } = setup();
    approach(gatePoint(-150));
    expect(races.state).toBe('countdown');
    expect(log.find((e) => e.type === 'raceArmed')?.payload.raceId).toBe('roost-loop');
    flyTo(gatePoint(-5));
    expect(log.filter((e) => e.type === 'raceCountdown').map((e) => e.payload.count)).toEqual([3, 2, 1]);
    flyTo(gatePoint(10));
    expect(races.state).toBe('running');
    expect(log.some((e) => e.type === 'raceStart')).toBe(true);

    // Ring 0 straight through; ring 1 passed by outside the hole first (a miss), then through.
    flyTo(ringPoint(0, -10));
    flyTo(ringPoint(0, 10));
    const first = log.find((e) => e.type === 'ringPassed')!.payload;
    expect(first.index).toBe(0);
    expect(first.total).toBe(loop.rings.length);
    expect(first.deltaMs).toBeNull();
    expect(Math.abs(first.splitMs - races.splits[0])).toBeLessThan(1e-6);
    flyTo(ringPoint(1, -10, 25));
    flyTo(ringPoint(1, 10, 25));
    expect(log.find((e) => e.type === 'ringMissed')?.payload.index).toBe(1);
    expect(races.nextRingIndex).toBe(1);
    flyTo(ringPoint(1, -20));
    flyTo(ringPoint(1, 10));
    expect(races.nextRingIndex).toBe(2);

    for (let i = 2; i < loop.rings.length; i++) {
      flyTo(ringPoint(i, -10), 40);
      flyTo(ringPoint(i, 10), 40);
    }
    expect(races.state).toBe('finished');
    const fin = log.find((e) => e.type === 'raceFinish')!.payload;
    expect(fin.newBest).toBe(true);
    expect(fin.previousBestMs).toBeNull();
    expect(fin.timeMs).toBeCloseTo(races.splits[races.splits.length - 1], 6);
    const rec = save.data.races['roost-loop'];
    expect(rec.runs).toBe(1);
    expect(rec.bestMs).toBeCloseTo(fin.timeMs, 6);
    expect(rec.breed).toBe('harrier');
    expect(rec.medal).toBe(fin.medal);
    // The run's ghost is stored with its splits.
    const ghost = await save.getGhost('roost-loop');
    expect(ghost?.splits?.length).toBe(loop.rings.length);
    expect(ghost!.samples.length).toBeGreaterThan(30 * 11);
  });

  it('a second, slower run is not a best but splits compare against the best', async () => {
    const { log, save, races, flyTo, approach, idle } = setup();
    const run = (speed: number) => {
      approach(gatePoint(-150), speed);
      flyTo(gatePoint(10), speed);
      for (let i = 0; i < loop.rings.length; i++) {
        flyTo(ringPoint(i, -10), speed);
        flyTo(ringPoint(i, 10), speed);
      }
    };
    run(60);
    await Promise.resolve();
    expect(races.state).toBe('finished');
    // Leave the finished state and go again, slower.
    idle(9);
    expect(races.state).toBe('idle');
    run(45);
    const finishes = log.filter((e) => e.type === 'raceFinish').map((e) => e.payload);
    expect(finishes[1].newBest).toBe(false);
    expect(finishes[1].previousBestMs).toBeCloseTo(finishes[0].timeMs, 6);
    expect(save.data.races['roost-loop'].runs).toBe(2);
    expect(save.data.races['roost-loop'].bestMs).toBeCloseTo(finishes[0].timeMs, 6);
    const passes = log.filter((e) => e.type === 'ringPassed').map((e) => e.payload);
    const second = passes.slice(loop.rings.length);
    expect(second[0].deltaMs).toBeGreaterThan(0); // behind the best
  });

  it('begin() puts the player on a rolling start before the gate, and respawn aborts', () => {
    const { log, player, races, events, flyTo } = setup();
    races.begin('lantern-dash');
    const def = COURSES.find((c) => c.id === 'lantern-dash')!;
    const t = player.teleports[0];
    const g = gateRing(def);
    expect(t.speed).toBe(RACE_START.speed);
    expect(Math.hypot(t.position.x - g.cx, t.position.z - g.cz)).toBeCloseTo(RACE_START.leadDistance, 3);
    // High enough that the harrier's hands-off glide sinks through, a little above center.
    const drop = handsOffDrop(BREEDS.harrier, RACE_START.leadDistance);
    expect(t.position.y).toBeCloseTo(g.cy + drop * START_SINK_MARGIN + START_AIM_ABOVE, 6);
    expect(races.state).toBe('countdown');
    expect(races.activeId).toBe('lantern-dash');
    const target = new Vector3(g.cx, g.cy, g.cz).addScaledVector(new Vector3(g.nx, g.ny, g.nz), 10);
    flyTo(target, 28);
    expect(races.state).toBe('running');
    events.emit('respawn', { position: new Vector3() });
    expect(log.find((e) => e.type === 'raceAbort')?.payload.reason).toBe('respawn');
    expect(races.state).toBe('idle');
    expect(races.activeId).toBeNull();
  });

  it('restart and quit', () => {
    const { log, races } = setup();
    races.begin('roost-loop');
    races.restart();
    expect(log.filter((e) => e.type === 'raceAbort').map((e) => e.payload.reason)).toEqual(['restart']);
    expect(races.state).toBe('countdown');
    races.abort('quit');
    expect(log.filter((e) => e.type === 'raceAbort').map((e) => e.payload.reason)).toEqual(['restart', 'quit']);
    expect(races.activeId).toBeNull();
  });

  it.each(['onFoot', 'traversing'] as const)('%s mid-race abandons it as a dismount; flying away from an armed gate disarms quietly', mode => {
    const { log, player, races, flyTo, approach } = setup();
    approach(gatePoint(-150));
    expect(races.state).toBe('countdown');
    // Turn away and leave.
    flyTo(gatePoint(-150).addScaledVector(new Vector3(0, 1, 0), 400));
    expect(races.state).toBe('idle');
    expect(log.some((e) => e.type === 'raceAbort')).toBe(false);
    expect(log.find((e) => e.type === 'raceDisarmed')?.payload).toEqual({ raceId: 'roost-loop', reason: 'away' });
    // Arm again, start, then step off on foot.
    approach(gatePoint(-150));
    flyTo(gatePoint(10));
    expect(races.state).toBe('running');
    player.mode = mode;
    races.fixedUpdate(DT, player as unknown as PlayerSystem);
    expect(log.find((e) => e.type === 'raceAbort')?.payload.reason).toBe('dismount');
    // Restart tries the same race again for a while.
    expect(races.retryId).toBe('roost-loop');
    player.mode = 'flying';
    races.restart();
    expect(races.state).toBe('countdown');
    expect(races.activeId).toBe('roost-loop');
  });

  it.each(['countdown', 'running'] as const)('a leap during %s wins over a riderless dragon crossing on the same step', state => {
    const { log, player, races, approach, flyTo, save } = setup();
    approach(gatePoint(-150));
    if (state === 'running') flyTo(gatePoint(10));
    const starts = log.filter(e => e.type === 'raceStart').length;
    player.prevPosition.copy(state === 'countdown' ? gatePoint(-10) : ringPoint(0, -10));
    player.position.copy(state === 'countdown' ? gatePoint(10) : ringPoint(0, 10));
    player.mode = 'traversing'; races.fixedUpdate(DT, player as unknown as PlayerSystem);
    expect(races.state).toBe('idle');
    expect(log.filter(e => e.type === 'raceStart')).toHaveLength(starts);
    expect(log.some(e => e.type === 'ringPassed')).toBe(false);
    expect(save.data.races).toEqual({});
  });

  it('points the HUD at the gate, then each ring, and knows which start is nearby', () => {
    const { player, races, flyTo, approach } = setup();
    const out = new Vector3();
    player.teleport(gatePoint(-300), 0, 'flying', 30);
    expect(races.waypoint(out)?.toArray()).toEqual(loop.start.position);
    expect(races.nearbyStart(gatePoint(-100))?.id).toBe('roost-loop');
    expect(races.nearbyStart(new Vector3(0, 5000, 0))).toBeNull();
    // On foot, the nearest start is measured from the rider, not the waiting wyvern.
    player.mode = 'onFoot';
    player.riderPosition.copy(gatePoint(-300));
    player.position.set(0, 5000, 0);
    expect(races.waypoint(out)?.toArray()).toEqual(loop.start.position);
    player.mode = 'flying';
    approach(gatePoint(-150));
    flyTo(gatePoint(10));
    expect(races.waypoint(out)?.toArray()).toEqual(loop.rings[0].position);
  });

  it('awards unlocks a medal earns (gold on the Roost Loop unlocks the crown horns)', () => {
    const { log, races, flyTo, approach } = setup();
    approach(gatePoint(-190), 90);
    flyTo(gatePoint(10), 90);
    for (let i = 0; i < loop.rings.length; i++) {
      flyTo(ringPoint(i, -10), 90);
      flyTo(ringPoint(i, 10), 90);
    }
    const fin = log.find((e) => e.type === 'raceFinish')!.payload;
    expect(fin.medal).toBe('gold');
    expect(log.some((e) => e.type === 'unlock' && e.payload.cosmeticId === 'crown')).toBe(true);
    void Quaternion;
  });
});

// ---------------------------------------------------------------------------------------------
// Starting a race is always deliberate (PLAY-02)
// ---------------------------------------------------------------------------------------------

const gateAxis = () => {
  const g = gateRing(loop);
  return new Vector3(g.nx, 0, g.nz);
};
/** A point `along` the gate's axis, rotated `deg` off it about the gate's center, `side` m across. */
const offAxisPoint = (along: number, deg: number, side = 0) => {
  const n = gateAxis().applyAxisAngle(new Vector3(0, 1, 0), (deg * Math.PI) / 180);
  const s = new Vector3(n.z, 0, -n.x);
  return gatePoint(0).addScaledVector(n, along).addScaledVector(s, side);
};

describe('Races: arming takes a deliberate approach', () => {
  it('a launch straight at a gate does not arm it (not airborne long enough)', () => {
    const { log, player, races, events, flyTo } = setup();
    player.teleport(gatePoint(-150), 0, 'flying', 30);
    events.emit('takeoff', { position: player.position.clone() });
    flyTo(gatePoint(30));
    expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
    expect(races.state).toBe('idle');
  });

  it('only a line within ~25° of the gate axis, aimed at the opening, arms', () => {
    // 35° off the axis, aimed at the center: a glide past, not a start.
    {
      const { log, player, flyTo } = setup();
      player.teleport(offAxisPoint(-400, 35), 0, 'flying', 30);
      flyTo(offAxisPoint(-20, 35));
      expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
    }
    // Parallel to the axis but 50 m to the side: flying past it.
    {
      const { log, player, flyTo } = setup();
      player.teleport(offAxisPoint(-400, 0, 50), 0, 'flying', 30);
      flyTo(offAxisPoint(-20, 0, 50));
      expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
    }
    // 15° off and aimed at the opening: that's lining up.
    {
      const { log, player, flyTo } = setup();
      player.teleport(offAxisPoint(-400, 15), 0, 'flying', 30);
      flyTo(offAxisPoint(-60, 15));
      expect(log.find((e) => e.type === 'raceArmed')?.payload.raceId).toBe('roost-loop');
    }
    // Too slow to be flying it.
    {
      const { log, player, flyTo } = setup();
      player.teleport(gatePoint(-260), 0, 'flying', 8);
      flyTo(gatePoint(-60), 8);
      expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
    }
  });

  it('gliding straight off the Roost launch deck never arms the Roost Loop; banking onto its line does', () => {
    const terrain = new Terrain(LAYOUT);
    const deck = roostPlan(LAYOUT, terrain)!.deck;
    const dir = new Vector3(deck.dirX, 0, deck.dirZ);
    const end = new Vector3(deck.x, deck.y + 3, deck.z).addScaledVector(dir, deck.length - deck.rimDist + 16);
    // Straight out, gliding down at 1:10 like an explorer heading for Gull's Rest.
    {
      const { log, player, events, flyTo } = setup();
      player.teleport(end, Math.atan2(dir.x, dir.z), 'flying', 20);
      events.emit('takeoff', { position: end.clone() });
      flyTo(end.clone().addScaledVector(dir, 700).add(new Vector3(0, -70, 0)), 20);
      expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
    }
    // Out along the deck, then a left bank onto the gate's line: arms well before the gate.
    {
      const { log, player, events, flyTo, races } = setup();
      const n = gateAxis();
      const g = gatePoint(0);
      // Where the deck's line meets the gate's run-up line.
      const d0 = new Vector3().subVectors(g, end).setY(0);
      const t = (d0.x * n.z - d0.z * n.x) / (dir.x * n.z - dir.z * n.x);
      const corner = end.clone().addScaledVector(dir, t);
      corner.y = g.y + 8;
      expect(t).toBeGreaterThan(40); // the turn comes a good way out from the deck
      player.teleport(end, Math.atan2(dir.x, dir.z), 'flying', 20);
      events.emit('takeoff', { position: end.clone() });
      flyTo(corner, 20);
      expect(log.some((e) => e.type === 'raceArmed')).toBe(false);
      flyTo(gatePoint(-ARMING.minLead - 5), 22);
      expect(log.find((e) => e.type === 'raceArmed')?.payload.raceId).toBe('roost-loop');
      flyTo(gatePoint(5), 22);
      expect(races.state).toBe('running');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The rolling start (PLAY-03)
// ---------------------------------------------------------------------------------------------

describe('Races: the rolling start from the menu', () => {
  it('starts each breed high enough that its hands-off glide sinks into the opening', () => {
    for (const id of ['harrier', 'skimmer', 'galewing', 'ironback'] as const) {
      const { player, races } = setup();
      player.breed = BREEDS[id];
      races.begin('cascade-run');
      const def = COURSES.find((c) => c.id === 'cascade-run')!;
      const g = gateRing(def);
      const t = player.teleports[0];
      const lead = Math.hypot(t.position.x - g.cx, t.position.z - g.cz);
      const crossing = t.position.y - handsOffDrop(BREEDS[id], lead) - g.cy;
      // Crosses above center (diving in is easy, climbing back is not), inside the opening even
      // with half again more sink than still air.
      expect(crossing, id).toBeGreaterThan(0);
      expect(crossing, id).toBeLessThan(GATE_HALF_HEIGHT - 3);
      expect(t.position.y - handsOffDrop(BREEDS[id], lead) * 1.5 - g.cy, id).toBeGreaterThan(-GATE_HALF_HEIGHT);
    }
    // The heavy breed starts well above the light one.
    const heavy = setup();
    heavy.player.breed = BREEDS.ironback;
    heavy.races.begin('roost-loop');
    const light = setup();
    light.player.breed = BREEDS.galewing;
    light.races.begin('roost-loop');
    expect(heavy.player.teleports[0].position.y - light.player.teleports[0].position.y).toBeGreaterThan(8);
  });

  it('keeps every start clear of rock, trees and buildings (and the run-up to the gate)', () => {
    // The world as the game sees it: rock plus every collider source Game registers.
    const terrain = new Terrain(LAYOUT);
    const dressing = new Dressing({ scene: new Scene(), terrain, quality: QUALITY.low, asyncStreaming: false });
    const { player, races } = setup();
    terrain.colliders.addSource('structures', () => dressing.colliders);
    terrain.colliders.addSource('forest', () => dressing.forest.colliders);
    terrain.colliders.addSource('decks', () => dressing.decks.map(deckCollider));
    terrain.colliders.addSource('race-gates', () => races.colliders);
    terrain.colliders.sync();
    (races as unknown as { deps: { terrain: Terrain } }).deps.terrain = terrain;
    // Distance is a lower bound capped near structures: the clearance asked for must be reportable.
    expect(terrain.distance(new Vector3(0, 1500, 0))).toBeGreaterThanOrEqual(START_CLEARANCE);
    const runup = (start: Vector3, g: ReturnType<typeof gateRing>) => {
      let min = Infinity;
      const L = Math.hypot(g.cx - start.x, g.cy - start.y, g.cz - start.z);
      for (let d = 0; d < L - 25; d += 10) min = Math.min(min, terrain.distance(start.clone().lerp(new Vector3(g.cx, g.cy, g.cz), d / L)));
      return min;
    };
    for (const def of COURSES) {
      for (const id of ['harrier', 'ironback'] as const) {
        player.breed = BREEDS[id];
        player.teleports.length = 0;
        const t0 = performance.now();
        races.begin(def.id);
        expect(performance.now() - t0).toBeLessThan(50);
        const t = player.teleports[0];
        const at = `${def.id} ${id} at ${t.position.toArray().map(Math.round)}`;
        expect(terrain.distance(t.position), at).toBeGreaterThanOrEqual(START_CLEARANCE);
        expect(runup(t.position, gateRing(def)), at).toBeGreaterThanOrEqual(RUNUP_CLEARANCE);
        races.abort('quit');
      }
    }
    // A building where the preferred start would be: the start moves somewhere clear.
    const def = COURSES[0];
    const g = gateRing(def);
    const preferred = new Vector3(g.cx - g.nx * RACE_START.leadDistance, 0, g.cz - g.nz * RACE_START.leadDistance);
    player.breed = BREEDS.harrier;
    player.teleports.length = 0;
    races.begin(def.id);
    preferred.y = player.teleports[0].position.y;
    races.abort('quit');
    terrain.colliders.add({ kind: 'box', x: preferred.x, y: preferred.y, z: preferred.z, hx: 8, hy: 8, hz: 8, yaw: 0 });
    player.teleports.length = 0;
    races.begin(def.id);
    const moved = player.teleports[0].position;
    expect(moved.distanceTo(preferred)).toBeGreaterThan(10);
    expect(terrain.distance(moved)).toBeGreaterThanOrEqual(START_CLEARANCE);
  }, 120_000);

  it('missing the opening stands the race down with a reason, and restart tries again', () => {
    const { log, player, races, flyTo } = setup();
    races.begin('roost-loop');
    expect(races.state).toBe('countdown');
    // Under the gate and past it.
    flyTo(gatePoint(-20).add(new Vector3(0, -GATE_HALF_HEIGHT - 12, 0)));
    flyTo(gatePoint(20).add(new Vector3(0, -GATE_HALF_HEIGHT - 12, 0)));
    expect(races.state).toBe('idle');
    expect(log.find((e) => e.type === 'raceDisarmed')?.payload).toEqual({ raceId: 'roost-loop', reason: 'missed-gate' });
    expect(log.some((e) => e.type === 'raceStart' || e.type === 'raceAbort')).toBe(false);
    expect(races.retryId).toBe('roost-loop');
    races.restart();
    expect(player.teleports).toHaveLength(2);
    expect(races.state).toBe('countdown');
    expect(races.retryId).toBeNull();
  });

  it('the second chance lasts 20 s of play, then R does nothing', () => {
    const { player, races, flyTo, idle } = setup();
    races.begin('roost-loop');
    flyTo(gatePoint(-20).add(new Vector3(0, -GATE_HALF_HEIGHT - 12, 0)));
    flyTo(gatePoint(20).add(new Vector3(0, -GATE_HALF_HEIGHT - 12, 0)));
    expect(races.retryId).toBe('roost-loop');
    player.mode = 'landed';
    idle(18.5); // (the stand-down came ~0.6 s before the end of the last leg)
    expect(races.retryId).toBe('roost-loop');
    idle(1.5);
    expect(races.retryId).toBeNull();
    races.restart();
    expect(player.teleports).toHaveLength(1);
  });

  it('landing at an armed gate stands it down too', () => {
    const { log, player, races, approach } = setup();
    approach(gatePoint(-120));
    expect(races.state).toBe('countdown');
    player.mode = 'landed';
    races.fixedUpdate(DT, player as unknown as PlayerSystem);
    expect(log.find((e) => e.type === 'raceDisarmed')?.payload.reason).toBe('landed');
  });
});

// ---------------------------------------------------------------------------------------------
// Records, breeds and erased progress (PLAY-13, PLAY-14, GHOST-01)
// ---------------------------------------------------------------------------------------------

function fakeGhost(raceId: string, breed: 'harrier' | 'ironback'): GhostRecording {
  const rec = new GhostRecorder(4);
  const g = gateRing(loop);
  for (let i = 0; i < 90; i++) rec.push(new Vector3(g.cx, g.cy, g.cz + i), new Quaternion(), 0, 0, 1, 0);
  const save = defaultSave();
  return rec.finish({ raceId, breed, look: { ...save.wyvern, breed: 'harrier' }, rider: save.rider, timeMs: 3000 });
}

describe('Races: records keep the breed they were flown on', () => {
  it('records the breed the race started with, and changing breed mid-race abandons it', () => {
    const { log, player, races, flyTo, approach } = setup();
    approach(gatePoint(-150));
    player.breed = BREEDS.skimmer; // changed during the countdown: the run is flown on it
    flyTo(gatePoint(10));
    expect(races.state).toBe('running');
    player.breed = BREEDS.ironback;
    races.fixedUpdate(DT, player as unknown as PlayerSystem);
    expect(log.find((e) => e.type === 'raceAbort')?.payload).toEqual({ raceId: 'roost-loop', reason: 'breed-change' });
    expect(races.state).toBe('idle');
  });

  it('a finished run stores the breed it was flown on even if the save says otherwise', async () => {
    const { save, player, races, flyTo, approach } = setup();
    player.breed = BREEDS.galewing; // the physics breed is the truth
    save.data.wyvern.breed = 'harrier';
    approach(gatePoint(-150), 60);
    flyTo(gatePoint(10), 60);
    for (let i = 0; i < loop.rings.length; i++) {
      flyTo(ringPoint(i, -10), 60);
      flyTo(ringPoint(i, 10), 60);
    }
    expect(save.data.races['roost-loop'].breed).toBe('galewing');
    const ghost = await save.getGhost('roost-loop');
    expect(ghost?.breed).toBe('galewing');
    expect(ghost?.look.breed).toBe('galewing');
  });

  it('erasing progress drops the best time and the ghost in hand', async () => {
    const { save, races, flyTo, approach, idle } = setup();
    approach(gatePoint(-150), 60);
    flyTo(gatePoint(10), 60);
    for (let i = 0; i < loop.rings.length; i++) {
      flyTo(ringPoint(i, -10), 60);
      flyTo(ringPoint(i, 10), 60);
    }
    expect(races.currentGhost).not.toBeNull();
    idle(9);
    save.reset();
    races.update(1 / 60, new PerspectiveCamera(), races['deps'].player);
    expect(races.currentGhost).toBeNull();
    expect(races.bestMs).toBeNull();
    races.begin('roost-loop');
    await new Promise((r) => setTimeout(r, 0));
    expect(races.bestMs).toBeNull();
    expect(races.currentGhost).toBeNull();
  });

  it('the ghost model exists from the start (the boot shader warmup compiles its programs)', () => {
    const { races } = setup();
    const mesh = races.ghostWyvern?.skinnedMesh;
    expect(mesh).toBeTruthy();
    expect((mesh!.material as { name: string }[]).map((m) => m.name)).toEqual(['race-ghost-body', 'race-ghost-membrane']);
    // ...hidden until a race runs against a ghost.
    let shown = true;
    for (let o: Object3D | null = mesh!; o; o = o.parent) shown &&= o.visible;
    expect(shown).toBe(false);
  });

  it('the ghost is rebuilt as each recording’s breed, in its own readable materials', () => {
    const { races } = setup();
    const camera = new PerspectiveCamera();
    const player = races['deps'].player;
    races.setGhost(fakeGhost('roost-loop', 'harrier'));
    races.debugStage('roost-loop', 0, 500, 'running');
    races.update(1 / 60, camera, player);
    expect(races.ghostWyvern?.rigDef.props.breed).toBe('harrier');
    races.abort('quit');
    races.setGhost(fakeGhost('roost-loop', 'ironback'));
    races.debugStage('roost-loop', 0, 500, 'running');
    races.update(1 / 60, camera, player);
    expect(races.ghostWyvern?.rigDef.props.breed).toBe('ironback');
    const mesh = races.ghostWyvern!.skinnedMesh!;
    const mats = mesh.material as { name: string }[];
    expect(mats.map((m) => m.name)).toEqual(['race-ghost-body', 'race-ghost-membrane']);
    // Its twins (depth prepass, the body's ink outline) follow the rebuilt mesh: one of each.
    const twins = mesh.parent!.children.filter((c) => c !== mesh && (c as { isSkinnedMesh?: boolean }).isSkinnedMesh) as SkinnedMesh[];
    const names = twins.map((t) => (t.material as { name: string }[])[0].name).sort();
    expect(names).toEqual(['race-ghost-depth', 'race-ghost-outline']);
    expect(twins.every((t) => t.geometry === mesh.geometry && t.skeleton === mesh.skeleton)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Start gates are solid
// ---------------------------------------------------------------------------------------------

describe('start gates collide', () => {
  it('pillars, rocks and lintel are solid; the opening stays clear', () => {
    const { races } = setup();
    const index = new ColliderIndex();
    index.addAll(races.colliders);
    const n = new Vector3();
    const p = new Vector3();
    for (const def of COURSES) {
      const g = gateRing(def);
      const right = new Vector3(g.nz, 0, -g.nx);
      const at = (lx: number, ly: number, lz = 0) => p.set(g.cx, g.cy + ly, g.cz).addScaledVector(right, lx).add(new Vector3(g.nx, 0, g.nz).multiplyScalar(lz));
      // A wyvern-sized sphere anywhere in the opening (short of the edges) touches nothing.
      for (let lx = -GATE_HALF_WIDTH + 2; lx <= GATE_HALF_WIDTH - 2; lx += 2) {
        for (let ly = -GATE_HALF_HEIGHT + 2; ly <= GATE_HALF_HEIGHT - 2; ly += 2) {
          expect(index.resolveSphere(at(lx, ly), 1.5, n), `${def.id} opening ${lx},${ly}`).toBe(false);
        }
      }
      // Both pillars, the lintel's keystone and its ends, and the rocks under the pillars.
      for (const [lx, ly] of [[-18.4, 0], [18.4, 0], [0, 21.5], [-14, 19], [14, 19], [-18.4, -22], [18.4, -27]]) {
        expect(index.resolveSphere(at(lx, ly), 1, n), `${def.id} solid ${lx},${ly}`).toBe(true);
      }
      // A pillar top can be landed on.
      const top = index.groundAt(at(18.4, 0).x, at(18.4, 0).z, g.cy + 25, 1);
      expect(top?.y, def.id).toBeGreaterThan(g.cy + 15);
    }
  });
});
