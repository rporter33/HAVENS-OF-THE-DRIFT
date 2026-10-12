# Authored rider construction and integration

> **PR publication note (October 12):** This document records the full preserved
> local trial at `codex/rider-blender-trial`, including historical restrictions,
> local paths and larger source/evidence inventories. The current separate PR
> preparation stage, included files and fresh candidate results are recorded in
> [MERGE_REVIEW.md](MERGE_REVIEW.md) and [README.md](README.md). Earlier no-commit
> wording remains historical; the current instruction permits PR preparation and
> explicitly stops before merge/deployment. Excluded artifacts remain preserved
> locally rather than being silently represented as included in this package.

The opt-in provider imports one uncompressed, self-contained GLB with 79 named
regions: 77 rider regions (11 Medium body/ponytail regions, seven static Travel
pieces for three builds and two cuts, and four cloth detail grids for those same
fits) plus the selected Aerie and Flight Windkeel fits. Only the current look's
regions enter the existing rider mesh. The small original compatibility fixture
remains separate and does not stand in for the authored art.

## Editable sources and reproduction

`assets/rider-blender/source/rider-trial.blend` contains hidden measured fitting
sources, separate editable authored meshes, vertex paint previews, skin groups
and three editable copies of the current 27-joint armature. Its external fitting
JSON and the separate `WINDKEEL_FITTING.json` are SHA-256 checked in a Blender text
descriptor. Native `.blend1` backups
are retained in the original trial, outside this PR. Runtime GLBs are separate in `src/assets/rider-blender/`.
Tool, script, texture-source and output hashes are recorded in the manifests.

Historical full regeneration uses the original trial dev server on 5210 and
its local portable Blender. Do not run the author script to retain manual edits.
The PR carries the saved source and complete re-export inputs, not Blender itself:

```powershell
# Recreate measured fitting sources and initial authored meshes.
node scripts/rider-blender-source.mjs
& tools/blender/blender-4.5.14-windows-x64/blender.exe --background --factory-startup --threads 2 --python-exit-code 1 --python scripts/rider-blender-author.py

# Append the selected Windkeel fits after recreating the initial rider.
& tools/blender/blender-4.5.14-windows-x64/blender.exe assets/rider-blender/source/rider-trial.blend --background --threads 2 --python-exit-code 1 --python scripts/rider-blender-windkeel.py

# Export an edited, saved native project while retaining manual mesh edits.
& tools/blender/blender-4.5.14-windows-x64/blender.exe assets/rider-blender/source/rider-trial.blend --background --threads 2 --python-exit-code 1 --python scripts/rider-blender-export.py
```

The author script recreates its own project; use the second command for manual
Blender work. All subdivision, smoothing and decimation precede binding. Export
regenerates triangle/barycentric coordinates, local-frame offsets, skin weights,
UV/material metadata and topology hashes from the final saved mesh. No optimizer
runs afterward. Invalid fitting hashes or delta/cloth topology stop export.
Independent re-export opened a copied native source and ran the exact copied
exporter against copied fitting inputs. Blender 4.5.14 LTS reproduced all 79
regions and the 19,110,536-byte GLB exactly, SHA-256
`d6f2ffa790d43e8217ab6d64bdfdf994b424d1d5cb1d1b8685403b2001d40dc8`.
All four original and copied inputs remained unchanged. The native source SHA-256
is `0b69bcbb74153a0f0bc993ee756f59048db22e5fc0d5e7a7990c39465b9fa9c4`.
The verification and export log are preserved outside the runtime asset tree at
`C:/Users/Robert/.codex/visualizations/2026/10/11/01a12d01-df73-7353-bddb-5533013056c8/reexport-proof-20261011/`.
This proves reproducibility of these inputs, not successful garment fitting.

Blender 4.5.14 LTS, build `62c1db4208e8`, was a checksum-verified portable copy under
`tools/blender/` in the preserved original trial. It is not included in this PR. Robert authorized needed software after notification. No global
installer, settings change, Git LFS or npm dependency was introduced. Large JSON
stays external rather than becoming a single huge line in Blender's text editor.

## Construction decisions

Approved illustrations establish identity; current rig dimensions establish fit.
The measured front/side/back SVG and construction JSON retain the real bind mesh,
attachment frames, fitting boundaries and all bones. Metres, +X left, +Y up and
+Z forward become Blender (x,-z,y), then convert back once. Pelvis/chest/ankle
reference heights remain .960/1.230/.075 m.

The Medium face has authored cheek, jaw and chin cross-sections, a continuous
nasal bridge/tip, fitted almond eye openings, closer brows and shaped lip surfaces.
The upper cranium stays inside the original hair/headgear fitting envelope.
Hands union palm, thumb and four fingers into connected surfaces,
then use existing palm/finger joints. Bare/sandal feet union instep and five toes
while retaining the sole plane and original ankle/contact envelope. Upper-body
sculpt peaks near 3.5 mm; trouser gathers about 4 mm. Ponytail crown refinement keeps
the original tie, hanging tail, attachment, solver and motion envelope. The lower
half of the original spherical hair cap was formerly buried in the deeper head;
it showed as a dark mask on the shallower authored face. Only that hidden interior
is sunk farther inward. The visible hairline/crown/locks are retained. Other hair
styles use the same trial-only hidden-cap correction on Medium; Slight/Broad and
the opt-out presentation retain their original cap construction.

Separate Travel pieces retain pale asymmetric cloth, broad matte slate, worn
leather and softened bronze. Aerie remains compact; Wanderer stays explicit.
No automatic costume conversion is introduced. Robert reported disconnected
cloth on both shoulders and authorized a style-matched leather amendment. One
welded wrap now crosses both deltoids, keeps a longer left drape and the spiral
brooch, and follows the existing upper-arm joints. The cloth is 2 mm thick, rests
on the measured shoulder bridge and clears the upper-arm sculpt. Broad shallow
folds replace the rejected bulky cap; that superseded source remains in the trial's
separate art-history backup. A narrow worn-leather keeper
crosses the shorter right cap with two small bronze fastenings. Front and back
share cap vertices. Fixed parameter-space triangulation prevents legacy underlayer
fit changes from reversing cage edge winding and invalidating bindings. These
seam/fastening choices are inferred construction, not measured plate details.
The same arm-wrap category becomes a thin worn leather bracer in the authored
provider; cosmetic IDs remain unchanged, including the historical Linen Arm Wraps
label. It follows the forearm joint and leaves the Windline socket unchanged.
The head carries explicit facial-feature recipe attributes through subdivision;
nearest skin triangles cannot replace eye, brow or lip colors. That regression
was found in the close-up review and repaired without weakening import validation.

## Regions, dyes and ownership

The single current runtime skeleton, animator, IK and equipment frames own motion.
Exported skeletons validate joint identities/hierarchy, bind transforms, inverse
binds and actual bind deformation, then are disposed with the parsed scene.
Bind tolerance remains 10 micrometres; normalized weights remain within 0.0001.
Final position/index topology is signed at micrometre quantization. No imported
animation, external maps/buffers or required compression extension is accepted.

Direct head/hands/bare feet replace their body regions. Small sculpt fields deform
current Medium torso, trousers and boot fitting surfaces before canonical
skinning, preserving style-dependent coverage. Slight/Broad bodies retain their
providers; their Travel pieces have explicit authored fits. Static Travel detail
binds to each current fitting cage, including legacy top clearance, and replaces
that piece's generated extras. The refined ponytail crown also binds to its current
hair cage; the hanging tail is unchanged. Trousers belong to one owned leg region. Mixed
legacy tops and boots therefore do not stack duplicate body shells.

`_DW_SURFACE`, UV, glow and dye metadata translate into existing painterly shaders
and the shared atlas. Direct regions carry recipes; fitted garments evaluate the
current cage's recipes. Dyes update the same geometry/material/skeleton in place.
`proofMaterials.ts` is the existing procedural texture source; there are no new
bitmap maps or arbitrary Blender node contracts. Preserved harness normal/ORM
polish is not evidence those maps are active in the game.

## Coarse simulation and detailed cloth

Four Travel skirt surfaces are 13x11 regular grids (143 vertices, 240 triangles
each). Authored offsets peak near 3 mm and vanish at pinned roots. Explicit
triangle coordinates and transported local-frame offsets bind them to the existing
coarse guides. Source controls, guide skin, pin map and detail topology are signed;
relevant changes require rebinding. This supports guided regular sheets, not
arbitrary imported cloth topology.

Only the coarse guide is skinned. Existing localized wind/inertia, linen/heavy
cloth, pinned seams, calm recovery and contacts remain. Detail follows simulation
once in ordinary Meshes, followed by the existing final rendered vertex/edge/
centroid correction, smoothing, normals and lining. Existing sleeves, tabards,
robes, coats, articulated metal and rig-supported leather keep their providers.
Dye and quality changes retain solvers. No static garment or baked cloth replaces
these systems. Contacts cover existing body/mount capsules and shared ground/deck
queries, not arbitrary-world collision, self-collision or every possible layer.
The existing free-surface audit explicitly excludes sewn roots/inner vent seams.

## Loading and harness reconciliation

PR #10 attachment/refit/disposal and the later motion review's epoch paths were
read first. Candidate body/cloth construction finishes before working resources
are released. Failed initial loads retain generated visuals; failed replacement
retains working visuals. Disposed/stale requests cannot win; late completion uses
the current Stable look, including Revert. Temporary parsed resources and rejected
clones are released. Two bounded development URL caches retain immutable source
buffers for module lifetime; QA counts them. They own no live skeleton or texture.

The complete source packages and earlier integration sources are preserved; only
two selected fit buffers are adapted into this trial. No whole artifact branch
was merged. Robert explicitly selected “Use the shown Windkeel design,” superseding
the earlier brown-for-now choice. Centered/even A+B, C shoulder guide,
blue/linen/bronze identity and four named sockets are retained. Flight's 32-vertex
costume adjustment was already baked into the selected source and is not applied
again. The original Aerie 12.4 s rear-link/skirt crossing remains a regression
case. Scripted review and stand-in seating do not certify gameplay or hardware
performance. Broader harness production is outside this trial.

## Selected Windkeel resting fit — bounded technical and visual evidence

The runtime adapter samples the selected body/top's rendered bind-space triangles
and fits flexible surfaces at look construction. Shoulder and waist cross-sections
share a support weight field per ring; the blue and linen shoulder layers share
those weights. This avoids independent edge weights shearing one leather or cloth
strip during raised-arm motion. Authored hip/thigh load-path weights are retained.
The rigid A+B motif translates as a group. Four render-only socket positions use
the same skeleton; gameplay attachment frames remain authoritative.

The garment order is leather over the trousers and beneath the free Travel skirt.
The first two rings of each rear link tuck 6 mm beneath the actual pinned Travel
waistband seam, rather than sampling its outer face as their support. Authored
hip/thigh weights remain intact. This final-geometry underlap clears the fixed
seam without pulling the fastened leather away from the rider or moving a pin.

After the existing live cloth solve and final body/mount/ground correction, local
rendered-surface correction lays the free Travel cloth over the posed rear links.
The leather, coarse solver state and pinned vertices remain unchanged. It uses
triangle-overlap constraints, a 100 mm hard displacement cap and a seam-distance
budget; impossible pinned or over-bound contacts are reported rather than hidden.
The cloth is already posed and receives no second skeletal transformation.

The targeted motion regression now **passes** for all three builds: zero final
triangle crossings and remaining constraints at 26 samples per build, 11–14 s
at 8 Hz plus exact 12.4 s. The report is
`shots/rider-blender/windkeel-resting-motion/2026-10-12T04-07-24-937Z/report.json`.
Earlier failed contact and waistband-route attempts remain in the evidence and
[QA report](QA.md). The passing proof uses scripted animation and a stand-in seat;
it is bounded regression evidence, not controller/gameplay acceptance.

Typecheck, 1,310 unit tests in 124 files, two existing audit tests, two authored
audit tests and build pass in
`shots/rider-blender/windkeel-resting-checks/2026-10-12T04-08-29-505Z/`.
Each audit covers 384 looks/2,304 poses across three builds and eight slots;
sampled free rendered vertex/face proxy penetration is zero, with sewn roots and
inner vent seams excluded. Earlier four-pass evidence for the fitted brown
predecessor remains historical. Current functional and visual checks below use
the selected Windkeel; their bounded passes do not close the unresolved software
CPU gate or establish the requested concept likeness.

## Current gameplay, Stable and performance evidence

Fresh fit run `shots/rider-blender/windkeel-resting-fit/2026-10-12T04-35-17-437Z/`
has 32 captures, four cases and no browser errors: Medium/Slight/Broad Travel and
Medium Flight. Each completes actual takeoff, landing, dismount, walking/running
and gameplay-mounted captures from both sides. The independent contact/motion
fixture above remains a separate scripted proof.

Current B, accessory and Stable transaction checks in
`shots/rider-blender/windkeel-resting-visuals/2026-10-12T04-15-43-201Z/` passed:
236 B captures, 63 accessory captures and 14 Stable checks. Initial A from that
run is rejected for CSS-transition framing. Replacement A at
`2026-10-12T04-30-26-708Z` completed 46 captures with no errors; 40 are usable,
while six high/night/Ultra back-view images were replaced by the neutral-input/
camera-framing supplement at
`2026-10-12T05-05-24.159Z/shots/rider-blender/qa-a-gameplay-back-supplement/`.
Its six captures completed with no errors. Four actual Stable mix views at
`shots/rider-blender/windkeel-resting-fit/2026-10-12T05-08-15-853Z/` also completed
with no errors, showing Medium legacy Flight top, imported Travel trousers and
Scout boots from front/left/right/back. This supplement does not replace the full
four-case transition report. Independent bounded visual review found all six
replacement rear views clear and matched, and all four Stable views rider-focused
without gross gaps or duplicate surfaces. Source and capture hashes were
readback-verified. These observations do not certify exhaustive layer fit or the
requested near-indistinguishable concept likeness.

Current `shots/rider-blender/qa-cd/report.json` has 26 passing checks and 23 captures:
real gameplay/Stable transactions, Revert/reload, in-place dyes, current movement,
Windline, wind reversals/calm, hitches, quality continuity, deck support and loading
recovery. Its only console error is the intentional 404 failed-load proof. Forty
simulated seconds and 70 preset replacements stay finite, with live geometry/
texture counts stable at 111/8. Existing contacts retain their documented coverage.

Dedicated-hardware measurement in `shots/rider-blender/qa-performance/report.json`
completed 12 cases with no errors on AMD Radeon RX 9070 XT / ANGLE D3D11,
Edge 155.0.4283.45, 1440×1080. Low mounted baseline/trial each ran 60 seconds:
rAF p95 6.3→12.2 ms; CPU submission p95 3.7→9.2 ms. Trial mounted rAF p95 was
about 12.2 ms in all four quality tiers. Twenty Stable dye changes retained
geometry, skeleton and solvers (CPU median 5.2 ms, p95 7.8 ms). These are measured
frame cadence/submission observations, not GPU timer queries, total VRAM or
integrated-GPU certification. Physical-controller acceptance is unverified.

All four known C02 color tiers remain cached: 125,829,120 CPU bytes; decoded
79-region geometry buffers total 16,491,136 bytes. After the measured quality
cycle, observed final-Low active/coexisting arrays total 77,604,862 bytes. Known
unused color tiers contribute another 121,634,816 bytes, for a deduplicated
199,239,678-byte measured array-buffer lower bound. The decoded geometry is
already included in observed active buffers and is not added again. This excludes
unobserved allocations, full JS object/heap costs and physical driver VRAM.

The separate unchanged standalone software CPU gate failed the trial
production build while passing the preserved baseline. Its swinging p95 pairs
are 10.7/8.3 ms baseline and 11.2/29 ms trial against the original 20 ms limit,
with matching 474/1,439 query counts. Both ports use the generated provider with
the authored selection off. The full-browser run then failed command 09's same
unchanged CPU assertion on both trial and its automatic preserved-baseline
comparison: depth-55 swinging p95 was 31.9 ms trial / 24.4 ms baseline against
the original 20 ms limit. The gate is **baseline-reproduced and unresolved**; the passing
standalone baseline and failing standalone trial remain retained, not overwritten.
Neither authored-harness causality nor an inherited-only cause is certified.
Hardware measurement does not cancel this gate or establish zero additional cost.
Standalone record: `shots/rider-blender/performance-solo/report.json`. The original
full-browser workflow completes with 14/15 commands passing, including
reticle/editor/audio. Its report has 16 entries because command 09's automatic
preserved-baseline comparison is recorded separately; both CPU entries fail.
Raw record: `shots/rider-blender/full-browser/report.json`. Four delivery checks
and 15 smoke checks pass. A/mixed capture supplements and their bounded visual
review are complete. No overall green QA or four-pass completion is
claimed while the CPU gate is open. The final evidence manifest and generated
`review-data.json` identify contained capture paths, hashes and the visual-review
provenance. Final source/evidence/recovery records are generated during delivery;
read them with QA.md rather than treating a source folder as a verified release.

## Preserved brown harness predecessor

The earlier owner choice retained the brown Windline identity. That decision is
historical and was superseded by the explicit Windkeel selection. The fitted brown
adapter, source and QA are preserved for comparison; a successful current authored
load selects Windkeel. Opt-out and failed initial imports keep the original rigid
brown fallback. For the brown predecessor, two narrow load paths were sampled against the selected
body/top's rendered bind-space triangles, including the shoulder returns. The
3 mm leather has a 1.5 mm underside allowance. The owner's subsequent instruction
to let it hang like a fastened leather strap adds shallow 4–6 mm gravity curves
between belt, shoulder and ring contacts, with up to 1.2 mm of local easing above
the fitted layer. Shoulder contacts stay seated. Leather remains rig-supported;
this is authored construction rather than a new per-frame leather simulation.
Both edges are projected after
lofting, and final vertex weights are regenerated from the supporting triangle.
The fitter runs during look construction, not per frame. This generated adapter
fits the full mixing system without creating another attachment framework.

The rigid dorsal bronze ring rests on the selected top's declared back surface,
under existing back-mounted map cases. A raised map-case face is deliberately
not its support plane. Its bore and restrained scale are retained. The straps
use outer rendered surface hits. This is an inferred layering decision; no prop,
world geometry, equipment gameplay frame or traversal force was changed.

The equipment mesh shares the canonical rider skeleton and material. Bind-space
visual anchors are skinned once for the existing load-line display. Existing
simulation attachment frames still govern physics. Mounted visibility retains
the old harness rule. Recolor/quality changes preserve geometry and skeleton;
candidate replacement fits before releasing working equipment. Rejected rebuilds
also restore the previous look. All rejected/current harness geometry is disposed
through the rider lifecycle. Hidden original fallback geometry remains allocated
and is included in live resource counts.

Independent focused tests sample every eighth final vertex, including the entire
bronze ring, against actual body triangles for seven presets and three builds.
The 12 mm maximum clearance assertion was retained. An attempted test narrowing
was rejected by automatic approval review and was not executed; the ring/support
geometry was corrected instead. Shared motion, dyes, failed replacement and
single disposal are tested separately. See QA.md for failures and final evidence.

The editable rider .blend and GLB were unchanged by that brown fitting correction;
the subsequent Windkeel append produced the current 79-region source/export.
The generated brown adapter is not presented as the selected Windkeel asset or
a second production deliverable.

## Resume checkpoint

Before this continuation changed the resting fit, a recoverable checkpoint copied
and readback-verified 1,651 files (945,200,189 source bytes). Its 926,455,658-byte
`trial-before-resting-fit.zip` has SHA-256
`4483719753713a69e5f6326096672b95c42fc5c6a87beb7f516094a5a2823881`.
The ZIP and `CHECKPOINT.json` are retained at
`C:/Users/Robert/.codex/visualizations/2026/10/11/01a12d01-df73-7353-bddb-5533013056c8/rider-resume-20261011/`.
This supplements the original baseline and predecessor archives; it does not
replace them or imply final delivery QA has passed.
