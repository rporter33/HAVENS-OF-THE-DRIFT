// Bond expression v1 (gate G4): the memory of passes and banks, the anticipatory lean's timing,
// the Windhaven greeting's arrival rules, and the lean reaching the wyvern model as presentation.

import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { DiscoveryZone } from '../progression/discovery';
import { discoveryZones } from '../progression/discovery';
import { LAYOUT } from '../world/layout';
import { Anticipation, type FlightSample } from './anticipation';
import { GREETING, HOME_LANDMARK, RoostGreeting, type GreetingSample } from './greeting';
import { BOND, BOND_KEY, BondStore, emptyBond, foldPass, knownSites, sanitizeBond, timeToSite, type BondData, type LandmarkBond, type ManeuverOnset } from './memory';
import { Wyvern } from '../creatures/wyvern/Wyvern';
import { gliding, look } from '../creatures/wyvern/wyvern.testkit';

/** A landmark vicinity 400 m across, from x = −200 to 200 along the flight line. */
const ZONE: DiscoveryZone = { landmarkId: 'test', name: 'Test', circles: [{ x: 0, z: 0, r: 200 }], y0: 0, y1: 600 };
/** Where the rider always banks: 40 m past the zone's middle, a right roll. */
const BANK_X = 40;
const SPEED = 30;

const onset = (x: number, dir: 1 | -1 = 1): ManeuverOnset => ({ x, y: 300, z: 0, hx: 1, hz: 0, dir });

/** A memory-backed fake for localStorage. */
function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

/**
 * Fly straight along +x through ZONE at SPEED, from x = −300 to 300, banking (stick right) at
 * `bankAt` for a second when given. Returns the time of the bank's onset and the lean seen.
 */
function flyPass(a: Anticipation, dt: number, bankAt: number | null = BANK_X, dir: 1 | -1 = 1) {
  let x = -300;
  let onsetT: number | null = null;
  let leanStart: number | null = null;
  let maxLean = 0;
  let leanAtOnset = 0;
  const s: FlightSample = { flying: true, x, y: 300, z: 0, vx: SPEED, vy: 0, vz: 0, roll: 0 };
  while (x < 300) {
    x += SPEED * dt;
    s.x = x;
    const banking = bankAt !== null && x >= bankAt && x < bankAt + SPEED;
    s.roll = banking ? dir : 0;
    a.update(dt, s);
    if (banking && onsetT === null) {
      onsetT = a.clock;
      leanAtOnset = a.value;
    }
    if (leanStart === null && a.value !== 0) leanStart = a.clock - dt;
    if (Math.abs(a.value) > Math.abs(maxLean)) maxLean = a.value;
  }
  return { onsetT, leanStart, maxLean, leanAtOnset };
}

describe('bond memory', () => {
  it('counts a bank toward the same site each pass and learns its place', () => {
    const lb: LandmarkBond = { passes: 0, sites: [] };
    foldPass(lb, [onset(40)]);
    foldPass(lb, [onset(46)]);
    foldPass(lb, [onset(34)]);
    expect(lb.passes).toBe(3);
    expect(lb.sites).toHaveLength(1);
    expect(lb.sites[0].seen).toBe(3);
    expect(lb.sites[0].x).toBeCloseTo(40, 6);
  });

  it('keeps banks the other way, elsewhere or on another heading apart', () => {
    const lb: LandmarkBond = { passes: 0, sites: [] };
    foldPass(lb, [onset(40), onset(40, -1), onset(40 + BOND.matchRadius + 5), { ...onset(40), hx: -1 }]);
    expect(lb.sites).toHaveLength(4);
    // Two onsets on one site in one pass count once.
    foldPass(lb, [onset(40), onset(42)]);
    expect(lb.sites.find((s) => s.dir === 1 && s.hx > 0 && s.x < 50)!.seen).toBe(2);
  });

  it('knows a bank only after the landmark has 3 passes and the bank 2', () => {
    const lb: LandmarkBond = { passes: 0, sites: [] };
    foldPass(lb, [onset(40)]);
    foldPass(lb, [onset(40)]);
    expect(knownSites(lb)).toHaveLength(0);
    foldPass(lb, [onset(-60, -1)]);
    expect(lb.passes).toBe(BOND.knownPasses);
    const known = knownSites(lb);
    expect(known).toHaveLength(1);
    expect(known[0].dir).toBe(1);
  });

  it('forgets the least-flown sites over the cap', () => {
    const lb: LandmarkBond = { passes: 0, sites: [] };
    foldPass(lb, [onset(0)]);
    foldPass(lb, [onset(0)]);
    foldPass(lb, Array.from({ length: BOND.maxSites + 4 }, (_, i) => onset(100 + i * 50)));
    expect(lb.sites).toHaveLength(BOND.maxSites);
    expect(lb.sites[0]).toMatchObject({ x: 0, seen: 2 });
  });

  it('times the approach to a site and ignores passing wide or the wrong way', () => {
    const site = { ...onset(40), seen: 2 };
    expect(timeToSite(site, -20, 300, 0, SPEED, 0, 0)).toBeCloseTo(2, 6);
    expect(timeToSite(site, -20, 300, BOND.matchRadius + 1, SPEED, 0, 0)).toBeNull();
    expect(timeToSite(site, 100, 300, 0, -SPEED, 0, 0)).toBeNull();
    expect(timeToSite(site, -20, 300, 0, 1, 0, 0)).toBeNull();
  });

  it('sanitizes whatever it loads', () => {
    expect(sanitizeBond(null)).toEqual(emptyBond());
    expect(sanitizeBond('x')).toEqual(emptyBond());
    const d = sanitizeBond({
      landmarks: {
        a: { passes: 4.7, sites: [{ x: 1, y: 2, z: 3, hx: 3, hz: 4, dir: -1, seen: 2 }, { x: 'no' }, { x: 1, y: 2, z: 3, hx: 0, hz: 0, dir: 1, seen: 1 }] },
        b: { passes: -3, sites: 'none' },
        c: 7,
      },
    });
    expect(d.landmarks.a.passes).toBe(4);
    expect(d.landmarks.a.sites).toEqual([{ x: 1, y: 2, z: 3, hx: 0.6, hz: 0.8, dir: -1, seen: 2 }]);
    expect(d.landmarks.b).toEqual({ passes: 0, sites: [] });
    expect(d.landmarks.c).toBeUndefined();
  });

  it('keeps its own document beside the save, and resets', () => {
    const st = fakeStorage();
    const store = new BondStore(st);
    foldPass((store.data.landmarks.roost = { passes: 0, sites: [] }), [onset(1)]);
    store.save();
    expect([...st.m.keys()]).toEqual([BOND_KEY]);
    expect(BOND_KEY).not.toBe('driftwing.save.v1');
    expect(new BondStore(st).data.landmarks.roost.passes).toBe(1);
    st.m.set(BOND_KEY, '{not json');
    expect(new BondStore(st).data).toEqual(emptyBond());
    store.reset();
    expect(st.m.size).toBe(0);
    expect(new BondStore(null).data).toEqual(emptyBond());
  });
});

describe('anticipatory lean', () => {
  const make = () => {
    const data: BondData = emptyBond();
    return { data, a: new Anticipation([ZONE], () => data) };
  };

  for (const fps of [30, 60, 144]) {
    it(`leans into a known bank 0.3 to 0.5 s before it, from the 4th pass (${fps} fps)`, () => {
      const { data, a } = make();
      const dt = 1 / fps;
      for (let pass = 1; pass <= BOND.knownPasses; pass++) {
        const r = flyPass(a, dt);
        expect(r.leanStart, `pass ${pass}`).toBeNull();
        expect(data.landmarks.test.passes).toBe(pass);
      }
      const r = flyPass(a, dt);
      expect(r.leanStart).not.toBeNull();
      const lead = r.onsetT! - r.leanStart!;
      expect(lead).toBeGreaterThanOrEqual(BOND.leadMin);
      expect(lead).toBeLessThanOrEqual(0.5);
      expect(a.last!.lead).toBeGreaterThanOrEqual(BOND.leadMin);
      expect(a.last!.lead).toBeLessThanOrEqual(0.5);
      // Into the bank (right), fully in by the time the stick goes over, then let go.
      expect(r.maxLean).toBeCloseTo(1, 6);
      expect(r.leanAtOnset).toBeGreaterThan(0.99);
      expect(a.value).toBe(0);
      expect(data.landmarks.test.passes).toBe(BOND.knownPasses + 1);
    });
  }

  it('leans the way the rider banks there', () => {
    const { a } = make();
    for (let i = 0; i < BOND.knownPasses; i++) flyPass(a, 1 / 60, BANK_X, -1);
    const r = flyPass(a, 1 / 60, BANK_X, -1);
    expect(r.maxLean).toBeCloseTo(-1, 6);
  });

  it('never leans for a bank flown only once, or at a landmark flown fewer than 3 times', () => {
    const { a } = make();
    flyPass(a, 1 / 60, null);
    flyPass(a, 1 / 60, null);
    flyPass(a, 1 / 60, BANK_X);
    expect(flyPass(a, 1 / 60).leanStart).toBeNull();
    const fresh = make();
    // Banked twice in two passes: a known bank, but only 2 passes so far.
    flyPass(fresh.a, 1 / 60);
    flyPass(fresh.a, 1 / 60);
    const third = flyPass(fresh.a, 1 / 60);
    expect(third.leanStart).toBeNull();
  });

  it('lets go when the bank never comes, and does not lean flying the other way', () => {
    const { a } = make();
    for (let i = 0; i < BOND.knownPasses; i++) flyPass(a, 1 / 60);
    const r = flyPass(a, 1 / 60, null);
    expect(r.leanStart).not.toBeNull();
    expect(a.value).toBe(0);
    // Reverse along the line: the site's heading is the other way.
    const s: FlightSample = { flying: true, x: 300, y: 300, z: 0, vx: -SPEED, vy: 0, vz: 0, roll: 0 };
    let leaned = false;
    for (; s.x > -300; s.x -= SPEED / 60) {
      a.update(1 / 60, s);
      leaned ||= a.value !== 0;
    }
    expect(leaned).toBe(false);
  });

  it('is still off the saddle, and a clipped edge is not a pass', () => {
    const { data, a } = make();
    const s: FlightSample = { flying: false, x: 0, y: 300, z: 0, vx: SPEED, vy: 0, vz: 0, roll: 1 };
    for (let i = 0; i < 120; i++) a.update(1 / 60, s);
    expect(a.value).toBe(0);
    expect(data.landmarks.test).toBeUndefined();
    s.flying = true;
    s.x = 199;
    a.update(0.5, s);
    s.x = 260;
    a.update(1 / 60, s);
    expect(data.landmarks.test).toBeUndefined();
  });
});

describe('Windhaven greeting', () => {
  const home = discoveryZones(LAYOUT).find((z) => z.landmarkId === HOME_LANDMARK)!;
  const roost = LAYOUT.landmarks.find((l) => l.id === HOME_LANDMARK)!.position;
  const inside = (): GreetingSample => ({ mode: 'onFoot', x: roost[0], y: roost[1], z: roost[2], modeTime: 10, wyvernSettled: true, wyvernDistance: 5 });
  const outside = (): GreetingSample => ({ ...inside(), mode: 'flying', x: roost[0] + 3000 });
  const run = (g: RoostGreeting, s: GreetingSample, seconds: number) => {
    const out: string[] = [];
    for (let t = 0; t < seconds; t += 1 / 30) {
      const k = g.update(1 / 30, s);
      if (k) out.push(k);
    }
    return out;
  };

  it('uses the Roost landmark the game spawns at', () => {
    expect(home).toBeDefined();
  });

  it('does not greet at the start of a session, home already', () => {
    const g = new RoostGreeting(home);
    expect(run(g, inside(), 5)).toEqual([]);
  });

  it('greets once on landing at Windhaven after time away, after the landing settles', () => {
    const g = new RoostGreeting(home);
    run(g, outside(), GREETING.awayTime + 1);
    expect(run(g, { ...inside(), mode: 'flying' }, 3)).toEqual([]);
    const landing = { ...inside(), mode: 'landed' as const, modeTime: 0 };
    expect(g.update(1 / 30, landing)).toBeNull();
    landing.modeTime = GREETING.landSettle;
    expect(g.update(1 / 30, landing)).toBe('landing');
    expect(run(g, landing, 10)).toEqual([]);
    expect(g.count).toBe(1);
  });

  it('greets arriving on foot once the wyvern has come over', () => {
    const g = new RoostGreeting(home);
    run(g, { ...outside(), mode: 'traversing' }, GREETING.awayTime + 1);
    const far = { ...inside(), wyvernDistance: 60, wyvernSettled: false };
    expect(run(g, far, 3)).toEqual([]);
    expect(run(g, inside(), 1)).toEqual(['foot']);
  });

  it('does not count a short hop out as being away, and lets a missed moment go', () => {
    const g = new RoostGreeting(home);
    run(g, outside(), GREETING.awayTime - 2);
    expect(run(g, inside(), 3)).toEqual([]);
    run(g, outside(), GREETING.awayTime + 1);
    expect(run(g, { ...inside(), wyvernSettled: false }, GREETING.patience + 1)).toEqual([]);
    expect(run(g, inside(), 3)).toEqual([]);
    // Coming back again after a while away greets again.
    run(g, outside(), GREETING.awayTime + 1);
    expect(run(g, inside(), 1)).toEqual(['foot']);
  });
});

describe('the lean on the wyvern', () => {
  /** World roll (rad, + = right side down) of the spine bone after a second of gliding. */
  const spineRoll = (anticipate: number | undefined) => {
    const w = new Wyvern(look('harrier'));
    const pose = gliding();
    if (anticipate !== undefined) pose.anticipate = anticipate;
    for (let i = 0; i < 60; i++) {
      pose.position.z += 24 / 60;
      pose.lookTarget.z += 24 / 60;
      w.update(1 / 60, pose);
    }
    const bone = w.skinnedMesh!.skeleton.bones.find((b) => b.name === 'spine')!;
    const q = bone.getWorldQuaternion(new Quaternion());
    const left = new Vector3(1, 0, 0).applyQuaternion(q);
    return { roll: Math.asin(left.y), head: w.getHead(new Vector3()) };
  };

  it('rolls the body and turns the head into the bank, and is absent by default', () => {
    const none = spineRoll(undefined);
    const zero = spineRoll(0);
    expect(zero.roll).toBe(none.roll);
    expect(zero.head.toArray()).toEqual(none.head.toArray());
    const right = spineRoll(1);
    const left = spineRoll(-1);
    // Right bank: the left wing (+X) rises; the head swings right (−X).
    expect(right.roll - none.roll).toBeGreaterThan(0.05);
    expect(left.roll - none.roll).toBeLessThan(-0.05);
    expect(right.head.x).toBeLessThan(none.head.x - 0.1);
    expect(left.head.x).toBeGreaterThan(none.head.x + 0.1);
  });
});
