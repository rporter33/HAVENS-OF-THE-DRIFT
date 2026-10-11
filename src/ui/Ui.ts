import { TutorialMap } from './TutorialMap';
import { readyForShrine } from './firstLeadGuide';
// The interface: title, HUD, menus and the Stable, as an HTML overlay over the canvas.
//
// Ui owns a stack of panels (title menu, pause, its sheets, dialogs, the Stable, results); the
// top one gets each frame's presses, all through one focus model so every screen works the same
// with a pad (D-pad / stick + A / B + LB / RB), the keyboard and the mouse. The HUD sits
// underneath and reads the GameView every frame. The overlay root lets the mouse through to the
// canvas except over interactive panels, so dragging and the wheel still turn the Stable camera.

import './fonts';
import './ui.css';
import type { GameEventBus } from '../core/events';
import type { GameEvents, Settings } from '../core/types';
import type { GameActions, GameScreen, GameView, UiSystem } from '../game/contracts';
import type { ControlAction, PadControl } from '../input/scheme';
import { ControlsMenu } from './ControlsMenu';
import { CollectionMenu } from './CollectionMenu';
import { CreditsMenu } from './CreditsMenu';
import { Dialog } from './Dialog';
import { LiveClass, div } from './dom';
import { preloadFonts } from './fonts';
import { controlName, glyphDevice, glyphHtml, keyGlyph, padGlyph, type GlyphDevice } from './glyphs';
import { Hud } from './Hud';
import type { Panel, UiCtx, UiSound } from './panel';
import { Pause, type PauseEntry } from './Pause';
import { PhotoMode } from './PhotoMode';
import { RaceHud } from './RaceHud';
import { RacesMenu } from './RacesMenu';
import { Results, type RaceResult } from './Results';
import { SettingsMenu } from './SettingsMenu';
import { Stable } from './Stable';
import { Tips } from './Tips';
import { WindlineHud } from './WindlineHud';
import { Title } from './Title';
import { FIRST_LEAD_TRANSLATION } from '../research/firstLeadText';

export interface UiDeps {
  root: HTMLElement;
  actions: GameActions;
  events: GameEventBus;
}

/** Seconds between crossing the finish and the results card (time to see "Finish" and breathe). */
const RESULTS_DELAY = 1.8;

export class Ui implements UiSystem {
  screen: GameScreen = 'loading';
  private actions: GameActions;
  private events: GameEventBus;
  private root: HTMLElement;
  private stackLayer: HTMLElement;
  private veil: HTMLElement;
  private hudNote: HTMLElement;
  private hud: Hud;
  private raceHud: RaceHud;
  private tips: Tips;
  private windline: WindlineHud | null = null;
  private gaugeTip: LiveClass;
  private stack: Panel[] = [];
  private title: Title | null = null;
  private ctx: UiCtx;
  private view: GameView | null = null;

  /** Screen change waiting for the first GameView (panels read it while building). */
  private pendingScreen: GameScreen | null = null;
  private previousScreen: GameScreen = 'loading';
  /** Presses of the frame a screen opened are ignored (the press that opened it). */
  private skipInput = false;
  private seenTitle = false;
  private stableFromTitle = false;
  private hudHidden = false;
  private hudNoteLeft = 0;
  private device: GlyphDevice = 'keyboard';
  private padStyleSeen: 'xbox' | 'playstation' | 'generic' = 'xbox';
  private reduced = false;

  // Results flow.
  private result: RaceResult | null = null;
  private resultsIn = 0;
  private showResultsOnPause = false;
  private runUnlocks: string[] = [];

  /** Debug/showcase: overrides merged over the GameView (fake races, collectibles...). */
  private debugView: Partial<GameView> | null = null;
  private patchedView: GameView | null = null;

  constructor(deps: UiDeps) {
    this.actions = deps.actions;
    this.events = deps.events;
    preloadFonts();

    const ui = this; // the getters below read live fields
    this.ctx = {
      get actions() {
        return ui.actions;
      },
      get events() {
        return ui.events;
      },
      get view() {
        return ui.view!;
      },
      push: (p) => this.push(p),
      pop: (p) => this.pop(p),
      settings: () => this.settings(),
      applySettings: (patch) => this.actions.applySettings({ ...this.settings(), ...patch }),
      device: () => this.device,
      fillGlyphs: (el) => this.fillGlyphs(el),
      sound: (kind) => this.sound(kind),
      reducedMotion: () => this.reduced,
    };

    this.root = div('dw-ui');
    this.root.dataset.device = 'keyboard';
    this.gaugeTip = new LiveClass(this.root, 'is-gauge-tip');
    this.hud = new Hud({ events: this.events, fillGlyphs: (el) => this.fillGlyphs(el), reducedMotion: () => this.reduced });
    this.raceHud = new RaceHud({
      events: this.events,
      reducedMotion: () => this.reduced,
      notify: (n) => this.hud.notify(n),
      restartLabel: () => controlName('restart', this.device),
    });
    this.tips = new Tips({ fillGlyphs: (el) => this.fillGlyphs(el), events: this.events });
    this.veil = div('dw-veil');
    this.stackLayer = div('dw-layer dw-stack');
    this.hudNote = div('dw-hud-note');
    this.hudNote.innerHTML = '<span>HUD hidden</span><span class="dw-hint-g" data-glyph="toggleHud"></span><span>to show</span>';
    this.root.append(this.hud.root, this.raceHud.root, this.tips.root, this.hudNote, this.veil, this.stackLayer, this.hud.toastLayer);
    deps.root.append(this.root);
    this.fillGlyphs(this.root);
    this.subscribe();
    this.setScreen('title');
  }

  get capturesInput(): boolean {
    return this.screen !== 'play' || this.stack.length > 0;
  }

  enableWindline(): void {
    if (this.windline) return;
    this.windline = new WindlineHud(el => this.fillGlyphs(el));
    this.root.append(this.windline.root);
  }

  disableWindline(): void {
    this.windline?.root.remove(); this.windline = null;
  }

  // --- Screens --------------------------------------------------------------------------------

  setScreen(screen: GameScreen): void {
    this.previousScreen = this.screen;
    this.screen = screen;
    this.skipInput = true;
    if (screen === 'play') {
      // Leave immediately so gameplay gets this frame's input back.
      this.clearStack();
      this.pendingScreen = null;
      return;
    }
    if (this.view) this.applyScreen(screen);
    else this.pendingScreen = screen;
  }

  private applyScreen(screen: GameScreen): void {
    this.clearStack();
    switch (screen) {
      case 'title': {
        this.stableFromTitle = false;
        const t = this.title ?? (this.title = this.buildTitle());
        this.push(t);
        if (this.seenTitle) t.toMenu(false);
        this.seenTitle = true;
        break;
      }
      case 'pause':
        if (this.showResultsOnPause && this.result) this.pushResults();
        else this.push(new Pause(this.ctx, this.pauseEntries()));
        this.showResultsOnPause = false;
        break;
      case 'stable':
        this.stableFromTitle = this.previousScreen === 'title';
        this.push(new Stable(this.ctx, () => this.leaveStable()));
        break;
      case 'results':
        if (this.result) this.pushResults();
        break;
      default:
        break;
    }
  }

  private buildTitle(): Title {
    return new Title(this.ctx, [
      { label: 'Fly', run: () => this.actions.startGame() },
      { label: 'Stable', run: () => this.actions.openStable() },
      { label: 'Settings', run: () => this.push(new SettingsMenu(this.ctx)) },
      { label: 'Controls', run: () => this.push(new ControlsMenu(this.ctx)) },
      { label: 'Credits', run: () => this.push(new CreditsMenu(this.ctx)) },
    ]);
  }

  private pauseEntries(): PauseEntry[] {
    const view = this.view!;
    const racing = view.races.activeId !== null && view.races.state !== 'idle' && view.races.state !== 'finished';
    const entries: PauseEntry[] = [{ label: 'Resume', run: () => this.actions.resume() }];
    if (view.tutorialShrine) entries.push({ label: 'Tutorial map', run: () => this.showTutorialMap() });
    if (racing) {
      entries.push(
        {
          label: 'Restart race',
          run: () => {
            this.actions.restartRace();
            this.actions.resume();
          },
        },
        {
          label: 'Abandon race',
          run: () => {
            this.actions.quitRace();
            this.actions.resume();
          },
        },
      );
    }
    entries.push(
      {
        label: 'Races',
        run: () => this.push(new RacesMenu(this.ctx)),
        sub: (v) => (v.races.defs.length ? `${v.races.defs.length} courses` : ''),
      },
      {
        label: 'Stable',
        run: () => {
          // A race in progress (or counting down at its gate) can't change wyvern mid-run:
          // abandon it first, or keep racing.
          if (!racing) return this.actions.openStable();
          const name = view.races.defs.find((d) => d.id === view.races.activeId)?.name ?? 'the race';
          this.push(
            new Dialog(this.ctx, 'Abandon the race?', `The Stable is closed while you race. Abandon ${name} and open the Stable?`, [
              { label: 'Keep racing', run: () => {}, cancel: true, primary: true },
              {
                label: 'Abandon',
                run: () => {
                  this.actions.quitRace();
                  this.actions.openStable();
                },
              },
            ]),
          );
        },
      },
      {
        label: 'Collection',
        run: () => this.push(new CollectionMenu(this.ctx)),
        sub: (v) => (v.collectibles.total.feathers ? `${v.collectibles.found.feathers}/${v.collectibles.total.feathers} feathers` : ''),
      },
      { label: 'Photo mode', run: () => this.push(new PhotoMode(this.ctx)) },
      { label: 'Settings', run: () => this.push(new SettingsMenu(this.ctx)) },
      { label: 'Controls', run: () => this.push(new ControlsMenu(this.ctx)) },
    );
    if (this.actions.quitToTitle) {
      entries.push({
        label: 'Quit to title',
        run: () => {
          const quit = () => this.actions.quitToTitle?.();
          if (!racing) return quit();
          this.push(
            new Dialog(this.ctx, 'Quit to the title?', 'The race in progress will be abandoned. Everything else is saved.', [
              { label: 'Keep flying', run: () => {}, cancel: true, primary: true },
              { label: 'Quit', run: quit },
            ]),
          );
        },
      });
    }
    return entries;
  }

  private showTutorialMap(): void {
    if (!this.view?.tutorialShrine) return;
    this.actions.pause();
    const choose = (value: 'active' | 'skipped') => {
      this.view!.save.data.firstLeadGuide = value;
      this.view!.save.save();
      this.actions.resume();
    };
    this.push(new TutorialMap(this.ctx, () => choose('active'), () => choose('skipped'), () => this.actions.resume()));
  }

  showFirstLead(): void {
    if (!this.view) return;
    this.push(new Dialog(this.ctx, 'Shrine of the First Wind', FIRST_LEAD_TRANSLATION,
      [{ label: 'Return to the Drift', primary: true, cancel: true, run: () => this.actions.resume() }]));
  }

  private leaveStable(): void {
    // Opened from the title: straight back to it, never through 'play' (which would ask for
    // pointer lock on the way and could leave the mouse captured on the title screen).
    if (this.stableFromTitle && this.actions.quitToTitle) this.actions.quitToTitle();
    else this.actions.closeStable();
  }

  // --- Panel stack ----------------------------------------------------------------------------

  private push(p: Panel): void {
    const top = this.stack[this.stack.length - 1];
    top?.onHide();
    this.stack.push(p);
    if (!p.root.isConnected) this.stackLayer.append(p.root);
    this.fillGlyphs(p.root);
    p.onShow();
    this.skipInput = true;
  }

  private pop(p?: Panel): void {
    const target = p ?? this.stack[this.stack.length - 1];
    const i = this.stack.indexOf(target);
    if (i < 0) return;
    const wasTop = i === this.stack.length - 1;
    this.stack.splice(i, 1);
    target.onHide();
    if (target !== this.title) target.dispose();
    else target.root.remove();
    if (wasTop) this.stack[this.stack.length - 1]?.onShow();
    this.skipInput = true;
  }

  private clearStack(): void {
    while (this.stack.length) {
      const p = this.stack.pop()!;
      p.onHide();
      if (p === this.title) p.root.remove();
      else p.dispose();
    }
  }

  // --- Results --------------------------------------------------------------------------------

  private pushResults(): void {
    const r = this.result!;
    r.unlocked = [...this.runUnlocks];
    this.push(
      new Results(
        this.ctx,
        r,
        () => this.actions.beginRace(r.raceId),
        () => this.actions.resume(),
      ),
    );
  }

  private subscribe(): void {
    const ev = this.events;
    ev.on('raceStart', () => {
      this.runUnlocks = [];
    });
    ev.on('unlock', (e: GameEvents['unlock']) => {
      this.runUnlocks.push(e.name);
    });
    ev.on('raceFinish', (e: GameEvents['raceFinish']) => {
      const def = this.view?.races.defs.find((d) => d.id === e.raceId);
      this.result = {
        raceId: e.raceId,
        def,
        timeMs: e.timeMs,
        medal: e.medal,
        newBest: e.newBest,
        previousBestMs: e.previousBestMs,
        unlocked: [],
      };
      this.resultsIn = RESULTS_DELAY;
    });
  }

  private updateResults(dt: number): void {
    if (this.resultsIn <= 0) return;
    this.resultsIn -= dt;
    if (this.resultsIn > 0) return;
    if (!this.result) return;
    if (this.screen === 'play') {
      this.showResultsOnPause = true;
      this.actions.pause();
    } else if (this.screen === 'pause') {
      this.pushResults();
    }
  }

  // --- Frame ----------------------------------------------------------------------------------

  update(dt: number, gameView: GameView): void {
    const view = this.withDebug(gameView);
    this.view = view;
    if (this.pendingScreen) {
      const s = this.pendingScreen;
      this.pendingScreen = null;
      this.applyScreen(s);
    }

    // Device and accessibility.
    const dev = glyphDevice(view.input.device, view.input.padStyle);
    if (view.input.padStyle) this.padStyleSeen = view.input.padStyle;
    if (dev !== this.device) {
      this.device = dev;
      this.root.dataset.device = dev;
      this.hud.refreshGlyphs();
      this.fillGlyphs(this.root);
      this.tips.refreshGlyphs();
    }
    const reduced = view.save.data.settings.reducedMotion;
    if (reduced !== this.reduced) {
      this.reduced = reduced;
      this.root.classList.toggle('is-reduced', reduced);
    }

    this.updateResults(dt);

    // Input: the top panel, or the HUD toggle during play.
    const p = view.input.frame.pressed;
    if (this.skipInput) {
      this.skipInput = false;
    } else {
      const top = this.stack[this.stack.length - 1];
      if (top) top.input(p);
      else if (this.screen === 'play' && p.toggleHud) {
        this.hudHidden = !this.hudHidden;
        this.hudNoteLeft = this.hudHidden ? 3 : 0;
        this.sound('select');
      }
    }

    // HUD.
    const top = this.stack[this.stack.length - 1];
    const hudVisible = this.screen === 'play' && !this.hudHidden && (!top || !top.hidesHud) && view.player.mode !== 'respawning';
    this.hud.setVisible(hudVisible);
    this.hud.update(dt, view);
    this.raceHud.update(dt, view, hudVisible);
    this.tips.update(dt, view, hudVisible);
    this.windline?.update(view, hudVisible && !this.capturesInput);
    this.gaugeTip.set(this.tips.gaugeOn);
    this.windline?.layout();
    if (hudVisible && view.tutorialShrine && view.save.data.settings.showControlHints &&
        view.races.state === 'idle' && readyForShrine(view.save.data)) {
      // Remember the offer immediately so backing out does not reopen it every frame.
      view.save.data.firstLeadGuide = 'active';
      view.save.save();
      this.showTutorialMap();
    }
    if (this.hudNoteLeft > 0) this.hudNoteLeft -= dt;
    this.hudNote.classList.toggle('is-on', this.hudNoteLeft > 0 && this.screen === 'play');

    // Panels.
    for (const panel of this.stack) panel.update(dt, view);
    // Shade the world behind sheets and dialogs; the title, the Stable and photo mode frame it.
    const veil = !!top && !(top instanceof Title) && !(top instanceof Stable) && !(top instanceof PhotoMode);
    this.veil.classList.toggle('is-on', veil);
  }

  // --- Services -------------------------------------------------------------------------------

  private settings(): Settings {
    return this.view!.save.data.settings;
  }

  private sound(kind: UiSound): void {
    this.events.emit('uiSound', { kind });
  }

  private fillGlyphs(root: Element): void {
    const dev = this.device;
    const style = dev === 'keyboard' ? this.padStyleSeen : dev;
    root.querySelectorAll<HTMLElement>('[data-glyph]').forEach((el) => {
      el.innerHTML =
        el.dataset.axis === 'h' && dev === 'keyboard'
          ? keyGlyph('ArrowLeft') + keyGlyph('ArrowRight')
          : glyphHtml(el.dataset.glyph as ControlAction, dev);
    });
    root.querySelectorAll<HTMLElement>('[data-glyph-pad]').forEach((el) => {
      el.innerHTML = padGlyph(el.dataset.glyphPad as PadControl, style);
    });
    root.querySelectorAll<HTMLElement>('[data-glyph-key]').forEach((el) => {
      el.innerHTML = keyGlyph(el.dataset.glyphKey!);
    });
  }

  // --- Debug ------------------------------------------------------------------------------------

  /**
   * Showcases: merge fake systems (races, collectibles, input device...) over the GameView the
   * Game passes in, so every screen can be staged before the real systems exist.
   */
  setDebugView(patch: Partial<GameView> | null): void {
    this.debugView = patch;
    this.patchedView = null;
  }

  /** Showcases: open a screen's panel directly (sheets over the pause menu, the title menu...). */
  debugOpen(what: 'titleMenu' | 'races' | 'collection' | 'settings' | 'controls' | 'credits' | 'photo' | 'results', arg?: number): void {
    if (!this.view) return;
    switch (what) {
      case 'titleMenu':
        this.title?.toMenu(false);
        break;
      case 'races':
        this.push(new RacesMenu(this.ctx));
        break;
      case 'collection':
        this.push(new CollectionMenu(this.ctx));
        break;
      case 'settings':
        this.push(new SettingsMenu(this.ctx, arg ?? 0));
        break;
      case 'controls':
        this.push(new ControlsMenu(this.ctx));
        break;
      case 'credits':
        this.push(new CreditsMenu(this.ctx));
        break;
      case 'photo':
        this.push(new PhotoMode(this.ctx));
        break;
      case 'results':
        if (this.result) this.pushResults();
        break;
    }
  }

  /** The panel on top of the stack (debug/tests). */
  get topPanel(): Panel | undefined {
    return this.stack[this.stack.length - 1];
  }

  private withDebug(view: GameView): GameView {
    const patch = this.debugView;
    if (!patch) return view;
    const out = (this.patchedView ??= { ...view });
    Object.assign(out, view, patch);
    return out;
  }
}
