// The anticipatory lean (gate G4): flying through a landmark it knows (BOND.knownPasses passes),
// the wyvern leans into a bank its rider always throws there 0.3 to 0.5 s before the stick goes
// over. Presentation only: the value feeds WyvernPose.anticipate (the trunk's roll and the head's
// lead in the animator), never the flight model.
//
// It also keeps the memory current: each fly-through of a landmark's vicinity (discovery zone) is
// a pass, and the banks begun during it are folded in when it ends.

import { clamp01, smoothstep } from '../core/math';
import { inZone, type DiscoveryZone } from '../progression/discovery';
import { BOND, foldPass, knownSites, landmarkBond, timeToSite, type BondData, type ManeuverOnset } from './memory';

/** What the anticipation reads each rendered frame (the interpolated wyvern pose and the stick). */
export interface FlightSample {
  /** Mounted and in the air (PlayerMode 'flying'). */
  flying: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The roll stick (−1..1, + = roll right). */
  roll: number;
}

/** Seconds the lean takes to come in, and to hand back to the real bank once it starts. */
const LEAN_IN = 0.2;
const LEAN_OUT = 0.35;
/** Seconds past the predicted moment a lean waits for a bank that never comes. */
const LEAN_WAIT = 0.6;

interface Pass {
  landmarkId: string;
  time: number;
  onsets: ManeuverOnset[];
  /** Known sites (by reference into the memory) already anticipated this pass. */
  anticipated: Set<object>;
}

interface Lean {
  dir: 1 | -1;
  start: number;
  /** When the lean began to let go (the bank came, or it didn't); null while held. */
  release: number | null;
}

/** The last lean begun, for captures and tests: where, which way, and the predicted lead (s). */
export interface LeanRecord {
  landmarkId: string;
  dir: 1 | -1;
  predicted: number;
  at: number;
  /** Seconds from the lean's start to the bank that followed; null until (unless) it comes. */
  lead: number | null;
}

export class Anticipation {
  /** −1..1 this frame's lean (+ = into a right bank). */
  value = 0;
  /** Seconds this tracker has run (its own clock). */
  clock = 0;
  last: LeanRecord | null = null;
  private pass: Pass | null = null;
  private lean: Lean | null = null;
  /** The roll stick has come back near center since the last bank began. */
  private armed = true;

  constructor(
    private readonly zones: readonly DiscoveryZone[],
    private readonly memory: () => BondData,
  ) {}

  /** The landmark being flown through, if any. */
  get passing(): string | null {
    return this.pass?.landmarkId ?? null;
  }

  /** Forget the pass and lean in progress (teleport, reset, leaving play). */
  clear(): void {
    this.pass = null;
    this.lean = null;
    this.armed = true;
    this.value = 0;
  }

  /** Advance by dt. Returns true when a pass finished and the memory changed (worth saving). */
  update(dt: number, s: FlightSample): boolean {
    this.clock += dt;
    const zone = s.flying ? this.zoneAt(s.x, s.y, s.z) : null;
    let changed = false;
    if (this.pass && this.pass.landmarkId !== zone?.landmarkId) changed = this.endPass();
    if (!this.pass && zone) this.pass = { landmarkId: zone.landmarkId, time: 0, onsets: [], anticipated: new Set() };
    if (this.pass) this.pass.time += dt;

    // A bank begins: the stick goes over past rollOn after resting near center.
    const mag = Math.abs(s.roll);
    if (!s.flying) this.armed = true;
    else if (this.armed && mag >= BOND.rollOn) {
      this.armed = false;
      const dir: 1 | -1 = s.roll > 0 ? 1 : -1;
      const h = Math.hypot(s.vx, s.vz);
      if (this.pass && h > 1e-3) this.pass.onsets.push({ x: s.x, y: s.y, z: s.z, hx: s.vx / h, hz: s.vz / h, dir });
      // The real bank takes over (the other way: the wyvern guessed wrong and lets go).
      if (this.lean && this.lean.release === null) {
        this.lean.release = this.clock;
        if (this.last && this.lean.dir === dir) this.last.lead = this.clock - this.lean.start;
      }
    } else if (mag <= BOND.rollOff) this.armed = true;

    if (!s.flying) this.lean = null;
    else if (!this.lean && this.armed && this.pass) this.anticipate(s);
    if (this.lean && this.lean.release === null && this.clock - this.lean.start > BOND.leadMax + LEAN_WAIT) this.lean.release = this.clock;
    this.value = this.leanValue();
    return changed;
  }

  /** Begin a lean if a known site is coming up inside the lead window. */
  private anticipate(s: FlightSample): void {
    const pass = this.pass!;
    for (const site of knownSites(this.memory().landmarks[pass.landmarkId])) {
      if (pass.anticipated.has(site)) continue;
      const t = timeToSite(site, s.x, s.y, s.z, s.vx, s.vy, s.vz);
      if (t === null || t > BOND.leadMax || t < BOND.leadMin) continue;
      pass.anticipated.add(site);
      this.lean = { dir: site.dir, start: this.clock, release: null };
      this.last = { landmarkId: pass.landmarkId, dir: site.dir, predicted: t, at: this.clock, lead: null };
      return;
    }
  }

  private leanValue(): number {
    const l = this.lean;
    if (!l) return 0;
    const into = smoothstep(0, LEAN_IN, this.clock - l.start);
    const out = l.release === null ? 1 : 1 - clamp01((this.clock - l.release) / LEAN_OUT);
    if (out <= 0) {
      this.lean = null;
      return 0;
    }
    return l.dir * into * out;
  }

  private endPass(): boolean {
    const pass = this.pass!;
    this.pass = null;
    if (pass.time < BOND.minPassTime) return false;
    foldPass(landmarkBond(this.memory(), pass.landmarkId), pass.onsets);
    return true;
  }

  private zoneAt(x: number, y: number, z: number): DiscoveryZone | null {
    for (const zone of this.zones) if (inZone(zone, x, y, z)) return zone;
    return null;
  }
}
