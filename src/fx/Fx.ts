// Visual effects: the layer that sells speed and weight.
//
//   particles.ts  fire-and-forget GPU particles (dust, breath, sparks, glints)
//   rings.ts      expanding shockwave rings (ring passes, relics)
//   streaks.ts    speed lines and cloud wisps around the camera
//   trails.ts     wingtip vortex ribbons
//   thermals.ts   motes spiraling up the thermal columns
//   fireflies.ts  night swarms over island ground
//   drifters.ts   leaves and petals riding the wind
//   gust.ts       the launch-wind gust off the Roost's deck
//   fxMath.ts     pure tuning (unit-tested)
//
// Event effects subscribe to the bus; continuous effects read the player each frame. Screen
// effects owned here: grade.uSpeedBlur (airspeed + tuck) and grade.uFlash/uFlashColor (ring,
// collect), both toned down or disabled with settings.reducedMotion.

import { Vector3, type PerspectiveCamera, type Scene } from 'three';
import type { FxSystem, PlayerSystem, WyvernRenderable } from '../game/contracts';
import type { GameEventBus } from '../core/events';
import type { QualityProfile } from '../render/quality';
import { wrapShaderTime, type Renderer } from '../render/renderer';
import type { Settings, SurfaceKind } from '../core/types';
import type { WorldLayout, IslandDef } from '../world/layout';
import type { Terrain } from '../world/terrain';
import { clamp01, damp, smoothstep } from '../core/math';
import { mulberry32 } from '../core/rng';
import { globalUniforms } from '../render/uniforms';
import { BurstParticles, blankSpec, SHAPE_GLINT, SHAPE_GLOW, SHAPE_PUFF, SHAPE_SPARK, type ParticleSpec } from './particles';
import { ShockRings } from './rings';
import { AirStreaks } from './streaks';
import { WingTrails } from './trails';
import { ThermalMotes } from './thermals';
import { Fireflies } from './fireflies';
import { Drifters } from './drifters';
import { LaunchGust, type DeckEnd } from './gust';
import { boundaryApproach01 } from '../sky/windField';
import {
  decay,
  flapDustAmount,
  isColdAir,
  planeBasis,
  scaledCount,
  speedBlurTarget,
  speedLineAmount,
  SURFACE_DUST,
  trailIntensity,
  breedMassFactor,
  flapTrailBurst,
  flapTrailFloor,
  seaDownwashAmount,
  wispAmount,
} from './fxMath';

/** A walkable deck (the dressing's Deck shape); the longest wooden one is the launch deck. */
export interface FxDeck {
  x: number;
  z: number;
  yaw: number;
  halfWidth: number;
  length: number;
  y: number;
  surface: 'wood' | 'stone';
}

export interface FxDeps {
  scene: Scene;
  renderer: Renderer;
  events: GameEventBus;
  quality: QualityProfile;
  settings: () => Settings;
  layout: WorldLayout;
  /** Ground and island lookups (dust colors, fireflies, drifting leaves). */
  terrain?: Terrain;
  /** Built decks; the launch-wind gust plays off the end of the longest wooden one. */
  decks?: readonly FxDeck[];
  /** Height of the cloud-sea surface under (x, z) right now (the sky's), for the skimming wake. */
  seaSurfaceAt?: (x: number, z: number) => number;
}

/** Capacities are sized for 'ultra' (particles 1.4); lower presets draw a share. */
const SOFT_CAP = 3200;
const GLOW_CAP = 2400;

export class Fx implements FxSystem {
  private deps: FxDeps;
  private particles = 1;
  private soft: BurstParticles;
  private glow: BurstParticles;
  private rings: ShockRings;
  private speedLines: AirStreaks;
  private wisps: AirStreaks;
  private trails: WingTrails;
  /** 0..1 extra wingtip vortex for something that wants the tips to show (the snap-roll preview). */
  trailBoost = 0;
  private thermals: ThermalMotes;
  private fireflies: Fireflies | null = null;
  private drifters: Drifters | null = null;
  private gust: LaunchGust | null = null;
  private moor: IslandDef | null;

  private spec: ParticleSpec = blankSpec();
  private rand = mulberry32(0xf00d);
  private player: PlayerSystem | null = null;
  private wyvern: WyvernRenderable | null = null;
  private time = 0;
  private blur = 0;
  private flash = 0;
  private breathWyvern = 0.8;
  private breathRider = 1.9;
  private lastMode = '';
  /** Seconds left in which freshly shaken-off leaves keep living away from the ground. */
  private leafTime = 0;
  /** Fractional particles owed to the cloud-sea wake (emitted at a steady rate). */
  private wakeDebt = 0;

  // Scratch (no per-frame allocation).
  private camPos = new Vector3();
  private airVel = new Vector3();
  private tipL = new Vector3();
  private tipR = new Vector3();
  private head = new Vector3();
  private fwd = new Vector3();
  private basis = new Float32Array(6);
  private zero = new Vector3();

  constructor(deps: FxDeps) {
    this.deps = deps;
    const scene = deps.scene;
    this.soft = new BurstParticles(scene, SOFT_CAP, { additive: false, name: 'fx-dust', renderOrder: 5 });
    this.glow = new BurstParticles(scene, GLOW_CAP, { additive: true, name: 'fx-glow', renderOrder: 9 });
    this.rings = new ShockRings(scene, 8);
    this.speedLines = new AirStreaks(scene, {
      name: 'fx-speed-lines', count: 420, box: 56, lenTime: 0.16, width: 0.075, nearFade: 2.5, centerFade: 0.22, wisp: false, seed: 0x5eed,
    });
    this.wisps = new AirStreaks(scene, {
      name: 'fx-cloud-wisps', count: 64, box: 240, lenTime: 0.32, width: 10, nearFade: 14, centerFade: 0.12, wisp: true, seed: 0x3157,
    });
    this.trails = new WingTrails(scene, 64);
    this.thermals = new ThermalMotes(scene, deps.layout.thermals);
    if (deps.terrain) {
      this.fireflies = new Fireflies(scene, deps.terrain);
      this.drifters = new Drifters(scene, deps.terrain);
    }
    const deck = launchDeckEnd(deps.decks);
    if (deck) this.gust = new LaunchGust(scene, deck);
    this.moor = deps.layout.islands.find((i) => i.landmark === 'highmoor') ?? null;
    this.setQuality(deps.quality);
    this.subscribe(deps.events);
  }

  setQuality(q: QualityProfile): void {
    const p = Math.max(0.1, q.particles);
    this.particles = p;
    this.soft.setActiveCapacity((SOFT_CAP * p) / 1.4);
    this.glow.setActiveCapacity((GLOW_CAP * p) / 1.4);
    this.speedLines.setDensity(p);
    this.wisps.setDensity(p);
    this.thermals.setDensity(p);
    this.fireflies?.setDensity(p);
    this.drifters?.setDensity(p);
  }

  /**
   * The effect clocks feed float32 shader uniforms (uNow, birth times), so they wrap like the
   * shared time (wrapShaderTime: back by a power of two, behind a fade when possible). Particles,
   * rings and trails move their birth times with the clock, so nothing changes on screen; the
   * looping effects (thermals, fireflies, the launch gust) jump in phase, hidden by the fade.
   */
  private wrapClocks(): void {
    const wrapped = wrapShaderTime(this.time, this.deps.renderer.grade.uFade.value > 0.95);
    if (wrapped === this.time) return;
    const by = this.time - wrapped;
    this.time = wrapped;
    this.soft.wrapTime(by);
    this.glow.wrapTime(by);
    this.rings.wrapTime(by);
    this.trails.wrapTime(by);
    this.thermals.wrapTime(by);
    this.fireflies?.wrapTime(by);
    this.gust?.wrapTime(by);
  }

  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem, wyvern: WyvernRenderable): void {
    this.player = player;
    this.wyvern = wyvern;
    const step = Math.min(0.1, Math.max(0, dt));
    this.time += step;
    this.wrapClocks();
    const settings = this.deps.settings();
    const reduced = settings.reducedMotion;
    const f = player.flight;
    const mode = player.mode;
    const flying = mode === 'flying';
    camera.getWorldPosition(this.camPos);
    const canvasH = this.deps.renderer.gl.domElement.height || 720;
    const pxScale = canvasH / (2 * Math.tan(((camera.fov || 60) * Math.PI) / 360));

    if (mode !== this.lastMode) {
      // Teleports and respawns: don't draw a trail across the world.
      if (this.lastMode === 'respawning' || mode === 'respawning') this.trails.reset();
      this.lastMode = mode;
    }

    // --- Air: speed lines, cloud wisps, wingtip vortices --------------------------------------
    const wind = globalUniforms.uWind.value;
    this.airVel.copy(f.velocity).sub(wind);
    const airspeed = flying ? f.airspeed : 0;
    this.speedLines.setPxScale(pxScale);
    this.wisps.setPxScale(pxScale);
    // Out at the world's edge the storm's wind streaks past whatever your speed: the headwind
    // made visible (it fades in over the last stretch before the boundary).
    const storm = flying ? boundaryApproach01(Math.hypot(f.position.x, f.position.z), this.deps.layout.boundaryRadius) : 0;
    const lines = Math.max(speedLineAmount(airspeed, flying), storm * 0.85) * (reduced ? 0.7 : 1.3);
    this.speedLines.update(step, this.camPos, this.airVel, lines);
    this.wisps.update(step, this.camPos, this.airVel, wispAmount(airspeed, f.position.y, 0, flying) * 0.8);
    wyvern.getWingtips(this.tipL, this.tipR);
    this.trails.setPxScale(pxScale);
    // Tip vortices: from speed and hard pulls, plus every power stroke made visible — a burst off
    // each tip at the end of the downstroke (heavier breeds shed more) over a faint floor while
    // the wings work.
    const wp = player.wyvernPose;
    const beat = flying ? wp.flapStrength : 0;
    const burst = flapTrailBurst(wp.flapPhase, beat, player.breed.downFrac ?? 0.5, breedMassFactor(player.breed.mass), airspeed);
    const vortex = Math.max(trailIntensity(airspeed, f.gLoad, flying) * 0.75, flapTrailFloor(beat, airspeed), burst * 0.85, flying ? this.trailBoost * 0.9 : 0);
    this.trails.update(step, this.tipL, this.tipR, vortex);

    // --- World: thermals, fireflies, leaves, launch gust --------------------------------------
    this.thermals.setPxScale(pxScale);
    // Thermals are for flyers: full strength on the wing, a faint hint from the ground, the title
    // and the stable (where they'd only scribble over the backdrop).
    this.thermals.update(step, this.camPos, Math.min(camera.far, 2200), flying ? 1 : 0.3);
    const night = globalUniforms.uNight.value;
    if (this.fireflies) {
      this.fireflies.setPxScale(pxScale);
      this.fireflies.update(step, this.camPos, night);
    }
    if (this.drifters) {
      const gust = 0.5 + 0.5 * Math.sin(this.time * 0.37) * Math.sin(this.time * 0.11 + 1);
      // Only spawn new ones near the ground (they'd be invisible specks from the air).
      const pose = player.wyvernPose;
      const near = !flying || (pose.groundY !== null && pose.position.y - pose.groundY < 40);
      this.leafTime = Math.max(0, this.leafTime - step);
      camera.getWorldDirection(this.fwd);
      this.drifters.update(step, this.camPos, this.fwd, wind, gust, pose.position, flying ? f.velocity : this.zero, near || this.leafTime > 0);
    }
    if (flying) this.seaWake(step, player);
    this.gust?.setPxScale(pxScale);
    this.gust?.update(step, this.camPos);

    // --- Breath on cold Highmoor ---------------------------------------------------------------
    this.updateBreath(step, player, wyvern);

    // --- Particles ------------------------------------------------------------------------------
    this.soft.update(step, pxScale);
    this.glow.update(step, pxScale);
    this.rings.update(step);

    // --- Screen effects -------------------------------------------------------------------------
    const tuck = flying ? clamp01((1 - f.wingSpread) / 0.7) : 0;
    this.blur = damp(this.blur, speedBlurTarget(airspeed, tuck, flying, reduced), 3, step);
    const grade = this.deps.renderer.grade;
    grade.uSpeedBlur.value = this.blur < 0.002 ? 0 : this.blur;
    this.flash = decay(this.flash, 3.2, step);
    grade.uFlash.value = this.flash < 0.002 ? 0 : this.flash * (reduced ? 0.35 : 1);
  }

  // --- Events -------------------------------------------------------------------------------------

  private subscribe(ev: GameEventBus): void {
    ev.on('flap', (p) => this.onFlap(p.strength, p.position));
    ev.on('touchdown', (p) => this.landingDust(p.position, p.impact, p.surface));
    ev.on('terrainHit', (p) => this.scrape(p.point, p.normal, p.impulse));
    ev.on('footstep', (p) => {
      if (p.heavy) this.footDust(p.position, p.surface);
    });
    ev.on('takeoff', (p) => this.takeoffBurst(p.position));
    ev.on('ringPassed', (p) => this.ringBurst(p.position));
    // Flight reports brushing through foliage (an additive event; subscribed loosely so this
    // module doesn't depend on when that contract lands).
    (ev as unknown as { on(type: string, fn: (p: { position?: Vector3; speed?: number }) => void): void }).on('foliageBrush', (p) => {
      if (p?.position) this.leafBurst(p.position, p.speed ?? 15);
    });
    ev.on('collect', (p) => this.collectSparkle(p.position, p.kind));
    ev.on('respawn', () => this.trails.reset());
  }

  private surfaceAt(x: number, y: number, z: number): SurfaceKind {
    const g = this.deps.terrain?.groundAt(x, z, y + 1);
    // No top surface under the point: it's a cliff face or an underside — bare rock.
    return g ? g.surface : 'rock';
  }

  private onFlap(strength: number, pos: Vector3): void {
    const player = this.player;
    if (!player) return;
    const span = player.breed.wingspan;
    const groundY = player.wyvernPose.groundY;
    if (groundY !== null) {
      const amt = flapDustAmount(pos.y - groundY, span, strength);
      if (amt > 0.05) this.dustRing(pos.x, groundY + 0.25, pos.z, amt, span, this.surfaceAt(pos.x, pos.y, pos.z));
    }
    // Over the cloud sea the downwash presses a ring into the billows and throws spray outward.
    const seaAt = this.deps.seaSurfaceAt;
    if (seaAt && player.mode === 'flying') {
      const seaY = seaAt(pos.x, pos.z);
      const amt = seaDownwashAmount(pos.y - seaY, span, strength) * breedMassFactor(player.breed.mass);
      if (amt > 0.05) this.seaDownwash(pos.x, seaY, pos.z, Math.min(1, amt), span);
    }
    // A breath of downwash off each wingtip on strong beats in open air.
    if (strength > 0.55 && this.wyvern && (groundY === null || pos.y - groundY > span)) {
      this.wyvern.getWingtips(this.tipL, this.tipR);
      const v = player.flight.velocity;
      for (const tip of [this.tipL, this.tipR]) {
        for (let i = 0; i < 2; i++) {
          const s = this.spec;
          this.reset(s);
          s.x = tip.x;
          s.y = tip.y;
          s.z = tip.z;
          s.vx = v.x * 0.35 + (this.rand() - 0.5) * 1.5;
          s.vy = v.y * 0.35 - 4 - this.rand() * 2;
          s.vz = v.z * 0.35 + (this.rand() - 0.5) * 1.5;
          s.life = 0.6 + this.rand() * 0.3;
          s.drag = 2.5;
          s.size0 = 0.5;
          s.size1 = 2.2;
          s.r = s.g = s.b = 0.97;
          s.a = 0.09 * strength;
          s.wind = 0.6;
          this.soft.emit(s);
        }
      }
    }
  }

  /**
   * A wingbeat's downwash on the cloud sea: a soft shadowed ring racing out across the billow
   * tops, and spray thrown outward from under the body.
   */
  private seaDownwash(cx: number, seaY: number, cz: number, amt: number, span: number): void {
    // Premultiplied: a cool, dim ring darkens the bright cloud a little, like a pressed hollow.
    this.rings.spawn(cx, seaY + 0.6, cz, 0, 1, 0, 0.25 * span, 1.1 * span, 1.1, 0.52, 0.58, 0.7, 0.45 * amt);
    const v = this.player?.flight.velocity ?? this.zero;
    const n = scaledCount(16 * amt, this.particles, 3);
    const scale = span / 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = span * (0.15 + 0.2 * this.rand());
      const sp = (5 + 6 * this.rand()) * (0.6 + 0.4 * amt);
      const s = this.spec;
      this.reset(s);
      s.x = cx + ca * r0;
      s.y = seaY + 0.5 + this.rand() * 1.5;
      s.z = cz + sa * r0;
      s.vx = v.x * 0.3 + ca * sp;
      s.vy = 0.8 + this.rand() * 1.6;
      s.vz = v.z * 0.3 + sa * sp;
      s.life = 1.3 + this.rand() * 0.9;
      s.drag = 1.8;
      s.gravity = 0.04;
      s.size0 = (1.4 + 0.8 * this.rand()) * scale;
      s.size1 = (4.5 + 3 * this.rand()) * scale;
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.5;
      s.r = 0.97;
      s.g = 0.98;
      s.b = 1.0;
      s.a = 0.36 * amt;
      s.fadeIn = 0.08;
      s.wind = 0.6;
      this.soft.emit(s);
    }
  }

  /** Dust blown outward along the ground by a wingbeat's downwash. */
  private dustRing(cx: number, cy: number, cz: number, amt: number, span: number, surface: SurfaceKind): void {
    const pal = SURFACE_DUST[surface];
    const n = scaledCount(30 * amt, this.particles, 4);
    const scale = span / 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = span * (0.12 + 0.18 * this.rand());
      const sp = (6 + 7 * this.rand()) * (0.5 + 0.5 * amt);
      const s = this.spec;
      this.reset(s);
      s.x = cx + ca * r0;
      s.y = cy + this.rand() * 0.4;
      s.z = cz + sa * r0;
      s.vx = ca * sp;
      s.vy = 0.4 + this.rand() * 1.4;
      s.vz = sa * sp;
      s.life = 1.2 + this.rand() * 0.9;
      s.drag = 2.3;
      s.gravity = -0.015;
      s.size0 = (0.9 + 0.6 * this.rand()) * scale;
      s.size1 = (3.2 + 2.2 * this.rand()) * scale;
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.8;
      this.dustColor(s, pal.a, pal.b);
      s.a = 0.5 * amt;
      s.wind = 0.4;
      this.soft.emit(s);
    }
  }

  /** Leaving the ground: the first great downstroke flattens the grass and throws dust out. */
  private takeoffBurst(pos: Vector3): void {
    const player = this.player;
    if (!player) return;
    const groundY = player.wyvernPose.groundY;
    if (groundY === null || pos.y - groundY > player.breed.wingspan * 1.2) return;
    this.dustRing(pos.x, groundY + 0.25, pos.z, 1, player.breed.wingspan, this.surfaceAt(pos.x, pos.y, pos.z));
  }

  /** Leaves shaken off a canopy the wyvern brushed through. */
  private leafBurst(pos: Vector3, speed: number): void {
    if (!this.drifters) return;
    const v = this.player?.flight.velocity ?? this.zero;
    const n = scaledCount(4 + 10 * smoothstep(5, 40, speed), this.particles, 2);
    this.drifters.burst(pos.x, pos.y, pos.z, v.x, v.y, v.z, n);
    this.leafTime = 6;
  }

  /**
   * Skimming the cloud sea: the wyvern's passage tears up the billow tops into a wake of soft
   * cloud spray behind it, more the lower and faster it flies.
   */
  private seaWake(dt: number, player: PlayerSystem): void {
    const sea = this.deps.seaSurfaceAt;
    if (!sea) return;
    const f = player.flight;
    const p = f.position;
    const surface = sea(p.x, p.z);
    const h = p.y - surface;
    const speed = f.velocity.length();
    const amt = (1 - smoothstep(2, 16, h)) * smoothstep(12, 40, speed) * (h > -25 ? 1 : 0);
    if (amt <= 0.01) {
      this.wakeDebt = 0;
      return;
    }
    this.wakeDebt += dt * 60 * amt * this.particles;
    const span = player.breed.wingspan;
    const hx = f.velocity.x / Math.max(speed, 1e-3);
    const hz = f.velocity.z / Math.max(speed, 1e-3);
    while (this.wakeDebt >= 1) {
      this.wakeDebt -= 1;
      const side = this.rand() < 0.5 ? -1 : 1;
      const lat = side * (0.2 + 0.5 * this.rand()) * span * 0.5;
      const back = this.rand() * 6;
      const s = this.spec;
      this.reset(s);
      s.x = p.x - hx * back - hz * lat;
      s.z = p.z - hz * back + hx * lat;
      s.y = Math.min(p.y - 1, surface + 1 + this.rand() * 3);
      // Thrown up and out to the sides, dragged along a little, then hanging in the air.
      const out = 3 + 5 * this.rand();
      s.vx = f.velocity.x * 0.25 - hz * side * out;
      s.vy = 2 + 4 * this.rand() * amt;
      s.vz = f.velocity.z * 0.25 + hx * side * out;
      s.life = 1.6 + this.rand() * 1.2;
      s.drag = 1.6;
      s.gravity = 0.05;
      s.size0 = 1.6 + this.rand() * 1.2;
      s.size1 = 5 + this.rand() * 4;
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.5;
      s.r = 0.98;
      s.g = 0.99;
      s.b = 1.0;
      s.a = 0.42 * (0.5 + 0.5 * amt);
      s.fadeIn = 0.1;
      s.wind = 0.6;
      this.soft.emit(s);
    }
  }

  private landingDust(pos: Vector3, impact: number, surface: SurfaceKind): void {
    const span = this.player?.breed.wingspan ?? 12;
    const amt = 0.35 + 0.65 * smoothstep(0.5, 6.5, impact);
    const pal = SURFACE_DUST[surface];
    const scale = span / 12;
    const n = scaledCount(40 * amt, this.particles, 6);
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sp = (3 + 8 * this.rand()) * amt;
      const s = this.spec;
      this.reset(s);
      s.x = pos.x + ca * span * 0.15;
      s.y = pos.y + 0.2 + this.rand() * 0.5;
      s.z = pos.z + sa * span * 0.15;
      s.vx = ca * sp;
      s.vy = 0.6 + this.rand() * 2.2 * amt;
      s.vz = sa * sp;
      s.life = 1.5 + this.rand() * 1.1;
      s.drag = 1.9;
      s.gravity = -0.02;
      s.size0 = (1.0 + 0.8 * this.rand()) * scale;
      s.size1 = (3.5 + 2.5 * this.rand()) * scale;
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.6;
      this.dustColor(s, pal.a, pal.b);
      s.a = 0.6 * amt;
      s.wind = 0.5;
      this.soft.emit(s);
    }
    // A heavy touchdown sends a low, fast skirt of dust racing out along the ground: weight.
    const heavy = smoothstep(3, 9, impact);
    if (heavy > 0.05) {
      const m = scaledCount(32 * heavy, this.particles, 8);
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2 + this.rand() * 0.2;
        const s = this.spec;
        this.reset(s);
        s.x = pos.x + Math.cos(a) * span * 0.2;
        s.y = pos.y + 0.15;
        s.z = pos.z + Math.sin(a) * span * 0.2;
        const sp = (12 + 8 * this.rand()) * (0.6 + 0.4 * heavy);
        s.vx = Math.cos(a) * sp;
        s.vy = 0.3 + this.rand() * 0.6;
        s.vz = Math.sin(a) * sp;
        s.life = 0.9 + this.rand() * 0.6;
        s.drag = 3.2;
        s.gravity = -0.01;
        s.size0 = 0.8 * scale;
        s.size1 = (2.6 + 1.6 * this.rand()) * scale;
        s.rotation = this.rand() * 6.28;
        this.dustColor(s, pal.a, pal.b);
        s.a = 0.45 * heavy;
        s.fadeIn = 0.03;
        s.wind = 0.3;
        this.soft.emit(s);
      }
    }
    // Clods, grass bits and pebbles kicked up.
    const bits = scaledCount(14 * amt, this.particles, 2);
    for (let i = 0; i < bits; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = this.spec;
      this.reset(s);
      s.x = pos.x + Math.cos(a) * span * 0.1;
      s.y = pos.y + 0.2;
      s.z = pos.z + Math.sin(a) * span * 0.1;
      s.vx = Math.cos(a) * (2 + 4 * this.rand());
      s.vy = 3 + 4 * this.rand() * amt;
      s.vz = Math.sin(a) * (2 + 4 * this.rand());
      s.life = 0.7 + this.rand() * 0.4;
      s.drag = 0.6;
      s.gravity = 1;
      s.size0 = s.size1 = 0.12 + 0.1 * this.rand();
      s.r = pal.bits[0];
      s.g = pal.bits[1];
      s.b = pal.bits[2];
      s.a = 0.95;
      s.fadeIn = 0.02;
      this.soft.emit(s);
    }
  }

  private footDust(pos: Vector3, surface: SurfaceKind): void {
    if (surface === 'wood' || surface === 'stone') return;
    const pal = SURFACE_DUST[surface];
    const n = scaledCount(surface === 'grass' ? 2 : 4, this.particles, 1);
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = this.spec;
      this.reset(s);
      s.x = pos.x;
      s.y = pos.y + 0.15;
      s.z = pos.z;
      s.vx = Math.cos(a) * (1 + 1.5 * this.rand());
      s.vy = 0.3 + 0.5 * this.rand();
      s.vz = Math.sin(a) * (1 + 1.5 * this.rand());
      s.life = 1 + this.rand() * 0.6;
      s.drag = 2;
      s.size0 = 0.35;
      s.size1 = 1.3 + this.rand() * 0.6;
      s.rotation = this.rand() * 6.28;
      this.dustColor(s, pal.a, pal.b);
      s.a = surface === 'grass' ? 0.12 : 0.22;
      s.wind = 0.5;
      this.soft.emit(s);
    }
  }

  /** Scraping or hitting terrain: a burst of dust, pebbles and (on hard hits) sparks. */
  private scrape(point: Vector3, normal: Vector3, impulse: number): void {
    const w = smoothstep(0.5, 14, impulse);
    if (w <= 0.01) return;
    const surface = this.surfaceAt(point.x, point.y, point.z);
    const pal = SURFACE_DUST[surface];
    const v = this.player?.flight.velocity ?? this.zero;
    // Velocity along the surface: debris is dragged the way you were going.
    const vn = v.x * normal.x + v.y * normal.y + v.z * normal.z;
    const tx = v.x - normal.x * vn;
    const ty = v.y - normal.y * vn;
    const tz = v.z - normal.z * vn;
    const nDust = scaledCount(6 + 22 * w, this.particles, 3);
    for (let i = 0; i < nDust; i++) {
      const s = this.spec;
      this.reset(s);
      s.x = point.x + (this.rand() - 0.5) * 2;
      s.y = point.y + (this.rand() - 0.5) * 1;
      s.z = point.z + (this.rand() - 0.5) * 2;
      const out = 2.5 + 7 * this.rand() * w;
      const drag = 0.15 + 0.4 * this.rand();
      s.vx = normal.x * out + tx * drag + (this.rand() - 0.5) * 5;
      s.vy = normal.y * out + ty * drag + this.rand() * 2.5;
      s.vz = normal.z * out + tz * drag + (this.rand() - 0.5) * 5;
      s.life = 1.2 + this.rand() * 1.0;
      s.drag = 1.7;
      s.gravity = -0.01;
      s.size0 = 0.6 + this.rand() * 0.5;
      s.size1 = 2.2 + 1.8 * this.rand() * (0.5 + w);
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.8;
      this.dustColor(s, pal.a, pal.b);
      s.a = 0.36 * (0.4 + 0.6 * w);
      s.wind = 0.5;
      this.soft.emit(s);
    }
    const nBits = scaledCount(10 * w, this.particles, 1);
    for (let i = 0; i < nBits; i++) {
      const s = this.spec;
      this.reset(s);
      s.x = point.x;
      s.y = point.y;
      s.z = point.z;
      s.vx = normal.x * (2 + 5 * this.rand()) + tx * 0.4 + (this.rand() - 0.5) * 4;
      s.vy = normal.y * (2 + 5 * this.rand()) + 2 + ty * 0.2;
      s.vz = normal.z * (2 + 5 * this.rand()) + tz * 0.4 + (this.rand() - 0.5) * 4;
      s.life = 0.8 + 0.5 * this.rand();
      s.drag = 0.5;
      s.gravity = 1;
      s.size0 = s.size1 = 0.18 + 0.2 * this.rand();
      s.r = pal.bits[0] * 0.8;
      s.g = pal.bits[1] * 0.8;
      s.b = pal.bits[2] * 0.8;
      s.a = 0.95;
      s.fadeIn = 0.02;
      this.soft.emit(s);
    }
    // Sparks: claws and scales on rock.
    if (w > 0.2 && (surface === 'rock' || surface === 'stone' || impulse > 8)) {
      const nSparks = scaledCount(28 * w, this.particles, 3);
      for (let i = 0; i < nSparks; i++) {
        const s = this.spec;
        this.reset(s);
        s.x = point.x;
        s.y = point.y;
        s.z = point.z;
        s.vx = tx * (0.4 + 0.5 * this.rand()) + normal.x * 4 * this.rand() + (this.rand() - 0.5) * 7;
        s.vy = ty * (0.4 + 0.5 * this.rand()) + normal.y * 4 * this.rand() + this.rand() * 4;
        s.vz = tz * (0.4 + 0.5 * this.rand()) + normal.z * 4 * this.rand() + (this.rand() - 0.5) * 7;
        s.life = 0.3 + 0.5 * this.rand();
        s.drag = 1.2;
        s.gravity = 0.8;
        s.size0 = 0.13;
        s.size1 = 0.06;
        s.shape = SHAPE_SPARK;
        s.stretch = 0.06;
        s.r = 3.0;
        s.g = 1.6 + 0.5 * this.rand();
        s.b = 0.45;
        s.a = 1;
        s.fadeIn = 0.01;
        this.glow.emit(s);
      }
    }
  }

  /** Passing a race ring: a golden shockwave in the ring's plane and a spray of glints. */
  private ringBurst(pos: Vector3): void {
    const v = this.player?.flight.velocity ?? this.zero;
    const sp = v.length();
    const nx = sp > 1 ? v.x / sp : 0;
    const ny = sp > 1 ? v.y / sp : 0;
    const nz = sp > 1 ? v.z / sp : 1;
    planeBasis(nx, ny, nz, this.basis);
    const B = this.basis;
    // Glints keep a share of your speed so they stream past instead of vanishing behind.
    const carry = 0.55;
    this.rings.spawn(pos.x + v.x * 0.05, pos.y + v.y * 0.05, pos.z + v.z * 0.05, nx, ny, nz, 5, 14, 0.7, 1.25, 0.8, 0.22, 1.2);
    this.rings.spawn(pos.x, pos.y, pos.z, nx, ny, nz, 2, 8, 0.45, 1.3, 1.05, 0.55, 0.8);
    const n = scaledCount(56, this.particles, 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const dx = B[0] * ca + B[3] * sa;
      const dy = B[1] * ca + B[4] * sa;
      const dz = B[2] * ca + B[5] * sa;
      const r0 = 3 + this.rand() * 2;
      const out = 10 + 9 * this.rand();
      const s = this.spec;
      this.reset(s);
      s.x = pos.x + dx * r0;
      s.y = pos.y + dy * r0;
      s.z = pos.z + dz * r0;
      s.vx = dx * out + v.x * carry;
      s.vy = dy * out + v.y * carry;
      s.vz = dz * out + v.z * carry;
      s.life = 0.7 + 0.5 * this.rand();
      s.drag = 2.6;
      s.gravity = 0.15;
      s.size0 = 1.3 + 0.6 * this.rand();
      s.size1 = 0.25;
      s.rotation = this.rand() * 0.8;
      s.spin = (this.rand() - 0.5) * 3;
      s.shape = SHAPE_GLINT;
      s.r = 1.5;
      s.g = 0.95;
      s.b = 0.25;
      s.a = 1;
      s.fadeIn = 0.02;
      this.glow.emit(s);
    }
    // A shimmer of motes left hanging in the ring.
    const m = scaledCount(26, this.particles, 6);
    for (let i = 0; i < m; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 2 + this.rand() * 5;
      const s = this.spec;
      this.reset(s);
      s.x = pos.x + (B[0] * Math.cos(a) + B[3] * Math.sin(a)) * r;
      s.y = pos.y + (B[1] * Math.cos(a) + B[4] * Math.sin(a)) * r;
      s.z = pos.z + (B[2] * Math.cos(a) + B[5] * Math.sin(a)) * r;
      s.vx = v.x * 0.3 + (this.rand() - 0.5) * 2;
      s.vy = v.y * 0.3 + this.rand() * 1.5;
      s.vz = v.z * 0.3 + (this.rand() - 0.5) * 2;
      s.life = 1.2 + this.rand() * 0.8;
      s.drag = 1.5;
      s.gravity = -0.03;
      s.size0 = 0.6;
      s.size1 = 0.15;
      s.shape = SHAPE_GLOW;
      s.r = 1.4;
      s.g = 1.0;
      s.b = 0.35;
      s.a = 0.8;
      this.glow.emit(s);
    }
    this.triggerFlash(0.14, 1.0, 0.85, 0.55);
  }

  /** Picking up a feather (warm spiral of glints) or a relic (bigger, cooler, with a ring). */
  private collectSparkle(pos: Vector3, kind: 'feather' | 'relic'): void {
    const relic = kind === 'relic';
    const n = scaledCount(relic ? 80 : 44, this.particles, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 6 + this.rand() * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = relic ? 0.9 : 0.6;
      const s = this.spec;
      this.reset(s);
      s.x = pos.x + ca * r0;
      s.y = pos.y + (this.rand() - 0.3) * 0.8;
      s.z = pos.z + sa * r0;
      const tang = relic ? 4.5 : 3.2;
      const outv = 1.2 + this.rand() * 1.5;
      s.vx = -sa * tang + ca * outv;
      s.vy = 1.8 + this.rand() * (relic ? 5 : 3.5);
      s.vz = ca * tang + sa * outv;
      s.life = 1.0 + 0.7 * this.rand();
      s.drag = 1.4;
      s.gravity = -0.04;
      s.size0 = (relic ? 0.55 : 0.42) + 0.25 * this.rand();
      s.size1 = 0.06;
      s.rotation = this.rand();
      s.spin = (this.rand() - 0.5) * 4;
      s.shape = i % 3 === 0 ? SHAPE_GLOW : SHAPE_GLINT;
      if (relic) {
        const gold = this.rand() < 0.3;
        s.r = gold ? 1.5 : 0.7;
        s.g = gold ? 1.05 : 0.8;
        s.b = gold ? 0.3 : 1.7;
      } else {
        // Mostly gold, a few white-hot.
        const white = this.rand() < 0.3;
        s.r = white ? 1.4 : 1.35;
        s.g = white ? 1.3 : 0.95;
        s.b = white ? 1.0 : 0.3;
      }
      s.a = 1;
      s.fadeIn = 0.03;
      this.glow.emit(s);
    }
    // A bloom of light where it was.
    const s = this.spec;
    this.reset(s);
    s.x = pos.x;
    s.y = pos.y;
    s.z = pos.z;
    s.life = 0.45;
    s.drag = 0;
    s.size0 = relic ? 2.2 : 1.5;
    s.size1 = relic ? 3.8 : 2.6;
    s.shape = SHAPE_GLOW;
    s.r = relic ? 0.55 : 1.0;
    s.g = relic ? 0.65 : 0.85;
    s.b = relic ? 1.0 : 0.45;
    s.a = 0.6;
    s.fadeIn = 0.05;
    this.glow.emit(s);
    if (relic) {
      this.rings.spawn(pos.x, pos.y, pos.z, 0, 1, 0, 1, 9, 1.1, 0.42, 0.52, 1.25, 0.85);
      this.triggerFlash(0.3, 0.75, 0.82, 1.0);
    } else {
      this.triggerFlash(0.2, 1.0, 0.94, 0.8);
    }
  }

  private triggerFlash(amount: number, r: number, g: number, b: number): void {
    const grade = this.deps.renderer.grade;
    // Blend colors when flashes overlap so the brighter one wins.
    if (amount >= this.flash) grade.uFlashColor.value.setRGB(r, g, b);
    this.flash = Math.min(0.5, Math.max(this.flash, amount));
  }

  // --- Breath ------------------------------------------------------------------------------------

  private updateBreath(dt: number, player: PlayerSystem, wyvern: WyvernRenderable): void {
    const mode = player.mode;
    if (mode === 'flying' || mode === 'falling' || mode === 'respawning') return;
    const wp = player.wyvernPose.position;
    const rp = player.riderPose;
    const night = globalUniforms.uNight.value;
    this.breathWyvern -= dt;
    if (this.breathWyvern <= 0) {
      this.breathWyvern = 2.3 + this.rand() * 0.8;
      if (isColdAir(wp.x, wp.y, wp.z, this.moor) || night > 0.85) {
        wyvern.getHead(this.head);
        this.fwd.set(0, 0, 1).applyQuaternion(player.wyvernPose.orientation);
        this.breath(this.head, this.fwd, 1);
      }
    }
    this.breathRider -= dt;
    if (this.breathRider <= 0) {
      this.breathRider = 2.9 + this.rand() * 0.9;
      const p = rp.position;
      if (!rp.mounted && (isColdAir(p.x, p.y, p.z, this.moor) || night > 0.85)) {
        this.fwd.set(Math.sin(rp.yaw), 0, Math.cos(rp.yaw));
        this.head.set(p.x + this.fwd.x * 0.22, p.y + 1.58, p.z + this.fwd.z * 0.22);
        this.breath(this.head, this.fwd, 0.38);
      }
    }
  }

  private breath(at: Vector3, fwd: Vector3, scale: number): void {
    const n = scaledCount(7, this.particles, 3);
    for (let i = 0; i < n; i++) {
      const s = this.spec;
      this.reset(s);
      const k = i / n;
      s.x = at.x + fwd.x * 0.2 * scale;
      s.y = at.y;
      s.z = at.z + fwd.z * 0.2 * scale;
      const sp = (1.1 + 1.3 * this.rand()) * (0.6 + 0.4 * scale);
      s.vx = fwd.x * sp + (this.rand() - 0.5) * 0.35;
      s.vy = fwd.y * sp - 0.15 + this.rand() * 0.25;
      s.vz = fwd.z * sp + (this.rand() - 0.5) * 0.35;
      s.life = 1.3 + 0.7 * this.rand() + k * 0.3;
      s.drag = 2.1;
      s.gravity = -0.025;
      s.size0 = 0.22 * scale + 0.05;
      s.size1 = (1.7 + 0.7 * this.rand()) * scale + 0.25;
      s.rotation = this.rand() * 6.28;
      s.spin = (this.rand() - 0.5) * 0.6;
      s.r = 0.96;
      s.g = 0.97;
      s.b = 1.0;
      s.a = 0.26;
      s.fadeIn = 0.12;
      s.wind = 0.6;
      this.soft.emit(s);
    }
  }

  // --- Helpers ------------------------------------------------------------------------------------

  private reset(s: ParticleSpec): void {
    s.vx = s.vy = s.vz = 0;
    s.life = 1;
    s.drag = 1;
    s.gravity = 0;
    s.size0 = s.size1 = 1;
    s.rotation = 0;
    s.spin = 0;
    s.r = s.g = s.b = 1;
    s.a = 1;
    s.shape = SHAPE_PUFF;
    s.stretch = 0;
    s.fadeIn = 0.08;
    s.wind = 0;
  }

  private dustColor(s: ParticleSpec, a: readonly number[], b: readonly number[]): void {
    const t = this.rand();
    s.r = a[0] + (b[0] - a[0]) * t;
    s.g = a[1] + (b[1] - a[1]) * t;
    s.b = a[2] + (b[2] - a[2]) * t;
  }

  /** Stats for the showcase/perf report. */
  get stats(): { soft: number; glow: number; drifters: number; fireflies: number } {
    return {
      soft: this.soft.emitted,
      glow: this.glow.emitted,
      drifters: this.drifters?.count ?? 0,
      fireflies: this.fireflies?.homed ?? 0,
    };
  }
}

/** The end of the longest wooden deck (the Roost's launch deck), facing outward. */
export function launchDeckEnd(decks: readonly FxDeck[] | undefined): DeckEnd | null {
  if (!decks || decks.length === 0) return null;
  let best: FxDeck | null = null;
  for (const d of decks) if (d.surface === 'wood' && (!best || d.length > best.length)) best = d;
  if (!best) return null;
  const sx = Math.sin(best.yaw);
  const cz = Math.cos(best.yaw);
  return { x: best.x + sx * best.length, y: best.y, z: best.z + cz * best.length, dirX: sx, dirZ: cz, halfWidth: best.halfWidth };
}
