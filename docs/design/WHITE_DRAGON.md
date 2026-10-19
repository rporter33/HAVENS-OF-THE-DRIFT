# The white dragon

[Design index](README.md) · [Decision log](DECISION_LOG.md#q47--open-the-white-dragon-gate-g12-and-on-what-terms--open) · [Model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md)

Written 2026-10-19 against main `ae839d9`, from Robert's "Begin work on the white dragon". Design lane: a proposal that opens nothing. The decisions are Q47 and Q48. Statements about source are from reading it, cited by file and line (wyvern files under `src/creatures/wyvern/`, others under `src/`); nothing here was run.

## What the white dragon is

The white clan's elder dragon, as [render 08](../art/targets/08-sleek-dragon-elder.png) shows it: resting on a tower-top platform beside a white clan banner, an elder in a broad white mantle at its shoulder. Rare and old.

| | |
|---|---|
| **Exists in source** | Nothing. No four-legged creature, no dragon rig, no elder, no non-player creature of any kind, no tower-top platform. |
| **Usable in this build** | Nothing. |
| **Approved direction** | Four-legged dragons join the roster when their rig exists (Q1). The five clans and ten elders are game canon, introduced in the comic first (Q13). The Air Nomads, the player culture, carry the white flight (Q23). The game should closely match the renders, dragons included; white blends toward ivory and powder blue "as the elder dragon render (08) shows" (Q36). Creature bodies may come from Meshy if Claude can edit the Blender source to fit the game (Q20, Q38). Every flight's dragons are customized with parts, and dragons of one flight differ by a small hue change (Q48). The [render brief](../art/targets/RENDER_BRIEF.md): four legs plus two wings, sleeker and larger than the wyverns, swept branching horns and whiskers, ivory and powder blue, belongs to the clan elders. |
| **Future ideas, not authorized** | The dragon as a mount, a dragon that flies over the haven, the elder speaking, the five-rival course with one rival per flight (Q44). The other four flights' elder dragons are canon (Q13) but not scheduled. |

The [storyboard](../website/storyboard/chapter-01/README.md) puts one dragon elder and one wyvern elder per clan on a broad tower-top platform above each settlement. Since the Air Nomads are the white flight, this reads as the player culture's own elder dragon; where its tower stands is Q47d.

## Its form, from render 08

- **Body plan:** six limbs. Four walking legs, and two wings growing from the back above and behind the front shoulders. The front legs are legs; the wings are not arms.
- **Head:** long and refined, gentle brow, long tapering muzzle, mouth closed, pale blue eyes. Swept, branching, antler-like horns in bone ivory. Two long whiskers from the upper lip that hang to the ground. Swept-back ivory cheek fins.
- **Neck:** long and upright in a gentle S, about the length of the body. Broad ivory throat plates in front, powder-blue plates and ivory spines along the top.
- **Body:** deep chest, long trunk. Ivory below, powder-blue plates along the back and flanks. Matte, with broad plates rather than small scales, as the brief asks.
- **Wings:** bat-like, a hooked thumb claw at the wrist. Ivory membrane, powder-blue bones on the leading edge. Folded and half raised at rest.
- **Legs:** slender forelegs, strong hind legs, four toes each with short slate claws.
- **Tail:** very long, curled around the platform at rest, with a low ivory fin along the top.
- **Pose at rest:** lying like a sphinx. Forelegs stretched forward, hind legs folded under, tail curled, head high.
- **Scale:** read against the elder (about 1.75 m) without correcting for perspective, the resting back is about 3 m up, the head 5 to 6 m, and nose to tail is 20 to 25 m. For comparison, the Harrier has a 15.5 m wingspan and stands 2.6 m (`flight/breeds.ts:71,89`). Proposed: about 1.5 times the Harrier, set in G12a from the approved reference sheet.

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

No imported creature loader exists on main. The Harrier's Meshy trial (`creatures/wyvern/trial.ts`, `scripts/blender/harrier_meshy_fit.py`) is on PR #11, unmerged. It binds a Blender-fitted body, by bone name, to a skeleton the game itself defines.

## The route (recommended)

1. **Its own module,** `src/creatures/dragon/`. It's not a `BreedId`, so no wyvern table, test, golden or save path changes. Shared helpers are imported, not edited. If one has to change, the wyvern goldens prove the change is a no-op for the wyverns.
2. **The game owns the skeleton,** as it does for the wyverns: a six-limb rig definition in code, written to the approved reference sheet. It's built to the mount standard from the start, with full foreleg chains and a seat socket between the wing roots, so a mount later never needs a second rig.
3. **The body from Meshy, fitted in Blender** to that skeleton: the Harrier trial's route (Q38), with the fit script generalised from `harrier_meshy_fit.py`. The [model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) has Robert's Astra and Meshy steps. The fit bakes the region, belly and back attributes, so the existing hide shader paints the white flight.
4. **Customization through parts, colour from the flight** (Q48; [below](#customization-parts-and-flight-colour)). Horns, whiskers, cheek fins, spines and tail tip are interchangeable parts on one body. A dragon's colours come from its flight plus a small hue change. Whiskers hang as verlet strands like the tail, so they cost no bones.
5. **Rest first.** It lies in render 08's pose with idle life: breathing, blinking, the head following the player within a cone, whiskers swaying, the wings settling, the tail tip moving. It never walks or flies in G12.
6. **Dev-only until accepted.** It appears in a `?view=` showcase first, and in the normal build only after Robert accepts captures beside render 08.

**The alternative**, a procedural body grown from the wyvern builder, avoids a Meshy dependency but has to reach render 08's head, chest and wing roots in code. For the Harrier, the code pass closed the colour gap but not the form gap (Q38).

### Skeleton draft and the bone budget

| Chain | Wyvern today | White dragon draft |
|---|---|---|
| Trunk: root, spine, chest, breath, pelvis | 5 | 5 |
| Neck | 6 | 6, longer segments |
| Head: head, jaw, tongue ×2, cheek fans ×2 | 6 | 4 (no tongue; the mouth stays closed at rest) |
| Tail | 10 | 10 to 12 |
| Wings, ×2: humerus, forearm, hand, claw, three fingers × two segments | 20 | 20, rooted on the back |
| Hind legs, ×2: thigh, shin, metatarsus, toes | 8 | 8 |
| Forelegs, ×2: scapula, humerus, forearm, hand, toes | none | 10 |
| Wing-fold helpers ×2, gular | 3 | 3 |
| **Total** | **58** | **66 to 68** |

The wyvern budget is 64 bones, which keeps the bone texture at 16×16. It's tested, not enforced at runtime (`wyvern.anatomy.test.ts:107,448-449`). The draft is 2 to 4 over. Cuts that reach 64: the wing claw bones (claws ride the hand), the gular bone, and a 10-bone tail. Raising the budget for one creature is cheap at runtime but is a budget change. *Recommendation: hold 64 and decide in G12a with the fitted body in hand.*

## Customization: parts and flight colour

Robert, 2026-10-19 (Q48): every flight's dragons are customized with parts, and their colours vary within a flight by a small hue change.

**What the wyvern has.** The parts are slots in the cosmetic catalog: pattern, horns, frill, tail tip and saddle (`cosmetics/catalog.ts:33-70`), each with unlocks from feathers, medals and relics. PR #11 adds an interchangeable head slot (Q39). Antlers and cheek fans are already wyvern options (`catalog.ts:48,56`). A wyvern's colours are free hex picks: `WyvernLook` says "Colors are always free" (`core/types.ts:479-493`).

**The dragon's look (proposed).**
- **Data:** its flight (white, red, green, blue or black; black also picks its violet or ember tint), a hue shift, and one part per slot. It's authored data for the elders now, and the same data feeds a stable later (Q48c). It isn't a `WyvernLook`, so wyvern saves don't change.
- **Colours are derived, not picked.** Each flight has a palette (hide, plates, belly, membrane, wing bones, claws, eyes), and a dragon's palette is the flight's turned by its hue shift. The shift is proposed at ±8° (Q48b), with the whole palette turning together and lightness and saturation held, so every dragon of a flight reads as that flight. The shift is a stored number, never random at runtime.
- **Parts fit every flight** (Q48a, recommended). Every dragon shares one body and one skeleton, and each part attaches to named bones, so a part built once fits all five flights.

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

*Recommendation: R1 now. The skeleton is built to R3's standard, so neither R2 nor R3 needs a second rig.*

## Proposed gate G12: the white dragon at rest

Three steps, each its own PR with its own checks. None changes `src/flight`, `src/player`, the save, controls or any wyvern module's output.

| Step | Changes | Acceptance | Size |
|---|---|---|---|
| **G12a** Skeleton, body and parts (dev-only) | `src/creatures/dragon/`: the six-limb rig, proportions from the approved sheet, an export of the bind skeleton for Blender (as G3b exported the Harrier). `scripts/blender/dragon_meshy_fit.py` generalised from the Harrier fit. The dragon's look data, the five slots and the white elder's part in each. The white flight's palette and the hue shift. The fitted GLB under `src/assets/` with its provenance and register entry (route, model and version, task id or "not recorded", plan tier, date). | New anatomy tests: six limbs, symmetric chains, the bone budget, the triangle budget per LOD (exploratory: 16,000 to 20,000 bare, up to 24,000 with parts, from the [model budgets](../../Art%20and%20Assets/Guides/model-budgets/README.md)), bind proportions within tolerance of the sheet. Every part attaches to its bones and stays inside the accessory allowance. Derived colours stay within the bound and are the same on every run. A fit report: every vertex weighted, at most four influences. All wyvern suites and the pose golden unchanged. Typecheck, full vitest, smoke 15/15. | M |
| **G12b** Resting showcase (dev-only) | `?view=white-dragon`: the dragon in render 08's pose on a stand-in platform, the idle life layer, its own driver, a camera matched to render 08, a capture manifest. A lineup of white dragons across the hue shift and part swaps. | Captures beside render 08 scored on the brief's three questions: identity, fidelity, reachability. In the lineup, Robert judges that every dragon reads as the white flight and that each part reads at gameplay distance; the ±8° shift is tuned here. The idle is stable across frame rates, as the wyvern tail test checks. No console errors; smoke 15/15. Robert times Medium on his GPU. | S to M |
| **G12c** On its tower | A tower-top platform at the chosen haven (Q47d), built with that haven's kit. Colliders: a cylinder for the tower and a `colChain` along the resting body. The white banner. The idle reacts to the player nearby. In the normal build once Robert has accepted G12b. | Dressing and editor checks green, with protected routes clear (spawn, stable door, launch deck). Collision within half a meter of what is seen. Race lines, cloud clearance and the Windline sweep unchanged. Flight replays bit-identical. Captures from render 10's approach and from the plaza. Draw calls at Medium within budget. | M |

**Later, not in G12:** the other four flights' elder dragons. Each is a palette and a parts set on the same body, made from its own render.

**Order and dependencies:**
- G12a's skeleton can start from the approved reference sheet before the Meshy body arrives.
- The fit and G12b reuse PR #11's trial pattern, so #11 should land first, as the fidelity plan's Phase 0 also asks.
- G12c depends on Q47d and, at Windhaven, on the Aegean kit: a platform big enough for a 20 m creature changes the haven's silhouette, which no current tower allows for (the rookery towers are 3.4 to 4.2 m in radius; `world/dressing/structures/roostPlan.ts:64-69`).

## What this doesn't change

The flight constants and the 120 Hz step, `driftwing.save.v1` and `driftwing.bond.v1`, `BreedId` and `BREED_ORDER`, the four breeds' goldens, captures and race times, control mappings, and the Three.js WebGL 2 renderer.

## Risks

- **Meshy limb errors.** Meshy may fuse a wing to a foreleg or grow extra limbs. The kit's checklist catches this before credits go to texturing.
- **The wing root.** It sits over a moving shoulder, and weighting it is the hard part of a six-limb body. The Harrier trial fitted a body only and kept the procedural wings.
- **Thin parts.** Horns and whiskers are thin and alias or vanish at distance. Only LOD0 is used at runtime today (`Wyvern.ts:291`); one instance can afford it, but the parts need a distance fade.
- **Scale.** A creature of 20 m or more on a tower competes with the haven's silhouette, and render 10 doesn't show one.
- **The elder.** The figure at its shoulder needs a mantle and an NPC stance, neither of which the rider system has. Q47e proposes leaving them for later.

## Decisions for Robert

See [Q47](DECISION_LOG.md#q47--open-the-white-dragon-gate-g12-and-on-what-terms--open):
- (a) open G12a now;
- (b) the role;
- (c) the body route;
- (d) where the tower stands;
- (e) the elder figure;
- (f) its name and voice.

See [Q48](DECISION_LOG.md#q48--dragon-customization-and-colour-within-a-flight--answered-2026-10-19) for the customization follow-ups:
- (a) whether parts fit every flight;
- (b) the size of the hue shift;
- (c) who customizes.

The Astra reference sheet in the [model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) needs no gate and is the first input everything else waits on.
