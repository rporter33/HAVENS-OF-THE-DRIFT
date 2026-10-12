# Preservation matrix — bounded Blender rider trial

> **PR publication note (October 12):** This document records the full preserved
> local trial at `codex/rider-blender-trial`, including historical restrictions,
> local paths and larger source/evidence inventories. The current separate PR
> preparation stage, included files and fresh candidate results are recorded in
> [MERGE_REVIEW.md](MERGE_REVIEW.md) and [README.md](README.md). Earlier no-commit
> wording remains historical; the current instruction permits PR preparation and
> explicitly stops before merge/deployment. Excluded artifacts remain preserved
> locally rather than being silently represented as included in this package.

Preserved source/artifacts, enabled runtime, intended generated providers and failed-load recovery are distinct statuses. The authored provider is enabled only by `riderTrial=blender`. Empty imported coverage does not count as a successful authored fit. Slight/Broad bodies intentionally retain their existing providers; their static Travel garments and cloth have authored fits. Medium owns the new body, head, hands, feet and crown.

## Source, ownership and status

Remote references were checked live against the recorded commits. PR ownership/commit attribution is rporter33 / Robert Porter; no agent ownership is inferred. The original worktrees are preserved. Raw records are in `evidence/github/`; exact paths and hashes are in the reference/baseline manifests.

| Work | Source / owner | Trial implementation status | Preservation / evidence | Unresolved issues |
| --- | --- | --- | --- | --- |
| Released main | f97bac535611e09c6c732230b5f0ca73b9bbf804; rporter33 | Already an ancestor of the rider baseline. Neutral dot, controller traversal/HUD, released editor/audio retained | Live reference/ancestry checks; full-history recovery bundle; normal production smoke | No release or deployment changed |
| PR #11 rider | 8e055069703c83308d5508ee72e5ad1d15ef348e; codex/rider-c02-proof / rporter33 | Unreleased baseline retained; refined shared body, seven-outfit mixing, materials and localized cloth remain | Original actual status/content hashes; 1,851-entry verified baseline ZIP; dirty patch; unchanged pre-edit build on 5211 | Editor CI 38166348209 passed; integration 38166348207 failed waiting for reticle. Later combined checks did not run |
| PR #10 harness integration | 56399240064f394b51a310bd9f28cffaaa92b1cb; pilot/windkeel-rider-integration-20261011 / rporter33 | Old source/assets preserved; shared-skeleton, refit, stale-request and cleanup lessons reused through the rider's existing lifecycle | Exact commit targeted copies, blob/SHA-256 verification; source inspection and candidate replacement regressions | Older asset itself remains disabled; no entire branch imported |
| PR #9 island kit | de58113d94cfb7d1556bd6326b2393aa234c196e; feat/region-asset-kit / rporter33 | Reference/ownership recorded only | Live PR/head record; no branch merged or island assets integrated | Separate task, no readiness claim |
| Balanced harness A+B | caa8be1701fc6ceb22ed2aa48a153fbcc3f57a54; rporter33 review artifact | Full package preserved; selected design used through later fitted buffers in this opt-in trial | Editable sources/exports/maps/scripts/evidence hashed; centered A+B translated together; C guide and four sockets retained | Source previews remain historical review artifacts, not finished gameplay evidence |
| Motion/fit harness | 5efe2bbaa7154aab9af158d3f87c3694d2e5e686; rporter33 review artifact | Two fit buffers adapted into editable rider equipment regions, current shaders and shared skeleton | Source hashes in WINDKEEL_FITTING.json; export validates final topology/weights; independent byte-identical 79-region re-export; current targeted motion proof passes all three builds | Flight adjustment already baked, never repeated. Original Aerie 12.4 s defect retained in source; scripted proof does not certify gameplay fit |
| Local planning documents | Actual original rider worktree; Robert's uncommitted guidance | Five dirty/untracked documents copied before edits with provenance | BASELINE.json; original ZIP, working patch and source hashes | Original P1/source-pending/planning restrictions remain historical; original files were not updated |
| Approved C02/M01 art | Original rider-review directory; Robert's approved reference set | Reference input only, not a runtime texture or measured blueprint | Brief, approval JSON and four images copied/hash checked; canonical hierarchy and engine integration captures inspected | Near-indistinguishable concept likeness remains an artistic acceptance target |
| Authored rider trial | codex/rider-blender-trial; HEAD 8e05506; this task's uncommitted work | Medium source plus 77 rider regions and two Windkeel fits in one uncompressed GLB, explicit opt-in, shared wardrobe/cloth integration | Native .blend, fitting JSON, reproducible export, verified recovery; current technical/motion, B/accessory/Stable, actual-fit, C/D, 12 hardware cases, 4 delivery/15 smoke checks pass; browser 14/15; 6 A + 4 mixed supplements captured and visually reviewed | Software CPU gate baseline-reproduced/unresolved. Concept likeness, IGP and physical controller acceptance open; no publication |

Harness preservation comprises 227 package files and 18 supplemental scripts. Both later harness revisions independently measure 2,504 triangles, one material, 27 joints and four sockets. Those are asset facts, not mandatory rider budgets. Blender normal/ORM polish and base-color toon preview are not proof those maps are active in Driftwing.

## Capabilities and integration

The evidence identifiers below refer to the current selected Windkeel, with each
run's scope and remaining gaps stated explicitly. Earlier brown evidence remains
historical comparison and recovery material. No overall four-pass completion is
claimed: the software CPU gate is baseline-reproduced/unresolved. A/mixed framing
supplements completed without errors and passed bounded visual review. Browser
14/15, 4 delivery and 15 smoke checks are recorded below. Existing assertions
and tolerances remain intact. Bounded coverage is not exhaustive intersection,
artistic, controller or integrated-hardware acceptance.

| Evidence | Current run / scope | Result and qualification |
| --- | --- | --- |
| T — technical | `shots/rider-blender/windkeel-resting-checks/2026-10-12T04-08-29-505Z/` | Typecheck, 1,310 tests/124 files, 2 existing + 2 authored audit tests, build PASS. Each audit 384 looks/2,304 poses; attached roots/inner vents excluded |
| A — matched views | `shots/rider-blender/windkeel-resting-visuals/2026-10-12T04-30-26-708Z/`; replacement back supplement `2026-10-12T05-05-24.159Z` in the same parent | 40 retained + 6 replacement images, both runs zero errors; old CSS-transition A rejected. Six replacement rear views reviewed as clear and matched; hashes verified |
| B/X/S — wardrobe, accessories, Stable | `shots/rider-blender/windkeel-resting-visuals/2026-10-12T04-15-43-201Z/` | 236 B captures, 63 accessory captures, 14 Stable checks PASS. Mounted breed views are diagnostic engine cameras |
| F — actual fit/transitions | `shots/rider-blender/windkeel-resting-fit/2026-10-12T04-35-17-437Z/` | 32 captures/4 cases/zero errors; three Travel builds + Medium Flight; actual takeoff/landing/dismount/walk/run and both gameplay-mounted sides |
| M — targeted motion | `shots/rider-blender/windkeel-resting-motion/2026-10-12T04-07-24-937Z/` | All three builds zero sampled crossings/remaining at 26 samples/build including 12.4 s; scripted stand-in seat |
| CD — gameplay/lifecycle | `shots/rider-blender/qa-cd/report.json`; mixed Stable supplement `shots/rider-blender/windkeel-resting-fit/2026-10-12T05-08-15-853Z/` | 26 checks/23 captures PASS; only intentional 404 proof error. 40 simulated seconds/70 replacements, live geometries/textures stable at 111/8. Four actual Stable mixed views captured/zero errors and visually reviewed without gross gaps or duplicate surfaces; hashes verified |
| G — dedicated hardware | `shots/rider-blender/qa-performance/report.json` | 12 cases/zero errors; RX 9070 XT / D3D11, Edge 155, 1440×1080. No IGP, GPU timer or total VRAM certification |
| P — original software CPU gate | `shots/rider-blender/performance-solo/report.json`; current full-browser command 09 | Standalone baseline PASS/trial FAIL (29 ms vs 20 ms). Full-browser depth-55 p95 trial 31.9 / baseline 24.4 ms both FAIL the same 20 ms assertion. Generated opt-out on both; baseline-reproduced/unresolved, differing observations retained |
| W — full browser and delivery | `shots/rider-blender/full-browser/report.json`; current delivery/smoke reports | Original workflow 14/15 PASS; 16 entries include automatic baseline CPU failure. Delivery 4 / smoke 15 PASS. No tolerance weakened; CPU gate still open |

| Capability | Integration method / status | Regression evidence | Unresolved gap or qualification |
| --- | --- | --- | --- |
| Seven complete presets | Existing catalog and outfit providers retained; shared Medium authored body optional | Current T/B/S, including preset/build coverage and real restoration/reload | Slight/Broad bodies intentionally generated |
| Eight mixing categories | Resolve existing sources independently; replace owned regions | Current T pairwise 384-look audit, B individual choices/builds, CD real Stable legacy top + authored trousers + Scout boots; four new actual Stable mix views | Not every eight-way Cartesian combination; visual review qualified separately |
| Match Outfit / None / restoration | Existing wardrobe resolution and Stable controls retained | Current T/B/S/CD complete restoration and reload | No new cosmetic ID/save field |
| Parent outfit unlocks | Existing sourceOutfit rules, no runtime bypass | Current T/S/CD locked-parent and piece checks in isolated fixtures | Test unlock records stay in fresh contexts |
| Saves / combinations / Preview / Revert | Trial query outside RiderLook; late load uses latest appearance | Current S/CD real preview, Revert, save/reload and late completion | Failed-load recovery distinct from authored fit success |
| Efficient recoloring | Explicit surface/UV/recipes, same shader/material/geometry/skeleton | Current T/S/CD identity checks; G 20 Stable dye changes preserve geometry/skeleton/solvers | No arbitrary Blender graph/new PBR pipeline; CPU median 5.2 / p95 7.8 ms excludes subsequent upload/render |
| Builds / Travel preset | Medium authored body; explicit three-build static garment/cloth fits; complete Travel Medium/Aerie | Current T/B and F all three Travel builds; 2,304-pose audit; CD quality/mix round-trips | Slight/Broad trousers retain fitted providers |
| Wanderer / compact Aerie | Existing explicit cut, no automatic conversion | Current T/B long-cut/raised-arm views and strict cut-specific source | Compact Aerie deliberately differs from concept traveling silhouette |
| Ponytail identity / motion | Refine crown only; retain tie/root/tail solver/envelope | Current T/B/F/CD attachment/movement; A front/side/back including six replacement rear views | Concept's short tie differs; artistic likeness remains open |
| Hair / headgear / scarves / capes | Existing coverage/attachment providers; Medium face replacement | Current T/X 63 accessory captures across three builds | Selected high-risk layers, not every accessory stack |
| Rig / animator / IK / equipment | One canonical 27-joint skeleton; validate/dispose imported skeletons | Current T strict bind/inverse/weight/joint tests; F/CD actual motion | No imported clips, separate ownership or double motion |
| Saddle / reins / stirrups / mounted boots | Same saddle/socket/IK contracts; same mesh ownership | Current B four breeds/both diagnostic sides; F/CD actual takeoff/landing/dismount and flight sides | B views are diagnostic, not controller flight; physical controller play unverified |
| Flight feel / shared geometry / Windline | No physics/traversal/world-geometry tuning | Current T/F/CD movement/banks/dive/brake, Windline/deck; W reticle/editor/audio and smoke pass | Historical remote reticle failure remains separately recorded; current CPU gate still fails |
| Localized hems/tabards/tunics/robes/coats/sleeves | Existing solver/specs; four Travel details follow coarse guides | Current T existing+authored audits, B and CD motion | Guided regular-sheet binding, not arbitrary imported cloth topology |
| Pinned seams / cloth differences | Signed controls/weights/pins, zero pinned offsets; original linen/heavy configs | Current T/M, CD reversals/calm/hitches/dyes/quality | Audit excludes sewn roots/inner vents |
| Rig-supported leather / articulated metal | Existing providers; bracers/keeper use forearm/shoulder support | Current T/B/F/M, preserving authored hip/thigh loads and rigid motif | Historical Linen Arm Wraps label retained; trial interpretation leather |
| Bounded wind / inertia / calm recovery | Original solver/config; offsets transported once | Current T stress/proxy audits, M, CD sustained movement/changes | No self-collision or unlimited wind/teleport guarantee |
| Body / mount / ground / deck contacts | Existing capsules/shared standing queries, final detail correction | Current T free-particle/vertex/edge/centroid proxy checks; F/CD real ground/deck movement | Not arbitrary-world collision or all layer intersections |
| Final rendered correction / lining | Existing final projection/smoothing/normals/lining retained | Current T free final-surface audit, B raised-arm/sleeve/seam views, M rear-link proof | Sampled capsule proxies; sewn-root exclusions remain |
| Shoulder construction | Continuous 2 mm deltoid wrap, shallow folds, spiral brooch, narrow right keeper | Current B/F/A views including visually reviewed rear replacements; rejected bulky sources preserved | Inferred hidden construction; bounded views do not establish exhaustive fit or concept likeness acceptance |
| Quality continuity / memory | Existing 1K/2K/3K/4K atlas, retained solvers | Current A/B/CD tiers, G deduplicated inventory: final-Low active 77,604,862 bytes + known unused color tiers 121,634,816 = 199,239,678-byte lower bound | Decoded 16,491,136 bytes already in active buffers, not added again; unobserved allocations/driver VRAM excluded; IGP unverified |
| Async loading / stale requests / disposal | Candidate-before-release, epoch protection, working resources retained on failure | Current T/S/CD delayed Revert/intentional404/stale/disposed/rejected checks; 70 replacements, live 111 geometries / 8 textures unchanged | Immutable source/cache buffers remain deliberately resident |
| Brown comparison / recovery | Original rigid presentation remains opt-out and failed-load recovery; previous fitted brown trial and evidence preserved before Windkeel | Unchanged brown-provider regressions, readback-hashed predecessor archives and original build | Earlier brown-for-now choice is historical; selected trial now uses Windkeel |
| Selected Windkeel / shared skeleton | Existing candidate lifecycle, shared skeleton; rigid centered motif, shared shoulder/waist ring weights, retained hip/thigh weights, four render-only sockets | Current T/M/F/CD all-three-build static/motion/actual gameplay checks; native 79-region export reproduced exactly; A/mixed supplements visually reviewed | Software CPU and artistic acceptance remain open. Semantic atlas translates base-color identity; preserved normal/ORM maps inactive |
| Rear links / live skirt | Leather over trousers; first two rear-link rings tuck 6 mm under pinned waistband; final free cloth corrected within hard cap/seam-distance budget; pins/solver unchanged | Current M zero crossings/remaining across three builds at 26 samples/build including 12.4 s; T impossible-contact/no-drift tests; F/CD actual motion | M is scripted stand-in-seat; F/CD supplement, not exhaustive intersection proof |
| Offline / subpath delivery | Self-contained uncompressed GLB, no external image/buffer/decoder | Current CD loaded offline look/dye round-trip and W delivery 4 / smoke 15 pass | Cold offline reload without server/service worker not claimed |
| Measured performance | Matched baseline/trial, separate CPU/cadence and memory records | Current G 12 dedicated cases/zero errors; Low 60 s rAF p95 6.3→12.2 ms / CPU submission p95 3.7→9.2 ms; CD 40 simulated seconds stable resources | P baseline-reproduced/unresolved; standalone baseline PASS/trial FAIL retained. No IGP / GPU timer / total VRAM / controller certification; hardware PASS does not cancel software gate or establish zero additional cost |
| Recovery / reviewability / ownership | Original live archive + history bundle + preserved build; reference/predecessor archives; separate pre-resting-fit resume checkpoint | Resume ZIP readback-verified 1,651 files; SHA-256 4483719753713a69e5f6326096672b95c42fc5c6a87beb7f516094a5a2823881; independent re-export proof outside runtime tree | Final trial archive/diff, final original status/content and service checks remain delivery work. Trial local/uncommitted; broader production and release actions require separate authorization |

Resume checkpoint: `C:/Users/Robert/.codex/visualizations/2026/10/11/01a12d01-df73-7353-bddb-5533013056c8/rider-resume-20261011/CHECKPOINT.json` and `trial-before-resting-fit.zip` (926,455,658 bytes). Re-export proof: the same visualization root's `reexport-proof-20261011/REEXPORT_VERIFICATION.json`, with Blender log, copied inputs and generated GLB. The final evidence manifest and generated `review-data.json` identify contained paths/hashes, including visual-review provenance under `inspection-sheets/bounded-review`. Final source/evidence/recovery records are generated during delivery. The CPU gate remains unresolved; visual review is qualified separately, and overall green acceptance is not inferred from browser 14/15, delivery 4 or smoke 15.


## October 12 continuation — additive fit evidence

| Capability / preserved work | Integration / status | Fresh regression evidence | Unresolved limits |
| --- | --- | --- | --- |
| Existing corrected Windkeel and continuous shoulder wrap | Runtime/native/export unchanged; guide reread, local opt-in retained | 32 full-fit captures across three Travel builds + Flight; actual takeoff/landing/dismount in all four cases; shared skeleton, four sockets, finite surfaces; 24 Stable/mounted views visually inspected | Mounted distance and hidden surfaces limit fine-fit claims |
| Clear walking/running evidence | QA framing supplement only, actual follow rig/ground contacts, fresh contexts | Eight Medium Travel/Flight front/back captures inspected; zero errors and unchanged sources; eight obstructed originals retained/excluded | Scripted software-rendered evidence, not physical controller or hardware performance |
| Original/working checkpoint and backups | Original ownership, ignored sources, planning documents and services retained | 1,851 original hashes/status unchanged; 1,112 trial checkpoint files unchanged after QA; full original recovery ZIP retained plus additive refresh archive | CPU gate and final artistic/IGP acceptance remain open; no commit/push/merge/deploy |

Details, hashes and review entry: [FIT_REFRESH_2026-10-12.md](FIT_REFRESH_2026-10-12.md). The existing complete-trial technical results above remain historical for identical source bytes; no unchanged full-suite rerun or overall green claim.

## Separate PR preparation — October 12

| Capability / source / owner | Integration status | Evidence | Unresolved gap |
| --- | --- | --- | --- |
| Released main 81761be / Robert Porter, including PR #12 Lantern Dash | Candidate base; all 14 main-only non-handoff files retain identical Git blobs; full Lantern handoff notes retained | Isolated assembly receipt and independent source review | New exact-head CI and no-deploy merge boundary still required |
| Rider PR #11 8e055069 / Robert Porter | Required shared-body, seven-preset/eight-slot wardrobe, cloth/material prerequisite included locally in review candidate; original PR unchanged | Existing tracked baseline plus fresh candidate checks below/in MERGE_REVIEW.md | Original exact-head integration reticle CI failed; editor CI passed; not assumed green |
| Earlier harness PR #10 5639924 / Robert Porter | Whole branch unmerged; lifecycle lessons and only needed authored inputs reused | Shared skeleton/candidate-before-release/stale/rejected disposal source review and regression tests | No separate harness production rollout |
| Balanced caa8be1 and motion-fit 5efe2bb / Robert Porter | Selected fitting data included; full sources/exports/maps/scripts/evidence preserved in original trial and hashed archives | SOURCE/REFERENCE historical inventories; current package manifest distinguishes included subset | Base-color identity translated into runtime atlas; preview normal/ORM not active runtime maps |
| Island PR #9 de58113 / Robert Porter | Reference/ownership preserved; not integrated or enabled | Historical reference matrix above | Outside rider scope |
| Session guide PR #13 591e922 / Robert Porter | Separate documentation PR remains unmerged; local guide read, excluded from this PR | AGENTS/CLAUDE unchanged against main; README_SESSION remains unstaged | Separate approval/review |
| Owner playtest / Robert | Reported plays well/no observed issues | Direct owner message after local trial review | Device, duration and measured performance unspecified |
| Recovery | Full overlay ZIP de374da88b996d17f36cfc9c7b7335fcc2a3a68ce2cc713e412d99fd2bf25cb6; additive fit ZIP 527be272a3fbbe34c92dd03e0995191246c9e875d9bda59c93858bf47500ec3b retained | Both previously readback/CRC verified; no source cleanup/overwrite | Review candidate backup and commit identity recorded separately |

Current candidate verification: [MERGE_REVIEW.md](MERGE_REVIEW.md#validation) and [PR_VALIDATION.json](PR_VALIDATION.json). Legacy/authored 384-look/2,304-pose audits passed separately; initial unit timeout and CPU/browser failures retained. All original assertions/tolerances preserved. Current candidate exporter proof included; no runtime/native/GLB change during PR preparation.
