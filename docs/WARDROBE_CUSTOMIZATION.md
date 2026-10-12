# Outfit customization

## Current clothing refinement

All seven complete outfits and mixes now share the reference-derived dye-neutral material atlas. Hanging lower tops use localized cloth: Scout tunic, Courier fronts/tails, Cartographer robes/sash ends, Skyknight tabard and Travel Drape chiton. Sewn Cartographer bell sleeves have free cuffs. Waist/arm seams are pinned; posed rest guides, damping, capsules and walkable ground bound the movement. Fitted bodices/trousers, wraps, leather and armor remain rig-supported. Cuffs, wraps and guards fit the selected dressed leg with shared knee/ankle weights. Rounded hems, straps, pouches and guards soften sharp silhouettes.

[Clothing review](rider-c02/CLOTHING_REVIEW.md) and [before/after gallery](rider-c02/evidence/clothing/index.html) supersede the older material/cloth limits below. Pre-integration: 1,201 tests, typecheck/build, 15 production smoke, 32 mixed-wardrobe and 30 clothing browser checks passed. Historical checkpoints remain for comparison; current integration status is in [AI_HANDOFF](AI_HANDOFF.md).

Robert requested pieces from **every existing outfit**. In the Stable, open **Outfit Pieces** from any complete preset. Mix garments from Flight Leathers, Scout, Courier, Racer, Cartographer, Skyknight and Travel Drape. Earned outfits also unlock their pieces; locked outfits retain their requirements. Complete presets remain available under Outfit.

| Slot | Examples |
| --- | --- |
| Top | Flight jacket, scout tunic, courier coat, racing top, cartographer robes, skyknight tabard, linen chiton |
| Trousers | Each outfit's trousers or underlayers |
| Chest layer | Harness, jerkin, racing chevron, map case, cuirass/faulds, slate scales |
| Shoulders & collar | Shearling, scout collar, courier epaulettes, racing collar, compass mantle, gorget/pauldrons, linen drape/brooch |
| Belt & sash | Outfit belts, pouches, courier/cartographer sash, woven sash |
| Sleeves & gloves | Gloves, bracers, cuffs, bell sleeves, vambraces, linen wraps |
| Leg wraps & guards | Scout calf wraps, skyknight knee guards, crossed leather wraps |
| Footwear | Outfit boots, greaves/boots, riding sandals |

**Match Outfit** follows the selected preset. Tops and trousers stay covered. The six outer slots also offer None; outfits without a particular outer layer inherit no layer in that slot. Brooch removal follows the linen drape. Main/Trim dye the cloth, and Scale/Leather dye mixed gear. Original unmodified presets retain their original palettes. Hair, headgear, scarf and cape remain selectable.

Stable edits preview immediately. **Revert** restores the entry look; **Save & leave** persists it. **Restore all outfit pieces** clears the mix and restores the selected complete set, keeping dyes, hair and accessories. Selecting a complete outfit clears the sparse mix. Older Travel Drape worn/removed choices remain readable and can be reset with Restore. Every outfit and mixed loadout now uses the shared refined body. Travel Drape's complete preset retains the approved medium-build Aerie cut; the six original presets retain Slight, Medium and Broad, including when wearing individual Travel Drape pieces. The longer Wanderer remains an explicit viewer choice.

## Persistence and rendering

- Existing outfit/unlock IDs and save key/version remain intact. Generated garment IDs inherit availability from their parent outfit, including previously recorded unlocks. They do not create duplicate reward notifications. Travel Drape and its original six components remain always available.
- The prior six flat C02 component fields and two gear colors remain supported. A new optional sparse `RiderLook.wardrobe` holds eight validated slot overrides. Invalid/wrong-slot IDs are dropped. Old saves without the map retain their original preset. Older game builds drop unsupported fields while retaining the rest of the save.
- Garments compose onto one refined body mesh and the existing 27-bone rig. The torso, neck and both arms share a connected surface; all presets use rounded limbs and the refined face/hair geometry. Outfit style functions retain their garment geometry, coverage, inflation, colors and boot transitions. Explicit gathered linen hems remain distinct from boot bounds. Fitted outer layers account for the selected top's thickness. The C02 clothing cut remains independent of the shared body; its geometry-parity checks still pass.
- Courier coat tails follow the selected **top**, rather than the base outfit. C02 loose drape/sash solvers follow their selected layers in the explicit Wanderer viewer. Normal Aerie drape/sash remain secured. Hair/scarf/cape retain existing solvers and contacts. Gust tests cover a mixed coat/drape loadout and quality changes without replacing solvers.
- Dyes update vertex colors in place, preserving geometry, UVs, skeleton, shared material and cloth solvers. Mixed garments use the existing shared toon material/atlas. The reference-derived C02 linen, slate, leather and bronze maps are retained; this is not a new UV or texture remaster of every legacy garment.
- Texture sizes remain 1K/2K/3K/4K for Low/Medium/High/Ultra. See [texture policy](TEXTURE_QUALITY.md) and [graphics budgets](GRAPHICS_QUALITY.md). Dragon runtime, renderer, flight, terrain and gameplay contracts are unchanged.

## Verification

**113 unit files / 1,187 tests passed**, plus typecheck, production build and **15/15 production smoke checks**. `sharedBody.test.ts` checks actual connected topology through both forearms and the neck for all seven presets and a legacy-base linen mix on all three builds, finite geometry, unchanged rig/build selection and original trouser/boot colors. `mixedWardrobe.test.ts` covers every individual garment on all three builds, parent unlock inheritance, old/new save validation, mixed dye parity, coat/drape solver selection and bounded gust/quality continuity. Additional regressions cover C02 geometry parity, neutral bare-skin UVs, mounted fit, progression and gameplay. Individual garment tests use a 32k triangle ceiling; this is not exhaustive certification of every possible multi-layer/accessory combination.

`scripts/rider-mixed-wardrobe-check.mjs` exercises the real Stable in isolated storage, a mix drawing from all seven outfits, preview/Revert, dyes, Save/reload, earned locks, restore and complete presets. Actual simulation checks cover takeoff, landing and dismount. Posed captures separately show front/back and both mounted sides at Medium/2K. [Current exact results](rider-c02/evidence/shared-body/mixed-wardrobe/verification.json); [earlier mixed gallery](rider-c02/evidence/mixed-wardrobe/index.html). Edge SwiftShader is functional/visual evidence, not GPU performance measurement. Historical Travel-only evidence remains in `evidence/wardrobe`; its older script describes that earlier UI.

The latest shared-body browser run passes **33 checks with 20 captures**: a saved Flight Leathers outfit at the normal title, all seven presets in the real Stable, linen pieces on a Flight base, dyes without rebuilding, identical saved choices after reload, actual takeoff/landing/dismount, all preset model views, Slight/Broad samples and both mounted sides. The existing mixed wardrobe run passes **32 checks** against the same build. See [the shared-body gallery and current mixed regression](rider-c02/evidence/shared-body/index.html). Existing saves automatically receive the refined geometry without a save migration or new cosmetic IDs. Legacy complete outfits retain their original material treatment; mixed/C02 looks retain their shared atlas.

Clearance is sampled rather than exhaustive. Long coats/robes, capes and large shoulder pieces can still need combination-specific art refinement. Cloth contacts cover existing body/mount capsules and walkable ground/decks, not arbitrary walls, foliage or cloth self-collision. Flight physics and the mounted rig/stirrups are unchanged by this extension.

## Light linen refinement

The Travel Drape top now includes two crossed linen overlaps with turned edges, so removing the chest/drape still leaves a layered garment. Its shoulders use rounded bridges and neutral bare-skin UVs; the lower leg blends into the foot and sandals use tapered ankle keepers. These follow the selected pieces without adding slots or save fields. The final light Aerie loadout has 14,336 triangles; the full costume has 17,590 within an explicitly raised provisional 18k C02 proof guard. The body retains one mesh/draw and 27 bones. [Matched art views and both mounted sides](rider-c02/evidence/layering/index.html) record 11 final checks/ten captures; the same source also passed 32 mixed wardrobe and nine local launcher checks. All texture tiers, cloth solvers, movement and flight remain unchanged from the prior mixed wardrobe release.
