# Four-pass rider QA — October 11, 2026

## Current reviewed-main integration

Remote main advanced during QA to `f97bac535611e09c6c732230b5f0ca73b9bbf804`, the reviewed
neutral-Windline/controller release. Integration `a4e278dd70c56058f69744ed3962a719ed323f97`
preserves both handoffs and every tested rider source file byte for byte. Flight, traversal,
player and shared world source match that main. Its workflow gates remain intact; this
branch adds the dedicated garment audit. Main and other agents' worktrees remain untouched.

The integrated build passes **119 files / 1,286 tests**, typecheck/build, **15** smoke,
**32** Stable/mixing/actual-flight, **33** appearance checks / **28** new captures and
**12** local-menu/profile checks. Normal Windline keyboard/controller gameplay and the
controller-first leap/cast/boost/recall flow also pass. The 384-look geometry matrix remains
applicable because the entire rider runtime is identical to the four-pass checkpoint.
[Current integrated captures and hashes](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/integration/index.html) supersede
the pre-integration build identity below; all earlier evidence/backups are preserved.

The current local release is `local-rider-qa-integrated-test/dist` at the same 5193/5198
menu links. PR checks must be read against its final documentation/evidence head.

Robert requested at least three to four QA passes, fixes for any findings, clean clothing
clearance and distinct cloth/leather/metal behavior. This review follows the preserved
`c6ae42d` clothing checkpoint on `codex/rider-c02-proof`. Implementation commit:
`7a26b9782539ca5593672eaa00517eb3f0beb16d`, followed by shoulder-lining correction `bd38cc6`.
Reviewed main `a7adb45` is already included.

## Four completed passes

| Pass | Finding and improvement | Verification |
| --- | --- | --- |
| 1. Outfits and materials | Neutral legacy vertices could be classified as linen, including leather/metal details. Garment palettes now carry independent surface identity through dye recipes and mesh construction. Skin/hair stay neutral; leather has restrained broad sheen, metal a tighter sun-lit lobe, and linen/scales remain matte. Shader interpolation selects a material instead of sampling the space between atlas regions. | Nine material-identity tests cover all seven presets, C02 and mixed linen on a leather base, source palette isolation and geometry-preserving dyes. Day/night and material close-up engine captures accompany all presets. |
| 2. Fit and mounted clearance | Smoothed cloth could cross body/mount capsules between otherwise clear particles. Final free vertices and sampled faces now receive outward contact correction, with neighboring correction spread to prevent sharp fins. Repeated overlapping solver contacts converge adaptively. Cartographer bells previously folded through their own arm; secured inner vents over fitted lining retain the outer bell without duplicate sleeve bulk. | An orthogonal pairwise matrix covers 384 looks, all eight slots and three requested builds across 2,304 idle/run/wave/bank/dive/brake poses with the real wyvern saddle. Final sampled render-vertex and triangle-proxy penetration: **0**; worst free solver particle penetration: **0.256 mm**, below the 1 mm guard. Both mounted sides of four hanging outfit types are captured. |
| 3. Motion, environment and material response | Heavy Courier cloth previously used the same response as light linen. It now has greater damping/stiffness and lower air coupling/flutter. Fitted leathers remain supported by the rig. Cuirass sheets, articulated faulds, pauldron lames and knee shells attach to their intended bones rather than deforming as soft cloth. | Gust reversals, calm recovery, 0.2 s hitches, ground/deck contacts, 10 m elevation teleports, pinned seams, recoloring and quality continuity pass. Calm bell-sleeve regression checks cover three builds. A cuirass distance test verifies rigidity through actual skeletal poses. Existing cape/scarf/hair behavior stays on the original solver path. |
| 4. Production and integration | Contact profiling found avoidable high-detail cost. Conservative bounding-box rejection, cached neighbor spans and early exits reduced repeated collision work without lowering visual detail. A final overhead-wave close-up exposed culled inner shoulder folds: two-sided lining now keeps the connected garment visible, with the exterior-only shadow pass retained. Mounted review cameras were widened to include footwear/stirrups. | Full tests, typecheck/build, normal-title smoke, real Stable saves/Revert/dyes/preset restore, actual mixed-outfit takeoff/landing/dismount, all texture tiers and 28 production WebGL captures pass. The local launcher/profile safeguards are checked separately before activating the compiled release. |

## Current evidence

- **119 test files / 1,260 tests passed**; typecheck and production build passed.
- **2 dedicated geometry/CPU audits passed** using `npm run test:rider-qa`; CI now runs this
  audit as well. The full unit suite includes **35** garment/material/behavior tests.
- **15/15** game smoke, **32/32** Stable/mixing/save/actual-flight checks,
  **33/33** production appearance checks with **28** captures.
- **12/12** local menu/profile/launcher checks are recorded with the verified release.
- [Production gallery and reports](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/index.html),
  [pairwise matrix](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/clearance.json),
  [source hashes and scope](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/scope-verification.json),
  [CPU measurements](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/contact-cpu-cost.json).

The pairwise matrix uses Low for Slight and Medium for the other requested builds. The
complete Travel Drape preset retains its existing Medium/Aerie contract. High/Ultra have
separate render, sleeve and quality-continuity checks; the matrix is not repeated at every
tier. Attached roots and secured inner sleeve vent seams intentionally meet fitted clothing
and are excluded from free-surface contact tests. Face checks sample three edges and a
centroid against capsule proxies, not exact continuous mesh intersections.

The CPU-only incremental median cost of the final contact pass in the sampled run is about
0.08–0.33 ms on Low, 0.74–1.83 ms on Medium, 1.64–4.23 ms on High and 2.82–7.87 ms on Ultra.
These are Node `Rider.update` measurements, not GPU time, game FPS or a minimum hardware
specification. The Ultra robe remains the most expensive sampled case; sustained hardware
flight/weather testing is still needed. No graphics tier was increased during this QA.

## Art and scope

The [shared art library](../art/README.md), master v2/Wanderer/Scout guidance and the approved
M01 material study guide dry linen, broad matte scales, worn leather and aged metal.
Illustrations remain references rather than UV assets. Seven costume identities, complete
presets, all garment options, existing ponytail, body builds, unlocks and efficient dyes remain.
Rider atlases remain shared **Low 1K / Medium 2K / High 3K / Ultra 4K**; no per-garment 4K
maps or new dragon rendering are claimed. Existing dragon targets remain documentation.

Flight/traversal, shared analytic world geometry, rider rig/animator/IK match reviewed main.
Saves, cosmetics, graphics profiles and dragon source match the prior `c6ae42d` review.
New forearm capsules are garment presentation contacts, not gameplay colliders. There are no
new dependencies, save fields, unlock IDs or renderer changes in this QA increment.

Cloth is bounded presentation simulation with body/mount capsules and walkable-ground/deck
contact. It does not have arbitrary wall/foliage, garment self-collision, or contact between
every stacked outer layer. Leather flexes with supported joints; metal plates are articulated,
not simulated deformable solids. Finite polygon models can retain facets at extreme zoom.
The sampled tests and views support the repaired cases; they cannot promise no intersection
for every accessory, pose or future garment. Edge SwiftShader proves appearance/function,
not dedicated-GPU performance.

The normal local menu and separate all-outfit test profile serve the verified compiled
snapshot. Existing and legacy saves are preserved. Historical releases/evidence remain.
The source/evidence archive and full-history Git bundle are independently verified externally.
[Draft PR #11](https://github.com/rporter33/Driftwing/pull/11) remains for owner playtest and
code review; no merge into main or hosted production deployment is included.
