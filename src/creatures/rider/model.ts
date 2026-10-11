// Assembles one rider look into a skinned mesh: body + outfit + hair + headgear + neckwear, all in
// one geometry (one draw call) on a fresh rig. Moving cloth is set up separately (cloth specs).

import { Color, MeshToonMaterial, SkinnedMesh, Vector2, type BufferAttribute, type BufferGeometry } from 'three';
import type { RiderLook } from '../../core/types';
import { applyPainterly, toonRamp } from '../../render/painterly';
import { creatureUniforms } from '../../render/uniforms';
import { CREATURE_LIGHT, CREATURE_LIGHT_PARS, RIDER_RIG_LIGHT } from '../wyvern/shading/light';
import { createRig, rigDims, type Rig } from './rig';
import { SkinBuilder } from './meshKit';
import { buildBody, makeBodyCtx, type BodyCtx } from './body';
import { outfitStyle } from './outfits';
import { buildHair } from './hair';
import { buildHeadgear, coversCrown } from './headgear';
import { buildNeckwear } from './accessories';
import { evalRecipe, riderPalette, type ColorRecipe, type RiderPalette } from './palette';
import { activeRiderProof, proofStyle, proofHeadShape, proofFace, type RiderProof } from './proof';
import { proofAtlas, type ProofMaps, type ProofAtlasSize } from './proofMaterials';
import { sculptProofProfiles, REFINED_BODY_SHAPE } from './softBody';
import { mixedWardrobe, wardrobeStyle } from './wardrobeModel';

export interface RiderModel {
  rig: Rig;
  mesh: SkinnedMesh;
  geometry: BufferGeometry;
  ctx: BodyCtx;
  palette: RiderPalette;
  /** Per vertex: how its color derives from the look (null = a constant color). */
  recipes: (ColorRecipe | null)[];
  proof?: RiderProof;
  /** Shared body sculpt; proof selects the C02 clothing cut, not the body generation. */
  bodyVersion: 'refined';
  textured: boolean;
}

let bodyMaterial: MeshToonMaterial | null = null;
const proofMaterials = new Map<string, MeshToonMaterial>();
export interface RiderModelOptions { proof?: RiderProof; maps?: ProofMaps; atlasSize?: ProofAtlasSize }

// Pale proof clothing uses the existing creature highlight shoulder. Keep emissive accents
// separate and leave the ordinary rider/world lighting unchanged.
const proofShoulder = /* glsl */ `{
  vec3 c02Lit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
  float c02L = dot(c02Lit, vec3(0.2126, 0.7152, 0.0722));
  float c02Knee = uDwBloomT - ${CREATURE_LIGHT.kneeBelow.toFixed(4)};
  float c02Room = ${(CREATURE_LIGHT.kneeBelow - CREATURE_LIGHT.ceilingBelow).toFixed(4)};
  if (c02L > c02Knee) c02Lit *= (c02Knee + c02Room * (1.0 - exp(-(c02L - c02Knee) * ${CREATURE_LIGHT.kneeSlope.toFixed(4)} / c02Room))) / c02L;
  outgoingLight = c02Lit + totalEmissiveRadiance;
}
`;

/**
 * The shared rider material: vertex-colored soft toon with the painterly rim and fog, plus a
 * per-vertex `glow` (circlet stone, goggle glints, catch lights) that brightens at night.
 */
export function riderMaterial(maps?: ProofMaps, size: ProofAtlasSize = 1024): MeshToonMaterial {
  const cacheKey = maps === 'off' ? 'off' : `${maps}-${size}`;
  const cached = maps ? proofMaterials.get(cacheKey) : bodyMaterial;
  if (cached) return cached;
  const textures = maps && maps !== 'off' ? proofAtlas(size) : undefined;
  const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(),
    map: textures?.color ?? null, normalMap: maps === 'normal' ? textures!.normal : null,
    normalScale: new Vector2(.3, .3),
  });
  applyPainterly(m, {
    rim: maps ? .65 : 1.15,
    onBeforeCompile: (shader) => {
      // The camera rig's kick and rim (camera/creatureLight.ts), shared with the wyvern.
      Object.assign(shader.uniforms, creatureUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vDwGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDwGlow = glow;');
      if (maps) shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float c02Surface;\nvarying float vC02Surface;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvC02Surface = c02Surface;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vDwGlow;\n' + CREATURE_LIGHT_PARS)
        .replace('#include <opaque_fragment>', RIDER_RIG_LIGHT + (maps ? proofShoulder : '') + '#include <opaque_fragment>')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vDwGlow * (0.45 + 1.8 * uNight);',
        );
      if (maps) shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vC02Surface;')
        // Connected skin/cloth rings interpolate across atlas regions. Keep those boundary
        // triangles neutral until they reach a fully cloth/material vertex; no woven skin.
        .replace('#include <map_fragment>', `vec4 c02Unmapped = diffuseColor;
          #include <map_fragment>
          diffuseColor = mix(c02Unmapped, diffuseColor, step(.999, vC02Surface));`)
        .replace('#include <normal_fragment_maps>', `vec3 c02UnmappedNormal = normal;
          #include <normal_fragment_maps>
          normal = normalize(mix(c02UnmappedNormal, normal, step(.999, vC02Surface)));`)
        .replace('#include <opaque_fragment>', `
          // Restrained broad bronze sheen; linen, slate and leather stay matte.
          if (vC02Surface > 3.5) {
            vec3 c02Sun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            vec3 c02Half = normalize(c02Sun + normalize(vViewPosition));
            float c02Sheen = pow(max(0.0, dot(normal, c02Half)), 12.0) * max(0.0, dot(normal, c02Sun));
            outgoingLight += diffuseColor.rgb * uSunColor * c02Sheen * .22 * (1.0 - uNight);
          }
          #include <opaque_fragment>`);
    },
  });
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}-rider-glow-rig-${maps ?? 'legacy'}`;
  if (maps) proofMaterials.set(cacheKey, m); else bodyMaterial = m;
  return m;
}

export function buildRiderModel(look: RiderLook, options: RiderModelOptions = {}): RiderModel {
  const proof = activeRiderProof(look, options.proof);
  const mixed = mixedWardrobe(look), textured = true;
  const dims = rigDims(look.outfit === 'travel-drape' ? 'medium' : look.build);
  const rig = createRig(dims);
  const pal = riderPalette(look);
  const b = new SkinBuilder(textured);
  const ctx = makeBodyCtx(b, dims, look, pal, proofHeadShape);
  sculptProofProfiles(ctx);
  const baseStyle = proof ? proofStyle(ctx, proof) : outfitStyle(look, pal, dims);
  const style = mixed ? wardrobeStyle(ctx, baseStyle, proof) : baseStyle;
  buildBody(ctx, { ...style, head: proofFace, shape: REFINED_BODY_SHAPE });
  const covered = coversCrown(look.headgear);
  buildHair(ctx, look, covered, true);
  buildHeadgear(ctx, look);
  buildNeckwear(ctx, look);
  const geometry = b.build();
  const mesh = new SkinnedMesh(geometry, riderMaterial(textured ? options.maps ?? 'color' : undefined, options.atlasSize));
  mesh.name = proof ? `C02-${proof}-proof` : `refined-rider-${look.outfit}`;
  mesh.add(rig.root);
  mesh.bind(rig.skeleton, mesh.matrixWorld.clone().identity());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Poses swing limbs far outside the bind-pose bounds; it's one small mesh, so skip culling.
  mesh.frustumCulled = false;
  return { rig, mesh, geometry, ctx, palette: pal, recipes: b.recipes, proof, bodyVersion: 'refined', textured };
}

/**
 * Recolor a built model for a look with the same shape (riderShapeKey) but new colors: rewrites
 * the vertex colors from their recipes, in place. ~1 ms instead of a ~20–40 ms rebuild.
 */
export function recolorRiderModel(model: RiderModel, look: RiderLook): void {
  const memo = new Map<ColorRecipe, Color>();
  const attr = model.geometry.getAttribute('color') as BufferAttribute;
  const arr = attr.array as Float32Array;
  const rs = model.recipes;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (!r) continue;
    const c = evalRecipe(r, look, memo);
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  attr.needsUpdate = true;
  model.palette = riderPalette(look);
  model.ctx.pal = model.palette;
  model.ctx.look = look;
}
