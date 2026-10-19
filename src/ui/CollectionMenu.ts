// Collection: feathers found, relics (with a parchment lore card for each one you hold), the
// landmarks you have discovered, and your medals.

import type { GameView } from '../game/contracts';
import { LAYOUT } from '../world/layout';
import { headingOf } from './compass';
import { div, fromHtml, h } from './dom';
import { compassWord } from './format';
import { ICONS, medalIcon } from './icons';
import { Panel, hintBar, sheet, type UiCtx } from './panel';
import { tabStrip } from './SettingsMenu';
import { medalTally, relicList } from './viewModel';

const TABS = ['Relics', 'Landmarks'];

function summaryCell(icon: string, value: string, label: string, frac: number | null): HTMLElement {
  const cell = div('dw-summary-cell', fromHtml(icon), div('', h('b', { text: value }), h('span', { text: label })));
  if (frac !== null) {
    const bar = div('dw-bar', h('i'));
    (bar.firstElementChild as HTMLElement).style.width = `${Math.round(frac * 100)}%`;
    cell.lastElementChild!.append(bar);
  }
  return cell;
}

export class CollectionMenu extends Panel {
  private tab = 0;
  private tabs: HTMLElement[];
  private content: HTMLElement;

  constructor(ctx: UiCtx) {
    super(ctx, 'dw-collection-menu');
    const view = ctx.view;
    const s = sheet('Collection', 'Your journey');
    const strip = tabStrip(TABS, (i) => this.setTab(i, true));
    this.tabs = strip.tabs;

    // Summary: feathers, relics, landmarks, medals.
    const c = view.collectibles;
    const relics = relicList(view);
    const relicsFound = relics.filter((r) => view.save.data.collected.includes(r.id)).length;
    const landmarks = LAYOUT.landmarks;
    const disc = landmarks.filter((l) => l.id === 'roost' || view.save.data.discovered.includes(l.id)).length;
    const tally = medalTally(view);
    const medals = div(
      'dw-summary-cell',
      div(
        '',
        div(
          'dw-medals-mini',
          ...(['gold', 'silver', 'bronze'] as const).map((m) => h('span', {}, fromHtml(medalIcon(m)), String(tally[m]))),
        ),
        h('span', { text: 'Medals' }),
      ),
    );
    const totalFeathers = c.total.feathers;
    const summary = div(
      'dw-summary',
      summaryCell(ICONS.feather, totalFeathers ? `${c.found.feathers} / ${totalFeathers}` : String(c.found.feathers), 'Feathers', totalFeathers ? c.found.feathers / totalFeathers : 0),
      summaryCell(ICONS.relic, `${relicsFound} / ${relics.length}`, 'Relics', relics.length ? relicsFound / relics.length : 0),
      summaryCell(ICONS.landmark, `${disc} / ${landmarks.length}`, 'Landmarks', disc / landmarks.length),
      medals,
    );
    s.head.append(strip.el);
    this.content = div('dw-collection');
    s.body.append(summary, this.content);
    s.foot.append(
      h('span', { class: 'dw-foot-note', text: 'Feathers and relics unlock new looks in the Stable.' }),
      hintBar([
        ['tabNext', 'Section'],
        ['back', 'Back'],
      ]),
    );
    s.root.classList.add('dw-enter');
    this.root.append(s.root);
    ctx.fillGlyphs(this.root);
    this.setTab(0, false);
  }

  override onTab(dir: -1 | 1): boolean {
    this.setTab((this.tab + dir + TABS.length) % TABS.length, true);
    return true;
  }

  private setTab(i: number, sound: boolean): void {
    if (sound && i !== this.tab) this.ctx.sound('tab');
    this.tab = i;
    this.tabs.forEach((t, j) => t.classList.toggle('is-active', j === i));
    this.scope.clear();
    this.content.replaceChildren(i === 0 ? this.relics(this.ctx.view) : this.landmarks(this.ctx.view));
    this.scope.focus(0, { scroll: false });
  }

  private relics(view: GameView): HTMLElement {
    const grid = div('dw-grid');
    const loreTitle = h('div', { class: 'dw-lore-title' });
    const loreText = h('p');
    const lore = div('dw-lore', loreTitle, loreText);
    for (const r of relicList(view)) {
      const found = view.save.data.collected.includes(r.id);
      const card = div(`dw-relic${found ? '' : ' is-missing'}`, fromHtml(ICONS.relic), h('div', { class: 'dw-relic-name', text: found ? r.name : 'Not yet found' }));
      this.scope.add({
        el: card,
        onFocus: () => {
          loreTitle.textContent = found ? r.name : 'An unfound relic';
          loreText.textContent = found ? r.lore : 'Somewhere in the Drift, something old is waiting to be found. Explore the far islands, the falls and the ruins.';
        },
      });
      grid.append(card);
    }
    return div('', grid, lore);
  }

  private landmarks(view: GameView): HTMLElement {
    const list = div('dw-landmarks');
    const roost = LAYOUT.landmarks.find((l) => l.id === 'roost');
    for (const l of LAYOUT.landmarks) {
      const known = l.id === 'roost' || view.save.data.discovered.includes(l.id);
      const dir = roost && l !== roost ? compassWord(headingOf(l.position[0] - roost.position[0], l.position[2] - roost.position[2])) : '';
      const el = div(
        `dw-landmark${known ? '' : ' is-missing'}`,
        fromHtml(ICONS.landmark),
        div('', h('b', { text: known ? l.name : 'Undiscovered' }), h('span', { text: known ? l.description : `Somewhere to the ${dir} of Windhaven.` })),
      );
      this.scope.add({ el });
      list.append(el);
    }
    return list;
  }
}
