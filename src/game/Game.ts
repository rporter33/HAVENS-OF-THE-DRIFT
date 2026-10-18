// Constructs every system, wires them together and runs the loop. Simulation runs at a fixed
// 120 Hz (flight physics, ring checks); everything visual runs once per rendered frame and
// interpolates between the last two physics steps.

import { SkyLanceVisuals } from '../traversal/SkyLanceVisuals';
import { TraversalWorld } from '../traversal/sweep';
import { centeredCast } from '../traversal/target';
import { LANCE } from '../traversal/tuning';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { EventBus } from '../core/events';
import type { BoxCollider, GameEvents, RiderLook, Settings, WyvernLook } from '../core/types';
import { Renderer } from '../render/renderer';
import { QUALITY } from '../render/quality';
import { AdaptiveResolution } from '../render/adaptiveResolution';
import { FrameClock, FrameGuard } from './frameGuard';
import { globalUniforms } from '../render/uniforms';
import { Input, emptyFrame } from '../input/Input';
import { Haptics } from '../input/haptics';
import { World } from '../world/World';
import { Dressing } from '../world/dressing/Dressing';
import { deckCollider } from '../world/colliders';
import { Weather } from '../sky/Weather';
import { Sky } from '../sky/Sky';
import { Player } from '../player/Player';
import { CameraRig } from '../camera/CameraRig';
import { Wyvern } from '../creatures/wyvern/Wyvern';
import { Rider } from '../creatures/rider/Rider';
import { Races } from '../race/Races';
import { Collectibles } from '../progression/Collectibles';
import { LocalSaveStore, SAVE_KEY } from '../progression/save';
import { Fx } from '../fx/Fx';
import { AudioSystem } from '../audio/Audio';
import { Ui } from '../ui/Ui';
import type { GameActions, GameScreen, GameView, Interactable, RaceSystem } from './contracts';
import { guessQuality } from './settings';
import { computePrompt } from '../player/prompts';
import { Interactables } from './interactables';
import { Research } from '../research/Research';
import { Bond } from '../bond/Bond';
import { CapabilityPreview } from '../debug/capPreview';
import { airshipStage } from '../research/state';
import { shrineInteraction } from '../research/firstLeadEncounter';
import { FirstLead } from '../world/dressing/ventari/FirstLead';
import { readDebugParams, type DebugParams } from '../debug/params';
import { findShowcase, type Showcase } from '../debug/showcase';
import type { WorldLayout } from '../world/layout';
import type { RaceDef } from './contracts';
import type { Terrain } from '../world/terrain';

export const FIXED_DT = 1 / 120;
const MAX_STEPS = 12;
const TOD_PRESETS = { dawn: 0.27, day: 0.42, dusk: 0.72, night: 0.95 } as const;

/** Opt-in composition for a separate authoring sandbox; ordinary boot keeps every default. */
export interface GameOptions {
  layout?: WorldLayout;
  races?: RaceDef[];
  save?: LocalSaveStore;
  /** Authoring adds only manual props; canonical dressing can retain its original terrain. */
  dressingTerrain?: Terrain;
}

export class Game implements GameActions {
  readonly events = new EventBus<GameEvents>();
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: Renderer;
  readonly save: LocalSaveStore;
  readonly input: Input;
  readonly haptics: Haptics;
  readonly world: World;
  readonly dressing: Dressing;
  readonly weather: Weather;
  readonly sky: Sky;
  readonly player: Player;
  readonly cameraRig: CameraRig;
  readonly wyvern: Wyvern;
  readonly rider: Rider;
  readonly races: Races;
  readonly collectibles: Collectibles;
  readonly fx: Fx;
  readonly audio: AudioSystem;
  readonly research: Research;
  /** Bond expression v1: the Windhaven greeting and the anticipatory lean (presentation only). */
  readonly bond: Bond;
  /** ?capPreview only: the capability-site playtest's stand-in for G5 (never in normal play). */
  readonly capPreview: CapabilityPreview | null;
  readonly firstLead: FirstLead;
  readonly ui: Ui;
  readonly debug: DebugParams;

  screen: GameScreen = 'loading';
  /** Fade requested by screen transitions (0..1); combined with the player's own fade. */
  uiFade = 0;
  prompt: GameView['prompt'] = null;
  /** On-foot things to use (inscriptions, Quintus, the Codex); the nearest in reach owns interact. */
  readonly interactables = new Interactables();
  private activeInteractable: Interactable | null = null;
  private accumulator = 0;
  private running = false;
  private view: GameView;
  private showcase: Showcase | null = null;
  /** Presentation only; movement remains owned by Player and RiderFoot. */
  skyLanceVisuals: SkyLanceVisuals | null = null;
  private windlineEnabled = false;
  /** Neutral input fed to the simulation when the player has no control (title, menus). */
  private idleInput = emptyFrame();
  private readonly lanceAim = new Vector3();
  /** Lowers the render resolution when frames run long (real GPUs vary wildly). */
  private adaptive = new AdaptiveResolution();
  /** Seconds before frame times count for adaptive resolution again (boot, screen changes). */
  private adaptiveGrace = 2;
  /** Keeps the loop alive through exceptions and reports them (main.ts shows the overlay). */
  readonly loop = new FrameGuard();
  /** The dressing's decks as solid slabs (filled as decks are built). */
  private deckColliders: BoxCollider[] = [];

  constructor(container: HTMLElement, uiRoot: HTMLElement, options: GameOptions = {}) {
    this.save = options.save ?? new LocalSaveStore();
    this.debug = readDebugParams();
    const settings = this.settings;
    // First launch: pick a quality preset from what the GPU says about itself.
    if (isFirstLaunch(this.save.data.playTime)) settings.quality = guessQuality();
    if (this.debug.quality) settings.quality = this.debug.quality;
    const quality = QUALITY[settings.quality];

    this.renderer = new Renderer(container, settings.quality);
    this.renderer.setQuality(settings.quality, settings.resolutionScale);
    this.camera = new PerspectiveCamera(settings.fov, this.renderer.aspect, 0.5, quality.drawDistance);
    this.renderer.onResize((w, h) => {
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    });

    this.input = new Input(this.renderer.canvas, () => this.settings, this.events);
    this.haptics = new Haptics(this.events, this.input, () => this.settings);
    this.world = new World(this.scene, quality, options.layout);
    this.dressing = new Dressing({ scene: this.scene, terrain: options.dressingTerrain ?? this.world.terrain, quality, asyncStreaming: !this.debug.manual });
    // Everything solid that isn't rock (buildings, trees, decks) collides through the terrain's
    // collider index; sources are synced every frame as distant sites finish building.
    const colliders = this.world.terrain.colliders;
    colliders.addSource('structures', () => this.dressing.colliders);
    colliders.addSource('forest', () => this.dressing.forest.colliders);
    colliders.addSource('decks', () => this.deckColliders);
    this.syncColliders();
    this.weather = new Weather(this.scene, this.world.layout, this.events, quality);
    this.sky = new Sky(this.scene, this.renderer, quality, this.weather);
    this.player = new Player({
      terrain: this.world.terrain,
      env: { windAt: (p, out) => this.weather.windAt(p, out), terrain: this.world.terrain },
      events: this.events,
      breed: this.save.data.wyvern.breed,
      settings: () => this.settings,
      // The saddle as the model builds it (falls back to an estimate until Wyvern.seatOffset exists).
      seat: (out) => (this.wyvern as { seatOffset?: (o: Vector3) => Vector3 } | undefined)?.seatOffset?.(out) ?? null,
      foot: (i, out) => (this.wyvern as Wyvern | undefined)?.footLanding(i, out) ?? null,
      daylight: () => 1 - this.sky.night,
      interactableNear: (p) => this.interactables.nearest(p) !== null,
    });
    this.cameraRig = new CameraRig(this.camera, this.world.terrain, () => this.settings, this.events);
    this.wyvern = new Wyvern(this.save.data.wyvern, { terrain: this.world.terrain, trial: this.debug.wyvernTrial });
    this.wyvern.setQuality(quality);
    this.rider = new Rider(this.save.data.rider, {
      trial: this.debug.riderTrial,
      proof: this.debug.riderProof, proofMaps: this.debug.riderMaps, proofHighSize: this.debug.riderTexture,
      proofTextureLimit: this.renderer.gl.capabilities.maxTextureSize,
      terrain: this.world.terrain, saddle: this.wyvern.saddle, events: this.events, quality,
      socket: (name, out) => this.wyvern.socket(name, out),
    });
    this.scene.add(this.wyvern.group, this.rider.group);
    this.races = new Races({
      defs: options.races,
      scene: this.scene,
      events: this.events,
      save: this.save,
      player: this.player,
      quality,
      settings: () => this.settings,
      camera: this.cameraRig,
      terrain: this.world.terrain,
    });
    this.cameraRig.setWaypointSource((out) => (this.races.state === 'running' || this.races.state === 'countdown' ? this.races.waypoint(out) : null));
    this.collectibles = new Collectibles({
      scene: this.scene,
      events: this.events,
      save: this.save,
      terrain: this.world.terrain,
      dressing: this.dressing,
      quality,
      viewportHeight: () => this.renderer.canvas.height,
    });
    colliders.addSource('race-gates', () => this.races.colliders);
    colliders.addSource('relics', () => this.collectibles.colliders);
    this.fx = new Fx({
      scene: this.scene,
      renderer: this.renderer,
      events: this.events,
      quality,
      settings: () => this.settings,
      layout: this.world.layout,
      terrain: this.world.terrain,
      decks: this.dressing.decks,
      seaSurfaceAt: (x, z) => this.sky.seaSurfaceAt(x, z),
    });
    this.audio = new AudioSystem(this.events, () => this.settings, { waterfalls: () => this.dressing.water.plansList });
    this.audio.applySettings(settings);
    this.ui = new Ui({ root: uiRoot, actions: this, events: this.events });

    this.view = {
      screen: this.screen,
      player: this.player,
      races: this.races,
      collectibles: this.collectibles,
      save: this.save,
      input: this.input,
      sky: this.sky,
      weather: this.weather,
      camera: this.cameraRig,
      prompt: null,
      renderer: this.renderer,
    };

    this.research = new Research(this.save, this.events);
    this.bond = new Bond(this.world.layout);
    this.capPreview = this.debug.capPreview ? new CapabilityPreview(this, this.debug.capPreview) : null;
    const shrine = this.dressing.ventariSites.find((s) => s.id === 'gullrest-shrine');
    if (!shrine) throw new Error('First Lead shrine anchor missing');
    this.view.tutorialShrine = shrine;
    this.firstLead = new FirstLead(shrine, this.world.terrain);
    this.firstLead.setStage(airshipStage(this.save.data.research));
    this.scene.add(this.firstLead.group);
    colliders.addSource('first-lead', () => this.firstLead.colliders);
    this.syncColliders();
    this.interactables.add(shrineInteraction(shrine, this.events, () => {
      this.pause();
      this.ui.showFirstLead();
    }));
    this.events.on('codexStage', () => this.firstLead.setStage(airshipStage(this.save.data.research)));
    this.placeAtSpawn();
    this.applyDebug();
    this.wireEvents();
    this.showcase = findShowcase(this.debug.view);
    if (this.showcase) this.showcase.setup(this, new URLSearchParams(typeof location !== 'undefined' ? location.search : ''));
    else this.enableWindline();
  }

  get settings(): Settings {
    return this.save.data.settings;
  }

  // --- Lifecycle --------------------------------------------------------------------------------

  start(): void {
    this.setScreen(this.debug.play ? 'play' : 'title');
    if (this.debug.manual) return;
    this.running = true;
    // Time starts at the first callback (never negative, see FrameClock).
    const clock = new FrameClock();
    const frame = (now: number) => {
      if (!this.running) return;
      // Ask for the next frame first: an exception in any system must not end the loop.
      requestAnimationFrame(frame);
      const raw = clock.tick(now);
      this.loop.run(() => this.frame(Math.min(0.1, raw), true, raw));
    };
    requestAnimationFrame(frame);
  }

  /** Stop the loop and release opt-in scene resources. Other systems retain their existing lifecycle. */
  stop(): void {
    this.running = false; this.showcase?.dispose?.(this); this.showcase = null;
    if (this.windlineEnabled) {
      this.skyLanceVisuals?.dispose(); this.skyLanceVisuals = null;
      this.player.disableSkyLance(); this.ui.disableWindline(); this.windlineEnabled = false;
    }
  }

  /** Standard rider equipment uses the live world's shared static solids, without practice props. */
  private enableWindline(): void {
    this.player.enableSkyLance(new TraversalWorld(this.world.terrain));
    this.player.setLanceInteraction(this.settings.windlineToggle ? 'toggle' : 'hold');
    this.skyLanceVisuals = new SkyLanceVisuals(); this.scene.add(this.skyLanceVisuals.group);
    this.ui.enableWindline(); this.windlineEnabled = true;
  }

  /**
   * Advance the game by dt seconds (sim + presentation) and, unless told not to, render.
   * `frameTime` is the real, unclamped time since the last frame (feeds adaptive resolution).
   */
  frame(dt: number, render = true, frameTime = dt): void {
    if (!(dt >= 0)) dt = 0;
    this.syncColliders();
    this.input.flying = this.player.mode === 'flying';
    this.input.traversal = !!this.player.skyLance && this.screen === 'play' && !this.ui.capturesInput &&
      (this.player.mode === 'onFoot' || this.player.mode === 'falling' || this.player.mode === 'traversing');
    this.input.airborneTraversal = this.input.traversal && this.player.mode === 'traversing';
    const input = this.input.poll(dt);
    this.haptics.update(dt);
    const simulate = (this.screen === 'play' || this.screen === 'title') && !this.debug.freeze;

    if (simulate) {
      this.accumulator += dt;
      let steps = 0;
      const gameplayInput = this.screen === 'play' && this.player.controllable && !this.ui.capturesInput ? input : this.idleInput;
      if (gameplayInput === this.idleInput && this.player.skyLance) this.player.cancelLanceWindup();
      // Presses are per rendered frame; latch them so 0 or several fixed steps see each once.
      if (this.player.skyLance && !gameplayInput.aim) {
        this.camera.getWorldDirection(this.lanceAim);
        if (gameplayInput.pressed.lance && this.player.skyLance.state === 'ready') {
          const origin = this.player.foot.position.clone(); origin.y += LANCE.harnessHeight;
          this.lanceAim.copy(centeredCast(this.player.skyLance.world,this.camera.position,this.lanceAim,origin,this.player.foot.velocity).aim);
        }
        gameplayInput.aim = this.lanceAim;
      }
      this.player.latchPresses(gameplayInput);
      this.capPreview?.update(dt, gameplayInput);
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
        this.player.fixedUpdate(FIXED_DT, gameplayInput, this.cameraRig.yaw);
        this.races.fixedUpdate(FIXED_DT, this.player);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) this.accumulator = 0;
    }
    const alpha = this.accumulator / FIXED_DT;
    this.player.update(dt, alpha);
    this.showcase?.update?.(this, dt);
    this.bond.update(dt, this.player, this.screen === 'play', (kind) => this.wyvern.cue(kind));

    if (this.screen === 'play' && !this.ui.capturesInput) this.handlePlayInput();

    const focus = this.player.riderPose.mounted ? this.player.wyvernPose.position : this.player.riderPosition;
    globalUniforms.uPlayerPos.value.copy(this.player.riderPosition);
    // Paused (photo mode included) the world holds still: no time of day, weather or sky motion.
    const worldDt = this.screen === 'pause' ? 0 : dt;
    this.weather.update(worldDt, this.camera, focus);
    this.updateTimeOfDay(worldDt);
    this.sky.setCreatureShadow(this.player.wyvernPose, this.player.breed.wingspan);
    this.sky.update(worldDt, this.camera, focus, this.settings);
    this.world.update(dt, this.camera, focus);
    this.wyvern.update(dt, this.player.wyvernPose);
    this.rider.update(dt, this.player.riderPose, this.player.riderPose.mounted ? this.wyvern.saddle : null);
    if (this.player.skyLance) this.skyLanceVisuals?.update(this.player.skyLance, this.rider, this.player.riderPose, alpha);
    // Photo mode (opened from the pause menu) flies the camera while the world holds still.
    const cameraInput = this.screen === 'play' || this.screen === 'stable' || this.cameraRig.mode === 'photo';
    this.cameraRig.update(dt, cameraInput ? input : this.idleInput, this.player);
    this.dressing.update(dt, this.camera, focus);
    this.races.update(dt, this.camera, this.player);
    this.collectibles.update(dt, this.camera, this.player);
    this.fx.update(dt, this.camera, this.player, this.wyvern);
    this.audio.update(dt, this.camera, this.player, this.weather, this.sky);
    this.renderer.grade.uCloudVeil.value = this.sky.cloudVeilAt(this.camera.position);
    this.renderer.grade.uFade.value = Math.max(this.player.fade, this.uiFade, this.cameraRig.fade);

    this.prompt = this.screen === 'play' ? computePrompt(this.player, this.world.layout, this.races.state === 'running') : null;
    // On foot, an interactable in reach wins over mounting (you walked up to it) but not the Stable.
    this.activeInteractable =
      this.screen === 'play' && this.player.mode === 'onFoot' && this.prompt?.action !== 'stable' ? this.interactables.nearest(this.player.riderPosition) : null;
    if (this.activeInteractable) this.prompt = this.activeInteractable.prompt;
    this.view.screen = this.screen;
    this.view.prompt = this.prompt;
    this.ui.update(dt, this.view);
    // Visibility can change on this frame (resume, HUD reveal or leaving the
    // saddle). Validate after that decision, before any newly visible cue paints.
    if (this.player.skyLance) this.skyLanceVisuals?.updateReticle(this.camera, this.player.foot.position, this.player.foot.velocity, this.player.skyLance);

    if (this.screen === 'play') this.save.data.playTime += dt;
    if (render) {
      this.renderer.render(this.scene, this.camera, dt);
      if (!this.debug.manual) this.sampleFrameTime(frameTime);
    }
  }

  // --- Actions (called by the UI) -------------------------------------------------------------

  startGame(): void {
    this.audio.unlock();
    this.setScreen('play');
  }

  pause(): void {
    if (this.screen === 'play') this.setScreen('pause');
  }

  resume(): void {
    this.setScreen('play');
  }

  openStable(): void {
    // No breed swaps mid-race: the pause menu asks first; anything else stands the race down.
    if (this.races.state === 'running' || this.races.state === 'countdown') this.races.abort('quit');
    // A wyvern left across the island walks up to a stall beside the door, so the Stable frames both.
    this.player.settleAtStable();
    this.setScreen('stable');
  }

  closeStable(): void {
    this.setScreen('play');
  }

  beginRace(raceId: string): void {
    this.setScreen('play');
    this.races.begin(raceId);
  }

  restartRace(): void {
    this.races.restart();
  }

  quitRace(): void {
    this.races.abort('quit');
  }

  setWyvernLook(look: WyvernLook): void {
    this.save.data.wyvern = { ...look };
    this.previewWyvernLook(look);
    this.save.save();
    this.events.emit('lookChanged', {});
  }

  setRiderLook(look: RiderLook): void {
    this.save.data.rider = { ...look };
    this.previewRiderLook(look);
    this.save.save();
    this.events.emit('lookChanged', {});
  }

  previewWyvernLook(look: WyvernLook): void {
    // Compare with the breed actually flying, not the save (which may already hold the new look).
    if (look.breed !== this.player.breed.id) this.player.setBreed(look.breed);
    this.wyvern.setLook(look);
  }

  previewRiderLook(look: RiderLook): void {
    this.rider.setLook(look);
  }

  applySettings(s: Settings): void {
    const prev = this.settings;
    this.save.data.settings = { ...s };
    if (this.windlineEnabled && s.windlineToggle !== prev.windlineToggle) {
      this.player.setLanceInteraction(s.windlineToggle ? 'toggle' : 'hold');
    }
    if (s.quality !== prev.quality || s.resolutionScale !== prev.resolutionScale) {
      this.renderer.setQuality(s.quality, s.resolutionScale);
      const q = QUALITY[s.quality];
      this.camera.far = q.drawDistance;
      this.camera.updateProjectionMatrix();
      this.world.setQuality(q);
      this.dressing.setQuality(q);
      this.sky.setQuality(q);
      this.fx.setQuality(q);
      this.rider.setQuality(q);
      this.wyvern.setQuality(q);
    }
    this.audio.applySettings(s);
    this.races.setShowGhost(s.showGhost);
    this.save.save();
    this.events.emit('settingsChanged', { settings: s });
  }

  quitToTitle(): void {
    if (this.races.activeId) this.races.abort('quit');
    this.placeAtSpawn();
    this.setScreen('title');
  }

  resetProgress(): void {
    // Stand down any race and let the races forget bests and the best ghost they hold in memory.
    if (this.races.activeId) this.races.abort('quit');
    (this.races as RaceSystem).resetProgress?.();
    this.save.reset();
    this.research.refresh();
    this.bond.reset();
    this.firstLead.setStage(0);
    // Everything that follows the save re-reads it: the breed's physics, the models, collectibles
    // (they notice the new save), the HUD's discoveries and the tips.
    this.previewWyvernLook(this.save.data.wyvern);
    this.previewRiderLook(this.save.data.rider);
    this.events.emit('lookChanged', {});
    this.placeAtSpawn();
  }

  // --- Internals ------------------------------------------------------------------------------

  private setScreen(screen: GameScreen): void {
    if (this.screen === 'play' && screen !== 'play' && this.player.skyLance) this.player.cancelLanceWindup();
    this.audio.setScreen(screen);
    this.screen = screen;
    this.adaptiveGrace = Math.max(this.adaptiveGrace, 1);
    this.ui.setScreen(screen);
    this.cameraRig.mode = screen === 'title' ? 'title' : screen === 'stable' ? 'stable' : 'follow';
    this.collectibles.setActive(screen === 'play');
    this.input.setPointerLock(screen === 'play');
  }

  private handlePlayInput(): void {
    const p = this.input.frame.pressed;
    if (p.pause) {
      this.pause();
      this.input.consume(); // the press that opened the menu must not also close it this frame
    }
    if (p.restart && (this.races.activeId || this.races.retryId)) this.restartRace();
    // The prompt decides what interact does here (mounting wins over the stable door).
    if (p.interact && this.prompt?.action === 'stable') this.openStable();
    else if (p.interact && this.activeInteractable) this.activeInteractable.onInteract();
  }

  /** Feed adaptive resolution, skipping frames that say nothing about steady-state cost. */
  private sampleFrameTime(frameTime: number): void {
    this.adaptiveGrace = Math.max(0, this.adaptiveGrace - frameTime);
    // Shader links, screen changes and the first seconds after boot are one-off hitches.
    if (this.renderer.compiledThisFrame) this.adaptiveGrace = Math.max(this.adaptiveGrace, 0.5);
    if (this.adaptiveGrace > 0 || this.screen === 'loading') return;
    const scale = this.adaptive.sample(frameTime);
    if (scale !== null) this.renderer.setDynamicResolution(scale);
  }

  private syncColliders(): void {
    const decks = this.dressing.decks;
    while (this.deckColliders.length < decks.length) this.deckColliders.push(deckCollider(decks[this.deckColliders.length]));
    this.world.terrain.colliders.sync();
  }

  private updateTimeOfDay(dt: number): void {
    const s = this.settings;
    if (this.debug.tod !== undefined) {
      this.sky.setTimeOfDay(this.debug.tod);
      return;
    }
    if (s.timeOfDay === 'cycle') {
      this.sky.setTimeOfDay(this.sky.timeOfDay + dt / (s.dayLengthMinutes * 60));
    } else {
      this.sky.setTimeOfDay(TOD_PRESETS[s.timeOfDay]);
    }
  }

  private placeAtSpawn(): void {
    // New game: on foot at the spawn, the wyvern waiting on the Roost.
    this.player.placeAtSpawn();
    this.cameraRig.snap(this.player);
  }

  private applyDebug(): void {
    const d = this.debug;
    if (d.weather) this.weather.set(d.weather, true);
    if (d.at) {
      this.player.teleport(new Vector3(...d.at), d.yaw ?? 0, d.mode ?? 'flying', d.speed ?? 26);
      this.cameraRig.snap(this.player);
    }
    if (d.cam && d.look) this.cameraRig.setOverride({ position: new Vector3(...d.cam), target: new Vector3(...d.look) });
  }

  private wireEvents(): void {
    // Camera shake and controller rumble subscribe to the bus themselves (CameraRig, Haptics).
  }
}

function isFirstLaunch(playTime: number): boolean {
  try {
    return playTime === 0 && localStorage.getItem(SAVE_KEY) === null;
  } catch {
    return false;
  }
}
