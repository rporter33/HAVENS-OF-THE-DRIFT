import { describe, expect, it } from 'vitest';
import { cosmeticsFor, DEFAULT_RIDER } from '../../cosmetics/catalog';
import { withGarment } from '../../cosmetics/wardrobe';
import { buildRiderModel } from './model';
import { B } from './rig';
import { SkinBuilder } from './meshKit';
import { outfitStyle } from './outfits';
import { softLeg,SOFT_LEG_SEGMENTS } from './softBody';

describe('shared refined rider body', () => {
  it.each(['slight', 'medium', 'broad'] as const)('%s: every preset and a legacy-base linen mix connect both arms through the torso and neck', build => {
    const looks = cosmeticsFor('riderOutfit').map(o => ({ ...DEFAULT_RIDER, build, outfit: o.id }));
    looks.push(withGarment(withGarment({ ...DEFAULT_RIDER, build }, 'top', 'travel-drape-top'), 'trousers', 'travel-drape-trousers'));
    for (const look of looks) {
      const m = buildRiderModel(look);
      try {
        expect(m.bodyVersion).toBe('refined');
        expect(m.rig.skeleton.bones.length).toBe(27);
        const idx = m.geometry.index!, adjacency = new Map<number, Set<number>>();
        for (let i = 0; i < idx.count; i += 3) for (let k = 0; k < 3; k++) {
          const a = idx.getX(i + k), b = idx.getX(i + (k + 1) % 3);
          if (!adjacency.has(a)) adjacency.set(a, new Set());
          if (!adjacency.has(b)) adjacency.set(b, new Set());
          adjacency.get(a)!.add(b); adjacency.get(b)!.add(a);
        }
        const seen = new Set<number>(), stack = [idx.getX(0)], bones = new Set<number>();
        const si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight');
        while (stack.length) {
          const v = stack.pop()!; if (seen.has(v)) continue; seen.add(v);
          for (let k = 0; k < 4; k++) if (sw.getComponent(v, k) > .01) bones.add(si.getComponent(v, k));
          stack.push(...adjacency.get(v)!);
        }
        // The old first body component stopped at the torso: separate arm tubes and neck.
        for (const bone of [B.foreArmL, B.foreArmR, B.neck]) expect(bones.has(bone), `${look.outfit}/${build}/${bone}`).toBe(true);
        expect(m.ctx.look.outfit).toBe(look.outfit);
        expect(m.rig.dims.build).toBe(look.outfit === 'travel-drape' ? 'medium' : build);
        for (const a of Object.values(m.geometry.attributes)) expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      } finally { m.geometry.dispose(); m.rig.skeleton.dispose(); }
    }
  });

  it.each(['flight', 'scout', 'courier', 'racer', 'cartographer', 'skyknight'])('%s preserves trouser and boot colors without interpreting boot bounds as linen hems', outfit => {
    const m = buildRiderModel({ ...DEFAULT_RIDER, outfit });
    try {
      const b = new SkinBuilder(), ctx = { ...m.ctx, b }, style = outfitStyle(ctx.look, ctx.pal, ctx.d);
      softLeg(ctx, style, 1);
      const geo = b.build(), color = geo.getAttribute('color'), position = geo.getAttribute('position');
      try {
        // The first vertex in each loft ring is theta=0. Check its actual selected style,
        // including the boot segment, rather than a generic linen/skin fallback.
        for (let i = 0; i < color.count; i += SOFT_LEG_SEGMENTS) {
          const s = ctx.bp.thighL.y - position.getY(i), expected = style.leg.color(s, 0, 1);
          expect(color.getX(i)).toBeCloseTo(expected.r, 5);
          expect(color.getY(i)).toBeCloseTo(expected.g, 5);
          expect(color.getZ(i)).toBeCloseTo(expected.b, 5);
        }
      } finally { geo.dispose(); }
    } finally { m.geometry.dispose(); m.rig.skeleton.dispose(); }
  });
});
