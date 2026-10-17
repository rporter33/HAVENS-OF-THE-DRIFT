# Rider trial QA — Windkeel resting-fit continuation

> **PR publication note (October 12):** This document records the full preserved
> local trial at `codex/rider-blender-trial`, including historical restrictions,
> local paths and larger source/evidence inventories. The current separate PR
> preparation stage, included files and fresh candidate results are recorded in
> [MERGE_REVIEW.md](MERGE_REVIEW.md) and [README.md](README.md). Earlier no-commit
> wording remains historical; the current instruction permits PR preparation and
> explicitly stops before merge/deployment. Excluded artifacts remain preserved
> locally rather than being silently represented as included in this package.

This report covers the selected Medium rider, blue/linen/bronze Windkeel and thin
connected shoulder cloth. Slight/Broad fit compatibility is checked where stated.
The trial remains local and uncommitted on `codex/rider-blender-trial`, HEAD
`8e055069703c83308d5508ee72e5ad1d15ef348e`. No commits, pushes, merges or deployment
are authorized. All four QA passes have substantive current-source evidence;
the final capture supplements and their visual review are complete below. The
unchanged software CPU gate remains failed and baseline-reproduced. These checks
do not establish final artistic acceptance or a fully green delivery gate.

## Tested source and recovery

The selected uncompressed GLB contains 79 regions: 77 rider regions and two
Windkeel fits. It is 19,110,536 bytes, SHA-256
`d6f2ffa790d43e8217ab6d64bdfdf994b424d1d5cb1d1b8685403b2001d40dc8`.
Editable native SHA-256:
`0b69bcbb74153a0f0bc993ee756f59048db22e5fc0d5e7a7990c39465b9fa9c4`.
Runtime fitting code also affects the rendered result; this asset hash alone
does not identify the final tested implementation. SOURCE_MANIFEST.json records
the final runtime, source and QA hashes. FINAL_EVIDENCE_MANIFEST.json identifies
readback-verified collected evidence; RECOVERY.json identifies the final overlay
archive and original-source verification. Read their actual results before use.

Independent re-export with Blender 4.5.14 LTS (`62c1db4208e8`) reproduced this GLB
byte for byte. All four original and copied inputs remained unchanged. The proof
is retained in
`C:/Users/Robert/.codex/visualizations/2026/10/11/01a12d01-df73-7353-bddb-5533013056c8/reexport-proof-20261011/REEXPORT_VERIFICATION.json`.

Before this continuation, `trial-before-resting-fit.zip` was readback-verified
against 1,651 source files (945,200,189 bytes). ZIP size: 926,455,658 bytes;
SHA-256 `4483719753713a69e5f6326096672b95c42fc5c6a87beb7f516094a5a2823881`.
It and `CHECKPOINT.json` are retained in the same visualization root's
`rider-resume-20261011/`. The original rider baseline, dirty planning files,
earlier fitted brown trial, reference sources and owner services remain separate
preservation targets. See [the preservation matrix](PRESERVATION_MATRIX.md).

## Current technical checks

Raw runner record:
`shots/rider-blender/windkeel-resting-checks/2026-10-12T04-08-29-505Z/windkeel-resting-final-checks.json`.
Commands ran from the isolated trial; the runner redirected each log into that
unique output directory. Durations below use Vitest's own reported duration.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 |
| Full unit suite | `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=dot` | PASS, 1,310 tests in 124 files; 202.07 s |
| Existing garment/contact audit | `node node_modules/vitest/vitest.mjs run --config scripts/rider-qa.config.mjs --maxWorkers=1` | PASS, 2 tests; 62.09 s |
| Authored garment/contact audit | `node node_modules/vitest/vitest.mjs run --config scripts/rider-blender-qa.config.mjs --maxWorkers=1` | PASS, 2 tests; 141.87 s |
| Production build | `node node_modules/vite/bin/vite.js build` | PASS, exit 0 |

The existing and authored audits are separate required checks. Each covers
384 looks and 2,304 poses across all three builds and eight mixing slots, using
pairwise coverage. The worst recorded free-particle proxy penetration was
0.256181 mm. Sampled free rendered vertices and triangle edge/centroid proxy
penetration were zero. Sewn roots and inner vent seams are explicitly excluded
from this audit. These results establish that bounded proxy coverage, not
arbitrary-world collision, cloth self-collision or every possible eight-way mix.
Raw coverage, rows and maxima are retained in each run's `legacy-audit/` and
`authored-audit/` clearance JSON.

Focused tests retain shared-skeleton ownership, static fit across seven presets
and three builds, unchanged dye/lifecycle behavior, centered rigid A+B and socket
contracts. Contact tests also cover unchanged solver state/pinned vertices,
moving hips/thighs, face-interior overlaps, repeated correction without drift,
world translation once, rejected out-of-bound requests and impossible pinned
contacts. No old tolerance was enlarged or assertion removed to accept the fit.

## Retained motion regression

The current targeted motion replay **PASS** is recorded at
`shots/rider-blender/windkeel-resting-motion/2026-10-12T04-07-24-937Z/report.json`.
It continuously uses the current animator and live cloth through preserved
motion-fit phases with a scripted stand-in seat. The exact 12.4 s sample comes
from the first playback, rather than reconstructing that pose afterward.

| Build | Sampled final triangle crossings, 11–14 s at 8 Hz plus exact 12.4 s | Exact 12.4 s | Remaining contact diagnostic | Largest applied free-surface correction |
| --- | --- | --- | --- | --- |
| Medium | 0 at all 26 samples | 0 | 0 | 47.62 mm |
| Slight | 0 at all 26 samples | 0 | 0 | 54.31 mm |
| Broad | 0 at all 26 samples | 0 | 0 | 47.46 mm |

All cases used the selected Windkeel, four live Travel panels and four named
sockets; values stayed finite and the page-error list was empty. This is a
specific sampled rear-link/Travel-surface regression result. It does not prove
all frames, all garments, controller gameplay, dragon contact, Windline physics,
natural visual folds or hardware performance. The free-cloth displacement needs
review in the gameplay and Stable cameras; a zero intersection count alone does
not establish the requested resting silhouette.

## Findings and fixes retained in evidence

1. Early fitting/browser cache setup failed. The tooling setup was corrected and
   the proof rerun; that failure is not silently counted as a passed asset check.
2. An initial final-vertex fit assigned independent body support weights to each
   strip edge. Raised-arm and hip motion could shear the cross-section. Shoulder
   and waist rings now share a support field; the blue/linen shoulder layers share
   those weights. Authored hip/thigh load-path weights were restored rather than
   reapplying a second costume adjustment.
3. Earlier contact attempts pulled the leather away from the rider to clear the
   skirt. Failed sampled maxima included 30/28/26 crossings across the three
   builds in a retained attempt. Layer ordering was corrected: fastened leather
   rests over trousers and beneath the free Travel skirt. Local final-surface
   correction changes the drawn cloth, preserving its live solver and pins.
4. The remaining waistband route produced 18/18 crossing findings in the retained
   route check. A seam-derived 6 mm underlap now tucks the load-bearing link beneath
   the fixed Travel waistband before it follows the thigh. It does not float the
   entire harness outward or move the pinned seam. The passing three-build replay
   above follows that correction.
5. Impossible contacts remain observable failures. Corrections have a 100 mm hard
   cap and a seam-distance budget; pinned constraints are not repaired by stretching
   neighboring cloth into a fin. Rejected/pinned/remaining diagnostics are retained.
   The sampled passing replay had no remaining constraints; that is bounded evidence.
6. Fresh Pass A navigation completed with exit 0, but the initial captures were
   taken during the Stable panel's CSS transition. The framing was therefore
   rejected for matched artistic comparison. Capture timing was corrected without
   changing runtime code. A second 46-image run still had three unusable rear-view
   pairs (absent, overhead or mount-obstructed rider). Those six images are retained
   as rejected evidence, and a separate six-image supplement supplies the affected
   settings with neutral scripted input and the actual unoverridden follow camera
   farther from the waiting companion. Source inspection proves live-input exposure
   in the earlier QA tool, but not the exact historical cause of each rejected image.
7. Four fit-run images are partly or fully obstructed by the waiting wyvern. They
   establish state/measurement evidence only and are excluded from the visible-fit
   review gallery. Clear C/D running captures supply visible gameplay evidence.
   The C/D mixed Stable screenshot also shows the companion rather than the rider;
   it proves transaction UI only. A separate four-view rider-focused Stable proof
   supplies the legacy-top/imported-trousers/Scout-boots visual comparison.

The failed attempts and superseded brown captures remain preserved. Their counts
are historical findings, not the status of the passing targeted replay. No fallback
appearance is accepted as a successful authored combination.

## Four-pass acceptance status

| Pass | Required evidence for this current source | Status |
| --- | --- | --- |
| A — matched presentation | Preserved/trial gameplay and Stable front/side/back, face/hands, day/night, dyes and quality tiers; thin connected cloth and resting Windkeel | Forty usable images from A46, with six replacement rear-view images; close-ups explicitly diagnostic. Capture supplement review recorded below. Near-concept likeness is not certified |
| B — wardrobe and fit | Every preset/individual piece, all slots/builds, high-risk mixes, lining/seams, breeds and both mounted sides; actual takeoff/landing/dismount | PASS within tested coverage: 236 wardrobe captures, 63 accessory captures, 14 Stable checks; 32 fit captures/4 cases, plus 4 rider-focused mixed Stable views. Both mounted sides of all four breeds in diagnostic real-saddle views; actual flight-side captures separate |
| C — motion and contacts | Walk/run, arms, banks/dive/brake, Windline, reversals/calm, hitches/teleports, ground/decks and repeated dyes/quality | PASS within 26 combined C/D checks and bounded contact/motion coverage. Clear actual gameplay captures inspected. No self-collision or arbitrary-world cloth claim |
| D — lifecycle and delivery | Unlocks/saves/Stable transactions, late loads/Revert, fallback/disposal, offline/subpath and sustained performance | Functional checks PASS: C/D transactions/loading/disposal, 4 delivery cases, production smoke 15/15. Overall performance gate remains OPEN/FAILED as detailed below |

Earlier full-suite and four-pass evidence for the fitted brown predecessor is
retained for comparison only. It must not be used to mark these current Windkeel
passes complete. Current evidence is independently identified below. No unchanged
checks were repeated without a finding, changed source or a missing required check.

Current raw reports (collected copies are indexed by FINAL_EVIDENCE_MANIFEST.json):

- A: `shots/rider-blender/windkeel-resting-visuals/2026-10-12T04-30-26-708Z/shots/rider-blender/qa-a/report.json`; excludes the three rejected rear-view pairs. Six-frame supplement and four-view mixed Stable proof are separate immutable runs.
- B/accessories/Stable: `shots/rider-blender/windkeel-resting-visuals/2026-10-12T04-15-43-201Z/`; its initial A frames remain rejected.
- Fit: `shots/rider-blender/windkeel-resting-fit/2026-10-12T04-35-17-437Z/report.json`. Medium Travel and Flight; Slight/Broad Travel pieces mixed onto Flight. Actual takeoff, landing, dismount, walking/running and both flight sides; four occluded runs excluded from visible acceptance.
- C/D: `shots/rider-blender/qa-cd/report.json`: 26 checks, 23 captures, no failed checks. The sole expected console error is the intentional failed-load 404. Stale completion honors Revert; failed replacement retains working equipment. Forty simulated seconds/4,800 fixed steps and 70 preset replacements retained geometry/texture counts (111/8 → 111/8).
- Shoulders: `shots/rider-blender/shoulder-correction/report.json`: 9 views, zero errors.
- Delivery: `shots/rider-blender/qa-d/delivery.json`: 4 passing cases, production hashed GLB/subpath and cached offline dye/build roundtrip. Cold offline boot is not certified.
- Full browser: `shots/rider-blender/full-browser/report.json`: 14/15 original workflow commands PASS. Cost09 FAIL; extra preserved-baseline cost comparison also FAIL (16 total report entries). Original assertions/scripts unchanged; a QA output adapter redirects their Windows `/tmp` evidence paths only.
- Production smoke: `shots/rider-blender/windkeel-resting-smoke.log`: 15/15 PASS, including normal menu, keyboard flight, pause/resume, quality changes and production absence of debug hooks.

The thin shoulder wrap is continuous across both shoulders; close torso ribbons
and rear-link routing are readable in Stable and both actual mounted sides.
Raised-arm, lining, preset/accessory and sampled motion reviews found no gross new
suspension or disconnected shoulder surface in the inspected coverage. Narrow
brown spans at open hems are equipment, not automatically penetration. The authored
brown leather bracer is a recorded interpretation; historical white linen-wrap
appearance parity is not claimed. Face/hair detail, anatomy and cloth construction
still differ visibly from the concept. The compact Aerie cut and original long
moving ponytail are deliberate preserved constraints. Robert's requested
near-indistinguishable likeness remains an artistic review target, not a passed
technical assertion. Supplemental capture results follow.

The six-image A supplement completed with exit 0 and no errors at
`shots/rider-blender/windkeel-resting-visuals/2026-10-12T05-05-24.159Z/shots/rider-blender/qa-a-gameplay-back-supplement/report.json`.
All three pairs were visually inspected: the complete rider is visible, with
identical paired world point `[34,240,34]`, orbit, camera position/quaternion,
projection, settings and neutral-input metadata. No gross suspended ribbon or new
shoulder detachment was visible at the gameplay distance. The changed location is
explicitly recorded; these replace three rejected pairs and do not validate the
earlier framing.

The four-view mixed Stable supplement completed with exit 0 and no errors at
`shots/rider-blender/windkeel-resting-fit/2026-10-12T05-08-15-853Z/report.json`.
All four actual rider-focused Stable views show the legacy Flight top, imported
gathered Travel trousers and Scout Boots together, without gross duplicate body
surfaces or open waist/knee/boot-interface holes at this distance. Bare shin above
the shorter boots is selected coverage. Guards retain the imported leg pair,
absence of imported top, selected Windkeel, shared skeleton and four sockets.
This static mix does not repeat the Travel shoulder or mounted-motion proof.

Readback-verified visual reviews and contact sheets are collected under
`inspection-sheets/bounded-review/` in FINAL_EVIDENCE_MANIFEST.json. A reviewer
checked 52 A source capture hashes (retaining the six rejected frames) and all
four mixed Stable hashes, plus separate B/accessory and C/fit records. This is
bounded visual evidence, not hidden-surface/exhaustive overlap or final concept
fidelity certification. The newly populated review page and normal-menu links
are checked separately in `evidence/REVIEW_DELIVERY.json`.

## Inherited remote CI

[REMOTE_CI.json](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-blender-trial/evidence/REMOTE_CI.json) was rechecked against PR #11's rider
baseline. Editor run 38166348209 passed. Integration run 38166348207 failed after
30,000 ms waiting for `#sky-lance-reticle` in `scripts/windline-reticle-check.mjs`;
later checks in that step did not run. Earlier typecheck, unit, garment audit,
build and smoke steps in that remote run passed. These are inherited remote
results for `8e05506`, not CI results for this uncommitted trial. The reticle
failure remains an inherited failed gate and has not been weakened or assumed fixed.
Both current local reticle commands passed; this does not repair or rerun the remote
CI job, and no CI was triggered for this uncommitted trial.

## Performance and unverified targets

Hardware-backed sampling completed 12 matched cases with no errors on AMD Radeon
RX 9070 XT, ANGLE D3D11, Edge 155.0.4283.45, 1440×1080/DPR 1. Driver
32.0.31041.1004. Each case warms for two seconds; mounted Low runs 60 seconds per
variant, other cases 20 seconds. Measurements use actual requestAnimationFrame,
without manual simulation advance. Scenes, initial look, input and durations match;
natural visibility counters differ between frames. These are CPU submission/rAF
cadence observations, not isolated rider GPU timings, VRAM totals or FPS guarantees.

| Case | Current/trial rAF p95 ms | Current/trial CPU submission p95 ms | Current/trial draw calls |
| --- | --- | --- | --- |
| Mounted Low | 6.3 / 12.2 | 3.7 / 9.2 | 106 / 107 |
| Mounted Medium | 6.2 / 12.2 | 4.7 / 9.5 | 119 / 121 |
| Mounted High | 12.1 / 12.2 | 8.1 / 9.1 | 126 / 126 |
| Mounted Ultra | 12.3 / 12.2 | 11.5 / 9.5 | 129 / 130 |
| On-foot Low | 6.1 / 12.2 | 2.7 / 9.8 | See raw report |
| Stable High | 6.3 / 12.2 | 6.4 / 8.1 | See raw report |

Mounted Low scene triangles were 279,465 / 328,435. Twenty trial Stable dye changes
retained geometry/skeleton/solvers: 5.2 ms median/7.8 ms p95 CPU update, excluding
GPU upload/render. All 79 decoded cached regions occupy 16,491,136 buffer bytes.
The 19,110,536-byte GLB delivery size is separate, not an extra retained decoded
allocation. Existing four C02 color atlas tiers total 125,829,120 bytes (120 MiB);
no normal maps were allocated. After the quality cycle, final Low bound/geometry
buffers are 77,604,862 bytes. Adding only unbound retained atlas buffers by unique
buffer ID yields **199,239,678 bytes (~190 MiB)** deduplicated lower-bound residency.
This excludes JS objects/recipe heaps, driver copies, render targets and browser
caches; it is not total RAM or VRAM. Serialized recipe/control metadata (347,532
UTF-8 bytes) is descriptive serialization, not JS heap usage. Raw hardware report:
`shots/rider-blender/qa-performance/report.json`. Reproducible summary:
`evidence/PERFORMANCE_SUMMARY.json`, derived by `scripts/rider-blender-performance-summary.py`.

The unchanged software CPU cost gate is **FAILED, baseline-reproduced and
unresolved**. In the standalone matched opt-out run, preserved current swinging
p95 was 10.7/8.3 ms at depths 18/55, versus trial 11.2/29.0 ms; the depth-55
unchanged <20 ms assertion failed only the trial. In the full workflow the trial
again failed at 31.9 ms, and the automatic preserved-baseline comparison also
failed at 24.4 ms. Both used the generated provider with the authored selection
disabled. Queries were identical (474/1,439 per step); physics/world/reticle source
is unchanged. Read-only audit found no substantial enabled authored loop or
geometry difference. Intermittent scheduling/GC/JIT is plausible but not proven;
there is no causal profiling or inherited-only classification. Retain both runs,
do not average away failures, and do not use the dedicated-GPU result to excuse
this gate. `performance-solo/report.json` and `full-browser/report.json` preserve it.

C/D CPU step distributions are descriptive (30 Hz presentation/four 120 Hz steps,
render excluded): mixed current/proof p95 2.0/6.1 ms, Travel 2.7/15.6 ms; sustained
trial p95 14.3 ms. They are not GPU/FPS budgets. Software appearance captures do
not certify hardware performance. Integrated-GPU Low suitability, GPU-time/total
VRAM targets, physical-controller play and exhaustive long-session performance
remain unverified. No provisional polygon/draw/CPU target became a new acceptance
budget. Audit execution durations are test durations, not frame budgets.

## Delivery and next decisions

Use [the local comparison page](http://127.0.0.1:5210/docs/rider-blender-trial/review.html)
for matched evidence and the normal-menu trial. Port 5211 serves the preserved
production baseline; 5214 retains the checked trial production build. Windows
restart steps, editable sources and exports are in [README.md](README.md).
The preservation matrix distinguishes preserved artifacts, enabled trial runtime,
historical unresolved fits and excluded island production. Finalizer verifies the
original 1,851 files/status and package lock before producing a readback-checked
overlay ZIP and diff against the preserved live baseline, including dirty planning
files. Its actual record is RECOVERY.json; it grants no publication authority.

Stop at this local review boundary. Next decisions belong to Robert: visual
acceptance/remaining fidelity priorities, whether to authorize profiling the
baseline-reproduced CPU gate, and physical-controller/integrated-GPU testing.
Completing harness production fitting or wider art is not implied. No commit,
push, merge, deployment or normal-build replacement follows from these checks.


## October 12 continuation — fit verification

See [FIT_REFRESH_2026-10-12.md](FIT_REFRESH_2026-10-12.md), its hashed JSON and the [fresh gallery](fit-refresh-2026-10-12.html). Full fit: 32 captures/four cases, actual takeoff/landing/dismount, all three Travel builds plus Medium Flight, zero errors. Accepted visible subset: 16 Stable + eight mounted-side frames. Eight original on-foot frames are retained but excluded for companion obstruction. A separate fresh-context supplement adds eight clear Medium Travel/Flight walk/run front/back views with the actual follow rig and no override; zero errors, source hashes unchanged. All 40 capture hashes verified. Both shoulders remain thin/connected and main Windkeel straps rest close in inspected coverage. No hidden-surface/millimetre/controller or final likeness certification. No runtime, geometry, native-source or export changes in this continuation. Historical full tests/build were not rerun unchanged; the CPU failure remains open. Original 1,851 files/status and trial 1,112 checkpoint files matched before these additive docs/evidence changes.


Fresh review delivery: five checks PASS (four local entry links + all 40 full-size images decoded), zero browser/resource errors after reusing the existing embedded icon in the new HTML gallery. Initial missing-favicon 404 and corrected run are both preserved in FIT_REFRESH_DELIVERY_2026-10-12.json. No runtime/index/assets changed, error filtering or weakened assertion.
