import { Color, DirectionalLight, HemisphereLight, Quaternion, Vector3 } from 'three';
import type { BreedId, WyvernLook, WyvernPose } from '../../core/types';
import type { Showcase } from '../showcase';
import type { Game } from '../../game/Game';
import { BREEDS } from '../../flight/breeds';
import { BREED_DEFAULT_COLORS, DEFAULT_WYVERN, cosmeticsFor } from '../../cosmetics/catalog';
import { Wyvern } from '../../creatures/wyvern/Wyvern';
import { createWyvernPose } from '../../player/poses';
import { globalUniforms } from '../../render/uniforms';
import { smoothstep } from '../../core/math';

/**
 * ?view=wyvern — the wyvern on its own, posed from a synthesized WyvernPose every frame.
 *
 *   breed=harrier|skimmer|galewing|ironback
 *   pose=glide|flap|tuck|flare|stall|bankL|bankR|idle|walk|run|takeoff|landing|hover
 *   look params: pattern= head= horns= frill= tail= saddle= primary= secondary= belly= membrane= eyes=
 *                saddleColor= (hex without '#')
 *   cam=side|front|back|top|low|three|under|sun or camAz=deg&camEl=deg&camDist=m
 *   turntable=1          orbit the camera (degrees per second with spin=)
 *   bg=roost|air         backdrop (default: roost for ground poses, air for flight poses)
 *   phase=0.25           freeze the flap phase
 *   fatigue=0..1  ghost=1  rider=0
 *   lineup=breeds|pattern|head|horns|frill|tail|saddle   several wyverns side by side
 *   tod= (time of day; default golden hour 0.7), sky=native to skip the lighting stand-in
 *   real=takeoff|landing|turn|dive|walk|cliff   drive the REAL player (flight model + state
 *                        machine) from a staged start; scripted input comes from the shot steps.
 *                        The camera tracks with the same cam= presets.
 *
 * For deterministic captures (scripts/dragon-capture.mjs):
 *   fresh=1              start from the default look (not the save) and restart the main wyvern's
 *                        animation from rest, so a re-staging never depends on the one before
 *   bask=s               start the stretch-and-bask (pose.ruffle rises) at showcase time s
 *   blink=s nict=s tongue=s   cue a blink / nictitating-membrane sweep / tongue flick at time s
 *                        (comma lists allowed); any cue holds the natural idle events off
 *   focus=<bone>|saddle  aim the camera at a wyvern bone by name (jaw, neck3, chest, spine,
 *                        breath, pelvis, clawL, finger0aL, toesL, tail9, ...), the seat (saddle) or
 *                        head (the snout, like cam=head) instead of the body centre
 *   rider=beside         the rider stands on foot beside the wyvern's left shoulder, facing the
 *                        camera (size comparison)
 *   kneel=k&kneelAt=s    the mount kneel (WyvernPose.kneel, 0..1), going down from time s
 */

const FLIGHT = new Set(['glide', 'flap', 'tuck', 'flare', 'stall', 'bankL', 'bankR', 'hover', 'landing']);

interface Actor {
  wyvern: Wyvern;
  pose: WyvernPose;
  /** Offset from the scene anchor (m, world). */
  offset: Vector3;
  breed: BreedId;
}

let poseName = 'glide';
let realScene: string | null = null;
let camName = 'three';
let anchor = new Vector3();
let heading = 0;
let time = 0;
let params = new URLSearchParams();
let actors: Actor[] = [];
let useMain = true;
let lights: { sun: DirectionalLight | null; hemi: HemisphereLight | null } = { sun: null, hemi: null };
const base = { sun: 0, hemi: 0, sunColor: new Color(), hemiSky: new Color(), hemiGround: new Color() };

const _q = new Quaternion();
const _q2 = new Quaternion();
const _v = new Vector3();
const _cam = new Vector3();
const _tgt = new Vector3();
const _focus = new Vector3();
const UP = new Vector3(0, 1, 0);
type IdleCue = 'blink' | 'nictitate' | 'tongue';
/** Cued idle events (showcase seconds), in time order; `nextCue` is the first not yet fired. */
let cues: { t: number; event: IdleCue }[] = [];
let nextCue = 0;

function num(name: string, fallback: number): number {
  const v = params.get(name);
  return v !== null && Number.isFinite(Number(v)) ? Number(v) : fallback;
}

function lookFrom(game: Game, breed: BreedId): WyvernLook {
  const base = params.get('fresh') === '1' ? DEFAULT_WYVERN : game.save.data.wyvern;
  const look: WyvernLook = { ...base, breed, ...BREED_DEFAULT_COLORS[breed] };
  for (const k of ['pattern', 'head', 'horns', 'frill', 'tail', 'saddle'] as const) {
    const v = params.get(k);
    if (v) look[k] = v;
  }
  for (const k of ['primary', 'secondary', 'belly', 'membrane', 'eyes', 'saddleColor'] as const) {
    const v = params.get(k);
    if (v) look[k] = '#' + v.replace('#', '');
  }
  return look;
}

/** Lighting stand-in for the baseline sky: warm low sun at golden hour, dim blue night. */
function applyLight(game: Game): void {
  const t = game.sky.timeOfDay;
  const sunY = Math.sin((t - 0.25) * Math.PI * 2);
  const n = smoothstep(0.08, -0.18, sunY);
  const dusk = smoothstep(0.5, 0.05, sunY) * (1 - n);
  const u = globalUniforms;
  u.uNight.value = n;
  if (lights.sun) {
    lights.sun.intensity = base.sun * (1 - n * 0.85) * (1 - dusk * 0.15);
    lights.sun.color.copy(base.sunColor).lerp(new Color('#ffad66'), dusk * 0.85).lerp(new Color('#9fb4ff'), n);
  }
  if (lights.hemi) {
    lights.hemi.intensity = base.hemi * (1 - n * 0.72);
    lights.hemi.color.copy(base.hemiSky).lerp(new Color('#e8b8a0'), dusk * 0.4).lerp(new Color('#2c3c6e'), n);
    lights.hemi.groundColor.copy(base.hemiGround).lerp(new Color('#1c1a24'), n);
  }
  u.uSunColor.value.set('#fff0dd').lerp(new Color('#ffa860'), dusk * 0.85).lerp(new Color('#8fa4e8'), n).multiplyScalar(1 - 0.6 * n);
  u.uSkyZenith.value.set('#3d73c7').lerp(new Color('#4a64a8'), dusk).lerp(new Color('#0b1430'), n);
  u.uSkyHorizon.value.set('#bfd6eb').lerp(new Color('#f4b47c'), dusk).lerp(new Color('#24345c'), n);
  u.uFogColor.value.set('#aec7e6').lerp(new Color('#d0aaa0'), dusk * 0.6).lerp(new Color('#1b2747'), n);
  u.uFogSunColor.value.set('#ffd9a6').lerp(new Color('#ff9a55'), dusk).lerp(new Color('#2a3a66'), n);
}

/** Fill a pose for the named state at time t. */
function synth(p: WyvernPose, name: string, t: number, breed: BreedId, at: Vector3, yaw: number, game: Game): void {
  const B = BREEDS[breed];
  const sh = B.standHeight;
  const flight = FLIGHT.has(name);
  // Synthetic poses have no gameplay contact event; use the animator's legacy fallback.
  p.touchdown = undefined;
  p.airborne = flight;
  p.angularVelocity.set(0, 0, 0);
  p.flare = 0;
  p.stall = 0;
  p.flapStrength = 0;
  p.wingSpread = flight ? 1 : 0.22;
  p.fatigue = num('fatigue', 0);
  // kneel=k[&kneelAt=s]: the mount kneel (C11), down from showcase time s at the real ramp (2.6/s).
  p.kneel = num('kneel', 0) * smoothstep(0, 1, Math.min(1, Math.max(0, (t - num('kneelAt', -1)) * 2.6)));
  p.gaitTime = t;
  p.groundSpeed = 0;
  p.gait = 'idle';
  let pitch = 0;
  let roll = 0;
  let speed = 0;
  const phaseParam = params.get('phase');
  const flapPhase = (rate: number) => (phaseParam !== null ? Number(phaseParam) : (t * rate) % 1);
  const pos = p.position.copy(at);
  let groundY: number | null = null;
  const g = game.world.terrain.groundAt(at.x, at.z, at.y + 50);
  switch (name) {
    case 'glide':
      speed = 24;
      break;
    case 'flap':
      speed = 24;
      p.flapStrength = 1;
      p.flapPhase = flapPhase(B.flapRate);
      pitch = 6;
      break;
    case 'hover':
      speed = 14;
      p.flapStrength = 1;
      p.flare = 1;
      p.flapPhase = flapPhase(B.flapRate);
      pitch = 22;
      break;
    case 'tuck':
      speed = 55;
      p.wingSpread = 0.25;
      pitch = -35;
      break;
    case 'flare':
      speed = 16;
      p.flare = 1;
      pitch = 28;
      break;
    case 'stall':
      speed = 13;
      p.stall = 1;
      p.flare = 0.3;
      pitch = 24;
      roll = 8 * Math.sin(t * 2.3);
      break;
    case 'bankL':
    case 'bankR': {
      const s = name === 'bankL' ? -1 : 1;
      speed = 30;
      roll = 38 * s;
      p.angularVelocity.set(0, -0.45 * s, 0.05 * s);
      break;
    }
    case 'landing': {
      // Coming in over the Roost, flaring, legs reaching.
      speed = 15;
      p.flare = 0.8;
      pitch = 20;
      if (g) {
        groundY = g.y;
        pos.y = g.y + sh * 1.8;
      }
      break;
    }
    default: {
      // Ground states.
      const walk = name === 'walk' ? B.groundSpeed * 0.4 : name === 'run' ? B.groundSpeed : 0;
      speed = walk;
      p.groundSpeed = walk;
      p.gait = name === 'walk' ? 'walk' : name === 'run' ? 'run' : name === 'takeoff' ? 'takeoff' : 'idle';
      if (name === 'takeoff') {
        // The crouch, looping: wings open while the body sinks.
        const c = smoothstep(0, 0.6, (t % 3) / 3) * (1 - smoothstep(0.85, 1, (t % 3) / 3));
        p.wingSpread = 0.22 + 0.78 * c;
        pos.y -= 0.22 * sh * c;
      }
      break;
    }
  }
  // Moving ground states walk in a straight line through the anchor (looping).
  if (!flight && speed > 0) {
    const L = 24;
    const d = ((t * speed) % L) - L / 2;
    pos.x += Math.sin(yaw) * d;
    pos.z += Math.cos(yaw) * d;
  }
  if (!flight) {
    const gg = game.world.terrain.groundAt(pos.x, pos.z, pos.y + 20);
    groundY = gg ? gg.y : at.y - sh;
    pos.y = groundY + sh + (pos.y - at.y);
  } else if (name !== 'landing') groundY = g && at.y - g.y < 40 ? g.y : null;
  p.groundY = groundY;
  p.airspeed = speed;
  _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
  _q2.setFromAxisAngle(_v.set(1, 0, 0), (-pitch * Math.PI) / 180);
  _q.multiply(_q2);
  _q2.setFromAxisAngle(_v.set(0, 0, 1), (roll * Math.PI) / 180);
  p.orientation.copy(_q).multiply(_q2);
  p.velocity.set(0, 0, speed).applyQuaternion(_q.setFromAxisAngle(_v.set(0, 1, 0), yaw));
  if (name === 'landing') p.velocity.y = -2;
  // Look ahead, a little toward the camera on the ground.
  p.lookTarget.set(Math.sin(yaw), 0.05, Math.cos(yaw)).multiplyScalar(40).add(p.position);
  if (!flight && name === 'idle') {
    p.lookTarget.x += 18 * Math.sin(t * 0.35);
    p.lookTarget.y += 4 * Math.sin(t * 0.21);
  }
}


/** What the camera looks at on the main wyvern: focus=<bone>|saddle|head, cam=head, or the body. */
function focusPoint(game: Game): Vector3 {
  const f = params.get('focus') ?? (camName === 'head' ? 'head' : null);
  if (f === 'head') return game.wyvern.getHead(_focus);
  const o = f ? game.wyvern.group.getObjectByName(f) : undefined;
  return o ? o.getWorldPosition(_focus) : _focus.copy(game.player.wyvernPose.position);
}

/** rider=beside: the rider on foot by the wyvern's left shoulder, facing the camera. */
function standBeside(game: Game, breed: BreedId): void {
  const w = game.player.wyvernPose;
  const sh = BREEDS[breed].standHeight;
  const r = game.player.riderPose;
  _v.set(0.55 * sh + 1.3, 0, 0.25 * sh).applyAxisAngle(UP, heading).add(w.position);
  const g = game.world.terrain.groundAt(_v.x, _v.z, _v.y);
  r.mounted = false;
  r.position.set(_v.x, g ? g.y : (w.groundY ?? w.position.y - sh), _v.z);
  r.yaw = heading + (camAngles(game)[0] * Math.PI) / 180;
  r.velocity.set(0, 0, 0);
  r.action = 'idle';
  r.lean = r.crouch = r.brace = 0;
  r.airflow.set(0, 0, 0);
}

/** Camera azimuth (deg, relative to the heading), elevation (deg) and distance for cam=. */
function camAngles(game: Game): [number, number, number] {
  const breed = (params.get('breed') as BreedId) ?? 'harrier';
  const span = BREEDS[breed].wingspan;
  let az = 120;
  let el = 14;
  let dist = 1.25 * span;
  switch (camName) {
    case 'side':
      az = 90;
      el = 6;
      break;
    case 'front':
      az = 0;
      el = 8;
      break;
    case 'back':
      az = 180;
      el = 12;
      break;
    case 'top':
      az = 160;
      el = 70;
      break;
    case 'low':
      az = 140;
      el = -14;
      break;
    case 'under':
      az = 100;
      el = -45;
      break;
    case 'close':
      az = 60;
      el = 10;
      dist = 0.55 * span;
      break;
    case 'head':
      az = 50;
      el = 8;
      dist = 0.3 * span;
      break;
    case 'sun': {
      // Look toward the sun through the wings (backlit membranes).
      const s = globalUniforms.uSunDir.value;
      az = (Math.atan2(-s.x, -s.z) - heading) * (180 / Math.PI);
      el = -Math.asin(Math.min(0.9, s.y)) * (180 / Math.PI) * 0.6 - 6;
      break;
    }
  }
  az = num('camAz', az);
  el = num('camEl', el);
  dist = num('camDist', dist);
  return [az, el, dist];
}

/** Stage the real player for a scripted sequence. */
function stageReal(game: Game, scene: string, breed: BreedId): void {
  game.setWyvernLook(lookFrom(game, breed));
  game.debug.freeze = false;
  const p = game.player;
  const t = game.world.terrain;
  switch (scene) {
    case 'landing': {
      // Low over the Roost's plaza, heading west toward the stable yard.
      const g = t.groundAt(45, 42, 1e6);
      p.teleport(new Vector3(45, (g ? g.y : 240) + 9, 42), -Math.PI / 2, 'flying', 18);
      break;
    }
    case 'turn':
      p.teleport(new Vector3(-200, 420, 200), Math.PI / 2, 'flying', 30);
      break;
    case 'dive':
      p.teleport(new Vector3(0, 620, -300), Math.PI, 'flying', 26);
      break;
    case 'cliff': {
      // Mounted, facing out over the Roost's southern rim.
      let z = 60;
      for (; z < 400; z += 1) if (!t.groundAt(0, z, 1e6)) break;
      const g = t.standingPoint(0, z - 18, new Vector3());
      p.teleport(g.add(new Vector3(0, BREEDS[breed].standHeight, 0)), 0, 'landed');
      break;
    }
    case 'walk':
    case 'takeoff':
    default: {
      const g = t.standingPoint(-34, 40, new Vector3());
      p.teleport(g.add(new Vector3(0, BREEDS[breed].standHeight, 0)), num('yaw', 200) * (Math.PI / 180), 'landed');
      break;
    }
  }
  game.cameraRig.snap(p);
}

const wyvernShowcase: Showcase = {
  name: 'wyvern',
  description: 'The wyvern posed from synthesized poses: breed=, pose=, cam=, turntable=1, lineup=, look params',
  setup(game, p) {
    // Re-stage from the console or a shot script: __wyvernShowcase('pose=flap&cam=front').
    (window as unknown as { __wyvernShowcase?: (q: string) => void }).__wyvernShowcase = (q: string) => {
      for (const a of actors) a.wyvern.dispose();
      game.wyvern.group.visible = true;
      game.rider.group.visible = true;
      wyvernShowcase.setup(game, new URLSearchParams(q));
    };
    params = p;
    time = num('t0', 0);
    realScene = p.get('real');
    poseName = p.get('pose') ?? 'glide';
    camName = p.get('cam') ?? 'three';
    const breed = (p.get('breed') as BreedId) ?? 'harrier';
    const flight = FLIGHT.has(poseName);
    const bg = p.get('bg') ?? (flight ? 'air' : 'roost');
    const t = game.world.terrain;
    const lineupStage = !!p.get('lineup');
    if (bg === 'roost') {
      anchor = lineupStage ? t.standingPoint(6, 8, new Vector3()) : t.standingPoint(-34, 40, new Vector3());
      anchor.y += BREEDS[breed].standHeight;
      heading = num('yaw', 200) * (Math.PI / 180);
      if (flight) anchor.y += poseName === 'landing' ? 0 : 14;
    } else {
      anchor = new Vector3(60, 345, 190);
      heading = num('yaw', 150) * (Math.PI / 180);
    }
    if (p.has('tod')) game.debug.tod = Number(p.get('tod'));
    else if (game.debug.tod === undefined) game.debug.tod = 0.7;
    cues = [];
    nextCue = 0;
    for (const [k, event] of [['blink', 'blink'], ['nict', 'nictitate'], ['tongue', 'tongue']] as const)
      for (const v of (p.get(k) ?? '').split(',')) if (v !== '' && Number.isFinite(Number(v))) cues.push({ t: Number(v), event });
    cues.sort((a, b) => a.t - b.t);
    game.player.wyvernPose.ruffle = 0;
    if (realScene) {
      stageReal(game, realScene, breed);
      if (p.get('fresh') === '1') game.wyvern.resetAnimation();
      if (cues.length) game.wyvern.cueIdle(null, 1e4);
      lights = { sun: null, hemi: null };
      game.scene.traverse((o) => {
        if (o instanceof DirectionalLight && !lights.sun) lights.sun = o;
        if (o instanceof HemisphereLight && !lights.hemi) lights.hemi = o;
      });
      if (lights.sun) {
        base.sun = lights.sun.intensity;
        base.sunColor.copy(lights.sun.color);
      }
      if (lights.hemi) {
        base.hemi = lights.hemi.intensity;
        base.hemiSky.copy(lights.hemi.color);
        base.hemiGround.copy(lights.hemi.groundColor);
      }
      return;
    }
    game.debug.freeze = true;
    // Park the player's own wyvern at the anchor (we drive its pose), or out of the way.
    game.player.teleport(anchor.clone(), heading, flight ? 'flying' : 'landed', 0);
    const ghost = p.get('ghost') === '1';
    actors = [];
    const lineup = p.get('lineup');
    useMain = !lineup && !ghost;
    if (lineup) {
      game.wyvern.group.visible = false;
      game.rider.group.visible = false;
      const list: WyvernLook[] = [];
      if (lineup === 'breeds') for (const b of ['skimmer', 'harrier', 'galewing', 'ironback'] as BreedId[]) list.push(lookFrom(game, b));
      else {
        const slot = { pattern: 'wyvernPattern', head: 'wyvernHead', horns: 'wyvernHorns', frill: 'wyvernFrill', tail: 'wyvernTail', saddle: 'saddle' }[lineup] as
          | 'wyvernPattern'
          | 'wyvernHead'
          | 'wyvernHorns'
          | 'wyvernFrill'
          | 'wyvernTail'
          | 'saddle';
        for (const c of cosmeticsFor(slot)) list.push({ ...lookFrom(game, breed), [lineup]: c.id });
      }
      const spacing = lineup === 'breeds' ? 17 : 12;
      // Line the wyverns up across the camera's view so every one is seen side by side.
      const [caz] = camAngles(game);
      const a = heading + (caz * Math.PI) / 180;
      const right = new Vector3(Math.cos(a), 0, -Math.sin(a));
      list.forEach((look, i) => {
        const w = new Wyvern(look, { terrain: game.world.terrain });
        game.scene.add(w.group);
        const off = right.clone().multiplyScalar((i - (list.length - 1) / 2) * spacing);
        actors.push({ wyvern: w, pose: createWyvernPose(), offset: off, breed: look.breed });
      });
    } else if (ghost) {
      game.wyvern.group.visible = false;
      game.rider.group.visible = false;
      const w = new Wyvern(lookFrom(game, breed), { ghost: true });
      game.scene.add(w.group);
      actors.push({ wyvern: w, pose: createWyvernPose(), offset: new Vector3(), breed });
    } else {
      game.setWyvernLook(lookFrom(game, breed));
      if (p.get('fresh') === '1') game.wyvern.resetAnimation();
      if (cues.length) game.wyvern.cueIdle(null, 1e4);
      if (p.get('rider') === '0') game.rider.group.visible = false;
    }
    lights = { sun: null, hemi: null };
    game.scene.traverse((o) => {
      if (o instanceof DirectionalLight && !lights.sun) lights.sun = o;
      if (o instanceof HemisphereLight && !lights.hemi) lights.hemi = o;
    });
    if (lights.sun) {
      base.sun = lights.sun.intensity;
      base.sunColor.copy(lights.sun.color);
    }
    if (lights.hemi) {
      base.hemi = lights.hemi.intensity;
      base.hemiSky.copy(lights.hemi.color);
      base.hemiGround.copy(lights.hemi.groundColor);
    }
  },
  update(game, dt) {
    time += dt;
    if (params.get('sky') !== 'native') applyLight(game);
    const breed = (params.get('breed') as BreedId) ?? 'harrier';
    // Cued idle events and the stretch-and-bask (the main wyvern, staged or real).
    while (nextCue < cues.length && time >= cues[nextCue].t) game.wyvern.cueIdle(cues[nextCue++].event);
    if (params.has('bask')) game.player.wyvernPose.ruffle = time >= num('bask', 0) ? 1 : 0;
    if (realScene) {
      // Track the real wyvern by its heading (horizon stays level).
      const w = game.player.wyvernPose;
      _v.set(0, 0, 1).applyQuaternion(w.orientation);
      const hd = Math.atan2(_v.x, _v.z);
      heading = hd;
      let [az, el, dist] = camAngles(game);
      if (params.get('turntable') === '1') az += time * num('spin', 30);
      const a = hd + (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      _cam.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist).add(w.position);
      game.cameraRig.setOverride({ position: _cam, target: _tgt.copy(w.position) });
      return;
    }
    if (useMain) {
      const pose = game.player.wyvernPose;
      synth(pose, poseName, time, breed, anchor, heading, game);
      if (params.get('rider') === 'beside') standBeside(game, breed);
    }
    for (const a of actors) {
      synth(a.pose, poseName, time, a.breed, _v.copy(anchor).add(a.offset), heading, game);
      if (!FLIGHT.has(poseName)) {
        const g = game.world.terrain.groundAt(a.pose.position.x, a.pose.position.z, a.pose.position.y + 20);
        if (g) {
          const sh = BREEDS[a.breed].standHeight;
          a.pose.position.y += g.y + sh - (a.pose.groundY ?? g.y) - sh;
          a.pose.groundY = g.y;
        }
      }
      a.wyvern.update(dt, a.pose);
    }

    // Camera: orbit around the subject relative to its heading.
    const focus = useMain ? focusPoint(game) : _tgt.copy(anchor);
    const span = BREEDS[breed].wingspan;
    const lineLen = actors.length > 1 ? (actors.length - 1) * (params.get('lineup') === 'breeds' ? 17 : 12) : 0;
    let [az, el, dist] = camAngles(game);
    if (lineLen > 0 && !params.has('camDist')) dist = Math.max(dist, lineLen * 0.62 + 8);
    if (params.get('turntable') === '1') az += time * num('spin', 30);
    const a = heading + (az * Math.PI) / 180;
    const e = (el * Math.PI) / 180;
    _cam.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist).add(focus);
    _tgt.copy(focus);
    game.cameraRig.setOverride({ position: _cam, target: _tgt });
  },
};

export default wyvernShowcase;
