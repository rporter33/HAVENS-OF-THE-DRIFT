// Shared contracts between modules. Everything a system needs to know about another system goes
// through a type in this file, so modules can be built and tested independently.
//
// Units: meters, seconds, radians. World axes: +Y up, the cloud sea at y = 0.
//
// Body frame (wyvern, rider, anything that flies or walks): forward = +Z, up = +Y, left = +X, so
// the RIGHT wing points along -X. This matches Three.js's Object3D.lookAt for non-camera objects
// (it aims +Z at the target). Cameras look down -Z; the camera rig handles that difference.
// Body-frame angular velocity follows the right-hand rule about those axes:
//   +x pitches the nose DOWN, +y yaws the nose LEFT, +z rolls the right wing DOWN (banks right).

import type { Quaternion, Vector3 } from 'three';

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

export type InputDevice = 'gamepad' | 'keyboard';

/** Continuous flight controls after deadzones, curves and invert settings are applied. */
export interface FlightInput {
  /** -1..1, +1 = nose up (already respects the invert-pitch setting). */
  pitch: number;
  /** -1..1, +1 = bank right. */
  roll: number;
  /** -1..1, +1 = yaw right (rudder). */
  yaw: number;
  /** Held: beat the wings. Each beat costs stamina. 0..1 so a trigger can modulate strength. */
  flap: number;
  /** Held: fold the wings into a dive. 0..1. */
  tuck: number;
  /** Held: pitch the wings up as an air brake; also how you land. 0..1. */
  flare: number;
}

/** On-foot controls; move is camera-relative (x right, y forward), magnitude 0..1. */
export interface FootInput {
  moveX: number;
  moveY: number;
  sprint: boolean;
}

/** Edge-triggered buttons: true only on the frame the button went down. */
export interface InputPresses {
  /** Windline equipment actions; ignored unless the Sky Lance is enabled. */
  lance?: boolean;
  lanceRelease?: boolean;
  recoverLance?: boolean;
  /** Fresh airborne LT press: pull/boost only, never an ordinary ground jump. */
  airAction?: boolean;
  /** A / Space / Enter in menus. On foot: jump. */
  confirm: boolean;
  /** B / Escape-in-menus. */
  back: boolean;
  /** Interact / mount / dismount (Y / F). */
  interact: boolean;
  /** Pause menu (Start / Esc). */
  pause: boolean;
  /** Restart current race (View/Back / R). */
  restart: boolean;
  /** Jump on foot (A / Space). Same physical button as confirm during play. */
  jump: boolean;
  /** Menu navigation, also repeats while held. */
  navUp: boolean;
  navDown: boolean;
  navLeft: boolean;
  navRight: boolean;
  /** Tab switching in menus (LB / RB, Q / E). */
  tabPrev: boolean;
  tabNext: boolean;
  /** Recenter camera behind the wyvern (R3 / C). */
  recenter: boolean;
  /** Toggle photo mode / hide HUD (D-pad up / H). */
  toggleHud: boolean;
}

export interface InputFrame {
  device: InputDevice;
  /** Sampled world-space throw direction; presentation supplies it, fixed simulation consumes it. */
  aim?: Vector3;
  /** Held controls for independent rider traversal. */
  lanceHeld?: boolean;
  callHeld?: boolean;
  flight: FlightInput;
  foot: FootInput;
  /**
   * Camera look. For a stick: a rate in -1..1 per axis. For a mouse: accumulated pixels since
   * last frame (scaled by sensitivity). `lookIsRate` says which.
   */
  lookX: number;
  lookY: number;
  lookIsRate: boolean;
  /** True while the player is actively steering the camera (mouse moved / right stick off-center). */
  lookActive: boolean;
  /**
   * Camera zoom request this frame in mouse-wheel notches, + = zoom in. Mouse wheel always;
   * outside play (stable, menus) RT/LT also zoom at a steady rate. Optional: absent = 0.
   */
  zoom?: number;
  /** Held: jump / ascend on foot. */
  jumpHeld: boolean;
  pressed: InputPresses;
}

// ---------------------------------------------------------------------------------------------
// Wyvern breeds and flight
// ---------------------------------------------------------------------------------------------

export type BreedId = 'harrier' | 'skimmer' | 'galewing' | 'ironback';

/**
 * Physical description of a breed. The flight model derives everything from these numbers so
 * breeds differ in feel, not by multipliers bolted on afterwards.
 */
export interface BreedStats {
  id: BreedId;
  name: string;
  tagline: string;
  description: string;
  /** kg, wyvern + rider. */
  mass: number;
  /** m², fully spread. */
  wingArea: number;
  /** m tip to tip; also drives the model's proportions. */
  wingspan: number;
  /** Lift slope per radian of angle of attack. */
  liftSlope: number;
  /** Max lift coefficient before the wing stalls. */
  clMax: number;
  /** Critical angle of attack (radians) where the stall begins. */
  stallAngle: number;
  /** Zero-lift (parasitic) drag coefficient, wings spread. */
  cd0: number;
  /** Induced drag factor 1/(π·e·AR). */
  inducedK: number;
  /** Newtons of forward thrust a full downstroke produces at peak. */
  flapThrust: number;
  /** Newtons of extra lift a full downstroke produces at peak. */
  flapLift: number;
  /** Wingbeats per second while flapping. */
  flapRate: number;
  /**
   * Fraction of each beat spent on the downstroke (the power stroke), 0.5–0.65: big flyers drive
   * down for longer than they recover. The flight model's power curve and 'flap' event and the
   * wing animation share it. Optional: DEFAULT_DOWN_FRAC (flight/breeds.ts) when absent.
   */
  downFrac?: number;
  /** Stamina seconds of continuous flapping from full. */
  staminaSeconds: number;
  /** Stamina regained per second while not flapping (fraction of max). */
  staminaRegen: number;
  /** Body-axis angular acceleration authority, rad/s² at reference airspeed. */
  rollAuthority: number;
  pitchAuthority: number;
  yawAuthority: number;
  /** Angular damping (1/s). Higher = settles faster, feels "planted". */
  angularDamping: number;
  /** Max sustainable bank rate (rad/s). */
  maxRollRate: number;
  /** Walking/running speed on the ground (m/s). */
  groundSpeed: number;
  /**
   * Height of the body's center (the physics position) above the ground when standing (m). The
   * wyvern model is built so that, posed standing with its center this high, its feet touch the
   * ground. The player state machine uses it to place a landed wyvern.
   */
  standHeight: number;
  /** 0..1 display ratings for the stable UI (derived but hand-tuned for readability). */
  ratings: { speed: number; agility: number; glide: number; power: number; stamina: number };
}

/** Full physical state of a flying body. Owned by the flight model. */
export interface FlightState {
  position: Vector3;
  velocity: Vector3;
  orientation: Quaternion;
  /** Body-frame angular velocity, rad/s (see the axis note at the top of this file). */
  angularVelocity: Vector3;
  /** 0..1 */
  stamina: number;
  /** True while the stamina meter is exhausted and refilling; flaps are refused. */
  winded: boolean;
  /** 0..1 position within the current wingbeat; 0 = wings high, BreedStats.downFrac = bottom of the downstroke. */
  flapPhase: number;
  /** 0..1 how strong the current beat is (0 when gliding). Smoothed for animation. */
  flapStrength: number;
  /** 0..1 effective spread: 1 full, ~0.25 tucked. */
  wingSpread: number;
  /** 0..1 smoothed flare amount. */
  flare: number;
  /** 0..1 how deep into a stall. */
  stall: number;
  /** Derived each step for HUD/audio/fx. */
  airspeed: number;
  angleOfAttack: number;
  /** Load factor in g. */
  gLoad: number;
  /** Seconds since the last terrain contact while flying. */
  timeSinceContact: number;
}

/** What the flight model needs from the world. */
export interface FlightEnvironment {
  /** Air velocity at a point (wind + gusts + thermals + ridge lift), m/s. Writes into `out`. */
  windAt(p: Vector3, out: Vector3): Vector3;
  terrain: TerrainQuery;
}

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

export type SurfaceKind = 'grass' | 'rock' | 'dirt' | 'stone' | 'sand' | 'wood';

export interface GroundHit {
  /** Surface height at (x, z). */
  y: number;
  normal: Vector3;
  islandId: number;
  surface: SurfaceKind;
}

/**
 * A vertical solid cylinder in the world that the analytic terrain doesn't know about (building
 * walls, tower bases, big trunks). Walking code can push the rider/wyvern out of these.
 */
/** Shared by every collider shape. */
interface ColliderTraits {
  /** Foliage and the like: cushions and slows instead of stopping dead; never walkable. */
  soft?: boolean;
  /** What its walkable top is made of (footsteps); defaults to 'wood'. */
  surface?: SurfaceKind;
}

/** A vertical solid cylinder (posts, towers, trunks, wall segments). `kind` may be omitted. */
export interface CylinderCollider extends ColliderTraits {
  kind?: 'cylinder';
  x: number;
  z: number;
  radius: number;
  /** Bottom and top heights (world y). */
  y0: number;
  y1: number;
}

/** A solid sphere (tree canopies, boulders, hanging rocks). */
export interface SphereCollider extends ColliderTraits {
  kind: 'sphere';
  x: number;
  y: number;
  z: number;
  radius: number;
}

/**
 * A box turned about Y (buildings, roofs, decks, gate lintels). Centered at (x, y, z) with half
 * extents hx (local right), hy (up), hz (local forward); local forward is (sin yaw, 0, cos yaw).
 */
export interface BoxCollider extends ColliderTraits {
  kind: 'box';
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  yaw: number;
  /** Optional horizontal corner radius; flat top/bottom and unchanged outer extents. */
  roundXZ?: number;
  /** Optional closed convex solid inside these bounds, in box-local coordinates.
   * Outward-wound xyz triangle soup; normalized plane coefficients nx,ny,nz,d per face.
   * Ground support is only provided where its flat top reaches +hy. */
  convex?: { triangles: Float32Array; planes: Float64Array };
}

/** Anything solid the analytic terrain doesn't describe. Indexed by world/colliders.ts. */
export type Collider = CylinderCollider | SphereCollider | BoxCollider;

/** Extra detail about a collideSphere contact. */
export interface ContactInfo {
  /** True when every contact this call was soft (foliage). */
  soft: boolean;
  /** Surface of the last solid (non-soft) structure touched, if any. */
  solidSurface?: SurfaceKind;
}

export interface RayHit {
  point: Vector3;
  normal: Vector3;
  distance: number;
}

export interface TerrainQuery {
  /**
   * The walkable surface directly below (x, z): the highest island top that is at or below
   * `fromY + 2`. Null over open sky. Optional `out`: the hit is written into it and returned (no
   * allocation per call); implementations may ignore it and return a new object.
   */
  groundAt(x: number, z: number, fromY: number, out?: GroundHit): GroundHit | null;
  /**
   * Push a sphere out of any solid it overlaps. Returns true on contact and writes the
   * correction vector (add it to the center) and the contact normal.
   */
  collideSphere(center: Vector3, radius: number, outPush: Vector3, outNormal: Vector3, outInfo?: ContactInfo): boolean;
  /** Conservative distance to the nearest solid surface (never overestimates by much). */
  distance(p: Vector3): number;
  /** Sphere-traced ray against all solids. */
  raycast(origin: Vector3, dir: Vector3, maxDist: number): RayHit | null;
}

// ---------------------------------------------------------------------------------------------
// Player and creature poses (what renderers read each frame)
// ---------------------------------------------------------------------------------------------

export type PlayerMode =
  | 'flying' // in the air on the wyvern
  | 'landed' // mounted, wyvern standing/walking on an island
  | 'onFoot' // rider dismounted and walking; wyvern idles nearby
  | 'mounting' // short transition, rider climbing on
  | 'dismounting' // short transition, rider hopping off
  | 'traversing' // independent rider: tethered swing or momentum-preserving release
  | 'falling' // rider fell off an island; wyvern swooping in to catch
  | 'respawning'; // fade out/in after dropping into the cloud sea

export type WyvernGait = 'idle' | 'walk' | 'run' | 'takeoff' | 'landing' | 'jump';

/**
 * One-shot behaviours the wyvern can be cued to play (WyvernPose.cue, or Wyvern.cue directly):
 *   greet    a called arrival: the head comes down to the rider with a nictitating blink and a
 *            tongue burst toward them
 *   display  show the wings (the Stable, on a breed or colour change)
 *   present  wings half open, head turned to the rider (the title)
 */
export type WyvernCueKind = 'greet' | 'display' | 'present';

/**
 * Everything the wyvern renderer needs to pose and animate the model. Interpolated for render.
 * `position` is ALWAYS the body's center (center of mass, roughly under the saddle), airborne or
 * not; standing, it sits `BreedStats.standHeight` above the ground.
 */
export interface WyvernPose {
  /**
   * Gameplay-owned contact evidence for presentation. id increases on each touchdown;
   * reset increases on teleport/breed reset, even for moves under 40 m. Reused in place.
   * Absent for legacy ghosts/synthetic poses, which estimate impact from rendered velocity.
   */
  touchdown?: { id: number; reset: number; impact: number };
  position: Vector3;
  orientation: Quaternion;
  velocity: Vector3;
  airborne: boolean;
  airspeed: number;
  /** Body-frame angular velocity, for secondary motion (tail swing, neck lead). */
  angularVelocity: Vector3;
  wingSpread: number;
  flapPhase: number;
  flapStrength: number;
  flare: number;
  stall: number;
  /** 0..1 how winded; drives heavy breathing / labored flaps. */
  fatigue: number;
  gait: WyvernGait;
  /** m/s along the ground when not airborne. */
  groundSpeed: number;
  /** Seconds since mode/gait changed, for one-shot animations (takeoff leap, landing crouch). */
  gaitTime: number;
  /**
   * 0..1 position in the ground gait cycle (four foot contacts per cycle, the timing of
   * creatures/wyvern/gait.ts). The player emits a footstep at each contact on this clock, so an
   * animation that follows it puts every foot down on its sound. Absent: animate freely.
   */
  gaitPhase?: number;
  /** Where the head wants to look (world space), e.g. toward the camera's view or next ring. */
  lookTarget: Vector3;
  /** Ground height directly below the body (for leg placement and landing poses); null over open air. */
  groundY: number | null;
  /**
   * 0..1 progress of a "shake out the wings" ruffle (played when the wyvern becomes Rested after
   * a landing); 0 or absent when not playing.
   */
  ruffle?: number;

  // Optional animation inputs (presentation only: ghosts and saves never record them; every one
  // defaults to "absent" = the value noted).

  /** The flight stick this frame (−1..1; + = nose up, roll right, yaw right). Absent: derived from the body's motion. */
  control?: { pitch: number; roll: number; yaw: number };
  /** Rising air at each wingtip (m/s, left and right; FlightModel.tipUpdraft). Absent: 0. */
  gust?: { l: number; r: number };
  /** 0..1 how far the wyvern has lowered itself for its rider to climb on or off. Absent: 0. */
  kneel?: number;
  /** A one-shot behaviour: plays once each time `id` changes. Absent: none. */
  cue?: { kind: WyvernCueKind; id: number };
  /**
   * What the wyvern's idle behaviour reacts to: daylight 0 (night) … 1 (full sun), and the rider's
   * distance (m; 0 while mounted, Infinity when unknown). Absent: daylight 1, rider unknown.
   */
  idle?: { daylight: number; riderDist: number };
  /** Amplitude of this wingbeat (× the stroke; fatigue makes beats uneven). Absent: 1. */
  beatAmp?: number;
  /** Phase lag of the right wing behind the left (cycles; a tired, ragged beat). Absent: 0. */
  sideLag?: number;
  /**
   * The bond's anticipatory lean (−1..1, + = into a right bank): the wyvern leans and looks into a
   * bank its rider is about to throw at a landmark it knows (bond/anticipation.ts). Absent: 0.
   */
  anticipate?: number;
}

export type RiderAction =
  | 'mounted'
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'mount'
  | 'dismount'
  | 'wave';

export interface RiderPose {
  /** Presentation-only experimental prop pose; absent in ordinary gameplay. */
  equipment?: 'bracer' | 'tether';
  lanceCharge?: number;
  lanceMotion?: 'cast' | 'recover';
  lanceMotionT?: number;
  lineTension?: number;
  /** -1 spread/brake, +1 streamlined dive; absent outside experimental freefall. */
  freefallTilt?: number;
  freefallSteer?: number;
  /** Remaining fraction of the experimental waist burst; render only. */
  airBoost?: number;
  /** When mounted, the rider renderer attaches to the wyvern's saddle and ignores position. */
  mounted: boolean;
  /** On foot: the point between the feet, on the ground (or wherever the feet are mid-jump). */
  position: Vector3;
  /** Facing yaw (radians) on foot. */
  yaw: number;
  velocity: Vector3;
  action: RiderAction;
  actionTime: number;
  /** -1..1 lean into turns while mounted (from bank and roll rate). */
  lean: number;
  /** 0..1 crouch: tucked into a dive. */
  crouch: number;
  /** 0..1 brace: leaning back on a flare / hard landing. */
  brace: number;
  /** Relative wind velocity at the rider (world), drives cape/scarf cloth. */
  airflow: Vector3;
}

// ---------------------------------------------------------------------------------------------
// Cosmetics
// ---------------------------------------------------------------------------------------------

export type CosmeticSlot =
  | 'wyvernPattern'
  | 'wyvernHead'
  | 'wyvernHorns'
  | 'wyvernFrill'
  | 'wyvernTail'
  | 'saddle'
  | 'riderHair'
  | 'riderOutfit'
  | 'riderHeadgear'
  | 'riderScarf'
  | 'riderCape'
  | 'riderChest'
  | 'riderDrape'
  | 'riderWaist'
  | 'riderArmWraps'
  | 'riderLegWraps'
  | 'riderFootwear'
  | 'riderTop'
  | 'riderTrousers';

export type RiderGarmentSlot = 'top' | 'trousers' | 'chest' | 'shoulderDrape' | 'waist' | 'armWraps' | 'legWraps' | 'footwear';

export interface WyvernLook {
  breed: BreedId;
  /** Hex colors "#rrggbb". Colors are always free. */
  primary: string;
  secondary: string;
  belly: string;
  membrane: string;
  eyes: string;
  pattern: string;
  /** Head style (wyvernHead): 'native' is the breed's own; any breed's head fits any mount. */
  head: string;
  horns: string;
  frill: string;
  tail: string;
  saddle: string;
  saddleColor: string;
}

export interface RiderLook {
  build: 'slight' | 'medium' | 'broad';
  skin: string;
  hair: string;
  hairColor: string;
  outfit: string;
  outfitPrimary: string;
  outfitSecondary: string;
  headgear: string;
  scarf: string;
  scarfColor: string;
  cape: string;
  capeColor: string;
  /** Travel Drape pieces; retained while wearing another complete outfit. */
  chest: string;
  shoulderDrape: string;
  waist: string;
  armWraps: string;
  legWraps: string;
  footwear: string;
  armorColor: string;
  leatherColor: string;
  /** Sparse overrides over the selected complete outfit. Never mutate this map in place. */
  wardrobe?: Partial<Record<RiderGarmentSlot, string>>;
}

// ---------------------------------------------------------------------------------------------
// Races and progression
// ---------------------------------------------------------------------------------------------

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';
export type RaceKind = 'rings' | 'sprint';

export interface RaceRecord {
  bestMs: number;
  medal: Medal;
  /** Breed used for the best run (the ghost flies as that breed). */
  breed: BreedId;
  runs: number;
}

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface Settings {
  quality: QualityLevel;
  /** 0.5..1 render scale on top of devicePixelRatio cap. */
  resolutionScale: number;
  /** Invert flight pitch (pull forward = climb) on every device, unless overridden below. */
  invertPitch: boolean;
  /** Optional per-device overrides of invertPitch: the stick, and the keys (and mouse steering). Absent = follow invertPitch. */
  invertPitchPad?: boolean;
  invertPitchKeys?: boolean;
  /** Optional: invert the camera's vertical look (stick and mouse). Absent = not inverted. */
  invertLookY?: boolean;
  /**
   * Optional, keyboard + mouse: while the mouse is captured in flight it steers (a virtual stick
   * for bank and pitch); hold the middle button to look around instead. Absent = off.
   */
  mouseFlight?: boolean;
  /** 0.25..2 */
  lookSensitivity: number;
  /** Base vertical FOV in degrees. */
  fov: number;
  /**
   * Which default lens the settings were made under: absent = before 2026-10-18 (62°), 1 = the
   * slightly narrower default (58°, Q40). A save still on the old default moves to the new one.
   */
  lensRev?: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  /** Disables camera shake, speed blur and FOV kicks. */
  reducedMotion: boolean;
  rumble: boolean;
  showControlHints: boolean;
  /** 'cycle' runs the day; anything else locks the sky to that hour. */
  timeOfDay: 'cycle' | 'dawn' | 'day' | 'dusk' | 'night';
  /** Real minutes per in-game day when cycling. */
  dayLengthMinutes: number;
  /** Hold-to-flap (true) vs tap-per-beat (false). */
  holdToFlap: boolean;
  /** Windline accessibility: press again to release instead of holding the cast control. */
  windlineToggle?: boolean;
  showGhost: boolean;
}

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

export type WeatherKind = 'clear' | 'breezy' | 'overcast' | 'mist' | 'rain';

/** The three branches research is earned in. */
export type ResearchBranch = 'nature' | 'antiquity' | 'winds';

/**
 * Where a Ventari site stands (src/world/dressing/ventari/plan.ts). Shared by the antiquity
 * dressing, ambient life, the guided opening and research.
 */
export interface VentariSiteAnchor {
  /** Registry id (VENTARI_SITES). */
  id: string;
  islandId: number;
  /** Centre of the site on the ground. */
  x: number;
  y: number;
  z: number;
  /** Facing (radians about +Y; 0 looks down +Z). Sites face the Roost unless they have a reason not to. */
  yaw: number;
  /** Footprint radius: the walk-in survey zone and the keep-out for props. */
  radius: number;
  /** Where the inscription stands, on the ground: walk up to it to read. */
  inscription: { x: number; y: number; z: number };
}

export type DialogueSpeaker = 'quintus' | 'vellum' | 'narrator';

export interface DialogueLine {
  speaker: DialogueSpeaker;
  text: string;
  /** Portrait expression / voice colour. */
  mood?: 'warm' | 'curious' | 'excited' | 'wry' | 'urgent' | 'proud';
  /** How long to keep it up (ms); the panel picks a reading-time default when absent. */
  durationMs?: number;
  /** Stable id (for skipping and for 'seen' tracking). */
  id?: string;
}

export interface GameEvents {
  /** Fired at the bottom of each downstroke. strength 0..1. */
  flap: { strength: number; position: Vector3 };
  flapRefused: {};
  stallStart: {};
  stallEnd: {};
  /** Wings folded into a dive / unfolded. */
  tuckStart: {};
  tuckEnd: {};
  /** Hit terrain while flying. impulse in m/s of velocity lost. */
  terrainHit: { impulse: number; point: Vector3; normal: Vector3 };
  /**
   * Flew (body or a wing) through foliage: it brushed and slowed the wyvern, no bounce or stun.
   * At most a few per second while in contact; speed is the wyvern's speed (m/s).
   */
  foliageBrush: { position: Vector3; speed: number };
  touchdown: { impact: number; position: Vector3; surface: SurfaceKind };
  takeoff: { position: Vector3 };
  footstep: { position: Vector3; surface: SurfaceKind; heavy: boolean };
  mount: {};
  dismount: {};
  /** Rider walked off an edge; the wyvern dives to catch them. */
  fellOff: { position: Vector3 };
  caught: {};
  respawn: { position: Vector3 };
  modeChange: { from: PlayerMode; to: PlayerMode };

  raceArmed: { raceId: string };
  /**
   * An armed race stood down without starting (flew past or away from the gate). `reason`
   * (optional): 'missed-gate' = crossed the gate's plane outside the opening (worth telling the
   * player, who can press restart to try again); 'away' = turned or flew away; 'landed' = stopped
   * flying; 'respawn' = dropped into the cloud sea.
   */
  raceDisarmed: { raceId: string; reason?: 'missed-gate' | 'away' | 'landed' | 'respawn' };
  raceCountdown: { raceId: string; count: number };
  raceStart: { raceId: string };
  ringPassed: { raceId: string; index: number; total: number; splitMs: number; deltaMs: number | null; position: Vector3 };
  ringMissed: { raceId: string; index: number };
  raceFinish: { raceId: string; timeMs: number; medal: Medal; newBest: boolean; previousBestMs: number | null };
  /**
   * A race was abandoned. 'dismount': the rider got off mid-race; 'breed-change': the wyvern's
   * breed was changed mid-race (a record always holds the breed it was flown on).
   */
  raceAbort: { raceId: string; reason: 'quit' | 'restart' | 'respawn' | 'left-course' | 'dismount' | 'breed-change' };

  collect: { id: string; kind: 'feather' | 'relic'; name: string; position: Vector3; total: number; ofTotal: number };
  unlock: { cosmeticId: string; name: string; slot: CosmeticSlot };
  discover: { landmarkId: string; name: string };

  weatherChange: { from: WeatherKind; to: WeatherKind };
  /**
   * The player's wyvern rode into a thermal's rising air (stronger than ~2 m/s) / out of it again
   * (hysteresis, so circling the edge doesn't chatter). Presentation only: a vario pulse, a rising
   * chime. `id` is the layout thermal; `lift` is the vertical air speed there (m/s). Fired whatever
   * the player mode; listeners that only care in flight check the mode.
   */
  thermalEnter: { id: number; lift: number; position: Vector3 };
  thermalExit: { id: number };

  // --- Living Drift, the Ventari and research (vertical slice) ---------------------------------
  /** The player got close to (or watched) a creature or plant. Research decides whether it's new. */
  catalogue: { speciesId: string; kind: 'creature' | 'plant'; name: string; position: Vector3 };
  /** The player walked a Ventari site or read one of its inscriptions. */
  survey: { siteId: string; part: 'site' | 'inscription'; name: string; text?: string; position: Vector3 };
  /** A new research entry was recorded (the journal gained a page). */
  researchEntry: { entryId: string; branch: ResearchBranch; title: string; points: number; branchTotal: number; total: number };
  /** The Codex (the airship in the Roost's dock) reached a new build stage. */
  codexStage: { stage: number; name: string; description: string };
  /** A line of dialogue for the subtitle panel (Quintus, or a narrator line). */
  dialogue: DialogueLine;
  /** Clear any dialogue on screen (skip, scene change). */
  dialogueClear: {};
  /** The guided opening advanced (step id), or finished / was skipped. */
  prologue: { step: string; state: 'start' | 'done' | 'skipped' };
  /**
   * Distant lightning in a storm (presentation only: thunder, a rumble). Strikes land kilometres
   * away; `distance` is from the camera in m (thunder should lag it at ~340 m/s).
   */
  lightning: { position: Vector3; distance: number };
  lookChanged: {};
  settingsChanged: { settings: Settings };
  toast: { text: string; sub?: string; icon?: 'feather' | 'relic' | 'unlock' | 'race' | 'info' };
  uiSound: { kind: 'move' | 'select' | 'back' | 'locked' | 'tab' };
}
