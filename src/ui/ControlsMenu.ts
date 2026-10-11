// Controls: the control scheme (scheme.ts SCHEME) grouped by context, drawn with the glyphs of
// an Xbox pad, a PlayStation pad, or keyboard and mouse — opening on whichever you last used.

import type { InputPresses } from '../core/types';
import { SCHEME, type Binding } from '../input/scheme';
import { div, h } from './dom';
import { bindingKeyboardHtml, bindingPadHtml, controlLabel, type GlyphDevice } from './glyphs';
import { Panel, hintBar, sheet, type UiCtx } from './panel';
import { tabStrip } from './SettingsMenu';

const DEVICES: { id: Exclude<GlyphDevice, 'generic'>; label: string }[] = [
  { id: 'xbox', label: 'Xbox' },
  { id: 'playstation', label: 'PlayStation' },
  { id: 'keyboard', label: 'Keyboard & Mouse' },
];

const GROUPS: { context: Binding['context']; title: string }[] = [
  { context: 'flight', title: 'In the air' },
  { context: 'ground', title: 'On the ground' },
  { context: 'traversal', title: 'Windline · on foot & freefall' },
  { context: 'general', title: 'Anywhere' },
  { context: 'menu', title: 'Menus & the Stable' },
];

export class ControlsMenu extends Panel {
  private tab: number;
  private tabs: HTMLElement[];
  private body: HTMLElement;

  constructor(ctx: UiCtx) {
    super(ctx, 'dw-controls-menu');
    const s = sheet('Controls', 'Options');
    const strip = tabStrip(
      DEVICES.map((d) => d.label),
      (i) => this.setTab(i, true),
    );
    s.head.append(strip.el);
    this.tabs = strip.tabs;
    this.body = s.body;
    s.foot.append(
      h('span', { class: 'dw-foot-note', text: 'Pitch: push forward to dive, pull back to climb (invert in Settings).' }),
      hintBar([
        ['tabNext', 'Device'],
        ['back', 'Back'],
      ]),
    );
    s.root.classList.add('dw-enter');
    this.root.append(s.root);
    const dev = ctx.device();
    this.tab = Math.max(0, DEVICES.findIndex((d) => d.id === (dev === 'generic' ? 'xbox' : dev)));
    this.setTab(this.tab, false);
    ctx.fillGlyphs(this.root);
  }

  override onTab(dir: -1 | 1): boolean {
    this.setTab((this.tab + dir + DEVICES.length) % DEVICES.length, true);
    return true;
  }

  override input(p: InputPresses): void {
    // Nothing to select here: left/right switch device, up/down scroll.
    if (p.navLeft || p.navRight) {
      this.onTab(p.navLeft ? -1 : 1);
      return;
    }
    if (p.navUp || p.navDown) {
      this.body.scrollBy({ top: (p.navUp ? -1 : 1) * this.body.clientHeight * 0.4, behavior: this.ctx.reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    super.input(p);
  }

  private setTab(i: number, sound: boolean): void {
    if (sound && i !== this.tab) this.ctx.sound('tab');
    this.tab = i;
    this.tabs.forEach((t, j) => t.classList.toggle('is-active', j === i));
    const dev = DEVICES[i].id;
    const grid = div('dw-controls');
    for (const g of GROUPS) {
      const block = div('dw-control-block', h('div', { class: 'dw-group-title', text: g.title.toUpperCase() }));
      for (const b of SCHEME) {
        if (b.context !== g.context) continue;
        // Free look only exists for mouse steering; on a pad the right stick always looks.
        if (b.action === 'freeLook' && dev !== 'keyboard') continue;
        const glyphs = dev === 'keyboard' ? bindingKeyboardHtml(b) : bindingPadHtml(b, dev);
        const label = b.action === 'lance' && this.ctx.settings().windlineToggle
          ? 'Cast Windline at solid surfaces within 65 m (press again to detach)' : b.label;
        block.append(div('dw-control', h('span', { class: 'dw-control-l', text: controlLabel(label, dev) }), h('span', { class: 'dw-control-g', html: glyphs })));
      }
      grid.append(block);
    }
    this.body.replaceChildren(grid);
  }
}
