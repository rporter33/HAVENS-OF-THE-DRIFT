// Credits: who made what, and the open fonts and libraries the game stands on.

import type { InputPresses } from '../core/types';
import { div, fromHtml, h } from './dom';
import { RULE } from './icons';
import { Panel, hintBar, sheet, type UiCtx } from './panel';
import { emblemSvg } from './Title';

const SECTIONS: [string, string[]][] = [
  ['A GAME CREATED BY', ['Oberon']],
  ['FLIGHT & FEEL', ['Weighty sim-lite flight model, stalls, dives and stamina', 'Player states: landing, walking, falling and the catch']],
  ['THE DRIFT', ['Floating islands, spires and the Eye of the Gale', 'Grass, groves, waterfalls and the Roost']],
  ['SKY & WEATHER', ['Golden hours, night skies, clouds and rain']],
  ['WYVERNS & RIDERS', ['Four breeds, procedural bodies and animation', 'Riders, outfits and cloth']],
  ['RACES & RELICS', ['Ring courses, sprints, ghosts, feathers and relics']],
  ['CAMERA, CONTROLS & INTERFACE', ['Controller-first input and haptics, cameras', 'Title, HUD, menus and the Stable']],
  ['SOUND', ['Procedural wind, wings and a generative score']],
  ['BUILT WITH', ['three.js · TypeScript · Vite']],
  ['TYPE', ['Cinzel by Natanael Gama · Alegreya Sans by Juan Pablo del Peral (Huerta Tipográfica)', 'Both under the SIL Open Font License']],
  ['THANK YOU', ['For flying with us. Mind the clouds.']],
];

export class CreditsMenu extends Panel {
  private body: HTMLElement;

  constructor(ctx: UiCtx) {
    super(ctx, 'dw-credits-menu');
    const s = sheet('Credits');
    const c = div('dw-credits', fromHtml(emblemSvg('dw-logo-mark')), h('div', { class: 'dw-credits-logo', text: 'HAVENS OF THE DRIFT' }), fromHtml(RULE));
    for (const [title, lines] of SECTIONS) {
      c.append(h('h3', { text: title }));
      for (const l of lines) c.append(h('p', { text: l }));
    }
    s.body.append(c);
    this.body = s.body;
    s.foot.append(hintBar([
      ['navigate', 'Scroll'],
      ['back', 'Back'],
    ]));
    s.root.classList.add('dw-enter');
    this.root.append(s.root);
    ctx.fillGlyphs(this.root);
  }

  override input(p: InputPresses): void {
    if (p.navUp || p.navDown) {
      this.body.scrollBy({ top: (p.navUp ? -1 : 1) * this.body.clientHeight * 0.4, behavior: this.ctx.reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    if (p.confirm) {
      this.onBack();
      return;
    }
    super.input(p);
  }
}
