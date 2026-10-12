// The Stable: customize the wyvern and the rider. The panel takes the left 40% of the screen
// (STABLE_UI_FRACTION — the camera frames the subject in the other 60% with a lens shift).
// Picks are previews (actions.previewWyvernLook / previewRiderLook): the models and the flight
// breed change, the save does not. Save & leave keeps them (setWyvernLook / setRiderLook);
// Revert, or leaving any other way, puts back the look you walked in with. Locked options stay
// visible with what they ask of you.

import type { BreedId, InputPresses, RiderLook, WyvernLook } from '../core/types';
import { DEFAULT_RIDER, PALETTES, cosmeticsFor, type CosmeticOption } from '../cosmetics/catalog';
import { garmentChoice, withGarment } from '../cosmetics/wardrobe';
import { BREEDS, BREED_ORDER } from '../flight/breeds';
import { STABLE_UI_FRACTION } from '../camera/showRigs';
import { div, fromHtml, h } from './dom';
import { Dialog } from './Dialog';
import { ICONS } from './icons';
import { colorName } from './colorName';
import { Panel, hintBar, type UiCtx } from './panel';
import { BUILDS, STABLE_TABS, looksDiffer, nextTab, withBreed, type StableSection, type StableTab } from './stableModel';
import { describeUnlock, type Requirement } from './unlocks';
import { isOptionUnlocked, unlockContext } from './viewModel';

const STAT_KEYS = ['speed', 'agility', 'glide', 'power', 'stamina'] as const;

export class Stable extends Panel {
  override hidesHud = true;
  private tab = 0;
  private tabEls: HTMLElement[] = [];
  private body: HTMLElement;
  private detailTitle: HTMLElement;
  private detailText: HTMLElement;
  private subject: HTMLElement;
  private entryWyvern: WyvernLook;
  private entryRider: RiderLook;
  private wyvern: WyvernLook;
  private rider: RiderLook;
  /** Per-section re-markers for the selected tile after a change. */
  private markers: (() => void)[] = [];
  private saveBtn!: HTMLElement;
  private revertBtn!: HTMLElement;
  /** Save & leave ran: the look is kept. */
  private committed = false;

  constructor(
    ctx: UiCtx,
    private onLeave: () => void,
  ) {
    super(ctx, 'dw-stable-layer');
    const save = ctx.view.save.data;
    this.entryWyvern = { ...save.wyvern };
    this.entryRider = { ...save.rider };
    this.wyvern = { ...save.wyvern };
    this.rider = { ...save.rider };

    this.subject = h('div', { class: 'dw-stable-title' });
    const head = div('dw-stable-head', div('', h('div', { class: 'dw-kicker', text: 'THE STABLE' }), this.subject));

    const tabs = div('dw-stable-tabs');
    for (const group of ['wyvern', 'rider'] as const) {
      const row = div('dw-tabrow', h('span', { class: 'dw-tabrow-label', text: group === 'wyvern' ? 'WYVERN' : 'RIDER' }));
      STABLE_TABS.forEach((t, i) => {
        if (t.group !== group) return;
        const el = h('div', { class: 'dw-tab', text: t.label });
        el.addEventListener('click', () => this.setTab(i, true));
        this.tabEls[i] = el;
        row.append(el);
      });
      tabs.append(row);
    }
    tabs.append(
      div(
        'dw-tabnav',
        h('span', { class: 'dw-hint-g', attrs: { 'data-glyph': 'tabPrev' } }),
        h('span', { class: 'dw-hint-g', attrs: { 'data-glyph': 'tabNext' } }),
        h('span', { text: 'Switch tab' }),
      ),
    );

    this.body = div('dw-stable-body');
    this.detailTitle = h('b');
    this.detailText = h('div');
    const detail = div('dw-stable-detail', this.detailTitle, this.detailText);

    const saveBtn = h('div', { class: 'dw-btn', html: '<span class="dw-hint-g" data-glyph="pause" data-only="pad"></span><span>Save &amp; leave</span>' });
    const revertBtn = h('div', { class: 'dw-btn dw-btn--quiet', html: '<span class="dw-hint-g" data-glyph="back"></span><span>Revert</span>' });
    this.saveBtn = saveBtn;
    this.revertBtn = revertBtn;
    const foot = div(
      'dw-stable-foot',
      div('dw-stable-btns', saveBtn, revertBtn),
      hintBar([
        ['confirm', 'Choose'],
        ['navigate', 'Browse'],
      ]),
    );

    const panel = div('dw-stable dw-enter', head, tabs, this.body, detail, foot);
    panel.style.width = `${STABLE_UI_FRACTION * 100}%`;
    const viewHint = div(
      'dw-stable-view-hint',
      hintBar([
        ['look', 'Turn', 'pad'],
        ['zoom', 'Zoom', 'pad'],
        ['rotateView', 'Turn', 'keyboard'],
        ['zoom', 'Zoom', 'keyboard'],
      ]),
    );
    this.root.append(panel, viewHint);
    this.setTab(0, false);
    ctx.fillGlyphs(this.root);
  }

  // --- Input --------------------------------------------------------------------------------

  override input(p: InputPresses): void {
    if (p.pause && !p.back) {
      this.saveAndLeave();
      return;
    }
    super.input(p);
  }

  override onTab(dir: -1 | 1): boolean {
    this.setTab(nextTab(this.tab, dir), true);
    return true;
  }

  override onBack(): void {
    this.requestRevert();
  }

  private changed(): boolean {
    return looksDiffer(this.wyvern, this.entryWyvern) || looksDiffer(this.rider, this.entryRider);
  }

  private saveAndLeave(): void {
    this.ctx.sound('select');
    const a = this.ctx.actions;
    if (looksDiffer(this.wyvern, this.entryWyvern)) a.setWyvernLook(this.wyvern);
    if (looksDiffer(this.rider, this.entryRider)) a.setRiderLook(this.rider);
    this.committed = true;
    this.ctx.view.save.flush();
    this.onLeave();
  }

  /** Show a pick without keeping it (falls back to keeping it on games without previews). */
  private previewWyvern(look: WyvernLook): void {
    const a = this.ctx.actions;
    if (a.previewWyvernLook) a.previewWyvernLook(look);
    else a.setWyvernLook(look);
  }

  private previewRider(look: RiderLook): void {
    const a = this.ctx.actions;
    if (a.previewRiderLook) a.previewRiderLook(look);
    else a.setRiderLook(look);
  }

  /** Put back the look you walked in with. */
  private revert(): void {
    if (looksDiffer(this.wyvern, this.entryWyvern)) this.previewWyvern(this.entryWyvern);
    if (looksDiffer(this.rider, this.entryRider)) this.previewRider(this.entryRider);
    this.wyvern = { ...this.entryWyvern };
    this.rider = { ...this.entryRider };
  }

  override dispose(): void {
    // Closed without Save (title, a screen change...): previews never outlive the Stable.
    if (!this.committed) this.revert();
    super.dispose();
  }

  private requestRevert(): void {
    if (!this.changed()) {
      this.ctx.sound('back');
      this.onLeave();
      return;
    }
    this.ctx.sound('select');
    this.ctx.push(
      new Dialog(this.ctx, 'Leave without saving?', 'Your wyvern and rider will go back to how they looked when you came in.', [
        { label: 'Keep editing', run: () => {}, cancel: true, primary: true },
        { label: 'Save & leave', run: () => this.saveAndLeave() },
        {
          label: 'Revert',
          run: () => {
            this.revert();
            this.onLeave();
          },
        },
      ]),
    );
  }

  // --- Tabs -----------------------------------------------------------------------------------

  /** Open a tab (showcases / tests). */
  selectTab(i: number): void {
    this.setTab(i, false);
  }

  private setTab(i: number, sound: boolean): void {
    if (sound && i !== this.tab) this.ctx.sound('tab');
    this.tab = i;
    const tab = STABLE_TABS[i];
    this.tabEls.forEach((el, j) => el.classList.toggle('is-active', j === i));
    this.subject.textContent = tab.group === 'wyvern' ? 'Your Wyvern' : 'Your Rider';
    this.ctx.view.camera.setStableFocus?.(tab.focus);
    this.scope.clear();
    this.markers = [];
    this.body.replaceChildren(...this.buildTab(tab));
    // The footer buttons are part of every tab's focus order (down from the last tile).
    this.scope.add({
      el: this.saveBtn,
      onFocus: () => this.setDetail('Save & leave', 'Keep this look and head back out.'),
      activate: () => this.saveAndLeave(),
    });
    this.scope.add({
      el: this.revertBtn,
      onFocus: () => this.setDetail('Revert', 'Put back the look you walked in with.'),
      activate: () => this.requestRevert(),
    });
    this.refreshMarks();
    this.body.scrollTop = 0;
    // Start on the selected tile of the first section, so A does nothing surprising.
    const sel = this.body.querySelector('.is-selected') as HTMLElement | null;
    if (sel && this.scope.items.some((it) => it.el === sel)) this.scope.focusEl(sel, { scroll: false });
    else this.scope.focus(0, { scroll: false });
  }

  private buildTab(tab: StableTab): HTMLElement[] {
    const out: HTMLElement[] = [];
    if (tab.id === 'gear') {
      const reset = div('dw-btn dw-btn--quiet', h('span', { text: 'Restore all outfit pieces' }));
      this.scope.add({ el: reset, onFocus: () => this.setDetail('Restore all outfit pieces', 'Restore your selected complete outfit, keeping your colors, hair and accessories.'), activate: () => {
        const { chest, shoulderDrape, waist, armWraps, legWraps, footwear } = DEFAULT_RIDER;
        this.rider = { ...this.rider, chest, shoulderDrape, waist, armWraps, legWraps, footwear, wardrobe: undefined };
        this.previewRider(this.rider);
        this.refreshMarks();
      } });
      out.push(h('p', { text: 'Mix pieces from any outfit you have unlocked. Match Outfit follows the preset. Tops and trousers stay covered; outer pieces can be removed. Main color and Trim dye cloth; scale and leather dyes color mixed gear.' }), reset);
    }
    for (const s of tab.sections) out.push(...this.buildSection(s));
    return out;
  }

  private buildSection(s: StableSection): HTMLElement[] {
    switch (s.kind) {
      case 'breeds':
        return this.buildBreeds();
      case 'build':
        return this.buildBuild();
      case 'options':
      case 'garment':
        return this.buildOptions(s);
      case 'swatches':
        return this.buildSwatches(s);
    }
  }

  private sectionTitle(title: string, current: () => string): HTMLElement {
    const small = h('small');
    const el = div('dw-section-title', h('span', { text: title.toUpperCase() }), small);
    const mark = () => (small.textContent = current());
    this.markers.push(mark);
    mark();
    return el;
  }

  private refreshMarks(): void {
    for (const m of this.markers) m();
  }

  // --- Breed ----------------------------------------------------------------------------------

  private buildBreeds(): HTMLElement[] {
    const grid = div('dw-breeds');
    const desc = h('p');
    const bars: Record<string, { fill: HTMLElement; mark: HTMLElement }> = {};
    const stats = div('dw-stats');
    for (const k of STAT_KEYS) {
      const fill = h('i');
      const mark = h('u');
      bars[k] = { fill, mark };
      stats.append(div('dw-stat-row', h('span', { text: k.toUpperCase() }), div('dw-statbar', fill, mark)));
    }
    const nameEl = h('div', { class: 'dw-detail-title' });
    const detail = div('dw-breed-detail', nameEl, desc, stats, h('div', { class: 'dw-note', text: 'Breeds fly differently. Colors, markings and gear are only for looks.' }));
    const show = (id: BreedId) => {
      const b = BREEDS[id];
      const cur = BREEDS[this.wyvern.breed];
      nameEl.textContent = b.name;
      desc.textContent = b.description;
      for (const k of STAT_KEYS) {
        bars[k].fill.style.width = `${Math.round(b.ratings[k] * 100)}%`;
        bars[k].mark.style.left = `${Math.round(cur.ratings[k] * 100)}%`;
        bars[k].mark.style.display = id === this.wyvern.breed ? 'none' : '';
      }
    };
    const cards: HTMLElement[] = [];
    for (const id of BREED_ORDER) {
      const b = BREEDS[id];
      const card = div(
        'dw-breed',
        h('div', { class: 'dw-breed-name', text: b.name }),
        h('div', { class: 'dw-breed-tag', text: b.tagline }),
        div('dw-opt-check', fromHtml(ICONS.check)),
      );
      cards.push(card);
      this.scope.add({
        el: card,
        onFocus: () => {
          show(id);
          this.setDetail(
            b.name,
            id === this.wyvern.breed ? 'The breed you fly now. The white marks on the bars are its numbers.' : `Choose to fly a ${b.name}. White marks show your current breed for comparison.`,
          );
        },
        activate: () => {
          if (this.wyvern.breed === id) {
            this.ctx.sound('select');
            return;
          }
          this.ctx.sound('select');
          this.wyvern = withBreed(this.wyvern, id);
          this.previewWyvern(this.wyvern);
          this.refreshMarks();
          show(id);
        },
      });
      grid.append(card);
    }
    this.markers.push(() => cards.forEach((c, i) => c.classList.toggle('is-selected', BREED_ORDER[i] === this.wyvern.breed)));
    this.refreshMarks();
    show(this.wyvern.breed);
    return [this.sectionTitle('Breed', () => BREEDS[this.wyvern.breed].name), grid, detail];
  }

  // --- Rider build ------------------------------------------------------------------------------

  private buildBuild(): HTMLElement[] {
    const grid = div('dw-options');
    grid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    const tiles: HTMLElement[] = [];
    for (const b of BUILDS) {
      const tile = div('dw-opt', div('dw-opt-name', h('span', { text: b.label })), h('div', { class: 'dw-opt-desc', text: b.description }), div('dw-opt-check', fromHtml(ICONS.check)));
      if (this.rider.outfit === 'travel-drape' && b.value !== 'medium') {
        tile.classList.add('is-locked');
        tile.querySelector('.dw-opt-desc')!.textContent = 'Choose another outfit to use this build.';
      }
      tiles.push(tile);
      this.scope.add({
        el: tile,
        onFocus: () => this.setDetail(b.label, b.description),
        activate: () => {
          if (this.rider.outfit === 'travel-drape' && b.value !== 'medium') {
            this.setDetail('Travel Drape uses Medium', 'Choose another outfit in the Outfit tab to use Slight or Broad.');
            this.deny(tile);
            return;
          }
          this.ctx.sound('select');
          if (this.rider.build === b.value) return;
          this.rider = { ...this.rider, build: b.value };
          this.previewRider(this.rider);
          this.refreshMarks();
        },
      });
      grid.append(tile);
    }
    this.markers.push(() => tiles.forEach((t, i) => t.classList.toggle('is-selected', BUILDS[i].value === this.rider.build)));
    return [this.sectionTitle('Build', () => BUILDS.find((b) => b.value === this.rider.build)?.label ?? ''), grid];
  }

  // --- Shapes (markings, horns, outfits...) ----------------------------------------------------

  private buildOptions(s: Extract<StableSection, { kind: 'options' | 'garment' }>): HTMLElement[] {
    const view = this.ctx.view;
    const ctxU = unlockContext(view);
    const grid = div('dw-options');
    const opts = cosmeticsFor(s.slot);
    const tiles: HTMLElement[] = [];
    const current = () => s.kind === 'garment' ? garmentChoice(this.rider, s.key) : s.target === 'wyvern' ? this.wyvern[s.key] : this.rider[s.key];
    for (const opt of opts) {
      const unlocked = isOptionUnlocked(view.save, opt);
      const req = unlocked ? null : describeUnlock(opt.unlock, ctxU);
      const tile = this.optionTile(opt, req);
      tiles.push(tile);
      this.scope.add({
        el: tile,
        onFocus: () => this.setDetail(opt.name, opt.description, req),
        activate: () => {
          if (req) {
            this.deny(tile);
            return;
          }
          this.ctx.sound('select');
          if (current() === opt.id && !(s.kind === 'options' && s.target === 'rider' && s.key === 'outfit' && this.rider.wardrobe)) return;
          if (s.kind === 'garment') {
            this.rider = withGarment(this.rider, s.key, opt.id);
            this.previewRider(this.rider);
          } else if (s.target === 'wyvern') {
            this.wyvern = { ...this.wyvern, [s.key]: opt.id };
            this.previewWyvern(this.wyvern);
          } else {
            this.rider = { ...this.rider, [s.key]: opt.id };
            if (s.key === 'outfit') this.rider.wardrobe = undefined;
            if (s.key === 'outfit' && opt.id === 'travel-drape') this.rider.build = 'medium';
            this.previewRider(this.rider);
          }
          this.refreshMarks();
        },
      });
      grid.append(tile);
    }
    this.markers.push(() => tiles.forEach((t, i) => t.classList.toggle('is-selected', opts[i].id === current())));
    const title = this.sectionTitle(s.title, () => opts.find((o) => o.id === current())?.name ?? '');
    return [title, grid];
  }

  private optionTile(opt: CosmeticOption, req: Requirement | null): HTMLElement {
    const name = div('dw-opt-name');
    if (req) name.append(fromHtml(ICONS.lock));
    name.append(h('span', { text: opt.name }));
    const tile = div(`dw-opt${req ? ' is-locked' : ''}`, name);
    if (req) {
      const line = req.countable ? `${req.text} · ${req.progress}` : req.text;
      const reqEl = div('dw-opt-req', h('span', { text: line }));
      if (req.countable) {
        const bar = div('dw-bar', h('i'));
        (bar.firstElementChild as HTMLElement).style.width = `${Math.round((req.have / Math.max(1, req.need)) * 100)}%`;
        reqEl.append(bar);
      } else if (req.progress) {
        reqEl.append(h('div', { class: 'dw-opt-sub', text: req.progress }));
      }
      tile.append(reqEl);
    } else {
      tile.append(h('div', { class: 'dw-opt-desc', text: opt.description }));
    }
    tile.append(div('dw-opt-check', fromHtml(ICONS.check)));
    return tile;
  }

  private deny(tile: HTMLElement): void {
    this.ctx.sound('locked');
    tile.classList.remove('is-denied');
    void tile.offsetWidth;
    tile.classList.add('is-denied');
  }

  // --- Colors -----------------------------------------------------------------------------------

  private buildSwatches(s: Extract<StableSection, { kind: 'swatches' }>): HTMLElement[] {
    const grid = div('dw-swatches');
    const sw: HTMLElement[] = [];
    const current = () => (s.target === 'wyvern' ? this.wyvern[s.key] : this.rider[s.key]).toLowerCase();
    s.palette.forEach((hex, i) => {
      const el = div('dw-swatch');
      el.style.background = hex;
      sw.push(el);
      this.scope.add({
        el,
        onFocus: () => this.setDetail(s.palette === PALETTES.skin ? `Skin tone ${i + 1}` : colorName(hex), s.title),
        activate: () => {
          this.ctx.sound('select');
          if (current() === hex.toLowerCase()) return;
          if (s.target === 'wyvern') {
            this.wyvern = { ...this.wyvern, [s.key]: hex };
            this.previewWyvern(this.wyvern);
          } else {
            this.rider = { ...this.rider, [s.key]: hex };
            this.previewRider(this.rider);
          }
          this.refreshMarks();
        },
      });
      grid.append(el);
    });
    this.markers.push(() => sw.forEach((el, i) => el.classList.toggle('is-selected', s.palette[i].toLowerCase() === current())));
    const title = this.sectionTitle(s.title, () => (s.palette === PALETTES.skin ? '' : colorName(current())));
    return [title, grid];
  }

  // --- Detail strip -----------------------------------------------------------------------------

  private setDetail(title: string, text: string, req: Requirement | null = null): void {
    this.detailTitle.textContent = title;
    if (req) {
      this.detailText.className = 'is-locked';
      this.detailText.textContent = `Locked — ${req.text}${req.progress ? ` (${req.progress})` : ''}`;
    } else {
      this.detailText.className = '';
      this.detailText.textContent = text;
    }
  }
}
