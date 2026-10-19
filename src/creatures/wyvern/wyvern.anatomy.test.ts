// Wyvern anatomy: proportions, budgets and cosmetics, rebuilds, the seat (stream A). The body
// plan of a flier, reptile proportions, the breeds' silhouettes and the geometry budgets of every
// LOD (see the dragon quality bar Q2-Q5, Q15). Shared poses and helpers: wyvern.testkit.ts.

import { describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { BreedId } from '../../core/types';
import { BREEDS, BREED_ORDER } from '../../flight/breeds';
import { COSMETICS, cosmeticsFor } from '../../cosmetics/catalog';
import { Wyvern } from './Wyvern';
import { buildRig, rigFor } from './rig';
import { computeProportions } from './proportions';
import { buildWyvernGeometry } from './geometry';
import { humerusRootRadius } from './parts/wings';
import { LOD_BUDGET, type Lod } from './parts/res';
import { PATTERN_IDS } from './materials';
import { STAND_ROOT_PITCH } from './animator';
import { TACK, tackClearance } from './parts/saddle';
import { Hide } from './parts/body';
import { REGION, ZONE } from './builder';
import { DEG } from '../../core/math';
import { boneWorld, gliding, look, standing } from './wyvern.testkit';

describe('proportions', { timeout: 30000 }, () => {
  it('honors the true wingspan (bind pose, tip to tip)', () => {
    for (const breed of BREED_ORDER) {
      const rig = buildRig(breed);
      expect(rig.fingerTips[0].x * 2).toBeCloseTo(BREEDS[breed].wingspan, 3);
    }
  });

  it('sizes the wing to the body and finds its span in the wingtip finger (A13)', () => {
    // B8's bigger spans scaled the whole wing 16-19%, and the longer folded forearm put the elbow
    // into the haunch. The arm, the hand and the inner fingers are the body's (WingShape.armLength):
    // only the wingtip finger's outer phalanx, which folds back along the flank, carries the span.
    for (const breed of BREED_ORDER) {
      const P = computeProportions(breed);
      const W = P.shape.wing;
      const unit = W.armLength / (W.humerus + W.forearm);
      expect(P.arm.humerus + P.arm.forearm, breed).toBeCloseTo(W.armLength, 6);
      expect(P.arm.humerus / P.arm.forearm, breed).toBeCloseTo(W.humerus / W.forearm, 6);
      expect(P.arm.hand, breed).toBeCloseTo(W.hand * unit, 6);
      expect(P.arm.fingers[0][0], breed).toBeCloseTo(W.fingers[0][0] * unit, 6);
      for (const f of [1, 2]) for (const k of [0, 1]) expect(P.arm.fingers[f][k], breed).toBeCloseTo(W.fingers[f][k] * unit, 6);
      // The outer phalanx: longer than the inner one (a wing finger), but no whip (1.5-1.9x).
      expect(P.arm.fingers[0][1] / P.arm.fingers[0][0], breed).toBeGreaterThan(1);
      expect(P.arm.fingers[0][1] / P.arm.fingers[0][0], breed).toBeLessThan(2.2);
    }
  });

  it('is about 11 m nose to tail for the harrier (a flier: the wings outspan the body), smaller for the skimmer', () => {
    const len = (b: BreedId) => {
      const r = buildRig(b);
      return r.mouth.z - r.tailTip.z;
    };
    expect(len('harrier')).toBeGreaterThan(10.5);
    expect(len('harrier')).toBeLessThan(12.5);
    for (const b of BREED_ORDER) expect(len(b)).toBeLessThan(BREEDS[b].wingspan);
    expect(len('skimmer')).toBeLessThan(len('harrier'));
    expect(len('galewing')).toBeGreaterThan(len('skimmer'));
  });

  it('gives each breed its build: ironback stockiest, galewing slimmest for its span', () => {
    const girth = (b: BreedId) => buildRig(b).props.shape.torsoHalfWidth;
    expect(girth('ironback')).toBeGreaterThan(girth('harrier'));
    expect(girth('harrier')).toBeGreaterThan(girth('skimmer'));
    const slim = (b: BreedId) => girth(b) / BREEDS[b].wingspan;
    for (const b of ['harrier', 'skimmer', 'ironback'] as const) expect(slim('galewing')).toBeLessThan(slim(b));
  });

  it('plants the feet on the ground when standing at standHeight', () => {
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      for (let i = 0; i < 90; i++) w.update(1 / 60, pose);
      const sole = w.rigDef.props.leg.sole;
      for (const n of ['toesL', 'toesR']) {
        const ball = boneWorld(w, n);
        // The ball of the foot sits one sole thickness above the ground.
        expect(ball.y - 10).toBeGreaterThan(sole - 0.03);
        expect(ball.y - 10).toBeLessThan(sole + 0.03);
      }
      // Wing claws rest on the ground too (quadrupedal stance).
      for (const n of ['clawL', 'clawR']) {
        const wrist = boneWorld(w, n);
        expect(wrist.y - 10).toBeLessThan(0.3 * BREEDS[breed].standHeight);
        expect(wrist.y - 10).toBeGreaterThan(0);
      }
      w.dispose();
    }
  });
});


// Building ~150 meshes is quick (a few seconds) but give a loaded shared machine headroom.
describe('model budget and cosmetics', { timeout: 60000 }, () => {
  const slots = { wyvernPattern: 'pattern', wyvernHorns: 'horns', wyvernFrill: 'frill', wyvernTail: 'tail', saddle: 'saddle' } as const;

  it('builds every catalog id for every breed within budget', () => {
    for (const breed of BREED_ORDER) {
      for (const c of COSMETICS) {
        const key = slots[c.slot as keyof typeof slots];
        if (!key) continue;
        const w = new Wyvern(look(breed, { [key]: c.id }));
        const s = w.stats;
        // The bone texture stays 16x16; LOD0 within its budget (Q15).
        expect(s.bones).toBeLessThanOrEqual(64);
        expect(s.triangles).toBeGreaterThan(9000);
        expect(s.triangles).toBeLessThanOrEqual(LOD_BUDGET[breed][0]);
        const g = w.skinnedMesh!.geometry;
        const pos = g.getAttribute('position').array;
        let finite = true;
        for (let i = 0; i < pos.length; i++) finite &&= Number.isFinite(pos[i]);
        expect(finite).toBe(true);
        const si = g.getAttribute('skinIndex').array;
        const sw = g.getAttribute('skinWeight').array;
        let worstSum = 0;
        let maxIndex = 0;
        for (let v = 0; v < sw.length; v += 4) {
          worstSum = Math.max(worstSum, Math.abs(sw[v] + sw[v + 1] + sw[v + 2] + sw[v + 3] - 1));
          for (let k = 0; k < 4; k++) maxIndex = Math.max(maxIndex, si[v + k]);
        }
        expect(worstSum).toBeLessThan(1e-4);
        expect(maxIndex).toBeLessThan(s.bones);
        expect(g.groups.length).toBe(2);
        w.dispose();
      }
    }
  });

  it('gives every shape cosmetic its own geometry', () => {
    for (const [slot, key] of [
      ['wyvernHorns', 'horns'],
      ['wyvernFrill', 'frill'],
      ['wyvernTail', 'tail'],
      ['saddle', 'saddle'],
    ] as const) {
      const counts = new Set<number>();
      const ids = cosmeticsFor(slot);
      for (const c of ids) {
        const w = new Wyvern(look('harrier', { [key]: c.id }));
        counts.add(w.stats.vertices);
        w.dispose();
      }
      expect(counts.size).toBe(ids.length);
    }
  });

  it('builds a membrane area in proportion to the breed', () => {
    const area = (b: BreedId) => {
      const w = new Wyvern(look(b));
      const a = w.stats.membraneArea * 2;
      w.dispose();
      return a;
    };
    for (const b of BREED_ORDER) {
      const a = area(b);
      // Visual membranes cover most of the physical wing area (the rest is body and arm).
      expect(a / BREEDS[b].wingArea).toBeGreaterThan(0.35);
      expect(a / BREEDS[b].wingArea).toBeLessThan(1.1);
      // ...and track it: B8 grew the flight model's area 8-9% for 16-19% more span (a slimmer
      // wing), so the membranes keep their share of it (0.42-0.60; scaling the whole wing with
      // the span made it 0.50-0.74, the visual wing a third bigger than the one that flies).
      expect(a / BREEDS[b].wingArea, b).toBeGreaterThan(0.4);
      expect(a / BREEDS[b].wingArea, b).toBeLessThan(0.65);
    }
  });
});

describe('setLook', () => {
  it('only touches uniforms for colors and patterns', () => {
    const w = new Wyvern(look('harrier'));
    const g = w.skinnedMesh!.geometry;
    w.setLook(look('harrier', { primary: '#ff0000', pattern: 'stripes', membrane: '#00ff00' }));
    expect(w.skinnedMesh!.geometry).toBe(g);
    expect(w.uniforms.uPrimary.value.r).toBeCloseTo(1, 3);
    expect(w.uniforms.uPattern.value).toBe(PATTERN_IDS.stripes);
    w.dispose();
  });

  it('rebuilds and disposes the old resources on a shape or breed change', () => {
    const w = new Wyvern(look('harrier'));
    const g = w.skinnedMesh!.geometry;
    const sk = w.skinnedMesh!.skeleton;
    const gd = vi.spyOn(g, 'dispose');
    const sd = vi.spyOn(sk, 'dispose');
    w.setLook(look('harrier', { horns: 'ram' }));
    expect(gd).toHaveBeenCalled();
    expect(sd).toHaveBeenCalled();
    expect(w.skinnedMesh!.geometry).not.toBe(g);
    // Exactly one mesh and one bone root under the group.
    expect(w.group.children.filter((c) => (c as { isSkinnedMesh?: boolean }).isSkinnedMesh).length).toBe(1);
    expect(w.group.children.filter((c) => (c as { isBone?: boolean }).isBone).length).toBe(1);
    const before = w.rigDef;
    w.setLook(look('ironback'));
    expect(w.rigDef).not.toBe(before);
    expect(w.rigDef.props.breed).toBe('ironback');
    // The saddle anchor survives rebuilds (the rider holds a reference to it).
    expect(w.saddle.parent).not.toBeNull();
    w.dispose();
  });
});

describe('accessors', () => {
  it('puts the head in front of the body and the saddle on top of it', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    for (let i = 0; i < 30; i++) w.update(1 / 60, pose);
    const head = w.getHead(new Vector3());
    expect(head.z - pose.position.z).toBeGreaterThan(2);
    expect(head.y).toBeGreaterThan(pose.position.y);
    const seat = w.saddle.getWorldPosition(new Vector3());
    expect(seat.y - pose.position.y).toBeGreaterThan(0.6);
    expect(seat.y - pose.position.y).toBeLessThan(1.6);
    expect(Math.abs(seat.x - pose.position.x)).toBeLessThan(0.05);
    expect(w.saddle.userData.halfWidth).toBeGreaterThan(0.2);
    expect(w.saddle.userData.halfWidth).toBeLessThan(0.9);
    expect(w.saddle.userData.gripOffset).toBeInstanceOf(Vector3);
    w.dispose();
  });
});

describe('seat', () => {
  it('reports the standing seat in the body frame, matching the saddle anchor (mount/dismount line-up)', () => {
    for (const breed of BREED_ORDER) {
      for (const saddle of ['rider', 'racing', 'royal', 'nomad']) {
        const w = new Wyvern(look(breed, { saddle }));
        const pose = standing(breed);
        for (let i = 0; i < 90; i++) w.update(1 / 60, pose);
        const seat = w.seatOffset(new Vector3());
        const anchor = w.saddle.getWorldPosition(new Vector3()).sub(pose.position);
        // Within a couple of cm (breathing moves the body a hair).
        expect(seat.distanceTo(anchor)).toBeLessThan(0.025);
        expect(seat.y).toBeGreaterThan(0.5);
        // Over the middle of the torso (the standing pitch leans the raised seat back a little).
        expect(Math.abs(seat.z), `${breed} ${saddle}`).toBeLessThan(0.12 * w.rigDef.props.shape.torsoLength);
        w.dispose();
      }
    }
    expect(STAND_ROOT_PITCH).toBeLessThan(0);
  });

  it('raises a narrow seat on a frame as tall as the straddle needs: knees in, thighs near vertical, hands up front', () => {
    // A9 + A12: the seat is a narrow block on a raised frame; it stands as tall above the back as
    // the rider's straddle needs on each breed (TACK.straddle: knees 0.30 m from the midline,
    // thighs within 35 degrees of vertical), so the knee clears the blanketed hide. The barrel the
    // legs wrap (SaddleFlank) is the blanketed hide itself.
    const D = TACK.straddle;
    const dx = D.kneeX - D.hipX;
    const dy = Math.sqrt(D.thigh ** 2 - dx ** 2 - D.kneeFwd ** 2);
    expect(Math.atan2(Math.hypot(dx, D.kneeFwd), dy) / DEG).toBeLessThanOrEqual(35);
    for (const breed of BREED_ORDER) {
      for (const saddle of ['rider', 'racing', 'royal', 'nomad']) {
        const w = new Wyvern(look(breed, { saddle }));
        const rig = w.rigDef;
        const st = rig.plan.station(rig.plan.sAtZ(rig.seat.z));
        const topY = st.center.y + st.upper;
        const seat = (w as unknown as { info: { saddle: { seat: Vector3 } } }).info.saddle.seat;
        expect(seat.y - topY, `${breed} ${saddle} seat height`).toBeGreaterThanOrEqual(0.3);
        expect(seat.y - topY, `${breed} ${saddle} seat height`).toBeLessThanOrEqual(0.62);
        expect(w.saddle.userData.halfWidth).toBeCloseTo(0.28, 6);
        const flank = w.saddle.userData.flank as { cy: number; rx: number; ry: number; sq: number };
        const width = (y: number) => {
          const t = Math.abs(y - flank.cy) / flank.ry;
          return t >= 1 ? 0 : flank.rx * Math.pow(1 - Math.pow(t, flank.sq), 1 / flank.sq);
        };
        // The straddle's knee (its radius in) clears the barrel; the barrel keeps the body's width.
        const kneeY = -(D.hipDrop + dy);
        expect(width(kneeY), `${breed} ${saddle} flank at the knees`).toBeLessThanOrEqual(D.kneeX - D.legR);
        expect(width(st.center.y - seat.y), `${breed} ${saddle} flank at the equator`).toBeGreaterThan(st.halfWidth);
        // Hands on the pommel (racing: the neck handles): up and forward of the hips.
        const g = w.saddle.userData.gripOffset as Vector3;
        expect(g.y, `${breed} ${saddle} grip`).toBeGreaterThan(0.1);
        expect(g.y).toBeLessThan(0.45);
        expect(g.z, `${breed} ${saddle} grip`).toBeGreaterThan(0.2);
        w.dispose();
      }
    }
  });

  it('exposes the pommel and the forearm steps as sockets that follow the animation', () => {
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      for (let i = 0; i < 60; i++) w.update(1 / 60, pose);
      const seat = w.socket('seat', new Vector3())!;
      const pommel = w.socket('pommel', new Vector3())!;
      // The pommel just ahead of and above the hips, on the midline, behind the withers.
      expect(pommel.z - seat.z).toBeGreaterThan(0.18);
      expect(pommel.z - pose.position.z).toBeLessThan(0.28 * w.rigDef.props.shape.torsoLength);
      expect(pommel.y - seat.y).toBeGreaterThan(0);
      expect(Math.abs(pommel.x - pose.position.x)).toBeLessThan(0.02);
      // A step on each forearm, on its side of the body, between the ground and the shoulder.
      for (const [name, sx] of [
        ['stepL', 1],
        ['stepR', -1],
      ] as const) {
        const step = w.socket(name, new Vector3())!;
        expect((step.x - pose.position.x) * sx, `${breed} ${name}`).toBeGreaterThan(0.5);
        expect(step.y - 10, `${breed} ${name}`).toBeGreaterThan(0.3);
        expect(step.y - 10, `${breed} ${name}`).toBeLessThan(0.75 * BREEDS[breed].standHeight);
        // Near the forearm bone (on its surface, not inside the body or off in the air).
        const fore = boneWorld(w, `forearm${name === 'stepL' ? 'L' : 'R'}`);
        const hand = boneWorld(w, `hand${name === 'stepL' ? 'L' : 'R'}`);
        const mid = fore.clone().lerp(hand, 0.55);
        expect(step.distanceTo(mid), `${breed} ${name}`).toBeLessThan(0.45);
      }
      // Sockets move with the body.
      const before = w.socket('pommel', new Vector3())!;
      pose.position.x += 3;
      w.update(1 / 60, pose);
      expect(w.socket('pommel', new Vector3())!.x - before.x).toBeCloseTo(3, 1);
      w.dispose();
    }
  });
});

/** Body plan cross-section at a named key. */
function keyProfile(breed: BreedId, mark: 'neckBase' | 'shoulder' | 'chest' | 'mid' | 'rear' | 'tailBase') {
  const rig = rigFor(breed);
  const s = rig.plan.keyS[rig.plan.marks[mark]];
  return { s, ...rig.plan.profile(s), center: rig.plan.point(s, new Vector3()) };
}

describe('a flier\'s body plan (Q2)', () => {
  it('is broadest at the shoulder girdle, not the belly, with the keel deepest under the shoulders', () => {
    for (const breed of BREED_ORDER) {
      const sh = keyProfile(breed, 'shoulder');
      const mid = keyProfile(breed, 'mid');
      expect(sh.hw / mid.hw, breed).toBeGreaterThanOrEqual(1.1);
      // No pot belly: the belly line rises from the sternum back to the hips.
      const rig = rigFor(breed);
      const k = rig.plan.keyS;
      const m = rig.plan.marks;
      let prev = -Infinity;
      let lowest = Infinity;
      let lowestZ = 0;
      for (let s = k[m.neckBase]; s <= k[m.rear]; s += 0.05) {
        const st = rig.plan.station(s);
        const belly = st.center.y - st.lower;
        if (belly < lowest) {
          lowest = belly;
          lowestZ = st.center.z;
        }
        if (s >= k[m.chest]) {
          expect(belly, `${breed} belly at s=${s.toFixed(2)}`).toBeGreaterThan(prev - 0.002);
          prev = belly;
        }
      }
      // The deepest point is the sternum, between the shoulders and the chest.
      expect(lowestZ / rig.props.shape.torsoLength, breed).toBeGreaterThan(0.1);
    }
  });

  it('carries a massive arm: the humerus root at least 0.85x the thigh', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      expect(humerusRootRadius(rig) / rig.props.shape.thighRadius, breed).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('never folds the body tube over itself (cross-sections advance along the centreline)', () => {
    for (const breed of BREED_ORDER) {
      const { plan } = rigFor(breed);
      const a = new Vector3();
      const b = new Vector3();
      for (let s = 0.1; s < plan.length - 0.2; s += 0.05) {
        const t = plan.station(s).tangent;
        for (const th of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          plan.surface(s, th, a);
          plan.surface(s + 0.05, th, b);
          expect(b.sub(a).dot(t), `${breed} s=${s.toFixed(2)} θ=${th.toFixed(2)}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('predator proportions (Q4)', () => {
  it('keeps the tail at most 40% of nose-to-tip (ironback 37%), and the wings outspan the body', () => {
    for (const breed of BREED_ORDER) {
      const rig = buildRig(breed);
      const len = rig.mouth.z - rig.tailTip.z;
      const tail = rig.bones[rig.idx.tail[0]].pos.z - rig.tailTip.z;
      expect(tail / len, breed).toBeLessThanOrEqual(breed === 'ironback' ? 0.37 : 0.4);
      expect(BREEDS[breed].wingspan, breed).toBeGreaterThan(len);
    }
  });

  it('flattens the tail side to side like a crocodile\'s rudder beyond 30% of its length', () => {
    for (const breed of BREED_ORDER) {
      const { plan } = rigFor(breed);
      const s0 = plan.keyS[plan.marks.tailBase];
      const L = plan.length - s0;
      for (let t = 0.3; t <= 0.9; t += 0.05) {
        const p = plan.profile(s0 + t * L);
        expect(p.hu + p.hl, `${breed} t=${t.toFixed(2)}`).toBeGreaterThan(2 * p.hw);
      }
      // Thick through the first quarter: the tail root anchors the thighs.
      const root = plan.profile(s0 + 0.2 * L);
      expect(root.hw / plan.profile(s0).hw, breed).toBeGreaterThan(0.7);
    }
  });

  it('flows the neck base into the shoulders', () => {
    for (const breed of BREED_ORDER) {
      const base = keyProfile(breed, 'neckBase');
      expect(base.hw / rigFor(breed).props.shape.torsoHalfWidth, breed).toBeGreaterThanOrEqual(0.85);
    }
  });
});

// Builds every breed x catalog id x LOD (~300 meshes): give a loaded shared machine headroom.
describe('levels of detail (Q15)', { timeout: 120000 }, () => {
  const slots = { wyvernHorns: 'horns', wyvernFrill: 'frill', wyvernTail: 'tail', saddle: 'saddle', wyvernPattern: 'pattern' } as const;
  const budget = (breed: BreedId, lod: Lod) => LOD_BUDGET[breed][lod];

  it('builds all three LODs of every breed and catalog id within budget, on the same skeleton', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const bones = rig.bones.length;
      for (const c of COSMETICS) {
        const key = slots[c.slot as keyof typeof slots];
        if (!key) continue;
        const tris: number[] = [];
        for (const lod of [0, 1, 2] as Lod[]) {
          const info = buildWyvernGeometry(rig, look(breed, { [key]: c.id }), lod);
          const g = info.geometry;
          tris.push(info.triangles);
          expect(info.triangles, `${breed} ${c.id} LOD${lod}`).toBeLessThanOrEqual(budget(breed, lod));
          // Uint16 indices: well under 65,535 vertices.
          expect(info.vertices).toBeLessThan(60000);
          expect(g.index!.array).toBeInstanceOf(Uint16Array);
          const si = g.getAttribute('skinIndex').array;
          let maxIndex = 0;
          for (let i = 0; i < si.length; i++) maxIndex = Math.max(maxIndex, si[i]);
          expect(maxIndex).toBeLessThan(bones);
          expect(g.groups.length).toBe(2);
          g.dispose();
        }
        // Each level is a real step down.
        expect(tris[1]).toBeLessThan(tris[0] * 0.45);
        expect(tris[2]).toBeLessThan(tris[1] * 0.4);
      }
    }
  });

  it('keeps the bone texture at 16x16 (at most 64 bones)', () => {
    for (const breed of BREED_ORDER) expect(rigFor(breed).bones.length).toBeLessThanOrEqual(64);
  });
});

describe('the folded wing contracts (Q3, A2 rig side)', () => {
  it('has fold helpers on the chest at the inner panel, skinning its interior and pleat valleys', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const [fl, fr] = rig.idx.fold;
      expect(rig.bones[fl].name).toBe('foldL');
      expect(rig.bones[fr].name).toBe('foldR');
      expect(rig.bones[fl].parent).toBe(rig.idx.chest);
      // Between the shoulder and the flank root, out from the body, mirrored.
      const p = rig.bones[fl].pos;
      expect(p.x).toBeGreaterThan(rig.props.shoulder[0]);
      expect(p.x).toBeLessThan(rig.fingerTips[2].x);
      expect(rig.bones[fr].pos.x).toBeCloseTo(-p.x, 6);
      const g = buildWyvernGeometry(rig, look(breed), 0).geometry;
      const si = g.getAttribute('skinIndex');
      const sw = g.getAttribute('skinWeight');
      const ex = g.getAttribute('aExtra');
      const idx = g.index!.array;
      const g1 = g.groups[1];
      const membrane = new Set<number>();
      for (let i = g1.start; i < g1.start + g1.count; i++) membrane.add(idx[i]);
      let maxW = 0;
      let pleated = 0;
      for (let v = 0; v < si.count; v++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === fl || si.getComponent(v, k) === fr) w += sw.getComponent(v, k);
        if (w > 0) expect(membrane.has(v)).toBe(true);
        maxW = Math.max(maxW, w);
        const y = ex.getY(v);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
        if (y > 0.5) {
          expect(membrane.has(v)).toBe(true);
          pleated++;
        }
      }
      expect(maxW).toBeGreaterThan(0.45);
      expect(maxW).toBeLessThan(0.6);
      expect(pleated).toBeGreaterThan(20);
      g.dispose();
    }
  });
});

describe('the inner membrane folds and beats like a sheet hinged on the flank (A2)', () => {
  it('skins it by lever arm: the rows by the root ride the body, the trailing edge passes from the flank to finger 2', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const g = buildWyvernGeometry(rig, look(breed), 0).geometry;
      const uv = g.getAttribute('aUv2');
      const mat = g.getAttribute('aMat');
      const pos = g.getAttribute('position');
      const si = g.getAttribute('skinIndex');
      const sw = g.getAttribute('skinWeight');
      const idx = g.index!.array;
      const g1 = g.groups[1];
      const arm = new Set([rig.idx.wings[0].humerus, rig.idx.wings[0].forearm, rig.idx.wings[0].hand]);
      const finger2 = new Set(rig.idx.wings[0].fingers[2]);
      const share = (v: number, set: Set<number>) => {
        let w = 0;
        for (let k = 0; k < 4; k++) if (set.has(si.getComponent(v, k))) w += sw.getComponent(v, k);
        return w;
      };
      const seen = new Set<number>();
      let rootRows = 0;
      let edge = 0;
      for (let i = g1.start; i < g1.start + g1.count; i++) {
        const v = idx[i];
        if (seen.has(v) || Math.round(mat.getX(v)) !== 0 || pos.getX(v) <= 0) continue;
        seen.add(v);
        const t = uv.getX(v);
        const pv = uv.getY(v) - 2;
        if (pv < 0 || pv > 1) continue;
        // Interior rows next to the root (away from the arm's own edge): little on the arm.
        if (t > 0.02 && t <= 0.08 && pv >= 0.4) {
          expect(share(v, arm), `${breed} root row t=${t.toFixed(2)} v=${pv.toFixed(2)}`).toBeLessThan(0.15);
          rootRows++;
        }
        // The trailing edge passes linearly from the flank to finger 2 (C3's trailRoll rolls finger 2
        // so the edge's midpoint, half on each, lies half-way across; A13 returned it from the
        // (1 − t)^1.5 fall-off, which put 0.65 on finger 2 there and turned the folded panel's
        // middle 20-37 cm into the flank).
        if (Math.abs(pv - 1) < 1e-4 && t >= 0.1) {
          expect(share(v, finger2), `${breed} trailing edge t=${t.toFixed(2)}`).toBeCloseTo(t, 1);
          edge++;
        }
      }
      expect(rootRows).toBeGreaterThan(5);
      expect(edge).toBeGreaterThan(3);
      // Pleat geometry: rows enough across the panel for the fold's eight pleats (four per pleat).
      const vs = new Set<number>();
      for (const v of seen) if (uv.getY(v) >= 2 && uv.getY(v) <= 3) vs.add(Math.round((uv.getY(v) - 2) * 1000));
      expect(vs.size, breed).toBeGreaterThanOrEqual(33);
      g.dispose();
    }
  });
});

describe('reptile head (A6)', () => {
  it('keeps the expert-approved horn placement: swept horn roots within 1 mm of before', () => {
    // Base-ring centres of the default swept horns (head space, m), harrier: left big horn, left
    // lower horn. Re-recorded 2026-10-18 when Robert asked for a more pronounced harrier head
    // (proportions.ts HEAD_STYLES.harrier: 6% longer, deeper and broader); the horns keep the same
    // place on the skull relative to its length, breadth and depth.
    const before = [
      [0.14971, 0.37463, 0.27984],
      [0.34084, 0.21722, 0.13992],
    ];
    const rig = rigFor('harrier');
    const H = rig.bones[rig.idx.head].pos;
    const L = rig.props.shape.headLength;
    const Wd = rig.props.shape.headHalfWidth;
    const Hh = rig.props.shape.headHalfHeight;
    // The same construction as cosmetics.buildHorns 'swept' (the roots are the first path points).
    const at = (x: number, y: number, z: number) => new Vector3(x * Wd, y * Hh, z * L);
    const big = at(0.6, 0.95, 0.14).add(new Vector3(-0.1 * L, -0.06 * L, 0.06 * L));
    const low = at(0.88, 0.45, 0.06).add(new Vector3(-0.06 * L, 0, 0.04 * L));
    for (const [p, ref] of [
      [big, before[0]],
      [low, before[1]],
    ] as const) {
      expect(Math.hypot(p.x - ref[0], p.y - ref[1], p.z - ref[2])).toBeLessThan(0.001);
    }
    // And the mesh really roots its horns there: horn vertices ring each root.
    const g = buildWyvernGeometry(rig, look('harrier'), 0).geometry;
    const pos = g.getAttribute('position');
    const mat = g.getAttribute('aMat');
    for (const p of [big, low]) {
      let near = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.round(mat.getX(i)) !== 1) continue;
        const d = Math.hypot(pos.getX(i) - H.x - p.x, pos.getY(i) - H.y - p.y, pos.getZ(i) - H.z - p.z);
        if (d < 0.12 * L * 1.05) near++;
      }
      expect(near).toBeGreaterThan(8);
    }
    g.dispose();
  });

  it('has 58 bones with the gular bone under the jaw, the throat floor skinned to it', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      expect(rig.bones.length).toBe(58);
      expect(rig.bones[rig.idx.gular].name).toBe('gular');
      expect(rig.bones[rig.idx.gular].parent).toBe(rig.idx.jaw);
      expect(rig.bones[rig.idx.gular].pos.y).toBeLessThan(rig.bones[rig.idx.jaw].pos.y);
      const g = buildWyvernGeometry(rig, look(breed), 0).geometry;
      const si = g.getAttribute('skinIndex');
      let n = 0;
      for (let v = 0; v < si.count; v++) for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === rig.idx.gular) n++;
      expect(n).toBeGreaterThan(20);
      g.dispose();
    }
  });

  it('sets the eye in a socket under a brow ledge, with lid rims, nostrils, teeth and zones', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const info = buildWyvernGeometry(rig, look(breed), 0);
      const g = info.geometry;
      const pos = g.getAttribute('position');
      const mat = g.getAttribute('aMat');
      const ex = g.getAttribute('aExtra');
      const H = rig.bones[rig.idx.head].pos;
      // The brow juts out past the eyeball (left side, near the eye's station).
      const eyeOuter = info.eyeCenter.x + info.eyeAxis.x * info.eyeRadius;
      let browX = 0;
      let teeth = 0;
      const zones = new Set<number>();
      for (let i = 0; i < pos.count; i++) {
        const r = Math.round(mat.getX(i));
        if (r === 13) teeth++;
        zones.add(Math.round(ex.getZ(i)));
        if (r !== 0) continue;
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (Math.abs(z - info.eyeCenter.z) < 0.5 * info.eyeRadius && y > info.eyeCenter.y + 0.6 * info.eyeRadius && y < H.y + rig.props.shape.headHalfHeight * 2)
          browX = Math.max(browX, pos.getX(i));
      }
      expect(browX, breed).toBeGreaterThan(eyeOuter);
      // 9 + 8 teeth a side at LOD0 (each several vertices).
      expect(teeth).toBeGreaterThan(34 * 10);
      for (const z of [1, 2, 3, 4, 5]) expect(zones.has(z), `${breed} zone ${z}`).toBe(true);
      g.dispose();
    }
  });
});

describe('wing-walker hand and reptile foot (A5, A7)', () => {
  it('walks on a stout wrist with a sole pad and three clawed digits', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const g = buildWyvernGeometry(rig, look(breed), 0).geometry;
      const si = g.getAttribute('skinIndex');
      const sw = g.getAttribute('skinWeight');
      const mat = g.getAttribute('aMat');
      const pos = g.getAttribute('position');
      const claw = rig.idx.wings[0].claw;
      // Digit claws: claw-region vertices on the claw bone, clustered into three tips ahead of
      // the wrist.
      const tips: number[] = [];
      let pale = 0;
      let paleAbove = 0;
      const wristY = rig.bones[claw].pos.y;
      for (let v = 0; v < si.count; v++) {
        if (si.getComponent(v, 0) !== claw || sw.getComponent(v, 0) < 0.99) continue;
        if (Math.round(mat.getX(v)) === 9) tips.push(pos.getX(v));
        else if (mat.getY(v) > 0.5) {
          pale++;
          if (pos.getY(v) > wristY) paleAbove++;
        }
      }
      // A pale sole under the wrist (the pad's sides and top take the hide).
      expect(pale, `${breed} pad`).toBeGreaterThanOrEqual(6);
      expect(paleAbove, `${breed} pad top`).toBe(0);
      const xs = [...new Set(tips.map((x) => Math.round(x * 20)))];
      expect(xs.length, breed).toBeGreaterThanOrEqual(3);
      g.dispose();
    }
  });

  it('plants a lizard\'s foot: four toes forward, a short fifth outside, none behind; a wider stance', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const g = buildWyvernGeometry(rig, look(breed), 0).geometry;
      const si = g.getAttribute('skinIndex');
      const mat = g.getAttribute('aMat');
      const pos = g.getAttribute('position');
      const toes = rig.idx.legs[0].toes;
      const ball = rig.ball;
      let behind = 0;
      let scutate = 0;
      for (let v = 0; v < si.count; v++) {
        if (si.getComponent(v, 0) !== toes) continue;
        if (Math.round(mat.getX(v)) === 9 && pos.getZ(v) < ball.z - 0.15) behind++;
        if (Math.round(g.getAttribute('aExtra').getZ(v)) === 5) scutate++;
      }
      // No backward hallux: no toe claw behind the ball of the foot.
      expect(behind, breed).toBe(0);
      expect(scutate).toBeGreaterThan(10);
      // Hips (and so the hind feet) at least 1.2x the old 0.6 torso half-widths apart.
      expect(rig.props.hip[0] / (0.6 * rig.props.shape.torsoHalfWidth), breed).toBeGreaterThanOrEqual(1.2);
      g.dispose();
    }
  });
});

describe('breeds by silhouette (Q5, A8)', () => {
  /** Visual aspect ratio: span squared over the area of both membranes (bind pose). */
  const aspect = (b: BreedId) => {
    const w = new Wyvern(look(b));
    const ar = BREEDS[b].wingspan ** 2 / (2 * w.stats.membraneArea);
    w.dispose();
    return ar;
  };
  /** Torso depth (top to keel) at the deepest of the shoulder and mid keys. */
  const depth = (b: BreedId) => Math.max(...(['shoulder', 'mid'] as const).map((k) => keyProfile(b, k).hu + keyProfile(b, k).hl));

  it('gives the glider the long narrow wing: galewing aspect ratio at least 1.5x the harrier', () => {
    expect(aspect('galewing') / aspect('harrier')).toBeGreaterThanOrEqual(1.5);
  });

  it('gives the tank the deep barrel: ironback torso depth at least 1.25x the harrier', () => {
    expect(depth('ironback') / depth('harrier')).toBeGreaterThanOrEqual(1.25);
  });

  it('gives the sprinter a broad, rounded hand-wing: the widest chord between the finger tips', () => {
    // Hand-wing chord: the distance between the wingtip finger's tip and the innermost finger's
    // tip, relative to the half-span (bind pose).
    const chord = (b: BreedId) => {
      const r = rigFor(b);
      return r.fingerTips[0].distanceTo(r.fingerTips[2]) / (BREEDS[b].wingspan / 2);
    };
    for (const b of ['harrier', 'galewing', 'ironback'] as const) expect(chord('skimmer'), b).toBeGreaterThan(chord(b));
  });
});

// ---------------------------------------------------------------------------------------------
// The tack (A12, Q16): the expert's Y yoke round the front, its stem and anchor, the neck rope
// ---------------------------------------------------------------------------------------------

/** A coarse spatial hash of points (for nearest-distance queries over thousands of vertices). */
class PointGrid {
  private cells = new Map<string, Vector3[]>();
  constructor(
    pts: Vector3[],
    private cell = 0.15,
  ) {
    for (const p of pts) {
      const k = this.key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push(p);
    }
  }
  private key(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }
  /** Distance to the nearest point, if within one cell (else Infinity). */
  near(p: Vector3): number {
    const c = this.cell;
    const x = Math.floor(p.x / c);
    const y = Math.floor(p.y / c);
    const z = Math.floor(p.z / c);
    let d = Infinity;
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) for (const q of this.cells.get(this.key(x + i, y + j, z + k)) ?? []) d = Math.min(d, q.distanceTo(p));
    return d;
  }
}

describe('the tack (A12, Q16)', { timeout: 240000 }, () => {
  type Info = { saddle: { straps: { name: string; line: number[] }[]; tackRange: [number, number]; holds: Record<string, { pos: Vector3; bone: number }> } };
  const infoOf = (w: Wyvern) => (w as unknown as { info: Info }).info.saddle;

  /** Wing vertices (membranes, and the arm and finger tubes) of a wyvern's mesh. */
  function wingVerts(w: Wyvern, skip: [number, number]): number[] {
    const mesh = w.skinnedMesh!;
    const geo = mesh.geometry;
    const idx = geo.index!.array;
    const g1 = geo.groups[1];
    const out = new Set<number>();
    for (let i = g1.start; i < g1.start + g1.count; i++) out.add(idx[i]);
    const wingBones = new Set<number>();
    mesh.skeleton.bones.forEach((b, i) => {
      if (/humerus|forearm|hand|finger|claw/.test(b.name)) wingBones.add(i);
    });
    const si = geo.getAttribute('skinIndex');
    const sw = geo.getAttribute('skinWeight');
    for (let v = 0; v < si.count; v++) {
      if (v >= skip[0] && v < skip[1]) continue;
      let ww = 0;
      for (let k = 0; k < 4; k++) if (wingBones.has(si.getComponent(v, k))) ww += sw.getComponent(v, k);
      if (ww > 0.5) out.add(v);
    }
    return [...out];
  }

  const X = new Vector3(1, 0, 0);
  const Y = new Vector3(0, 1, 0);
  /** The neck's full range (local rotations on neck0..neck5, degrees): beyond any posture the animator uses. */
  const NECK_ROM: [Vector3, number[]][] = [
    [X, [-30, -15, -8, 0, 0, 0]],
    [X, [25, 20, 10, 0, 0, 0]],
    [Y, [12, 12, 12, 8, 0, 0]],
    [Y, [-12, -12, -12, -8, 0, 0]],
  ];

  for (const breed of BREED_ORDER) {
    it(`harnesses round the front (${breed}): no strap crosses the wings or stretches over the stroke, the fold and the neck's full range`, () => {
      const w = new Wyvern(look(breed));
      const mesh = w.skinnedMesh!;
      const geo = mesh.geometry;
      const tack = infoOf(w);
      const [t0, t1] = tack.tackRange;
      expect(t1 - t0).toBeGreaterThan(500);
      const names = tack.straps.map((s) => s.name);
      for (const n of ['yokeL', 'yokeR']) expect(names).toContain(n);
      expect(names.some((n) => n.startsWith('stem'))).toBe(true);
      const wing = wingVerts(w, [t0, t1]);
      const bindLen = (line: number[]) => {
        let L = 0;
        const a = new Vector3();
        const b = new Vector3();
        for (let i = 1; i < line.length; i++) L += a.fromBufferAttribute(geo.getAttribute('position'), line[i - 1]).distanceTo(b.fromBufferAttribute(geo.getAttribute('position'), line[i]));
        return L;
      };
      const L0 = tack.straps.map((s) => bindLen(s.line));
      const a = new Vector3();
      const b = new Vector3();
      let worstGap = Infinity;
      let tuckGap = Infinity;
      let worstStretch = 0;
      let worstName = '';
      const check = (label: string) => {
        const tp: Vector3[] = [];
        for (let v = t0; v < t1; v++) tp.push(mesh.getVertexPosition(v, new Vector3()));
        const grid = new PointGrid(tp);
        for (const v of wing) {
          const d = grid.near(mesh.getVertexPosition(v, a));
          if (label === 'tuck') tuckGap = Math.min(tuckGap, d);
          else worstGap = Math.min(worstGap, d);
        }
        tack.straps.forEach((s, i) => {
          let L = 0;
          for (let j = 1; j < s.line.length; j++) L += mesh.getVertexPosition(s.line[j - 1], a).distanceTo(mesh.getVertexPosition(s.line[j], b));
          const r = Math.abs(L / L0[i] - 1);
          // The load-bearing yoke rides the trunk rigidly; the belly and rump straps ride the hide
          // under them (it breathes and flexes with the beat), within twice the yoke's allowance.
          const k = s.name.startsWith('yoke') ? 1 : 0.5;
          if (r * k > worstStretch) {
            worstStretch = r * k;
            worstName = `${s.name} ${label} ${(r * 100).toFixed(1)}%`;
          }
        });
      };
      // The folded stance, then the neck through its full range from it.
      const pose = standing(breed);
      for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
      check('stand');
      const bones = mesh.skeleton.bones;
      const q = new Quaternion();
      for (const [axis, degs] of NECK_ROM) {
        w.update(1 / 60, pose);
        w.rigDef.idx.neck.forEach((ni, i) => bones[ni].quaternion.multiply(q.setFromAxisAngle(axis, degs[i] * DEG)));
        w.group.updateMatrixWorld(true);
        check('neck');
      }
      // A full wingbeat, the flare and the dive tuck.
      w.resetAnimation();
      const g = gliding();
      g.flapStrength = 1;
      const rate = BREEDS[breed].flapRate;
      const cycle = Math.round(60 / rate);
      for (let f = 0; f < 90 + cycle; f++) {
        g.flapPhase = ((f / 60) * rate) % 1;
        g.position.z += 0.4;
        g.lookTarget.z += 0.4;
        w.update(1 / 60, g);
        if (f >= 90 && f % 3 === 0) check('flap');
      }
      for (const kind of ['flare', 'tuck'] as const) {
        w.resetAnimation();
        const p = gliding();
        if (kind === 'flare') p.flare = 1;
        else p.wingSpread = 0.1;
        for (let f = 0; f < 90; f++) {
          p.position.z += 0.4;
          p.lookTarget.z += 0.4;
          w.update(1 / 60, p);
        }
        check(kind);
      }
      // Nothing crosses or pins the membrane: 5 cm or more between the tack and the wing over the
      // stroke, the fold, the flare and the neck's range (the galewing's folded wingtip spar lies
      // over the hips about 8 cm above the rump straps). In the dive tuck the wings close over the
      // flanks and the rump, and the membrane may rest on the straps there (never through).
      expect(worstGap, `${breed} wing-tack gap`).toBeGreaterThan(0.05);
      expect(tuckGap, `${breed} wing-tack gap in the tuck`).toBeGreaterThan(0.003);
      // The tack follows the trunk: at most 3% stretch anywhere.
      expect(worstStretch, `${breed} ${worstName}`).toBeLessThanOrEqual(0.03);
      w.dispose();
    });
  }

  it('lays the yoke on the trunk ahead of the wing roots, the neck rope ahead of the yoke, the stem along the belly', () => {
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const rig = w.rigDef;
      const geo = w.skinnedMesh!.geometry;
      const pos = geo.getAttribute('position');
      const tack = infoOf(w);
      const sh = rig.props.shoulder;
      const humR = humerusRootRadius(rig);
      const p = new Vector3();
      for (const s of tack.straps) {
        if (!s.name.startsWith('yoke')) continue;
        const sx = s.name === 'yokeL' ? 1 : -1;
        let lowest = Infinity;
        for (const v of s.line) {
          p.fromBufferAttribute(pos, v);
          expect(p.x * sx, `${breed} ${s.name} stays on its side`).toBeGreaterThan(-0.05);
          // Beside the shoulder joint and below its top, the strap runs ahead of the humerus root.
          if (Math.abs(p.x) > 0.3 * rig.props.shape.torsoHalfWidth && p.y < sh[1] + 0.7 * humR) expect(p.z, `${breed} ${s.name}`).toBeGreaterThan(sh[2] + humR);
          lowest = Math.min(lowest, p.y);
        }
        // It reaches down the chest to the sternum plate.
        expect(lowest, breed).toBeLessThan(sh[1] - 0.4 * rig.props.shape.torsoHalfHeight);
      }
      for (const s of tack.straps) {
        if (!s.name.startsWith('stem')) continue;
        for (const v of s.line) expect(Math.abs(p.fromBufferAttribute(pos, v).x), `${breed} ${s.name} on the midline`).toBeLessThan(0.02);
      }
      w.dispose();
    }
  });

  it('puts hand and foot holds on the tack (ropeL/R on the neck rope, grab, stirrups) that follow the body', () => {
    for (const breed of BREED_ORDER) {
      for (const saddle of ['rider', 'racing', 'royal', 'nomad']) {
        const w = new Wyvern(look(breed, { saddle }));
        const pose = standing(breed);
        for (let i = 0; i < 30; i++) w.update(1 / 60, pose);
        const mesh = w.skinnedMesh!;
        const geo = mesh.geometry;
        const tack = infoOf(w);
        const leather: Vector3[] = [];
        const mat = geo.getAttribute('aMat');
        for (let v = 0; v < mat.count; v++) if (Math.round(mat.getX(v)) === REGION.leather) leather.push(mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld));
        const grid = new PointGrid(leather);
        for (const name of ['ropeL', 'ropeR', 'grab'] as const) {
          const h = w.socket(name, new Vector3())!;
          expect(h, `${breed} ${saddle} ${name}`).not.toBeNull();
          // On the rope, strap or handle (its centre line): within its radius plus a centimetre.
          expect(grid.near(h), `${breed} ${saddle} ${name}`).toBeLessThan(0.045);
        }
        const seat = w.socket('seat', new Vector3())!;
        const rope = w.socket('ropeL', new Vector3())!;
        expect(rope.z - seat.z, `${breed} ${saddle} rope in reach`).toBeGreaterThan(0.2);
        expect(rope.distanceTo(seat), `${breed} ${saddle} rope in reach`).toBeLessThan(1.0);
        // The two hand holds either side of the grip (E's rider reads gripSpread).
        const spread = w.saddle.userData.gripSpread as number;
        expect(spread).toBeGreaterThan(0.05);
        expect(spread).toBeLessThan(0.7);
        for (const [name, sx] of [
          ['stirrupL', 1],
          ['stirrupR', -1],
        ] as const) {
          const st = w.socket(name, new Vector3())!;
          // Under the straddling rider: below and outside the knees, above the wing roots.
          expect((st.x - seat.x) * sx, `${breed} ${saddle} ${name}`).toBeGreaterThan(TACK.straddle.kneeX);
          expect(seat.y - st.y, `${breed} ${saddle} ${name}`).toBeGreaterThan(0.5);
          expect(seat.y - st.y, `${breed} ${saddle} ${name}`).toBeLessThan(TACK.straddle.thigh + TACK.straddle.shin + 0.25);
          // The fitted shin runs mainly back along the barrel, not sideways. Reconstruct its
          // bind-space direction independently from the tread hold and the design knee. This
          // catches clearance sampling that aliases its query and drives fitting fully outward.
          const hold = tack.holds[name]!.pos;
          const dx = Math.abs(hold.x) - TACK.stirrup.tread[0] - TACK.straddle.kneeX;
          const dz = hold.z - TACK.stirrup.tread[2] - (w.rigDef.seat.z + TACK.straddle.kneeFwd);
          expect(dx, `${breed} ${saddle} ${name} outward shin`).toBeLessThan(-dz);
        }
        // The holds move with the body.
        const before = w.socket('grab', new Vector3())!;
        pose.position.x += 2;
        w.update(1 / 60, pose);
        expect(w.socket('grab', new Vector3())!.x - before.x).toBeCloseTo(2, 1);
        w.dispose();
      }
    }
  });

  it("writes D's leather contract: tack regions, across-strap coordinate and quilted padding", () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const info = buildWyvernGeometry(rig, look(breed), 0);
      const g = info.geometry;
      const mat = g.getAttribute('aMat');
      const ex = g.getAttribute('aExtra');
      const [t0, t1] = info.saddle.tackRange;
      const regions = new Set<number>();
      let quilt = 0;
      for (let v = t0; v < t1; v++) {
        const r = Math.round(mat.getX(v));
        regions.add(r);
        const w = ex.getW(v);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
        if (Math.round(ex.getZ(v)) === ZONE.quilt) quilt++;
      }
      for (const r of regions) expect([REGION.leather, REGION.metal]).toContain(r);
      expect(regions.has(REGION.metal)).toBe(true);
      expect(quilt).toBeGreaterThan(200);
      // The yoke's centre lines read 1 across, its edges 0.
      const yoke = info.saddle.straps.find((s) => s.name === 'yokeL')!;
      for (const v of yoke.line) expect(ex.getW(v)).toBeCloseTo(1, 5);
      // The blanket is woven cloth.
      let cloth = 0;
      for (let v = 0; v < t0; v++) if (Math.round(mat.getX(v)) === REGION.cloth) cloth++;
      expect(cloth).toBeGreaterThan(50);
      g.dispose();
    }
  });

  it('keeps the dorsal frill low by the pommel and where the neck rope crosses (TACK.frillClear)', () => {
    for (const breed of BREED_ORDER) {
      const rig = rigFor(breed);
      const info = buildWyvernGeometry(rig, look(breed, { frill: 'spines' }), 0);
      const g = info.geometry;
      const pos = g.getAttribute('position');
      const mat = g.getAttribute('aMat');
      const centres = tackClearance(rig);
      const hide = new Hide(rig);
      const p = new Vector3();
      const top = new Vector3();
      let n = 0;
      for (let v = 0; v < info.saddle.tackRange[0]; v++) {
        if (Math.round(mat.getX(v)) !== REGION.horn) continue;
        p.fromBufferAttribute(pos, v);
        // Along the withers from the pommel's reach to the rope's crossing, where the hands and the
        // rein bight run.
        if (Math.abs(p.x) > 0.2 || p.z > centres[1].z || p.z < centres[0].z - TACK.frillClear.radius) continue;
        hide.point(rig.plan.sAtZ(p.z), 0, top);
        expect(p.y - top.y, `${breed} spine by the tack`).toBeLessThan(TACK.frillClear.height + 0.03);
        n++;
      }
      void n;
      g.dispose();
    }
  });

  it('builds the tack lighter at LOD1 and none at LOD2', () => {
    const rig = rigFor('harrier');
    const n = [0, 1, 2].map((lod) => {
      const info = buildWyvernGeometry(rig, look('harrier'), lod as Lod);
      info.geometry.dispose();
      return info.saddle.tackRange[1] - info.saddle.tackRange[0];
    });
    expect(n[1]).toBeLessThan(n[0] * 0.3);
    expect(n[2]).toBe(0);
  });
});
