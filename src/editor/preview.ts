import {
  Color, DirectionalLight, Group, HemisphereLight, Line, BufferGeometry, LineBasicMaterial,
  Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Raycaster, Scene, TorusGeometry, Vector2, Vector3,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Renderer } from '../render/renderer';
import { QUALITY } from '../render/quality';
import { globalUniforms } from '../render/uniforms';
import { World } from '../world/World';
import { buildAssets, type AssetBuild } from './assets';
import { regionLayout, type Region, type Selection } from './region';

function disposeTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshBasicMaterial>();
  root.traverse(o => {
    if (o instanceof Mesh || o instanceof Line) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m as MeshBasicMaterial);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent();
}
function key(s: Selection): string { return s.kind + ':' + s.id; }
export class RegionPreview {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 6000);
  readonly renderer: Renderer;
  readonly controls: OrbitControls;
  readonly transform: TransformControls;
  world!: World;
  assets!: AssetBuild;
  active = true;
  placement: 'column' | 'terrace' | 'crate' | null = null;
  private markers = new Group();
  private objects = new Map<string, Object3D>();
  private selected: Selection | null = null;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private down = new Vector2();
  private movedByHandle = false;
  onSelect: (selection: Selection | null) => void = () => {};
  onMove: (selection: Selection, position: Vector3) => void = () => {};
  onPlace: (kind: NonNullable<RegionPreview['placement']>, islandId: number, position: Vector3) => void = () => {};

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container, 'low');
    this.renderer.setQuality('low', 1);
    this.renderer.onResize((w, h) => { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); });
    this.scene.background = new Color('#b9d6e7');
    this.scene.add(new HemisphereLight('#eef6fa', '#849886', 2));
    const sun = new DirectionalLight('#fff2d6', 2.2);
    sun.position.set(200, 900, 180); this.scene.add(sun);
    this.controls = new OrbitControls(this.camera, this.renderer.canvas);
    this.controls.enableDamping = true;
    this.controls.minDistance = 12; this.controls.maxDistance = 2400;
    this.controls.target.set(0, 480, -80);
    this.camera.position.set(450, 840, 720);
    this.controls.update();
    this.transform = new TransformControls(this.camera, this.renderer.canvas);
    this.transform.setMode('translate'); this.transform.setSpace('world'); this.transform.setTranslationSnap(1);
    this.transform.setSize(0.8);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener('dragging-changed', e => { this.controls.enabled = !e.value; });
    this.transform.addEventListener('mouseDown', () => { this.movedByHandle = true; });
    this.transform.addEventListener('mouseUp', () => {
      if (this.selected && this.transform.object) this.onMove(this.selected, this.transform.object.position.clone());
    });
    const canvas = this.renderer.canvas;
    canvas.addEventListener('pointerdown', e => { this.down.set(e.clientX, e.clientY); this.movedByHandle = false; }, { capture: true });
    canvas.addEventListener('pointerup', e => {
      if (!this.active || this.movedByHandle || this.down.distanceTo(new Vector2(e.clientX, e.clientY)) > 5 || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.placement) {
        for (const hit of this.raycaster.intersectObject(this.world.group, true)) {
          const sel = this.selectionOf(hit.object);
          if (sel?.kind !== 'island') continue;
          const shape = this.world.terrain.islands.find(s => s.def.id === sel.id);
          if (shape && Math.abs(hit.point.y - shape.topHeight(hit.point.x, hit.point.z)) < 1.5) {
            this.onPlace(this.placement, sel.id, hit.point.clone()); break;
          }
        }
      } else {
        const hits = this.raycaster.intersectObjects([this.world.group, this.assets.group, this.markers], true);
        this.onSelect(hits.map(h => this.selectionOf(h.object)).find(s => s !== null) ?? null);
      }
    });
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (this.active && this.world) {
        this.controls.update();
        this.world.update(dt, this.camera, this.controls.target);
        globalUniforms.uTime.value += dt;
        this.renderer.render(this.scene, this.camera, dt);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  private selectionOf(object: Object3D): Selection | null {
    for (let o: Object3D | null = object; o; o = o.parent) if (o.userData.selection) return o.userData.selection as Selection;
    return null;
  }
  rebuild(region: Region): void {
    this.transform.detach(); this.objects.clear();
    if (this.world) disposeTree(this.world.group);
    this.assets?.dispose(); disposeTree(this.markers);
    this.world = new World(this.scene, QUALITY.low, regionLayout(region));
    for (const d of region.islands) {
      const object = this.world.group.getObjectByName('island-' + d.id);
      if (object) { object.matrixAutoUpdate = true; object.userData.selection = { kind: 'island', id: d.id }; this.objects.set('island:' + d.id, object); }
    }
    this.assets = buildAssets(region, this.world.terrain); this.scene.add(this.assets.group);
    this.assets.objects.forEach((o, id) => this.objects.set('asset:' + id, o));
    this.markers = new Group(); this.markers.name = 'authoring-checkpoints'; this.scene.add(this.markers);
    const marker = (position: [number, number, number], yaw: number, radius: number, selection: Selection, colour: string) => {
      const root = new Group(); root.position.fromArray(position); root.rotation.y = yaw * Math.PI / 180;
      root.userData.selection = selection;
      root.add(new Mesh(new TorusGeometry(radius, 0.55, 8, 48), new MeshBasicMaterial({ color: colour })));
      this.markers.add(root); this.objects.set(key(selection), root);
    };
    marker(region.start.position, region.start.yaw, 16, { kind: 'start', id: 'start' }, '#aa8656');
    region.checkpoints.forEach(c => marker(c.position, c.yaw, c.radius, { kind: 'checkpoint', id: c.id }, '#faf8f3'));
    const points = [new Vector3(...region.start.position), ...region.checkpoints.map(c => new Vector3(...c.position))];
    if (points.length > 1) this.markers.add(new Line(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: '#315e9c' })));
    this.select(this.selected);
  }
  select(selection: Selection | null): void {
    this.selected = selection;
    this.transform.detach();
    const object = selection ? this.objects.get(key(selection)) : undefined;
    if (object && !this.placement) {
      this.transform.showY = selection?.kind !== 'asset';
      this.transform.attach(object);
    }
  }
  focus(selection: Selection | null = this.selected): void {
    const object = selection ? this.objects.get(key(selection)) : undefined;
    const target = object?.position.clone() ?? new Vector3(0, 480, -80);
    const distance = selection?.kind === 'asset' ? 26 : selection?.kind === 'checkpoint' || selection?.kind === 'start' ? 90 : 350;
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new Vector3(distance * 0.6, distance * 0.6, distance));
    this.controls.update();
  }
  place(kind: RegionPreview['placement']): void {
    this.placement = kind;
    if (kind) this.transform.detach(); else this.select(this.selected);
  }
  screenPoint(position: Vector3): [number, number] {
    const p = position.clone().project(this.camera);
    return [(p.x * 0.5 + 0.5) * window.innerWidth, (0.5 - p.y * 0.5) * window.innerHeight];
  }
}
