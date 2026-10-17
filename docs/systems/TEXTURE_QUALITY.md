# Rider and dragon texture quality budgets

Robert initially requested desktop/laptop support including integrated graphics, then revised
the target after a successful local playtest: Low remains for integrated graphics; Medium,
High and Ultra prioritize dedicated cards. The authorized 2K/3–4K texture sizes remain;
[graphics quality targets](GRAPHICS_QUALITY.md) records the additional shadows, grass, drawn
cloth subdivisions and atlas anisotropy. This document separates the
implemented shared rider atlas from the corresponding target for future dragon bitmap materials.
Existing WebGL 2, soft toon rendering, efficient dyes and flight behavior remain the baseline.

| Quality | Shared rider atlas, implemented | Dragon bitmap target, documented only |
| --- | --- | --- |
| Low | 1024² / 1K | 1K fallback for a future shared body/wing atlas |
| Medium | 2048² / 2K | 2K, shared across dragons using the same surface set |
| High | 3072² / 3K default; optional 4096² / 4K comparison | 3K default; evaluate 4K on the nearby hero dragon |
| Ultra, existing tier | 4096² / 4K | Same 4K ceiling; no automatic increase beyond it |

The runtime caps the rider choice to the WebGL renderer's actual maximum texture dimension.
The High comparison query is `riderTexture=3072` or `riderTexture=4096`, alongside
`riderProof=wanderer|aerie`. It never overrides Low's 1K or Medium's 2K budget and is not saved.
`riderMaps=color` remains the default; `normal` enables the optional tangent normal map and
`off` keeps the material comparison. All seven complete outfits and mixes now use the shared
atlas. Outfit identities, unlocks and saved choices remain unchanged.

## What higher resolution means here

The supplied M01 image is an illustrative material study, not a UV-ready map pack. The proof's
dye-neutral procedural maps reproduce its dry linen weave, quiet slate grain, worn leather and
soft bronze. Each size is generated directly from the material functions; it is not an enlarged
1K bitmap. Identical normalized UVs preserve motif scale and normal relief strength. The skin
and cloth boundary mask prevents an interpolated atlas lookup from putting linen detail on skin.

One combined atlas supplies four padded material tiles. Their usable widths are 480, 960,
1440 and 1920 pixels at 1K, 2K, 3K and 4K respectively. These are atlas dimensions, not a
separate full-resolution map for every garment. Uniform world-space texel density and a bespoke
production unwrap remain art tasks; more pixels alone do not improve silhouette or anatomy.

## Memory and fallback

Approximate GPU storage for uncompressed RGBA8 with the full mip chain:

| Square atlas | Color only | Color plus optional normal |
| --- | ---: | ---: |
| 1K | 5.33 MiB | 10.67 MiB |
| 2K | 21.33 MiB | 42.67 MiB |
| 3K | 48 MiB | 96 MiB |
| 4K | 85.33 MiB | 170.67 MiB |

These estimates exclude geometry, render targets, shadows, CPU pixel arrays, driver overhead
and the rest of the game. CPU arrays also remain for WebGL context restoration: 4/16/36/64 MiB
per map. Atlas/material caches are shared across rider instances and dyes. Normal pixels are
created lazily. Visited resolutions remain cached, so switching through every size retains
more than the active row's budget; the 1K–4K color set is approximately 160 MiB on the GPU,
or 320 MiB if every normal variant has also been uploaded. No per-dye copy is created.

3K uses about 44% less map memory than 4K. It remains the High default after both
rendered successfully in the production browser. Low remains the fallback for integrated
graphics. The earlier cloth/material browser evidence used software SwiftShader. The later
quality pass includes a short actual-RX-9070-XT/1440p sample, with no runtime errors or automatic
resolution reduction, but does not certify sustained frame rate, safe peak memory or all
dedicated graphics cards. Wider hardware measurements and a useful image difference at gameplay
distance should precede a production 4K High default.

## Dragons: current source and the matching target

Current `src/creatures/wyvern/materials.ts` generates body colors, countershading, scales,
markings, scale relief and membrane detail in shaders from bind-space coordinates and uniforms.
There are no body color/normal bitmap maps to resize. `createBodyMaterial` and
`createMembraneMaterial` support shader detail variants; `Wyvern` currently constructs their
default detail-2 variant. `Wyvern.setQuality` stores the quality level; it does not itself
replace these materials with new bitmap maps. Resolution labels must not imply otherwise.

The table is the corresponding authoring/budget target **if dragon bitmap materials are added
in a separately scoped change**. Retain the procedural breed patterns, recoloring, deformation,
membrane backlight and distance filtering. Share reusable maps across compatible dragons;
avoid allocating a full 4K set per individual. Measure body and wing texel density separately,
and use close, chase-camera, bank/dive, day/night and multiple-dragon views to decide whether
4K adds useful detail. Do not convert dragons to PBR, migrate renderers or change their flight
physics as a consequence of this budget. No dragon runtime source is changed by this work.

## Current clothing behavior

Loose Wanderer drape, sash, ponytail and selected existing accessories use the fixed-substep
cloth solver with relative air, frame inertia, attachment tethers and body/mount capsules.
C02 and the new hanging garment panels opt into non-bouncy contact and mild sliding friction.
Tunic, coat, robe, tabard and chiton panels, Cartographer sash ends and sewn bell sleeves use
bone-skinned rest guides with attached seams and bounded free hems. Additional damping and a
small low-speed flutter floor let textiles react to a breeze and settle after gusts. Quality
switches preserve simulation state. Existing scarves, capes and hair retain their response.

Low particles can contact walkable ground/decks through the same `groundAt` query used by
walking and foot placement. This is a walkable height surface, not arbitrary wall/foliage
collision, wet-cloth simulation or self-collision. Ground projection is vertically resolved.
Fitted bodices, trousers, wraps, leather, armor and Aerie's secured drape remain rig-driven.
The chiton's hanging lower panels now move. Mounted contacts, equipment sockets and flight
simulation remain. [Latest evidence and limits](../rider-c02/CLOTHING_REVIEW.md).

See [cloth and resolution evidence](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/cloth-hd/index.html), its manifests and
[the current rider report](../rider-c02/README.md) for checks, captures and remaining limits.
