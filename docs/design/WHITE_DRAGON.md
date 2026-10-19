# The white dragon

[Design index](README.md) · [Decision log](DECISION_LOG.md#q47--open-the-white-dragon-gate-g12-and-on-what-terms--answered-2026-10-19) · [Model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md)

Written 2026-10-19 against main `ae839d9`, from Robert's "Begin work on the white dragon". Robert opened gate G12 the same day (Q47) and settled customization (Q48); the dragon's name and voice are still open (Q47f). Statements about source in the design sections are from reading it, cited by file and line (wyvern files under `src/creatures/wyvern/`, others under `src/`). The G12a sections near the end record what was built, run and tested.

## What the white dragon is

The white clan's elder dragon, as [render 08](../art/targets/08-sleek-dragon-elder.png) shows it: resting on a tower-top platform beside a white clan banner, an elder in a broad white mantle at its shoulder. Rare and old.

| | |
|---|---|
| **Exists in source** | Nothing. No four-legged creature, no dragon rig, no elder, no non-player creature of any kind, no tower-top platform. |
| **Usable in this build** | Nothing. |
| **Approved direction** | Four-legged dragons join the roster when their rig exists (Q1). The five clans and ten elders are game canon, introduced in the comic first (Q13). The Air Nomads, the player culture, carry the white flight (Q23). The game should closely match the renders, dragons included; white blends toward ivory and powder blue "as the elder dragon render (08) shows" (Q36). Creature bodies may come from Meshy if Claude can edit the Blender source to fit the game (Q20, Q38). Every flight's dragons are customized with parts, and dragons of one flight differ by a small hue change (Q48). The [render brief](../art/targets/RENDER_BRIEF.md): four legs plus two wings, sleeker and larger than the wyverns, swept branching horns and whiskers, ivory and powder blue, belongs to the clan elders. |
| **Future ideas, not authorized** | The dragon as a mount, a dragon that flies over the haven, the elder speaking, the five-rival course with one rival per flight (Q44). The other four flights' elder dragons are canon (Q13) but not scheduled. |

The [storyboard](../website/storyboard/chapter-01/README.md) puts one dragon elder and one wyvern elder per clan on a broad tower-top platform above each settlement. Since the Air Nomads are the white flight, this reads as the player culture's own elder dragon; its tower stands at Windhaven (Q47d).

## Its form, from render 08

- **Body plan:** six limbs. Four walking legs, and two wings growing from the middle of the back, well behind the front shoulders, with clear back between the neck and the wing roots. The front legs are legs; the wings are not arms.
- **Head:** long and refined, gentle brow, long tapering muzzle, mouth closed, pale blue eyes. Swept, branching, antler-like horns in bone ivory. Two long whiskers from the upper lip that hang to the ground. Swept-back ivory cheek fins.
- **Neck:** long and upright in a gentle S, about the length of the body. Broad ivory throat plates in front, powder-blue plates and ivory spines along the top.
- **Body:** deep chest, long trunk. Ivory below, powder-blue plates along the back and flanks. Matte, with broad plates rather than small scales, as the brief asks.
- **Wings:** bat-like, a hooked thumb claw at the wrist. Ivory membrane, powder-blue bones on the leading edge. Folded and half raised at rest.
- **Legs:** slender forelegs, strong hind legs, four toes each with short slate claws.
- **Tail:** very long, curled around the platform at rest, with a low ivory fin along the top.
- **Pose at rest:** lying like a sphinx. Forelegs stretched forward, hind legs folded under, tail curled, head high.
- **Scale:** measured against the elder (about 1.75 m, ~130 px/m at the chest's depth), with the perspective corrected by eye: head ≈ 1.5 m, neck ≈ 2.5 to 2.8 m, chest front to rump ≈ 5.6 m, tail ≈ 11 m, folded wing forearm ≈ 2.5 m and leading finger ≈ 6 m (a span near 20 m). Lying down, the back is about 1.9 m above the platform and the head about 3.5 m. Nose to tail is about 20.6 m. For comparison, the Harrier has a 15.5 m wingspan and stands 2.6 m (`flight/breeds.ts:71,89`). (The first version of this line over-stated the resting heights as 3 m and 5 to 6 m.) Render 08 now only sets the size; the proportions come from the approved sheet ([below](#the-approved-sheet-and-the-meshy-body)).

## What the game has to build on

The wyvern is "two-legged" but already walks on four feet, pterosaur-style. Its wings are its forelimbs, and the folded wing-wrists are its front feet. The gait plants four feet (`creatures/wyvern/gait.ts:1-19`, `FOOT_COUNT = 4`), and the front-foot IK is the wing (`anim/ground.ts:578-637`). So a dragon doesn't add a quadruped walk. It adds a sixth limb pair: real forelegs with their own shoulders, and wings moved onto the back.

**Reusable as is:**
- the geometry builder: skinning, up to four influences, the shader attributes (`builder.ts`; `parts/chain.ts`, `parts/shape.ts`);
- the IK helpers (`ik.ts`);
- the four-foot planting machinery (`gait.ts`) and the stride math (`core/gait.ts`);
- the AO bake (`ao.ts`) and creature lighting (`shading/light.ts`);
- most of the hide shader and its colour uniforms (`materials.ts`);
- the tail as a verlet chain (`anim/tail.ts`);
- the rider's saddle contract, an `Object3D` with +Z forward and origin at the seat (`game/contracts.ts:214-219`).

**Reusable once generalised:**
- `BodyPlan` and `Hide`: the neck count becomes a parameter.
- The life layer's neck tables, which have exactly six entries (`anim/life.ts:28-40`).
- The wing builder and the 26 wing-pose channels (`parts/wings.ts`, `wingPoses.ts`). The wing root moves from the forelimb to the back, and membrane sector C, tied to the flank from shoulder to hip, gets a new attachment line.
- The hind legs (`parts/legs.ts`), as the template for four legs.
- The debug collision proxies (`collision.ts`).

**Must be new:**
- The rig. `RigIndex` holds exactly two wings and two legs (`rig.ts:56-57`), and the wyvern has 58 bones, pinned by a test (`wyvern.anatomy.test.ts:590-593`).
- A foreleg chain with its own IK.
- A driver that isn't the player's pose. There's no non-player creature anywhere: the only wyverns outside tests are the player's mount, the race ghost and debug lineups (`game/Game.ts:161`, `race/RaceGhost.ts:432`, `debug/showcases/wyvern.ts:449,457`).
- Its own anatomy tests and pose golden.

**Two constraints shape the route:**
- **The breed tables are closed.** `BreedId` is harrier | skimmer | galewing | ironback (`core/types.ts:109`). `BREED_SHAPES`, `LOD_BUDGET`, `FLAP_STYLES`, `GAIT_PROFILES` and the default colours are all `Record<BreedId, …>`. The pose golden runs every breed in `BREED_ORDER` and fails on a breed it has no fixture for. Save validation rejects unknown breeds, and its test uses `'dragon'` as the example (`progression/save.test.ts:105,229`). So a dragon as a fifth `BreedId` touches every wyvern test and the save. As its own creature module it touches none of them.
- **The creature never drives physics.** `FlightModel` imports nothing from creatures, and the collision proxies are for debugging and tests only (`collision.ts`). For a dragon resting in the world, what you hit has to come from the world's own colliders. The dressing kit has `colChain`, spheres strung along a curve, built for "what you see is what you hit, within about half a meter" (`world/dressing/colliderKit.ts:1-13`).

No imported creature loader exists on main. The Harrier's Meshy trial (`creatures/wyvern/trial.ts`, `scripts/blender/harrier_meshy_fit.py`) came with PR #11, which merged into `art/astra-targets-2026-10-17` rather than main (2026-10-19). It binds a Blender-fitted body, by bone name, to a skeleton the game itself defines.

## The route (chosen, Q47)

1. **Its own module,** `src/creatures/dragon/`. It's not a `BreedId`, so no wyvern table, test, golden or save path changes. Shared helpers are imported, not edited. If one has to change, the wyvern goldens prove the change is a no-op for the wyverns.
2. **The game owns the skeleton,** as it does for the wyverns: a six-limb rig definition in code, written to the approved reference sheet. It's built to the mount standard from the start, with full foreleg chains and a seat socket on the back between the neck and the wing roots, so a mount later never needs a second rig.
3. **The body from Meshy, fitted in Blender** to that skeleton: the Harrier trial's route (Q38), with the fit script generalised from `harrier_meshy_fit.py`. The [model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) has Robert's Astra and Meshy steps. The fit bakes the region, belly and back attributes, so the existing hide shader paints the white flight.
4. **Customization through parts, colour from the flight** (Q48; [below](#customization-parts-and-flight-colour)). Horns, whiskers, cheek fins, spines and tail tip are interchangeable parts on one body. A dragon's colours come from its flight plus a small hue change. Whiskers hang as verlet strands like the tail, so they cost no bones.
5. **Rest first.** It lies in render 08's pose with idle life: breathing, blinking, the head following the player within a cone, whiskers swaying, the wings settling, the tail tip moving. It never walks or flies in G12.
6. **Dev-only until accepted.** It appears in a `?view=` showcase first, and in the normal build only after Robert accepts captures beside render 08.

**The alternative**, a procedural body grown from the wyvern builder, avoids a Meshy dependency but has to reach render 08's head, chest and wing roots in code. For the Harrier, the code pass closed the colour gap but not the form gap (Q38).

### The skeleton and the bone budget

| Chain | Wyvern today | White dragon (G12a) |
|---|---|---|
| Trunk: root, spine, chest, breath, pelvis | 5 | 5 |
| Neck | 6 | 6, longer segments |
| Head: head, jaw, tongue ×2, cheek fans ×2 | 6 | 4 (no tongue; the mouth stays closed at rest) |
| Tail | 10 | 10 |
| Wings, ×2: humerus, forearm, hand, claw, three fingers × two segments | 20 | 18, rooted on the back; no claw bone |
| Hind legs, ×2: thigh, shin, metatarsus, toes | 8 | 8 |
| Forelegs, ×2: scapula, humerus, forearm, hand, toes | none | 10 |
| Wing-fold helpers ×2, gular | 3 | 3 |
| **Total** | **58** | **64** |

The wyvern budget is 64 bones, which keeps the bone texture at 16×16. It's tested, not enforced at runtime (`wyvern.anatomy.test.ts:107,448-449`). The first draft was 66 to 68. G12a holds 64 by dropping the tongue (the mouth stays closed at rest) and the wing claw bones: the thumb claw rides the hand, since a dragon never walks on its wings. The gular bone stays for the breathing throat.

## Customization: parts and flight colour

Robert, 2026-10-19 (Q48): every flight's dragons are customized with parts, and their colours vary within a flight by a small hue change.

**What the wyvern has.** The parts are slots in the cosmetic catalog: pattern, horns, frill, tail tip and saddle (`cosmetics/catalog.ts:33-70`), each with unlocks from feathers, medals and relics. PR #11 adds an interchangeable head slot (Q39). Antlers and cheek fans are already wyvern options (`catalog.ts:48,56`). A wyvern's colours are free hex picks: `WyvernLook` says "Colors are always free" (`core/types.ts:479-493`).

**The dragon's look.**
- **Data:** its flight (white, red, green, blue or black; black also picks its violet or ember tint), a hue shift, and one part per slot. The elders' dragons are characters whose looks we author (Q48c); there is no player-facing dragon customization. It isn't a `WyvernLook`, so wyvern saves don't change.
- **Colours are derived, not picked.** Each flight has a palette (hide, plates, belly, membrane, wing bones, claws, eyes), and a dragon's palette is the flight's turned by its hue shift. The shift is at most ±8° (Q48b), with the whole palette turning together and lightness and saturation held, so every dragon of a flight reads as that flight. The shift is a stored number, never random at runtime.
- **Parts fit every flight** (Q48a). Every dragon shares one body and one skeleton, and each part attaches to named bones, so a part built once fits all five flights.

| Slot | The white elder's part (render 08) | Other options to draw on |
|---|---|---|
| Horns | branching antlers, swept back | swept, crown, ram, lancehorn, as the wyvern catalog has them |
| Whiskers (new) | two long, hanging to the ground | short and curled, forked, none |
| Frill | cheek fins and a row of dorsal spines | sail crest, mane |
| Tail tip | a low fin along the top | spade, blade, ribbon fins |
| Pattern | plates: ivory below, powder blue along the back | the wyvern's markings, re-drawn for the plates |

| Flight | Main hue | Accent (Q36's neighbouring hue) | Within the flight (Q48) |
|---|---|---|---|
| White | ivory | powder-blue plates | a small shift: warmer ivory to cooler blue |
| Red | red | orange to yellow | a small shift |
| Green | green | teal or yellow-green | a small shift |
| Blue | blue | purple | a small shift |
| Black | near black | a deep violet or an ember tint, one per dragon | a small shift within its tint |

Only the white flight has values so far (the [model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md)'s table, from render 08). The other four get theirs from their own renders, and none exist yet.

**Budget.** Parts share the dragon's accessory allowance (2,000 to 4,000 triangles above the bare body) and ride existing bones.

## Three roles, in order of cost

| Role | What it needs beyond the rest | Gate |
|---|---|---|
| **R1, an elder you meet** | The skeleton, the body, the parts and the resting idle above. Its tower and a static collider. | G12 (below) |
| **R2, flying over the haven** | Wing poses and a beat for back-mounted wings, four legs tucking in flight, take-off and landing from the tower, a scripted path. Presentation only, no flight model. | Its own gate |
| **R3, a mount (Q1)** | A creature-type key beside `BreedId` so the per-breed tables can hold it, flight stats, the four-foot gait with real foreleg IK, a saddle between the wing roots (a girth becomes possible), rider-fit and mounted tests, records and ghosts per breed (Q7), the save sanitizer accepting the id with no schema change, the dragon expert's review. Size L to XL. | Its own gate |

Chosen (Q47b): R1 now. The skeleton is built to R3's standard, so neither R2 nor R3 needs a second rig.

## Gate G12: the white dragon at rest (opened 2026-10-19)

Three steps, each its own PR with its own checks. None changes `src/flight`, `src/player`, the save, controls or any wyvern module's output.

| Step | Changes | Acceptance | Size |
|---|---|---|---|
| **G12a** Skeleton, body and parts (dev-only) | `src/creatures/dragon/`: the six-limb rig, proportions from the approved sheet, an export of the bind skeleton for Blender (as G3b exported the Harrier). `scripts/blender/dragon_meshy_fit.py` generalised from the Harrier fit. The dragon's look data, the five slots and the white elder's part in each. The white flight's palette and the hue shift. The fitted GLB under `src/assets/` with its provenance and register entry (route, model and version, task id or "not recorded", plan tier, date). | New anatomy tests: six limbs, symmetric chains, the bone budget, the triangle budget per LOD ([below](#the-distance-models); exploratory, from the [model budgets](../../Art%20and%20Assets/Guides/model-budgets/README.md): LOD0 16,000 to 20,000 bare and up to 24,000 with parts, LOD1 4,000 to 5,000 bare and up to 6,000, LOD2 1,000 to 1,300 bare and up to 1,500), bind proportions within tolerance of the sheet. Every part attaches to its bones and stays inside the accessory allowance. Derived colours stay within the bound and are the same on every run. A fit report: every vertex weighted, at most four influences. All wyvern suites and the pose golden unchanged. Typecheck, full vitest, smoke 15/15. | M |
| **G12b** Resting showcase (dev-only) | `?view=white-dragon`: the dragon in render 08's pose on a stand-in platform, the idle life layer, its own driver, a camera matched to render 08, a capture manifest. A lineup of white dragons across the hue shift and part swaps. | Captures beside render 08 scored on the brief's three questions: identity, fidelity, reachability. In the lineup, Robert judges that every dragon reads as the white flight and that each part reads at gameplay distance; the ±8° shift is tuned here. The idle is stable across frame rates, as the wyvern tail test checks. No console errors; smoke 15/15. Robert times Medium on his GPU. | S to M |
| **G12c** On its tower | A tower-top platform at Windhaven (Q47d), built with the haven's kit. Colliders: a cylinder for the tower and a `colChain` along the resting body. The white banner. The idle reacts to the player nearby. In the normal build once Robert has accepted G12b. | Dressing and editor checks green, with protected routes clear (spawn, stable door, launch deck). Collision within half a meter of what is seen. Race lines, cloud clearance and the Windline sweep unchanged. Flight replays bit-identical. Captures from render 10's approach and from the plaza. Draw calls at Medium within budget. | M |

### G12a status, 2026-10-19 (third session)

Built on `gate/g12a-white-dragon` as data, tests and dev-only assets. Nothing draws them yet, and no existing module changed; wyvern helpers are imported, not edited.
- `creatures/dragon/look.ts` and `catalog.ts` (first session): the flights, the five slots, the white flight's palette, the ±8° shift, and the white elder's parts and look. Each catalog option now names its geometry pieces; the plate pattern is shading and has none.
- `creatures/dragon/proportions.ts` and `rig.ts`: the six-limb skeleton, 64 bones, now measured from the approved sheet ([below](#the-approved-sheet-and-the-meshy-body)). The neck follows the sheet's S, one rise per segment, and the head pitches nose-down as drawn. The body center stands 3.4 m up. The wings spread flat to 21.8 m, rooted mid-back where side view C roots them. The seat is in the middle of the flat back between the withers and the wing roots.
- `creatures/dragon/skeleton.ts` and `scripts/dragon-export-skeleton.mjs`: the bind skeleton as JSON for Blender. It lists every bone's pivot and end, the named points the fit maps onto, and each weighted bone's span. The export runs `node scripts/dragon-export-skeleton.mjs [--out path]`.
- `scripts/blender/dragon_meshy_fit.py`: the fit, generalised from `harrier_meshy_fit.py` (PR #11). It was run through the Blender MCP on 2026-10-19 ([below](#the-fit)).
- `src/assets/dragon/white-dragon.glb` and `creatures/dragon/asset.ts`: the fitted body (1.13 MB) and its parser. The provenance is in the file and in the [asset register](../../assets/catalog/register.json) (`white-dragon-meshy-body`). The raw downloads and the sheet are archived on `archive/g12a-white-dragon` with SHA-256.
- `src/assets/dragon/white-dragon-lod1.glb` and `-lod2.glb` (third session): the [distance models](#the-distance-models), decimated from the fitted body by the fit script's `make_lod`. Same layout and parser; registered with the body.
- `src/assets/dragon/white-dragon-parts.glb`, `creatures/dragon/parts.ts` and `scripts/blender/dragon_parts.py` (third session): [the white elder's parts](#the-parts) at every LOD, their parser and the script that builds them. Registered as `white-dragon-parts`.
- The master, `havens-blender-pilot/white-dragon-pilot.blend`, now holds the parts (collection `White Dragon Parts`) and the LOD copies, and was saved again (the register has its new SHA-256).
- Tests: `look`, `catalog`, `rig`, `skeleton`, `asset` and `parts`, 70 in all. The rig tests hold the skeleton to side view C within ±5% on lengths and 0.15 m on every joint (the neck and tail joint by joint), and to the Meshy body's wing bones within ±5%. They also check that the body plan doesn't fold where the upright neck meets the torso. The asset tests check the fitted body and each distance model:
  - it binds by name to every bone and sits in its LOD's bare budget;
  - it weights every vertex with at most four bones and stands where the skeleton stands;
  - each body triangle is one region, with claws only on the feet and wings, and the two primitives share no vertex;
  - the tube's arc length runs smoothly (LOD0), and the membrane's panel coordinate spans 0 to 3;
  - it records its provenance, and each distance model the SHA-256 of the LOD0 file it came from.

  The parts tests check that:
  - each of the white elder's catalog options has its pieces at every LOD;
  - every piece rides only bones the skeleton has, each the bones it's built for, and the skeleton is still 64 bones;
  - the parts stay inside the allowance at every LOD, and the body with them inside each LOD's ceiling;
  - every connected bit of geometry touches the hide, or the rest of its part (a tine its beam);
  - left and right match;
  - the whiskers carry their strands from the lip;
  - the shader channels are kept apart;
  - the file records its sources.

Still to do in G12a:
- **Robert's confirmations** in Q50: the size, the wing's source and the membrane's root.
- **Robert's review** of [PR #15](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/15), the parts and LODs included.

Not started: anything visible. That is G12b.

### The parts

`scripts/blender/dragon_parts.py` builds the white elder's set from `white-dragon-parts.png` (archived). Each piece is procedural, placed by ray casts onto the fitted body's own surface and skinned to bones the skeleton already has.

| Piece | Catalog option | Shape | Rides | Triangles (LOD0 / 1 / 2) |
|---|---|---|---|---:|
| Horns | `horns/branching` | Behind the eyes, swept back and out in a wide V, the tips turning up. A brow tine forward and out, three tines rising off the beam | `head`, rigid | 800 / 182 / 68 |
| Whiskers | `whiskers/long` | Two strands of 3.6 m from the upper lip, out to the side and back along the jaw, then drooping | `head`, rigid; strand coordinates for a verlet hang | 350 / 90 / none |
| Cheek fins | `frill/finCrest` | Four rays swept back from the cheek, with a scalloped web between them | `fanL` / `fanR`, rigid | 320 / 120 / none |
| Spines | `frill/finCrest` | Seven flattened blades from behind the skull down the nape, 0.42 m shrinking to 0.14 m, leaning back 50° | the neck's own weights where each meets the hide | 294 / 84 / none |
| Tail fin | `tail/fin` | Nine back-swept teeth on the last third of the tail, 0.30 m shrinking to 0.06 m | the tail's own weights under each column | 550 / 222 / none |
| **All** | | | | **2,314 / 698 / 68** |

- **No bones are added.** The whiskers carry strand coordinates per vertex: which strand, and 0 at the root to 1 at the tip. Their rest nodes, 12 per strand, are in the file, so G12b can hang them as verlet strands the way the tail hangs. Until then they ride the head rigidly. The 3.6 m length lets them reach the platform with the dragon lying down, as the catalog has it.
- **Shading:** the hide shader's channels. Horns, spines, fin rays and the tail fin are the horn region (`aUv2.x` 0 at the base to 1 at the tip). The whiskers are hide with the belly's cloud white. The cheek fins' web is a fin membrane in the membrane group. The flight palette has no horn colour yet: the kit names "pale bone ivory" without a value, so G12b maps it.
- **The variant sheets** (swept, crown and spiral horns; curled, forked and barbel whiskers; sail crest, mane and small cheek fins; spade, blade and ribbon tail tips) aren't built. Each would be another builder on the same anchors and bones, and another catalog option.
- **Checked:** in Blender solid-shaded renders, on the fitted body in the bind pose: the side and front against the parts sheet, then from above and three-quarter. The head was rendered with back-face culling to check that every face points outward. LOD1's parts were looked at on LOD1's body. Not checked: LOD2's horns on LOD2's body, any posed or animated frame, the game's shaders, and gameplay distance.

### The distance models

Budgets, from the [model budgets](../../Art%20and%20Assets/Guides/model-budgets/README.md). The guide gives a complete wyvern with its gear 4,000 to 6,000 triangles at medium distance and 1,000 to 1,500 far. The wyverns' own ceilings are 6,000 and 1,500 (`wyvern/parts/res.ts`). The dragon's LODs keep the whole creature, parts included, inside those ceilings, with the bare body taking most of each.

| LOD | Bare body | Parts | With parts | Built | File |
|---|---:|---:|---:|---|---|
| 0, close | 16,000 to 20,000 | 2,000 to 4,000 | up to 24,000 | 17,999 + 2,314 = 20,313 | `white-dragon.glb` (1.13 MB) |
| 1, medium | 4,000 to 5,000 | up to 1,000 | up to 6,000 | 4,500 + 698 = 5,198 | `white-dragon-lod1.glb` (305 KB) |
| 2, far | 1,000 to 1,300 | up to 200, horns only | up to 1,500 | 1,270 + 68 = 1,338 | `white-dragon-lod2.glb` (94 KB) |

`make_lod` in `dragon_meshy_fit.py` copies the fitted body and wings and decimates each by symmetric collapse. LOD1 has 3,000 body and 1,500 wing triangles; LOD2 has 850 and 420, the same two to one as LOD0. The decimation interpolates the weights, which are then held to four bones. The shader attributes and the membrane mask are copied from the nearest LOD0 vertex instead: regions are categories, and the girth angle wraps around the tube, so interpolating either would invent values. `export_lods` writes both with LOD0's provenance and the LOD0 file's SHA-256.

Checked in Blender, side and top views beside LOD0: the silhouette, legs, neck, tail and wing outline hold at both LODs. At LOD2 the wings' trailing edge shows the membrane's underside from above in places, where the decimation thinned the two faces of the thin sheet differently. That's acceptable far off, but it's the first thing to look at in G12b.

### The approved sheet and the Meshy body

Robert's Astra sheet (four views, the parts sheet and four variant sheets) and the Meshy body (raw and textured, Pro plan, Q49) arrived on 2026-10-19 in `havens-blender-pilot`. The images are in `refs\White Dragon\`, not `refs\white-dragon\` as the kit says. They are archived byte for byte on `archive/g12a-white-dragon`, whose README and MANIFEST hold the hashes. The Meshy model, version and task ID weren't recorded.

**Checked against the kit.** Item by item, the four views and the Meshy body pass all but one of the kit's seven checks:
- six limbs: four feet on the ground and two wings;
- the wing roots mid-back, behind the front shoulders and apart from the forelegs, with clear back between the neck's base and the roots;
- the membranes clear of every leg, the feet apart and the tail clear of the hind legs;
- no horns, whiskers, cheek fins, spines or tail fin, and the mouth closed;
- the head long and refined.

The one that fails is the views agreeing with each other: they don't on the wing's size. C draws its raised near wing large: the leading finger alone is about 9 m, which would spread the wings to about 25 m. The front view shows about 16.5 m. The Meshy body, built from all the views, spans 20.7 m as it stands. The skeleton takes its wing from the Meshy body (Q50b).

Two other departures:
- **Side view C ties the membrane's trailing edge to the top of the rump,** about 0.5 m behind the hip joint. It's clear of the leg, but it isn't "the flank just in front of the hind legs". The Meshy body has it 0.65 m ahead of the hip, as the design asks.
- **The Meshy body roots its wings further forward** than sheet C: 0.02 of the torso ahead of the center, where C has them 0.09 behind it. Its tail also curves to the creature's left over its back half; the sheet's runs straight back. The fit corrects both by fitting to the skeleton.

**Measured.** Three readers measured side view C independently and a fourth reconciled them. They agreed within about 3% on every length; the joints inside the flesh (shoulder, hip, skull joint) agreed within about 0.17 m. The sheet has no scale, so its size comes from render 08: each of render 08's five body readings gives a px/m figure (head 88, neck 73, torso 77, tail 92, depth 105). Their geometric mean, 86.3 px/m, sets the size. Render 08's lying leg readings aren't comparable with a standing sheet and are left out. At that scale the dragon measures 20.3 m from nose to tail tip along the skeleton's chain (the provisional rig from render 08: 20.6 m) and 17.9 m in a straight line. Its four lengths add up to 20.5 m (render 08's: 20.6 m).

| Reading (side view C) | Value | Before (render 08) |
|---|---|---|
| Head, skull joint to snout | 1.53 m, pitched 17.6° nose-down | 1.5 m, level |
| Neck along its curve | 2.23 m, straight up from the withers, bending forward under the skull | 2.7 m, rising 30° |
| Chest front to rump | 5.0 m | 5.6 m |
| Tail along its line | 11.8 m, sagging up to 0.5 m behind the haunch and curling up at the tip (4.9° base to tip) | 11 m, straight |
| Depth at the chest and at the center | 2.32 m and 2.21 m | about 1.9 m |
| Body center above the ground, standing | 3.42 m | 3.0 m (chosen, not measured) |
| Foreleg, elbow to toes / hind foot / hip to knee | 2.62 / 1.76 / 1.07 m | 2.0 / 1.4 m lying |
| Wing root | 1.25 m behind the withers, 0.93 m above the center | 1.5 m behind the withers |

The proportions differ from the kit's prompt. The tail is 2.1 times nose to hips (the kit asked for about 1.33), and the neck is 0.65 times shoulder to hips (0.75 asked). The approved sheet wins, so the skeleton follows it.

The wing comes from the Meshy body instead, both wings averaged at the fit's scale of 10.89 m per Meshy unit, with lengths in 3D and azimuths flattened:
- humerus 2.67 m, forearm 2.01 m, hand 0.24 m;
- fingers 5.6, 4.4 and 3.3 m, swept back 14°, 23° and 45°;
- the leading finger's joint 29% of the way out;
- 21.8 m spread flat.

The torso's half-width (0.9 m) also comes from the Meshy body, since a side view can't show it.

### The fit

Run on 2026-10-19 in Blender 5.2.2 through the Blender MCP. The master is `havens-blender-pilot/white-dragon-pilot.blend` on Robert's PC.

Landmarks: three readers placed 30 joints and tip points on orthographic renders of the raw body, and a fourth pass worked from the mesh geometry; a reconciliation merged them. They are in the script's `LANDMARKS`, with the neck and tail centre lines. The right wing isn't a mirror of the left (it sits 0.02 to 0.06 Meshy units forward), so its points are registered from the left's by local ICP (`register_mirror`) and recorded.

Steps:
1. **Split.** The wings come off at the root: everything beyond the flank's widest point, plus the thin membrane where it meets the flank. Thin patches go only where they connect to the outer wing, because the back plates have thin edges too.
2. **Close and decimate.** The body's cut is closed after the pinched vertices are cleared, and the patch is subdivided and relaxed. The body is decimated to 12,000 triangles and the wings to 6,000.
3. **Weight.** Bone heat on the body, inverse-distance weights to the wing bones on the wings, at most four bones per vertex.
4. **Conform.** Each Meshy segment is mapped onto the game bone's, with the length taken from the game. Girth is the Meshy body's own, eased toward each bone's stretch.
5. **Bake,** in the wyvern hide shader's conventions, by the part each vertex rides on:
   - The back-plate mask comes from the textured download's colours (powder-blue plates). Claws are slate on the feet and wings only, and eyes pale near the eye points.
   - On the body tube, the girth angle, belly and arc length come from the skeleton's body plan, projected between its stations.
   - On the legs, the distance down the leg; on the wing bones, the distance out the arm. The head takes none.
   - On the membrane, the wyvern's panel coordinate (0 on the leading finger to 2 on the innermost, the inner panel 2 to 3), with thinness away from the bones.
6. **Export.** The wing bones and the membrane don't share vertices, and every body triangle is one region.

Result: 10,301 vertices and 17,999 triangles, inside the bare budget of 16,000 to 20,000. Every vertex is weighted, by at most four bones. The soles, snout and tail tip land on the skeleton's own points within a few centimetres. The wing claws reach about 0.2 m past the skeleton's wingtips, which are the fingers' ends, so the fitted body spans 22.2 m tip to tip.

Known limits:
- Short stubs of the wing root stay on the body under the wing's own root.
- The flank under the membrane's root is filled smooth but flatter than the body around it.
- The fit is checked in the bind pose only.

**Later, not in G12:** the other four flights' elder dragons. Each is a palette and a parts set on the same body, made from its own render.

**Order and dependencies:**
- PR #11 merged into `art/astra-targets-2026-10-17` after that branch had already merged into main, so the Harrier trial (`trial.ts`, `harrier_meshy_fit.py`) isn't on main. The dragon doesn't need it: its fit script and its GLB parser are generalised copies in its own files. The Harrier trial still needs its own way onto main, as the fidelity plan's Phase 0 asks.
- G12c depends on Windhaven's Aegean kit: a platform big enough for a 20 m creature changes the haven's silhouette, which no current tower allows for (the rookery towers are 3.4 to 4.2 m in radius; `world/dressing/structures/roostPlan.ts:64-69`).

## What this doesn't change

The flight constants and the 120 Hz step, `driftwing.save.v1` and `driftwing.bond.v1`, `BreedId` and `BREED_ORDER`, the four breeds' goldens, captures and race times, control mappings, and the Three.js WebGL 2 renderer.

## Risks

- **Meshy limb errors.** Meshy may fuse a wing to a foreleg or grow extra limbs. The kit's checklist catches this before credits go to texturing.
- **The wing root.** It sits over a moving shoulder, and weighting it is the hard part of a six-limb body. The Harrier trial fitted a body only and kept the procedural wings.
- **Thin parts.** Horns and whiskers are thin and alias or vanish at distance. Only LOD0 is used at runtime today (`Wyvern.ts:291`); one instance can afford it, but the parts need a distance fade.
- **Scale.** A creature of 20 m or more on a tower competes with the haven's silhouette, and render 10 doesn't show one.
- **The elder.** The figure at its shoulder needs a mantle and an NPC stance, neither of which the rider system has. They wait (Q47e).

## Decisions

Answered 2026-10-19 ([Q47](DECISION_LOG.md#q47--open-the-white-dragon-gate-g12-and-on-what-terms--answered-2026-10-19), [Q48](DECISION_LOG.md#q48--dragon-customization-and-colour-within-a-flight--answered-2026-10-19)):
- G12 is open: R1, a Meshy body on a game-owned skeleton, the tower at Windhaven, the elder figure later.
- Parts fit every flight, the hue shift is ±8°, and the elders' dragons are authored characters.

Open:
- the dragon's name and whether it speaks ([Q47f](DECISION_LOG.md#q47f--the-white-elder-dragons-name-and-whether-it-speaks--open));
- the choices the sheet and the Meshy body forced: the dragon's size, the wing's source and the membrane's root ([Q50](DECISION_LOG.md#q50--the-white-dragons-size-wing-and-membrane-root--open)). Each is built as recommended until Robert answers.
