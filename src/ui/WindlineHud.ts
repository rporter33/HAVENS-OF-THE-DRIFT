import type { GameView } from '../game/contracts';
import { LANCE } from '../traversal/tuning';
import { div, h, LiveText } from './dom';
import type { ControlAction } from '../input/scheme';
import { placeWindlinePanel } from './hudPlacement';

/** Normal-game feedback. No tutorial rewards or physics live in this overlay. */
export class WindlineHud {
  readonly root = div('dw-layer dw-windline');
  private readonly reticle = h('div', { class: 'dw-windline-reticle', attrs: { id: 'sky-lance-reticle', 'aria-hidden': 'true' },
    html: '<svg viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="19" fill="none" stroke="currentColor" stroke-width="1"/><path d="M28 1v8M28 47v8M1 28h8M47 28h8" stroke="#AA8656" stroke-width="2"/><circle cx="28" cy="28" r="2" fill="currentColor"/></svg><i data-impact></i><span data-aim-status></span>' });
  private readonly boostText = new LiveText(h('span', { attrs: { 'data-boost-text': '' } }));
  private readonly boostFill = h('div', { attrs: { 'data-boost-fill': '' } });
  private readonly boost = h('div', { class: 'dw-windline-boost', attrs: { id: 'windline-boost-hud', role: 'status' } },
    this.boostText.el, div('dw-windline-meter', this.boostFill));
  private readonly cast = h('p', {}, 'Aim with the camera. ', this.glyph('lance'), ' casts at solid surfaces within 65 m.');
  private readonly retain = new LiveText(h('p'));
  private readonly linked = h('p', {}, this.glyph('tetherPull'), ' pulls inward. Release the line to keep your momentum.');
  private readonly free = h('p', {}, this.glyph('airSteer'), ' steers; forward dives, back brakes. ', this.glyph('airBoost'), ' boosts.');
  private readonly call = h('p', {}, 'When free, hold ', this.glyph('recall'), ' to recall your wyvern.');
  private readonly leap = h('p', {}, 'Hold ', this.glyph('leap'), ' to leap. Release, then hold again to recall.');
  private readonly hints = div('dw-windline-hints', this.cast, this.retain.el, this.linked, this.free, this.call, this.leap);
  private readonly compactCast = h('span', {}, this.glyph('lance'), ' Cast · 65 m');
  private readonly compactLeap = h('span', {}, this.glyph('leap'), ' Hold to leap');
  private readonly compactPull = h('span', {}, this.glyph('tetherPull'), ' Pull · ', this.glyph('lance'), ' Release');
  private readonly compactFree = h('span', {}, this.glyph('airBoost'), ' Boost · ', this.glyph('recall'), ' Hold to recall');
  private readonly compact = div('dw-windline-compact', this.compactCast, this.compactLeap, this.compactPull, this.compactFree);
  private readonly panel = div('dw-windline-panel', h('strong', { class: 'dw-windline-title', text: 'Windline' }), this.boost, this.hints, this.compact);

  constructor(fillGlyphs: (el: HTMLElement) => void) {
    this.root.append(this.reticle, this.panel);
    this.root.hidden = true;
    fillGlyphs(this.root);
  }

  private glyph(action: ControlAction): HTMLElement {
    return h('span', { class: 'dw-hint-g', attrs: { 'data-glyph': action } });
  }

  update(view: GameView, visible: boolean): void {
    const p = view.player, lance = p.skyLance, boost = p.airBoost;
    const riderFree = p.mode === 'onFoot' || p.mode === 'traversing' || p.mode === 'falling';
    const airborne = p.mode === 'traversing';
    const hints = view.save.data.settings.showControlHints && (riderFree || p.mode === 'flying');
    this.panel.dataset.context = `${p.mode}/${hints}/${!!lance?.rope}`;
    this.panel.dataset.essential = String(airborne && !!boost);
    this.root.hidden = !visible || !lance || (!riderFree && !hints);
    this.reticle.hidden = !riderFree;
    this.panel.hidden = !hints && !airborne;
    this.hints.hidden = !hints;
    this.cast.hidden = this.retain.el.hidden = !riderFree;
    this.linked.hidden = !lance?.rope;
    this.free.hidden = !airborne || !!lance?.rope;
    this.call.hidden = !riderFree || !!lance?.rope;
    this.leap.hidden = p.mode !== 'flying';
    this.compact.hidden = !hints;
    this.compactCast.hidden = !riderFree || airborne;
    this.compactLeap.hidden = p.mode !== 'flying';
    this.compactPull.hidden = !lance?.rope;
    this.compactFree.hidden = !airborne || !!lance?.rope;
    this.retain.set(p.lanceInteraction === 'toggle' ? 'Press again to release.' : 'Hold to retain; release to detach.');
    this.boost.hidden = !airborne || !boost;
    if (lance && boost && airborne) {
      const label = lance.rope ? (lance.pullTime > 0 ? 'PULLING' : 'TETHER PULL')
        : boost.remaining > 0 ? 'BOOSTING' : boost.available ? 'BOOST READY' : `BOOST · ${boost.cooldown.toFixed(1)} s`;
      this.boostText.set(label);
      this.boostFill.style.width = `${100 * (1 - boost.cooldown / LANCE.boostCooldown)}%`;
      this.boost.dataset.state = lance.rope ? 'tether' : boost.available ? 'ready' : 'cooldown';
      this.boost.setAttribute('aria-label', lance.rope ? 'Tether pull available' : boost.available ? 'Air boost ready' : 'Air boost recharging');
    }
  }

  layout(): void { placeWindlinePanel(this.panel); }
}
