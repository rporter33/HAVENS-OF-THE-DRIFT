import { BoxGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { Showcase } from '../showcase';
import type { Game } from '../../game/Game';
import type { Collider } from '../../core/types';
import { toonMaterial } from '../../render/painterly';
import { AnchorRegistry } from '../../traversal/anchors';
import { TraversalWorld } from '../../traversal/sweep';
import { LANCE } from '../../traversal/tuning';
import { SkyLanceVisuals } from '../../traversal/SkyLanceVisuals';
import { KEYS, PAD, keyLabel, padLabel } from '../../input/scheme';
let visuals: SkyLanceVisuals, status: HTMLElement, bindings: HTMLElement;
let reset: () => void;
let teardown: (() => void) | null = null;
let reticle: HTMLElement, boostHud: HTMLElement, boostText: HTMLElement, boostFill: HTMLElement;
let cues: Mesh[] = [];
let cueWorld: TraversalWorld;
let cueTimer = Infinity;
const cueFrom = new Vector3(), cueTo = new Vector3();
const origin = new Vector3(0, 420, -90);
const showcase: Showcase = {
  name: 'skyLance', description: 'Experimental fixed-length grapple: hold Q/RT to cast and retain, release to detach, silk reforms automatically, R/View reset',
  setup(game) {
    teardown?.();
    const terrain = game.world.terrain, scene = new Group();
    const platforms: Collider[] = [
      { kind: 'box', x: origin.x, y: origin.y - 1, z: origin.z, hx: 9, hy: 1, hz: 7, yaw: 0, surface: 'stone' },
      { kind: 'box', x: origin.x, y: origin.y - 21, z: origin.z + 44, hx: 12, hy: 1, hz: 9, yaw: 0, surface: 'stone' },
    ];
    const fixture: Collider = { kind: 'sphere', x: origin.x, y: origin.y + 10, z: origin.z + 24, radius: 2.4 };
    const fixtures = [fixture, { ...fixture, x: origin.x + 14, z: origin.z + 37, y: origin.y + 12 }];
    const pillar: Collider = { kind: 'box', x: 4, y: 416, z: -64, hx: .8, hy: 10, hz: .8, yaw: 0, surface: 'stone' };
    const solids = [...platforms, pillar, ...fixtures];
    terrain.colliders.addSource('sky-lance-test', () => solids); terrain.colliders.sync();
    for (const c of [...platforms, pillar]) if (c.kind === 'box') {
      const mesh = new Mesh(new BoxGeometry(c.hx * 2, c.hy * 2, c.hz * 2), toonMaterial({ color: '#D8D1C2' }));
      mesh.position.set(c.x, c.y, c.z); scene.add(mesh);
    }
    cues = []; cueTimer = Infinity;
    for (const c of fixtures) {
      const mesh = new Mesh(new SphereGeometry(c.radius, 12, 8), toonMaterial({ color: '#AA8656', emissive: '#315E9C', emissiveIntensity: .2 }));
      mesh.position.set(c.x, c.y, c.z); scene.add(mesh);
      const cue = new Mesh(new TorusGeometry(c.radius + .18, .035, 4, 32), toonMaterial({color:'#7FA8C4',emissive:'#315E9C',emissiveIntensity:.6}));
      cue.position.copy(mesh.position); scene.add(cue); cues.push(cue);
    }
    game.scene.add(scene);
    cueWorld = new TraversalWorld(terrain, new AnchorRegistry(fixtures.map((collider, i) => ({ id: `test-anchor-${i}`, collider })),true));
    game.player.enableSkyLance(cueWorld);
    visuals = new SkyLanceVisuals(true); game.scene.add(visuals.group);
    game.skyLanceVisuals = visuals;
    reset = () => {
      game.player.teleport(origin.clone().add(new Vector3(0, 0, -3)), 0, 'onFoot');
      game.cameraRig.setOverride(null); game.cameraRig.snap(game.player);
    };
    reset();
    const panel = document.createElement('section'); panel.id = 'sky-lance-controls';
    panel.style.cssText = 'position:fixed;left:16px;bottom:24px;z-index:30;background:#182631e8;color:#FAF8F3;padding:12px 16px;border:1px solid #AA8656;border-radius:8px;max-width:470px;font:15px/1.5 sans-serif';
    panel.innerHTML = '<strong>Windline · practice</strong><div>Jump → aim at a solid surface → fire the bracer.<br>Hold through the low point, then release toward the lower platform.<br>Blue READY: in range. Mouse / right stick: aim.<br>Air: stick / WASD steers, forward dives, back brakes.<br>A / Space: tether pull when linked; upward burst when free.<br>Boost recharges in 1.75 seconds, even in the air.<br>Hold F / Y: jump off while flying, call back in the air or from the ground. Release between actions.</div><div data-bindings></div><div data-state></div><label><input type="checkbox" data-toggle> Toggle tether (accessibility)</label><br><button type="button">Reset practice</button>';
    bindings = panel.querySelector('[data-bindings]')!;
    bindings.textContent = `${keyLabel(KEYS.lance[0])} / ${padLabel(PAD.lance[0], null)}: press to cast, hold to retain, release to detach · silk reforms automatically · R / View: reset`;
    const toggle = panel.querySelector<HTMLInputElement>('[data-toggle]')!;
    toggle.onchange = () => game.player.setLanceInteraction(toggle.checked ? 'toggle' : 'hold');
    panel.querySelector('button')!.onclick = reset;
    status = panel.querySelector('[data-state]')!; document.body.append(panel);
    reticle = document.createElement('div'); reticle.id = 'sky-lance-reticle';
    reticle.setAttribute('aria-hidden', 'true');
    reticle.style.cssText = 'position:fixed;z-index:35;left:50%;top:50%;width:56px;height:56px;pointer-events:none;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 3px #182631);color:#F2EADA';
    reticle.innerHTML = '<svg viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="19" fill="none" stroke="currentColor" stroke-width="1" opacity=".8"/><path d="M28 1v8M28 47v8M1 28h8M47 28h8" stroke="#AA8656" stroke-width="2"/><circle cx="28" cy="28" r="2" fill="currentColor"/></svg><i data-impact style="display:none;position:absolute;width:8px;height:8px;border:2px solid #79e5ff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 4px #182631"></i><span data-aim-status style="position:absolute;top:58px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 12px/1.4 sans-serif;letter-spacing:.04em;background:#182631e8;padding:3px 6px;border-radius:4px"></span>';
    document.body.append(reticle);
    boostHud = document.createElement('div'); boostHud.id = 'windline-boost-hud';
    boostHud.setAttribute('role','status'); boostHud.setAttribute('aria-label','Air boost ready');
    boostHud.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:35;min-width:150px;padding:10px 14px;border:1px solid #7FA8C4;border-radius:8px;background:#182631e8;color:#a8e5ff;font:600 13px/1.5 sans-serif;pointer-events:none';
    boostHud.innerHTML = '<div>A / SPACE · BOOST</div><div data-boost-text aria-hidden="true">READY</div><div style="height:4px;background:#315E9C66;margin-top:5px;border-radius:2px;overflow:hidden"><div data-boost-fill aria-hidden="true" style="height:100%;width:100%;background:#a8e5ff"></div></div>';
    boostText = boostHud.querySelector('[data-boost-text]')!; boostFill = boostHud.querySelector('[data-boost-fill]')!;
    document.body.append(boostHud);
    teardown = () => {
      window.removeEventListener('pagehide', onPageHide);
      toggle.onchange = null; cues = []; panel.querySelector('button')!.onclick = null; panel.remove(); reticle.remove(); boostHud.remove();
      visuals.dispose(); game.skyLanceVisuals = null; game.player.disableSkyLance();
      terrain.colliders.removeSource('sky-lance-test');
      scene.removeFromParent();
      scene.traverse(object => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        }
      });
      scene.clear(); teardown = null;
    };
    const onPageHide = (event?: PageTransitionEvent) => {
      // A bfcache suspension is not scene teardown; retain the scene but discard queued input.
      if (event?.persisted) game.player.cancelLanceWindup(); else game.stop();
    };
    window.addEventListener('pagehide', onPageHide, { once: true });
  },
  dispose() { teardown?.(); },
  update(game: Game, dt: number) {
    if (game.screen === 'play' && game.input.frame.pressed.restart) reset();
    const l = game.player.skyLance!;
    const style = game.input.padStyle;
    const boost = game.player.airBoost;
    boostHud.hidden = game.screen !== 'play' || game.player.riderPose.mounted;
    const boostLabel = l.rope ? (l.pullTime > 0 ? 'PULLING' : 'A / SPACE · TETHER PULL') : boost.remaining > 0 ? 'BOOSTING' : boost.available ? 'READY' : `${boost.cooldown.toFixed(2)} s`;
    boostText.textContent = boostLabel;
    boostFill.style.width = `${100*(1-boost.cooldown/LANCE.boostCooldown)}%`;
    boostHud.dataset.state = l.rope ? 'tether' : boost.available ? 'ready' : 'cooldown';
    const aria = l.rope ? 'Tether pull available' : boost.available ? 'Air boost ready' : 'Air boost recharging';
    if (boostHud.getAttribute('aria-label') !== aria) boostHud.setAttribute('aria-label',aria);
    reticle.style.opacity = game.screen === 'play' && !game.player.riderPose.mounted ? '1' : '0';
    bindings.textContent = `${keyLabel(KEYS.lance[0])} / ${padLabel(PAD.lance[0], style)}: press to cast, hold to retain, release to detach · silk reforms automatically · R / View: reset`;
    if (game.player.lanceInteraction === 'toggle') bindings.textContent = `${keyLabel(KEYS.lance[0])} / ${padLabel(PAD.lance[0], style)}: press to cast / press again to detach · silk reforms automatically · R / View: reset`;
    cueTimer += dt;
    if (cueTimer >= .1) {
      cueTimer = 0;
      cueFrom.copy(game.player.foot.position).y += 1;
      for (let i = 0; i < cues.length; i++) {
        const c = cueWorld.anchors.resolve(`test-anchor-${i}`);
        let eligible = false;
        if (c && c.kind === 'sphere' && cueWorld.anchorValid(`test-anchor-${i}`)) {
          cueTo.set(c.x,c.y,c.z);
          if (cueFrom.distanceTo(cueTo) - c.radius <= 65) eligible = cueWorld.sweep(cueFrom,cueTo,.08)?.anchorId === `test-anchor-${i}`;
        }
        cues[i].visible = eligible && game.screen === 'play' && !game.player.riderPose.mounted;
      }
    }
    for (const cue of cues) cue.quaternion.copy(game.camera.quaternion);
    status.textContent = `${l.state === 'projectile' ? 'firing' : l.state === 'spent' ? 'reforming' : l.state} · ${game.player.mode}${l.rope ? ` · ${l.rope.length.toFixed(1)} m · ${l.taut ? 'taut' : 'slack'}` : ''}${l.reason ? ` · ${l.reason}` : ''} · boost ${game.player.airBoost.available ? 'ready' : game.player.airBoost.remaining > 0 ? 'active' : `${game.player.airBoost.cooldown.toFixed(1)} s`}`;
  },
};
export default showcase;
