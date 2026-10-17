// What the wyvern remembers of flying with its rider (gate G4, bond expression v1): how many times
// the pair has flown through each landmark, and the banks the rider tends to throw there. Pure
// data plus the rules for folding a finished pass into it. Never a meter: nothing here is shown
// to the player as a number; the wyvern's behaviour (Anticipation) is the only expression.
//
// It lives in its own localStorage document beside the save (`driftwing.save.v1` is unchanged),
// sanitized on load like the save: anything malformed falls back to an empty memory.

export const BOND_KEY = 'driftwing.bond.v1';

export const BOND = {
  /** Completed passes through a landmark before the wyvern anticipates maneuvers there. */
  knownPasses: 3,
  /** Passes a bank must have been thrown in, at the same place, before it counts as known. */
  knownSeen: 2,
  /** The lean starts when the wyvern is this many seconds from a known maneuver ... */
  leadMax: 0.45,
  /** ... and never later than this (too close: no lean this time). */
  leadMin: 0.3,
  /** Same place: within this distance (m) of the site, and off the flight line by less. */
  matchRadius: 30,
  /** Same direction of travel: horizontal headings' cosine at least this. */
  headingDot: 0.6,
  /** A bank begins when the roll stick passes rollOn after having been back inside rollOff. */
  rollOn: 0.5,
  rollOff: 0.25,
  /** Passes shorter than this (s) are a clipped edge, not a fly-through. */
  minPassTime: 1,
  /** Sites kept per landmark (the least-flown go first). */
  maxSites: 12,
  /** Slowest flight (m/s) the wyvern predicts from. */
  minSpeed: 4,
} as const;

/** A bank the rider throws at a landmark: where the stick went over, heading, and which way. */
export interface ManeuverSite {
  x: number;
  y: number;
  z: number;
  /** Horizontal heading (unit) at the onset. */
  hx: number;
  hz: number;
  /** +1 roll right, −1 roll left. */
  dir: 1 | -1;
  /** Passes it was flown in. */
  seen: number;
}

export interface LandmarkBond {
  passes: number;
  sites: ManeuverSite[];
}

export interface BondData {
  version: 1;
  landmarks: Record<string, LandmarkBond>;
}

/** A bank's onset during the current pass (before it is folded into the sites). */
export type ManeuverOnset = Omit<ManeuverSite, 'seen'>;

export function emptyBond(): BondData {
  return { version: 1, landmarks: {} };
}

/** The landmark's memory, created empty on first use. */
export function landmarkBond(data: BondData, landmarkId: string): LandmarkBond {
  let lb = data.landmarks[landmarkId];
  if (!lb) data.landmarks[landmarkId] = lb = { passes: 0, sites: [] };
  return lb;
}

/** Sites the wyvern knows well enough to anticipate (empty until the landmark itself is known). */
export function knownSites(lb: LandmarkBond | undefined): ManeuverSite[] {
  if (!lb || lb.passes < BOND.knownPasses) return [];
  return lb.sites.filter((s) => s.seen >= BOND.knownSeen);
}

/** The site an onset belongs to: same direction, same place, same heading; −1 when none. */
export function matchSite(sites: readonly ManeuverSite[], o: ManeuverOnset): number {
  let best = -1;
  let bestD = BOND.matchRadius * BOND.matchRadius;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (s.dir !== o.dir || s.hx * o.hx + s.hz * o.hz < BOND.headingDot) continue;
    const d = (s.x - o.x) ** 2 + (s.y - o.y) ** 2 + (s.z - o.z) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * PURE (mutates `lb`): fold a finished pass in. Each onset counts toward the site it matches
 * (once per pass; the site drifts to the mean of where it was flown) or starts a new one; the
 * landmark's pass count goes up.
 */
export function foldPass(lb: LandmarkBond, onsets: readonly ManeuverOnset[]): LandmarkBond {
  const counted = new Set<ManeuverSite>();
  for (const o of onsets) {
    const i = matchSite(lb.sites, o);
    if (i < 0) {
      const site: ManeuverSite = { ...o, seen: 1 };
      lb.sites.push(site);
      counted.add(site);
      continue;
    }
    const s = lb.sites[i];
    if (counted.has(s)) continue;
    counted.add(s);
    s.seen++;
    const k = 1 / s.seen;
    s.x += (o.x - s.x) * k;
    s.y += (o.y - s.y) * k;
    s.z += (o.z - s.z) * k;
    const hx = s.hx + (o.hx - s.hx) * k;
    const hz = s.hz + (o.hz - s.hz) * k;
    const h = Math.hypot(hx, hz) || 1;
    s.hx = hx / h;
    s.hz = hz / h;
  }
  // Over the cap: forget the least-flown (the oldest of those first).
  while (lb.sites.length > BOND.maxSites) {
    let worst = 0;
    for (let i = 1; i < lb.sites.length; i++) if (lb.sites[i].seen < lb.sites[worst].seen) worst = i;
    lb.sites.splice(worst, 1);
  }
  lb.passes++;
  return lb;
}

/**
 * Seconds until a wyvern at (px, py, pz) moving at (vx, vy, vz) reaches the site, flying straight
 * on; null when it isn't heading there (too slow, the wrong way, or passing wide).
 */
export function timeToSite(s: ManeuverSite, px: number, py: number, pz: number, vx: number, vy: number, vz: number): number | null {
  const speed = Math.hypot(vx, vy, vz);
  if (speed < BOND.minSpeed) return null;
  const hLen = Math.hypot(vx, vz);
  if (hLen < 1e-3 || (vx * s.hx + vz * s.hz) / hLen < BOND.headingDot) return null;
  const rx = s.x - px;
  const ry = s.y - py;
  const rz = s.z - pz;
  const along = (rx * vx + ry * vy + rz * vz) / speed;
  const lat2 = rx * rx + ry * ry + rz * rz - along * along;
  if (lat2 > BOND.matchRadius * BOND.matchRadius) return null;
  return along / speed;
}

// ---------------------------------------------------------------------------------------------
// Loading and storage
// ---------------------------------------------------------------------------------------------

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeSite(v: unknown): ManeuverSite | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!finite(r.x) || !finite(r.y) || !finite(r.z) || !finite(r.hx) || !finite(r.hz) || !finite(r.seen)) return null;
  if (r.dir !== 1 && r.dir !== -1) return null;
  const h = Math.hypot(r.hx, r.hz);
  if (h < 1e-6) return null;
  return { x: r.x, y: r.y, z: r.z, hx: r.hx / h, hz: r.hz / h, dir: r.dir, seen: Math.max(1, Math.floor(r.seen)) };
}

/** PURE: any parsed JSON (or garbage) → a valid BondData. */
export function sanitizeBond(input: unknown): BondData {
  const out = emptyBond();
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return out;
  const lms = (input as Record<string, unknown>).landmarks;
  if (typeof lms !== 'object' || lms === null || Array.isArray(lms)) return out;
  for (const [id, v] of Object.entries(lms)) {
    if (typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    const passes = finite(r.passes) ? Math.max(0, Math.floor(r.passes)) : 0;
    const sites = Array.isArray(r.sites) ? r.sites.map(sanitizeSite).filter((s): s is ManeuverSite => s !== null).slice(0, BOND.maxSites) : [];
    out.landmarks[id] = { passes, sites };
  }
  return out;
}

/** The bond's own localStorage document (memory only where storage is unavailable). */
export class BondStore {
  data: BondData;

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = defaultStorage()) {
    this.data = this.load();
  }

  load(): BondData {
    try {
      const raw = this.storage?.getItem(BOND_KEY);
      return raw ? sanitizeBond(JSON.parse(raw)) : emptyBond();
    } catch {
      return emptyBond();
    }
  }

  save(): void {
    try {
      this.storage?.setItem(BOND_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: the bond lives on for this session.
    }
  }

  reset(): void {
    this.data = emptyBond();
    try {
      this.storage?.removeItem(BOND_KEY);
    } catch {
      // As above.
    }
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
