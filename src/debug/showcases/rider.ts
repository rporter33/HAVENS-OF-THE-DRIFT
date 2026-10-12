import { CapsuleGeometry, Color, DirectionalLight, Euler, HemisphereLight, Mesh, Object3D, Vector3 } from 'three';
import type { Showcase } from '../showcase';
import type { Game } from '../../game/Game';
import type { RiderAction, RiderLook, RiderPose } from '../../core/types';
import { Rider } from '../../creatures/rider/Rider';
import { C02_LOOK } from '../../creatures/rider/proof';
import { cosmeticsFor, DEFAULT_RIDER } from '../../cosmetics/catalog';
import { GARMENT_SLOTS } from '../../cosmetics/wardrobe';
import { toonMaterial } from '../../render/painterly';
import { globalUniforms } from '../../render/uniforms';
import { createRiderPose } from '../../player/poses';
import { PLAYER_TUNING as P } from '../../player/tuning';

/**
 * ?view=rider — the rider in isolation on the Roost.
 *
 *   look:     outfit= hair= headgear= scarf= cape= build=slight|medium|broad
 *             skin= hairColor= primary= secondary= scarfColor= capeColor=   (hex without #)
 *   lineup:   lineup=outfit|hair|headgear|scarf|cape|build|action — one rider per option
 *   action:   action=idle|walk|run|jump|fall|land|mount|dismount|wave [t=fixed action seconds]
 *             speed= (m/s on foot; airflow when mounted). mount/dismount use a stand-in wyvern
 *             and replay the player state's own arcs.
 *   mounted:  mounted=1 on a stand-in saddle; lean= crouch= brace= pitch=deg (dive angle)
 *   real:     real=1 puts the game's own rider on the real wyvern, held in the air (ground=1 to
 *             stand it on the Roost) with the same speed/lean/crouch/brace/pitch controls
 *   air:      wind=x,z (m/s, world) on foot; defaults to the shared wind uniform
 *   light:    tod= as usual (the sky module lights it); sky=standin tints dusk/night by hand for
 *             a baseline sky that only moves the sun
 *   camera:   angle=deg (0 = in front) dist= height= camUp= turntable=1 focus=head; hud=1 keeps the HUD
 *
 * Steps files can tweak parameters live: __riderShow.params.set('angle', '90').
 */

interface Actor {
  rider: Rider;
  pose: RiderPose;
  home: Vector3;
  action: RiderAction;
  fixedT: number | null;
  saddle: Object3D | null;
  body: Mesh | null;
}

const actors: Actor[] = [];
let params = new URLSearchParams();
let time = 0;
const _v = new Vector3();
const _t = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const ACTIONS: [RiderAction, number | null][] = [
  ['idle', null],
  ['wave', 0.62],
  ['jump', 0.16],
  ['fall', 1.4],
  ['land', 0.06],
  ['mount', 0.42],
  ['dismount', 0.85],
];

let lights: { sun: DirectionalLight | null; hemi: HemisphereLight | null } = { sun: null, hemi: null };
const lightBase = { sun: 0, hemi: 0, sunColor: new Color(), hemiSky: new Color(), hemiGround: new Color() };
const smoothE = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Night / golden-hour stand-in for the baseline sky (a real sky overwrites these each frame). */
function applySkyStandIn(game: Game): void {
  const t = game.sky.timeOfDay;
  const sunY = Math.sin((t - 0.25) * Math.PI * 2);
  const n = smoothE(0.08, -0.18, sunY);
  const dusk = smoothE(0.45, 0.05, sunY) * (1 - n);
  const u = globalUniforms;
  u.uNight.value = n;
  if (lights.sun) {
    lights.sun.intensity = lightBase.sun * (1 - n * 0.85);
    lights.sun.color.copy(lightBase.sunColor).lerp(new Color('#ffb070'), dusk * 0.8).lerp(new Color('#9fb4ff'), n);
  }
  if (lights.hemi) {
    lights.hemi.intensity = lightBase.hemi * (1 - n * 0.72);
    lights.hemi.color.copy(lightBase.hemiSky).lerp(new Color('#ffcf9a'), dusk * 0.35).lerp(new Color('#2c3c6e'), n);
    lights.hemi.groundColor.copy(lightBase.hemiGround).lerp(new Color('#1c1a24'), n);
  }
  u.uSunColor.value.set('#fff0dd').lerp(new Color('#ffb070'), dusk * 0.8).lerp(new Color('#8fa4e8'), n).multiplyScalar(1 - 0.6 * n);
  u.uSkyZenith.value.set('#3d73c7').lerp(new Color('#3a5fa8'), dusk).lerp(new Color('#0b1430'), n);
  u.uSkyHorizon.value.set('#bfd6eb').lerp(new Color('#f2b27a'), dusk).lerp(new Color('#24345c'), n);
  u.uFogColor.value.set('#aec7e6').lerp(new Color('#c9a9a0'), dusk * 0.6).lerp(new Color('#1b2747'), n);
  u.uFogSunColor.value.set('#ffd9a6').lerp(new Color('#ff9a55'), dusk).lerp(new Color('#2a3a66'), n);
}

function num(k: string, d: number): number {
  const v = params.get(k);
  return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d;
}

function lookFromParams(): RiderLook {
  const proof = params.get('riderProof');
  const l: RiderLook = { ...(proof === 'wanderer' || proof === 'aerie' ? C02_LOOK : DEFAULT_RIDER) };
  const set = (k: keyof RiderLook, p: string, hex = false) => {
    const v = params.get(p);
    if (v) (l as unknown as Record<string, string>)[k] = hex ? `#${v.replace('#', '')}` : v;
  };
  set('outfit', 'outfit');
  set('hair', 'hair');
  set('headgear', 'headgear');
  set('scarf', 'scarf');
  set('cape', 'cape');
  set('build', 'build');
  set('skin', 'skin', true);
  set('hairColor', 'hairColor', true);
  set('outfitPrimary', 'primary', true);
  set('outfitSecondary', 'secondary', true);
  set('scarfColor', 'scarfColor', true);
  set('capeColor', 'capeColor', true);
  for (const key of ['chest', 'shoulderDrape', 'waist', 'armWraps', 'legWraps', 'footwear'] as const) set(key, key);
  set('armorColor', 'armorColor', true);
  set('leatherColor', 'leatherColor', true);
  for (const part of Object.keys(GARMENT_SLOTS) as (keyof typeof GARMENT_SLOTS)[]) {
    const value = params.get(`piece${part[0].toUpperCase()}${part.slice(1)}`);
    if (value) l.wardrobe = { ...l.wardrobe, [part]: value };
  }
  return l;
}

const SKINS = ['#f2d0b8', '#d09a74', '#8a5a3e', '#e6b896', '#6a4230', '#b07a56', '#f0dcc8'];
const HAIRS = ['#3a2a20', '#d8b070', '#1e1a18', '#a03a2a', '#6a4a30', '#e8d8b0'];

function lineupLooks(base: RiderLook): RiderLook[] {
  const which = params.get('lineup');
  const vary = (l: RiderLook, i: number): RiderLook => ({
    ...l,
    skin: params.get('skin') ? l.skin : SKINS[i % SKINS.length],
    hairColor: params.get('hairColor') ? l.hairColor : HAIRS[i % HAIRS.length],
  });
  const slot = (s: 'riderOutfit' | 'riderHair' | 'riderHeadgear' | 'riderScarf' | 'riderCape', key: keyof RiderLook) =>
    cosmeticsFor(s).map((o, i) => vary({ ...base, [key]: o.id } as RiderLook, i));
  switch (which) {
    case 'outfit':
      return slot('riderOutfit', 'outfit');
    case 'hair':
      return slot('riderHair', 'hair');
    case 'headgear':
      return slot('riderHeadgear', 'headgear');
    case 'scarf':
      return slot('riderScarf', 'scarf');
    case 'cape':
      return slot('riderCape', 'cape');
    case 'build':
      return (['slight', 'medium', 'broad'] as const).map((b, i) => vary({ ...base, build: b }, i));
    case 'action':
      return ACTIONS.map((_, i) => vary(base, i));
    default:
      return [base];
  }
}

/** A stand-in for the wyvern's back with a saddle Object3D like the real one's. */
function makeStandIn(game: Game, at: Vector3, yaw = 0): { saddle: Object3D; body: Mesh } {
  const hw = num('halfWidth', 0.55);
  const body = new Mesh(new CapsuleGeometry(hw, 3.2, 6, 16).rotateX(Math.PI / 2), toonMaterial({ color: '#3f7d5a' }));
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.copy(at);
  body.rotation.y = yaw;
  const saddle = new Object3D();
  saddle.position.set(0, hw + 0.1, 0.2);
  saddle.userData.halfWidth = hw;
  saddle.userData.gripOffset = new Vector3(0, 0.35, 0.45);
  body.add(saddle);
  const horn = new Mesh(new CapsuleGeometry(0.035, 0.22, 4, 8), toonMaterial({ color: '#7a3a2a' }));
  horn.position.set(0, hw + 0.4, 0.65);
  body.add(horn);
  // A saddle pad hugging the top of the back.
  const seat = new Mesh(new CapsuleGeometry(0.32, 0.35, 4, 16).rotateX(Math.PI / 2).scale(1.0, 0.22, 0.85), toonMaterial({ color: '#7a3a2a' }));
  seat.position.set(0, hw + 0.01, 0.15);
  body.add(seat);
  game.scene.add(body);
  body.updateMatrixWorld(true);
  return { saddle, body };
}

const arc = (a: Vector3, b: Vector3, t: number, h: number, out: Vector3) => {
  out.lerpVectors(a, b, t);
  out.y += Math.sin(Math.PI * t) * h;
  return out;
};
const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

let realHome: Vector3 | null = null;

/**
 * real=1: hold the game's wyvern in the air above the Roost in a chosen attitude (pitch=, lean=
 * banks it, crouch= tucks the wings) with air streaming past at speed=, and let the game's rider
 * sit its real saddle.
 */
function poseReal(game: Game, home: Vector3): void {
  const w = game.player.wyvernPose;
  const r = game.player.riderPose;
  const speed = num('speed', 30);
  const pitch = (num('pitch', 0) * Math.PI) / 180;
  const lean = num('lean', 0);
  const crouch = num('crouch', 0);
  const brace = num('brace', 0);
  const airborne = params.get('ground') !== '1';
  const sh = game.player.breed.standHeight;
  w.position.copy(home).add(_v.set(0, airborne ? 5 : sh, 0));
  w.orientation.setFromEuler(new Euler(pitch, 0, lean * 0.7, 'YXZ'));
  _a.set(0, 0, 1).applyQuaternion(w.orientation);
  w.velocity.copy(_a).multiplyScalar(airborne ? speed : 0);
  w.airborne = airborne;
  w.airspeed = airborne ? speed : 0;
  w.angularVelocity.set(0, 0, lean * 0.8);
  w.wingSpread = airborne ? 1 - 0.75 * crouch : 0.25;
  w.flapPhase = (time * 1.6) % 1;
  w.flapStrength = airborne && crouch < 0.5 && speed < 25 ? 0.6 : 0;
  w.flare = brace;
  w.stall = 0;
  w.gait = 'idle';
  w.groundSpeed = 0;
  w.groundY = airborne ? null : home.y;
  w.lookTarget.copy(w.position).addScaledVector(_a, 20);
  r.mounted = true;
  r.action = 'mounted';
  r.actionTime = time;
  r.lean = lean;
  r.crouch = crouch;
  r.brace = brace;
  r.velocity.set(0, 0, 0);
  r.airflow.copy(_a).multiplyScalar(airborne ? -speed : 0);
  r.position.copy(w.position);
  (game.player.riderPosition as Vector3).copy(w.position);
  const angle = ((num('angle', 120) + (params.get('turntable') === '1' ? time * 40 : 0)) * Math.PI) / 180;
  const dist = num('dist', 7);
  // Frame the saddle (where the rider is), not the wyvern's center.
  game.wyvern.saddle.getWorldPosition(_t).add(_v.set(0, num('height', 0.5), 0));
  const pos = _t.clone().add(_v.set(Math.sin(angle) * dist, num('camUp', 0.12) * dist, Math.cos(angle) * dist));
  game.cameraRig.setOverride({ position: pos, target: _t });
}

const rider: Showcase = {
  name: 'rider',
  description: 'The rider: looks, lineups, actions, mounted posture with cloth (see file header)',
  setup(game, p) {
    params = p;
    time = 0;
    actors.length = 0;
    realHome = null;
    if (typeof window !== 'undefined') (window as unknown as { __riderShow: unknown }).__riderShow = { params, actors, game };
    // A clean frame: no HUD unless asked for (hud=1).
    if (params.get('hud') !== '1' && typeof document !== 'undefined') {
      const ui = document.getElementById('ui');
      if (ui) ui.style.display = 'none';
    }
    if (params.get('real') === '1') {
      // The game's own rider on the real wyvern, posed by hand each frame.
      const look = lookFromParams();
      if (game.debug.riderProof) game.previewRiderLook(look); else game.setRiderLook(look);
      const L = game.world.layout;
      realHome = game.world.terrain.standingPoint(L.spawn.position[0] - 6, L.spawn.position[2] + 4, new Vector3());
      game.player.teleport(realHome.clone().add(new Vector3(0, 0, 0)), 0, 'landed');
      return;
    }
    game.rider.group.visible = false;
    game.wyvern.group.visible = false;
    const mounted = params.get('mounted') === '1';
    const L = game.world.layout;
    const t = game.world.terrain;
    const base = lookFromParams();
    const looks = lineupLooks(base);
    const isActions = params.get('lineup') === 'action';
    const spacing = mounted ? 2.2 : isActions ? 2.6 : 1.05;
    const origin = t.standingPoint(L.spawn.position[0] - 6, L.spawn.position[2] + 4, new Vector3());
    looks.forEach((look, i) => {
      const off = (i - (looks.length - 1) / 2) * spacing;
      const home = t.standingPoint(origin.x + off, origin.z, new Vector3());
      const action = isActions ? ACTIONS[i][0] : ((params.get('action') ?? (mounted ? 'mounted' : 'idle')) as RiderAction);
      const fixedT = params.get('t') !== null ? num('t', 0) : isActions ? ACTIONS[i][1] : null;
      let saddle: Object3D | null = null;
      let body: Mesh | null = null;
      if (mounted) {
        const s = makeStandIn(game, new Vector3(home.x, home.y + 1.6, home.z));
        saddle = s.saddle;
        body = s.body;
      } else if (action === 'mount' || action === 'dismount') {
        // The wyvern stands to the rider's right, facing the same way.
        const s = makeStandIn(game, new Vector3(home.x - 1.25, home.y + 1.25, home.z + 0.3));
        saddle = s.saddle;
        body = s.body;
      }
      const r = new Rider(look, { terrain: t, saddle: saddle ?? undefined, quality: game.renderer.quality,
        trial: game.debug.riderTrial,
        proof: game.debug.riderProof, proofMaps: game.debug.riderMaps, proofHighSize: game.debug.riderTexture,
        proofTextureLimit: game.renderer.gl.capabilities.maxTextureSize });
      game.scene.add(r.group);
      actors.push({ rider: r, pose: createRiderPose(), home, action, fixedT, saddle, body });
    });
    // Park the real player out of the way.
    game.player.teleport(new Vector3(origin.x + 40, origin.y + 2, origin.z - 40), 0, 'onFoot');
    lights = { sun: null, hemi: null };
    game.scene.traverse((o) => {
      if (o instanceof DirectionalLight && !lights.sun) lights.sun = o;
      if (o instanceof HemisphereLight && !lights.hemi) lights.hemi = o;
    });
    if (lights.sun) {
      lightBase.sun = lights.sun.intensity;
      lightBase.sunColor.copy(lights.sun.color);
    }
    if (lights.hemi) {
      lightBase.hemi = lights.hemi.intensity;
      lightBase.hemiSky.copy(lights.hemi.color);
      lightBase.hemiGround.copy(lights.hemi.groundColor);
    }
  },
  update(game, dt) {
    time += dt;
    if (params.get('sky') === 'standin') applySkyStandIn(game);
    if (realHome) {
      poseReal(game, realHome);
      return;
    }
    const mounted = params.get('mounted') === '1';
    const center = new Vector3();
    for (const a of actors) {
      const pose = a.pose;
      const action = a.action;
      const speed = num('speed', action === 'run' ? 7.5 : action === 'walk' ? 1.6 : mounted ? 30 : 0);
      pose.lean = num('lean', 0);
      pose.crouch = num('crouch', 0);
      pose.brace = num('brace', 0);
      if (mounted && a.body && a.saddle) {
        const pitch = (num('pitch', 0) * Math.PI) / 180;
        a.body.quaternion.setFromEuler(new Euler(pitch, 0, pose.lean * 0.6, 'YXZ'));
        a.body.updateMatrixWorld(true);
        _v.set(0, 0, 1).applyQuaternion(a.body.quaternion);
        pose.airflow.copy(_v).multiplyScalar(-speed);
        pose.velocity.set(0, 0, 0);
        pose.mounted = true;
        pose.action = 'mounted';
        pose.actionTime = time;
        a.saddle.getWorldPosition(pose.position);
        a.rider.update(dt, pose, a.saddle);
        center.add(a.body.position);
        continue;
      }
      pose.mounted = false;
      pose.velocity.set(0, 0, 0);
      pose.yaw = (num('yaw', 0) * Math.PI) / 180;
      pose.position.copy(a.home);
      const dur =
        action === 'mount' ? P.mountTime + 1.2 : action === 'dismount' ? P.dismountTime + 1.2 : action === 'wave' ? P.waveTime + 0.6 : action === 'jump' ? 0.62 : action === 'fall' ? 3 : action === 'land' ? 0.8 : 1e9;
      const tt = params.get('t') !== null ? num('t', 0) : a.fixedT !== null ? a.fixedT : time % dur;
      pose.action = action;
      pose.actionTime = tt;
      if (action === 'walk' || action === 'run') {
        // Laps along a line, turning at each end.
        const lap = 14;
        const s = ((time * speed) % (2 * lap)) - lap;
        const dir = s < 0 ? 1 : -1;
        const along = s < 0 ? s + lap / 2 : lap / 2 - s;
        pose.position.copy(a.home).add(_v.set(0, 0, along));
        game.world.terrain.standingPoint(pose.position.x, pose.position.z, pose.position);
        pose.velocity.set(0, 0, dir * speed);
        pose.yaw = dir > 0 ? 0 : Math.PI;
        pose.actionTime = time;
      } else if (action === 'jump') {
        pose.velocity.y = P.jumpSpeed - P.footGravity * tt;
        pose.position.y += P.jumpSpeed * tt - 0.5 * P.footGravity * tt * tt;
        if (pose.velocity.y < 0) pose.action = 'fall';
        if (pose.position.y < a.home.y) {
          pose.position.y = a.home.y;
          pose.action = 'idle';
          pose.velocity.y = 0;
        }
      } else if (action === 'fall') {
        pose.velocity.set(0, -Math.min(45, 2 + P.footGravity * tt), 1.5);
        pose.position.y += 1.4;
      } else if ((action === 'mount' || action === 'dismount') && a.saddle) {
        a.saddle.getWorldPosition(_b);
        if (action === 'mount') {
          const k = tt / P.mountTime;
          if (k < 1) {
            _a.copy(_b).addScaledVector(_v.set(0, 1, 0), -P.riderHip);
            arc(a.home, _a, smooth(k), 1.1, pose.position);
            pose.mounted = k >= 0.75;
          } else {
            pose.action = 'mounted';
            pose.actionTime = tt - P.mountTime;
            pose.mounted = true;
            pose.position.copy(_b);
          }
        } else {
          if (tt < 0.6) {
            pose.action = 'mounted';
            pose.mounted = true;
            pose.position.copy(_b);
          } else if (tt - 0.6 < P.dismountTime) {
            const kk = (tt - 0.6) / P.dismountTime;
            pose.action = 'dismount';
            pose.actionTime = tt - 0.6;
            _a.copy(a.home).addScaledVector(_v.set(0, 1, 0), P.riderHip);
            arc(_b, _a, kk, 0.5, pose.position);
            pose.position.y -= P.riderHip * smooth(kk);
          } else {
            pose.action = 'idle';
            pose.actionTime = tt - 0.6 - P.dismountTime;
          }
        }
      }
      // Air: the world's wind (or wind=x,z) minus the rider's own motion.
      const w = params.get('wind');
      const wv = w ? w.split(',').map(Number) : [globalUniforms.uWind.value.x, globalUniforms.uWind.value.z];
      pose.airflow.set(wv[0] || 0, 0, wv[1] || 0).sub(pose.velocity);
      a.rider.update(dt, pose, pose.mounted ? a.saddle : null);
      // Track walkers and runners; everything else holds the frame.
      center.add(action === 'walk' || action === 'run' ? _a.copy(a.home).setZ(pose.position.z) : a.home);
    }
    center.multiplyScalar(1 / Math.max(1, actors.length));
    // Camera.
    const n = actors.length;
    const angle = ((num('angle', mounted ? 120 : 20) + (params.get('turntable') === '1' ? time * 40 : 0)) * Math.PI) / 180;
    const wide = params.get('lineup') === 'action' ? 2.6 : 1.05;
    const dist = num('dist', mounted ? 3 + n * 1.2 : n > 1 ? 1.2 + n * wide * 0.85 : 3.2);
    const focusHead = params.get('focus') === 'head';
    const h = num('height', focusHead ? 1.62 : mounted ? 1.0 : 1.05);
    _t.copy(center).add(_v.set(0, h, 0));
    const pos = _t.clone().add(_v.set(Math.sin(angle) * dist, (mounted ? 0 : 0.25) + num('camUp', mounted ? 0.05 : 0.15) * dist, Math.cos(angle) * dist));
    game.cameraRig.setOverride({ position: pos, target: _t });
  },
};

export default rider;
