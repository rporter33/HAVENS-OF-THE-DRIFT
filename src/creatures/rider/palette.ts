// Colors for one rider look: the player's picks plus the fixed materials (leathers, brass,
// steel) every outfit shares, all as linear Colors ready for vertex colors.
//
// Every color derived from a player pick remembers how it was made (a ColorRecipe: which pick,
// then which tone/mix steps), and the mesh builder records the recipe of each vertex. A
// color-only look change then re-evaluates the recipes and rewrites the vertex colors in place
// instead of rebuilding the whole skinned mesh (Rider.setLook).

import { Color } from 'three';
import type { RiderLook } from '../../core/types';
import { wardrobeKey } from '../../cosmetics/wardrobe';
import type {ProofSurface} from './proofMaterials';

export interface RiderPalette {
  skin: Color;
  skinShade: Color;
  blush: Color;
  lip: Color;
  eye: Color;
  eyeShine: Color;
  hair: Color;
  hairDark: Color;
  brow: Color;
  primary: Color;
  primaryDark: Color;
  primaryLight: Color;
  secondary: Color;
  secondaryDark: Color;
  scarf: Color;
  cape: Color;
  leather: Color;
  leatherDark: Color;
  boot: Color;
  sole: Color;
  brass: Color;
  steel: Color;
  steelDark: Color;
  cream: Color;
  cloth: Color;
  trousers: Color;
  glow: Color;
  gearScale: Color;
  gearLeather: Color;
}

const c = (hex: string) => new Color(hex);

/** The look fields a rider color can come from. */
export type ColorSlot = 'skin' | 'hairColor' | 'outfitPrimary' | 'outfitSecondary' | 'scarfColor' | 'capeColor' | 'armorColor' | 'leatherColor';

/** How a color was derived from the look's picks; constants are stored by value. */
export type ColorRecipe =
  | { k: 'slot'; s: ColorSlot }
  | { k: 'const'; r: number; g: number; b: number }
  | { k: 'tone'; a: ColorRecipe; f: number }
  | { k: 'mix'; a: ColorRecipe; b: ColorRecipe; t: number }
  | { k: 'lmix'; a: ColorRecipe; b: ColorRecipe; t: number }
  | { k: 'scale'; a: ColorRecipe; f: number };

const recipes = new WeakMap<Color, ColorRecipe>();
const surfaces = new WeakMap<Color, ProofSurface>();
/** Material identity follows the source garment and survives tone/dye derivation. */
export const surfaceOf=(color:Color):ProofSurface|undefined=>surfaces.get(color);
export function withSurface(color:Color,surface:ProofSurface):Color { surfaces.set(color,surface);return color; }
function inheritSurface(out:Color,a:Color,b?:Color,t=0):Color {
  const surface=surfaceOf(t>.5&&b?b:a)??(b?surfaceOf(b):undefined);
  if(surface)surfaces.set(out,surface);return out;
}
/** Clone recipes as well as colors: mixed sources must not mutate each other's palette. */
export function outfitMaterialPalette(pal:RiderPalette,outfit:string):RiderPalette {
  const surface=outfit==='flight'||outfit==='racer'?'leather':'linen';
  const copy={...pal};
  for(const key of ['primary','primaryDark','primaryLight','secondary','secondaryDark'] as const)
    copy[key]=withSurface(withRecipe(pal[key].clone(),recipeOf(pal[key])),surface);
  return copy;
}

/** The recipe of a color that depends on a player pick, or undefined for a constant. */
export function recipeOf(color: Color): ColorRecipe | undefined {
  return recipes.get(color);
}

/** Tag a color as derived (or tag a fresh pick); returns it. */
export function withRecipe(color: Color, r: ColorRecipe | undefined): Color {
  if (r) recipes.set(color, r);
  return color;
}

const asRecipe = (x: Color): ColorRecipe => recipes.get(x) ?? { k: 'const', r: x.r, g: x.g, b: x.b };

function mixRaw(a: Color, b: Color, t: number): Color {
  const x = a.clone().convertLinearToSRGB();
  const y = b.clone().convertLinearToSRGB();
  return x.lerp(y, t).convertSRGBToLinear();
}

function toneRaw(a: Color, k: number): Color {
  const x = a.clone().convertLinearToSRGB();
  x.r = Math.min(1, x.r * k);
  x.g = Math.min(1, x.g * k);
  x.b = Math.min(1, x.b * k);
  return x.convertSRGBToLinear();
}

/** Perceptual-ish mix in sRGB space so color picks blend the way artists expect. */
export function mixSrgb(a: Color, b: Color, t: number): Color {
  const out = mixRaw(a, b, t);
  if (recipes.has(a) || recipes.has(b)) recipes.set(out, { k: 'mix', a: asRecipe(a), b: asRecipe(b), t });
  return inheritSurface(out,a,b,t);
}

/** Darken/lighten in sRGB space (k < 1 darker). */
export function tone(a: Color, k: number): Color {
  const out = toneRaw(a, k);
  const r = recipes.get(a);
  if (r) recipes.set(out, { k: 'tone', a: r, f: k });
  return inheritSurface(out,a);
}

/** Linear-space lerp (meshKit's mixCol), recipe-aware. */
export function mixLinear(a: Color, b: Color, t: number): Color {
  const out = a.clone().lerp(b, t);
  if (recipes.has(a) || recipes.has(b)) recipes.set(out, { k: 'lmix', a: asRecipe(a), b: asRecipe(b), t });
  return inheritSurface(out,a,b,t);
}

/** Linear-space scale (meshKit's shade), recipe-aware. */
export function scaleLinear(a: Color, k: number): Color {
  const out = a.clone().multiplyScalar(k);
  const r = recipes.get(a);
  if (r) recipes.set(out, { k: 'scale', a: r, f: k });
  return inheritSurface(out,a);
}

/**
 * Evaluate a recipe for a look. `memo` caches shared sub-recipes (many vertices share one), so
 * recoloring a whole rider evaluates each distinct recipe once.
 */
export function evalRecipe(r: ColorRecipe, look: RiderLook, memo: Map<ColorRecipe, Color>): Color {
  const hit = memo.get(r);
  if (hit) return hit;
  let out: Color;
  switch (r.k) {
    case 'slot':
      out = new Color(look[r.s]);
      break;
    case 'const':
      out = new Color(r.r, r.g, r.b);
      break;
    case 'tone':
      out = toneRaw(evalRecipe(r.a, look, memo), r.f);
      break;
    case 'mix':
      out = mixRaw(evalRecipe(r.a, look, memo), evalRecipe(r.b, look, memo), r.t);
      break;
    case 'lmix':
      out = evalRecipe(r.a, look, memo).clone().lerp(evalRecipe(r.b, look, memo), r.t);
      break;
    case 'scale':
      out = evalRecipe(r.a, look, memo).clone().multiplyScalar(r.f);
      break;
  }
  memo.set(r, out);
  return out;
}

/** The look fields that change the rider's geometry; anything else is a color. */
export function riderShapeKey(look: RiderLook): string {
  return [look.build, look.hair, look.outfit, look.headgear, look.scarf, look.cape,
    look.chest, look.shoulderDrape, look.waist, look.armWraps, look.legWraps, look.footwear, wardrobeKey(look)].join('|');
}

const pick = (look: RiderLook, s: ColorSlot) => withRecipe(c(look[s]), { k: 'slot', s });

export function riderPalette(look: RiderLook): RiderPalette {
  const skin = pick(look, 'skin');
  const hair = pick(look, 'hairColor');
  const primary = pick(look, 'outfitPrimary');
  const secondary = pick(look, 'outfitSecondary');
  const pal:RiderPalette = {
    skin,
    skinShade: mixSrgb(tone(skin, 0.86), c('#a0503c'), 0.12),
    blush: mixSrgb(skin, c('#e06a60'), 0.22),
    lip: mixSrgb(tone(skin, 0.8), c('#a04040'), 0.35),
    eye: c('#1c1512'),
    eyeShine: c('#fff8ec'),
    hair,
    hairDark: tone(hair, 0.72),
    brow: tone(hair, 0.8),
    primary,
    primaryDark: tone(primary, 0.68),
    primaryLight: mixSrgb(primary, c('#fff4e0'), 0.25),
    secondary,
    secondaryDark: tone(secondary, 0.7),
    scarf: pick(look, 'scarfColor'),
    cape: pick(look, 'capeColor'),
    leather: c('#6a4630'),
    leatherDark: c('#3c2a20'),
    boot: c('#45301f'),
    sole: c('#241a14'),
    brass: c('#d8aa58'),
    steel: c('#9aa6b2'),
    steelDark: c('#5c6672'),
    cream: c('#eadcc0'),
    cloth: c('#d8c8a8'),
    trousers: mixSrgb(tone(primary, 0.5), c('#4a3e34'), 0.55),
    glow: c('#9ff0ff'),
    gearScale: pick(look, 'armorColor'),
    gearLeather: pick(look, 'leatherColor'),
  };
  for(const key of ['leather','leatherDark','boot','sole','gearLeather'] as const)withSurface(pal[key],'leather');
  for(const key of ['brass','steel','steelDark'] as const)withSurface(pal[key],'bronze');
  for(const key of ['cream','cloth','trousers','scarf','cape'] as const)withSurface(pal[key],'linen');
  withSurface(pal.gearScale,'scale');
  return outfitMaterialPalette(pal,look.outfit);
}
