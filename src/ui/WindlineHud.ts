import type { GameView } from '../game/contracts';
import { LANCE } from '../traversal/tuning';
import { div, h, LiveText } from './dom';
import type { ControlAction } from '../input/scheme';
import { placeWindlinePanel } from './hudPlacement';

/** Read-only normal-game feedback; all state and hold timing belong to fixed simulation. */
export class WindlineHud {
  readonly root = div('dw-layer dw-windline');
  private readonly reticle = h('div', { class: 'dw-windline-reticle', attrs: { id: 'sky-lance-reticle', 'aria-hidden': 'true' },
    html: '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="#182631" stroke-width="1.5"/></svg>' });
  private readonly status = new LiveText(h('strong', { attrs: { 'data-line-state': '' } }));
  private readonly boostText = new LiveText(h('span', { attrs: { 'data-boost-text': '' } }));
  private readonly boostFill = h('div', { attrs: { 'data-boost-fill': '' } });
  private readonly boostTrack = div('dw-windline-meter', this.boostFill);
  private readonly boost = h('div', { class: 'dw-windline-boost', attrs: { id: 'windline-boost-hud', role: 'status' } },
    this.boostText.el, this.boostTrack);
  private readonly callText = new LiveText(h('span', { attrs: { 'data-call-text': '' } }));
  private readonly callGlyph = this.glyph('recall');
  private readonly callFill = h('div', { attrs: { 'data-call-fill': '' } });
  private readonly callTrack = h('div', { class: 'dw-windline-meter', attrs: { role: 'progressbar', 'aria-label': 'Held action progress', 'aria-valuemin': '0', 'aria-valuemax': '100' } }, this.callFill);
  private readonly call = div('dw-windline-call', div('dw-windline-call-label', this.callGlyph, this.callText.el), this.callTrack);
  private readonly cast = h('p', {}, this.glyph('lance'), ' Cast at the centre dot · 65 m.');
  private readonly retain = new LiveText(h('p'));
  private readonly linked = h('p', {}, this.glyph('airSteer'), ' guides the swing. ', this.glyph('tetherPull'), ' pulls inward.');
  private readonly free = h('p', {}, this.glyph('airSteer'), ' steers; forward dives, back brakes. ', this.glyph('airBoost'), ' boosts.');
  private readonly hints = div('dw-windline-hints', this.cast, this.retain.el, this.linked, this.free);
  private readonly compactCast = h('span', {}, this.glyph('lance'), ' Cast · 65 m');
  private readonly compactPull = h('span', {}, this.glyph('tetherPull'), ' Pull · ', this.glyph('lance'), ' Release');
  private readonly compactFree = h('span', {}, this.glyph('airBoost'), ' Boost');
  private readonly compact = div('dw-windline-compact', this.compactCast, this.compactPull, this.compactFree);
  private readonly panel = div('dw-windline-panel', h('span', { class: 'dw-windline-title', text: 'Windline' }), this.status.el, this.boost, this.call, this.hints, this.compact);

  constructor(fillGlyphs: (el: HTMLElement) => void) {
    this.root.append(this.reticle, this.panel); this.root.hidden = true; fillGlyphs(this.root);
  }
  private glyph(action: ControlAction): HTMLElement { return h('span', { class: 'dw-hint-g', attrs: { 'data-glyph': action } }); }

  update(view: GameView, visible: boolean): void {
    const p = view.player, lance = p.skyLance, boost = p.airBoost;
    const riderFree = p.mode === 'onFoot' || p.mode === 'traversing' || p.mode === 'falling';
    const airborne = p.mode === 'traversing', recovering = p.mode === 'falling';
    const progress = p.windlineHoldProgress ?? 0, holding = progress > 0;
    const hints = view.save.data.settings.showControlHints && (riderFree || p.mode === 'flying');
    this.panel.dataset.context = `${p.mode}/${hints}/${!!lance?.rope}/${holding}`;
    this.panel.dataset.essential = String(airborne || recovering || holding);
    this.root.hidden = !visible || !lance || (!riderFree && !hints && !holding);
    this.reticle.hidden = !riderFree;
    this.panel.hidden = !hints && !airborne && !recovering && !holding;
    this.hints.hidden = !hints;
    this.cast.hidden = this.retain.el.hidden = !riderFree;
    this.linked.hidden = !lance?.rope;
    this.free.hidden = !airborne || !!lance?.rope;
    this.retain.set(p.lanceInteraction === 'toggle' ? 'Press again to detach.' : 'Hold to retain; release to detach.');
    const caught = lance?.reason === 'Line caught at edge';
    const lineState = lance?.rope ? caught ? 'Line caught' : lance.pullTime > 0 ? 'Pulling' : lance.taut ? 'Taut line' : 'Slack line'
      : recovering ? 'Wyvern approaching' : airborne ? 'Freefall' : p.mode === 'flying' ? 'Mounted flight' : 'On foot';
    this.status.set(lineState); this.panel.dataset.traversalState = lineState;
    this.compact.hidden = !hints;
    this.compactCast.hidden = !riderFree || !!lance?.rope;
    this.compactPull.hidden = !lance?.rope;
    this.compactFree.hidden = !airborne || !!lance?.rope;
    this.boost.hidden = !airborne || !boost;
    if (lance && boost && airborne) {
      const pulling = !!lance.rope && lance.pullTime > 0;
      const label = lance.rope ? caught ? 'Pull blocked · release or steer clear' : pulling ? 'Inward pulse' : 'Pull ready'
        : boost.remaining > 0 ? 'Boost active' : boost.buffered ? 'Boost queued' : boost.available ? 'Boost ready' : `Boost · ${boost.cooldown.toFixed(1)} s`;
      this.boostText.set(label);
      this.boostTrack.hidden = !!lance.rope && !pulling;
      const fill = lance.rope ? lance.pullTime / LANCE.pullDuration : boost.remaining > 0 ? boost.remaining / LANCE.boostDuration : 1 - boost.cooldown / LANCE.boostCooldown;
      this.boostFill.style.width = `${Math.round(100 * Math.max(0,Math.min(1,fill)))}%`;
      this.boost.dataset.state = lance.rope ? caught ? 'caught' : pulling ? 'pulling' : 'tether'
        : boost.remaining > 0 ? 'active' : boost.buffered ? 'queued' : boost.available ? 'ready' : 'cooldown';
      this.boost.setAttribute('aria-label', label);
    }
    // Rescue feedback remains when optional hints are off. A valid rope blocks airborne recall.
    this.call.hidden = !airborne && !recovering && !holding && !(hints && p.mode === 'flying');
    this.call.classList.toggle('is-critical',holding || recovering);
    this.callGlyph.hidden = recovering || !!lance?.rope;
    const action = p.mode === 'flying' ? 'leap' : 'recall';
    this.callText.set(recovering ? 'Returning to the saddle' : lance?.rope ? 'Release line to recall'
      : holding ? action === 'leap' ? 'Leaping · keep holding' : 'Recalling · keep holding'
      : p.windlineHoldAction ? `Hold to ${action}` : `Release, then hold to ${action}`);
    this.callTrack.hidden = !holding;
    this.callFill.style.width = `${Math.round(100 * progress)}%`;
    this.callTrack.setAttribute('aria-label', `${action === 'leap' ? 'Leap' : 'Recall'} hold progress`);
    this.callTrack.setAttribute('aria-valuenow', String(Math.round(100 * progress)));
  }

  layout(): void { placeWindlinePanel(this.panel); }
}
