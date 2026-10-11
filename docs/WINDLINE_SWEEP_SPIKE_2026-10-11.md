# Bounded underside sweep spike

Historical report for failed head `6d5d8d1`. Robert subsequently authorized a deeper performance pass; see [current-render validation](WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md) for its different implementation and evidence. The original failure below remains preserved.

The candidate does **not** meet the complete fresh-query CPU acceptance gate. It is disabled by default; normal gameplay retains the reviewed complete sweep and truthful changed-pose invalidation. Per-render changed-pose forecasting was not enabled. PR #5 remains draft, with no merge/deploy authority. Main remains the PR #6 repair release `bc86843a494c64bed347ca6cdca7c52e3ef1ee66`.

## Scope and preserved behavior

The opt-in third `TraversalWorld` constructor argument enables a query-local empty-space certificate, solely for this bounded experiment. No new collision representation or terrain approximation is introduced. Original primitive/candidate coverage, sample count/lattice, first-hit ordering, 12 bisections, probe radii/inflation and the 16,384 logical-query fail-closed budget remain unchanged. Every potential contact still calls the complete original `rockContact` candidate list; sequential corrections and anchor identity stay intact. Unsupported bounds use the original path. No budget, CPU or HUD assertion was weakened.

Only authored island undersides are supported. Seeded filler deformation, nonfinite/large boxes, the origin singularity, changed shape definitions and horizontal spans above 12.8 m fall back. Exact vertical columns retain the existing exact-column path. Spires, arches and primitives retain their original paths. No cross-query cache is used. Windhaven gameplay, character work, audio PR #7 and editor foundations remain separate; the ship prototype and existing static dock are preserved.

## Bound justification

`authoredBottomBounds` is a natural interval extension of the existing `bottomHeight`, including profile, ridge noise, lump noise and teeth. A box's enclosing disk supplies radial/angle ranges. Periodic outline noise has six harmonics with positive normalized weights, hence angular derivative magnitude at most 6; angular sine/cosine derivative magnitudes are at most 1. The normalized radius, smoothstep, products, powers and final stal cap propagate enclosing intervals without assuming independent values are correlated.

For the installed simplex-noise 4.x function, each of three contributions is `70 t^4 (g·q)`, where `t=max(0,1/2-|q|²)` and `|g|<=sqrt(2)`. Its gradient is `70 t³(t I - 8 q qᵀ) g`. Over `0<=t<=1/2`, `t³ max(t,|9t-4|)<=1/16`. Thus the full gradient norm is at most `3*70*sqrt(2)/16 <19`; the implemented Lipschitz constant is 24. The kernels vanish with their derivatives at support/cell seams, so the bound extends across seams. Each noise interval evaluates the actual seeded function at the argument-box centre and adds this derivative bound times the box radius. FBM and soft ridges propagate those intervals; sampled heights alone are not assumed to enclose unsampled geometry.

Every authored tooth is a zero-extended cone with normalized radius at least .32 and amplitude at most 1, giving slope at most `2/(.32*cell)=6.25/cell`. A maximum of such cones has the same Lipschitz bound. The original neighboring-cell search includes every active tooth: a cell beyond the immediate neighbors is at least 1.2 normalized cells away, while support radius is at most .54. This handles tooth-cell seams.

The certificate bounds **contact planes**, rather than only the visible underside. Let `B` enclose bottom height over the query XZ box. Separate intervals at offsets `(+1.5,0),(-1.5,0),(0,+1.5),(0,-1.5)` enclose the exact finite-difference stencil. Their differences bound `|hx|,|hz|` by `HX,HZ`. The existing bottom normal is `(hx,-3,hz)/sqrt(hx²+hz²+9)`, so reciprocal downward normal Y is at most `sqrt(HX²+HZ²+9)/3`. A sphere contact is impossible below `B.lo - inflatedRadius * reciprocalYBound`.

The floor also includes `(minTopY+B.lo)/2`. Below it, the original inner-footprint dispatch is guaranteed to choose the underside, preventing an unsupported top-plane rejection. Outside the footprint, rim contact requires vertical distance to bottom below the probe radius; the broader plane envelope encloses it. Distant slices first use the **same far-side normal-envelope rejection already present in `collideIsland`**, saving stencil construction; near slices retain all four stencil intervals.

Interval operations expand endpoints by `1e-12*(1+maxAbs)`; angle and final floor receive additional outward guards. Supported coordinates are bounded, and unsupported/nonfinite calculations return the original path. These floating guards and deterministic parity cases are engineering validation, not a universal formal proof of JavaScript transcendental implementations. The candidate requires review even if a future cost gate passes.

The sweep splits only its certificate domain into small XZ boxes. It still visits the original merged AABB ranges and charges every original lattice point against the logical budget **before** rejecting a proven-empty point. Consequently clipping cannot convert reference exhaustion into an unchecked success. Bisection never uses the new rejection shortcut.

## Evidence and acceptance

Initial paired moving-pose profile (dirty experimental build; preliminary, not exact-head certification): 80 complete fresh queries per depth, alternating original/candidate order after warmup. Harness/camera position, camera quaternion and inherited velocity change each query. Each call performs the centre ray, projectile simulation and tether preflight; no cached/checking calls are included. All 240 paired target states, anchors, distances and impacts matched exactly.

| Depth below underside | Original mean / p95 / max ms | Candidate mean / p95 / max ms | Candidate mean ray / projectile / tether rock queries |
|---|---|---|---|
| 18 m | 4.386 / 4.90 / 17.80 | 2.583 / 3.10 / 8.20 | 165.59 / 186.51 / 96.26 |
| 45 m | 8.479 / 24.20 / 45.00 | 2.627 / 10.10 / 15.60 | 166.55 / 168.54 / 81.55 |
| 55 m | 8.010 / 20.50 / 28.80 | 2.466 / 2.60 / 24.60 | 165.74 / 136.55 / 80.66 |

The <=2.5 ms **mean at every depth** gate fails. Individual/tail timings include browser instrumentation, JIT/GC and software-browser variability. These data certify neither physical GPU frame rate nor iPhone/controller usability. Exact-head CI runs the same paired script, uploads `/tmp/driftwing-complete-preflight-browser-check.json`, and retains all existing correctness/CPU/HUD/prototype gates. Final exact-head results and workflow links are recorded in the PR; this table must not be presented as a clean-head measurement.

New tests check 1,500 contact-plane boxes at crags/teeth/rims/angular seams, five locations each; 320 complete and interrupted sweeps compare full hit/no-hit, fraction, impact, normal and anchor against the original path. Additional cases cover thin primitives, initial overlap, geometry revisions and length exhaustion. Existing range/path, tangent, controller, save/reload, collision, HUD and prototype regressions remain mandatory. Full preliminary unit suite: 1,175 tests / 110 files; the added final edge cases and exact committed head are checked by CI.

Run the complete profile with `CHROMIUM_PATH=/usr/bin/chromium node scripts/windline-preflight-profile.mjs http://127.0.0.1:5175/`. `--assert-budget` enforces the complete-query acceptance gate and is expected to fail for this candidate. The ordinary CI profile asserts complete-path parity and disabled gameplay status; it records the experimental gate separately instead of silently enabling an over-budget candidate.

Next authorized action: finish exact-head CI/evidence and report this bounded failure to the parent. Further significant optimization, a new collision representation, changed green semantics or release requires a new decision. The existing high-refresh cue pulsing blocker remains unresolved.
