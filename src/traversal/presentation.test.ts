import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferAttribute, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { DEFAULT_RIDER } from '../cosmetics/catalog';
import { Rider } from '../creatures/rider/Rider';
import { createRiderPose } from '../player/poses';
import { SkyLance } from './SkyLance';
import { SkyLanceVisuals } from './SkyLanceVisuals';
afterEach(() => vi.unstubAllGlobals());
describe('render-only Windline equipment', () => {
  it.each(['slight', 'medium', 'broad'] as const)('%s follows rebuilt rigs and produces finite geometry without moving gameplay anchors', build => {
    vi.stubGlobal('window', { innerHeight: 720 });
    vi.stubGlobal('document', { getElementById: () => null });
    const rider = new Rider(DEFAULT_RIDER), visuals = new SkyLanceVisuals();
    const lance = new SkyLance({ anchorValid: () => true, sweep: () => null });
    const pose = createRiderPose(), camera = new PerspectiveCamera(50, 16/9, .1, 1000);
    pose.mounted = false; pose.position.set(12, 400, -60); pose.action = 'fall'; pose.equipment = 'tether';
    lance.rope = {anchor: new Vector3(12, 415, -50), length: 20}; lance.state = 'anchored';
    camera.position.set(15, 403, -65); camera.lookAt(pose.position); camera.updateMatrixWorld();
    try {
      rider.setLook({...DEFAULT_RIDER,build});
      const initial = new Matrix4();
      for (const motion of ['cast', 'recover'] as const) for (const t of [0, .25, .5, .75, 1]) {
        pose.lanceMotion = motion; pose.lanceMotionT = t; pose.lineTension = t; pose.airBoost = t; pose.freefallSteer = t;
        rider.update(1/120, pose, null);
        rider.equipmentFrame('bracer', initial); expect(initial.elements.every(Number.isFinite)).toBe(true);
        const anchor = lance.rope.anchor.toArray(), position = pose.position.toArray();
        visuals.update(lance, rider, pose, .5); visuals.updateReticle(camera,pose.position,pose.velocity,lance);
        expect(lance.rope.anchor.toArray()).toEqual(anchor); expect(lance.rope.length).toBe(20); expect(pose.position.toArray()).toEqual(position);
        visuals.group.traverse(object => {
          if (object instanceof Mesh) {
            const attribute = object.geometry.attributes.position as BufferAttribute;
            expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
          }
        });
      }
      // Rebuilt equipment frames must translate with the new model rather than retaining old bones.
      const before = new Vector3().setFromMatrixPosition(initial);
      pose.position.x += 7; rider.update(0, pose, null);
      rider.equipmentFrame('bracer', initial);
      expect(new Vector3().setFromMatrixPosition(initial).x - before.x).toBeCloseTo(7, 5);
    } finally { visuals.dispose(); rider.dispose(); }
  });
  it.each(['slight', 'medium', 'broad'] as const)('%s has a visible two-arm freefall brake and a bracer-fired filament', build => {
    vi.stubGlobal('window', { innerHeight: 720 }); vi.stubGlobal('document', { getElementById: () => null });
    const rider = new Rider({...DEFAULT_RIDER,build}), visuals = new SkyLanceVisuals();
    const lance = new SkyLance({ anchorValid: () => true, sweep: () => null }), pose = createRiderPose();
    pose.mounted = false; pose.action = 'fall'; pose.equipment = 'bracer'; pose.freefallTilt = -1;
    try {
      for (let i = 0; i < 120; i++) rider.update(1/120,pose,null);
      const hips = rider.group.getObjectByName('hips')!, left = rider.group.getObjectByName('handL')!, right = rider.group.getObjectByName('handR')!;
      expect(hips).toBeDefined();
      const l = left.getWorldPosition(new Vector3()), r = right.getWorldPosition(new Vector3());
      expect(l.distanceTo(r)).toBeGreaterThan(1.3); // Both arms spread; no lance-carry override.
      const before = lance.position.clone();
      lance.throw(pose.position.clone().add(new Vector3(0,1,0)),new Vector3(0,0,1),new Vector3());
      lance.step(1/120,pose.position.clone().add(new Vector3(0,1,0)));
      visuals.update(lance,rider,pose,1);
      const seed = visuals.group.getObjectByName('windline-seed')!;
      expect(seed.visible).toBe(true); expect(seed.position.toArray()).toEqual(lance.position.toArray());
      expect(lance.position.equals(before)).toBe(false);
      pose.mounted = true; visuals.update(lance,rider,pose,1); expect(seed.visible).toBe(false);
    } finally { visuals.dispose(); rider.dispose(); }
  });
  it('clears freefall lean on touchdown and teleport rather than moving planted feet', () => {
    const rider = new Rider(DEFAULT_RIDER), pose = createRiderPose();
    pose.mounted = false; pose.action = 'fall'; pose.equipment = 'bracer'; pose.freefallTilt = 1;
    try {
      for (let i=0;i<120;i++) rider.update(1/120,pose,null);
      const hips = rider.group.getObjectByName('hips')!;
      expect(hips.rotation.x).toBeGreaterThan(1);
      pose.action = 'land'; pose.freefallTilt = undefined; rider.update(1/120,pose,null);
      expect(Math.abs(hips.rotation.x)).toBeLessThan(.2);
      pose.action = 'fall'; pose.freefallTilt = 1;
      for (let i=0;i<120;i++) rider.update(1/120,pose,null);
      pose.position.x += 100; pose.freefallTilt = undefined; rider.update(1/120,pose,null);
      expect(Math.abs(hips.rotation.x)).toBeLessThan(.2);
    } finally {rider.dispose();}
  });
});


describe('responsive aiming feedback',()=>{
  it('updates aim every frame without jumping on READY, bounds forecasts and clears stale eligibility',()=>{
    vi.stubGlobal('window',{innerHeight:720});
    const label={textContent:''},impact={style:{} as Record<string,string>};
    const el={hidden:false,closest:()=>null,dataset:{} as Record<string,string>,style:{} as Record<string,string>,querySelector:(query:string)=>query==='[data-impact]'?impact:label};
    vi.stubGlobal('document',{getElementById:()=>el});let now=1000;const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
    let queries=0;
    const lance=new SkyLance({anchorValid:()=>true,sweep:(_from,to,radius)=>{queries++;return radius===.08?{fraction:1,point:to.clone().setZ(20),normal:new Vector3(0,0,-1),anchorId:'surface'}:null;}});
    const camera=new PerspectiveCamera(50,16/9,.1,1000);camera.position.set(0,1002,-6);camera.lookAt(0,1002,20);camera.updateMatrixWorld();
    const visuals=new SkyLanceVisuals(),feet=new Vector3(0,1000,0),v=new Vector3();
    try{
      visuals.updateReticle(camera,feet,v,lance);expect(el.dataset.target).toBe('reachable');const left=el.style.left;const firstQueries=queries;
      camera.lookAt(5,1002,20);camera.updateMatrixWorld();now+=1;visuals.updateReticle(camera,feet,v,lance);
      expect(el.style.left).not.toBe(left);expect(el.dataset.target).toBe('checking');expect(queries).toBe(firstQueries);
      now+=50;visuals.updateReticle(camera,feet,v,lance);expect(el.dataset.target).toBe('reachable');
      const x=el.style.left,y=el.style.top;
      lance.state='spent';visuals.updateReticle(camera,feet,v,lance);expect(el.style.left).toBe(x);expect(el.style.top).toBe(y);
      lance.state='ready';now+=50;visuals.updateReticle(camera,feet,v,lance);const before=queries;
      for(let i=0;i<120;i++){now+=1000/120;visuals.updateReticle(camera,feet,v,lance);}
      expect(queries-before).toBeLessThanOrEqual(40); // Two world sweeps per forecast, at most 20 forecasts/sec.
      el.hidden=true;now+=100;const hiddenQueries=queries;visuals.updateReticle(camera,feet,v,lance);
      expect(queries).toBe(hiddenQueries); // Mounted/menu HUD does not forecast an unusable cast.
    }finally{clock.mockRestore();visuals.dispose();}
  });
});

describe('head-down dive to flat braking silhouette',()=>{
  it.each(['slight','medium','broad'] as const)('%s rotates the whole limb chain smoothly and leaves supported poses unchanged',build=>{
    const rider=new Rider({...DEFAULT_RIDER,build}),pose=createRiderPose();pose.mounted=false;pose.action='fall';pose.equipment='bracer';pose.freefallTilt=-1;pose.velocity.set(0,-9,0);
    const point=(name:string)=>rider.group.getObjectByName(name)!.getWorldPosition(new Vector3());
    try{
      for(let i=0;i<120;i++)rider.update(1/120,pose,null);
      const flat=point('head').sub(point('hips'));expect(Math.abs(flat.y)).toBeLessThan(.25);expect(flat.z).toBeGreaterThan(.35);
      const spread=point('handL').distanceTo(point('handR'));expect(spread).toBeGreaterThan(1.3);
      let previous=point('head'),maxStep=0;
      for(let i=0;i<120;i++){
        pose.freefallTilt=-1+2*(i+1)/120;rider.update(1/120,pose,null);const head=point('head');maxStep=Math.max(maxStep,head.distanceTo(previous));previous=head;
      }
      const dive=point('head').sub(point('hips'));expect(dive.y).toBeLessThan(-.4);expect(Math.abs(dive.z)).toBeLessThan(.25);expect(maxStep).toBeLessThan(.04);
      expect(point('footL').y).toBeGreaterThan(point('hips').y);expect(point('handL').distanceTo(point('handR'))).toBeLessThan(spread*.6);
      pose.action='land';pose.freefallTilt=undefined;rider.update(1/120,pose,null);expect(point('head').y).toBeGreaterThan(point('hips').y);
    }finally{rider.dispose();}
  });
});
