import type { RiderGarmentSlot, RiderLook } from '../../core/types';
import { GARMENT_SLOTS, TRAVEL_PIECES, garmentChoice, garmentSource } from '../../cosmetics/wardrobe';
import { outfitStyle } from './outfits';
import { proofClothSpecs, proofStyle, type RiderProof } from './proof';
import { allClothSpecs, coatSpecs, type ClothSpec } from './accessories';
import { torsoPanel } from './garments';
import { tone } from './palette';
import type { BodyCtx, OutfitStyle, Side } from './body';

export function mixedWardrobe(look: RiderLook): boolean {
  const base = { ...look, wardrobe: undefined };
  return (Object.keys(GARMENT_SLOTS) as RiderGarmentSlot[]).some(p => garmentChoice(look, p) !== garmentChoice(base, p));
}
function bootTop(id: string | undefined, ctx: BodyCtx): number {
  const { d } = ctx;
  const offsets: Record<string, number> = { flight: .07, scout: .17, courier: .04, racer: .2, cartographer: .2, skyknight: -.02 };
  return id && id !== 'travel-drape' ? d.thigh + (offsets[id] ?? .07) * d.h : Infinity;
}

/** Compose existing style functions against one body/rig, never stack whole body meshes. */
export function wardrobeStyle(ctx: BodyCtx, base: OutfitStyle, proof?: RiderProof): OutfitStyle {
  const { look, d, pal } = ctx;
  const parts = Object.keys(GARMENT_SLOTS) as RiderGarmentSlot[];
  const sources = Object.fromEntries(parts.map(p => [p, garmentSource(look, p)])) as Record<RiderGarmentSlot, string | undefined>;
  const gearPal = { ...pal, leather: pal.gearLeather, leatherDark: tone(pal.gearLeather, .65), boot: tone(pal.gearLeather, .7),
    steel: pal.gearScale, steelDark: tone(pal.gearScale, .75) };
  const contexts = new Map<string, BodyCtx>();
  const styles = new Map<string, OutfitStyle>();
  for (const id of new Set(Object.values(sources).filter((s): s is string => !!s))) {
    const component = { ...ctx, pal: gearPal, look: { ...look, ...TRAVEL_PIECES, outfit: id } };
    contexts.set(id, component);
    styles.set(id, id === 'travel-drape' ? proofStyle(component, proof ?? 'aerie') : outfitStyle(component.look, gearPal, d));
  }
  const style = (p: RiderGarmentSlot) => styles.get(sources[p] ?? '');
  const top = style('top') ?? base, pants = style('trousers') ?? base, arms = style('armWraps'), boots = style('footwear');
  const upperArm = d.upperArm + .02 * d.h;
  const shoeTop = bootTop(sources.footwear, ctx);
  const wrapTop = d.thigh + .17 * d.h;
  const scoutWrap = sources.legWraps === 'scout';
  const trouserHem = sources.trousers === 'travel-drape' ? pants.leg.bounds[0] : Infinity;
  const gatherHem = trouserHem < shoeTop - .01*d.h ? trouserHem : 0;
  const pantsColor = (s: number, th: number, side: Side) => pants.leg.color(sources.trousers === 'travel-drape' ? s : Math.min(s, .2 * d.h), th, side);
  const pantsInflate = (s: number) => pants.leg.inflate(sources.trousers === 'travel-drape' ? s : Math.min(s, .2 * d.h));
  const wrapped = (s: number) => scoutWrap && s >= wrapTop - .16 * d.h && s <= wrapTop;
  const bounds = [...new Set([gatherHem, ...pants.leg.bounds, ...(boots?.leg.bounds ?? []),
    ...(scoutWrap ? [wrapTop - .16 * d.h, wrapTop] : [])].filter(Number.isFinite))].sort((a, b) => a - b);
  return {
    ...base, modular: true,
    torso: {
      surface: top.torso.surface,
      color: (y, th, p) => y > 1.455 * d.h ? pal.skin : y < .965 * d.h ? pantsColor(0, th, 1)
        : sources.top === 'skyknight' ? pal.primary : top.torso.color(y, th, p),
      inflate: (y, th) => y > 1.455 * d.h ? 0 : y < .965 * d.h ? pantsInflate(0) : top.torso.inflate(y, th),
      bounds: [...top.torso.bounds, .965 * d.h, 1.455 * d.h],
    },
    arm: {
      surface: top.arm.surface,
      color: (s, th, side) => s < upperArm ? top.arm.color(s, th, side) : arms?.arm.color(s, th, side) ?? pal.skin,
      inflate: s => s < upperArm ? top.arm.inflate(s) : arms?.arm.inflate(s) ?? 0,
      bounds: [...top.arm.bounds, ...(arms?.arm.bounds ?? []), upperArm],
    },
    leg: {
      color: (s, th, side) => s > shoeTop ? boots!.leg.color(s, th, side) : wrapped(s) ? styles.get('scout')!.leg.color(s, th, side) : pantsColor(s, th, side),
      inflate: s => s > shoeTop ? boots!.leg.inflate(s) : wrapped(s) ? Math.max(.008, pantsInflate(s)) : pantsInflate(s),
      bounds, gatherHem, clothEnd:Math.min(trouserHem,shoeTop), bootStart:Number.isFinite(shoeTop)?shoeTop:undefined,
    },
    hand: arms?.hand ?? pal.skin, cuff: arms?.cuff,
    foot: boots?.foot ?? { color: pal.skin, sole: pal.skin },
    extras: body => {
      for (const part of parts) {
        const id = sources[part]; if (!id) continue;
        const component = { ...contexts.get(id)!, b: body.b, legStyle:body.legStyle };
        const sourceStyle = styles.get(id)!;
        // Raise fitted outer pieces by any difference between their original underlayer
        // and the chosen top. Keep the original profile/offsets for complete presets.
        if (part !== 'top' && part !== 'trousers') component.torsoAt = y => {
          const r = ctx.torsoAt(y);
          const lift = Math.max(0, ...[0, Math.PI / 2, Math.PI].map(th => top.torso.inflate(y, th) - sourceStyle.torso.inflate(y, th)));
          return { ...r, rx: r.rx + lift, rf: r.rf + lift, rb: r.rb + lift };
        };
        if (part === 'chest' && id === 'skyknight') body.b.surface('scale', () => {
          for (const [th0, th1] of [[.35, Math.PI - .35], [Math.PI + .35, Math.PI * 2 - .35]]) torsoPanel(component, {
            th0: () => th0, th1: () => th1, yTop: 1.35 * d.h, yBot: 1.045 * d.h, inflate: .024,
            thickness: .006, cols: 10, rows: 5, color: () => gearPal.steel,
          });
        });
        sourceStyle.extras(component, part);
      }
    },
  };
}

/** Courier tails follow the chosen top; C02 loose cloth follows equipped drape/sash only. */
export function wardrobeClothSpecs(ctx: BodyCtx, proof?: RiderProof): ClothSpec[] {
  const { look } = ctx;
  const c02 = { ...look, ...TRAVEL_PIECES,
    shoulderDrape: garmentSource(look, 'shoulderDrape') === 'travel-drape' ? 'chlamys' : 'none',
    waist: garmentSource(look, 'waist') === 'travel-drape' ? 'woven-sash' : 'none' };
  const specs = proofClothSpecs({ ...ctx, look: c02 }, proof ?? 'aerie');
  if (garmentSource(look, 'top') === 'courier') specs.push(...coatSpecs(ctx, { ...look, outfit: 'courier' }));
  return specs;
}

export function riderClothSpecs(ctx: BodyCtx, proof?: RiderProof): ClothSpec[] {
  const accessories = mixedWardrobe(ctx.look) ? wardrobeClothSpecs(ctx, proof) : proof ? proofClothSpecs(ctx, proof) : allClothSpecs(ctx, ctx.look);
  return [...accessories, ...ctx.garmentCloth];
}
