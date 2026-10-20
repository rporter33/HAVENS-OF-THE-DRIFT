import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3, type Material, type Scene } from 'three';
import type { Showcase } from '../showcase';
import type { Game } from '../../game/Game';
import { Dragon, type DragonLod } from '../../creatures/dragon/Dragon';
import { ELDER_DRAGONS } from '../../creatures/dragon/catalog';
import { HUE_SHIFT_MAX_DEG, type DragonLook } from '../../creatures/dragon/look';
import { loadWhiteDragonAssets, type WhiteDragonAssets } from '../../creatures/dragon/load';
import { sunDirection } from '../../sky/sunPath';
import { toonMaterial } from '../../render/painterly';

/**
 * ?view=white-dragon — the white clan's elder dragon at rest (gate G12b, dev-only): render 08's pose
 * on a stand-in tower-top platform, with its own driver and the idle life (creatures/dragon/).
 * The dragon's files load from the dev server only; a production build shows nothing.
 *
 *   cam=r08|three|side|front|back|top|low|head|eye|wings   camAz= camEl= camDist= (deg, m; relative
 *                        to the dragon's heading, 0 = in front, 90 = its left), fov= (vertical deg;
 *                        render 08's narrower lens unless given: fov=62 is the game's own)
 *   pose=bind            the bind pose instead (standing, wings spread flat): the LODs' wings from above
 *   turntable=1 spin=deg/s
 *   look=camera|player|none|x,y,z   what the head follows (none: a slow wandering gaze)
 *   idle=0               the bare pose: no breathing, blinks, settles or drift; whiskers at rest
 *   blink=s,s            cue blinks at showcase times (any cue holds the natural ones off)
 *   seed=n               the idle's timed events
 *   hue=deg              the hue shift (±8°, Q48b)
 *   lineup=hue [hues=-8,-4,0,4,8]   white dragons across the hue shift, side by side
 *   lod=0|1|2|auto       force a LOD (default auto: by the camera's distance)
 *   rider=beside         the player's rider on foot at the dragon's left shoulder, as the elder
 *                        stands in render 08 (scale); look=player then follows the rider
 *   tod=0.66             late afternoon (at 0.7 the low sun ahead of render 08's camera hazes the
 *                        picture orange); weather= as usual
 *   heading=deg          the dragon's heading, which otherwise puts the low sun ahead of it and to
 *                        its right, as in render 08
 *
 * window.__whiteDragon: { ready, dragons, restage(query) } for capture scripts
 * (scripts/white-dragon-capture.mjs).
 */

/** Where the stand-in tower's top stands: 330 m up, the tower rising from an island south of the Roost. */
const SITE = new Vector3(60, 330, 190);
/**
 * The tower top's radius (m) and its center in the dragon's frame: broad, as render 08's, with the
 * dragon lying toward its near rim (off its left shoulder, where render 08's camera stands).
 */
const PLATFORM_R = 16;
const PLATFORM_C = new Vector3(-7.4, 0, -7.2);
/** The lineup's terrace: the dragons' footprint's middle, and its half-depth. */
const TERRACE_C = new Vector3(1.8, 0, -0.9);
const TERRACE_R = 11;
/** Lineup spacing (m) across the dragons' heading. */
const LINEUP_GAP = 10;
/**
 * Render 08's camera, from the dragon's shoulder: off its left front (azimuth from the heading),
 * a little above the platform and looking near level past the shoulder; and its lens (vertical
 * degrees), narrower than the game's.
 */
const R08 = { fov: 38, az: 55, el: 5, dist: 13.5, target: new Vector3(1.0, 2.2, -0.6) };

interface State {
  game: Game;
  params: URLSearchParams;
  assets: WhiteDragonAssets | null;
  dragons: Dragon[];
  stage: Group;
  materials: Material[];
  heading: number;
  time: number;
  fov: number | null;
  ready: boolean;
}

let state: State | null = null;
const _cam = new Vector3();
const _tgt = new Vector3();
const _v = new Vector3();

function num(p: URLSearchParams, name: string, fallback: number): number {
  const v = p.get(name);
  return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
}

function elderLook(hue: number): DragonLook {
  const base = ELDER_DRAGONS.white!;
  return { ...base, parts: { ...base.parts }, hueShift: Math.max(-HUE_SHIFT_MAX_DEG, Math.min(HUE_SHIFT_MAX_DEG, hue)) };
}

/** The dragon's heading (world yaw) that puts the sun ahead and to its right, as render 08 has it. */
function sunHeading(tod: number): number {
  const s = sunDirection(tod, _v);
  return Math.atan2(s.x, s.z) + (70 * Math.PI) / 180;
}

/** A stand-in tower top: a limestone drum with a blue frieze, and a terrace for the lineup. */
function buildStage(scene: Scene, lineup: number, heading: number, materials: Material[]): Group {
  const g = new Group();
  g.name = 'white-dragon-stage';
  const stone = toonMaterial({ color: '#d8d1c2' });
  const frieze = toonMaterial({ color: '#7fa8c4' });
  const rim = toonMaterial({ color: '#cfc6b4' });
  materials.push(stone, frieze, rim);
  if (lineup <= 1) {
    // The drum's top is the floor (y = 0); a coping course and a blue frieze run round its side.
    const top = new Mesh(new CylinderGeometry(PLATFORM_R, PLATFORM_R * 0.9, 40, 72, 1), stone);
    top.position.set(PLATFORM_C.x, -20, PLATFORM_C.z);
    const coping = new Mesh(new CylinderGeometry(PLATFORM_R + 0.12, PLATFORM_R + 0.12, 0.6, 72, 1, true), rim);
    coping.position.set(PLATFORM_C.x, -0.32, PLATFORM_C.z);
    const band = new Mesh(new CylinderGeometry(PLATFORM_R + 0.06, PLATFORM_R + 0.06, 0.9, 72, 1, true), frieze);
    band.position.set(PLATFORM_C.x, -1.5, PLATFORM_C.z);
    g.add(top, coping, band);
  } else {
    const w = (lineup - 1) * LINEUP_GAP + 2 * TERRACE_R;
    const slab = new Mesh(new BoxGeometry(w, 6, 2 * TERRACE_R + 4), stone);
    slab.position.set(TERRACE_C.x, -3, TERRACE_C.z);
    const band = new Mesh(new BoxGeometry(w + 0.1, 0.9, 2 * TERRACE_R + 4.1), frieze);
    band.position.set(TERRACE_C.x, -1.5, TERRACE_C.z);
    g.add(slab, band);
  }
  for (const m of g.children) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  g.position.copy(SITE);
  g.rotation.y = heading;
  scene.add(g);
  return g;
}

/** The study lens (vertical degrees) the named cameras share with render 08's; the game's is 62. */
const STUDY_FOV = 38;

/** Named cameras: azimuth and elevation (deg, from the heading), distance (m), and the point aimed at (dragon frame). */
const CAMS: Record<string, { az: number; el: number; dist: number; target: [number, number, number] }> = {
  three: { az: 125, el: 12, dist: 22, target: [1.5, 2.2, -1] },
  side: { az: 90, el: 6, dist: 27, target: [1.5, 2.2, -0.6] },
  front: { az: 0, el: 8, dist: 20, target: [0.4, 2.6, 1] },
  back: { az: 180, el: 14, dist: 24, target: [1.5, 2.4, -1.5] },
  top: { az: 150, el: 72, dist: 32, target: [1.2, 1, -1] },
  low: { az: 60, el: -4, dist: 16, target: [1, 2, 1] },
  head: { az: 55, el: 6, dist: 8, target: [0, 4.3, 2.8] },
  eye: { az: 70, el: 4, dist: 3.2, target: [0.25, 4.45, 3.2] },
  wings: { az: 120, el: 24, dist: 17, target: [1.8, 4, -1.8] },
};

/** Camera azimuth, elevation (deg, relative to the heading), distance (m), target and lens for cam=. */
function camAngles(p: URLSearchParams, lineup: number): { az: number; el: number; dist: number; target: Vector3; fov: number | null } {
  const name = p.get('cam') ?? 'r08';
  let { az, el, dist } = name === 'r08' ? R08 : CAMS[name] ?? CAMS.three;
  const target = name === 'r08' ? R08.target.clone() : new Vector3(...(CAMS[name] ?? CAMS.three).target);
  if (lineup > 1) {
    // Square on to the line, far enough to see every dragon.
    az = p.has('camAz') ? az : 18;
    el = p.has('camEl') ? el : 12;
    dist = Math.max(dist, (lineup - 1) * LINEUP_GAP * 1.1 + 16);
    target.set(TERRACE_C.x, 2.4, 0);
  }
  return { az: num(p, 'camAz', az), el: num(p, 'camEl', el), dist: num(p, 'camDist', dist), target, fov: num(p, 'fov', name === 'r08' ? R08.fov : STUDY_FOV) };
}

/** rider=beside: the player's rider on foot at the dragon's left shoulder, facing the camera. */
function standBeside(game: Game, d: Dragon, camYaw: number): void {
  const r = game.player.riderPose;
  d.group.localToWorld(_v.set(1.55, 0, 1.25));
  r.mounted = false;
  r.position.copy(_v);
  r.yaw = camYaw;
  r.velocity.set(0, 0, 0);
  r.action = 'idle';
  r.lean = r.crouch = r.brace = 0;
  r.airflow.set(0, 0, 0);
}

function setup(game: Game, p: URLSearchParams): void {
  teardown(game);
  const lineupHues = p.get('lineup') === 'hue' ? (p.get('hues') ?? '-8,-4,0,4,8').split(',').map(Number).filter(Number.isFinite) : [];
  const count = Math.max(1, lineupHues.length);
  if (p.has('tod')) game.debug.tod = Number(p.get('tod'));
  else if (game.debug.tod === undefined) game.debug.tod = 0.66;
  const heading = p.has('heading') ? (num(p, 'heading', 0) * Math.PI) / 180 : sunHeading(game.debug.tod ?? 0.66);
  game.debug.freeze = true;
  // The player's own wyvern is parked out of sight, and the rider too unless it stands beside.
  game.player.teleport(SITE.clone().add(new Vector3(0, 2, 0)), heading, 'landed', 0);
  game.wyvern.group.visible = false;
  game.rider.group.visible = p.get('rider') === 'beside' && count === 1;
  const materials: Material[] = [];
  const stage = buildStage(game.scene, count, heading, materials);
  const s: State = { game, params: p, assets: null, dragons: [], stage, materials, heading, time: num(p, 't0', 0), fov: null, ready: false };
  state = s;
  publish(s);
  loadWhiteDragonAssets()
    .then((assets) => {
      if (state !== s) return;
      s.assets = assets;
      build(s, lineupHues);
    })
    .catch((e: unknown) => {
      console.warn(`?view=white-dragon: ${(e as Error).message ?? e}`);
    });
  // Render 08's lens: the camera rig applies the game's field of view after every showcase update,
  // so the showcase's own goes on just before the scene renders.
  game.scene.onBeforeRender = () => {
    if (!state || state.fov === null) return;
    const c = game.camera;
    if (c.fov !== state.fov) {
      c.fov = state.fov;
      c.updateProjectionMatrix();
    }
  };
}

function build(s: State, hues: number[]): void {
  const p = s.params;
  const list = hues.length ? hues : [num(p, 'hue', 0)];
  const still = p.get('idle') === '0';
  const blinks = (p.get('blink') ?? '').split(',').filter((v) => v !== '' && Number.isFinite(Number(v))).map(Number);
  // The dragons' left (body +X) in the world; the lineup runs from the left of the picture.
  const left = new Vector3(Math.cos(s.heading), 0, -Math.sin(s.heading));
  list.forEach((hue, i) => {
    const d = new Dragon(s.assets!, { look: elderLook(hue), seed: num(p, 'seed', 1) + i, blinks: blinks.length ? blinks : undefined, still, bind: p.get('pose') === 'bind' });
    d.group.position.copy(SITE).addScaledVector(left, -(i - (list.length - 1) / 2) * LINEUP_GAP);
    d.group.rotation.y = s.heading;
    const lod = p.get('lod');
    if (lod === '0' || lod === '1' || lod === '2') d.setLod(Number(lod) as DragonLod);
    s.game.scene.add(d.group);
    s.dragons.push(d);
  });
  s.ready = true;
  publish(s);
}

/** The capture handle (window.__whiteDragon), written when the staging or its readiness changes. */
function publish(s: State): void {
  (window as unknown as { __whiteDragon?: unknown }).__whiteDragon = {
    ready: s.ready,
    dragons: s.dragons,
    restage: (q: string) => {
      whiteDragonShowcase.setup(s.game, new URLSearchParams(q));
    },
  };
}

function teardown(game: Game): void {
  if (!state) return;
  for (const d of state.dragons) d.dispose();
  state.stage.removeFromParent();
  state.stage.traverse((o) => (o as Mesh).geometry?.dispose());
  for (const m of state.materials) m.dispose();
  game.scene.onBeforeRender = () => {};
  game.cameraRig.setOverride(null);
  state = null;
}

const whiteDragonShowcase: Showcase = {
  name: 'white-dragon',
  description: 'The white elder dragon at rest (G12b, dev-only): cam=r08|three|side|front|back|top|low|head|eye|wings, look=, lineup=hue, lod=, hue=, idle=0, pose=bind',
  setup,
  update(game, dt) {
    const s = state;
    if (!s) return;
    s.time += dt;
    const p = s.params;
    const lineup = s.dragons.length;
    const cam = camAngles(p, Math.max(lineup, p.get('lineup') === 'hue' ? 5 : 1));
    s.fov = cam.fov;
    const main = s.dragons[0] ?? null;
    let az = cam.az;
    if (p.get('turntable') === '1') az += s.time * num(p, 'spin', 20);
    const a = s.heading + (az * Math.PI) / 180;
    const e = (cam.el * Math.PI) / 180;
    _tgt.copy(cam.target).applyAxisAngle(_v.set(0, 1, 0), s.heading).add(SITE);
    _cam.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(cam.dist).add(_tgt);
    game.cameraRig.setOverride({ position: _cam, target: _tgt });
    if (p.get('rider') === 'beside' && main) standBeside(game, main, a);
    if (!s.ready) return;
    const look = p.get('look') ?? 'camera';
    let target: Vector3 | null = null;
    if (look === 'camera') target = _cam;
    else if (look === 'player') {
      // The rider's eyes, about 1.6 m up.
      target = _v.copy(game.player.riderPose.position);
      target.y += 1.6;
    }
    else if (look !== 'none') {
      const xyz = look.split(',').map(Number);
      if (xyz.length === 3 && xyz.every(Number.isFinite) && main) target = main.group.localToWorld(_v.set(xyz[0], xyz[1], xyz[2]));
    }
    for (const d of s.dragons) d.update(dt, target, _cam);
  },
  dispose(game) {
    teardown(game);
  },
};

export default whiteDragonShowcase;
