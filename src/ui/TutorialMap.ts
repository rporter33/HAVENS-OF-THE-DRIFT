import { IslandShape } from '../world/islandShape';
import { LAYOUT } from '../world/layout';
import { div, h } from './dom';
import { Panel, sheet, hintBar, type UiCtx } from './panel';

/** A small local chart, not an atlas of undiscovered content. North is up (−Z). */
export class TutorialMap extends Panel {
  constructor(ctx: UiCtx, follow: () => void, skip: () => void, close: () => void) {
    super(ctx, 'dw-tutorial-map');
    const s = sheet('Your first discovery', 'FIRST FLIGHT');
    const target = ctx.view.tutorialShrine!;
    const player = ctx.view.player.riderPosition;
    const roost = LAYOUT.islands.find((island) => island.landmark === 'roost')!;
    const margin = 220;
    const minX = Math.min(roost.x, target.x, player.x) - margin;
    const minZ = Math.min(roost.z, target.z, player.z) - margin;
    const span = Math.max(Math.max(roost.x, target.x, player.x) + margin - minX,
      Math.max(roost.z, target.z, player.z) + margin - minZ);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `${minX} ${minZ} ${span} ${span}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Local map: north up, your position, Windhaven, and the Shrine of the First Wind.');
    svg.classList.add('dw-guide-chart');
    for (const island of LAYOUT.islands) {
      if (island.x < minX - island.radius || island.x > minX + span + island.radius ||
          island.z < minZ - island.radius || island.z > minZ + span + island.radius) continue;
      const shape = new IslandShape(island);
      const polygon = document.createElementNS(ns, 'polygon');
      const points: string[] = [];
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2;
        const r = shape.outlineRadius(a);
        points.push(`${island.x + Math.cos(a) * r},${island.z + Math.sin(a) * r}`);
      }
      polygon.setAttribute('points', points.join(' '));
      svg.append(polygon);
    }
    const marker = (x: number, z: number, label: string, cls: string, offset: number) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(z));
      dot.setAttribute('r', String(span * 0.009)); dot.setAttribute('class', cls);
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(x + span * 0.018)); text.setAttribute('y', String(z + span * offset));
      text.setAttribute('font-size', String(span * 0.035)); text.textContent = label;
      if (x > minX + span / 2) {
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('x', String(x - span * 0.018));
      }
      svg.append(dot, text);
    };
    marker(roost.x, roost.z, 'Windhaven', 'is-home', -0.025);
    marker(target.x, target.z, 'First Wind shrine', 'is-shrine', -0.025);
    marker(player.x, player.z, 'You', 'is-player', 0.04);
    s.body.append(h('p', { text: 'You know the basics. Try a short flight to the nearby shrine, land beside its stone gateway, and read the inscription. North is up on this map.' }), svg);
    const buttons = div('dw-dialog-btns');
    for (const [label, run] of [['Guide me', follow], ['Skip guidance', skip], ['Back', close]] as const) {
      const button = h('div', { class: 'dw-btn', text: label });
      this.scope.add({ el: button, activate: () => { ctx.pop(this); run(); } });
      buttons.append(button);
    }
    s.foot.append(buttons, hintBar([['confirm', 'Choose'], ['back', 'Back']]));
    this.root.append(s.root);
    this.scope.focus(0, { scroll: false });
    this.close = close;
  }
  private close: () => void;
  override onBack(): void { this.ctx.pop(this); this.close(); }
}
