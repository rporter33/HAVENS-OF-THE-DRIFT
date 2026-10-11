# Driftwing — AI Development Handoff

## Four-pass rider QA follow-up — October 11, 2026

- Objective: Robert requested at least three to four QA passes, fixes for findings, clean clothing clearance and distinct cloth/leather/metal behavior before the existing backup/commit/PR review. Four passes are complete; the preceding sections remain historical checkpoints.
- Isolated branch: `codex/rider-c02-proof`. Material/contact/armor implementation `7a26b9782539ca5593672eaa00517eb3f0beb16d`; final shoulder-lining correction and compiled runtime `bd38cc6b341d0c80afc92e373e204752dbee1796`. A documentation/evidence commit follows. Reviewed main `a7adb45` remains included. Main and other agents' worktrees were not edited.
- Fixed source garment material identities and independent dye palettes, atlas boundary interpolation, restrained leather/metal light response, overlapping particle contacts and smoothed free cloth faces. Heavy Courier cloth now has its own bounded response. Cuirass sheets, pauldron lames, articulated faulds and knee shells follow intended bones. Cartographer bells have secured inner vents over thin fitted lining instead of duplicate fitted/loose volume. Final wave close-ups caught a culled inner shoulder fold; two-sided lining fixes the visible hole while retaining exterior-only shadow rendering.
- Verification: **119 test files / 1,260 tests; two dedicated geometry/CPU audits; typecheck/build; 15/15 normal-menu smoke; 32/32 real Stable/mixing/save/actual-flight; 33/33 production browser checks with 28 captures; 12/12 local menu/profile/launcher checks passed**. Actual mixed-outfit takeoff, landing and dismount are separate from the posed mounted views. Both sides now include boots/stirrups. The CI workflow includes `npm run test:rider-qa`.
- The clearance matrix covers **384 pairwise looks / 2,304 poses**, all eight garment slots and three requested builds (Low for Slight, Medium otherwise; complete Travel Drape retains Medium/Aerie). Sampled free rendered vertices/face edges/centroids have zero capsule-proxy penetration. Worst free solver particle depth is 0.256 mm, below the 1 mm guard. Attached roots and secured inner sleeve vents are intentionally excluded. These measurements do not certify every continuous mesh/accessory/pose intersection.
- Existing gust/hitch/calm tests plus new deck/ground/teleport, sleeve, quality-state/dye and rigid-cuirass checks pass. Bounding-box rejection, cached rest spans and early exits reduce repeated contact cost. CPU-only incremental medians range from roughly 0.08–0.33 ms Low to 2.82–7.87 ms Ultra in the sampled run. The Ultra robe remains expensive; Node/Edge SwiftShader is not sustained hardware/GPU performance evidence.
- [Four-pass review, art direction and limits](rider-c02/QA_REVIEW.md), [production captures/reports/source hashes](rider-c02/evidence/qa/index.html). Seven outfits, all mixed options, complete presets, IDs/unlocks, saves, efficient recoloring and preview/Revert remain. Atlases stay 1K/2K/3K/4K. Flight/traversal/world geometry and rider rig/animator/IK match reviewed main. Progression/save, cosmetics, graphics profiles and dragon source match `c6ae42d`. Forearm contact proxies affect garment presentation only.
- Final runtime source SHA-256: `8443a9891c4f1f96d7348b432af85771a60b4053ba1370f4c1d43d5d57335cf7`. Per-file hashes and compiled asset hashes are preserved in the evidence/release records.
- Verified local compiled release: external review `local-rider-qa-final-test/dist`; normal saved-rider menu http://127.0.0.1:5193/?quality=high&tod=.42 ; separate all-outfit test profile http://127.0.0.1:5198/?quality=high&tod=.42 ; gallery http://127.0.0.1:5193/test/qa/ . Initializer still seeds only a missing 5198 test save and preserves existing/legacy saves. The launcher selects this release only after its READY verification. Historical releases and hosted game remain preserved.
- Backup: external `QA_BACKUP_VERIFICATION.json` records the reopened source/evidence ZIP with every archived file hash checked, preserved raw QA iterations, and verified full-history review-branch Git bundle. `QA_REVIEW_STATUS.json` records the final documentation commit, remote head, live PR checks and local server health. Earlier backup records/archives remain intact.
- Known limits: bounded presentation cloth with body/mount capsule and walkable-ground/deck contacts; no arbitrary wall/foliage, cloth self-collision or contact for every stacked layer. Leather is rig-supported, and metal plates articulate without wind-sheet flutter. No new rigid-body material simulation or renderer migration. Sampled results do not promise zero clipping in every possible mix. Higher tiers need sustained hardware playtesting.
- Next authorized action: owner local playtest and code review of [draft PR #11](https://github.com/rporter33/Driftwing/pull/11). This QA updates the existing review branch/PR; no merge into main or hosted production deployment is included. GitHub CI state must be read live for the final PR head.

## Integrated rider clothing review — October 11, 2026

- Objective: Robert requested a major clothing pass before backup, commit and PR review. The pass is complete: localized hanging hems/sleeves, softer leg clothing/details, shared mixed-garment fit and reference-derived materials for all seven presets. Existing outfit identities, unlocks, dyes, preview/Revert and saves remain. Earlier sections are historical checkpoints.
- Active isolated branch: `codex/rider-c02-proof`. Implementation checkpoint `fa356ec77d7db7022c3ab82e20dfcd82a86b19ec`; latest integration commit `f287267a3e29f5c0eaa2cdfa755ece94fa61a4a7` includes reviewed main `a7adb45c28dd252091b8c10e13ea357067071061`. This handoff/evidence commit follows that integration. Code merged automatically; both agents' handoff notes were retained when resolving the document conflict. Main and other checkouts were not edited.
- Integrated source SHA-256: `8566d3eb8c7893d2d7553a244a5f240861156f77b2edfc3ef03486dd069f1b05`. Flight, traversal, shared world geometry and rider animator/IK match reviewed main. The entire review branch also contains the earlier authorized C02/shared-body, mounted-fit, itemization and graphics-tier work; its additive wardrobe save fields and Travel Drape catalog entry are documented separately. No save-key/version change or existing unlock-ID renaming.
- Verification after integration: **117 files / 1,239 tests passed; typecheck/build passed; production smoke 15/15; real Stable mixing 32/32; clothing browser 30/30 with 24 fresh captures; local menu/launcher 12/12**. Windline keyboard/controller leap, recall, tether/pull and save/reset checks passed. Editor passed three edit/undo/redo/save/load/playtest/return cycles, collision-backed validation, export/import and player-save isolation. A new launcher assertion initially used internal slot names instead of visible labels; its labels were corrected and all twelve checks then passed. Software WebGL checks provide functional/visual evidence, not GPU timing.
- [Current integrated captures and reports](rider-c02/evidence/clothing/integration/index.html), [matched before/after](rider-c02/evidence/clothing/index.html), [implementation/art review and limits](rider-c02/CLOTHING_REVIEW.md). Both mounted sides, bank/brake, walk/wave and gust reversals are captured. Actual mixed-outfit takeoff, landing and dismount are checked separately from posed images. Seams remain attached and guided travel stays bounded.
- Verified local compiled release: external review `local-clothing-test/dist`, compiled from `f287267`. Both server health checks match the integrated source hash. Normal menu / existing save: http://127.0.0.1:5193/?quality=high&tod=.42 . Separate all-outfit test profile: http://127.0.0.1:5198/?quality=high&tod=.42 . Its initializer seeds only a missing test save; existing and legacy saves remain. Gallery: http://127.0.0.1:5193/test/clothing/integration/ . Historical compiled releases and hosted game/gallery are preserved.
- Backup: the pre-integration source/evidence ZIP `p1-checkpoint-20261011T162120Z.zip` was reopened and all 1,012 files verified against SHA-256 hashes. A Git bundle of the final review branch is verified and recorded externally with the final commit in `P1_GIT_BACKUP_VERIFICATION.json`; the preceding ZIP record remains in `P1_BACKUP_VERIFICATION.json`. Dependencies, generated builds and raw ignored captures are outside Git; curated review evidence is committed, and the verified local compiled release remains external.
- Known limits: bounded presentation cloth with body/mount capsules and walkable ground, without arbitrary wall/foliage or garment self-collision. Fitted leather, armor and wraps remain rig-supported. Sampled combinations/poses do not certify every stacked accessory. Legacy outfits retain their identities; this is not a complete conversion into new linen costumes. Hardware playtesting is still needed for Medium/High/Ultra performance.
- Next authorized action: push the isolated review branch and open its draft PR, then owner visual/playtest and code review. No merge into main or production/hosted deployment is authorized. The final commit, backup and PR URL are recorded externally in `CLOTHING_REVIEW_STATUS.json` after publication.

## Localized garment pass and review preparation — October 11, 2026

- Objective: Robert approved outfit mixing, then requested a major clothing pass before backup/commit/PR review: soften blocky legs and details, fix disconnected mixes, and make hanging tunics/tabards/lower tops physical cloth like capes/shawls. All seven outfits/pieces remain available under their existing unlocks.
- Isolated branch `codex/rider-c02-proof`; checkpoint base/latest commit `f9fc707d55cea36f62307d8a58ba9c00361be253`. Current clothing source SHA-256 `24b685cb0466afa3465f516a9b0a134ceea95e533f5c41fc756b7405a2796ec2`; 15 rider source/test files differ from the preserved shared-body checkpoint, 382 unchanged, zero removed. [Exact scope](rider-c02/evidence/clothing/scope-verification.json).
- Hanging tunic/coat/robe/tabard/chiton panels, Courier tails, Cartographer sash ends and sewn bell sleeves use the existing cloth solver with attached seams, skinned rest guides and bounded free movement. Original capes/scarves/hair response remains. Walkable-ground contact now applies to these garments too. Dyes and quality changes preserve geometry/solver state. Fitted leather, armor, bodices, trousers and wraps remain rig-supported.
- One dressed-leg envelope/weight field now supplies trousers, wraps, cuffs, guards and stripes, including actual selected mixed trousers. Rounded hems/straps/pouches/cuffs and shallow knee shells soften corners. All complete outfits now share reference-derived linen/leather textures and restrained highlights at the existing 1K/2K/3K/4K sizes. No new fields/IDs or dragon/renderer migration.
- Pre-integration verification: **114 test files / 1,201 tests; typecheck/build; production smoke 15/15; real Stable/mixing 32/32; clothing browser 30/30 with 24 captures and five gust-reversal tests passed**. Includes all 7 trousers × 8 footwear choices across three builds, long gust/hitch/calm tests, sewn seams, recoloring/quality continuity, mounted fit, saves/unlocks and actual takeoff/landing/dismount. Three implementation/capture passes preserved. [Gallery](rider-c02/evidence/clothing/index.html), [art category review/limits](rider-c02/CLOTHING_REVIEW.md). Software WebGL, not hardware timing. Initial arithmetic/budget defects were fixed; 18k C02 body guard retained.
- Flight/movement, fixed-step gameplay, rig/animator/IK, saddle/stirrups, world geometry, wardrobe/save/unlock contracts, quality tiers and dragon source are hash-identical to the preceding shared-body source checkpoint. Live GitHub main has advanced to `a7adb45c28dd252091b8c10e13ea357067071061` with reviewed Windline/editor/audio changes; preserve this checkpoint before integrating those changes into this review branch. Never modify main or another agent's checkout.
- Known limits: body/mount capsules and walkable ground, without arbitrary wall/foliage/self-collision or exhaustive stacked-layer contact. Legacy outfit identities remain, not a full conversion into canonical linen costumes. Current local 5193/5198 servers still serve the earlier preserved shared-body release until the integrated build is verified. Hosted game/gallery remain unchanged.
- Next authorized action: verified backup, commit this work, bring reviewed main into this branch without losing either handoff, rerun relevant integration checks, refresh local menu test, push and create a review PR. No main merge or production deployment is authorized. External `P1_BACKUP_VERIFICATION.json` records the independently verified backup.

## Shared refined body for every outfit — October 11, 2026

- Current objective: Robert reported that the normal game showed the old rider and then explicitly approved **"Use the refined body for every outfit."** The server had the latest linen build, but his saved Flight Leathers base only received selected linen pieces; the refined sculpt was previously gated by the complete Travel Drape preset. All seven presets and mixes now use that shared sculpt automatically. Saved outfit, dyes, accessories and progression are preserved.
- Same isolated `codex/rider-c02-proof`, latest commit/base `f9fc707d55cea36f62307d8a58ba9c00361be253`; local/uncommitted. Source SHA-256 `60755b4f968db58b77210000cb9e6e8c7c91d129a90c3bc10555f3be95db5e89`. Against the linen release: five existing source/test files changed and one new topology/color test; **389 unchanged**, zero removals. The runtime change is confined to body assembly/profile selection and explicit linen hem metadata. [Scope hashes and counts](rider-c02/evidence/shared-body/scope-verification.json).
- Shared body: connected torso/neck/arms, rounded limbs, refined face/head/hair fit. Existing outfit styles still supply their own garment shapes, inflation, colors and extras. Legacy boot transitions remain original instead of being treated as gathered linen hems. Six original presets retain Slight/Medium/Broad; complete Travel Drape remains Medium/Aerie. `bodyVersion` is rendering/debug metadata, not a saved field. No new outfit/unlock IDs or save migration.
- Flight/movement, rig/joints/animator/IK, saddle/stirrups/sockets, cloth solver/specs/contacts, wardrobe/save/unlock logic, texture/quality tiers, world geometry and dragon runtime are hash-identical to the prior linen release. Complete original outfits retain their vertex-color material treatment; mixed/C02 looks retain the existing reference-derived atlas and 1K/2K/3K/4K tiers. This is not a complete legacy material remaster.
- Validation: focused six files / **61 tests**, full **113 files / 1,187 tests**, typecheck and production build passed. Production smoke **15/15**, mixed wardrobe **32/32**, shared-body browser **33/33 with 20 captures** passed. Tests verify actual shared topology, original boot colors, rig/builds, every garment, recoloring without rebuilding, saves/unlocks, cloth gusts and mounted contacts. Real Stable selects all seven presets and linen pieces on Flight; saved choices reload identically. Actual Flight Leathers and seven-outfit mix complete takeoff/landing/dismount. [Gallery and exact results](rider-c02/evidence/shared-body/index.html), [review/limits](rider-c02/SHARED_BODY_REVIEW.md). Software WebGL evidence does not measure hardware performance.
- Local compiled release: external review `local-shared-rider-test/dist`. Normal saved game: http://127.0.0.1:5193/?quality=high&tod=.42 . Clear linen test profile: http://127.0.0.1:5198/?quality=high&tod=.42 . Both begin at the normal menu. Only a missing save on 5198 is seeded with light linen/all outfit unlocks; 5193 and existing current/legacy saves are never seeded or reset. Launcher at `/test/` labels these profiles separately; evidence at `/test/shared-body/`. Historical releases remain preserved.
- Final local menu/launcher QA **17/17** passed, bringing the current browser total to **97**. Both health endpoints report the source hash above. QA verifies the saved-base mix on 5193, High/3K light linen and unlocked test-only pieces on 5198, real Stable/Revert/save/reload, no save crossover, 1440/390px launchers and all 20 loaded gallery images without overflow. Zero browser/shader errors. An initial gallery-only missing favicon was corrected before the final passing run. `Start-Local-Test.cmd` starts both profiles after reboot and refuses to replace an unrelated/different server.
- Geometry without headgear/scarf: Medium Flight 11,916; Scout 13,188; Courier 12,128; Racer 12,688; Cartographer 13,280; Skyknight 13,512; complete Travel Drape 17,590 triangles. Stable captures retain default goggles/scarf and add 1,180 triangles. The C02 18k proof guard excludes those accessories. Existing 27 bones and one body mesh/draw remain. Budgets are provisional; no new GPU timing claim.
- Known limits: original armor/collar/accessory edges remain; not a complete garment resculpt. Ankles remain overlapping transitions, not a globally welded sculpt. Clearance is sampled rather than exhaustive. Existing cloth limits remain. `git diff --check` separately exits **2** for the same six whitespace-only lines in `outfits.ts` (130, 218, 294, 384, 456, 584), whose hash remains `5b05b704de286eff8cd1f732cc0eafa1036ccc74008124b6b2797661de57e9b9`; LF/CRLF warnings also remain. No unrelated formatting cleanup, main edit, hosted update, commit/push/merge. Next authorized action: owner local outfit/playtest review. The external `P1_BACKUP_VERIFICATION.json` records the latest independently verified source/evidence checkpoint.

## Light linen / Travel Drape refinement — October 11, 2026

- Current objective: Robert requested more top layering and a second pass on shoulders and ankles, then confirmed **Light linen / Travel Drape**. Three capture-and-review passes added two fitted crossed linen overlaps with turned edges, rounded the deltoid bridges on the existing connected upper body, removed erroneous linen UVs from bare shoulders/neckline/forearms, blended the lower leg into the foot during flex and replaced the hard heel ring with a tapered leather ankle keeper. These changes follow the selected Travel Drape top/footwear in mixed outfits; the removable armor and shoulder drape remain separate. Slate rows sit slightly farther out to clear the added linen. A first-pass heel strap looked like a fin and was removed.
- Same isolated branch `codex/rider-c02-proof`, latest commit/base `f9fc707d55cea36f62307d8a58ba9c00361be253`. All work remains local/uncommitted. Source SHA-256 `c6e4b25237ca6a6f3ae1e5096407f180f935bcf4bf3b6a3596a8e7b6378a3d0e`. Comparison against the prior mixed wardrobe release finds **three source/test files changed, 391 unchanged, no additions/removals**: `proof.ts`, `softBody.ts` and `proof.test.ts`. Flight/movement, rig/animator/IK, saddle/stirrups/sockets, cloth solver/specs, save/unlock/wardrobe logic, texture/quality tiers, shared world geometry and dragon runtime are byte-identical. New `scripts/rider-layering-check.mjs` records the art views; documentation/evidence updates accompany them.
- Validation: **112 files / 1,178 tests passed; typecheck and production build passed; production smoke 15/15; mixed wardrobe browser 32/32; final art views 11/11 with ten captures; local launcher 9/9**. Final browser total: **67 checks**. Existing mounted contact/clearance and gust regressions pass without looser thresholds. The seven-outfit mix completes actual takeoff, landing and dismount; Stable preview/Revert, dyes, Save/reload, locks and restore pass. The art gallery separately labels posed on-foot, shoulder/ankle, wave, full costume, mounted-left/right and bank captures. Medium uses the existing 2K atlas; the normal-menu launcher also verifies High/3K customization. No browser/shader errors were recorded.
- Geometry in final captures: **14,336 triangles** for the light Aerie loadout and **17,590** for the full Travel Drape. The full costume is about 10% above the prior 15,982-triangle proof. Its provisional guard is now 18k, accounting for the authorized layering and rounded bridges. Existing 27 bones and one body mesh/draw remain; no new material, solver or texture allocation. This is an explicit geometry budget increase, not a measured frame-rate result.
- [Matched before/after gallery and both mounted sides](rider-c02/evidence/layering/index.html), [scope hashes](rider-c02/evidence/layering/scope-verification.json), [art review and remaining gaps](rider-c02/LAYERING_REVIEW.md). Historical before/first/second-pass captures and the final mixed wardrobe checks are retained in that gallery. Local compiled release: external review `local-layering-test/dist`; open http://127.0.0.1:5193/test/ . Both `/test/layering/` and the previously opened `/test/wardrobe/` show the new comparison page. Prior compiled releases remain preserved.
- Known limits: the procedural neckline, feet/face and textile seams remain simpler than the concept artwork. The ankle is an overlapping skinned transition rather than a globally welded body sculpt. Sampled combinations/poses are not exhaustive clearance certification; SwiftShader is functional/visual evidence, not dedicated/integrated GPU timing. Wider art changes, gameplay/flight tuning, hosted publication, commits/push/merge and main edits were not performed. The fresh full source/evidence archive and independent ZIP hash verification are recorded externally in `P1_BACKUP_VERIFICATION.json`. Next authorized action: Robert's local visual/customization/playtest review.
- Baseline formatting issue, separate from the passing functional checks: final `git diff --check` exits 1 for six whitespace-only lines in `src/creatures/rider/outfits.ts` (130, 218, 294, 384, 456, 584). That file is hash-identical to the prior mixed wardrobe release and was not edited in this art pass. Existing LF/CRLF conversion warnings also remain. No unrelated formatting cleanup was bundled into this refinement.

## Pieces from every existing outfit — October 11, 2026

- Current objective: Robert explicitly chose pieces from every existing outfit. All seven presets now supply selectable tops, trousers, chest layers, collars/shoulders, belts/sashes, sleeves/gloves, leg wraps/guards and footwear where those layers exist. Eight slots are available from any preset in Stable → Outfit Pieces. Complete outfits and their original unlock IDs remain; their pieces inherit parent availability without duplicate reward toasts.
- Same isolated branch `codex/rider-c02-proof`, latest commit/base `f9fc707d55cea36f62307d8a58ba9c00361be253`. All changes remain local/uncommitted. Existing flat C02 fields remain readable; additive optional sparse `RiderLook.wardrobe` validates each slot. Preview/Revert, Save/reload, Restore and complete preset switching work through the real Stable. Dyes recolor in place. The Travel Drape preset remains medium/Aerie; its individual garments also fit the legacy Slight/Broad bodies.
- Existing outfit builders now expose their garment sections against one body/27-bone rig. Outer layers account for top thickness. Courier tails follow the selected top; loose C02 drape/sash follow their slots in explicit Wanderer views. Normal Aerie cloth remains secured. Original complete presets use their existing builder path. Renderer validation caught a zero-hem divide in rounded legs with legacy trousers; corrected the gather condition and added every-garment C02-body coverage.
- Validation: **112 files / 1,177 tests passed; typecheck/build passed; production smoke 15/15; mixed wardrobe browser 32/32 with eight captures; local launcher 9/9.** Browser storage is isolated. A mix from all seven outfits completes actual takeoff, landing and dismount. Preview/Revert, parent locks, dyes without geometry rebuild, save/reload without costume flags, restore and full presets pass. Posed front/back and both mounted sides at 2K are separately labeled in [current evidence](rider-c02/evidence/mixed-wardrobe/index.html). SwiftShader verifies functionality/appearance, not GPU timing.
- Local compiled snapshot: external review `local-mixed-wardrobe-test/dist`, source SHA-256 `285f0a3463a60a2f4ee295f2ebe267ceefcbaba89c6004b64e055a703c12dc8c`. Launcher: http://127.0.0.1:5193/test/ . Choose Stable → Outfit Pieces. Gallery: /test/mixed-wardrobe/ . Prior Travel-only and quality snapshots remain preserved. Scope hashes find 19 changed/new source/test files, 375 unchanged, zero removals against the prior Travel-only release. Flight/movement, terrain/world, animator/IK, saddle/stirrups, cloth solver/contact, quality tiers and dragon runtime are byte-identical.
- Known limits: individual garments are tested on all three builds and C02; exhaustive multi-layer/accessory clearance is not certified. Long coats/robes and large accessories may need art refinement. Shared C02 maps are retained; legacy garments have not received a full texture/UV remaster. No new dependency, flight tuning, main edit, commit/push/merge or hosted update. Fresh local source/evidence backup status is recorded externally in `P1_BACKUP_VERIFICATION.json`. Next authorized action: owner local customization/playtest review. Earlier Travel-only limits below describe historical scope, superseded by this explicit request.

## Itemized Travel Drape customization — October 10, 2026 (Mountain time)

- Current objective: Robert asked to itemize outfits so players can customize. First pass exposes the approved C02 Travel Drape, with six optional pieces: slate chest panel, shoulder drape plus attached brooch, sash, arm wraps, calf wraps and sandals. Chiton/trousers remain the base layer. Added independent scale/leather dyes; existing main/trim/hair/accessory colors remain. Existing outfits and unlock IDs remain complete sets.
- Same isolated `codex/rider-c02-proof`, HEAD `f9fc707d55cea36f62307d8a58ba9c00361be253`; local changes remain uncommitted. The new `travel-drape` catalog entry renders without debug flags using the compact secured Aerie cut and medium build. Selecting it sets Medium; other build choices explain the constraint. Wanderer remains an explicit viewer cut. Fully equipped geometry matches the prior approved Aerie geometry, UVs, colors and rig exactly in tests.
- Stable → Outfit Pieces offers six independent worn/removed choices, two dye palettes and Restore all outfit pieces. Preview/Revert, Save & leave, reload and switching to/from another complete outfit preserve the loadout. Removed pieces generate no optional geometry; Wanderer loose drape/sash cloth is omitted when unequipped. Brooch removal follows the drape. Dyes update vertex-color recipes in place, preserving geometry, UVs, skeleton, material and cloth solvers.
- Save extension is additive: six component IDs and two colors in `RiderLook`; old saves backfill the full approved component set while keeping their prior outfit and progression. Unknown IDs are validated within their own slot; Travel Drape normalizes to Medium. Existing save key/version and existing unlock requirements remain. See [wardrobe specification](WARDROBE_CUSTOMIZATION.md). This specific user request authorizes the limited wardrobe extension; older P1-only restrictions below describe earlier scope.
- Validation: **111 unit files / 1,168 tests passed**, including all 64 component combinations in both cuts, complete geometry parity, dye parity, save migration/round trips, existing mounted fit and unlock regressions. **Typecheck + production build passed; production smoke 15/15 passed; wardrobe browser checks 24/24 passed with five captures.** Actual Stable DOM and new wardrobe gameplay/capture evidence are in [the wardrobe gallery](rider-c02/evidence/wardrobe/index.html) with its exact results. Browser checks cover preview, Revert, restore, build constraint, dyes, save/reload without `riderProof`, complete-outfit switching, legacy locks, actual takeoff/landing/dismount and both mounted sides. Posed captures are distinguished from actual simulation checks. SwiftShader is functional/visual evidence, not hardware timing.
- Local launcher **9/9 checks passed**, covering 1440/390px layouts, current capture loading and normal menu → Stable → Outfit Pieces with the real model. Local test receives this version at `http://127.0.0.1:5193/test/`; Play links open the normal menu without proof substitution. Choose Stable → Outfit → Travel Drape → Outfit Pieces. Old quality build is preserved in the external review's `local-quality-test`; the new compiled snapshot is `local-wardrobe-test`, with source hashes in `test-build.json` (source SHA-256 `3cfbbe381d5c1fbf6b3a7a68d05e7a46b17be7cf0d0959ceb0d94cfebe3c408f`). Scope comparison: 11 existing source/test files changed, one new test, 379 unchanged; no source removals. Flight/movement, world geometry, animator/IK, saddle, cloth solver/contact, graphics tiers and dragon runtime are byte-identical to the prior quality snapshot. No hosted Site update, GitHub commit/push/merge or main change. Backup verification is recorded externally in `P1_BACKUP_VERIFICATION.json`.
- Known limits: only Travel Drape has modular main garments; other outfits remain bundled. Medium build only for the new outfit. Long Wanderer is not automatically swapped during gameplay. Existing headgear/scarves/capes remain selectable, but exhaustive clearance for every combined accessory is not certified. Next authorized action: owner local customization/playtest review; broaden garment mixing only when requested.

## Dedicated-GPU quality increment and clear local launch flow — October 10, 2026 (Mountain time)

- Robert's successful local playtest changed the target: Low supports integrated graphics; Medium/High/Ultra may spend more on fidelity for dedicated cards. His screenshot reported the experimental 4K link opening a rotating model rather than the menu. That was intentional viewer routing, not a cloth defect; no petal/cloth-artifact fix was needed or made.
- Same isolated `codex/rider-c02-proof`, base/HEAD `f9fc707d55cea36f62307d8a58ba9c00361be253`; source changes remain local/uncommitted. Medium/High/Ultra shadow maps increase to 2048/3072/4096 with existing coverage. Grass density/radius increase to .8/130m, 1.25/180m, 1.75/220m. Medium/High pixel-ratio caps become 1.5/1.75; Ultra stays 2. MSAA, props, view distance, bloom, clouds and particles remain unchanged.
- Rider texture dimensions remain 1K/2K/3K/4K, with requested anisotropy 2/4/8/16 capped by Three/driver support. Higher tiers draw finer cloth interpolation without changing particles, solver, contacts or tethers. Existing C02 state continuity test now covers Ultra and return to Low. Cost/memory limits and targets are in [graphics quality policy](GRAPHICS_QUALITY.md) and [texture policy](TEXTURE_QUALITY.md).
- Scope verification against the previously reviewed/published static snapshot's preserved source found **5 source/test files changed, 385 unchanged**. Low's entire quality-profile block is byte-identical. Rider costume/body, rig, animator/IK, saddle correction, cloth solver/specs, flight, traversal, saves/catalog, shared world and all dragon runtime source remain unchanged.
- Final verification: **110 files / 1,161 tests passed**, typecheck/build passed, production smoke **15/15**, cloth/material browser proof **17 checks / 13 captures**, local launcher/menu/viewer QA **10 checks**. First complete run had one stale UI summary expectation (`Lush` vs newly applicable `Very lush`); corrected the assertion to reflect the increased density, then the full suite passed. Launcher QA initially used only one Enter confirmation; corrected the harness to follow the existing title reveal then Fly confirmation. No gameplay input behavior was changed.
- Local adapter and actual browser WebGL identify **AMD Radeon RX 9070 XT / ANGLE D3D11, 2560×1440**. Short samples of all updated tiers had zero page/game/console errors and automatic resolution factor 1; Medium/High/Ultra mean rAF cadence was about 16.7ms. This is one short Roost scene with browser scheduling/vsync, not isolated GPU time, sustained-flight stability, minimum-spec or peak-memory certification. Source/material regression also uses software SwiftShader. [Evidence and scope](rider-c02/evidence/quality-budget/index.html) preserve raw samples and captures.
- Updated local compiled release lives outside the game worktree under the external review's `local-quality-test/dist`, with a source hash in `test-build.json`. Loopback launcher: http://127.0.0.1:5193/test/ . Five Play buttons open the normal menu (including Ultra and High+4K); three explicitly labeled model viewers rotate without a menu. Double-click `Start-Local-Test.cmd` restarts/opens it. The earlier hosted static snapshot is preserved unchanged; no hosted update, GitHub push/merge or production catalog rollout was made.
- Next: owner playtest of this local increment. Measure longer flight/weather/landmark scenes and lower dedicated hardware before further tier increases. Local source/evidence backup status is recorded by the external review's `P1_BACKUP_VERIFICATION.json`; historical archives remain preserved.

## Local P1 test launcher restored — October 10, 2026 (Mountain time)

- Robert reported the hosted test did not work and requested the build locally on his computer. Started the same tested static snapshot on a hidden Windows Node process bound only to `127.0.0.1:5193` and requested the default browser open `http://127.0.0.1:5193/test/`.
- Health endpoint returned the expected `driftwing-rider-p1-local` service and static snapshot `6846f3ee82df88fe5f33b1ba7addc025f555728f`; launcher and Medium gameplay URLs both returned HTTP 200. Existing build/browser QA applies to these unchanged compiled files; no new game runtime edits or new hardware-performance claims.
- External review folder now includes `local-test-server.mjs`, `Start-Local-Test.ps1`, and double-click `Start-Local-Test.cmd` to restart/open after reboot. Helpers serve only `test-site/dist`; logs remain beside them. This local URL is for this computer. Hosted access failure has not been diagnosed; no Site audience/access changes were made.
- Next: Robert's desktop/laptop playtest via the local launcher, starting with Medium. GitHub main and production defaults remain unchanged.

## Private P1 test site published — October 10, 2026 (Mountain time)

- Robert explicitly approved the named owner-only Sites destination and compiled-game/launcher/three-capture payload with "Yes". The earlier automatic approval block is resolved for this exact reduced payload. Original TypeScript, internal documentation and original Git history were not exported to Sites.
- Confirmed successful native private publication: https://driftwing-rider-p1-test.oberon33.chatgpt.site/test/ . Site `appgprj_6acb09a771c081918652e1dc9374e920`; static snapshot commit `6846f3ee82df88fe5f33b1ba7addc025f555728f`; saved version `appgprj_6acb09a771c081918652e1dc9374e920~appgver_775a5ccedfbc8191b1c72c346bc2dc47`; deployment `appgdep_6acb0bad24b08191885ff0188f99f7e3`, status `succeeded`.
- The independent static Site repository contains compiled assets, launcher, three images and minimal hosting metadata only. The original game worktree remains `codex/rider-c02-proof`, base `f9fc707d55cea36f62307d8a58ba9c00361be253`, with reviewed P1 changes local/uncommitted. GitHub main and its existing deployment were not changed. Source copies, detailed hashes and backup remain local in the external review directory.
- Fresh typecheck/build and 15/15 production browser smoke passed; static launcher QA passed at 1440px/390px, with all six launch routes and three images valid. Prior 1,161 source tests and P1 browser evidence remain the runtime regression record. Packaging required `TAR_OPTIONS=--force-local` for Windows drive paths; the helper verified the exact pushed static snapshot and generated the archive before native private deployment.
- Launcher links: Low 1K, Medium 2K, High 3K gameplay; rotating Wanderer and real mounted-rider views; optional High 4K comparison. Desktop keyboard/gamepad for gameplay; no touch-flight controls were added. Private sign-in and phone hardware rendering were not independently tested. Actual integrated-GPU performance remains for Robert's playtest.
- Next: owner target-device playtest and feedback. This publication does not authorize merging the P1 to main, production catalog/default rollout, wider cast/wardrobe or dragon bitmap implementation. Reuse the existing Site identity on updates and keep its audience owner-private.

## Private test deployment prepared — October 10, 2026 (Mountain time)

- Robert requested deploying this reviewed P1 to test. Existing GitHub Pages publishes main; no main changes, merge, GitHub push or production catalog rollout were performed.
- Fresh typecheck and production build passed; production browser smoke passed 15/15. An isolated static test launcher passed 1440px and 390px layout, three loaded capture images and six launch-route checks. Current game runtime source remains unchanged from the reviewed P1.
- Created an unpublished owner-private Sites project `appgprj_6acb09a771c081918652e1dc9374e920`, expected origin `https://driftwing-rider-p1-test.oberon33.chatgpt.site`. Identity is preserved in the external review's `test-site/.openai/hosting.json`; reuse it, do not create another Site.
- Hosting payload now contains only compiled browser game assets, the `/test/` launcher, three reviewed captures and minimal hosting metadata. Original source/docs/provenance copies were moved to `test-site-source-local-only/` and remain local; the original game worktree was not moved. No credentials were written to files.
- Automatic approval review rejected both the original full-source synchronization and the reduced compiled-only synchronization: it requires Robert's explicit authorization of this external Sites destination and payload. Neither synchronization executed; no Site version or deployment exists. The project is registered but NOT live.
- Next: obtain explicit destination/payload approval, then use the Sites source helper and native private publication flow for this existing project. Keep owner-only access. Refresh its short-lived source credential if needed. Open `/test/` after successful deployment and record the returned version/commit/deployment IDs. Do not interpret the test deployment as permission to merge or roll out the rider catalog.

## Latest: cloth stability and higher resolution materials — October 10, 2026 (Mountain time)

- Robert authorized stable cloth/environment/wind response and higher textures, then requested exploring 3–4K at High, 2K Medium and documenting the same for dragons. Same isolated branch `codex/rider-c02-proof`; latest commit/base `f9fc707d55cea36f62307d8a58ba9c00361be253`. Local, uncommitted, unpushed and unmerged.
- C02 opts into contact friction and non-bouncy positional repair, including deterministic escape from a capsule axis. Drape/sash gain damping and gentle low-speed flutter. Loose cloth uses relative wind, inertia, existing body/mount capsules and shared walkable ground/deck queries. Quality changes retain the simulation instead of resetting it. Fitted chiton/trousers and the compact Aerie drape remain rig-driven/secured. No arbitrary-wall/foliage, self-collision or wet-cloth claim.
- M01 reference-derived maps now generate directly at 1K Low, 2K Medium, 3K High and 4K existing Ultra. High can compare 4K with `riderTexture=4096`; Low/Medium budgets stay fixed. Device texture limits cap selection. Body/drape/sash share maps and unchanged UVs/dye recipes; optional normals generate lazily. Skin/cloth boundaries suppress interpolated atlas bleed. No new saves, dependencies, renderer or production default changes.
- Both 3K and 4K rendered successfully at High, with identical close cameras; their visible difference is small here. 3K saves about 44% per-map storage (48 vs 85.33 MiB including mipmaps); optional normal maps double it. Visited sizes remain cached. [Rider/dragon texture policy](TEXTURE_QUALITY.md) records CPU/GPU costs, actual usable tile widths, defaults, overrides and hardware limitations. Dragons currently use shader-generated hide/membrane patterns, with no bitmap skin maps to upscale; matching future bitmap budgets are documented only. Dragon runtime source is unchanged.
- Final source verification: **110 files / 1,161 unit tests passed**, TypeScript/build passed, production smoke **15/15 passed**. New cloth/resolution browser proof **17 checks / 13 captures**; refreshed full proof **49 / 40** and mounted fit **51 / 16**, zero page/console/game errors. Actual player weather, takeoff/landing/dismount, Windline attach/release, saves, Stable preview/Revert/Apply/reload, dyes and shape rebuilds passed. Unit coverage includes capsule-axis contact, sloped-ground/open-air release, gust/hitch bounds, quality continuity, map sharing/resolution and hardware limits.
- Controlled stress: 900 frames with 90 m/s wind reversals, inertia and 4–250 ms input frame intervals; bounded finite particles and drawn geometry. Ten seconds of calm reduced the maximum sampled particle speed to 1.06 cm/s. Real rainy-weather sample matched the player's relative-air input exactly. These are sampled checks, not hardware performance or exhaustive clothing/prop clearance certification.
- [Latest cloth/HD gallery](rider-c02/evidence/cloth-hd/index.html), [all current production captures](rider-c02/evidence/cloth-hd/final/index.html), [all mounted sides](rider-c02/evidence/cloth-hd/mounted/index.html), [scope hashes](rider-c02/evidence/cloth-hd/scope-verification.json). Against the independently verified five-pass checkpoint, **11 existing source/test files changed; 379 unchanged**. Rider body/costume geometry, rig, animator/IK, saddle, flight/movement, traversal, saves/catalog and shared world remain byte-identical. Geometry stays Wanderer 15,694 / Aerie 15,982 triangles with 27 bones; no extra body/cloth draws.
- Known limits: procedural art remains simpler than the paintings; atlas texel density/unwrap remains proof-level. SwiftShader is not integrated-GPU timing or peak-memory certification. Ground contact is unit-verified against a sloped surface, not an exhaustive terrain/prop runtime proof. Next authorized action: owner visual/playtest review, including target-device Low/Medium/High measurement. No production catalog rollout, wider cast, commit/push/merge or deployment is implied. A fresh independently verified source/evidence backup is recorded in the external review's `P1_BACKUP_VERIFICATION.json`.


## Latest: five authorized character fidelity passes — October 10, 2026 (Mountain time)

- Robert requested multiple passes to match the approved artwork as closely as possible, using the texture/material examples. Same isolated branch `codex/rider-c02-proof`, latest commit/base main `f9fc707d55cea36f62307d8a58ba9c00361be253`. All P1 work remains local, uncommitted, unpushed and unmerged.
- Five capture-and-review passes refined arm/shoulder profiles, integrated facial forms, swept ponytail hair masses, rolled diagonal drape, rounded slate scallops, folded overlapping chiton, gathered trousers and crossed calf wraps. The existing connected chest/neck/arms and rounded hands/feet are preserved. The short Aerie conversion retains the approved costume identity.
- The supplied M01 plate is a material study rather than a UV-ready texture pack. Reference-derived, dye-neutral 1K tiles now reproduce woven linen, matte slate grain, worn leather and softened bronze. Body cloth and moving drape/sash use the same atlas as the overlays; a proof-only material class gives bronze a restrained broad sheen. Existing toon ramp, WebGL renderer, normal comparison toggle and in-place dye recipes remain. No dependencies or production default changes.
- Iteration evidence records problems as well as corrections: longer Aerie hems reduced Skimmer bank clearance, so compact flight hems were restored; drape inflation corrected a scale intersection; an overlong central wave was shortened to clear the face. No test thresholds, rig, solver settings or flight tuning were changed to pass checks. Hair detail was redistributed to retain the original 16k proof cap.
- Final source: **110 files / 1,156 unit tests passed**, TypeScript and production build passed, production smoke **15/15 passed**. Final production proof **49 checks / 40 captures**, mounted fit **51 checks / 16 captures**, with zero page/console/game errors. Stable preview/Revert/Apply/reload, repeated dyes, cosmetic fallback/rebuilds, Windline cast/attach/release and actual player takeoff/landing/dismount passed. A new regression covers shared maps on moving drape/sash and maps-off/color/normal consistency.
- Wanderer **15,694** triangles; Aerie **15,982**; legacy **12,170**. Existing **27 bones**, one body draw, Wanderer three cloth draws/Aerie one. No additional texture size or draw calls. Optional normals add the existing second 1K map; no roughness/metalness renderer workflow.
- SHA-256 comparison to verified rounded checkpoint `p1-checkpoint-20261011T023309Z` found **12 rider source/test files changed and 378 source files unchanged**. Saddle correction, rig, animator/IK, cloth solver, movement, deterministic flight, traversal, saves/catalog and shared world source remain byte-identical. The drape/sash rest/spec function is unchanged after removing the two new render-only texture flags; head-surface sculpt changes the existing hair attachment surface slightly, not its rig or solver convention. Exact scope/hashes accompany the gallery.
- [Five-pass gallery](rider-c02/evidence/fidelity/index.html), [all final production captures](rider-c02/evidence/fidelity/final/index.html), [both mounted sides](rider-c02/evidence/fidelity/mounted/index.html), [pass log](rider-c02/evidence/fidelity/pass-log.json) and [scope verification](rider-c02/evidence/fidelity/scope-verification.json). Historical galleries are retained. Final evidence includes Low/Medium/High, day/night and maps off/color/normal. Five development passes add 40 matched-camera captures.
- Known art limits: the procedural face/hands, natural hair strand grouping and diagonal back layering remain simpler than the paintings; texture density/seams remain proof-level. Software SwiftShader establishes appearance/integration evidence, not integrated-GPU performance. This is a refined P1 review result, not an assertion of perfect concept fidelity or production art signoff.
- Next authorized action: owner review/playtest of this refined P1; hardware measurement remains outstanding. No production catalog rollout, new save fields, wider cast/wardrobe, renderer migration, commit/push/merge or deployment is implied. A verified local source/evidence archive is recorded by the review folder's `P1_BACKUP_VERIFICATION.json`.

## Latest: authorized rounded body refinement — October 10, 2026 (Mountain time)

- Robert requested closer fidelity to the approved rendering, softer hard corners and better body joins. Same isolated branch `codex/rider-c02-proof`, HEAD/base main `f9fc707d55cea36f62307d8a58ba9c00361be253`; local, uncommitted, unpushed and unmerged.
- Proof-only `softBody.ts` builds chest, neck and arms as one connected surface with shared shoulder vertices, replacing the proof's overlapping shoulder balls/arm caps and separate neck tube. Palm/fingers share a continuous rounded loft; heel/toe and jaw are rounder. The diagonal neckline curves more naturally, split hems turn up at corners and trousers taper into the cuff. Costume design, existing ponytail, 27-bone rig, contacts and fast recoloring remain intact. Legacy body builders remain the default.
- Hash comparison against the verified mounted-fit checkpoint found only `body.ts`, `garments.ts`, `proof.ts` and `proof.test.ts` changed among existing src files, plus new `softBody.ts`. Saddle correction, rig, animator, IK, cloth solver/specs, movement, deterministic flight, Windline, save/catalog and shared world files are unchanged. Exact hashes accompany the gallery.
- Final checks: **110 files / 1,155 unit tests passed** (including a connected-surface/open-boundary regression), typecheck/build passed and production smoke **15/15 passed**. Production main proof **49 checks / 40 captures**, mounted fit **51 checks / 16 captures**, no page/console/game errors. Mounted unit regression covers 4 breeds × 4 saddles × 6 poses and actual sandal/iron contact triangles. No fit thresholds or physics were loosened.
- Geometry remains under the unchanged 16,000-triangle proof cap: Wanderer **15,610**, Aerie **15,982**; legacy remains **12,170**. No new materials, bones, textures or draw calls. The connected upper surface opens into the head/pelvis and at wrists; this is not a globally watertight sculpt. P1 remains simpler than the concept art. Software WebGL is not integrated-GPU performance certification or final art approval.
- [Latest gallery and before/after](rider-c02/evidence/rounded/index.html), [updated mounted views from both sides](rider-c02/evidence/rounded/mounted/index.html) and [source scope/checks](rider-c02/evidence/rounded/scope-verification.json). Older galleries are preserved as historical checkpoints. Reproduce after building with `RIDER_PROOF_PORT=5189`, `RIDER_PROOF_OUTPUT=shots/rider-rounded`, `node scripts/rider-proof-check.mjs --sculpt`; then `node scripts/rider-mounted-fit-check.mjs`.
- Next authorized action: owner review of the refined P1 result. No production default/catalog rollout, wider cast, new save fields, renderer migration or publication is implied. A new verified local source/evidence archive accompanies this checkpoint; the external review's `P1_BACKUP_VERIFICATION.json` records its exact path and SHA-256.

## Latest: mounted leg/flap and stirrup correction — October 10, 2026 (Mountain time)

- Robert explicitly authorized fixing the marked mounted leg clipping and stirrup alignment, keeping the approved costume and existing flight behavior. Owner remains Codex in this rider review chat, isolated `codex/rider-c02-proof` at `C:/Users/Robert/.codex/worktrees/rider-c02-proof/Driftwing`. Latest commit remains baseline `f9fc707d55cea36f62307d8a58ba9c00361be253`; all P1 changes remain local/uncommitted, unpushed and unmerged.
- Confirmed cause: the continuous knee/calf was intersected/occluded by the saddle's outward flap; the stirrup hoop was oriented fore/aft through the instep. `src/creatures/wyvern/parts/saddle.ts` turns the flap inward and makes a cross-foot iron with a flat tread. Existing seat/socket positions, rod radius and rig remain unchanged. New vertex ranges support direct deformed-mesh fit tests; no gameplay contracts added.
- SHA-256 comparison to the initial verified P1 source checkpoint confirmed the saddle file is the only existing runtime file changed. Approved costume, rig, animator, cloth, movement, flight, traversal, saves and shared world geometry remain byte-identical. No physics/tuning/fixture changes, dependencies, commits, pushes, merges or deployments.
- Final verification: **110 files / 1,154 tests passed**, including 16 new actual-surface cases across four breeds/four saddles and ground/glide/both banks/dive/brake. Typecheck/build passed. Fresh production smoke **15/15 passed**. New production-browser evidence **51 checks / 16 captures passed**, zero page/console/game errors; installed Edge/SwiftShader with isolated storage.
- [Updated gallery — both sides](rider-c02/evidence/mounted-fit/index.html), [manifest](rider-c02/evidence/mounted-fit/manifest.json), and [current report](rider-c02/README.md). Initial gallery mounted images predate this correction and are linked as historical. New views include each side through the pose matrix, oblique tread details, and actual landed player simulation with an inspection camera. Run after building: `node scripts/rider-mounted-fit-check.mjs` (port 5188).
- Known limits/next action: owner visual/playtest review and actual target-hardware measurement. No exhaustive all-accessory/wardrobe clearance or physical-hardware certification. Current P1 remains opt-in/local; production rollout, publication/integration and wider character work retain their existing scope boundaries. Updated local checkpoint/verification live beside the original review package; older checkpoint is retained.

## Latest: approved C02 / M01 / P1 rider development proof — 2026-10-11 UTC

- Objective: carry Robert's approved C02 Travel Drape + M01 + P1 to an actual-engine review checkpoint: one medium Wanderer with the existing ponytail, early compact Aerie mounted conversion, and a shared 1K toon material proof. Owner: Codex in the rider review chat; no delegated/concurrent edits.
- Active branch `codex/rider-c02-proof`, isolated managed worktree `C:/Users/Robert/.codex/worktrees/rider-c02-proof/Driftwing`. Latest committed baseline remains `f9fc707d55cea36f62307d8a58ba9c00361be253`; P1 changes are local and uncommitted pending visual review/integration authorization. Main and all historical Claude/Codex/WSL worktrees were preserved.
- Readiness: PR #3 merged, final reviewed head `41c90a19ae202cdb320542ab071073d2d1d4aae9` passed Verify integration run `38099399482`; GitHub main and fetched origin/main matched `f9fc707`. Feature/reference ancestry and documented preservation/exclusions verified. Read current AGENTS, ARCHITECTURE, ART_DIRECTION, art index and cloud handoff. Paused `driftwing-alignment-and-rider-start` after the verified start to prevent duplicates.
- [Current proof report](rider-c02/README.md) records exact preview queries, changed systems, material/geometry budgets, reference hierarchy and category-specific visual limits. Its `approved/` folder keeps the unchanged shared brief, final four concept plates and exact approval record together. Concept imagery remains separate from engine evidence.
- Added opt-in `riderProof=wanderer|aerie`, with `riderMaps=off|color|normal`. Only existing medium/flight is replaced in that debug preview. Ordinary boot/catalog/defaults remain unchanged. Wanderer uses thick pale folds, broad slate scales, blue sash, bronze pin, wraps/sandals and two existing-solver cloth sheets. Aerie secures drape/tails and adds palm wraps. The existing 27-bone rig, contact/equipment frames, cosmetics/unlocks, saves and efficient retint path remain intact.
- Existing opt-in Windline is still the later-approved bracer-fired tether/manual pull. No new lance/banner, rig, physics, shared geometry, save fields, dependency installation, renderer migration or production wardrobe rollout. P1 source is limited to rider construction/material selection, debug routing and browser proof tooling.
- Final source regression: **109 files / 1,138 tests passed**; focused rider/mounted/traversal presentation/UI/save set also passed **12 files / 110 tests** before the last shoulder fit correction; final complete suite includes it. TypeScript passed; production build passed. Production smoke **15/15 passed**. No fixture/tolerance/physics changes to satisfy checks.
- Final production browser proof: **43 checks passed, 34 engine captures, no page/console/game errors**. Includes Stable preview/Revert/Apply/reload, 12 dye changes, 24 shape combinations, real Windline cast/attach/release and player takeoff/landing/dismount. Installed Edge/SwiftShader with isolated storage; no normal user save/profile. [Final gallery](rider-c02/evidence/index.html) and [manifest](rider-c02/evidence/manifest.json) preserve evidence. Final Medium/High renders retain readable pale body cloth after the proof-only highlight cap. Production smoke preceded the last proof-only corrections; final full tests/build/browser proof cover those corrections.
- Known limits: development art remains simpler than approved paintings; uniform world-space texel density and dynamic-sheet material matching are unfinished; normal detail is intentionally subtle. No integrated-GPU timing, physical-controller test, exhaustive accessory/breed/slope/wing-sweep clearance or production art signoff. Software browser evidence is not hardware-performance certification.
- Local dependencies: this worktree's `node_modules` junction reuses the existing Windows Codex installation; no packages installed. A cloud clone uses the checked-in lockfile and the ordinary setup in the cloud handoff. Test commands and preview queries are in the proof report.
- Review packaging: approved concepts/brief/record and final engine gallery accompany this worktree. A full tracked/non-ignored source/evidence ZIP is preserved locally beside the original review under `C:/Users/Robert/.codex/visualizations/2026/10/11/01a12849-3937-7751-9312-e47a7490a343/rider-review/p1-checkpoint-<UTC>.zip`. Its adjacent `P1_BACKUP_VERIFICATION.json` records filename, SHA-256 and independently verified ZIP-entry count. No dependency tree, build output or Git metadata is included. This new P1 checkpoint is not yet remote/cloud-accessible.
- Next action: owner visual/playtest review and target-hardware measurement. Do not interpret this P1 approval as authority for catalog/default rollout, new save fields, wider wardrobe/cast, renderer migration or deployment. Commit/push/merge of this new proof needs appropriate authorization; do not merge unreviewed work into main.
## Latest: Robert approved neutral dot and deferred hit prediction — 2026-10-11 UTC

- Exactebe0496 fullChromium141 CI38154344579 still fails unchanged45Hz moving-UI gate:15 samples/2.002s/7.492Hz, median16ms/p951167.5ms, visible0 submissions/0 forecasts/.006667ms dot update with real yaw/steering/fall. Full3D11/11 samples pass, priorGLfinish.1ms, neutral480/0 queries/.015833ms/fresh native first/newsolid24214/range/retained swing7.2ms and unit/type/build/smoke/normal/controller pass. Editor38154344564 passes; integrationartifact11708381472/editor11708530789 preserved. Browser mode alone is insufficient. A fixed500ms pause plusGLfinish does not establish compositor transition; harness now crosses exactlyTWO native RAF boundaries after switching to UI-only BEFORE existing500ms settling and unchanged2s timing. Startup callback poses/times/blue/null/visible/0-query/0-submit truth are preserved and asserted separately, with bounded120s transition; no rate-based waiting, discarded failing measurement, threshold/CPU/workflow/source change. Reports first measured callback delay. New exact-head CI must prove or refute startup-tail hypothesis; do not merge failedheads.

- Exactda3bc0f CI38153358850 retains prior unit/type/build/smoke/normal/controller/neutral actual-cast success:480/0 queries/.005417ms, newsolid24214, retained swing6.4ms p95 and all actual captures. Full3D samples12/13 remain; timed UI is visible,0 renderer submissions/0 forecasts/0 render CPU but only2 RAF callbacks/3.102s. Explicit WebGL finish took.1ms and did NOT resolve starvation, so queued-WebGL drain is not an established root cause. Later combined gates never run; failureartifact11707149743 and editorpassartifact11707328667 preserved. Source inspection reveals browser-mode mismatch: Playwright defaults to separate chromium-headless-shell when no channel/path is supplied, while local CHROMIUM_PATH uses full Chromium headless. RAF-only launch now explicitly selects channelchromium (documented full/new headless https://playwright.dev/docs/browsers#chromium-new-headless-mode), records exact browser/version/path, keeps the same scenarios/native Game RAF/SwiftShader/canvas/screenshots and EVERY sample/45Hz/2.5ms/motion/zero-query assertion. This is a concrete environment-alignment hypothesis requiring exact full CI, not a gate relaxation or claimed proven root cause. No runtime/workflow changes or merge on failedda.

- Exactb0b3bd6 CI38152126100 again passes1193 units/type/build/smoke/normal/controller, all10 rendered captures, neutral480/0 queries/.004375ms mean, fresh Q/RT/newsolid24214/range and retained swing8.4ms p95. Full3D RAF now collects12 stationary samples/17.969s and13 falling/23.073s, proving the bounded collection preserves the >10 requirement. Painted-UI fails with only1 sample across5.966s after nominal500ms settling; no later combined gates run. Artifact11707681058 preserves this failure; separate editorCI38152126099 passes/artifact11707785146. A fixed pause does not establish GPU completion. Harness follow-up explicitly calls WebGL finish for prior submitted full3D work BEFORE resetting the unchanged2s UI timing window, records drain duration/context/visibility/render-frame and bounds the drain120s. This tests the queued-GPU-work hypothesis without calling it an established root cause. Full3D remains submitted/slow rates disclosed; >10/45Hz/2.5ms/native-motion/zero-query assertions and runtime/workflow remain unchanged. Full new-head CI required; no merge on failedb0.

- Robert explicitly approved merging the reticle change once proper checks complete. Independent final review found no source/workflow/CPU-gate changes in the capture/first-solid follow-ups and no review blocker. Do not merge until full exact-head CI succeeds; exclude PR9 assets/harness pilot/ship gameplay/replacement character and verify the existing Pages workflow separately.
- Exact head2437a24 CI38151000035 passes1193 units/type/build/smoke15/normal/controller and the full neutral reticle check:480 updates/0 queries/.02146ms mean, Q/RT fresh physical impact, newly insertedsolid-24214 first-hit and actual attachment, range and retained swing8ms p95. All10 actual rendered captures complete. It then fails the full SwiftShader RAF phase's >10-frame sample requirement because a fixed4s window contains only1 submitted frame. Subsequent RAF/combined gates did not run. Artifact11705694642 preserves the failure; separate editorCI38151000075 passes, artifact11706604860. Follow-up keeps >10 full3D samples and all CPU/45Hz painted-UI/native-input/physics assertions, collects full3D for at least4s until sample requirement with bounded120s deadline, and reports the actual elapsed rate. No runtime/source or CPU threshold change; final new-head CI still required.

- Raw local evidence review caught an insufficient newly inserted thin-solid assertion: the original thin plane was parallel to near-vertical aim and the returned hit remained the old island. That result did not prove new-solid interception. The fixture now crosses the ray's dominant axis, retains a stable collider array/identity and requires the camera first hit AND actual physical attachment/impact to match the newly inserted solid-ID. This strengthens actual-cast freshness proof without runtime changes; prior thin-fixture claims are superseded. Other neutral/cast/range/swing results remain separately valid.

- Independent review requested diagnosis of the actual screenshot/readiness timeout rather than assuming runtime failure or harmless flake. Harness now records each capture name/viewport/time, ready/screen/device/fonts/canvas dimensions/context-loss/render-frame/draw calls before capture, and bounded post-failure readiness plus pending requests/page errors. Diagnostics remain outside presentation CPU measurements and preserve actual3D screenshots, behavioral assertions and the bounded120s capture limit. Exact follow-up CI must establish success or expose the concrete failure phase; no unverified cause claim.

- First exact neutral sourcecb9c4e2/treebde6b23: units1193/type/build/smoke15/normal/controller pass inCI38149380263, then screenshot capture times out under Playwright default30s before the neutral CPU test. Artifact11705614044 preserves that failure. Separate editorCI38149380055 passes, artifact11705239985. Clean local full reticle/RAF/normal/flow/editor/audio42/24scene/HUD40/24/performance/Windhaven/SkyLancefull/motion/control/input/four720step retention all pass, with0 prediction queries and actual Q/RT impact errors below.00002m. This follow-up gives rendered screenshots a bounded120s allowance (existing shot tooling uses180s); it changes no runtime or gameplay/CPU assertion and requires exact new-head CI before certification. No harmless-timeout or green-CI claim until actual verification. Maina7adb45 unchanged; no merge/deploy.

- Robert resolved the design tradeoff: hold only the predictive hit indicator, use a simple fixed aiming reticle. Parent authorized simplification of PR5, preserving faster casts, controller-first freefall/swing/boost/HUD, actual fresh centred Q/RT collision/range, weighty dragon flight, editor/audio and ship/model exclusions. PR5 stays draft; no merge/deploy authority.
- Preserved failed predictive source9f28427 remotely/local atpreserve/windline-prediction-9f28427 and its evidence/report refs. Dedicated simplification branchsimplify/windline-neutral-reticle starts from9f28427 with current released maina7adb45 already ancestral; independent PR9 remains untouched.
- Normal SkyLanceVisuals now draws only the fixed#a8ddec aiming dot, target-null, without any geometry/anchor query. Normal HUD removes the validity ring/label. Actual press still invokes centred physical solve, then original projectile/tether validation. Isolated SkyLance study explicitly opts into bounded predictive feedback; no normal gameplay prediction. Restored IslandShape and TraversalWorld collision to released main (only primitive revision accessor retained), removed experimental underside interval/cache code and prediction-only runners, retained all released sustained-swing and approved flow changes.
- New neutral semantics replace predictive UI assertions under explicit user approval. Actual collision/range/first-solid/obstruction/exhaustion/retention/swing tests and CPU gates remain. Browser checks require zero idle/moving prediction, keyboard/controller viewport alignment, pause/HUD/mount lifecycle, actual fresh native Q/RT impacts/new blockers/range, native above-deadzone RAF and full combined editor/audio/HUD/prototypes. SeeWINDLINE_NEUTRAL_RETICLE_2026-10-11.md. Focused51 and full1193/111files/typecheck/build pass. Preliminary dirty-candidate browser checks pass480 zero-query updates,8 keyboard/controller viewport alignments, first-visible lifecycle, actual Q/RT impacts/new thin first-solid/range, sustained swing2.1ms p95, normal/save/reload/controller/boost/recall flow and native0.22 RAF115 blue frames/57.357callbacks/sec/.012ms dot update/zero forecasts. Body-collision sweeps are explicitly counted separately. Exact clean source/build/combined/browser/CI results must still be reported before release recommendation; preliminary9f build stamps are not falsely treated as new source identity.
- Historical predictive performance sections below describe preserved superseded experiments, not instructions to restore green forecasting or experimental geometry. No merge, new progression, ship gameplay, updated character, engine rewrite or unrelated edits authorized.

## Latest: single approved exact-domain interval sharing attempt — 2026-10-11 UTC

- Parent/reviewer authorized exactly one bounded same-contract optimization after diagnostic CI38144909352: share owned central and lazy +/-1.5 m analytic stencil interval snapshots across radii for identical immutable definition and exact coarse/fine domain. PR5 remains draft; no merge/deploy authority, ship gameplay or updated character work. Released editor/audio/static dock/prototypes/art/reference assets remain preserved.
- Diagnostic head0064d04 passed the original100-query gate narrowly at2.499 ms, but the stronger complete18/45/55 m profile failed at4.594/3.353/1.328 ms. All240 reference pairs were exact. Subsequent cold/RAF/editor/audio/HUD/prototype gates did not run; separate editorCI38144909353 passed. Integration artifact11704278625 and editor artifact11704810790 remain the source of exact CI evidence; local report branchqa/windline-ci-diagnostic-0064d04 preserves the console-derived numeric report5c8a74e.
- Candidate changes only radius-independent bound reuse: copied numeric tuples (never scratch aliases), validated original definition and Object.is exact box, separate coarse/fine namespace, lazy stencil slots, independently bounded16384-domain FIFO cleared with the unchanged16384-radius-floor FIFO. Radius-specific equations, rounding, contact lattice/radii/bisection/exhaustion, fallback, coarse/fine intersection and fresh primitives remain unchanged. No target/eligibility cache or new geometry representation.
- Added ownership/cross-radius/definition/exact-domain/signed-zero tests and extended original full-sweep revision/seam/eviction parity. Diagnostic/profile rows expose interval reuse counters outside timed query collection; both2.5 ms acceptance gates and all original oracle/native RAF/editor/audio/HUD/prototype checks are unchanged. Exact source head and CI result belong in PR5; no provisional local result substitutes for CI.
- If this single candidate fails exact CI, stop and request the concrete broader geometry-acceleration versus deferral decision. No indefinite tuning, gate reduction or inferred release authorization.

## Latest: evidence published and bounded CI diagnostic — 2026-10-11 UTC

- Robert believed he clicked allow and wanted to test. The same blocked GitHub create-blob action was retried once through the supported tool and succeeded with expected SHA321a7cbe; no approval was inferred from elapsed time. Evidence published asfdc80613f9ef20fadde83095605ef926fac047f3, tree0334ad7bfeddada424a03795c3013fca04b8029b exactly equals preserved local8ae3459. Raw reports retain true tested0fcc709 identity. PR5 stays draft/unmerged/undeployed; released maina7adb45 unchanged. No character/ship work.
- Parent authorized the recommended diagnostic-only CI replay. Initial pose metadata is collected outside the retained baseline timer, with no new query before it. After the original100-query measurement completes, a separate100-pose replay records centre/projectile/tether sweep costs, nested rock-contact/primitive lookup costs/counts, full-query/non-sweep residual, certificate hits/misses/tightening and all poses/targets. Offline original-oracle replay checks100 pairs and the certificate sequence must match baseline. Diagnostic timing includes instrumentation overhead and never replaces, contributes to or prewarms the unchanged2.5 ms baseline gate. No runtime/source collision optimization.
- Node syntax checks and actual local browser harness passed parity/first-visible/physical cast/long retained swing. Local check targeted the saved0fcc709 production build with a dirty diagnostic runner; it does not supersede real CI failure3.603 ms/query or72 zero-miss2.921 ms. Exact new diagnostic head/run/results must be reported. All old CPU/collision/HUD/prototype assertions remain, and later stages still stop if the original CPU gate fails.
- Next authorized action: publish this bounded script/documentation change to PR5, run exact-head CI, use actual CI stage breakdown to report a concrete next choice. Do not merge/deploy or continue indefinite local-only tuning. Preserve separate evidence8ae branch and editor/audio release/reference/prototype assets.

## Latest: exact CI CPU failure and publication hold — 2026-10-11 UTC

- Source head0fcc709 remains remote draft PR5, unmerged/undeployed. CI38132398541 fails actual100 complete queries at3.603 ms/query; first37.6 ms/351 misses, all100 green/no checking, immediate blocker clearing passes. Even72 zero-miss/zero-tightening rows average2.921 ms with~381 certificate hits/query. Local Chromium154 pass does not supersede CI Chromium141. Parent/reviewer found source/visibility/certificate fixes sound, but CPU remains a real blocker.
- CI passes1209 units/type/build/smoke15/normal/controller before stopping; later complete profiles/RAF/editor/audio/HUD/prototypes do not run. Separate exact-head editorCI38132398548 succeeds all three cycles, artifact11699767695. Integration failure artifact11700185826 preserves raw evidence. Released maina7adb45 and Pages38128620191 unchanged.
- Raw clean local profile/RAF/lifecycle/editor reports, exact CI100 numeric rows and manifest are prepared as a local documentation-only evidence commit under docs/qa. Parent delivered the pending GitHub create-blob approval request; publication was stopped, no evidence commit/ref was published, and that gate must not be bypassed. Some unattached blob objects completed before interruption. Do not repeat the permission request or infer approval from elapsed time.
- Next recommendation: one diagnostic-only exact-CI100-pose pass retaining the uninstrumented2.5 ms gate, with separately replayed centre/projectile/tether layer costs, rock-contact/primitive counts, geometry lookup/miss construction and non-sweep residual; original-oracle parity after timing. Steady state already exceeds budget, so cache capacity/prewarming is insufficient. At most one measured same-contract hot-path optimization after identifying the bottleneck; otherwise escalate the concrete representation/interaction choice. Stop indefinite local-only tuning. No source work or release authorized by this recommendation.

## Latest: clean reticle evidence publication — 2026-10-11 UTC

- Clean source head `0fcc7091a38dad486b391da945df63076e730d16`, tree `d6ab5d1f46cdc667c16f1311afe5867c83438fab`, passed 1,209 tests/112 files, typecheck/build, actual first-unhide pause/HUD/leap, cold-start 100 complete queries, both complete-query profiles, native high-refresh RAF/oracle parity and three editor lifecycle/save-isolation cycles. Full editor/audio runtime equals released main a7adb45. Keep PR5 draft/unmerged/undeployed; no release authority.
- Actual raw JSON and SHA-256 manifest are committed under `docs/qa/windline-reticle-0fcc709-*`; see `docs/qa/WINDLINE_RETICLE_0FCC709.md`. Evidence-only changes preserve runtime/test source. Each capture retains the true tested head and clean runner identity, rather than pretending it tested the subsequent documentation commit. Exact-final-head CI is independently required and linked in PR5.
- Gentle complete means 0.644/1.270/0.681 ms; stronger 2.201/1.727/2.361 ms at18/45/55 m; 240 exact pairs per profile. First construction/misses included, zero excluded warmups. Cold-every-query18 m mean3.159 ms remains disclosed, not accepted as normal budget proof.
- Native standard-pad0.22 RAF:120/120 green frames,59.955 callbacks/sec,0 checking/transitions,0.636 ms/query; yaw0.024923 rad/horizontal0.160046 m/fall23.905433 m. All162 captured poses replay exactly through original full oracle. Painted-UI phase suppresses3D after500 ms settling; full SwiftShader3D is4.49/5.99 callbacks/sec. No physical device or GPU claim.
- Source CI38132398541 and editor38132398548 were still running at evidence publication. Prior dc8d CPU5.296 and editor180-second boot failures are preserved in history. Exact final checks and any current blocker must be reported, with no merge/deployment inferred from green CI. Preserve ship prototype/static dock/model work and shared reference/art docs.

## Latest: reticle review corrections and adaptive proof — 2026-10-11 UTC

- Draft PR #5 head dc8d0a4 failed CI38130760517's real 100 complete queries: 529.6 ms / 100 = 5.296 ms/query, all green, no checking. Later profile/RAF/editor/audio/HUD/prototype gates did not run. Editor CI38130760546 separately timed out at the 180-second sandbox boot wait. Main/editor/audio release a7adb45 and Pages38128620191 remain preserved; no PR5 merge/deployment authority.
- Narrow fix: update reticle after UI visibility decisions and before rendering; hidden feedback clears target/green/pending preview. First-visible normal-Game pause/resume, HUD hide/show and mounted leap regressions now require fresh blocked/out-of-range results. Both hidden levels and fast/fallback adapters are covered in unit tests.
- Geometry certificates retain coarse 4 cm cells and refine ambiguous near-contact domains to 1 cm using the same enclosing analytic proof, within the same shared 16,384 FIFO. Original candidate/contact/lattice/radius/bisection/exhaustion contracts remain unchanged. Added cold/hot/reversed/interrupted fine-seam contact parity.
- Native RAF proof uses alternating 0.22 standard-pad axes with measured yaw/steering/fall spans; the previous 0.08 axes were below deadzone and did not demonstrate native stick motion. Raw complete query rows and RAF frames, including misses/first queries/render mode, will be committed in docs/qa with clean tested identity. Exact-head CI still must pass; local improvements do not supersede the real CI failure.
- Editor runtime stays unchanged. Harness failure diagnostics now print sandbox state/boot text. No physical device/controller/GPU, subjective listening, live served-byte, ship/model or new art certification claim. Keep draft and report actual evidence/blockers to parent.

## Latest: approved deeper reticle candidate — 2026-10-11 UTC

- Robert approved another focused performance pass on draft PR #5, retaining truthful current-pose eligibility, centred physical casting/range/collision and CPU budgets. No PR #5 merge or deployment authority. Updated character and ship gameplay remain excluded; static dock and isolated prototypes remain preserved.
- Implemented bounded immutable analytic 4 cm geometry certificates with definition/radius validation, original logical sweep/exhaustion accounting and original contact/bisection. Tightened the installed simplex gradient bound through a whole-domain operator-norm interval proof; includes existing seeded island deformations and allocation reuse. Full current centred ray/projectile/tether forecast runs every visible normal ready render. Unknown slower adapters keep bounded truthful fallback.
- Source/API commit `d6289b70238672627242e058e449818e501abcbc`, verified tree `ba404f6fa97ee645c6968d5677f984dd24df4e4c`. Main `a7adb45c28dd252091b8c10e13ea357067071061` is integrated in isolated `/workspace/Driftwing-reticle-combined`, branch `wip/windline-reticle-combined`; original worktrees remain untouched. Both handoff histories retained; main's editor/audio implementation and documentation PNG blob identities preserved.
- Focused source tests 43/43 passed; combined full unit suite 1,200/1,200 across 112 files and source build passed. Combined production smoke 15/15, normal save/reload/interrupted/controller flow, three editor lifecycle/save-isolation cycles and the approved source-server audio mixer/cue harness passed before publication. The settled painted-UI proof reached 59.43 callbacks/sec with 119/119 green moving frames, no checking/transitions and exact original-query replay parity. The audio harness requires Vite source serving for its offline helper; static-production audio runtime checks passed through repeated actions before that unavailable-helper import. Two dirty stronger complete-query runs passed mean <=2.5 ms at 18/45/55 m with all 240 eligible pairs matching exactly, first query/misses included. Per-render browser flow passed 100 fresh green poses, immediate new-blocker clearing, exact physical RT impact, 120 fresh moving ready frames and retained/released swing. Final combined full/head/CI checks remain pending and must be reported precisely; these preliminary values are not final-head certification.
- See `WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md` for derivation, required regressions, first-query/p95/max/cold diagnostics, RAF proof and limits. Actual high-refresh UI proof separately suppresses 3D submission, explicitly settles prior software rendering and replays every measured pose against the original oracle. No physical GPU/controller/iPhone or subjective listening claim.
- Environment limit: shell Git auth was lost on restart. Authorized connector Git objects are hash-verified; this separate checkout excludes only four main editor documentation PNGs via sparse patterns, preserving their original tree identities. Full checkout occurs in CI. Direct live host remains CONNECT403. No image was replaced/synthesized.
- First combined head `8cb4fe19d2c311b385fe8ef837d527e681dd063a` / tree `c54c85ab0793a64e76ccba7d86733ca048ef6794` passed clean local full1200/build and complete-query gates. CI38130357803 passed1199 tests but the new long-path FIFO stress test hit its30-second timeout. The follow-up retains the real16384-cell limit and exact reference parity, filling it with16500 short empty sweeps after96 contact-boundary paths; no runtime/collision or CPU assertion changes. Clean8cb stronger means were1.322/1.486/1.545 ms at18/45/55m, all240 pairs eligible and exact, first query included. Subsequent final-head CI must pass before declaring the candidate verified.
- Next authorized action: finish combined editor/audio/normal/prototype/unit/build/smoke checks, publish exact reviewed candidate to draft PR #5, monitor exact-head CI and report evidence. Keep PR #5 draft/unmerged/undeployed pending explicit review/release authorization.

## Latest: bounded underside sweep spike — 2026-10-11 07:43 UTC

- Parent authorized a bounded query-local analytic empty-space optimization experiment on draft PR #5. Main remains repair release `bc86843a494c64bed347ca6cdca7c52e3ef1ee66`; no merge/deploy authority. Audio PR #7, character work and separate editor foundations remain isolated.
- Authored underside intervals enclose height plus the original finite-difference contact-plane envelope and inflated probe. Original lattice/order/candidates/bisection/radii/logical fail-closed budget remain intact. Unsupported geometry uses the complete reference path. Candidate is disabled by default; no per-render changed-pose forecasting or relaxed green semantics.
- Preliminary paired moving-pose complete queries: candidate means 2.583 / 2.627 / 2.466 ms at 18 / 45 / 55 m; the <=2.5 ms gate fails. No caching/checking calls averaged. Target states, anchor, distance and impact matched on all 240 pairs. This dirty-build exploration is superseded by exact-head CI artifacts and PR metadata, not claimed as final certification.
- See `docs/WINDLINE_SWEEP_SPIKE_2026-10-11.md` for mathematical justification, fallback scope, regression coverage, full mean/p95/max/query counts and limitations. New parity/plane tests and all existing CPU/collision/HUD/prototype assertions are retained. Exact-head CI runs the full paired profile and uploads raw JSON.
- Next authorized action: finish exact-head CI/evidence and report the bounded failure. Further significant optimization or a new representation needs a new decision. High-refresh cue pulsing remains an unresolved release blocker. No physical GPU/controller/iPhone claim.

## Latest: draft enhancement underside-cue follow-up — 2026-10-11 06:44 UTC

- Released repair main is `bc86843`; PR #5 remains draft, with no merge/deploy authorized. PR #7 audio, ship gameplay, updated character and RPG/editor implementation remain excluded. `git diff origin/main...HEAD` contains the enhancement changes only; the reviewed repair is already a common ancestor.
- PR #5 CI `38115478811` passed correctness/CPU/HUD gates then failed the prototype underside range cue. Reproduction proves its original view hits an earlier ledge 1.542 m off the centre ray on the same island. Blue is truthful; another interpolation step does not fix that obstruction.
- The prototype regression now requires that original obstructed case to stay blue, then deliberately faces a clear surface for the original green, exact physical attachment and retention checks. A real-island unit regression rejects same-anchor/off-ray eligibility. No runtime contract/budget changes. Focused 42 tests, typecheck and control browser checks passed before commit.
- Next: build the committed head, capture actual rendered moving-cue cadence/usability evidence, and complete full exact-head CI. Continuous-motion green pulses remain an explicit interaction concern. Preserve conservative freshness; do not infer release approval from green CI.

## Latest: approved editor release and audio integration — 2026-10-11 UTC

- Robert approved editor and audio release; the separate reticle task remains unmerged. Serialized release coordination starts from main `bc86843a494c64bed347ca6cdca7c52e3ef1ee66`. No PR #5 merge, ship/model changes or broader gameplay work is authorized by this entry.
- Reviewed editor head `6dd789435c9a3f40ccd834265f94e935bf1854b4` passed editor CI38124353870 and integration CI38124353868. PR #8 merged first as `59c774501992f6320f66fd939637bb3113fd8834`; its tree equals the reviewed editor tree. Pages run38126694519 passed build and deploy. Local merge-head production build, ordinary smoke15/15 and three-cycle editor workflow passed, including repeated activation, save/load and player-save/ghost isolation.
- Gameplay URL: `https://rporter33.github.io/Driftwing/`; editor: `https://rporter33.github.io/Driftwing/editor.html`. Live-host requests remain blocked by proxy403, including after editor deployment. Workflow/build verification does not certify actual served bytes or a live browser visit; no denial workaround was attempted.
- Reviewed audio head `a67d30a936a50642d7607ad472818feec537665e` passed its original CI38111460683. The commit introducing this entry integrates that candidate with released editor main before a fresh combined review gate. The only conflict was the appended HUD-repair/audio handoff sections; both are retained. Audio runtime and QA source remain identical to the approved audio candidate; editor, Game/Player/input/HUD/reticle/collision/model source remains identical to editor main.
- The editor verification trigger now includes `src/audio/**`, because sandbox gameplay imports the shared audio system. Existing integration and Pages deployment workflows remain unchanged. Combined checks must cover full unit/build, normal production play, editor lifecycle/save isolation, audio mixer/cues and exact-head GitHub checks before PR #7 merge and the second release.
- Exact candidate head, checks, audio merge SHA and second deployment result belong in PR #7 and the final release report. Local QA uses isolated `/workspace/Driftwing-Release-20261011`; other worktrees are untouched. Physical device, native Safari/Firefox and perceptual mix limits remain distinct from software signal tests. Historical instructions below describe earlier approvals/status and do not override Robert's current explicit release authorization.

## Latest: bounded region authoring foundation — 2026-10-11 UTC

- Objective authorized after historical research: implement a new island/curated-prop/race authoring foundation, push a separate branch and open a draft PR; no merge or deployment. This is not recovered Claude code. Available published histories yielded no editor entrypoint; the release's Windows/Ubuntu bundles and original source archives remain missing from this investigation because authenticated binary release downloads returned Forbidden.
- Branch `feat/region-editor-foundation` in isolated `/workspace/Driftwing-Editor`, based on current main `bc86843a494c64bed347ca6cdca7c52e3ef1ee66`. The commit introducing this section is the implementation head; the draft PR and browser report record the exact head tested. The original cloud checkout and PR #5 worktree were not edited.
- Staged plan was shared before coding: bounded region document/editor; additive sandbox preserving home/shrine/dock and memory-only progress; browser/normal-game verification and rendered review. Puzzle authoring remains the next separately reviewed stage. No movement/reticle, ship, character, RPG, multiplayer or dependency changes.
- Added `/editor.html`: three island presets and analytic parameters, terrain-attached curated column/terrace/crate placement, translate gizmos, race start/ordered checkpoints, 60-step undo/redo, schema/clearance validation, independent browser save/load and portable JSON. `/editor-playtest.html` uses existing game/controllers with authored islands appended 8 km away, canonical dressing retained and injected memory progress/ghosts. Return destroys the iframe and retains editor history. Shared changes are limited to opt-in Game/World constructor parameters and Vite entrypoints.
- Pre-commit verification: focused authoring suite 17/17; full suite 1,162/1,162 before the additional starter-flight test; typecheck/production build; ordinary production smoke 15/15; three browser edit/undo/save/load/playtest/return cycles with actual gizmo, manual placement, checkpoint ordering, validation, import/export and unchanged player-save sentinel / zero player-storage or ghost-database access. Final committed-head checks and PR #5 dry-merge compatibility results belong in the draft PR, not an inferred completion claim here.
- [Usage, format, caps and storage](REGION_EDITOR.md), [rendered comparison and per-category limits](REGION_EDITOR_ART_REVIEW.md), and `.github/workflows/editor-verify.yml` provide reproducible checks and evidence. Small palette has partial architectural/palette agreement; owner visual/workflow review is pending. Existing rider/dragon/environment art remains unverified. Desktop mouse/keyboard, software Chromium; no physical GPU/controller, touch, large-region or exhaustive pose/placement certification.
- Independent review follow-up: real repeated Enter keydown during a delayed sandbox response created three iframes; pointer double-click created one. Playtest now guards the existing iframe and disables its button until Return, including cleanup on setup failure. Browser regression repeats both native activation paths, requires exactly one iframe, and confirms Return removes it and re-enables Playtest. This follow-up does not change committed review PNG bytes.
- Initial editor CI (run 38123545570, head 846b7f7) failed on the final `page.reload()` waiting for `load` under Playwright's implicit 30-second limit, before the existing 120-second app-ready check could run. The harness now waits explicitly for DOM readiness and two rendered editor frames under that bounded allowance, retains exact region/sentinel/storage/database assertions, and records reload timings plus failure phase/readiness/pending requests. This is a harness hypothesis requiring the exact-head CI rerun, not a claim that the prior timeout was harmless. CI Chromium 141 could not be installed locally: the browser CDN returned 403 Domain forbidden; local lifecycle evidence uses Chromium 154.
- Next authorized action: finish exact-head verification, commit/push and open the draft PR for meaningful owner workflow/art review. Do not merge, deploy or expand into puzzle systems from this handoff alone.

## Latest: reviewed cloud consolidation — 2026-10-11 UTC

- Owner authorized backups, coherent commits, pushes, routine conflict resolution, reviewed PR merge and cloud handoff. Integration branch `integ/cloud-20261011` began at verified GitHub main `844e5c25860aab4c596116df4ffb19fa4e98fd1e`. Original Windows source/worktrees were not edited. No reset, clean, stash, force-push or branch deletion.
- [Cloud handoff](CLOUD_HANDOFF_2026-10-11.md) contains exact setup/start/check commands, original checkout inventory, recovery refs, durable asset access, current feature boundaries and excluded experiments. [Integration PR #3](https://github.com/rporter33/Driftwing/pull/3) carries the final review and GitHub check results. Use the final main SHA in the owner's completion report; cloud checkouts do not update automatically.
- Integrated reviewed `feat/windhaven` (`59dc52c`): smooth hull with matching convex collision, open windows, four terrace hitch sockets, fixed-step visual sail cloth and usable deck. Still a stationary `?view=windhaven` study, with no travel/crafting/stable/hitch occupancy implementation.
- Committed formerly dirty `exp/sky-lance-v1` as `0bb2498eecb5ea3c49ef4599e3078da77c103198` and preserved it remotely. Integrated the opt-in `?view=skyLance&play=1` prototype: bracer-fired line, deliberate manual pull, momentum release, freefall steering, 1.75-second boost recharge/HUD, deliberate recall/remount and obstruction retention. No automatic pulling, moving anchors, wrapping, wardrobe or default-game progression unlock. The owner's later bracer/manual-pull requests explicitly supersede the older concept's thrown-lance/no-powered-pull contract in this experiment.
- Integrated complete art pack/reference branches, Windline concepts, M1 planning brief, development resource directory and reconciled shared art instructions. Historical instructions/status snapshots remain context. Both sides of handoff conflicts retained. Existing title music/tutorial/rider corrections remain; no new M1 milestone is declared complete.
- All five checkouts have verified source/evidence archives, original indexes, staged/unstaged patches and both complete-history Git bundles at `/home/robert/Projects/Driftwing-Preservation/cloud-consolidation-20261011T000747Z`. No staged changes existed. Windows CRLF differences are preserved, not treated as hundreds of real edits. Source hashes remained stable across inventory and preservation checks despite open Codex/server processes.
- Feature and `recovery/cloud-20261011/*` branches are pushed. Private [draft recovery release](https://github.com/rporter33/Driftwing/releases/tag/untagged-69aca8c9ffa5c937a75d), tag `cloud-recovery-20261011`, stores the sanitized 148,466,452-byte recovery archive, latest historical captures and supplied Windhaven concept. Independently downloaded archive checksum and all 2,088 file hashes verified. Machine-local `.claude/settings.local.json` preserved locally only; no secrets, dependency trees, caches or build output uploaded.
- Fresh combined verification: focused 282/282 across 21 files; full 1,129/1,129 across 108 files; typecheck; production build; production smoke 15/15. New combined-feature tests cover curved-hull attachment/clearance and moved/replaced anchor invalidation. All 31 supplied art-manifest checksums verified. No dragon-flight/breed, renderer, dependency, deployment-workflow, golden-fixture or tolerance changes.
- Browser checks cover Windhaven deterministic/live four-breed walking, mount/dismount, launch, pause/reset/reload; Windline real unpowered route landing, release momentum, freefall/boost/HUD, near-vertical aim, static wall/underside eligibility, actual DOM input and simulated-controller recall/pull, and four 720-step line-retention trials. Existing capture tooling/manifest retained. Software WebGL and simulated pad evidence do not certify physical GPU/controller behavior or owner visual approval.
- Verification found a pre-existing stale SkyLance route fixture: the unchanged isolated branch also failed its 140-step release/20–160-step search. The current 75 m/s launcher lands unpowered at a measured 180-step release, at `[0.05375,400,-51.98366]`. The harness now includes that release and asserts the line survives until release; all actual landing, camera, momentum and clearance criteria/tolerances stay unchanged. No physics change was made to satisfy it.
- Initial GitHub CI timed out at Windhaven's live takeoff. An isolated controlled keyboard probe confirmed a down/up tap on a rendered frame with no fixed step does not start launch (`landed`, timer -1), while held Space launches and climbs (`flying`, y 658.042). The live harness now holds the actual key until the same climb criterion is met, then releases in `finally`. This fixes test input timing; buffering brief launch taps in gameplay remains a separate existing limitation. Final GitHub validation must pass before merging.
- The next GitHub run passed all deterministic Windhaven checks but again exhausted the live launch wall-clock allowance. The live harness now matches the existing capture pass's 120-second timeout and records simulation elapsed time plus player/input state on launch failure. Physical thresholds are unchanged; this allowance is not hardware performance approval.
- CPU proxy, drawing disabled: short attached step mean 2.040 ms / max 3.8; moving swing mean 3.185 ms / max 5.3; no browser errors, attached line retained. Long grazing rock queries remain an existing risk; these host timings are not GPU measurements or causal performance-regression evidence.
- Sampled Windhaven screenshot still shows the existing first-discovery tutorial overlay on a fresh save. Original main also contains that offer; no unrelated M1/UI behavior changed. Experimental scene tutorial isolation and exhaustive cloth/wing/hitch clearance remain follow-up work.
- GitHub PR-only validation now runs type/full/build/production smoke and both experimental browser suites before publication, uploads browser evidence, and never deploys the PR branch. Existing main-only Pages workflow remains authoritative. Final review/check status and main commit are recorded by the completion report and PR; no bypass is authorized.
- Next: after passing PR verification and reviewed merge, fetch/check out the reported exact main commit in the cloud, install lockfile dependencies/Chromium and select the intended scene. Older divergent dragon experiments and superseded Windhaven blockout remain remote for separately scoped review. Do not infer new feature authorization from this handoff.


## Latest: Windline targeting, deliberate pull, grounded recall, skydiving and 1.75-second boost — 2026-10-10

- Owner authorized these follow-ups, then specified 1.75-second boost recharge / light-blue bottom-right HUD
  and reported line disconnection during turns. This deliberately supersedes the earlier no-powered-reel
  contract for explicit A/Space pulls only. No automatic pulling, moving anchors or rope wrapping added.
- Workspace `/home/robert/Projects/Driftwing-SkyLance`, branch `exp/sky-lance-v1`, HEAD
  `f3ef231c6a12ed5865cd73562447f6d94a1730bf`; entire pre-existing dirty prototype preserved at `/home/robert/Projects/Driftwing-Preservation/windline-motion-baseline-20261010T233415Z`.
  All 438 archived project files verified by SHA-256. Codex/Claude checkouts were not edited.
- A/Space while tethered requests a 0.4-second pull: 60 m/s² radial acceleration, powered inward speed
  capped at 18 m/s (existing overspeed retained), minimum line 2 m. Reeling follows actual swept inward
  movement; no snap to a shorter radius. Explicit powered work enters the existing energy budget;
  unpowered constraints/energy guard remain. Release clears pull and preserves instantaneous velocity.
  In the production underside trial after 0.3 seconds: line 17.300 → 15.391 m, ascent 12.600 m/s.
  Detached A/Space retains the waist burst and its independent 1.75-second simulation cooldown.
- Reticle position now follows the current ballistic near aim every render frame, independently of
  expensive first-solid prediction (bounded to 20 Hz). Fresh confirmed impact has a separate small dot;
  stale eligibility becomes CHECKING. This avoids jumping the main ring between hit/fallback depths.
  Bracer orbit supports 89° up with exact view pitch and no pole reversal; ordinary/flight limits unchanged.
- Reproduced underside turning disconnect: 8/18/26 m/s trials detached after 504/455/196 fixed steps.
  Camera-only turn stayed attached. A newly blocked line now sweeps back to its preceding clear body
  endpoint, dissipates blocked motion and retains its committed length instead of dropping the rider.
  It may briefly stop at an edge; no wrapping is simulated. Invalid anchors or impossible restoration
  still detach safely. One full LOS check on ordinary steps, two on the exceptional restoration path.
  Final reproduction retains all four trials for 720 steps each. Manual release remains available.
- Ground hold-Y/F now recalls an independently gliding dragon using its actual pose and existing safe
  greeting-landing planner. Transfer occurs only if a landing spot exists. The recalled hop remains airborne
  and blends orientation rather than replaying a supported launch. Four breeds return and can mount;
  existing deliberate midair catch/remount still passes. Existing stable/interactable priority is retained.
- Full forward tucks the rider head-down and brakes horizontal motion toward a vertical dive; back
  spreads the body flat and brakes, with side steering retained. No-input horizontal momentum remains.
  Partial forward still steers. Rider-only descent limits remain 9/13/18 m/s; dragon flight is unchanged.
  Three-build regressions cover head/hip/foot ordering, arm spread, smooth transition and planted resets.
- Bottom-right light-blue boost indicator shows READY, active burst, numeric recharge and progress;
  while linked it identifies the tether-pull action. Hidden during menus/mounted modes; pause freezes time.
  Production checks verify exact 210-tick recharge, 0% → 100% HUD, upward aim, pull/release, ground recall,
  vertical dive/flat brake, actual DOM Q controls and simulated-controller RT/A/Y transitions.
- Baseline focused checks: 161 / 13 passed. Broadened focused checks: 198 / 14 passed before final two
  energy regressions; final full suite includes both and passes 1,092 / 103. Final typecheck/build pass;
  production smoke 15/15 passes. Existing golden fixtures/tolerances unchanged.
- Existing capture harness: nine final 1280×720 captures, six full-dive/brake views across all three
  rider builds, matched steering before/after, upward READY and cooldown HUD. All inspected. These are
  representative pose/UI views, not exhaustive garment intersection proof or a full art-compliance audit.
- Timed production Chromium CPU proxy (drawing disabled): short underside attached mean
  1.823 ms, moving swing 3.115 ms;
  forecast sample mean 3.090 ms. Query counts remain bounded. Earlier pass was 1.597 / 2.688 ms;
  host timing differences do not establish causal cost changes. Long/grazing lines remain a performance
  limitation from the prior pass; no physical-GPU or physical-controller certification claimed.
- Assessment, preservation audit, focused incremental diff, logs and captures: `/home/robert/Projects/Driftwing-Preservation/windline-motion-review-20261011T000025Z`.
  Local play: http://localhost:5176/?view=skyLance&play=1&quality=low — refresh the existing tab.
  No commits, integration, pushes, deployment, dependency changes, M1, wardrobe or dragon-physics work.
  Next: owner playtest/review; no automatic scope expansion.

## Latest: faster Windline, tether CPU correction, six-second boost and companion descent — 2026-10-10

- Owner authorized the reported tether/contact slowdown, faster launcher, reusable six-second boost,
  glide review, and upside-down-looking companion limbs during lower-island arrival. Implemented only
  in `/home/robert/Projects/Driftwing-SkyLance`, `exp/sky-lance-v1`, unchanged HEAD `f3ef231c6a12ed5865cd73562447f6d94a1730bf`.
- Dirty baseline preserved at `/home/robert/Projects/Driftwing-Preservation/tether-performance-baseline-20261010T225153Z`. All 435 archived project files verified by SHA-256;
  tracked, untracked and relevant ignored files included, excluding .git/node_modules/generated dist.
- Launcher speed 42 → 75 m/s; immediate existing Q/RT interaction, 65 m default range and swept first-solid
  contacts retained. Legacy unexposed charged speed becomes 90 m/s so it cannot be slower than tap fire.
- Boost now recharges six seconds after activation on the fixed simulation clock, including airborne,
  tethered and mounted modes. Pause freezes it; landing/mounting/saddle jumps stop thrust without refilling.
  Explicit teleport/respawn/practice reset clears it. Existing upward/horizontal impulse and rope prohibition retained.
  Practice UI shows the remaining cooldown. Freefall speed/steering/camera tuning unchanged after review.
- Confirmed CPU bottleneck: two full 1 cm rope sweeps per fixed tick beneath procedural rock. Retain immediate
  new-attachment validation and pre-dispatch static identity checks; steady ropes check obstruction once,
  after collision-resolved movement, within the same tick. A newly occluded line can receive that tick's
  constraint reaction before detachment (at most one 1/120 s step); removed/moved identities detach before dispatch.
- Rock sweeps clip their original lattice against enclosing solid AABBs. Exact query-local vertical column
  reuse and conservative finite-difference normal rejection avoid repeated procedural height work. The island
  surface equations, first-solid ordering, slack/locked length, swept body corrections and release operation remain.
  An exploratory inflated-contact-sphere accelerator failed a retained dense-reference regression and was removed.
- Companion hops cap descending pitch at 0.55 rad and level before arrival; steep descent prepares limbs through
  the existing flare channel. Hop feet remain airborne until actual supported settling. Player advances the existing
  touchdown id on companion arrival so feet replant on the destination. Rescue swoop orientation/flight tuning unchanged.
- Final verification: focused 186 / 15 passed; full 1,075 / 103 passed; typecheck/build passed; production smoke
  15/15. Dense sweep reference and original island-contact equations agree across seeded/all-island samples;
  field-evaluation budgets and cache expiry pass; all four breeds pass descent/ground contact checks.
  Fixed-step render-rate tests include cooldown. No golden fixtures or tolerances changed.
- Production browser confirms airborne recharge (+11.846 m/s launch; 3.940 m gain), pause clock, steering/manual
  camera, READY/actual underside/pillar attachment, held-rescue blocking and release; actual keyboard and simulated
  standard gamepad cast/boost/dismount/rescue/remount pass. Physical controller testing remains pending.
- Timed CPU proxy (one fixed tick plus normal frame updates, drawing disabled): short underside attachment mean
  11.347 → 1.597 ms; moving short swing 2.688 ms.
  Near-maximum line moving swing mean 5.983, peak 11.500 ms; longer lines remain heavier.
  These are Chromium/SwiftShader host CPU samples, not physical-GPU or owner playtest evidence.
- Evidence and focused incremental patch: `/home/robert/Projects/Driftwing-Preservation/tether-performance-review-20261010T232319Z`. Compared the actual pre-fix/final Harrier descent frame;
  corrected downward-reaching limbs are visible. Other breeds have automated coverage, not new visual captures.
- Local production prototype: http://localhost:5176/?view=skyLance&play=1&quality=low (refresh existing tab).
  Existing dev/preview servers retained. No commit, merge, push, dependency change, deployment, M1 or wardrobe work.
  Next: owner playtest/review; no automatic expansion or integration.

## Latest: responsive freefall, upward burst and general static-surface Windline — 2026-10-10

- Owner authorized this follow-up in the existing isolated prototype: `/home/robert/Projects/Driftwing-SkyLance`, branch
  `exp/sky-lance-v1`, unchanged HEAD `f3ef231c6a12ed5865cd73562447f6d94a1730bf`.
- Complete dirty pre-change state preserved at `/home/robert/Projects/Driftwing-Preservation/windline-control-baseline-20261010T221409Z`; all 432 archived SHA-256 hashes verified.
  Tracked, untracked and ignored project references retained; generated node_modules/dist excluded.
- Untethered steering follows camera-relative intent with bounded 26 m/s² acceleration and 18 m/s
  controlled horizontal speed. No-input momentum is retained. Manual camera orbit stays available;
  automatic velocity-follow/companion avoidance stops during traversal, preventing steering feedback.
  Rider facing turns smoothly and freefall banking is clearer. Ordinary jumps and dragon flight unchanged.
- One A/Space waist burst sets vertical velocity to at least +12 m/s (retains faster ascent), then
  adds up to 10 m/s horizontal impulse over 0.28 s toward stick intent or camera aim. Horizontal added-speed
  ceiling remains 36 m/s, retaining incoming overspeed. Landing/mount recharges; tether blocks boost/steering.
- All static hard collision surfaces can anchor, including islands' tops/cliffs/undersides, spires,
  arches, building/roof/deck proxies, trunks and practice pillars. Soft foliage/decor without collision
  is excluded. IDs come from collision registration, independent of preview discovery order. Geometry/identity changes invalidate anchors. No moving-anchor following or rope wrapping.
- Shared analytic terrain contacts now optionally identify the hit solid; the existing collision
  calculation is unchanged. Tether validation never exempts the whole attached object: crossing its back
  obstructs/detaches. Fixed maximum length, slack, first-solid collision and release momentum remain.
- Reticle shows blue READY + distance, LINKED, BLOCKED / TOO CLOSE, NO SURFACE (65 m), FIRING/REFORMING.
  Forecast uses the real fixed-step projectile and obstruction validation, bounded at 240 steps,
  refreshed at most 8 Hz. It assumes current harness position; subsequent movement can alter reachability.
- Verification: baseline 117 / 8 passed; final full suite 1,061 / 100 passed; focused 172 / 12 passed; typecheck and final build passed; smoke 15/15.
  Browser: 1 s left turn reached -17.956 m/s with zero automatic camera drift; manual orbit 2.6 rad;
  falling boost launched at +11.846 m/s and gained 3.940 m; real underside READY at 20.551 m, attachment
  retained under held rescue; ordinary pillar attached. Preview-order independence is regression-tested. No golden fixture/tolerance changes.
- Range forecast measured 9.04 ms mean / 10.70 ms max (10 warm headless CPU samples).
  Real GPU and physical-controller feel remain unverified. Software WebGL captures are recorded separately.
- During final audit, AGENTS.md, CLAUDE.md and a new docs/ART_DIRECTION.md had changed independently
  of this pass. Read and preserved separately in the evidence folder; author/source not assumed.
  The guide gives current owner direction precedence, so the wrist-fired magical tether is retained.
  Full production art compliance is not claimed.
- Evidence, assessment and incremental diff against the full dirty baseline: `/home/robert/Projects/Driftwing-Preservation/windline-control-review-20261010T224155Z`.
- Play: http://localhost:5176/?view=skyLance&play=1&quality=low (refresh). Next: owner playtest/review.
  Work stays uncommitted; no integration, pushes, deployment, dependencies or other-checkout edits.

## Latest: rider traversal fidelity, deliberate saddle jump and waist burst — 2026-10-10

- Owner authorized this focused follow-up to the bracer prototype. Work remains isolated in
  `/home/robert/Projects/Driftwing-SkyLance`, `exp/sky-lance-v1`, unchanged HEAD
  `f3ef231c6a12ed5865cd73562447f6d94a1730bf`. No main-game integration or broader Gate C.
- Full pre-change working tree preserved at `/home/robert/Projects/Driftwing-Preservation/traversal-fidelity-baseline-20261010T202559Z`: 430 archived hashes verified, including
  untracked implementation, references and ignored project/cache files. No reset/stash/commit.
- Ordinary jumps remain walker-owned. Five bounded shared-ground queries require a clear four-metre
  drop and 0.65 m rim clearance before skydiving. Tethered airborne ownership remains separate.
- Rider descent targets now 9 / 13 / 18 m/s (brake / neutral / dive), with stronger asymmetrical
  steering poses and camera-relative untethered air control. Descent drag no longer erases upward
  launch/release momentum. Attached rope still gets no steering thrust or boost.
- Hold Y/F for 0.4 s while flying to jump away with inherited velocity and a swept outward hop.
  Release the button before a second hold calls the existing rescue. Same hold cannot catch/eject
  repeatedly. The dragon glides through the existing FlightModel; flight tuning/breeds unchanged.
  Independent landing cannot mount the rider or award grounded rest/regeneration to a flying dragon.
- Experimental foot-camera upward range extended to 80 degrees, retaining terrain boom clearance.
  Actual camera cast from lower platform attaches to higher marker. Mounted/ordinary limits retained.
- A/Space gives one untethered 0.28 s waist burst (12 m/s impulse budget, 36 m/s added-speed cap,
  existing overspeed preserved). It follows current momentum, using aim only at low speed. Landing
  or mounting restores the charge. Compact procedural bronze/slate vessels and blue plumes use a
  render-only hip socket; no animated transform controls physics. No reel/winch/powered tether.
- Final checks: focused 178 tests / 10 files; full 1,042 / 99; typecheck/build passed; final production
  smoke 15/15. Isolated browser fidelity, DOM keyboard, simulated standard controller RT/Y/A,
  accessibility toggle and unpowered platform route passed. No golden or tolerance changes.
- Capture evidence: ordinary-jump before/after, all three rider builds steering, consistent medium
  waist front/side/rear, actual upper-anchor cast and four actual departure/rescue/catch frames.
  Software WebGL only; physical-controller feel and real GPU performance remain owner review.
- A complete lower-to-upper climb using only tether plus one burst has not been demonstrated.
  Verified dragon recall provides a return option. Static anchors only; no automatic pulling.
- Evidence, preservation audit and incremental dirty-baseline patch: `/home/robert/Projects/Driftwing-Preservation/traversal-fidelity-review-20261010T210241Z`.
- Play: `http://localhost:5176/?view=skyLance&play=1&quality=low` (refresh). Next action: owner playtest
  and feedback. No commits, pushes, merges, deployments, dependency changes or other-checkout edits.

## Latest: bracer-fired magical tether and slow rider freefall — 2026-10-10

- Owner requested replacing the cumbersome lance with a bracer-fired magical tether and a clear,
  substantially slower freefall. This focused experimental follow-up supersedes the thrown-lance
  presentation contract here; no main-game integration, flight tuning or broader Gate C is implied.
- Checkout `/home/robert/Projects/Driftwing-SkyLance`, branch `exp/sky-lance-v1`, unchanged HEAD
  `f3ef231c6a12ed5865cd73562447f6d94a1730bf`. Complete dirty Gate B state preserved at
  `/home/robert/Projects/Driftwing-Preservation/bracer-freefall-baseline-20261010T195848Z`:
  all 428 archived file hashes verified, including ten ignored cache files. No reset/stash/commit.
- Removed pole, flag and carry-grip presentation. Left bracer fires a small luminous seed and thin
  blue filament. Existing swept first-solid projectile, approved static anchors, locked maximum
  length/slack, harness authority, release velocity and automatic reformation remain. Animated
  wrist sockets remain render-only. Internal SkyLance module names/URL retained for compatibility.
- Rider-only terminal descent targets: braking 7 m/s, neutral 10 m/s, dive 14 m/s. Vertical implicit
  quadratic drag smoothly brakes excess inherited speed rather than snapping velocity on release.
  Weak horizontal drag is independent. Attached swings bypass the new vertical braking entirely;
  gravity, tether solver reactions/energy guard, dragon flight and breed parameters stay intact.
- Both arms now participate in the braking pose; diving leans forward and streamlines the limbs.
  Existing IK handles all three builds. Freefall blend clears on supported touchdown, boarding and
  teleport. Q/RT hold/release, toggle alternative and deliberate F/Y rescue are unchanged.
- Final typecheck and full suite passed: 1,022 tests / 98 files. Focused traversal/input/rider checks
  passed (142 / 12 files), then the final pose/reset checks (7 / 1 file). No golden updates.
- Initial bracer production build and browser loop passed: neutral fall -9.999999991 m/s,
  maximum rope excess 2.85e-14 m, release error against next-step forces 0. Keyboard, simulated RT,
  pause/resume, toggle, deliberate catch and actual far-platform landing verified (release step 140).
  Final rebuilt-browser confirmation after the pose-reset safeguard: passed with the same metrics.
- Existing capture harness supplies matching before/after medium freefall views, all three rider
  builds, left-bracer firing and line against sky. Visual captures and final confirmation are
  described separately in the evidence report; software WebGL, not physical GPU/controller evidence.
- Evidence and follow-up-only patch: `/home/robert/Projects/Driftwing-Preservation/bracer-freefall-review-20261010T200930Z`.
- Local review: `http://localhost:5176/?view=skyLance&play=1&quality=low` (refresh to load latest build).
  Existing unrelated work retained. No dependency changes, commits, pushes, merges or deployment.
  Next action: owner playtests bracer/slow-fall feel; integration and Gate C remain separately gated.


## Latest: Windline / Sky Lance Gate B — controls and presentation — 2026-10-10

- Owner approved Gate B only. Checkout `/home/robert/Projects/Driftwing-SkyLance`, branch
  `exp/sky-lance-v1`, unchanged HEAD `f3ef231c6a12ed5865cd73562447f6d94a1730bf`.
- Complete dirty Gate A baseline preserved outside source at
  `/home/robert/Projects/Driftwing-Preservation/gate-b-baseline-20261010T182441Z`.
  All 417 archived file hashes verified; unrelated files retained. No reset/stash/commit/integration.
- Immediate fresh Q/RT cast, hold retention and release/cancel; explicit opt-in input context prevents
  held RT across mounted/menu transitions from casting. Practice checkbox enables toggle mode.
  Pause/Escape releases pointer lock before changing the checkbox. Hold F/Y rescue remains deliberate.
  Recovery automatically returns equipment to ready after 0.36 simulation seconds. Legacy manual
  recovery remains compatible. No powered pumping, winching or changes to the tether solver/flight.
- Procedural left bracer, crossback harness and shoulder-routed load strop use render-only rider
  sockets; physical harness remains fixed relative to RiderFoot. Restrained cast/tension/recovery IK
  uses the existing rig. Thin blue tether has a 1.1 px core / 2.3 px edge at viewport resolution,
  world depth testing and ordering after the existing sky dome. No renderer infrastructure changes.
- Practice anchor cues check static identity/range/first-solid line of sight at bounded 10 Hz;
  they do not steer aim or promise a ballistic hit. Added pillar uses the same rendered/collider box.
  Far platform lowered from surface 415 m to 400 m after the unpowered route proved unreachable.
- Final verification: `npm run typecheck`, `npm run build`, `npm test` (1,009 tests / 97 files),
  `git diff --check` passed. Focused rider/input/traversal/camera checks passed (155 / 13 files),
  followed by the final traversal/input checks (82 / 6 files). No golden updates or weakened tolerances.
- Production browser check passed via `node scripts/sky-lance-check.mjs http://localhost:5176/`:
  real DOM Q and toggle, simulated standard RT, buffered quick taps, recovery, pause/resume,
  camera aim, independent fall / deliberate rescue, and actual far-platform landing.
  Max rope excess 2.85e-14 m; release error versus expected next-step gravity/drag 0;
  pillar pass 24.438 m/s; max camera increment 0.085451 rad; right-axis vertical component <7e-19.
- Existing dragon-capture harness produced matching 720p front/side/rear captures of all three
  rider builds, actual cast frames, release/recovery and sky/stone/foliage line views. Baseline
  captured before source edits. Initial occluded views and inherited post-reset poses were corrected
  in staging; earlier failed/stopped attempts are diagnostic evidence, not accepted final captures.
- Evidence, assessment and Gate B-only patch: `/home/robert/Projects/Driftwing-Preservation/gate-b-review-20261010T185714Z`.
  Browser uses SwiftShader: no physical-GPU performance or physical-controller playtest claim.
  Dense-foliage stress, broad wardrobe/quality coverage and production smoke/performance hardening
  remain Gate C work. Motion and control feel await owner feedback.
- Local production preview: `http://localhost:5176/?view=skyLance&play=1&quality=low`.
  No M1, dragon integration, commits, pushes, merges, deployment or dependency changes.
  Next action: owner reviews Gate B; Gate C requires separate approval.

## Latest: Sky Lance Gate A — physics and lifecycle reconciliation — 2026-10-10

- Objective: reconcile the existing isolated prototype with the Windline Bracer contract; Gate A only.
- Checkout `/home/robert/Projects/Driftwing-SkyLance`, branch `exp/sky-lance-v1`, unchanged HEAD
  `f3ef231c6a12ed5865cd73562447f6d94a1730bf`; all implementation remains uncommitted.
- Original 15 modified tracked / 11 untracked files preserved in a SHA256-verified 416-file archive at
  `/home/robert/Projects/Driftwing-Preservation/gate-a-20261010T175251Z` (original Git state included).
- Removed powered swing pumping and its tuning/integrator input. Grounded attachment retains the
  walker and support; grounded bound correction preserves support, jump/edge departure transfers
  ownership, and a subsequent landing detaches. Airborne release retains instantaneous velocity.
- Swept correction starts at the resolved contact; bounded retries detach on incompatible constraints.
  Sweeps fail closed above 128 m or 256 broad-phase candidates; primitive/rock budgets remain bounded.
- Anchors validate stable collider identity, geometry and live source membership before movement;
  all intervening solid hits obstruct. Miss/detach/invalidation enter the existing manually recoverable
  spent state; no recovery control or animation changes.
- Split gravity kicks with an initial radial reaction remove artificial unpowered damping. Energy
  guard remains. Controlled 60 s, 10 m, 0.05 rad swing: energy loss 0.02306% (original 20.1572%),
  period 4.68393849 s vs analytic 4.68320982 s, zero guard stops; growth below 1e-8 J/kg per step.
- Added transition/reset, grounded movement, anchor mutation, collision/budget, scene resource disposal,
  pause/save reset and 30/60/120/144 FPS plus jittered presentation regressions. Scene teardown and
  bfcache suspension use a narrow optional showcase lifecycle hook.
- Baseline command `npx vitest run src/traversal src/player/Player.test.ts src/input/Input.test.ts`:
  91 passed / 5 files. Final focused command adds `src/world/colliders.test.ts`: 137 passed / 7 files.
  `npm test`: 1004 passed / 96 files. `npm run typecheck` and `npm run build`: passed.
  `git diff --check`: passed. No golden fixture or tolerance changes.
- Evidence and Gate A-only diff:
  `/home/robert/Projects/Driftwing-Preservation/gate-a-review-20261010T175251Z/assessment.md`.
- Limits: automated source/unit/build evidence only this gate; no browser, physical-controller,
  production smoke, capture or GPU/allocation profiling performed. Query-budget saturation blocks
  conservatively; dense-scene usability/performance remains Gate C work. Controls/art and practice
  route are otherwise unchanged; no main-game integration or flight physics changes.
- Next action: owner review. Gates B/C, controls/art, commits, pushes, merges and integration require
  separate authorization. This handoff is informational, not authorization.

## Latest: Sky Lance controlled freefall and charged throw — 2026-10-10

This section supersedes the V1 release-grace/automatic-rescue behavior below, in this
experimental worktree only. All prior uncommitted prototype work is retained.

### Authority and checkout
- Owner approved two focused packages: controlled freefall/deliberate catch, then charged
  throw/thinner shaft/tip ribbon/aim UI, with tests, build, browser validation and captures.
- Worktree `/home/robert/Projects/Driftwing-SkyLance`, branch `exp/sky-lance-v1`, HEAD
  `f3ef231c6a12ed5865cd73562447f6d94a1730bf`. Changes remain uncommitted.
- Released checkout `/home/robert/Projects/Driftwing-Codex` remains clean at `844e5c2`.
- No commits, integration, pushes, deployment, dependencies, wardrobes or dragon-mounted
  grappling authorized. Wyvern flight physics and breed tuning are unchanged.

### Behavior and implementation
- In the opt-in scenario, leaving the ground enters `PlayerMode.traversing`; ordinary
  airborne walking braking and automatic rescue do not take movement ownership.
- Hold Y/F for 0.4 seconds while untethered to request the existing swoop/catch sequence.
  A tap does not catch; holding during a valid tether cannot interrupt the swing.
  Grounded mounting retains its existing interact behavior. This is not the complete
  roadmap leap-and-call feature with distance-dependent companion travel time.
- Forward W/left stick smoothly streamlines the freefall pose and reduces quadratic drag;
  backward S/left stick spreads the pose and increases drag. No freefall thrust or winch.
  Existing fixed 120 Hz and four swept integration substeps remain authoritative.
- Release preserves instantaneous velocity; subsequent physics applies gravity/air resistance.
  World contact restores walking. Crossing the existing cloud floor uses fade/respawn rather
  than an unsolicited swoop; freefall is bounded by that existing world safety boundary.
- Hold X/Q to wind up (0.8 seconds to full power), release to throw. Tap speed remains
  42 m/s; full-charge speed is 64 m/s, before inherited rider velocity. Range eligibility
  grows from 65 to 95 m; actual rope length still locks only on attachment and never retracts.
- X/Q still immediately detaches a live tether; RB/E still recovers spent equipment.
  Press/release edges and aim are buffered across zero-step render frames. Pause cancels
  windup and requires button release before a fresh press. Teleport resets transient state.
- Rider windup/freefall uses the existing animation layer and joint-limited IK. Shaft radii
  reduced from .016/.022 to .010/.014 normalized units. Narrow blue ribbon attaches near the
  tip and hangs downward independently of pole orientation; static decorative geometry,
  no cloth solver or decorative collision. No new asset imports or wardrobe work.
- Ivory/bronze reticle projects a short ballistic aim point from the simulation harness after
  camera update, including inherited rider velocity, with a charge ring. It is an aiming aid
  at 20 m, not a target lock or a guaranteed endpoint/range predictor.
- Primary files: `src/player/Player.ts`, `src/traversal/{SkyLance,tether,tuning,SkyLanceVisuals}.ts`,
  `src/core/types.ts`, `src/input/Input.ts`, `src/creatures/rider/animator.ts`,
  `src/game/Game.ts`, `src/debug/showcases/skyLance.ts`, related tests, capture manifest,
  browser check and this handoff. Existing V1 changes in other files are preserved.

### Actual verification
- `npm run typecheck`: passed.
- Focused traversal/player/input tests: 91 passed across 5 files.
- Final `npm test`: 967 passed across 95 files; no golden regeneration or tolerance changes.
- Final `npm run build`: passed.
- `node scripts/sky-lance-check.mjs`: passed on final source. Real DOM Q/E and simulated
  standard-controller X/RB mapping, full windup/release, pause cancellation, ledge freefall,
  deliberate catch, actual camera-aim attachment, swing/release/recovery/ground restoration.
  Rope excess 3.20e-14 m; release velocity error against the next gravity/drag step 0.
  Measured horizontal change during that step .00574 m/s is aerodynamic drag, not a release
  impulse. Strict 1e-8 release-physics assertion remains; no blanket tolerance relaxation.
- Final `node scripts/smoke.mjs --no-build --port 5393`: 15/15 passed against the
  resulting production build, including title/play, pause/resume, quality switches and plain boot.
- Existing dragon-capture harness: five final captures completed, visually reviewed:
  all three rider builds at full windup, plus freefall dive/brake. Manifest assertions check
  actual charge and traversal mode rather than assigning poses. Output:
  `/tmp/driftwing-sky-lance-r2/index.md`; earlier V1 views remain in
  `/tmp/driftwing-sky-lance-captures/index.md`. Browser telemetry:
  `/tmp/driftwing-sky-lance-check.json`.
- Browser/captures use software WebGL (SwiftShader). Physical gamepad feel, real GPU
  performance and owner playtesting remain outstanding; no claim of hardware validation.
- `git diff --check`: passed. No repository cleanup, resets, stash or Git integration done.

### Next authorized action
Owner playtest/review at `http://localhost:5175/?view=skyLance&play=1&quality=low`.
Development server remains running on 5175. Await further direction before expanding scope
or checkpointing/integrating this experiment. Known prototype limits remain: registered
static anchors only, no rope wrapping, no moving anchors, no rope shortening, no cloth solver.

## Latest: isolated Sky Lance V1 prototype — 2026-10-10

This section supersedes historical objectives below for this worktree; older entries are retained.

### Authority and checkout
- Owner approved the checkpoint/worktree procedure and isolated implementation, staged tests,
  locked dependency installation, runtime validation and captures. No commit, integration, push,
  deployment, dependency changes, wardrobes or dragon-mounted grapple work is authorized.
- Worktree: `/home/robert/Projects/Driftwing-SkyLance`; branch: `exp/sky-lance-v1`.
- HEAD remains `f3ef231c6a12ed5865cd73562447f6d94a1730bf`; prototype changes are uncommitted.
- This verified reference-pack checkpoint contains released gameplay at `844e5c2` plus art/docs.
  Only `docs/art-reference-pack` was fetched; no branch was merged into the released checkout.
- Released worktree `/home/robert/Projects/Driftwing-Codex` remains clean on `dev/codex-wsl`
  at `844e5c25860aab4c596116df4ffb19fa4e98fd1e`. All prior rider, gameplay and music work is preserved.

### Implemented boundaries
- Opt-in practice scene: `?view=skyLance&play=1`, using the real Game, Player, Rider, camera,
  analytic terrain and shared collider index. Two elevated decks and two registered static anchors.
- `PlayerMode.traversing` owns `RiderFoot.position/velocity` during tethered/released travel.
  Equipment attachment resolves before movement dispatch; pending rescue changes to a return hop
  from the companion's current position. No catch interrupts a valid swing.
- Detached travel preserves velocity rather than using ordinary walking acceleration or fall drag.
  Release grants 1.5 seconds before a fresh ordinary rescue clock. Ground contact restores walking;
  teleport, spawn, quit and mount transitions reset transient equipment.
- New `src/traversal/` modules separate equipment state, anchor identity, swept queries, tether
  solving and procedural presentation. Gameplay never reads animated hand positions for forces.
- Fixed 120 Hz; four integration substeps. Rope length locks at attachment, allows slack/inward
  travel, removes outward radial velocity and preserves tangent velocity. Bounded tangential input
  pumping and an energy guard prevent constraint-created energy. No retraction or winch force.
- Swept sphere projectile proxy and three swept rider body probes. Primitive structures use
  signed-distance conservative advancement; rock uses shared analytic contact queries with a
  conservative sampled envelope (at most 1 cm extra clearance) and bisection. Query exhaustion
  fails closed. Conflicting world/rope contacts and blocked lines detach; no rope wrapping.
  Only the attached fixture's own eye is excluded from line obstruction checks, never rider collision.
- Manual recovery after detachment restores equipment immediately without moving the rider.
  In-flight throws can also be cancelled by recovery; attached ropes cannot be recovered/retracted.
- Q / Xbox X (PlayStation square): throw or release. E / RB (R1): recover.
  Shift / B or L3: run; Space / A: jump; WASD / left stick: move or pump;
  mouse / right stick: aim; R / View or the practice button: reset.
- Existing flight tuning, breeds, renderer, golden fixtures, dependencies and ordinary movement
  paths are unchanged. The opt-in scene supplies its own control/status panel; no M1 expansion.

### Art reference disposition
- Art master 2.0, the reference pack documents/manifests and all 23 supplied images were reviewed.
  Existing tracked reference assets were not duplicated, imported into runtime, or modified.
- Ready to apply: palette, ceremonial silhouette and proportions. The placeholder uses a pole
  1.45 times nominal rider height, restrained tip, grip wrap, bronze eye and long static blue pennon.
- JPEG/PNG character, faction, armor and banner artwork is visual reference, not completed 3D art.
  There are no supplied runtime models, rigs or animations to import. Production garment geometry,
  rigging, throw/recovery animation and banner cloth remain future modeling/animation work.
- Physics uses a compact tip proxy and stable torso endpoint; decorative shaft, eye and banner
  geometry exert no forces. Shaft contact and production eye/grip offsets need later art refinement.
  Static pennon and instant recovery are deliberate V1 placeholders.
- Master 2.0 takes precedence over the older atlas's 2.5–3-times-height pole and older wardrobe
  archery/palette notes. Illustrated serpentine dragons/pagoda roofs are not changes to game canon.

### Actual verification
- Before editing: existing Player/collision baseline, 55 tests passed.
- Each system was tested before the next integration stage: projectile/tether, traversal ownership,
  input/rider presentation, then the complete browser loop.
- Final `npm run typecheck`: passed.
- Final `npm test`: 959 passed across 95 files (25 additions over the released 934-test baseline).
- Final `npm run build`: passed. `node scripts/smoke.mjs --no-build --port 5393`: 15/15 passed.
- Coverage includes thin/invalid/occluded targets, slack and length bounds, 60-second unpowered
  energy stability, tangent preservation, pumping bounds, release momentum, restoration, pending
  catch cancellation, high-speed wall/ceiling/analytic-terrain contacts, repeated recovery, zero dt,
  teleport/reset, queued aim, and fixed outcomes at 30/60/120/144 FPS plus jittered presentation.
- `node scripts/sky-lance-check.mjs`: passed in Chromium/SwiftShader. Actual attachment, two-second
  swing, release, recovery and grounded walking restoration recorded; maximum length excess
  `2.842170943040401e-14 m`, horizontal release velocity change `0 m/s` in this trajectory.
  Also passed real keyboard event mapping, simulated standard-pad X/RB edges, pause/resume and
  attachment with existing camera aim (no custom projectile aim injected for that check).
- Browser telemetry: `/tmp/driftwing-sky-lance-check.json`. This is software-renderer evidence,
  not a physical-controller playtest or real-GPU performance measurement.
- Existing capture harness completed seven images: all three rider builds plus anchor, swing,
  release and recovery. Index: `/tmp/driftwing-sky-lance-captures/index.md`.
  Captures were visually reviewed for grip/pennon and tether legibility; binary outputs stay outside Git.
- `git diff --check`: passed. No golden fixtures or tolerances regenerated/changed.

### Remaining review and next authorized action
- Owner should playtest the isolated prototype at
  `http://localhost:5175/?view=skyLance&play=1&quality=low` (practice server left running).
  Run forward, jump toward the gap, aim up at the first bronze fixture and throw; pump, release,
  then recover. Release timing determines whether the second deck is reached.
- Physical-controller feel, real-GPU performance, production art and broader-world anchor placement
  remain unverified/deferred. Existing discovery notices can appear over the practice scene.
  Collision queries currently allocate temporary vectors; this isolated prototype is not a zero-
  allocation production traversal system. Long/grazing rock sweeps have a conservative clearance.
- Await owner review before changing scope, integrating, committing, pushing or deploying.
  M1 Gate C remains independent; no wardrobe or dragon integration was started.

---

## Objective and authority
M1 "The First Lead", WP1: research state and save integrity. Gate A approved.
Stop at Gate B before WP2. No commit authorized.
Brief read from origin/dev/claude at 4490a59 without merging.

## Checkout
- Agent: Codex
- Branch: dev/codex-wsl
- HEAD/baseline: 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe
- Work is uncommitted; no other worktree edited.

## Completed
- Added pure research normalization, once-only transition/event payloads, stable Highmoor ridge observation key, and inscription-gated airship stage 0/1.
- Retained save version/key 1 for the additive optional field. Defaults initialize research; loading sanitizes M1 IDs and recomputes point totals.
- Existing finds remain authoritative: unique feathers contribute to nature, relics to antiquity, known landmarks to winds. No duplicate find records.
- Existing reset clears research/observations and stage reward while retaining settings.
- Files: src/research/state.ts, src/research/state.test.ts, src/progression/save.ts, src/progression/save.test.ts, src/game/contracts.ts, this handoff.

## Verification
- Focused Vitest: 21 tests passed across 3 files.
- Full Vitest: 885 tests passed across 87 files.
- npm run typecheck: passed.
- No production build, browser smoke or manual gameplay run for WP1.

## Limits and known issues
- Transitions return researchEntry payloads; runtime emission/subscriptions and Game wiring are deferred.
- Totals are a derived cache: later runtime must recompute when authoritative finds change.
- WP3 must enforce airborne ridge-observation eligibility; persistence alone does not establish observation.
- All-breed approaches, Greek correctness and aerial visibility remain unverified.
- Repeated-dive stutter is a pre-existing owner observation, not a diagnosed regression.
- Approved document wording and encounter presentation are deferred from WP1.

## Next action
Gate B persistence/data-contract review. Await explicit approval before WP2 and permission before any commit.

## WP2 — Gate C candidate
Gate B approved. Implemented the first shrine only; stop for owner browser playtest before WP3.
- Built two pale columns, a Greek inscription slab, and a clear approach keep-out at the existing shrine anchor. Terrain and flight tuning are unchanged.
- Added procedural stroke glyphs (no fonts); Greek remains linguistically/epigraphically unverified. Registry translation now carries the approved lead.
- Registered on-foot read interaction; existing Game prompt routing reserves stable priority and suppresses mount/call while reading.
- Added survey runtime: once-only rewards/events and derived-find refresh. Re-reading opens the same translation in the existing paused dialog, with standard confirm/back controls.
- Added static keel and raised-rib states at the existing dock; inscription unlocks stage 1. Collider arrays are replaced on stage changes so reset removes rib collisions.
- Applied Gate A-approved AGENTS/ROADMAP wording. WP3 second-site presentation and WP4 knowledge record remain deferred.
- Additional files: src/research/Research.ts, Research.test.ts, firstLeadEncounter.ts, firstLeadText.ts; src/world/dressing/ventari/FirstLead.ts, FirstLead.test.ts, glyphs.ts. Modified Game.ts, Ui.ts, registry.ts, ventari/plan.ts and approved project documents.

### WP2 checks and limitations
- Focused encounter/player/planning/interaction suite: 65 tests passed across 5 files.
- After collider-reset fix: 8 focused tests passed across 2 files; typecheck and production build passed.
- Full suite before collider-reset fix: 893 tests passed across 89 files; final rerun recorded below.
- Landing tests exercise a 17 m/s still-air flared final approach for all four breeds. They do not establish human routefinding, aerial visibility, weather coverage, or overall experience quality.
- Browser smoke attempted but blocked by missing host Chromium libraries (libnspr4, libnss3, libasound2t64). Downloaded Playwright's Ubuntu 24.04 fallback browser because its installer does not recognize Ubuntu 26.04. No project dependency changed. Host library install could not proceed: sudo requires interactive authentication.
- No browser captures or runtime visual/UI verification completed. Owner Gate C playtest remains required.
- Dev server started at http://127.0.0.1:5174/ (5173 was already occupied).
- No commits made. Next action: resolve browser prerequisites and owner Gate C playtest; do not start WP3 on this handoff alone.
- Final full Vitest rerun after collider-reset fix: 893 tests passed across 89 files.

## Gate C feedback — early-island terrain/foliage revision
Owner could not spot the encounter and reported foliage obstruction and bumpy islands; requested a flattening pass. Started with the recommended M1 route (Roost, Gull's Rest, Highmoor), pending broader scope preference.
- Updated only layout parameters and field styles: hill allowance 7→3 m / 6→2 m / 26→8 m; broader flat centers at Gull's Rest and Highmoor; lower tree hints; shorter grass and reduced Gull's Rest/Highmoor tuft density.
- All top surfaces still use IslandShape, shared by mesh/collision/walking/landing. Cliffs, outlines, island baseline heights, flight tuning and unrelated islands retain their existing definitions.
- Terrain revision supersedes the earlier WP2 note that terrain was unchanged. Procedural site/prop positions may regenerate with the new tops.
- Focused terrain, mesh, dressing, placement and collision suite: 48 tests passed across 8 files. Production build (including typecheck) passed. Full suite result recorded below.
- Browser verification remains blocked by previously documented host libraries. Owner must assess visibility and terrain feel after reloading http://localhost:5174/.
- Gate C remains open; no WP3 work or commit authorized.
- Full suite after terrain revision: 893 tests passed across 89 files; git diff --check passed.


## Approved shrine visibility correction and introductory tutorial — 2026-10-09
- Branch dev/codex-wsl, HEAD 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe. Existing uncommitted work preserved; no commit, integration or deployment performed.
- Owner separately approved the bounded shrine visibility correction and a tutorial implementation/verification scope. This supersedes M1's no-marker rule only for introductory first-shrine guidance (ROADMAP updated); subsequent exploration remains unguided.
- Moved the shrine toward the Roost-facing side, enlarged the pale columns to 18 m and added a solid lintel. Increased column separation to 22 m and beam width to 25 m; rendering and collider dimensions match. Site footprint radius is 14 m; existing 23 m vegetation keep-out remains. No additional terrain or flight tuning changes in this pass.
- Initial enlarged-column layout failed the existing Ironback landing test. Diagnostic runs with shrine colliders excluded passed; excluding the plaque alone still failed. Widening the columns resolved the failure with the original test assertions and all collider sources restored. All four breeds pass the existing still-air final approach; this is not a human routefinding or weather playtest.
- Extended existing device-aware lessons with bank controls. After walking/mounting, takeoff, flapping and pitch lessons, a paused local map offers Guide me / Skip guidance / Back. It derives outlines from IslandShape and displays the player, Roost and actual first-shrine anchor; it does not reveal the second encounter.
- Pause → Tutorial map reopens it. Active guidance adds a pinned named compass marker and contextual travel/landing/dismount/read instructions. Races suppress shrine guidance. Reading the inscription removes guidance using the authoritative research entry; tutorial completion does not award research.
- Added optional firstLeadGuide active/skipped persistence and restored sanitized individual tip IDs on load. Settings → Gameplay → Replay tips resets lessons and the guidance offer without clearing research; an already-read inscription stays completed.
- New tutorial files: src/ui/TutorialMap.ts, firstLeadGuide.ts, firstLeadGuide.test.ts. Changes also touch Ui, Tips, Hud, tutor, SettingsMenu, ui.css, Game, contracts and save loading.
- Final automated checks: 898 tests passed across 90 files; npm run build passed (includes tsc --noEmit); production smoke 15/15 passed. git diff --check passed before this appended note, rechecked afterward.
- Browser verification on localhost:5174: map offer after lessons; skip and active-state reload; individual lessons survive reload; Pause map access; simulated standard Xbox-pad confirmation; approach/dismount/read text; actual Settings replay; race countdown hides shrine marker; actual on-foot read prompt and translated dialog persist inscription completion. Browser page errors and debug error list empty. Simulated controller input is not a physical-controller playtest.
- Captures in /tmp: driftwing-tutorial-map.png, driftwing-tutorial-guide.png, driftwing-shrine-after-approach.png, driftwing-shrine-after-high-approach.png, driftwing-shrine-after-close.png. Camera overrides establish static views, not a complete naturally flown discovery sequence. Shrine is more evident from the elevated approach; distant lower views still make it small.
- Host browser-library blocker in previous entries is resolved by the owner's WSL installation. Greek remains provisional and linguistically unverified.
- Next action: owner Gate C visual/gameplay review at http://localhost:5174/. No WP3, commits, integration, push or deployment authorized by this handoff.


## Approved Gate A — rider hip continuity and authoritative touchdown (2026-10-09)
- Owner approved the proposed bounded Gate A after the source review. Reference main is bb87b14374ab3e177203385c71cbcb06b472566e; implementation baseline is dev/codex-wsl at 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe plus all pre-existing uncommitted M1/tutorial work. That work was preserved. No integration, commit, push, deployment or dependency change.
- Unchanged source/scripts were archived to /tmp/driftwing-gatea-baseline.tar before implementation. Comparing that archive against the working tree confirmed only the approved fidelity/capture files changed in this pass, before this appended handoff.
- Rider body.ts now distributes the original 45% pelvis contribution continuously over the upper thigh, scaled with rider build. Geometry topology, vertex counts, bones, outfit boundaries and attachment targets are unchanged. Regression coverage checks the actual body loft for every outfit across all three builds; separate garment/strap skin fields are intentionally excluded from this continuity criterion. The original abrupt field failed the new regression.
- Player carries the existing terrain-normal touchdown impact into optional reusable WyvernPose metadata, with a contact serial and explicit reset epoch. Animation consumes each contact once; short teleports reset settling without producing an impact. Gentle authoritative impacts no longer inherit the legacy minimum impact/settle impulse. Eligibility, physics, timing, launch impulses and flight tuning are unchanged. Synthetic showcase poses explicitly omit this channel; ghosts and synthetic poses retain their velocity-based fallback.
- Regression tests first reproduced the 20 m/s rendered-velocity versus 0.2 m/s authoritative-impact mismatch. Added coverage includes all breeds, duplicate consumption, zero-duration updates, reset, interrupted settling, and 30/60/120/144 FPS plus jitter. An end-to-end Player/wyvern landing test gives identical fixed-step final states across those rates and under 5 cm variation in final saddle height. This is a scripted clear-ground approach, not comprehensive human/weather/terrain certification.
- Verification: focused rider/wyvern/player suite passed 218 tests across 12 files before the final end-to-end test; the final ground suite passed 40 tests. Final npm test: 905 tests across 90 files passed, including unchanged goldens. npm run typecheck passed. npm run build passed. Golden fixtures and tolerances were not changed.
- Capture harness now uses installed Playwright Chromium when the historical /opt binary is absent, records actual contact/state/animation telemetry, frames riders from their spine, corrects breed wingspan framing, and reports unavailable composites instead of linking them as produced results. No parallel capture stack was introduced.
- Baseline evidence: /tmp/driftwing-gatea-before (root grids, eight corrected landing strips, initial performance measurements), /tmp/driftwing-gatea-rider-before (36 correctly framed rider views: four breeds x three builds x three angles), /tmp/driftwing-gatea-reference-before (five reconstructed video-reference scenes). Earlier frozen landing attempts and cut-off rider framing were invalidated and recaptured before source implementation; use corrected saved telemetry, not scenario labels.
- After evidence: /tmp/driftwing-gatea-after/index.md and results.json: 54 scenarios (four eight-pose root grids, 36 rider views, eight real landing strips, five reference reconstructions, one measurement). All eight landing strips have exactly matching before/after contact events and positions. Low-sink impacts range 1.60–1.68 m/s; higher-sink impacts 5.18–5.23 m/s. Animation now uses the exact impacts; e.g. Harrier low-sink changed from estimated 1.396 to authoritative 1.620 m/s.
- Capture limitations: Pillow is missing, so 14 contact sheets/footfall diagrams are unavailable; individual PNGs and telemetry remain. Chromium closed during two larger runs; missing scenarios succeeded in isolated runs. Cause of browser closure is unverified. These are SwiftShader captures, not physical-GPU performance or owner playtest evidence. The YouTube video could not be retrieved in the source review; reconstructed scenes use the owner's timestamp descriptions, with no inferred narration or claim to exact camera/haze matching. The possible video roof intersection remains unproven.
- Default geometry measurements are unchanged: Harrier 21,502 triangles, Skimmer 21,666, Galewing 21,926, Ironback 25,490; 58 wyvern bones each. Current profiles/budget tests pass. Runtime still has one wyvern LOD; defined LOD profiles do not establish runtime switching.
- Scope intentionally deferred: no demonstrated root-junction defect justified a topology change. Rider attachment/stirrup retargeting awaits unavailable dragon2/e evidence and owner scope decision. Available dragon2/a, c and l snapshots were reviewed as diffs, not integrated; main's foot-driven trunk/ground/landing behavior remains. Gate B flight responsiveness needs a separate measured proposal and explicit approval. No claim that this small correction completes the broader anatomical/artistic quality bar.
- Next authorized action after delivery: owner review/playtest of Gate A. No automatic expansion, branch integration, commit, push or deployment; M1 Gate C review remains separately open.
- Final production smoke: node scripts/smoke.mjs --no-build --port 5391 passed 15/15 checks, including keyboard flight, pause/resume, both quality switches and plain production startup; no reported debug/production errors. The run was slow in this environment but completed with the documented timeout and assertions unchanged.
- Installed versions rechecked from node_modules package metadata: Three.js 0.186.1, TypeScript 6.0.2, Vite 8.3.4, Vitest 5.0.3, Playwright 1.56.1.
- Performance evidence (existing harness, SwiftShader, 180 timing iterations / 120 allocation iterations): before/initial-after/isolated-repeat full-frame CPU medians 0.2967/0.1575/0.1875 ms; allocation samples 8,031/8,240/8,203 bytes per frame. Baseline load average was 10.05 versus repeat 0.62, so these do not establish a speed improvement or causally attribute the sampled allocation difference. Per-breed flap CPU medians before/repeat: Harrier 0.0450/0.0244 ms, Skimmer 0.0322/0.0478, Galewing 0.0383/0.0422, Ironback 0.0383/0.0200; observed increases on two breeds coexist with lower initial-after readings and changed load. No real-GPU timing or zero-allocation claim.
- Investigated the initial Harrier flap allocation outlier (171 before, 1,961 initial-after bytes/call): 1,784 bytes/call were attributed to V8 IDLE_EXTERNAL. An isolated repeat measured 188 total, 25 IDLE_EXTERNAL. The original outlier was not reproduced; no application regression cause was established. Initial measurement preserved in /tmp/driftwing-gatea-after/measure/fidelity-cost.initial.json; repeat in fidelity-cost.json. Existing substantial ground/rider/frame allocations remain outside this correction scope.
- Final git diff --check passed. Handoff changes append to the preserved pre-existing text. Owner review remains the next step; broader anatomical/boarding/weather and physical-controller playtesting are still needed before claiming the overall fidelity target is met.

## Approved Gate B — bounded roll-braking pass (2026-10-09)

- Objective and authority: owner approved the measured two-parameter experiment on dev/codex-wsl at 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe plus all existing uncommitted work. Only src/flight/FlightModel.ts, src/flight/FlightModel.test.ts and this appended handoff changed during Gate B. No commit, integration, push, deployment, dependency change or other checkout edit.
- Implementation: rollBrake 2.6 → 2.9; the existing braking tracking-gain cap 1.6 becomes rollBrakeGainMax = 1.8. Four direct-stick pulse regression cases protect the reduction in released-roll drift. Existing handling/ranking tests remain unchanged. No input shaping, camera, animation, breed, maximum-rate, lift/drag, stamina, climb/zoom or auto-level parameter changes.
- Independent unchanged-source 60 FPS baseline/candidate comparison: simulated-pad cruise overshoot Harrier 7.71° → 6.85°, Skimmer 10.45° → 9.29°, Galewing 7.02° → 6.26°, Ironback 7.57° → 6.71° (10.8–11.3% reduction). Arrest was 33 ms faster for each; first 1° bank response unchanged. All 16 keyboard/pad cruise/near-stall-start roll comparisons improved overshoot and arrest. Near-stall means initial speed 1.1 vStall, not sustained speed. No flapping, calm-air browser override and placement grace removed.
- Corrected render-rate comparison: 80 paired roll trials across all four breeds, keyboard/simulated pad, cruise/near-stall starts and 30/60/120/144 FPS plus jitter. Pad cruise overshoot reduction 10.8–11.3% at every timing; onset unchanged, arrest no worse, and every near-stall-start overshoot improved. Existing tests preserve Skimmer > Harrier > Ironback > Galewing responsiveness and slower heavy-breed roll-in/out. These are deterministic scripted trials, not human approach alignment or physical-controller latency/playtest evidence.
- Checks actually run: focused FlightModel/Player/input 151 passed before adding the four new cases; FlightModel with new cases 60 passed; npm test 909 passed across 90 files; npm run typecheck passed; npm run build passed; node scripts/smoke.mjs --no-build --port 5391 passed 15/15, including production startup and no reported errors. Existing golden fixtures/tolerances were untouched. Final whitespace and scope checks recorded below.
- Evidence: /tmp/driftwing-gateb-candidate/assessment.md and comparison.json; original unchanged-source baseline in /tmp/driftwing-gateb-baseline. Authoritative multi-rate baseline is /tmp/driftwing-gateb-rates-active-before/results.json; candidate /tmp/driftwing-gateb-rates-corrected-after/results.json; comparison verified-comparison.json in that candidate directory. Matching six-frame-per-breed visual sequences: /tmp/driftwing-gateb-visual-active-before/index.md and /tmp/driftwing-gateb-visual-after/index.md. Representative arrest frames inspected for all four breeds; chase views do not establish anatomical close-up quality or subjective controller feel.
- Measurement corrections: initial temporary multi-rate scheduling could hold a command one extra frame at a floating-point boundary. An initial in-page baseline override also imported a separate Vite module instead of the active HMR module. Those comparisons are superseded. The final baseline override imports the active resource URL and asserts its FlightModel constructor equals the player's constructor before setting original tuning. No repository rollback was needed. Initial sequence shot names also overwrote earlier breeds; unique per-breed recaptures supersede those images. Pillow remains absent, so individual PNGs/JSON are available without contact sheets.
- Existing-tool cost proxy, isolated after smoke: /tmp/driftwing-gateb-cost-active/measure/cost-before.json and cost-after.json, with verified active-module tuning overrides. Full-frame CPU medians 0.3092 → 0.2892 ms; sampled allocation 8,354 → 7,036 bytes/frame. After runs ranged 0.1692–0.4142 ms and load differed, so these do not establish a causal performance improvement or zero allocation. This is the existing showcase/frame proxy in SwiftShader, not an isolated roll-physics benchmark or physical-GPU measurement. Geometry unchanged: Harrier 21,502, Skimmer 21,666, Galewing 21,926, Ironback 25,490 triangles; 58 bones each.
- Remaining decisions: owner keyboard/controller playtest of the small braking change; unavailable feat/loop overlap remains unreconciled, as explicitly accepted for this isolated experiment. Broader rider attachment/boarding and anatomical work remain separate. Next authorized action after delivery is owner review, without automatic tuning expansion, integration, commits or deployment.

- Final Gate B checks: git diff --check passed. Hash/file-list comparison with the approved baseline found exactly the three approved files changed, with no added or removed files; all pre-existing work preserved.

## Approved mounted foot-contact correction — 2026-10-09

- Authority and baseline: owner approved the focused stirrup/boot correction and its verification on dev/codex-wsl at 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe plus the existing working tree. Missing dragon2/e overlap was explicitly accepted for independent work. No commit, integration, push, deployment, dependency change or other checkout edit.
- Game injects the existing Wyvern.socket lookup into Rider. Rider resolves current world stirrup holds into its current anchor after the wyvern update, using reusable vectors/matrix. Missing providers or individual holds retain the original flank-fit fallback; no stale contacts. No new attachment subsystem or tack geometry changes.
- The mount layer supports the boot sole under the ball on the existing 18 mm brass tread, using actual ankle bind height rather than the different nominal RigDims.ankleY. Supported leg IK compensates the rig's small fore/aft bind offsets, blended by mount weight; the original on-foot/fallback solve remains intact. Build rebuilds refresh cached leg lengths/hip offsets without resetting smoothing or changing hand behavior. Existing torso/hip choreography, mount/dismount timing, wyvern animation and flight physics were not changed in this pass.
- Final tests cover 4 breeds × 3 rider builds × 4 saddles × 8 poses: actual skinned boot surfaces within 2 cm of the socket centre, outside the 18 mm rod there, and within 3 mm of its top; limb reach below 99%; lower-shin clearance against the barrel profile. Expanded mounted wing-clearance coverage includes every build and all four saddles with original clearance assertions. Moving/banking trials cover 30/60/120/144 FPS and jitter, look/saddle rebuilds, zero-duration updates and teleports. Missing-hold fallback and on-foot standing/walking/running/turning equivalence also pass.
- Checks actually run: final focused attachment/mounted 27 passed before adding the on-foot case; full suite with that case 931 passed across 91 files; final attachment suite with the additional metal-clearance assertion 22 passed. Typecheck and production build passed. Production smoke (node scripts/smoke.mjs --no-build --port 5391) passed 15/15, including runtime quality switching and no reported debug/production errors. Existing golden fixtures and tolerances were untouched.
- Unchanged-source baseline and final browser comparison cover all 48 combinations / 384 staged poses / 1,344 paired skinned surface samples. Maximum boot-surface distance to socket centre: Harrier 27.76 → 1.815 cm; Skimmer 31.48 → 1.815 cm; Galewing 30.49 → 1.815 cm; Ironback 26.60 → 1.815 cm. Final minimum 1.810 cm. These distances include the rod thickness, not an air gap. Paired hand-surface distances are identical; maximum leg reach about 93.9%, minimum knee flexion about 40.3°. Unsigned distances do not by themselves prove absence of every possible mesh intersection.
- Evidence: /tmp/driftwing-foot-assessment.md and driftwing-foot-assessment.json. Final default-saddle before/after captures and real Player mount/dismount snapshots are in /tmp/driftwing-rider-{breed}-captures and /tmp/driftwing-foot-{breed}-captures-surface. Additional saddle baselines/final telemetry are in /tmp/driftwing-foot-{breed}-variants-before and -variants-surface; those transition traces use the default saddle. All three additional saddle types across every build have extra idle/flare views in /tmp/driftwing-foot-saddle-views, plus elevated rear bank/kneel/flare views. Representative comparisons for every breed and saddle type were inspected with no new boot/body/metal clipping observed. Some front/side views are occluded by neck/wings; visual review is representative, not exhaustive. Pillow remains absent; individual PNGs/JSON were saved without contact sheets. Interim -after, -final and -verified captures are superseded by -surface.
- Existing-tool cost sample (600 CPU / 300 allocation iterations, high quality): full-frame CPU median 0.235 → 0.1675 ms; mounted rider 0.071 → 0.0695 ms. Sampled allocation: full frame 8,362 → 8,567 bytes/call; mounted rider 1,535 → 1,645. Host load differed and CPU run ranges overlap, so no causal performance improvement, allocation-regression attribution or zero-allocation claim. This is a SwiftShader/browser CPU proxy, not physical-GPU evidence. Raw comparison: /tmp/driftwing-foot-cost-comparison.json. Wyvern triangles unchanged (21,502 / 21,666 / 21,926 / 25,490), 58 bones each; rider inventory unchanged.
- Remaining scope: broader boarding/kneeling behavior and legacy arm bind-dimension caches were not corrected. Controlled presentation staging and directly invoked Player transitions are not a human flight/controller or input-discoverability playtest. Owner visual/play review at http://localhost:5174/ is next; no automatic expansion, integration, commits or deployment is authorized.


## Mounted posture follow-up — scoped trial stopped for hardware approval (2026-10-10)

- Objective: knees forward and less splayed, with a squat-like saddle posture. Owner approved animator/attachment/mounted-test changes and runtime validation, with hardware changes requiring a separate decision.
- Workspace: /home/robert/Projects/Driftwing-Codex; dev/codex-wsl at 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe. Existing uncommitted work preserved.
- Captured 48 unchanged baseline side/rear idle/flare views across four breeds and three rider builds with the existing dragon-capture harness: /tmp/posture-before/index.md. Recreated temporary manifests because earlier /tmp evidence was unavailable. Started local dev server on port 5174 for approved captures.
- Two knee-pole trials preserved the original contact/clearance checks, but did not meet the proposed forward-dominant posture criteria. Added exploratory forward-posture assertions failed; they were not weakened. Trial edits and diagnostic assertions/logging were removed by restoring only this turn's changes. Hash comparison confirmed all tracked/untracked project files identical to turn start before this append.
- Fixed-contact geometric bound, slight build/default saddle/settled idle: knee flexion about 50.59 degrees; maximum forward knee travel from hip about 8.22 cm; minimum outward travel about 21.13 cm (separate extrema). Equivalent bounds measured for all four breeds in that scenario. Knee-pole rotation cannot deepen flexion with fixed hip/ankle and limb lengths. /tmp/posture-findings.md records measurements. /tmp/posture-after is incomplete, discarded-trial evidence, not a delivered implementation.
- Source finding requiring expanded scope: src/creatures/wyvern/parts/saddle.ts clearOf(q), lines 522–530, samples hide into p. Its shin check at line 556 passes p as q, so hide sampling overwrites the queried point and p.distanceTo(q) becomes zero. This forces a negative sampled clearance and drives outward fitting to its upper bound. This aliasing is established by source; a correction has not been implemented or runtime verified.
- Focused checks on unchanged restored source: attachment and mounted tests passed 28/28 across two files. Four isolated default-saddle matrix cases also passed with diagnostic measurement. No full tests/build/typecheck/smoke run: no implementation retained, pending hardware scope decision. No golden changes, commits, integration, push or deployment.
- Proposed next scope for owner approval: fix only the saddle fitter's query/sample-vector alias, then align the mounted knee direction with the corrected existing tread sockets. Expected files: parts/saddle.ts, rider/animator.ts, rider/attachment.test.ts, mounted.test.ts, wyvern.anatomy.test.ts, append-only AI_HANDOFF.md. Preserve seat/grip, limb proportions, flight and gameplay. Verify hide/tread/boot/wing contact across all 48 breed/build/saddle combinations, matching captures, focused and full checks, production smoke. No such expanded work is authorized yet.


## Mounted saddle-fit correction — implemented and verified (2026-10-10)

- Owner explicitly approved the expanded saddle-fit correction, knee alignment, tests/captures and production verification. Workspace /home/robert/Projects/Driftwing-Codex; dev/codex-wsl remains at 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe. No commits, branch integration, pushes or deployment.
- src/creatures/wyvern/parts/saddle.ts: use a separate reusable shin query vector so hide sampling cannot overwrite its clearance query. Correct the tread's ankle-relative fore/aft offset from -0.06 to +0.06 m: the supported boot ball is ahead of the ankle in +Z. This changes fitted stirrup hardware while preserving the seat-height and grip calculations, limb proportions and fitting clearance requirements.
- src/creatures/rider/animator.ts: supported knee pole points forward with a small inward bias (mirrored x=-0.35, z=1). Keep the existing boot-ball target on the 18 mm tread, ankle attitude, bind-offset correction, hip/torso/hand choreography and missing-socket fallback. No new per-frame allocation; the added fit vector is constructed with the cached straddle fit. No performance benchmark was run for this package.
- Regression coverage expanded in rider/attachment.test.ts and wyvern.anatomy.test.ts: neutral forward knee, all-pose forward knee/back-folded shin, and independently reconstructed fitted shin running primarily back rather than sideways. New regressions fail against the unchanged baseline (two isolated failures), and pass on the correction. An initially proposed 8 cm forward-knee requirement for every pose failed in flare because existing brace choreography moves the hips forward; keep 8 cm for neutral and positive forward travel for every pose. No pre-existing assertion, golden fixture or tolerance was weakened or regenerated.
- Focused final attachment/mounted checks: 28/28 passed. Focused anatomy/attachment/mounted matrix before final inward-pole refinement: 69/69 passed; final full suite includes those files and passed 931 tests across 91 files. Final npm run typecheck, npm test, npm run build and node scripts/smoke.mjs --no-build --port 5391 passed; smoke 15/15, including debug/production error checks, keyboard flight, pause/resume and quality switching. git diff --check passed.
- All 48 breed/build/saddle combinations retain boot/tread contact and existing lower-shin/body and wing clearance checks. Existing timing/rebuild/moving/banking tests cover 30/60/120/144 FPS, jitter, zero dt, teleports, missing holds and on-foot equivalence. Automated limb/capsule and surface sampling are not exhaustive triangle-intersection proof or a human controller playtest.
- Final visual evidence: /tmp/saddle-fit-verified/index.md and results.json, with all 120 expected image IDs and files checked: 48 matching default-saddle idle/flare side/rear views, plus 72 additional-saddle idle side/rear views. All 48 combinations represented. Matching unchanged default-saddle views: /tmp/posture-before/index.md. Review links/limitations: /tmp/saddle-fit-review.md. Representative comparisons inspected across every breed, every rider build and all saddle styles; no new clipping observed in those views. Royal decoration occludes some rear views; side views and automated coverage provide additional evidence. Capture flare labels describe the wyvern pose; rider channels are recorded separately, and braced-rider behavior is covered by unit tests.
- Capture recovery: initial large run lost Chromium; one sequential batch runner ended with exit 143. Causes unverified. Smaller batches and one isolated retry recovered all expected final images/telemetry. Original failed/partial runs remain for diagnosis; /tmp/saddle-fit-final, -after and -preview* are superseded by -verified. Captures use the existing harness and temporary manifests, without project tooling changes or dependency installs.
- Neutral Harrier/slight example: forward knee travel about 5.84 -> 9.37 cm; outward knee travel about 28.92 -> 22.97 cm; flexion about 50.59 -> 74.14 degrees. Before telemetry is settled unit-test idle; after telemetry is settled showcase idle, with tiny settling differences (not a frame-identical replay). Across final captured showcase poses, flexion 71.34–91.03 degrees and forward knee travel 8.42–14.36 cm. Measurements: /tmp/saddle-fit-posture-measurements.json and saddle-fit-capture-summary.json.
- Default wyvern geometry unchanged: Harrier 21,502, Skimmer 21,666, Galewing 21,926, Ironback 25,490 triangles; 58 bones each. Captures are browser/SwiftShader evidence, not physical-GPU performance measurements.
- Preservation check: file hashes from the start of this package confirm only saddle.ts, rider/animator.ts, rider/attachment.test.ts and wyvern.anatomy.test.ts changed before this append. mounted.test.ts required no edits; its existing tests pass. All earlier uncommitted work preserved. Flight, gameplay, shared world geometry, dependencies and other worktrees unchanged.
- Next action: owner visual/play review at http://localhost:5174/. Stop before further posture/boarding work, scope expansion, integration, commits, pushes or deployment without corresponding explicit approval.


## Small seated-rider lift (2026-10-10)

- Owner reported slight seated clipping and approved an efficient focused correction. Branch dev/codex-wsl, HEAD 1d718e9; prior uncommitted work preserved.
- rider/animator.ts: add 0.01 m to mounted pelvis height, blended through the existing mount layer. Preserve knee direction, seat hardware, hip rotation, hand and boot IK targets, on-foot behavior and flight.
- A 0.02 m trial failed the existing Skimmer neutral forward-knee assertion (0.07788 m versus >0.08 m); reduced the lift to 0.01 m instead of weakening the test or changing the approved leg posture.
- Final focused verification: attachment, mounted and rider gait tests passed 34/34 across three files; npm run typecheck passed. One matching Harrier/medium side capture inspected: /tmp/seat-lift-final/posture/harrier-medium-idle-90.png; baseline /tmp/saddle-fit-verified/posture/harrier-medium-idle-90.png. Representative visual evidence only, not exhaustive seat/garment intersection proof. All 48 contact combinations remain covered by focused tests.
- For this small follow-up, no full-suite/build/smoke rerun; those results in the preceding entry apply to the preceding version. No fixtures, dependencies, commits, pushes or deployment. Next action: owner review at localhost:5174; no automatic expansion.

## Combined build preparation and looping title music (2026-10-10)

- Owner requested bringing all existing edits together with the latest build, including looping title music until gameplay. Workspace /home/robert/Projects/Driftwing-Codex, branch dev/codex-wsl, HEAD 1d718e943aa4e960cd39f2ff3bf82eca362d7cfe. All previous tracked and untracked edits preserved; no merge, commit, push or deployment performed in this step.
- Remote read-only verification: main and latest successful Pages deployment remain bb87b14374ab3e177203385c71cbcb06b472566e, already an ancestor of this branch. Successful workflow https://github.com/rporter33/Driftwing/actions/runs/37949007576. dev/claude remains 4490a59d3e79beca94221214faa6679bfd15d349; its additional work is planning documents, not newer gameplay implementation. No feature snapshots or Claude worktree changes imported.
- New title files: src/audio/assets/driftwing-intro.mp3 (owner-supplied recording, 5,011,419 bytes), src/audio/titleMusic.ts and its focused lifecycle tests. src/audio/Audio.ts routes the looping recording through the existing music bus after gesture unlock and suppresses procedural music scheduling during the title. Game.setScreen forwards presentation screen transitions. Title/menu/Stable before gameplay retain the recording; play stops and disconnects it, and procedural scoring resumes. Existing title artwork and navigation retained. Context visibility suspension and existing Master/Music volume controls apply. No dependency or renderer changes.
- Verification on the complete dirty-tree candidate: npm run typecheck passed; npm test passed 934 tests across 92 files; npm run build passed; node scripts/smoke.mjs --no-build --port 5391 passed 15/15, including production subpath startup, flight, pause/resume, runtime quality switches and no reported errors. git diff --check passed. No golden fixtures or tolerances changed.
- Additional production Chromium check, without an autoplay-policy override: no audio context running before gesture; Enter opens title menu and starts the actual recording; decoded duration 216.0535 seconds; music-bus signal RMS 0.023735; Music and Master mute independently reach zero gain; accelerated native looping crosses the recording length repeatedly without an ended event; Enter into gameplay leaves the title source stopped/disconnected. No page errors or HTTP errors observed. Script /tmp/driftwing-title-check.mjs. Accelerated loop coverage is not a human assessment of the musical seam or device-speaker playback. Browser uses SwiftShader, not physical-GPU validation.
- Limitation: recording uses a decoded WebAudio buffer retained for returning to title, approximately 73 MiB of stereo PCM at the observed 44.1 kHz output sample rate, plus browser overhead. Streaming could reduce this memory if required; no device-memory profiling or low-memory mobile certification was performed. Existing procedural notes may finish their scheduled tails when returning from gameplay to title; no new procedural notes are scheduled during title playback.
- M1 remains the implemented first-site/tutorial slice; later second-site/observation/journal work is incomplete and was not implemented by this release preparation. Ancient Greek remains explicitly provisional and unverified.
- Next action: owner confirms configured commit author Robert Porter <robertporter343@gmail.com> and proposed message "Update shrine tutorial, rider motion, flight braking and title music", then explicitly approves the reviewed combined release to origin/main. Pushing main triggers .github/workflows/deploy.yml and publishes https://rporter33.github.io/Driftwing/. No release approval inferred from preparation; author and main/publication confirmations are pending. Current local build stamp still identifies uncommitted candidate baseline 1d718e9, not a new release commit.

## Combined release approved (2026-10-10)

- Owner explicitly approved the configured Robert Porter author, combined commit message, fast-forward update of origin/main, and resulting Pages deployment after reviewing the combined build and verification above.
- Release scope is the complete reviewed working tree: first-site/tutorial and early-island improvements, rider/saddle and landing fixes, bounded roll braking, capture tooling/documentation, and looping title music. Later M1 work and other feature branches remain excluded.
- Next authorized action: commit on dev/codex-wsl, rebuild with the commit stamp, push the reviewed commit to origin/main without force, and verify the resulting deployment. Record actual release SHA/workflow results in the delivery response; this entry is approval evidence, not a claim deployment has succeeded.

## Windhaven update onto current GitHub main (2026-10-10)

- The owner requested checking GitHub, moving Windhaven onto the latest game version, preserving all work, and saving a separate easily referenced copy. This authorizes the local Windhaven branch/checkpoint work; it does not authorize publication or a main-branch update.
- Current worktree: `C:\Users\Robert\Projects\Driftwing-Codex`; active development branch: `feat/windhaven`.
- GitHub default branch verified directly as `main`, at `844e5c25860aab4c596116df4ffb19fa4e98fd1e` (shrine tutorial, rider motion, flight braking and title music). No remote tags were advertised. Package version remains 0.1.0; the Git commit identifies the game baseline.
- Original blockout preserved in local branch `windhaven/checkpoint-2026-10-10`, commit `974bb32e7e11a0bfd58d9210429c057dfa4da164`. Its parent is `1d718e9`.
- External backup: `C:\Users\Robert\Projects\Windhaven-Backups\2026-10-10-before-update`. Includes 360 SHA256-verified working-source files, screenshots, the supplied concept reference, a source ZIP, tracked diff and a verified complete-history Git bundle.
- Windhaven source applied onto the latest main. The only application conflict was this handoff: upstream history is retained in full and this separate entry records Windhaven. Claude's worktree and local main remain unchanged.
- Windhaven scope: stationary walkable blockout, solid geometry shared with collision, provisional dragon shelter/crafting/cabin spaces, four-breed review controls and deterministic/live browser tests. No moving ship, steering, crafting, stable service or cloth collision is implemented. See [WINDHAVEN.md](WINDHAVEN.md).
- Prior-baseline results: 901 unit tests including 23 Windhaven tests, production build, 15/15 production smoke checks and both Windhaven browser paths passed. These are historical results, not validation of this updated baseline; fresh results will be recorded after testing.
- Compatibility verification completed on Windhaven code commit `9b9964c0f85bac9dc781e8ac2ce20a9b1830640c`, whose parent is `844e5c2`: `npm test -- --maxWorkers=2` passed 957 tests across 93 files (including 23 Windhaven tests); `npm run build` passed; `node scripts/smoke.mjs --no-build` passed 15/15; `npm run test:windhaven` passed deterministic and live-keyboard checks for all four breeds, saved-breed preservation, pause/reset and reload/recovery, with no reported browser errors. These browser checks used installed Microsoft Edge through Playwright, not the embedded app browser or physical controller hardware.
- An initial browser attempt found no server listening at port 5174. Starting the local Vite server and rerunning resolved that connection failure; no Windhaven source changes were necessary. Keep the preview terminal running when using the review URL.
- Verified current GitHub main is an ancestor of the active branch, the Windhaven implementation matches the preserved checkpoint, and `git diff --check` passes. This documentation follow-up records the tested code commit; use `git log -1` for the final documentation commit.
- Updated recovery snapshot destination: `C:\Users\Robert\Projects\Windhaven-Backups\2026-10-10-latest-main`; entry point: `C:\Users\Robert\Projects\Windhaven-Backups\README.md`. The updated source, screenshots, browser logs and complete-history bundle are saved after the documentation commit. The earlier snapshot remains available separately.
- Next authorized action: owner review and continued scoped Windhaven development. Ship movement and crafting remain unimplemented. No push, deployment or merge into main requested or performed.

## Windhaven art pass 1 (2026-10-10)

- Owner approved the next hull/sail/cabin art pass, explicitly preserving the current ship scale/deck space and following the concept/shared visual guide. Previous clarification: this is the player's traveling home between levels, primarily destination travel and anchored exploration, not constant steering. Several riders can fit; multiplayer remains unimplemented.
- Workspace `C:\Users\Robert\Projects\Driftwing-Codex`, branch `feat/windhaven`; starting commit `dc2b2414e13a64ed732c58dc0d1c219c06f154a7`, based on game main `844e5c2`. The local art commit follows this entry; its exact SHA is recorded in the separate snapshot README and `git log -1`.
- Read the existing architecture, roadmap, shared guide and master v2/pack introduction from art reference commit `f3ef231c6a12ed5865cd73562447f6d94a1730bf`. Inspected supplied Windhaven concept and final rendered captures. Pre-existing AGENTS.md/CLAUDE.md edits and untracked docs/ART_DIRECTION.md were left intact and excluded from the art commit; the complete backup source includes them.
- Changed only Windhaven art/plan/tests/showcase, its dedicated capture script and Windhaven/handoff documentation. Added rounded overlapping hull strakes with exact matching collider boxes, instanced structure, batched fittings, plank detail, connected tapered rails, fuller crescent cloth with matching spars/seams, restrained spiral, opaque arched cabin panels, canvas roof and travel pennon. Original deck rectangles, landing terrace, cabin/workshop footprints and shelter headroom preserved. No flight, creature, world, dependency or renderer changes.
- Final geometry: 13 render meshes, 983 structural instances, 50,367 triangles before shadow passes. Counts are not performance measurements. Cloth/rigging/fittings are decorative; final collision and sculpted production hull remain pending.
- Verification: full suite passed 959/959 across 93 files before final visual refinements; after final rail/material adjustment, focused Windhaven passed 25/25 and build passed. Deterministic/live browser checks passed for all four breeds; final live-only rerun passed four-breed walk, mount/dismount, launch, pause/reset and reload with no reported errors. Final production smoke passed 15/15. git diff --check passed. High-quality capture script produced 11 images and metrics with no reported runtime errors.
- Environment/test recovery: the first full-suite sandbox run had temporary SSR-file ENOENT import failures (75 suites), resolved by running outside sandbox. Initial art automation omitted the first manual render, leaving the canvas intercepting review clicks; the script now renders before interaction and completed successfully. Neither recovery required gameplay changes.
- Visual evidence: `shots/windhaven-art/`, generated by `scripts/windhaven-art.mjs`; high quality, 1440x900, Edge/Playwright with SwiftShader. Category-by-category source, evidence and status are in docs/WINDHAVEN.md. Eleven views cover inspection, on-foot, mounted, launch, short bank/tuck/flare inputs and dismount. Not an exhaustive sustained-dive, all-breed animation, physical controller or physical-GPU test.
- Known visual limits: original bow steps and square mast cross-sections remain; furnishings/interior remain simple; cloth is static. Shelter underside briefly occupies the upper takeoff/bank frame while the forward route/dragon remain visible. The review panel occludes left-side scenery in close views. No final runtime-art compliance or production gate closure claimed.
- Separate saved snapshot destination: `C:\Users\Robert\Projects\Windhaven-Backups\2026-10-10-art-pass-1`, with source hashes, source ZIP, captures, test logs, concept reference and verified full-history Git bundle. Root README indexes this and both earlier snapshots. The save happens after the scoped local commit; no push, main merge, deployment or other worktree changes.
- Next authorized action: owner reviews the art pass at `http://127.0.0.1:5174/?view=windhaven` (Cabin button added). Continued Windhaven work should preserve the approved usable space and prioritize the traveling-home role; destination travel, crafting and stable services are still not implemented.

## Windhaven art pass 2: open windows, rounding, hitch mounts and wind cloth (2026-10-10)

- Owner explicitly requested see-through/glassless cabin windows, another rounding pass, four side hitch provisions for future dragons/players, and wind-driven sail cloth physics. Working branch `feat/windhaven`; starting HEAD `35b7931870ab60a9311cb1ecef218f0b1b97d483`, above game main `844e5c2`. The scoped commit follows this entry; exact revision is in the separate snapshot README and `git log -1`.
- Added eleven actual arched openings to cabin masonry/collision with interior/exterior decorative frames. Rounded stern corners, elliptical bow, finer underbody strakes, rounded post/mast/rail/furniture/roof footprints. Overall 72 m length and 28 m beam retained, including protected landing, workshop and shelter routes; perimeter corners/bow change, not every old rectangle.
- Added optional `BoxCollider.roundXZ` and corresponding signed-distance/top-support logic. Default box behavior is unchanged; rounded render vertices are tested against the same collider surface. Only Windhaven opts into it. No dragon flight or player-controller changes.
- Four side hitch mounts and named reserved sockets, one capacity each. Collidable rounded posts/bases plus decorative rings. No gameplay occupancy, tether attachment, multiplayer or extra dragons implemented.
- `SailCloth.ts` reuses the existing rider cloth solver for four main sails, four lower fins and the pennon (2,925 particles), with fixed 120 Hz steps, pinned spars, bend/stretch constraints, damping, travel limits and live `Weather.windAt` samples. Procedural UV linen marks deform with the surface. CPU geometry, normals and bounds update for correct rendering/shadows. Inspection freezes the player but leaves wind/cloth live; pause stops cloth. No new wind system or flight-force changes. Roof/shade covers remain fixed; cloth self/contact collision and propulsion remain future work.
- Review buttons: Windows, Hitches, Clear wind, Breezy wind. The same stationary showcase remains accessible at `http://127.0.0.1:5174/?view=windhaven` through the existing local server.
- Verification: full suite passed 965/965 tests across 94 files before the final bow-overlap adjustment; final focused geometry/cloth/collision/player suite passed 40/40 across 3 files. Final `npm run build` passed. One intermediate test-only BufferAttribute type error was corrected. `git diff --check` passed.
- Final deterministic and live-keyboard Windhaven browser paths passed across all four breeds: walking/deck support, mount/dismount, launch, pause/recovery and reload, saved breed retained, no reported errors. Standard production smoke passed 15/15. Edge/Playwright with SwiftShader; no embedded-browser, physical controller or physical-GPU performance certification.
- Final high-quality art capture script produced 15 images and metrics in `shots/windhaven-art-2/`. Browser assertions measured all nine cloth panels moving in breezy weather with zero pin drift, confirmed pause freezes them, and reported no runtime errors. Final counts: 26 meshes, 2,374 box instances plus merged rounded solids, 97,920 triangles before shadows. Initial window capture exposed arch stepping; finer angular slices improved the final close-up. Final windows/hitches, overall silhouette and representative on-foot/takeoff views inspected. Evidence matrix is in `docs/WINDHAVEN.md`.
- Remaining limits: static ship; provisional high-level art with straked rather than fully sculpted hull and simple furnishings; no glass material needed because windows are open; no cloth self/contact collision; bounded stylized sail response rather than calibrated aerodynamics. Shelter underside still enters the top of the launch camera and the review panel covers some left scenery. Exhaustive wing turns/animation clearance and hardware performance remain open.
- Pre-existing AGENTS.md, CLAUDE.md and untracked docs/ART_DIRECTION.md preserved and excluded from the scoped commit. External snapshot `C:\Users\Robert\Projects\Windhaven-Backups\2026-10-10-art-pass-2` saves verified source hashes, ZIP, 15 captures/metrics, test logs, concept reference and verified complete-history Git bundle after commit. Root README indexes it; prior snapshots remain intact. Source snapshot includes the pre-existing guide files; the bundle alone does not include uncommitted guide edits. No main merge, push, deployment or other worktree edits.
- Next authorized action: owner reviews the new windows/hitches and sail motion in the local browser; continued scoped Windhaven development retains the traveling-home role. Functional hitching, destination travel, crafting, stable services and persistence remain separate future milestones.

## Windhaven art pass 3: continuous hull and terrace hitches (2026-10-10)

- Owner requested another hull pass closer to the supplied concept, with unchanged scale/usable deck, and hitches closer to the open deck; some obstruction is explicitly acceptable. Worktree `C:\Users\Robert\Projects\Driftwing-Codex`, branch `feat/windhaven`, starting HEAD `92d66901f16cd32830d5ea9a736543b8ad640abb`. Game baseline remains `844e5c2`; no upstream update was requested this turn. Exact final commit is in the separate snapshot README and local Git log.
- Read AGENTS, architecture, roadmap/shared art guide, reference master/pack introduction and supplied Windhaven concept. Replaced 1,728 stacked hull boxes with a closed convex shell generated from curved cross-sections in `windhavenHull.ts`. Smooth normals, procedural longitudinal timber lines, blue band, restrained bronze borders and darker swept keel improve the underbody. Hull stays within 72 by 28 m, bottom approximately -7.18 m relative to deck. Every deck part/shape and cabin/workshop/shelter footprint remains unchanged from pass 2.
- Shared geometry contract: optional convex triangle/plane data on a bounded BoxCollider, exact closest-triangle exterior distance and supporting-plane interior distance in `convexDistance.ts`, top-support polygon check and actual debug wireframe geometry. Hull rendering and collision use the same triangles, with no leftover block collision beneath a smooth visual cover. Ordinary and rounded boxes retain existing behavior. No flight/controller, dependency or rendering-pipeline changes.
- Four existing hitch IDs and one-attachment capacities retained. Post centres moved from x +/-13.35, z -4/10 to x +/-11.9, z -29/-13. Posts/bases now occupy the open terrace margins, 2.1 m inboard of the outer edges; sockets follow at x +/-12.33. Central launch path and the tested side landing corridor remain clear. Arbitrary approaches, all wing poses and simultaneous four-dragon occupancy are not certified; functional hitching remains unimplemented.
- Added Hull inspection camera and retargeted Hitches camera. Final capture script saves 16 high-quality images plus runtime cloth metrics to `shots/windhaven-art-3/`. Inspected hull/side/hitch views and normal walking, mounted and takeoff views. Category-by-category source/evidence/status in `docs/WINDHAVEN.md`; no blanket production-art compliance claim. Previous cloth and open windows remain unchanged.
- Validation on final implementation: focused 44/44 across 5 files; full suite 969/969 across 96 files; production build passed. Exact surface/bounds/normals, underside ray/sphere contact, convex corner distance/rotation/top-support/debug view added to tests. Existing all-breed landing/walking/mount/launch tests retained.
- Browser verification: deterministic and real-keyboard Windhaven checks passed all four breeds, saved-breed preservation, pause/reset and reload/recovery, with no reported errors. Standard production smoke passed 15/15. Sixteen high-quality captures confirmed continued motion in all nine cloth panels, zero pin drift and correct pause behavior, with no browser errors. Edge/Playwright/SwiftShader; no physical GPU/controller or embedded-browser certification. Geometry: 26 meshes, 646 instanced boxes plus merged rounded solids/hull, 82,950 triangles before shadows (down from 97,920); this is not a frame-rate claim.
- Known limits: broad stern deliberately preserves usable deck rather than copying the concept's narrow/upturned silhouette; final fittings/material aging and cabin interior remain provisional. Shelter underside still enters upper takeoff view; panel covers some left scenery. No ship travel, stable service, crafting, persistence, functional tethering or cloth contact/self-collision added.
- Separate snapshot destination: `C:\Users\Robert\Projects\Windhaven-Backups\2026-10-10-art-pass-3`, saved after the scoped local commit with SHA256-verified source, ZIP, 16 captures/metrics, logs, supplied reference and verified complete-history Git bundle. Index: parent README. Prior snapshots intact. Pre-existing AGENTS.md/CLAUDE.md changes and untracked docs/ART_DIRECTION.md excluded from commit but preserved in the source snapshot; bundle alone excludes uncommitted files. No main merge, push, deployment or other worktree modifications.
- Next authorized action: owner reviews Hull and Hitches at `http://127.0.0.1:5174/?view=windhaven`; continue scoped Windhaven work with the approved deck size and traveling-home direction.

## Art reference import handoff — 2026-10-10

- Objective: upload the user's complete art reference pack to Git for future Codex art-direction work.
- Working branch: `docs/art-reference-pack`, based on remote `main` at
  `bb87b14374ab3e177203385c71cbcb06b472566e`.
- Completed: preserve the original ZIP and 32 extracted files in `docs/art/`, add
  a browsable index, and point future Codex work to it through root `AGENTS.md`.
- Verification: source/copy ZIP SHA-256 match; all 31 bundled manifest hashes match.
  No game tests or builds run because this is a documentation/reference import.
- Existing development checkouts were not modified.
- Historical repository state and implementation prompts inside the pack require
  revalidation and current task authorization; importing them does not authorize gameplay work.
- Next step: review the reference import for integration. Use the images and specifications
  in subsequently authorized art tasks.

The import commit is the Git commit introducing this file; this is a static handoff snapshot.

## Game development resources — 2026-10-10

- Objective: upload the owner's eight game development resource links.
- Branch: `docs/game-development-resources`; resource directory introduced in
  `de02b3d23a736b05959a7950de8b7383bf1e7948`.
- Added `docs/GAME_DEVELOPMENT_RESOURCES.md` with all eight resources, direct
  official URLs, categories, and a direct Godot Asset Library link.
- Verification: opened the eight resource destinations; Mixamo returned an empty
  text extraction, so its interactive functionality was not verified. Checked
  the directory for completeness and relative documentation link targets.
- No game tests or builds run: documentation-only change.
- Next action: review the resource directory pull request for integration.

## Authorized Windline gameplay integration — 2026-10-11

- Objective: Robert requested all completed Windline work integrated and merged in the latest build, excluding the unfinished Windhaven ship and deferring the updated character model. Commit/push, draft PR, promotion, merge and existing Pages deployment are explicitly authorized after applicable checks pass.
- Verified remote baseline: `f9fc707d55cea36f62307d8a58ba9c00361be253`. Dedicated branch/worktree: `integrate/windline-gameplay`, `/workspace/Driftwing-windline`. Initial implementation commit: `be356c5357e16f0bf9d441663cac0fc71eda50e6`; the subsequent verification/input follow-up is recorded as PR #4's final head. Original `/workspace/Driftwing` checkout and character/other branches were left untouched. No `.agents/skills` directory exists in this checkout.
- Normal Game initialization installs the existing static-world traversal adapter and render-only equipment without showcase solids. Device-aware HUD hints/reticle/boost feedback respect menus and HUD visibility. Controls lists traversal; Settings persists the existing toggle interaction through the existing version-1 save key and sanitizer.
- Streaming follows the independent rider. Pickups use the rider's existing foot reach; races exit before a riderless dragon can cross a gate. Physical tether releases survive paused input ownership. Normal and experimental resource teardown remain separate.
- Preserved: the first-discovery tutorial and research/save behavior, shared art rules, full references and design documentation, existing renderer/flight tuning/goldens, static dock construction, isolated Windhaven and Windline practice. No ship gameplay, model/wardrobe replacement, moving anchors, new progression design or dependency changes.
- Verification before the final follow-up: 1,133 tests / 108 files; typecheck/build; production smoke 15/15; normal-game browser traversal/save/reload/controller/menu checks; existing Windline practice loop; Windhaven browser smoke across four breeds all passed. Added focused paused-release and same-step race arbitration regressions passed. Exact final-head full suite, browser modes and GitHub CI are recorded in PR #4 and the release delivery; these earlier counts are not a claim about later commits.
- Full local suite on `24e775590e4c2d1363c9592fbf98dd5add25f1fb`: 1,137 tests / 108 files passed, plus typecheck/build. Windline motion, control, input, spin-retention and performance browser modes passed. The final follow-up only clarifies held/toggle Controls copy; the PR's exact final head is checked again by CI before merge.
- Evidence: `shots/windline-gameplay/` and `/tmp/driftwing-windline-gameplay-browser-check.json`; PR CI uploads browser artifacts. Local browser is system Chromium with SwiftShader. Repositioned scenarios use the real Game loop/shared world; controller inputs are simulated. No physical iPhone/controller/GPU tests or complete per-category art certification were performed.
- Cloud setup: Node 24.19.0 locally (Node 22 in CI); `npm ci --cache /workspace/.cache/npm` passed. For local browser scripts use `CHROMIUM_PATH=/usr/bin/chromium`; default Playwright download domains were unavailable in this environment, so no dependency/lockfile change was made.
- Next authorized action: review exact final diff, run final-head checks, promote/merge PR #4 once CI passes, and verify the resulting main SHA and successful latest Pages deployment. Do not bring in updated character work or complete additional M1/ship milestones.

## Approved fluid Windline follow-up — 2026-10-11

- Baseline complete: [PR #4](https://github.com/rporter33/Driftwing/pull/4) merged to main `193e56f382ae29fd44647e4b9c29b2fa31b9e281`. [Pages run 38105521341](https://github.com/rporter33/Driftwing/actions/runs/38105521341) succeeded at 02:40 UTC; its production smoke recorded `Build 193e56f`, 1,137 tests / 108 files, 15/15 smoke checks and normal-game Windline checks. Reported URL: `https://rporter33.github.io/Driftwing/`. Direct live-site requests from this cloud environment are blocked; deployment verification used the actual main workflow/logs. PR CI used GitHub's merge ref; its tree, final PR head and main all equal `764b3a8ff6a7623e124a06e80535e5448911ec27`.
- Robert approved five specific additions after asking to confirm major work: fluid forward freefall/braking; gentle swing steering/smoother pull/natural release; cleaner boost with initial recharge preserved; airborne LT alongside A; compact truthful HUD with anchor/line/boost/recall feedback. Controller first, keyboard/mouse next, phone controls least priority. Enhancement merge/deployment still requires review; authorization to implement/commit/push a separate draft is retained in the conversation.
- Dedicated worktree `/workspace/Driftwing-fluid`, branch `enhance/windline-flow`, based on the deployed main above. The introducing commit and draft PR record its implementation head. No character/model, Windhaven, flight model, art assets, progression/save identities, dependencies or unrelated work were changed.
- Forward steering carries momentum through dives. Back brakes without reversal; combined corrections are capped by the existing 26 m/s² budget, including inherited overspeed. Neutral drag/terminal speeds are preserved. Swing steering rotates the tangent at up to 0.9 rad/s without changing kinetic energy or radial velocity; no steering impulse/reeling. Manual pull eases in over 80 ms and retains shared collision/constraint checks.
- Boost keeps 12 m/s upward rescue, a 0.28-second bounded burst and 1.75-second simulation recharge. Ordinary steering does not fight active thrust. One fresh press in the last 120 ms may queue one boost. Pause/input loss cancels the pending press; pause freezes active thrust/recharge. Attachment and mode interruptions cancel pending actions without refunding cooldown.
- Airborne LT uses a separate latched action and keeps A/Space. Full release is required across context/reconnect; rider LT/RT use 0.55/0.20 hysteresis while mounted analog flap/flare remain unchanged. Scheme-derived glyphs prefer LT on controllers and Space on keyboard. Ordinary ground jumps remain A/Space.
- HUD retains cream/slate/sky/bronze: high-contrast anchor outline; slack/taut/pulling/caught/freefall states; truthful active/queued/recharge/ready meter and aria labels; readonly leap/recall progress. Critical recall feedback survives hints off, with menus/photo mode still hiding the overlay. Narrow portrait placement avoids the aim cue; this is layout safety, not touch-device certification.
- Focused final mechanics/input checks: 119 passed. Full suite before the final bounded-brake follow-up: 1,148 / 108 files passed. Existing normal/save/reload, Windline practice, motion and control browser modes passed. New normal flow harness passed keyboard forward/brake, mapped controller flight→leap→world anchor→pull→release→boost→recall/remount, jitter, pause, pending cancellation, held reconnect and 720p/1080p/narrow layout checks. Zero swing energy growth and no camera roll. Final full suite, smoke/build and exact-head CI are recorded in the draft PR; earlier counts do not substitute for its final checks.
- Browser evidence: `shots/windline-flow/` and `/tmp/driftwing-windline-flow-browser-check.json`. Caught-line UI uses controlled equipment state; physical obstruction retention remains covered by existing Player collision tests. Readable gameplay captures inspected; no blanket art or physical controller/iPhone/GPU certification. Reference Library images could not be downloaded after one supported retry; public articles were read, but external screenshot pixels were not inspected. Hierarchy principles came from the parent; no external game assets were copied.
- PR verification explicitly checks out its final head and stamps that checkout, retaining all meaningful normal/prototype checks. New controller-flow coverage runs in verification and future Pages builds. The deployed baseline is unchanged while this draft is reviewed.
- Next action: finish final-head checks and provide tested draft PR/captures for review. Do not merge/deploy the enhancement without subsequent parent confirmation. Keep updated character work and unfinished ship gameplay outside this pass.

## Bounded audio QA and draft candidate (2026-10-11)

- Objective: normal-game audio QA and narrow fixes, separate from HUD/reticle/traversal PR5/PR6. Repository `rporter33/Driftwing`; verified main/base `193e56f382ae29fd44647e4b9c29b2fa31b9e281`. Isolated worktree `/workspace/Driftwing-audio`, branch `qa/audio-20261011`, implementation commit `f8c2dccd4a6369f3fb095fb6da01373a0133e833`.
- Fixed a real-mixer reproduction where unmuting during the startup fade was later overwritten to silence. Added short existing-palette Windline cast/attach/release/pull/boost feedback through a presentation-only observer. Existing recall cues, music and breed-mass wingbeats retained. No Game/Player/input/HUD/reticle/collision/traversal/shared-contract edits.
- Verification: typecheck; 45 focused audio tests; 1,141 unit tests; production build; 15/15 Chromium smoke; existing normal-game Windline browser check; 42 audio QA checks and 24 offline real-mixer scenes, all passed. Three repeated action cycles each create exactly five cues; 500 attached audio updates create no extra SFX voices. All captures finite/unclipped, dense overlap stress peak −1.1 dBFS.
- Playback capture/export is supported; the listening route explicitly reports audio input unsupported. No subjective listening claim. Human audition, musical seams, fast-dive cue masking, speakers/headphones, mobile and native Firefox/Safari remain review limits. CPU scheduling sample: mean 0.029 ms, p95 0.100 ms, max 0.500 ms; not a device-DSP or total-frame certification.
- Full report: `docs/AUDIO_QA_2026-10-11.md`. Local before/after WAVs and JSON evidence: `/tmp/driftwing-audio-before/` and `/tmp/driftwing-audio-after/`; reproducible harness `scripts/audio-qa.mjs`. Review bundle retained separately; no captured sounds added to runtime assets.
- Integration risk: low overlap with PR5/PR6; audio observes existing optional equipment fields. GitHub CLI auth is invalid, but the connected GitHub app and isolated branch push route work. Next authorized action: parent/user reviews the draft PR and auditions samples. Do not merge or deploy without review; main-only deploy workflow remains unchanged.


## User-reported tether performance and HUD obstruction repair — 2026-10-11

- PR #4 merged; deployed main is `193e56f382ae29fd44647e4b9c29b2fa31b9e281`. Pages run `38105521341` succeeded. Approved flow enhancement is preserved separately in draft PR #5 at `fb51663`; it requires review before merge/deployment.
- Repair branch/worktree: `fix/windline-hud-overlap`, `/workspace/Driftwing-hud-fix`, starting from deployed main. Robert reported gameplay-blocking sustained lag while hanging/swinging and Windline hiding speed/stamina. These repairs take priority over the subsequent fixed-dot/faster-cast request.
- Normal-world profiling reproduces the sustained CPU cost: 55 m swing mean/p95 8.80/13.80 ms per step, 5,855 rock queries; the repaired comparison is 2.62/3.40 ms and 1,501 queries. Exact vertical island intervals eliminate empty hanging samples; moving tethers use a complete conservative envelope at 4 cm spacing (up to 1.5 cm more rock clearance). Body/projectile sampling and exact primitive collisions stay unchanged. No line validation is disabled/deferred.
- Windline reserves visible HUD space and central view; optional guidance compacts on busy/short screens. Geometry remains immediate with reduced motion; stable frames avoid repeated forced layout. Forty responsive state combinations pass rectangle checks and actual captures are inspected. Existing tutorial cards/prompts still crowd each other in extreme portrait stress; this is not a complete mobile-HUD redesign.
- Local verification: full unit suite 1,142 / 109 files, typecheck/build, normal-game save/reload and repeated/interrupted traversal, responsive HUD matrix and sustained cost/repeated attachment checks pass. Exact committed-head smoke/CI results belong in the repair PR before any release. See `docs/WINDLINE_REPAIR_QA_2026-10-11.md` for raw evidence and actual before/after captures.
- Preserve unrelated main work, shared art references, character assets, ship prototype and static dock. No physical iPhone/controller/GPU test claim. Cloud CPU data uses instrumented Chromium with SwiftShader and includes isolated GC/JIT outliers.
- Next: finish exact-head validation/CI and make the narrow repair reviewable separately from PR #5; carry it into that preserved enhancement branch. Then implement the explicitly requested fixed central light-blue/green dot and faster cast, with camera/cast/candidate agreement and no auto-lock, after these defect checks pass. Major enhancement remains draft for Robert's review.

## Bounded repair review follow-up — 2026-10-11

- Parent reviewed repair head `17df8a15c9ae34b76df7a19d7cebcc4352f1bb7f`; CI run `38108560164` passed all verification stages. PR #6 remains draft and requires parent review of the final exact head before merge. Main remains the deployed baseline above.
- Added deterministic underside, angular-seam and spire-tangent clearance tests. These distinguish the former 2.5 cm and repaired 4 cm rock envelopes; sampled cases are evidence, not a universal collision proof. Focused collision/player/lance/placement coverage passed 102 tests in four files; typecheck passed.
- HUD placement reserves discovery-band pseudo-element overflow. Exhausted slots first compact to resource-only status, then suppress the secondary overlay instead of covering primary instruments. Browser coverage requires critical status visible in ordinary stressed states and explicitly tests optional suppression/recovery.
- New browser measurements identify full tested head/tree, actual runtime build stamp, script assets, runner identity/dirty state and time. Screenshot entries include SHA-256 hashes. Fresh clean-head `c1b8e37` HUD/CPU captures and normal gameplay checks passed; manifests/raw comparison replace the exploratory measurements, whose history remains in Git. Source/build identities and actual images are in `docs/qa/`. The following evidence-only commit leaves runtime source and tests unchanged; exact final-head CI is recorded in PR #6.
- Environment recovered: repair and enhancement worktrees respond normally. Requested reticle/faster-cast work is preserved on remote `wip/windline-fixed-dot` at `14807517b1999f8fb262bfecbe913f6b686ab814`; it is not validated or merged. PR #5 still targets its separate earlier enhancement head.
- Next authorized action: run committed-head browser checks, attach fresh evidence, push review follow-up to draft PR #6, and obtain parent review after exact-head CI. Do not merge repair or enhancement without that review.
