// The title: the HAVENS OF THE DRIFT wordmark with wind sweeping through it, laid over the live 3D scene
// (the camera's title rig frames the rider and wyvern at the Roost). "Press (A) / Enter" first,
// then the main menu: Fly, Stable, Settings, Controls, Credits.

import type { InputPresses } from '../core/types';
import { div, fromHtml, h } from './dom';
import { RULE, WING_PATHS } from './icons';
import { Panel, hintBar, type UiCtx } from './panel';

/** Brush strokes of wind through the logotype (viewBox 0 0 920 280, the word sits mid-height). */
const WIND: { d: string; w: number; dur: number; delay: number; alpha: number }[] = [
  { d: 'M10 196 C170 150 330 236 500 176 S790 112 912 148', w: 2.4, dur: 7.5, delay: 0, alpha: 0.75 },
  { d: 'M60 92 C240 54 410 122 590 82 S820 36 890 66', w: 1.6, dur: 8.5, delay: 2.2, alpha: 0.6 },
  { d: 'M120 236 C300 258 470 204 610 218 C690 226 716 252 690 264 C664 274 640 254 662 242', w: 1.8, dur: 9, delay: 4.1, alpha: 0.6 },
  { d: 'M300 36 C420 16 560 46 700 26', w: 1.2, dur: 7, delay: 5.6, alpha: 0.5 },
  { d: 'M-20 140 C120 120 220 160 330 140', w: 1.3, dur: 6.5, delay: 1.2, alpha: 0.5 },
];

function windSvg(): string {
  const paths = WIND.map(
    (p) =>
      `<path d="${p.d}" pathLength="100" stroke-width="${p.w}" style="--dur:${p.dur}s;--delay:${p.delay}s;--alpha:${p.alpha}"/>`,
  ).join('');
  return `<svg class="dw-wind" viewBox="0 0 920 280" aria-hidden="true">${paths}</svg>`;
}

/** Twin wings meeting at a diamond: the emblem above the word. */
export function emblemSvg(cls = 'dw-logo-mark'): string {
  return (
    `<svg class="${cls}" viewBox="0 0 48 24" aria-hidden="true"><g fill="currentColor">` +
    `<g transform="translate(21.5 1)">${WING_PATHS}</g>` +
    `<g transform="translate(26.5 1) scale(-1 1)">${WING_PATHS}</g>` +
    '<path d="M24 12.4 L26.2 15.6 L24 18.8 L21.8 15.6 Z"/></g></svg>'
  );
}

export interface TitleMenuEntry {
  label: string;
  run(): void;
}

export class Title extends Panel {
  override hidesHud = true;
  /** 'press' until the first confirm, then the menu. */
  phase: 'press' | 'menu' = 'press';
  private press: HTMLElement;
  private menu: HTMLElement;
  private foot: HTMLElement;

  constructor(ctx: UiCtx, entries: TitleMenuEntry[]) {
    super(ctx, 'dw-title');
    const logo = div(
      'dw-logo',
      fromHtml(emblemSvg()),
      div(
        'dw-logo-wordwrap',
        fromHtml(windSvg()),
        // Two tiers: HAVENS carries the weight, "of the" sits small between hairlines, DRIFT
        // stretches wide underneath like a horizon. The runtime name stays Driftwing (save ids,
        // package, scene object names); only what the player reads changes.
        div(
          'dw-logo-word',
          h('span', { class: 'dw-logo-havens', text: 'Havens' }),
          div('dw-logo-of', h('i'), h('span', { text: 'of the' }), h('i')),
          h('span', { class: 'dw-logo-drift', text: 'Drift' }),
        ),
      ),
      fromHtml(RULE),
      h('div', { class: 'dw-logo-tag', text: 'Ride the wind between the havens' }),
    );
    (logo.querySelector('.dw-logo-wordwrap') as HTMLElement).style.position = 'relative';

    this.press = div(
      'dw-press',
      h('span', { text: 'Press' }),
      h('span', { class: 'dw-hint-g', attrs: { 'data-glyph-pad': 'A' } }),
      h('span', { class: 'dw-press-or', text: 'or' }),
      h('span', { class: 'dw-hint-g', attrs: { 'data-glyph-key': 'Enter' } }),
    );
    this.press.addEventListener('click', () => this.toMenu());

    this.menu = div('dw-title-menu dw-hidden');
    for (const e of entries) {
      const el = div('dw-item', h('span', { text: e.label }));
      this.scope.add({ el, activate: () => {
        this.ctx.sound('select');
        e.run();
      } });
      this.menu.append(el);
    }
    this.scope.wrap = true;

    this.foot = div(
      'dw-title-foot',
      h('span', { text: 'A game about wind, wings and the long way round' }),
      hintBar([
        ['confirm', 'Select'],
        ['navigate', 'Move'],
      ]),
    );
    this.foot.querySelector('.dw-hints')!.classList.add('dw-hidden');
    this.root.append(logo, this.press, this.menu, this.foot);
    ctx.fillGlyphs(this.root);
  }

  /** Skip straight to the menu (returning to the title later in a session). */
  toMenu(sound = true): void {
    if (this.phase === 'menu') return;
    this.phase = 'menu';
    if (sound) this.ctx.sound('select');
    this.press.classList.add('dw-hidden');
    this.menu.classList.remove('dw-hidden');
    this.menu.classList.add('dw-enter');
    this.foot.querySelector('.dw-hints')!.classList.remove('dw-hidden');
    this.scope.focus(0, { scroll: false });
  }

  override input(p: InputPresses): void {
    if (this.phase === 'press') {
      if (p.confirm || p.pause) this.toMenu();
      return;
    }
    if (p.back) {
      // Back on the main menu returns to the attract screen.
      this.ctx.sound('back');
      this.phase = 'press';
      this.menu.classList.add('dw-hidden');
      this.press.classList.remove('dw-hidden');
      this.foot.querySelector('.dw-hints')!.classList.add('dw-hidden');
      return;
    }
    this.scope.handle(p);
  }

  override onShow(): void {
    this.root.classList.remove('is-dim');
  }

  override onHide(): void {
    this.root.classList.add('is-dim');
  }
}
