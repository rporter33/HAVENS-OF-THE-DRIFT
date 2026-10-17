# C02 Travel Drape — approved P1 development proof

## Current: four-pass clothing QA

Reviewed main `f97bac5` advanced during QA and is integrated without changing the rider
runtime. **1,286 tests in 119 files**, typecheck/build and the clothing/game integration
checks pass. [Latest integrated captures and reports](evidence/qa/integration/index.html)
and [review notes](QA_REVIEW.md) supersede the earlier counts immediately below.

Material identity, smoothed cloth contacts, bell sleeves and rigid armor weighting received
four QA passes after `c6ae42d`. **119 files / 1,260 tests, two dedicated geometry audits,
typecheck/build, 15 smoke, 32 mixing/actual-flight and 33 production browser checks** pass.
[QA review and precise coverage/limits](QA_REVIEW.md), [28 fresh captures](evidence/qa/index.html).
The pairwise matrix covers 384 looks / 2,304 poses with no sampled free render-surface
penetration; attached seams and unsampled mesh/accessory intersections are not certified.
Older sections below preserve earlier checkpoints. [Current handoff](../AI_HANDOFF.md).

## Latest: localized clothing refinement

Current integrated review: **1,239 tests in 117 files; typecheck/build; 15 smoke, 32 outfit-mixing, 30 clothing and 12 local-menu checks passed**. Windline gameplay and editor workflows passed. [24 fresh integrated captures and reports](evidence/clothing/integration/index.html). Normal menu: http://127.0.0.1:5193/?quality=high&tod=.42 ; separate outfit test profile: http://127.0.0.1:5198/?quality=high&tod=.42 . Existing saves are preserved. Hosted snapshot is unchanged.

Robert requested a major pass on blocky clothing, disconnected mixes and rigid lower tops. Hanging tunic, coat, robe, tabard and chiton panels now use localized cloth with attached waist seams, body/mount/ground contacts and bounded movement. Cartographer sash ends and sewn bell sleeves move too. Leg wraps and cuffs fit the selected trousers and share joint weights. Rounded hems, straps, pouches and knee guards soften the silhouette. All seven complete outfits now share the reference-derived fabric/leather atlas and existing 1K/2K/3K/4K tiers.

[Matched comparisons and 24 final engine captures](evidence/clothing/index.html), [wind measurements](evidence/clothing/final/verification.json), [source scope](evidence/clothing/scope-verification.json) and [review/limits](CLOTHING_REVIEW.md). Pre-integration: **114 files / 1,201 tests, typecheck/build, 15 smoke, 32 outfit-mixing and 30 clothing browser checks passed**. Current branch integration/review status is at the top of [AI_HANDOFF](../AI_HANDOFF.md). Older sections describe preserved historical checkpoints.

## Earlier checkpoint: refined body for every outfit

Robert approved using the refined body for **every outfit**, after the normal game restored his saved Flight Leathers base while the gallery showed Travel Drape. All seven complete presets and mixed garments now use the connected torso/shoulders, rounded limbs and refined face/hair. Original garment styles, dyes, unlocks and saved choices remain; the six original presets keep Slight/Medium/Broad, while complete Travel Drape retains Medium/Aerie. No costume flags are needed. [Every outfit, the real Stable and both mounted sides](evidence/shared-body/index.html), [scope hashes](evidence/shared-body/scope-verification.json) and [review/limits](SHARED_BODY_REVIEW.md) record this rollout.

**1,187 tests, typecheck/build, 15 production smoke, 32 mixed wardrobe and 33 shared-body browser checks passed.** The latter records 20 actual-engine captures and actual takeoff/landing/dismount separately. Normal game: http://127.0.0.1:5193/?quality=high . Separate light-linen test profile with all outfits unlocked: http://127.0.0.1:5198/?quality=high&tod=.42 . Unlocks on the normal game origin are unchanged. Both links start at the normal menu. Local/uncommitted; hosted snapshot and main are unchanged.

## Earlier checkpoint: light linen top, shoulders and ankles

Robert confirmed Light linen / Travel Drape for the requested refinement. Three passes added crossed linen overlaps and turned edges, rounded the shoulder bridges, corrected bare-skin UVs and blended the ankle/sandal transitions. See [matched before/after close-ups and both mounted sides](evidence/layering/index.html), [the art review](LAYERING_REVIEW.md) and [source scope](evidence/layering/scope-verification.json). **1,178 unit tests, typecheck/build and 67 final browser checks passed** (15 smoke, 32 mixed wardrobe, 11 art and nine launcher). The full Aerie costume now uses 17,590 triangles within an explicit provisional 18k guard, retaining the existing rig and body draw. Software WebGL captures do not measure GPU performance. Local launcher: http://127.0.0.1:5193/test/ ; gallery: `/test/layering/`. Historical releases and evidence remain preserved.

## Earlier checkpoint: player customization

Pieces from all seven existing outfits can now be mixed in eight garment slots, with parent outfit unlocks, gear dyes, complete presets, preview/Revert and save/reload. Open Stable → Outfit Pieces from any preset. See [the wardrobe guide](../WARDROBE_CUSTOMIZATION.md) and [current actual-engine evidence](evidence/mixed-wardrobe/index.html), including both mounted sides. Full 1,177 tests, typecheck/build, 15 production smoke, 32 mixed wardrobe and nine launcher checks passed. Prior Travel-only and debug-only scope statements below are historical; Robert explicitly broadened itemization to every existing outfit.

## Latest: dedicated-GPU quality increment and local launcher — October 10, 2026 (Mountain time)

Robert's playtest revised the target: Low remains for integrated graphics, while Medium/High/Ultra
prioritize dedicated cards. [Graphics budgets](../systems/GRAPHICS_QUALITY.md) records sharper shadows,
denser grass, smoother drawn cloth and increased texture anisotropy, retaining 2K/3K/4K rider maps.
Low's profile, costume/body, rig, simulation, flight, mounted fit, saves and dragon runtime are unchanged.

The experimental 4K button was a rotating model viewer, which intentionally bypassed the menu.
The updated local launcher separates five normal game-menu links from three labeled model viewers,
including dedicated Ultra and High+4K gameplay choices. Open http://127.0.0.1:5193/test/ locally.

Full 1,161 tests, typecheck/build, 15 production smoke checks, 17 cloth/material checks and 10
launcher/menu/viewer checks passed. Short actual-RX-9070-XT/2560×1440 samples rendered all tiers
without runtime errors or automatic resolution reduction. This does not certify lower GPUs,
sustained flight or peak memory. [Evidence](evidence/quality-budget/index.html) preserves scope,
measurements and captures. This increment remains local/uncommitted; the hosted snapshot and
main deployment are unchanged. Next: owner playtest and broader hardware measurements.

## Latest: stable cloth and 1K–4K material exploration — October 10, 2026 (Mountain time)

- Robert authorized stable cloth/environment/wind response and higher textures, then requested exploring 3–4K at High, 2K Medium and documenting the same for dragons. Same isolated branch `codex/rider-c02-proof`; latest commit/base `f9fc707d55cea36f62307d8a58ba9c00361be253`. Local, uncommitted, unpushed and unmerged.
- C02 opts into contact friction and non-bouncy positional repair, including deterministic escape from a capsule axis. Drape/sash gain damping and gentle low-speed flutter. Loose cloth uses relative wind, inertia, existing body/mount capsules and shared walkable ground/deck queries. Quality changes retain the simulation instead of resetting it. Fitted chiton/trousers and the compact Aerie drape remain rig-driven/secured. No arbitrary-wall/foliage, self-collision or wet-cloth claim.
- M01 reference-derived maps now generate directly at 1K Low, 2K Medium, 3K High and 4K existing Ultra. High can compare 4K with `riderTexture=4096`; Low/Medium budgets stay fixed. Device texture limits cap selection. Body/drape/sash share maps and unchanged UVs/dye recipes; optional normals generate lazily. Skin/cloth boundaries suppress interpolated atlas bleed. No new saves, dependencies, renderer or production default changes.
- Both 3K and 4K rendered successfully at High, with identical close cameras; their visible difference is small here. 3K saves about 44% per-map storage (48 vs 85.33 MiB including mipmaps); optional normal maps double it. Visited sizes remain cached. [Rider/dragon texture policy](../TEXTURE_QUALITY.md) records CPU/GPU costs, actual usable tile widths, defaults, overrides and hardware limitations. Dragons currently use shader-generated hide/membrane patterns, with no bitmap skin maps to upscale; matching future bitmap budgets are documented only. Dragon runtime source is unchanged.
- Final source verification: **110 files / 1,161 unit tests passed**, TypeScript/build passed, production smoke **15/15 passed**. New cloth/resolution browser proof **17 checks / 13 captures**; refreshed full proof **49 / 40** and mounted fit **51 / 16**, zero page/console/game errors. Actual player weather, takeoff/landing/dismount, Windline attach/release, saves, Stable preview/Revert/Apply/reload, dyes and shape rebuilds passed. Unit coverage includes capsule-axis contact, sloped-ground/open-air release, gust/hitch bounds, quality continuity, map sharing/resolution and hardware limits.
- Controlled stress: 900 frames with 90 m/s wind reversals, inertia and 4–250 ms input frame intervals; bounded finite particles and drawn geometry. Ten seconds of calm reduced the maximum sampled particle speed to 1.06 cm/s. Real rainy-weather sample matched the player's relative-air input exactly. These are sampled checks, not hardware performance or exhaustive clothing/prop clearance certification.
- [Latest cloth/HD gallery](evidence/cloth-hd/index.html), [all current production captures](evidence/cloth-hd/final/index.html), [all mounted sides](evidence/cloth-hd/mounted/index.html), [scope hashes](evidence/cloth-hd/scope-verification.json). Against the independently verified five-pass checkpoint, **11 existing source/test files changed; 379 unchanged**. Rider body/costume geometry, rig, animator/IK, saddle, flight/movement, traversal, saves/catalog and shared world remain byte-identical. Geometry stays Wanderer 15,694 / Aerie 15,982 triangles with 27 bones; no extra body/cloth draws.
- Known limits: procedural art remains simpler than the paintings; atlas texel density/unwrap remains proof-level. SwiftShader is not integrated-GPU timing or peak-memory certification. Ground contact is unit-verified against a sloped surface, not an exhaustive terrain/prop runtime proof. Next authorized action: owner visual/playtest review, including target-device Low/Medium/High measurement. No production catalog rollout, wider cast, commit/push/merge or deployment is implied. A fresh independently verified source/evidence backup is recorded in the external review's `P1_BACKUP_VERIFICATION.json`.


Owner: Codex in the rider review chat. Hardware target: desktop/laptop, including integrated graphics.
Baseline: reviewed GitHub main `f9fc707d55cea36f62307d8a58ba9c00361be253`.
Branch: `codex/rider-c02-proof`. This is an opt-in development study, not a production wardrobe rollout.

**Review ready, local and uncommitted.** Open the [five-pass character fidelity review](evidence/fidelity/index.html), including [final mounted captures from both sides](evidence/fidelity/mounted/index.html). The [rounded body checkpoint](evidence/rounded/index.html) remains available. The [earlier mounted-fit gallery](evidence/mounted-fit/index.html) and [initial P1 gallery](evidence/index.html) preserve historical checkpoints. The paintings in `approved/` remain concept targets. No new P1 commit, push or merge has been made.

## Latest: five authorized character fidelity passes — October 10, 2026 (Mountain time)

- Robert requested multiple passes to match the approved artwork as closely as possible, using the texture/material examples. Same isolated branch `codex/rider-c02-proof`, latest commit/base main `f9fc707d55cea36f62307d8a58ba9c00361be253`. All P1 work remains local, uncommitted, unpushed and unmerged.
- Five capture-and-review passes refined arm/shoulder profiles, integrated facial forms, swept ponytail hair masses, rolled diagonal drape, rounded slate scallops, folded overlapping chiton, gathered trousers and crossed calf wraps. The existing connected chest/neck/arms and rounded hands/feet are preserved. The short Aerie conversion retains the approved costume identity.
- The supplied M01 plate is a material study rather than a UV-ready texture pack. Reference-derived, dye-neutral 1K tiles now reproduce woven linen, matte slate grain, worn leather and softened bronze. Body cloth and moving drape/sash use the same atlas as the overlays; a proof-only material class gives bronze a restrained broad sheen. Existing toon ramp, WebGL renderer, normal comparison toggle and in-place dye recipes remain. No dependencies or production default changes.
- Iteration evidence records problems as well as corrections: longer Aerie hems reduced Skimmer bank clearance, so compact flight hems were restored; drape inflation corrected a scale intersection; an overlong central wave was shortened to clear the face. No test thresholds, rig, solver settings or flight tuning were changed to pass checks. Hair detail was redistributed to retain the original 16k proof cap.
- Final source: **110 files / 1,156 unit tests passed**, TypeScript and production build passed, production smoke **15/15 passed**. Final production proof **49 checks / 40 captures**, mounted fit **51 checks / 16 captures**, with zero page/console/game errors. Stable preview/Revert/Apply/reload, repeated dyes, cosmetic fallback/rebuilds, Windline cast/attach/release and actual player takeoff/landing/dismount passed. A new regression covers shared maps on moving drape/sash and maps-off/color/normal consistency.
- Wanderer **15,694** triangles; Aerie **15,982**; legacy **12,170**. Existing **27 bones**, one body draw, Wanderer three cloth draws/Aerie one. No additional texture size or draw calls. Optional normals add the existing second 1K map; no roughness/metalness renderer workflow.
- SHA-256 comparison to verified rounded checkpoint `p1-checkpoint-20261011T023309Z` found **12 rider source/test files changed and 378 source files unchanged**. Saddle correction, rig, animator/IK, cloth solver, movement, deterministic flight, traversal, saves/catalog and shared world source remain byte-identical. The drape/sash rest/spec function is unchanged after removing the two new render-only texture flags; head-surface sculpt changes the existing hair attachment surface slightly, not its rig or solver convention. Exact scope/hashes accompany the gallery.
- [Five-pass gallery](evidence/fidelity/index.html), [all final production captures](evidence/fidelity/final/index.html), [both mounted sides](evidence/fidelity/mounted/index.html), [pass log](evidence/fidelity/pass-log.json) and [scope verification](evidence/fidelity/scope-verification.json). Historical galleries are retained. Final evidence includes Low/Medium/High, day/night and maps off/color/normal. Five development passes add 40 matched-camera captures.
- Known art limits: the procedural face/hands, natural hair strand grouping and diagonal back layering remain simpler than the paintings; texture density/seams remain proof-level. Software SwiftShader establishes appearance/integration evidence, not integrated-GPU performance. This is a refined P1 review result, not an assertion of perfect concept fidelity or production art signoff.
- Next authorized action: owner review/playtest of this refined P1; hardware measurement remains outstanding. No production catalog rollout, new save fields, wider cast/wardrobe, renderer migration, commit/push/merge or deployment is implied. A verified local source/evidence archive is recorded by the review folder's `P1_BACKUP_VERIFICATION.json`.

## Earlier checkpoint: authorized rounded body refinement — October 10, 2026 (Mountain time)

- Robert requested closer fidelity to the approved rendering, softer hard corners and better body joins. Same isolated branch `codex/rider-c02-proof`, HEAD/base main `f9fc707d55cea36f62307d8a58ba9c00361be253`; local, uncommitted, unpushed and unmerged.
- Proof-only `softBody.ts` builds chest, neck and arms as one connected surface with shared shoulder vertices, replacing the proof's overlapping shoulder balls/arm caps and separate neck tube. Palm/fingers share a continuous rounded loft; heel/toe and jaw are rounder. The diagonal neckline curves more naturally, split hems turn up at corners and trousers taper into the cuff. Costume design, existing ponytail, 27-bone rig, contacts and fast recoloring remain intact. Legacy body builders remain the default.
- Hash comparison against the verified mounted-fit checkpoint found only `body.ts`, `garments.ts`, `proof.ts` and `proof.test.ts` changed among existing src files, plus new `softBody.ts`. Saddle correction, rig, animator, IK, cloth solver/specs, movement, deterministic flight, Windline, save/catalog and shared world files are unchanged. Exact hashes accompany the gallery.
- Final checks: **110 files / 1,155 unit tests passed** (including a connected-surface/open-boundary regression), typecheck/build passed and production smoke **15/15 passed**. Production main proof **49 checks / 40 captures**, mounted fit **51 checks / 16 captures**, no page/console/game errors. Mounted unit regression covers 4 breeds × 4 saddles × 6 poses and actual sandal/iron contact triangles. No fit thresholds or physics were loosened.
- Geometry remains under the unchanged 16,000-triangle proof cap: Wanderer **15,610**, Aerie **15,982**; legacy remains **12,170**. No new materials, bones, textures or draw calls. The connected upper surface opens into the head/pelvis and at wrists; this is not a globally watertight sculpt. P1 remains simpler than the concept art. Software WebGL is not integrated-GPU performance certification or final art approval.
- [Latest gallery and before/after](evidence/rounded/index.html), [updated mounted views from both sides](evidence/rounded/mounted/index.html) and [source scope/checks](evidence/rounded/scope-verification.json). Older galleries are preserved as historical checkpoints. Reproduce after building with `RIDER_PROOF_PORT=5189`, `RIDER_PROOF_OUTPUT=shots/rider-rounded`, `node scripts/rider-proof-check.mjs --sculpt`; then `node scripts/rider-mounted-fit-check.mjs`.
- Next authorized action: owner review of the refined P1 result. No production default/catalog rollout, wider cast, new save fields, renderer migration or publication is implied. A new verified local source/evidence archive accompanies this checkpoint; the external review's `P1_BACKUP_VERIFICATION.json` records its exact path and SHA-256.

## Earlier checkpoint: mounted-fit correction — October 10, 2026 (Mountain time)

Robert marked the missing-looking knee in the initial capture and explicitly authorized fixing mounted leg clipping and stirrup alignment while keeping the approved costume and flight behavior. The actual leg was continuous. The saddle's outward side flap occluded/intersected the knee and upper calf; its fore/aft-oriented iron also crossed the instep despite the existing ankle socket contact.

`src/creatures/wyvern/parts/saddle.ts` now turns the flap slightly inward beneath the leg and builds each iron across the foot with a flat tread. The stirrup centre, rod radius, seat, shared sockets and rig dimensions are unchanged. This is a shared saddle presentation correction for existing saddles, not a new wardrobe variant. A SHA-256 comparison to the verified initial P1 checkpoint found **only this existing runtime source file changed**: costume construction, rig, animator, cloth, movement, flight, traversal, saves and shared world geometry were byte-identical. New render-only vertex ranges support tests against the actual flap/iron triangles.

Final corrected source: **110 files / 1,154 unit tests passed**, including 16 new regression cases across all four breeds and four saddles. Each checks both knee/calf surfaces against deformed flap triangles and actual sandal/iron support through ground, glide, both banks, dive and brake. Existing comprehensive mounted contact/wing-clearance and deterministic flight tests also passed. Typecheck and production build passed; fresh production smoke **15/15 passed**. The new production-browser check passed **51 checks with 16 captures and no page/console/game errors**. Both sides are shown for every posed state, plus oblique tread details and actual landed player simulation with an inspection camera. In those captures the smallest measured knee/calf-to-flap lateral gap was 74.6 mm; sole points remained 18 mm above the tread centre, matching the existing rod radius. This adds specific fit evidence, not exhaustive wardrobe/accessory or physical-hardware certification.

- [Left side](evidence/mounted-fit/ground-left.png) and [right side](evidence/mounted-fit/ground-right.png).
- [Left tread](evidence/mounted-fit/tread-left-oblique.png) and [right tread](evidence/mounted-fit/tread-right-oblique.png).
- Reproduce after building: `node scripts/rider-mounted-fit-check.mjs` (isolated Edge storage, local production preview on port 5188).

## Authority and alignment

Robert approved **C02 Travel Drape + M01 + P1**, replying “absolutely - its a good combination - i approve” to that specific request. He then requested five-minute alignment checks and a start after consolidation. PR [#3](https://github.com/rporter33/Driftwing/pull/3) merged at `2026-10-11T00:54:30Z`; its final head `41c90a19ae202cdb320542ab071073d2d1d4aae9` passed [Verify integration](https://github.com/rporter33/Driftwing/actions/runs/38099399482). GitHub main and fetched origin/main agreed on the baseline above. Required Windhaven, traversal, art pack and guidance ancestors were present. Historical checkouts and documented recovery exclusions were preserved. The readiness automation was paused after the clean isolated Codex worktree started, to prevent duplicate implementation.

The approved brief, four final concept plates and exact approval record accompany this document in `approved/`. They describe the planning snapshot and concepts, not verified runtime behavior. Current source and this report supersede their historical baseline/status sections. Also read [shared art direction](../ART_DIRECTION.md), [art reference index](../art/README.md) and [consolidation handoff](../CLOUD_HANDOFF_2026-10-11.md).

The current opt-in Windline experiment is a **bracer-fired tether with manual pull**, explicitly approved after the older thrown-lance concepts. P1 preserves that actual contract. No new thrown lance or banner is claimed.

## Review and run

From this branch with the project's existing dependencies:

```text
npm run dev -- --host 127.0.0.1
```

Append these queries to the local Vite URL:

| View | Query |
|---|---|
| Wanderer | `?view=rider&manual=1&riderProof=wanderer&angle=18&dist=2.7&height=.92` |
| Face | `?view=rider&manual=1&riderProof=wanderer&focus=head&dist=.68&height=1.64&camUp=-.15` |
| Aerie on actual dragon | `?view=rider&manual=1&riderProof=aerie&real=1&angle=135&dist=2.7&height=.45&speed=40` |
| Materials A/B | Add `riderMaps=off`, `riderMaps=color` (default), or `riderMaps=normal` to the same view |
| Actual traversal | `?view=skyLance&play=1&riderProof=aerie&quality=low` |
| Ordinary game | Omit `riderProof`; the existing rider remains the default |

`view=rider` supplies the approved pale palette without saving it. Gameplay uses the player's existing dyes. Only the existing **medium / flight** combination selects the proof. Slight/broad and other outfits retain existing models. Existing hair/headgear/scarf/cape controls remain available; P1's representative look is ponytail without those extra garments. No new catalog or unlock IDs exist.

```text
npm test -- --maxWorkers=2
npm run typecheck
npm run build
node scripts/rider-proof-check.mjs
npm run smoke -- --no-build
```

The proof script starts/closes its own preview server on `127.0.0.1:5187`, uses fresh browser storage and writes `shots/rider-c02/`. `--dev` uses Vite source; `--quick` captures four views. On Windows it uses installed Edge. The existing smoke script accepts `CHROMIUM_PATH` pointing to the installed Edge executable. No normal browser profile or user save is used.

To reproduce the latest extended shape proof in PowerShell after building:

```powershell
$env:RIDER_PROOF_PORT = '5189'
$env:RIDER_PROOF_OUTPUT = 'shots/rider-rounded'
node scripts/rider-proof-check.mjs --sculpt
node scripts/rider-mounted-fit-check.mjs
```

## Implementation and budgets

- `src/creatures/rider/proof.ts`: Wanderer with softer jaw, horizontal eyes/lids, grouped existing ponytail; thick diagonal linen fold and shoulder turn, four broad slate rows, one bronze spiral pin, blue sash, split chiton, calf wraps and open sandals. Aerie shortens panels, secures the rear fold/sash and adds palm wraps.
- Wanderer's back drape and sash use the existing cloth solver, anchors, capsule collision and quality detail. Aerie secures these in skinned geometry; ponytail remains dynamic. Selecting a legacy cape suppresses the travel back drape to avoid two overlapping sheets.
- `proofMaterials.ts`: shared procedural 1024² neutral color atlas plus optional tangent normal atlas. Linen, scale, leather and bronze have quiet surface variation; skin/hair/unwrapped legacy parts sample neutral white/flat normal. No external runtime downloads.
- `meshKit.ts`: opt-in component UV tiles and duplicated loft seams with shared seam normals. Ordinary builders retain original topology with no UV attribute. `model.ts` keeps the existing toon ramp, fog, rim, rig light and recolor recipes. The proof alone uses the existing creature-light highlight-shoulder settings to prevent pale body clothing from washing out under Medium/High bloom; world/default-rider lighting is unchanged.
- `Rider.ts`, debug parameters/showcase and Game constructor route the explicit preview. Shape changes use the current rebuild path; dyes retint geometry/cloth in place. Rig dimensions, animation, movement, flight, terrain, collision, equipment sockets, catalog, unlocks and save schema are unchanged.

| Resource | Representative proof |
|---|---|
| Skinned mesh | Wanderer **15,694** triangles; Aerie **15,982**; legacy default **12,170** |
| Rig | Existing **27 bones** |
| Main-pass draws | One body; Wanderer three cloth meshes including ponytail; Aerie one ponytail cloth mesh. Shadow/post and Windline equipment draws are additional. |
| Texture storage | One shared RGBA8 1K color map, about **5.33 MiB** with full GPU mip chain; normal mode adds another **5.33 MiB**. Both CPU source arrays total 8 MiB. Dyes make no texture copies. |
| Defaults | Color-map proof at every tier; normal is an explicit comparison toggle. Ordinary game allocates neither proof atlas. |

The atlas uses four 480px interiors with 16px borders. Sheets have component UVs; textured lofts split circumferential seams. Small ornaments/end caps reuse samples. This is a **material feasibility proof**, not final production unwrapping: density is not normalized to world-space meters and some seam/cap sampling remains simplified. Base-body cloth and dynamic drape/sash now share the linen atlas; skin/hair remain neutral. There is no general mesh LOD, compressed texture delivery, roughness or metalness workflow. Normal detail is deliberately restrained and never changes silhouette. A/B renders do not establish a worthwhile performance/quality tradeoff on integrated graphics. No 2K/4K textures, dependencies or renderer migration were added.

## Initial P1 verification (before the mounted-fit correction)

Final production browser proof: **43 checks passed, 34 engine captures, no page/console/game errors**. Evidence includes Low, Medium and High views; day/night; materials off/color/normal; representative actions and actual-dragon poses; ordinary-game Stable preview/Revert/Apply/reload; 12 in-place recolors; 24 cosmetic shape combinations; actual Windline cast/attachment/release; and simulated takeoff, landing and dismount. Posed showcase images are labelled separately from simulation flows in the [gallery](evidence/index.html). The [manifest](evidence/manifest.json) records each query, check and observed mesh/resource data. Edge/SwiftShader evidence does not establish integrated-GPU performance.

Complete regression on the final shader source: **109 files / 1,138 tests passed**; TypeScript and production build passed. Nine new tests cover finite geometry/UV padding/weights/budget, default/fallback selection, in-place retint equivalence, cloth anchors, preserved hand/foot/equipment frames across actions and Low/High, and atlas/color spaces. Production smoke **15/15 passed**, including ordinary production boot, keyboard flight, pause/resume and quality switching; that smoke run preceded the last proof-only visual/shader corrections, which the final complete suite and production browser proof cover.

Harness corrections: match footer labels including input glyphs; test Stable in the ordinary game view because the existing practice overlay obscures controls at 720p; compare saved hex colors after the existing lowercase normalization; wait for the existing landing blend before dismounting. No UI/save/timing implementation was changed to satisfy checks. Near renders prompted shoulder-fold fitting and clearer scale rows. Medium/High review prompted the proof-only highlight shoulder; an initial shader-chunk preprocessor newline error was caught by the browser check and corrected. Final captures use the rebuilt source. Final Medium/High visual inspection confirmed the pale body cloth retained readable shading.

## Art and clearance assessment

No whole-game compliance claim is made. References below are relative to `docs/art/Driftwing_Codex_Handoff/` unless stated otherwise.

| Category / exact reference | Implementation and camera evidence | Match, gap and status |
|---|---|---|
| Costume: approved C02 plate 01; `01_Sky_Lance/References/01_Wanderer.jpg`; master v2 | `proof.ts`; [front](evidence/fidelity/pass-5/front.png), [side](evidence/fidelity/final/wanderer-side.png), [back](evidence/fidelity/pass-5/back.png) and traversal gameplay | Pale chiton, asymmetric fold, sash, wraps/sandals present. Procedural forms remain simpler and more youthful than the painting. **Partial**, final visual review pending. |
| Palette/materials: `01_Sky_Lance/References/06_Faction_Palette.png`; approved M01 plate 03 | `proofMaterials.ts`, `model.ts`; [gallery material comparisons](evidence/fidelity/index.html#materials), [Medium](evidence/fidelity/final/wanderer-medium.png), [High](evidence/fidelity/final/aerie-high-normal.png) | Restrained linen/slate/leather/bronze and independent dyes. Shared linen maps now cover body cloth and moving drape/sash; normalized density and seam finishing remain unfinished. **Partial**. |
| Armor: `02_Wardrobe/Armor_Cards/AN-AR-01_Windscale_cuirass.jpg`; master broad-row correction | `proof.ts`; [close front](evidence/fidelity/pass-5/costume.png) | Four broad rows, one small spiral, no dense ornament. Row readability needs human art review. **Partial**. |
| Lance/banner: master v2, superseded functionality reconciled by consolidation handoff | Existing traversal/visuals unchanged | No new lance/banner fitted. **Not applicable to new P1 assets**; no production banner validation claimed. |
| Bracer/tether/harness: later Windline approval; historical `docs/concepts/WINDLINE_BRACER_SWINGING.md` | Existing `equipmentFrame`; actual cast/attach/release view | Sockets match the legacy rig exactly in action tests. No new X-back harness asset. **Partial** pending engine clearance review. |
| Architecture: master Mediterranean correction | World files unchanged; visible existing background | **Not applicable to P1 changes**; no compliance claim for existing buildings. |
| Dragons: master companion direction | Wyvern anatomy and flight unchanged; saddle flap/iron presentation corrected in `parts/saddle.ts` | **Not applicable to dragon redesign**. Used only for rider-fit evidence. |
| Animation/camera: approved mounted plate 04 and master | Existing rig/animator; [final both-side fit gallery](evidence/fidelity/mounted/index.html), plus final action/gameplay evidence | Corrected knee/calf and tread fit verified in the specific pose matrix. Full wardrobe/accessory clearance remains **partial**. |

## Review boundary

After this P1 checkpoint: owner visual/playtest review and actual target-hardware measurement. Production catalog/default rollout, wider bodies/wardrobe/cast, new save fields and renderer changes require separate scope. Main and the consolidation agent's worktrees are not implementation targets for this proof.

A full source/evidence checkpoint is preserved locally beside the original review package under `rider-review/p1-checkpoint-<UTC>.zip`; `P1_BACKUP_VERIFICATION.json` there identifies its exact filename, SHA-256 and verified entry count. That archive is a recoverable source snapshot, not a Git commit or a remote upload.
