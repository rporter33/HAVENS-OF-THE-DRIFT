// The pause menu: a glass column on the left with where you are, the menu, and a few numbers
// from your journey. Submenus open as sheets over the frozen world.

import type { InputPresses } from '../core/types';
import type { GameView } from '../game/contracts';
import { buildLabel } from '../core/build';
import { LAYOUT } from '../world/layout';
import { headingOf } from './compass';
import { LiveText, div, fromHtml, h } from './dom';
import { compassWord, formatPlayTime, timeOfDayName, weatherName } from './format';
import { ICONS, RULE, medalIcon } from './icons';
import { Panel, hintBar, type UiCtx } from './panel';

export interface PauseEntry {
  label: string;
  run(): void;
  /** Shown faintly to the right of the label (e.g. "2 / 7"). */
  sub?: (view: GameView) => string;
}

/** "At Cascade Isle", "Near Rootfall", "Over the Drift, south of Windhaven". */
export function whereAmI(x: number, z: number, discovered: readonly string[]): string {
  let best = Infinity;
  let name = '';
  let id = '';
  for (const l of LAYOUT.landmarks) {
    const d = Math.hypot(l.position[0] - x, l.position[2] - z);
    if (d < best) {
      best = d;
      name = l.name;
      id = l.id;
    }
  }
  const known = discovered.includes(id) || id === 'roost';
  if (best < 260) return known ? `At ${name}` : 'Somewhere uncharted';
  if (best < 700 && known) return `Near ${name}`;
  // Name the nearest place you know and which way it lies from here.
  let kd = Infinity;
  let kname = 'Windhaven';
  let kx = 0;
  let kz = 0;
  for (const l of LAYOUT.landmarks) {
    if (!(discovered.includes(l.id) || l.id === 'roost')) continue;
    const d = Math.hypot(l.position[0] - x, l.position[2] - z);
    if (d < kd) {
      kd = d;
      kname = l.name;
      kx = l.position[0];
      kz = l.position[2];
    }
  }
  return `Over the Drift, ${compassWord(headingOf(x - kx, z - kz))} of ${kname}`;
}

export class Pause extends Panel {
  override hidesHud = true;
  private where: LiveText;
  private when: LiveText;
  private feathers: LiveText;
  private medals: LiveText;
  private time: LiveText;
  private subs: { live: LiveText; fn: (v: GameView) => string }[] = [];
  private panel: HTMLElement;

  constructor(ctx: UiCtx, entries: PauseEntry[]) {
    super(ctx, 'dw-pause-layer');
    const whereEl = h('div', { class: 'dw-pause-where' });
    const whenEl = h('div', { class: 'dw-kicker' });
    const items = div('dw-pause-items');
    for (const e of entries) {
      const sub = h('span', { class: 'dw-item-sub' });
      const el = div('dw-item', h('span', { text: e.label }), sub);
      if (e.sub) this.subs.push({ live: new LiveText(sub), fn: e.sub });
      this.scope.add({
        el,
        activate: () => {
          this.ctx.sound('select');
          e.run();
        },
      });
      items.append(el);
    }
    this.scope.wrap = true;
    const stat = (icon: string, label: string): [HTMLElement, LiveText] => {
      const v = h('span');
      return [div('dw-stat', h('b', {}, fromHtml(icon), v), h('span', { text: label })), new LiveText(v)];
    };
    const [fEl, fLive] = stat(ICONS.feather, 'Feathers');
    const [mEl, mLive] = stat(medalIcon('gold'), 'Gold medals');
    const [tEl, tLive] = stat(ICONS.clock, 'Time aloft');
    this.feathers = fLive;
    this.medals = mLive;
    this.time = tLive;
    const stats = div('dw-pause-stats', fEl, mEl, tEl);
    this.panel = div(
      'dw-panel dw-pause dw-enter',
      div('dw-pause-head', whenEl, h('div', { class: 'dw-pause-title', text: 'Paused' }), whereEl, fromHtml(RULE)),
      items,
      stats,
      // Which release this is, so a player can tell whether they're on the latest.
      h('div', { class: 'dw-pause-build', text: buildLabel() }),
    );
    this.where = new LiveText(whereEl);
    this.when = new LiveText(whenEl);
    this.root.append(
      this.panel,
      div('dw-pause-foot', hintBar([
        ['confirm', 'Select'],
        ['back', 'Resume'],
      ])),
    );
    ctx.fillGlyphs(this.root);
    this.scope.focus(0, { scroll: false });
  }

  override input(p: InputPresses): void {
    // Start / Menu (without the keyboard's Esc doubling as Back) resumes from anywhere in the list.
    if (p.pause && !p.back) {
      this.ctx.sound('back');
      this.ctx.actions.resume();
      return;
    }
    super.input(p);
  }

  override onBack(): void {
    this.ctx.sound('back');
    this.ctx.actions.resume();
  }

  override onShow(): void {
    this.root.style.opacity = '';
    this.refresh(this.ctx.view);
  }

  override onHide(): void {
    this.root.style.opacity = '0';
  }

  private refreshIn = 0;

  override update(dt: number, view: GameView): void {
    // The world is paused; a few refreshes a second keep "where / when" honest.
    this.refreshIn -= dt;
    if (this.refreshIn > 0) return;
    this.refreshIn = 0.25;
    this.refresh(view);
  }

  private refresh(view: GameView): void {
    const save = view.save.data;
    const p = view.player.position;
    this.where.set(whereAmI(p.x, p.z, save.discovered));
    this.when.set(`${timeOfDayName(view.sky.timeOfDay)} · ${weatherName(view.weather.kind)}`);
    const c = view.collectibles;
    this.feathers.set(c.total.feathers > 0 ? `${c.found.feathers}/${c.total.feathers}` : `${c.found.feathers}`);
    let gold = 0;
    for (const id in save.races) if (save.races[id].medal === 'gold') gold++;
    this.medals.set(view.races.defs.length > 0 ? `${gold}/${view.races.defs.length}` : `${gold}`);
    this.time.set(formatPlayTime(save.playTime));
    for (const s of this.subs) s.live.set(s.fn(view));
  }
}
