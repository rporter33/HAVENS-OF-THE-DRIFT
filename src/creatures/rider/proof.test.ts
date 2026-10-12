import { describe, expect, it } from 'vitest';
import { Matrix4, Mesh, SkinnedMesh, Vector3 } from 'three';
import { DEFAULT_RIDER } from '../../cosmetics/catalog';
import { createRiderPose } from '../../player/poses';
import { readDebugParams } from '../../debug/params';
import { buildRiderModel, recolorRiderModel } from './model';
import { Rider } from './Rider';
import { C02_LOOK, proofClothSpecs } from './proof';
import { proofAtlas, proofUV, proofTextureSize } from './proofMaterials';
import type { ClothRig } from './clothRig';
import { QUALITY } from '../../render/quality';
import { makeBodyCtx } from './body';
import { SkinBuilder } from './meshKit';
import { proofStyle } from './proof';
import { softUpperBody } from './softBody';

describe('approved C02 P1 development proof', () => {
  it('keeps bare shoulders and the open neckline on neutral skin UVs when outer layers are removed', () => {
    const look = { ...C02_LOOK, shoulderDrape: 'none', armWraps: 'none', chest: 'none' };
    const m = buildRiderModel(look, { proof: 'aerie' });
    const builder = new SkinBuilder(true), ctx = makeBodyCtx(builder, m.rig.dims, look, m.palette);
    softUpperBody(ctx, proofStyle(ctx, 'aerie'));
    const geo = builder.build(), color = geo.getAttribute('color'), surface = geo.getAttribute('c02Surface');
    let skinSamples = 0, linenSamples = 0;
    try {
      for (let i = 0; i < color.count; i++) {
        const skin = Math.abs(color.getX(i) - m.palette.skin.r) < 1e-6
          && Math.abs(color.getY(i) - m.palette.skin.g) < 1e-6 && Math.abs(color.getZ(i) - m.palette.skin.b) < 1e-6;
        if (skin) { expect(surface.getX(i)).toBe(0); skinSamples++; }
        else if (surface.getX(i) === 1) linenSamples++;
      }
      expect(skinSamples).toBeGreaterThan(300); expect(linenSamples).toBeGreaterThan(100);
    } finally { geo.dispose(); m.geometry.dispose(); m.rig.skeleton.dispose(); }
  });

  it('uses shared 1K/2K/3K maps with stable cloth state, UVs, rig and dye edits', () => {
    const rider = new Rider(C02_LOOK, { proof: 'wanderer', proofMaps: 'normal', quality: QUALITY.low });
    const mesh = rider.group.children[0] as SkinnedMesh, geometry = mesh.geometry, skeleton = mesh.skeleton;
    const uv = Array.from(geometry.getAttribute('uv').array);
    const pose = createRiderPose(); pose.airflow.set(8, 0, -12);
    for (let i = 0; i < 90; i++) rider.update(1 / 60, pose, null);
    const physics = (rider as unknown as { cloth: ClothRig }).cloth.pieces.map(pc => pc.cloth);
    try {
      for (const q of [QUALITY.medium, QUALITY.high, QUALITY.ultra, QUALITY.low, QUALITY.high]) {
        rider.setQuality(q);
        const size = proofTextureSize(q.level), mat = mesh.material as import('three').MeshToonMaterial;
        expect(size).toBe(q.level === 'low' ? 1024 : q.level === 'medium' ? 2048 : q.level === 'ultra' ? 4096 : 3072);
        expect((rider as unknown as { cloth: ClothRig }).cloth.pieces.map(pc => pc.cloth)).toEqual(physics);
        expect(mat.map).toBe(proofAtlas(size).color); expect(mat.normalMap).toBe(proofAtlas(size).normal);
        for (const c of rider.group.children.slice(1) as Mesh[]) if (c.geometry.getAttribute('uv')) {
          const cloth = c.material as import('three').MeshToonMaterial;
          expect(cloth.map).toBe(mat.map); expect(cloth.normalMap).toBe(mat.normalMap);
        }
        rider.setLook({ ...C02_LOOK, outfitPrimary: '#7e3a52' });
        expect(mesh.geometry).toBe(geometry); expect(mesh.skeleton).toBe(skeleton);
        expect(mesh.material).toBe(mat); expect(Array.from(geometry.getAttribute('uv').array)).toEqual(uv);
      }
      const lo = proofAtlas(), hi = proofAtlas(2048);
      expect(hi.color.image.width).toBe(2048); expect(hi.normal.image.width).toBe(2048);
      // Matching UV coordinates have identical dye/relief; intermediate 2K samples add detail.
      for (const [x, y] of [[51, 87], [267, 387], [769, 703]]) {
        const a = (y * 1024 + x) * 4, b = (y * 2 * 2048 + x * 2) * 4;
        expect(hi.color.image.data!.slice(b, b + 4)).toEqual(lo.color.image.data!.slice(a, a + 4));
        expect(hi.normal.image.data!.slice(b, b + 4)).toEqual(lo.normal.image.data!.slice(a, a + 4));
      }
      expect(proofTextureSize('high', 4096)).toBe(4096);
      expect(proofTextureSize('medium', 4096)).toBe(2048);
      expect(proofTextureSize('low', 4096)).toBe(1024);
      expect(proofTextureSize('high', 4096, 2048)).toBe(2048);
      expect(proofTextureSize('high', 4096, 1024)).toBe(1024);
      expect(readDebugParams('?riderTexture=4096').riderTexture).toBe(4096);
      expect(readDebugParams('?riderTexture=8192').riderTexture).toBeUndefined();
    } finally { rider.dispose(); }
  });

  it.each(['wanderer', 'aerie'] as const)('%s loose pieces remain bounded through gust reversals, inertia and hitches', proof => {
    const rider = new Rider(C02_LOOK, { proof }), pose = createRiderPose();
    const cloth = (rider as unknown as { cloth: ClothRig }).cloth;
    let time = 0, excursion = 0, ripple = 0;
    const dts = [1 / 240, 1 / 144, 1 / 60, 1 / 30, .1, .25];
    try {
      for (let i = 0; i < 900; i++) {
        const dt = dts[i % dts.length]; time += dt;
        pose.action = i % 200 < 100 ? 'run' : 'wave'; pose.actionTime = time;
        pose.velocity.set(4 * Math.sin(time), 0, 8 * Math.cos(time));
        pose.position.addScaledVector(pose.velocity, Math.min(.1, dt));
        pose.airflow.set(18 * Math.sin(time * 2), 4 * Math.cos(time), -90 * Math.cos(time * .7));
        rider.update(dt, pose, null);
        for (const pc of cloth.pieces) {
          expect(Array.from(pc.cloth.pos).every(Number.isFinite)).toBe(true);
          for (let r = 1; r < pc.spec.rows; r++) for (let c = 0; c < pc.spec.cols; c++) {
            const k = r * pc.spec.cols + c, p = pc.cloth.pos;
            const distance = Math.hypot(p[k * 3] - p[c * 3], p[k * 3 + 1] - p[c * 3 + 1], p[k * 3 + 2] - p[c * 3 + 2]);
            let path = 0;
            for (let row = 1; row <= r; row++) path += pc.spec.rest[row * pc.spec.cols + c].distanceTo(pc.spec.rest[(row - 1) * pc.spec.cols + c]);
            excursion = Math.max(excursion, distance / path);
            expect(distance).toBeLessThan(path * 1.03 + .035);
            ripple = Math.max(ripple, Math.abs(p[k * 3 + 2] - p[c * 3 + 2]));
          }
        }
      }
      expect(excursion).toBeGreaterThan(.5); expect(ripple).toBeGreaterThan(.08);
    } finally { rider.dispose(); }
  });

  it('joins shoulders, chest, neck and arms into one surface with only the four intended openings', () => {
    const m = buildRiderModel(C02_LOOK, { proof: 'wanderer' });
    const builder = new SkinBuilder();
    const ctx = makeBodyCtx(builder, m.rig.dims, C02_LOOK, m.palette);
    softUpperBody(ctx, proofStyle(ctx, 'wanderer'));
    const geometry = builder.build();
    try {
      const adjacency = new Map<number, Set<number>>(), edges = new Map<string, number>();
      const idx = geometry.index!;
      for (let i = 0; i < idx.count; i += 3) {
        const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        for (let k = 0; k < 3; k++) {
          const a = tri[k], b = tri[(k + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
          if (!adjacency.has(a)) adjacency.set(a, new Set());
          adjacency.get(a)!.add(b); adjacency.get(b)?.add(a);
        }
      }
      const visit = (graph: Map<number, Set<number>>, seed: number, seen: Set<number>) => {
        const stack = [seed];
        while (stack.length) { const v = stack.pop()!; if (seen.has(v)) continue; seen.add(v); stack.push(...graph.get(v)!); }
      };
      const seen = new Set<number>(); visit(adjacency, adjacency.keys().next().value!, seen);
      expect(seen.size).toBe(adjacency.size); // excludes unreferenced vertices inside removed patches
      const boundary = new Map<number, Set<number>>();
      for (const [edge, count] of edges) {
        expect(count).toBeLessThanOrEqual(2);
        if (count !== 1) continue;
        const [a, b] = edge.split('/').map(Number);
        if (!boundary.has(a)) boundary.set(a, new Set());
        if (!boundary.has(b)) boundary.set(b, new Set());
        boundary.get(a)!.add(b); boundary.get(b)!.add(a);
      }
      expect([...boundary.values()].every(neighbors => neighbors.size === 2)).toBe(true);
      const loops = new Set<number>(); let count = 0;
      for (const v of boundary.keys()) if (!loops.has(v)) { visit(boundary, v, loops); count++; }
      expect(count).toBe(4); // neck/head, torso/pelvis, left wrist, right wrist
    } finally { geometry.dispose(); m.geometry.dispose(); m.rig.skeleton.dispose(); }
  });
  it.each(['wanderer', 'aerie'] as const)('%s keeps valid skinned geometry, padded UVs and the provisional budget', proof => {
    const m = buildRiderModel(C02_LOOK, { proof });
    try {
      for (const attribute of Object.values(m.geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      const uv = m.geometry.getAttribute('uv'), p = m.geometry.getAttribute('position');
      expect(uv.count).toBe(p.count);
      const surfaces = m.geometry.getAttribute('c02Surface');
      expect(surfaces.count).toBe(p.count);
      expect(new Set(surfaces.array)).toEqual(new Set([0, 1, 2, 3, 4]));
      expect(Math.min(...uv.array)).toBeGreaterThanOrEqual(16 / 1024);
      expect(Math.max(...uv.array)).toBeLessThanOrEqual(1008 / 1024);
      expect(m.rig.skeleton.bones.length).toBe(27);
      const weights = m.geometry.getAttribute('skinWeight'), bones = m.geometry.getAttribute('skinIndex');
      for (let i = 0; i < p.count; i++) {
        expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1, 5);
        for (let k = 0; k < 4; k++) expect(bones.getComponent(i, k)).toBeLessThan(27);
      }
      // The authorized layering/shoulder/ankle art pass adds a small amount of fitted geometry.
      expect(m.geometry.index!.count / 3).toBeLessThanOrEqual(18000);
      expect(m.geometry.groups.length).toBe(0); // one skinned draw, no material groups
    } finally { m.geometry.dispose(); m.rig.skeleton.dispose(); }
  });

  it('keeps C02 clothing opt-in on other builds while using the shared refined body', () => {
    for (const build of ['slight', 'broad'] as const) {
      const m = buildRiderModel({ ...C02_LOOK, build }, { proof: 'aerie' });
      expect(m.proof).toBeUndefined(); expect(m.bodyVersion).toBe('refined'); expect(m.textured).toBe(true);
      m.geometry.dispose(); m.rig.skeleton.dispose();
    }
    const a = buildRiderModel(DEFAULT_RIDER), b = buildRiderModel(DEFAULT_RIDER, {});
    expect(a.mesh.material).toBe(b.mesh.material);
    expect(a.geometry.getAttribute('position').array).toEqual(b.geometry.getAttribute('position').array);
    expect(a.geometry.getAttribute('uv').count).toBe(a.geometry.getAttribute('position').count);
    expect(a.geometry.getAttribute('c02Surface').count).toBe(a.geometry.getAttribute('position').count);
    for (const m of [a, b]) { m.geometry.dispose(); m.rig.skeleton.dispose(); }
    expect(readDebugParams('?riderProof=invalid').riderProof).toBeUndefined();
    expect(readDebugParams('?riderProof=aerie&riderMaps=normal').riderProof).toBe('aerie');
  });

  it.each(['wanderer', 'aerie'] as const)('%s retints colors and cloth without rebuilding or changing UVs', proof => {
    const next = { ...C02_LOOK, skin: '#6a4230', hairColor: '#e8d8b0', outfitPrimary: '#8d3b52', outfitSecondary: '#315E9C' };
    const m = buildRiderModel(C02_LOOK, { proof }), fresh = buildRiderModel(next, { proof });
    const uv = Array.from(m.geometry.getAttribute('uv').array);
    recolorRiderModel(m, next);
    expect(m.geometry.getAttribute('color').array).toEqual(fresh.geometry.getAttribute('color').array);
    expect(Array.from(m.geometry.getAttribute('uv').array)).toEqual(uv);
    const rider = new Rider(C02_LOOK, { proof }), reference = new Rider(next, { proof });
    const geometry = (rider.group.children[0] as SkinnedMesh).geometry;
    rider.setLook(next);
    expect((rider.group.children[0] as SkinnedMesh).geometry).toBe(geometry);
    const clothColors = (r: Rider) => r.group.children.filter(c => c instanceof Mesh && !(c instanceof SkinnedMesh)).map(c => {
      const mat = (c as Mesh).material as import('three').MeshToonMaterial;
      return mat.color.toArray();
    });
    expect(clothColors(rider)).toEqual(clothColors(reference));
    rider.dispose(); reference.dispose();
    for (const model of [m, fresh]) { model.geometry.dispose(); model.rig.skeleton.dispose(); }
  });

  it('secures Aerie cloth and keeps Wanderer anchors valid', () => {
    for (const proof of ['wanderer', 'aerie'] as const) {
      const m = buildRiderModel(C02_LOOK, { proof });
      const specs = proofClothSpecs(m.ctx, proof);
      expect(specs.filter(s => s.name.startsWith('c02-')).length).toBe(proof === 'aerie' ? 0 : 2);
      for (const s of specs) {
        expect(s.rest.length).toBe(s.rows * s.cols);
        expect(s.anchorBone.slice(0, s.cols).every(b => b >= 0 && b < 27)).toBe(true);
      }
      m.geometry.dispose(); m.rig.skeleton.dispose();
    }
  });

  it.each(['wanderer', 'aerie'] as const)('%s retains contact/equipment frames through motion and remains finite at Low/High', proof => {
    const rider = new Rider(C02_LOOK, { proof }), existing = new Rider(C02_LOOK);
    const pose = createRiderPose(), a = new Matrix4(), b = new Matrix4();
    for (const quality of [QUALITY.low, QUALITY.high]) {
      rider.setQuality(quality);
      for (const action of ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'wave'] as const) {
        pose.action = action; pose.actionTime = .4; pose.airflow.set(20, -4, -80);
        for (let i = 0; i < 30; i++) { rider.update(1 / 60, pose, null); existing.update(1 / 60, pose, null); }
        for (const socket of ['bracer', 'harness', 'waist'] as const) {
          rider.equipmentFrame(socket, a); existing.equipmentFrame(socket, b);
          expect(a.elements).toEqual(b.elements);
        }
        for (const name of ['footL', 'footR', 'handL', 'handR']) {
          expect(rider.group.getObjectByName(name)!.getWorldPosition(new Vector3()).toArray())
            .toEqual(existing.group.getObjectByName(name)!.getWorldPosition(new Vector3()).toArray());
        }
        rider.group.traverse(o => { if (o instanceof Mesh) expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true); });
      }
    }
    rider.dispose(); existing.dispose();
  });

  it('shares a neutral 1K sRGB color atlas and a linear optional normal map', () => {
    const maps = proofAtlas(); expect(proofAtlas()).toBe(maps);
    expect(maps.color.image.width).toBe(1024); expect(maps.color.image.height).toBe(1024);
    expect(maps.color.colorSpace).toBe('srgb'); expect(maps.normal.colorSpace).toBe('');
    const [u, v] = proofUV('neutral', 0, 0), offset = (v * 1024 * 1024 + u * 1024) * 4;
    expect(Array.from(maps.color.image.data!.slice(offset, offset + 4))).toEqual([255, 255, 255, 255]);
  });

  it('applies the same linen atlas to moving drape/sash in each comparison mode and after dye changes', () => {
    for (const maps of ['color', 'normal', 'off'] as const) {
      const rider = new Rider(C02_LOOK, { proof: 'wanderer', proofMaps: maps });
      try {
        const sheets = rider.group.children.filter(c => c instanceof Mesh && !(c instanceof SkinnedMesh)
          && c.geometry.getAttribute('uv')) as Mesh[];
        expect(sheets).toHaveLength(6); // drape, sash and the four independently simulated chiton panels
        const materials = sheets.map(s => s.material as import('three').MeshToonMaterial);
        for (const mat of materials) {
          expect(mat.map).toBe(maps === 'off' ? null : proofAtlas().color);
          expect(mat.normalMap).toBe(maps === 'normal' ? proofAtlas().normal : null);
        }
        rider.setLook({ ...C02_LOOK, outfitPrimary: '#8d3b52', outfitSecondary: '#315e9c' });
        expect(sheets.map(s => s.material)).toEqual(materials);
      } finally { rider.dispose(); }
    }
  });
});
