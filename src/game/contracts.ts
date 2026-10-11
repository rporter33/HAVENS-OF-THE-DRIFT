// The interface every system implements and the services Game hands them. Game.ts is the only
// place systems are constructed and wired; modules talk to each other through these interfaces
// and the event bus, never by importing each other's internals.

import type { Group, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { GameEventBus } from '../core/events';
import type {
  BreedId,
  BreedStats,
  CosmeticSlot,
  Collider,
  FlightEnvironment,
  FlightState,
  InputDevice,
  InputFrame,
  Medal,
  PlayerMode,
  RaceKind,
  RaceRecord,
  ResearchBranch,
  RiderLook,
  RiderPose,
  Settings,
  WeatherKind,
  WyvernLook,
  VentariSiteAnchor,
  WyvernPose,
} from '../core/types';
import type { Renderer } from '../render/renderer';
import type { QualityProfile } from '../render/quality';
import type { Terrain } from '../world/terrain';
import type { WorldLayout } from '../world/layout';
import type { SkyLance } from '../traversal/SkyLance';
import type { AirBoost } from '../traversal/air';

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

export interface InputSystem {
  /** Read devices once per rendered frame. Edge-triggered presses are true for this frame only. */
  poll(dt: number): InputFrame;
  readonly frame: InputFrame;
  readonly device: InputDevice;
  /** Gamepad vibration (no-op on keyboard or when rumble is off). 0..1 magnitudes. */
  rumble(strong: number, weak: number, durationMs: number): void;
  /** Request/release pointer lock for mouse-look (play mode only). */
  setPointerLock(on: boolean): void;
  /** Automation/debug: override the next frames' input. Pass null to return to devices. */
  setScripted(frame: Partial<InputFrame> | null): void;
  /** Gamepad display name, if any (for button glyph style: xbox / playstation / generic). */
  readonly padStyle: 'xbox' | 'playstation' | 'generic' | null;
  /** Optional: true while the mouse is captured for look (the HUD hides "click to look around"). */
  readonly pointerLocked?: boolean;
  /** Optional: true while play wants the mouse captured (the HUD shows "click to look around"). */
  readonly pointerLockWanted?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Weather and sky
// ---------------------------------------------------------------------------------------------

export interface WeatherSystem extends Pick<FlightEnvironment, 'windAt'> {
  readonly kind: WeatherKind;
  /** Prevailing wind (m/s, world). */
  readonly wind: Vector3;
  /** 0..1 */
  readonly rain: number;
  readonly mist: number;
  readonly cloudCover: number;
  set(kind: WeatherKind, immediate?: boolean): void;
  update(dt: number, camera: PerspectiveCamera, focus: Vector3): void;
  /**
   * Optional: rising air at the focus from thermals and ridge lift (m/s, + up), smoothed a
   * little, for a HUD vario or an audio cue. 0 when absent.
   */
  readonly lift?: number;
  /**
   * Optional: 0..1 how close the focus is to (and into) the storm at the world's edge that turns
   * flyers back: 0 inside the archipelago, rising over the last ~250 m before the boundary radius,
   * 1 well into it. For a one-time "the winds turn you back" notice.
   */
  readonly boundary?: number;
}

export interface SkySystem {
  /** 0..1, 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay: number;
  /** Direction toward the sun (normalized, may be below the horizon). */
  readonly sunDirection: Vector3;
  /** 0 day … 1 night. */
  readonly night: number;
  setTimeOfDay(t: number): void;
  /**
   * Advance the day, move lights (the shadow camera follows `focus`), update shared uniforms,
   * sky dome, clouds and cloud sea.
   */
  update(dt: number, camera: PerspectiveCamera, focus: Vector3, settings: Settings): void;
  setQuality(q: QualityProfile): void;
  /** 0..1 how deep the camera is inside a cloud puff (drives the grade's cloud veil). */
  cloudVeilAt(p: Vector3): number;
}

// ---------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------

export interface WorldSystem {
  readonly terrain: Terrain;
  readonly layout: WorldLayout;
  readonly group: Group;
  /** Vegetation LOD, grass streaming around `focus`, animated water. */
  update(dt: number, camera: PerspectiveCamera, focus: Vector3): void;
  setQuality(q: QualityProfile): void;
}

/**
 * Vegetation, water and structures on top of the islands (world/dressing). Visual, except for
 * the optional collision hints below.
 */
export interface DressingSystem {
  readonly group: Group;
  /**
   * Collision shapes of everything built (building and roof boxes, tower and post cylinders, soft
   * hay and cloth). Widened from cylinders only: check `kind` (absent = cylinder).
   */
  readonly colliders: readonly Collider[];
  /**
   * Walkable built surfaces that the terrain doesn't cover (the Roost's launch deck juts out over
   * the void): the deck top under (x, z) at or below fromY + 2, or null.
   */
  deckAt(x: number, z: number, fromY: number): { y: number; surface: 'wood' | 'stone' } | null;
  /** One anchor per Ventari site, in registry order (sites the island layout can't fit are absent). */
  readonly ventariSites?: readonly VentariSiteAnchor[];
  update(dt: number, camera: PerspectiveCamera, focus: Vector3): void;
  setQuality(q: QualityProfile): void;
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

export interface PlayerSystem {
  readonly skyLance?: SkyLance | null;
  readonly airBoost?: AirBoost;
  readonly lanceInteraction?: 'hold' | 'toggle';
  readonly windlineHoldAction?: 'leap' | 'recall' | null;
  readonly windlineHoldProgress?: number;
  readonly mode: PlayerMode;
  readonly breed: BreedStats;
  /** Physics state of the wyvern while flying (also valid, if stale, on the ground). */
  readonly flight: FlightState;
  /** Interpolated, render-ready poses. Updated in update(). */
  readonly wyvernPose: WyvernPose;
  readonly riderPose: RiderPose;
  /** Where the rider is standing / sitting (world), for prompts and pickups. */
  readonly riderPosition: Vector3;
  /** Physics position at the end of the previous fixed step (for swept checks like rings). */
  readonly prevPosition: Vector3;
  /** Current physics position (the thing that flies through rings). */
  readonly position: Vector3;
  setBreed(id: BreedId): void;
  /**
   * Fixed-rate simulation. `cameraYaw` (radians, facing = (sin, 0, cos)) makes on-foot movement
   * camera-relative.
   */
  fixedUpdate(dt: number, input: InputFrame, cameraYaw: number): void;
  /** Per-frame: interpolate poses with alpha (0..1 between the last two fixed steps). */
  update(dt: number, alpha: number): void;
  /** Teleport, e.g. to a race start. */
  teleport(position: Vector3, yaw: number, mode: 'flying' | 'landed' | 'onFoot', speed?: number): void;
  /** True while gameplay input is accepted (not during transitions/fades). */
  readonly controllable: boolean;
  /** 0..1 full-screen fade the player state wants (respawn, catch-on-fall). */
  readonly fade: number;
  /**
   * The Rested bonus earned by landing and resting on an island: 0..1 of its duration remaining
   * (0 = not rested). The HUD shows a mark while it lasts. Optional until the player implements it.
   */
  readonly rested?: number;
}

// ---------------------------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------------------------

export type CameraMode = 'follow' | 'title' | 'stable' | 'photo';

export interface CameraSystem {
  readonly camera: PerspectiveCamera;
  /** Horizontal facing of the camera (radians, facing = (sin, 0, cos)). */
  readonly yaw: number;
  mode: CameraMode;
  update(dt: number, input: InputFrame, player: PlayerSystem): void;
  /** Trauma-style shake, 0..1 added (decays). Ignored with reduced motion. */
  shake(amount: number): void;
  /** Snap behind the player without smoothing (after teleports). */
  snap(player: PlayerSystem): void;
  /** Debug: hold the camera at a fixed pose (null releases). */
  setOverride(pose: { position: Vector3; target: Vector3 } | null): void;
  /**
   * Stable screen: frame the wyvern, the rider, or both (default). The UI calls this as the
   * player moves between wyvern and rider customization; the camera glides to the new subject.
   */
  setStableFocus?(subject: 'wyvern' | 'rider' | 'both'): void;
}

// ---------------------------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------------------------

export interface WyvernRenderable {
  readonly group: Group;
  /**
   * Rider attaches here; +Z forward, +Y up, origin on the saddle seat (where the rider's hips
   * rest). `saddle.userData.halfWidth` holds the body's half-width at the seat (m) so the rider
   * can straddle it; `saddle.userData.gripOffset` (Vector3, saddle space) is where the hands hold.
   */
  readonly saddle: Object3D;
  setLook(look: WyvernLook): void;
  update(dt: number, pose: WyvernPose): void;
  /** World-space wingtip positions (for vortex trails). */
  getWingtips(outLeft: Vector3, outRight: Vector3): void;
  /** World-space head/mouth position (for breath puffs, look-at). */
  getHead(out: Vector3): Vector3;
  dispose(): void;
}

export interface RiderRenderable {
  readonly group: Group;
  setLook(look: RiderLook): void;
  /** When pose.mounted, sit on `saddle` (its world matrix); otherwise stand at pose.position. */
  update(dt: number, pose: RiderPose, saddle: Object3D | null): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------------------------
// Races and progression
// ---------------------------------------------------------------------------------------------

export interface RingDef {
  position: [number, number, number];
  /** Direction you fly through it (normalized when used). */
  normal: [number, number, number];
  /** Inner radius you must pass within (m). */
  radius: number;
}

export interface RaceDef {
  id: string;
  name: string;
  kind: RaceKind;
  description: string;
  /** Difficulty 1..5 for the race list. */
  difficulty: number;
  /** Where the start gate hangs and the direction it faces. Flying through it arms the race. */
  start: { position: [number, number, number]; yaw: number };
  /** Ring courses: the rings in order. Sprints: one ring, the finish beacon. */
  rings: RingDef[];
  /** Medal times in ms. */
  medals: { gold: number; silver: number; bronze: number };
  /** Landmark near the start, for the race list. */
  landmark: string;
}

export interface RaceSystem {
  readonly defs: RaceDef[];
  /** Null when no race is running. */
  readonly activeId: string | null;
  readonly state: 'idle' | 'countdown' | 'running' | 'finished';
  /** Elapsed race time (ms) while running. */
  readonly elapsedMs: number;
  readonly nextRingIndex: number;
  /** Best time for the active race, if any. */
  readonly bestMs: number | null;
  /** Split delta vs best at the last ring (ms, negative = ahead), or null. */
  readonly lastDeltaMs: number | null;
  /** World position the HUD compass should point at: next ring, finish, or nearest start. */
  waypoint(out: Vector3): Vector3 | null;
  /** The race whose start gate is near this point (for a prompt), if any. */
  nearbyStart(p: Vector3): RaceDef | null;
  /** Place the player at the start and begin the countdown. */
  begin(raceId: string): void;
  restart(): void;
  abort(reason: 'quit' | 'restart' | 'respawn' | 'left-course'): void;
  fixedUpdate(dt: number, player: PlayerSystem): void;
  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem): void;
  setShowGhost(on: boolean): void;
  /**
   * Optional: forget everything remembered about past runs after the save was erased (bests, the
   * in-memory best ghost) and stand down any race. Game.resetProgress calls it.
   */
  resetProgress?(): void;
}

export interface SaveData {
  version: 1;
  wyvern: WyvernLook;
  rider: RiderLook;
  /** Cosmetic ids unlocked beyond the defaults. */
  unlocked: string[];
  /** Collected collectible ids. */
  collected: string[];
  races: Record<string, RaceRecord>;
  settings: Settings;
  /** Landmarks visited (for the collection screen and race list). */
  discovered: string[];
  /** Seconds played. */
  playTime: number;
  /** Whether the first-flight tutorial prompts have been dismissed. */
  tutorialDone: boolean;
  /**
   * Optional: ids of the onboarding tips already shown or learned (the UI's tutor; see
   * ui/tutor.ts). tutorialDone turns true once every first-flight tip is in here.
   */
  tips?: string[];
  /** Introductory shrine guidance; reading completion remains authoritative in research. */
  firstLeadGuide?: 'active' | 'skipped';
  /** M1 survey/observation ids and derived point cache (absent in older saves).
   * Existing finds remain in collected/discovered; loading recomputes points.
   */
  research?: { entries: string[]; points: Record<ResearchBranch, number> };
  /** The guided opening with Quintus: finished or skipped (absent = not yet). */
  prologueDone?: boolean;
}

export interface GhostRecording {
  raceId: string;
  breed: BreedId;
  look: WyvernLook;
  rider: RiderLook;
  timeMs: number;
  /** Sample rate in Hz. */
  rate: number;
  /** Packed samples: [x, y, z, qx, qy, qz, qw, flapPhase, flapStrength, wingSpread, flare] × n. */
  samples: Float32Array;
  /** Optional: race time (ms) at each ring of this run, for live split deltas against it. */
  splits?: number[];
}

export interface SaveStore {
  readonly data: SaveData;
  /** Persist soon (debounced). */
  save(): void;
  /** Persist now. */
  flush(): void;
  reset(): void;
  getGhost(raceId: string): Promise<GhostRecording | null>;
  putGhost(ghost: GhostRecording): Promise<void>;
  /**
   * Whether a cosmetic can be worn. `slot` disambiguates ids that several slots share ('long' is
   * a hair style and a scarf); without it the first catalog match is used.
   */
  isUnlocked(cosmeticId: string, slot?: CosmeticSlot): boolean;
  medalCount(medal: Exclude<Medal, 'none'>): number;
}

/** A relic as the collection screen and unlock requirements show it. */
export interface RelicInfo {
  id: string;
  name: string;
  /** A line or two of lore for the collection screen's lore card. */
  lore: string;
}

export interface CollectibleSystem {
  readonly total: { feathers: number; relics: number };
  readonly found: { feathers: number; relics: number };
  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem): void;
  /** Nearest uncollected collectible within range, for a subtle HUD shimmer hint. */
  nearestHint(p: Vector3, range: number): Vector3 | null;
  /**
   * Optional: every relic in the game (found or not; found = its id is in SaveData.collected).
   * The collection screen lists them with their lore, and locked cosmetics name the relic they
   * need. Without it the UI falls back to names derived from the relic ids.
   */
  readonly relics?: readonly RelicInfo[];
}

// ---------------------------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------------------------

export interface FxSystem {
  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem, wyvern: WyvernRenderable): void;
  setQuality(q: QualityProfile): void;
}

export interface AudioSystemApi {
  /** Must be called from a user gesture before audio can play. */
  unlock(): void;
  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem, weather: WeatherSystem, sky: SkySystem): void;
  applySettings(s: Settings): void;
  /** Music layer intensity 0..1 (races raise it). */
  setIntensity(v: number): void;
}

export type GameScreen = 'title' | 'play' | 'pause' | 'stable' | 'results' | 'loading';

/** What the UI can ask the game to do. */
export interface GameActions {
  startGame(): void;
  pause(): void;
  resume(): void;
  openStable(): void;
  closeStable(): void;
  beginRace(raceId: string): void;
  restartRace(): void;
  quitRace(): void;
  /** Keep this look: applies it, stores it in the save and persists. */
  setWyvernLook(look: WyvernLook): void;
  setRiderLook(look: RiderLook): void;
  /**
   * Optional: show a look without keeping it (Stable picks before Save): the models and the flight
   * breed change, the save does not. Commit with setWyvernLook / setRiderLook, or preview the
   * saved look again to put it back.
   */
  previewWyvernLook?(look: WyvernLook): void;
  previewRiderLook?(look: RiderLook): void;
  applySettings(s: Settings): void;
  resetProgress(): void;
  /** Optional: leave play (abandoning any race) and return to the title screen. */
  quitToTitle?(): void;
}

/** Read-only view of the game the UI renders from each frame. */
export interface GameView {
  /** Actual playable shrine anchor, shared with interaction and geometry. */
  tutorialShrine?: { x: number; y: number; z: number };
  screen: GameScreen;
  player: PlayerSystem;
  races: RaceSystem;
  collectibles: CollectibleSystem;
  save: SaveStore;
  input: InputSystem;
  sky: SkySystem;
  weather: WeatherSystem;
  camera: CameraSystem;
  /** Context prompt the HUD should show (e.g. "Hold LT to flare"), or null. */
  prompt: { action: PromptAction; text: string } | null;
  /**
   * Optional: what the settings screen shows of the renderer. A quality change can hold the view
   * on its last frame for a few seconds while shaders link (recompilingQuality); the screen says
   * "Applying…" meanwhile.
   */
  renderer?: { readonly recompilingQuality: boolean };
}

/**
 * Something on foot the rider can use: a Ventari inscription to read, Quintus to talk to, the Codex
 * to inspect. Registered with Game.interactables; the nearest one in reach replaces the on-foot
 * prompt (mounting and the Stable door keep priority) and interact calls it.
 */
export interface Interactable {
  /** Unique id ('read:gullrest-shrine', 'talk:quintus', 'inspect:codex'). Re-adding replaces. */
  id: string;
  /** Where it stands (read every frame, so a moving one can update it in place). */
  readonly position: Vector3;
  /** Reach in metres (horizontal; height within ±3 m). */
  radius: number;
  /** The prompt shown while in reach. Keep one constant object per entry (no per-frame allocation). */
  prompt: { action: 'interact'; text: string };
  /** Optional gate (e.g. Quintus is busy flying). */
  enabled?: () => boolean;
  onInteract(): void;
}

export interface InteractableRegistry {
  add(item: Interactable): void;
  remove(id: string): void;
  /** The closest enabled entry whose reach contains `p`, or null. */
  nearest(p: Vector3): Interactable | null;
}

/**
 * What the prompt's glyph shows. Most are buttons (drawn from the control scheme for the active
 * device). 'rest' is advice with no button to press (winded: glide or land to recover); the HUD
 * draws the wing emblem for it. Any action without a scheme binding is drawn that way.
 */
export type PromptAction = 'flap' | 'flare' | 'tuck' | 'interact' | 'mount' | 'dismount' | 'jump' | 'restart' | 'stable' | 'rest';

export interface UiSystem {
  readonly screen: GameScreen;
  setScreen(screen: GameScreen): void;
  /** Per-frame: menus consume input when open; HUD reads the view. */
  update(dt: number, view: GameView): void;
  /** True if the UI consumed this frame's input (menus open). */
  readonly capturesInput: boolean;
}

/** Shared services handed to systems at construction. */
export interface Services {
  scene: Scene;
  renderer: Renderer;
  events: GameEventBus;
  quality: QualityProfile;
  settings: () => Settings;
}
