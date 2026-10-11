import { BufferAttribute, BufferGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, DoubleSide, Group, MeshBasicMaterial, TorusGeometry, Line, LineBasicMaterial, Mesh, SphereGeometry, Vector3 } from 'three';
import type { Camera } from 'three';
import { LANCE } from './tuning';
import type { SkyLance } from './SkyLance';
import type { SweepWorld } from './sweep';
import { predictCenteredTarget, type TargetPreview } from './target';
import type { Rider } from '../creatures/rider/Rider';
import type { RiderPose } from '../core/types';
import { toonMaterial } from '../render/painterly';
const UP = new Vector3(0, 1, 0);
/** Bracer-fired magical filament. Render-only wrist/harness sockets never drive physics.
 * The swept projectile is a small magical seed; no held pole or decorative collision. */
export class SkyLanceVisuals {
  readonly group = new Group();
  private readonly seed = new Mesh(new SphereGeometry(.065, 8, 6), new MeshBasicMaterial({ color: '#b8f4ff', toneMapped: false }));
  private readonly points = new Float32Array(33 * 3);
  private readonly geometry = new BufferGeometry();
  private readonly line: Mesh;
  private readonly halo: Mesh;
  private readonly haloGeometry = new BufferGeometry();
  private readonly bracer = new Group();
  private readonly harness = new Group();
  private readonly waist = new Group();
  private readonly jets: Mesh[] = [];
  private readonly jetDirection = new Vector3();
  private readonly harnessPoint = new Vector3();
  private readonly bracerPoint = new Vector3();
  private readonly cameraPosition = new Vector3();
  private readonly tangent = new Vector3();
  private readonly side = new Vector3();
  private readonly loadGeometry = new BufferGeometry();
  private readonly loadPoints = new Float32Array(12);
  private readonly loadLine: Line;
  private readonly tensionMaterial = new MeshBasicMaterial({ color: '#65d9ff', toneMapped: false });
  private readonly endpoint = new Vector3();
  private readonly grip = new Vector3();
  private readonly aimPoint = new Vector3();
  private readonly aimDirection = new Vector3();
  private reticle: HTMLElement | null = null;
  private nextPreview = 0;
  private readonly forecastAim = new Vector3();
  private readonly forecastOrigin = new Vector3();
  private readonly forecastVelocity = new Vector3();
  private readonly forecastCamera = new Vector3();
  private previewState = '';
  private forecastWorld: SweepWorld | null = null;
  private forecastRevision: number | undefined;
  target: TargetPreview | null = null;
  private readonly previewOrigin = new Vector3();
  constructor(private readonly predictiveAim = false) {
    const bronze = toonMaterial({ color: '#AA8656' });
    this.seed.name = 'windline-seed'; this.seed.renderOrder = 102;
    this.group.add(this.seed);
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) { const n = i * 2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
    for (const g of [this.geometry, this.haloGeometry]) {
      g.setAttribute('position', new BufferAttribute(new Float32Array(66 * 3), 3)); g.setIndex(indices);
    }
    // Camera-facing narrow ribbons keep a luminous core and dark edge readable at 720p.
    // Width is visual only; gameplay uses the independent fixed-length constraint.
    this.line = new Mesh(this.geometry, new MeshBasicMaterial({ color: '#79e5ff', side: DoubleSide, depthWrite: true, toneMapped: false }));
    this.halo = new Mesh(this.haloGeometry, new MeshBasicMaterial({ color: '#254d79', side: DoubleSide, depthWrite: false, toneMapped: false }));
    this.line.frustumCulled = this.halo.frustumCulled = false;
    // The existing sky dome is opaque order 100; retain world depth testing after it.
    this.line.renderOrder = 102; this.halo.renderOrder = 101;
    this.group.add(this.halo, this.line, this.bracer, this.harness, this.waist);
    this.bracer.name = 'windline-bracer'; this.harness.name = 'windline-harness'; this.waist.name = 'windline-waist-boost';
    this.bracer.matrixAutoUpdate = this.harness.matrixAutoUpdate = this.waist.matrixAutoUpdate = false;
    const slate = toonMaterial({ color: '#586875' }), leather = toonMaterial({ color: '#8e7254' });
    // Two compact bronze/slate waist vessels retain the existing Mediterranean tool palette.
    for (const sign of [-1, 1]) {
      const vessel = new Mesh(new CylinderGeometry(.055,.06,.18,8), slate);
      vessel.rotation.x = Math.PI/2; vessel.position.set(sign*.14,-.03,-.12); this.waist.add(vessel);
      const nozzle = new Mesh(new TorusGeometry(.045,.009,4,10),bronze);
      nozzle.position.set(sign*.14,-.03,-.215);this.waist.add(nozzle);
      const jet = new Mesh(new ConeGeometry(.045,.38,7), new MeshBasicMaterial({color:'#79e5ff',transparent:true,opacity:.7,depthWrite:false,toneMapped:false}));
      jet.name = 'windline-boost-plume';jet.renderOrder = 102;jet.visible = false;this.jets.push(jet);this.group.add(jet);
    }
    const guard = new Mesh(new CylinderGeometry(.060, .050, .14, 8, 1, true), slate);
    guard.position.y = -.15; this.bracer.add(guard);
    for (const y of [-.095, -.205]) {
      const band = new Mesh(new TorusGeometry(.056, .007, 4, 12), bronze);
      band.rotation.x = Math.PI / 2; band.position.y = y; this.bracer.add(band);
    }
    const guide = new Mesh(new TorusGeometry(.022, .005, 4, 10), this.tensionMaterial);
    guide.position.set(0, -.17, .065); this.bracer.add(guide);
    // Low-profile crossback load straps and shoulder returns, rather than backpack mass.
    const strap = (a: Vector3, b: Vector3) => {
      const m = new Mesh(new BoxGeometry(.035, a.distanceTo(b), .009), leather);
      m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); this.harness.add(m);
    };
    for (const sign of [-1, 1]) {
      strap(new Vector3(sign*.14,.16,-.125), new Vector3(-sign*.115,-.24,-.125));
      strap(new Vector3(sign*.14,.16,-.125), new Vector3(sign*.14,.16,.14));
      strap(new Vector3(sign*.14,.16,.14), new Vector3(sign*.115,-.24,.12));
    }
    const ring = new Mesh(new TorusGeometry(.03,.007,4,12), bronze);
    ring.position.set(0,-.04,-.145); this.harness.add(ring);
    this.loadGeometry.setAttribute('position', new BufferAttribute(this.loadPoints,3));
    this.loadLine = new Line(this.loadGeometry,new LineBasicMaterial({color:'#7FA8C4'}));
    this.loadLine.frustumCulled = false; this.group.add(this.loadLine);
  }

  dispose(): void {
    this.group.removeFromParent();
    const geometries = new Set<BufferGeometry>(), materials = new Set<import('three').Material>();
    this.group.traverse(object => {
      if (object instanceof Mesh || object instanceof Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.group.clear(); this.reticle = null;
  }
  /** Normal gameplay draws a neutral aiming dot without any world query.
   * Predictive feedback is explicitly opt-in for the isolated SkyLance study. */
  updateReticle(camera: Camera, feet: Vector3, velocity: Vector3, lance: SkyLance): void {
    this.reticle ??= document.getElementById('sky-lance-reticle');
    this.updateLineWidth(camera);
    if (!this.reticle) return;
    if (!this.predictiveAim) {
      this.target = null;
      this.reticle.dataset.target = 'aiming';
      this.reticle.style.color = '#a8ddec';
      this.reticle.classList.remove('is-valid');
      this.reticle.style.left = '50%'; this.reticle.style.top = '50%';
      return;
    }
    if (this.reticle.hidden || this.reticle.closest('[hidden]')) {
      // A caller may reveal this element later in the same frame. Hidden feedback
      // must carry no old eligibility, and the first visible update must query now.
      this.target=null;this.forecastWorld=null;this.nextPreview=0;
      this.reticle.dataset.target=lance.state==='ready'?'checking':lance.state;
      this.reticle.style.color='#a8ddec';this.reticle.classList.toggle('is-valid',false);
      const label=this.reticle.querySelector<HTMLElement>('[data-aim-status]');if(label)label.textContent='';
      return;
    }
    camera.getWorldDirection(this.aimDirection);
    this.previewOrigin.copy(feet).addScaledVector(UP,LANCE.harnessHeight);
    const now=performance.now();
    if (now >= this.nextPreview || this.previewState !== lance.state) {
      this.previewState=lance.state;
      this.forecastAim.copy(this.aimDirection); this.forecastOrigin.copy(this.previewOrigin); this.forecastVelocity.copy(velocity);
      this.forecastCamera.copy(camera.position);
      this.target=lance.state==='ready' ? predictCenteredTarget(lance.world,camera.position,this.aimDirection,this.previewOrigin,velocity) : null;
      this.forecastWorld=lance.world;this.forecastRevision=lance.world.revision;
      // Start the breathing interval after completion. A slow query must not
      // consume its own cooldown and run again immediately on the next frame.
      // Under load, reserve eight times its CPU cost (up to 250 ms) for gameplay.
      const completed=performance.now();
      this.nextPreview=completed+Math.max(50,Math.min(250,(completed-now)*8));
    }
    // The isolated study clears eligibility when its bounded forecast is stale.
    const fresh = this.forecastAim.equals(this.aimDirection)
      && this.forecastOrigin.equals(this.previewOrigin)
      && this.forecastVelocity.equals(velocity)
      && this.forecastCamera.equals(camera.position)
      && this.forecastWorld===lance.world && this.forecastRevision===lance.world.revision
      && (this.target?.state !== 'reachable' || !!this.target.anchorId && lance.world.anchorValid(this.target.anchorId));
    const target = fresh ? this.target : null;
    const reachable=lance.state==='ready' && target?.state==='reachable';
    this.reticle.dataset.target = lance.rope ? 'attached' : target?.state ?? (lance.state === 'ready' ? 'checking' : lance.state);
    this.reticle.style.color = reachable ? '#94d6a2' : '#a8ddec';
    this.reticle.classList.toggle('is-valid',reachable);
    const label=this.reticle.querySelector<HTMLElement>('[data-aim-status]');
    if (label) label.textContent = lance.rope ? `LINKED · ${lance.rope.length.toFixed(0)} m` : reachable ? `READY · ${target!.distance.toFixed(0)} m` : target?.state==='blocked' ? 'BLOCKED / TOO CLOSE' : lance.state==='ready' ? (fresh ? 'NO SURFACE · 65 m' : 'CHECKING') : lance.state==='spent' ? 'REFORMING' : 'FIRING';
    const hit = this.reticle.querySelector<HTMLElement>('[data-impact]');
    if (hit) hit.style.display = 'none';
    this.reticle.style.left='50%'; this.reticle.style.top='50%';
  }
  update(lance: SkyLance, rider: Rider, pose: RiderPose, alpha: number): void {
    this.bracer.visible = this.harness.visible = this.waist.visible = !pose.mounted;
    rider.equipmentFrame('bracer', this.bracer.matrix);
    rider.equipmentFrame('harness', this.harness.matrix);
    rider.equipmentFrame('waist', this.waist.matrix);
    this.waist.matrixWorldNeedsUpdate = true;
    this.jetDirection.copy(pose.velocity);
    if (this.jetDirection.lengthSq() < 1e-8) this.jetDirection.set(Math.sin(pose.yaw),0,Math.cos(pose.yaw));
    this.jetDirection.normalize().negate();
    for (let i=0;i<this.jets.length;i++) {
      const jet = this.jets[i];jet.visible = !pose.mounted && (pose.airBoost ?? 0) > 0;
      jet.position.set((i===0?-1:1)*.14,-.03,-.22).applyMatrix4(this.waist.matrix).addScaledVector(this.jetDirection,.19);
      jet.quaternion.setFromUnitVectors(UP,this.jetDirection);
      jet.scale.setScalar(.65 + .35 * (pose.airBoost ?? 0));
    }
    this.bracer.matrixWorldNeedsUpdate = this.harness.matrixWorldNeedsUpdate = true;
    this.bracerPoint.set(0,-.17,.065).applyMatrix4(this.bracer.matrix);
    this.harnessPoint.set(0,-.04,-.145).applyMatrix4(this.harness.matrix);
    this.seed.visible = !pose.mounted && (lance.state === 'projectile' || lance.state === 'anchored');
    this.seed.position.lerpVectors(lance.previous, lance.position, lance.state === 'projectile' ? alpha : 1);
    const pulse = lance.state === 'spent' ? 1 + .3 * Math.sin(Math.PI * lance.age / LANCE.recoveryTime) : 1;
    this.tensionMaterial.color.set(lance.taut ? '#b8f4ff' : lance.state === 'ready' ? '#65a8cd' : '#79e5ff');
    this.tensionMaterial.color.multiplyScalar(pulse);
    const rope = lance.rope;
    this.line.visible = this.halo.visible = !pose.mounted && (!!rope || lance.state === 'projectile');
    this.loadLine.visible = !!rope && !pose.mounted;
    if (!this.line.visible) return;
    this.endpoint.copy(this.bracerPoint);
    this.harnessPoint.toArray(this.loadPoints,0);
    // Route the render-only strop over the left shoulder rather than through the torso.
    this.grip.set(.14,.16,-.14).applyMatrix4(this.harness.matrix).toArray(this.loadPoints,3);
    this.grip.set(.14,.16,.15).applyMatrix4(this.harness.matrix).toArray(this.loadPoints,6);
    this.bracerPoint.toArray(this.loadPoints,9);
    this.loadGeometry.attributes.position.needsUpdate = true;
    const target = rope?.anchor ?? this.seed.position;
    const distance = this.endpoint.distanceTo(target);
    const sag = rope ? .5 * Math.sqrt(Math.max(0, rope.length * rope.length - distance * distance)) : 0;
    for (let i = 0; i <= 32; i++) {
      const u = i / 32, offset = i * 3;
      this.points[offset] = this.endpoint.x + (target.x - this.endpoint.x) * u;
      this.points[offset + 1] = this.endpoint.y + (target.y - this.endpoint.y) * u - sag * 4 * u * (1 - u);
      this.points[offset + 2] = this.endpoint.z + (target.z - this.endpoint.z) * u;
    }
  }
  private updateLineWidth(camera: Camera): void {
    if (!this.line.visible) return;
    camera.getWorldPosition(this.cameraPosition);
    const fov = 'fov' in camera ? Number(camera.fov) : 50;
    const pixelScale = 2 * Math.tan(fov * Math.PI / 360) / Math.max(1, window.innerHeight);
    for (let i = 0; i <= 32; i++) {
      this.endpoint.fromArray(this.points,i*3);
      this.tangent.fromArray(this.points,Math.min(32,i+1)*3).sub(this.grip.fromArray(this.points,Math.max(0,i-1)*3)).normalize();
      this.side.copy(this.cameraPosition).sub(this.endpoint).cross(this.tangent).normalize();
      const width = Math.max(.003, this.cameraPosition.distanceTo(this.endpoint) * pixelScale);
      for (let layer = 0; layer < 2; layer++) {
        const geometry = layer === 0 ? this.geometry : this.haloGeometry;
        const pixels = layer === 0 ? 1.1 : 2.3;
        const positions = geometry.attributes.position as BufferAttribute;
        for (let j = 0; j < 2; j++) {
          this.grip.copy(this.endpoint).addScaledVector(this.side,width*pixels*(j===0?-.5:.5));
          positions.setXYZ(i*2+j,this.grip.x,this.grip.y,this.grip.z);
        }
        positions.needsUpdate = true;
      }
    }
  }
}
