# Localized garment refinement

Latest integration: reviewed main `f97bac5` is included with the rider runtime preserved.
**119 files / 1,286 tests**, typecheck/build and repeated game/clothing integration checks
pass. [Current captures and source hashes](evidence/qa/integration/index.html).

Current follow-up: [four-pass QA review](QA_REVIEW.md) and [28 new production captures](evidence/qa/index.html).
The follow-up repairs material identity, final cloth-surface contacts and bell sleeves, gives
heavy cloth its own response, and corrects rigid armor weighting. **119 files / 1,260 tests,
two dedicated audits, typecheck/build, 15 smoke, 32 mixing/flight and 33 browser checks** pass.
The implementation and counts below describe the preserved preceding clothing checkpoint.

Robert broadened this pass from lower-leg joins to a major clothing refinement: loose lower
tops should behave as cloth like the existing capes/shawls, while retaining every outfit and
mixed piece, softer silhouettes and the supplied art/material direction.

## Implementation

- `garments.ts` collects hanging tunic, robe, coat, tabard and chiton panels instead of drawing
  duplicate rigid skirts. Rounded corners, shallow folds and interpolated surfaces retain the
  original cuts/dye recipes. Seams start at the actual bodice instead of a wider hip hull.
- `cloth.ts` adds opt-in springs/travel envelopes around posed rest guides. Existing distance,
  bending, tethers, frame inertia, wind and contacts remain. `clothRig.ts` skins guides with
  existing bones. Top rows stay attached; free hems ripple/swing without streaming away.
  Quality changes reuse solvers; dyes update vertex colors in place.
- Courier rear tails use bounded guides. Cartographer sash ends use cloth; the original bell
  sleeves were closed sewn sheets. The QA follow-up uses secured inner vents over fitted
  lining, an attached elbow root and free outer bell fabric; it removes duplicate sleeve bulk.
- `legFit.ts` supplies one dressed-leg envelope and shared knee/ankle weights to body, wraps,
  stripes, cuffs and knee shells. Modular contexts receive the selected envelope. Short linen
  hems do not draw a rolled cuff through high boots. Legs have 16 smooth sectors; broad wraps
  use 13 points around the calf, with curved cuff rolls.
- Rounded strap sections, pouch/buckle corners and shallow knee guards soften existing detail.
- Complete outfits now share the material atlas with mixed/C02 looks. Dry linen/worn leather
  are dye-neutral; pale tops use the established highlight shoulder. Original illustrations
  are references, not imported UV textures. Existing Low/Medium/High/Ultra dimensions remain
  1K/2K/3K/4K, shared across instances and dyes.

Fitted bodices/trousers, wraps, armor and leather remain rig-supported. Secure Aerie drape/sash
and approved costume components remain. Long Wanderer stays an explicit viewer selection.
No new wardrobe/save fields or unlock IDs are added in this pass.

## Verification

Current integrated review: **117 files / 1,239 tests**, typecheck/build, production smoke
15/15, Stable mixing 32/32, clothing 30/30 with 24 fresh captures and local menu/launcher
12/12 passed. Reviewed main `a7adb45` is included in branch integration `f287267`.
Windline gameplay/controller and editor authoring/save-isolation workflows passed too.
[Current captures and exact reports](evidence/clothing/integration/index.html) include the
integrated source hashes. Flight/traversal, shared world geometry and rider animator/IK
match reviewed main. The normal local menu serves this verified compiled release.

Three implementation/capture passes follow preserved source checkpoint
`60755b4f968db58b77210000cb9e6e8c7c91d129a90c3bc10555f3be95db5e89`.
[Scope hashes](evidence/clothing/scope-verification.json) compare every source file. Flight,
movement, rig/animator/IK, world geometry, saddle/stirrups, saves, unlocks, tiers and dragon source
are unchanged against that checkpoint. Ground contact now applies to legacy garment cloth
through the existing terrain query too.

Pre-integration: **114 files / 1,201 tests**, typecheck/build passed. Includes all 7 trousers ×
8 footwear choices on all three builds, all individual garments, shared topology, mounted
contacts, saves/unlocks and sustained gust/hitch/calm tests. Development runs caught an infinite
hem arithmetic defect and exceeded the old 18k body guard; finite hem handling and a smaller
wrap sampling count fixed both. The original 18k C02 body guard passes. Cloth geometry and
particles are reported separately for every view.

Production smoke **15/15**: normal title, controls, flight, pause, quality, clean production boot.
Real Stable mixing **32/32**: preview/Revert, efficient dyes, Save/reload, parent locks, preset
restore and actual takeoff/landing/dismount. Clothing browser proof **30/30 with 24 captures**:
all seven presets, four lower-leg mixes, both mounted sides of hanging costume types, bank,
brake, wave and walk. Browser gust reversals move free panels while seams remain attached;
maximum sampled guide travel is 7 cm and measured seam drift is zero. Posed captures are
separate from actual flight tests. [Gallery](evidence/clothing/index.html), [measurements](evidence/clothing/final/verification.json).

The checkpoint counts immediately above precede main integration. The current counts at
the start of this section and the latest [handoff](../AI_HANDOFF.md) record integrated status.

## Art-direction categories

| Category | Reference and implementation | Evidence, observation and status |
| --- | --- | --- |
| Costume/silhouette | Master v2 + Wanderer/Scout references; `outfits.ts`, `proof.ts`, `garments.ts`, `softBody.ts` | Seven preset, walk/wave and mounted views: rounded hems/broad folds, identities retained. Partial: legacy coats/plate are not converted into canonical linen costumes. |
| Palette/materials | Master swatches + approved M01 study; `proofMaterials.ts`, `model.ts`, `clothRig.ts` | Pale/blue/slate views: shared dry weave/grain, restrained highlights and efficient dyes. Verified at sampled views; atlas dimensions are not per-garment 4K maps. |
| Armor/detail | AN-AR-10 Cloudstep knee cups, AN-AR-11 Skywrap greaves, AN-AR-12 Rider-sole sandals; `legFit.ts`, `outfits.ts`, `proof.ts` | Lower-leg mixes/mounted sides show shallow rounded shells and dressed-leg joins. Partial: preserve selectable legacy armor; not a full armor replacement. |
| Animation/camera clearance | Master saddle-safe cloth guidance; existing rig/contacts and bounded garments | Both sides, bank/brake/walk/wave and actual gameplay tests pass. Sampled coverage, not every layered accessory/pose. |
| Lance/banner, bracer/tether/harness | Existing contracts | Not changed by this pass. Source preservation verified; new art compliance not claimed. |
| Architecture and dragons | Existing shared guide | Not changed; backgrounds provide context. New art compliance not claimed. |

## Limits

Bounded presentation cloth, not a garment-pattern simulator. Contacts use existing body/mount
capsules and walkable ground/decks, without arbitrary wall/foliage, self-collision, wet cloth
or stacking collision between every outer layer. Guides intentionally limit travel near joints
and saddles. Finite polygon models retain facets at extreme zoom; sampled silhouettes are
softened, not claimed mathematically smooth. Edge SwiftShader proves function/appearance,
not sustained hardware performance. Atlas cache limits remain in [texture policy](../TEXTURE_QUALITY.md).
Main is not merged or deployed by this review work.
