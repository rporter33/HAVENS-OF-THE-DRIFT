# Windline defect repair evidence — 2026-10-11

Scope: repair the reported sustained hanging/swinging lag and the Windline panel
covering normal flight instruments. Branch `fix/windline-hud-overlap` starts from
deployed main `193e56f382ae29fd44647e4b9c29b2fa31b9e281`. The approved flow
enhancement remains separate in draft PR #5 at `fb51663`; this repair contains
neither its new controls nor the subsequently requested reticle/cast changes.

## Sustained normal-world reproduction

`scripts/windline-performance-check.mjs` boots the ordinary production Game with
`?manual=1&quality=low`, uses the actual Roost underside and no practice solids.
It records first/repeated cast and attachment, 360 stationary hanging steps,
360 moving swing steps, 600 faster swing/grazing steps, release and recall/remount.
Five repeated casts attach successfully. Each step runs the
full Game loop at 1/120 s with renderer submission disabled for the CPU comparison.
Sweep/rock, streaming, gear visuals and reticle CPU are instrumented separately.

The measured bottleneck was the complete tether obstruction sweep: about 5,855
rock-contact evaluations every step for the 55 m line. World streaming and gear
visual updates were small by comparison. Release removes that workload.

| Normal-world case | Baseline mean / p95 ms | Repair mean / p95 ms | Rock queries per step, before → after |
| --- | --- | --- | --- |
| 18 m stationary hang | 3.17 / 6.50 | 0.88 / 1.30 | 1,776 → 0 |
| 18 m moving swing | 4.32 / 8.90 | 2.03 / 5.30 | 1,776 → 481 |
| 55 m stationary hang | 6.34 / 19.00 | 1.24 / 3.60 | 5,855 → 0 |
| 55 m moving swing | 10.05 / 25.60 | 3.68 / 11.00 | 5,855 → 1,501 |
| 55 m faster swing | 9.95 / 26.00 | 2.70 / 3.10 | 5,870 → 1,516 |
| Released, after 55 m swing | 0.76 / 2.10 | 0.53 / 0.90 | 105 → 77 |

Raw captures: [baseline](../windline-performance-before.json) and
[repair](../windline-performance-after.json). Timings vary with JIT/GC and the
shared environment. The repair still recorded isolated maxima of 44.3 ms during
moving swing and 25.0 ms during faster swing; this is a sustained cost improvement,
not a promise that every frame has zero hitch. `softwareRenderedMs` records CPU
renderer submission separately; it does not measure physical GPU presentation.

The repair clips vertical samples to exact shared island contact-plane intervals
and reuses the sweep's analytic candidate list. A moving tether uses a 4 cm sample
spacing with a 2 cm conservative rock-envelope expansion. The previous line used
1 cm spacing with 0.5 cm expansion: up to 1.5 cm more clearance can now stop a line
near rock. The whole line, its anchor solid and static identity are still checked.
Body and projectile sampling, exact primitive sweeps, collision budgets, and
fail-closed behavior remain unchanged. No collision checks are disabled or
deferred across physics steps. Seeded fine-lattice regression coverage remains;
those sampled paths retain their reference contacts, rather than proving all
possible collision paths safe. Deterministic tests additionally cover exact
underside contact/clearance boundaries, both sides of the angular seam, and a
spire tangent between coarse lattice endpoints. They distinguish the former
2.5 cm envelope from the new 4 cm envelope. Actual normal-world faster swinging catches at an edge twice
in the short-line case and retains the tether safely.

## HUD evidence

The old panel overlaps the flight instruments at 1920×1080, 1280×720 and a short
617×380 test viewport. The supplied 617×380 image may be a crop; it is used as a
stress size, not an assumed user display resolution.

- 1280×720: [before](../windline-hud-before-1280.png) / [after](../windline-hud-after-1280.png).
- 617×380: [before](../windline-hud-before-617.png) / [after](../windline-hud-after-617.png).

The new secondary-panel placement reserves instrument boxes, their absolute
notes, compass, race feedback, tutorials, notices and prompts. It includes the
discovery banner's declared pseudo-element overflow, clipped to the viewport, and protects the
central gameplay view. Optional guidance becomes a compact control row where a
full card cannot fit. Airborne traversal status gets a resource-only fallback.
If no safe edge slot exists even then, the secondary panel is suppressed rather
than placed over a primary instrument. The ordinary critical-state matrix requires
that status remains visible; optional mounted guidance may be suppressed in a
crowded viewport. Core traversal status remains available with hints disabled.
Content/visibility changes update placement immediately; stable frames avoid
forced layout with a bounded 20 Hz check. Placement itself makes no world queries.
Panel geometry does not animate through occupied space when reduced motion is on.

`scripts/windline-hud-layout-check.mjs` verifies 40 combinations: mounted,
mounted with controlled long prompts/tutorials, freefall, tether, pull, boost,
recall hold and hints disabled, at 1920×1080, 1280×720, 960×540, 617×380 and
360×780. It asserts sibling box and discovery-band non-overlap, viewport containment and
central-view clearance, and captures 20 screenshots for inspection. It also
checks pause, hidden HUD and actual PhotoMode. The crowded presentation uses
existing components and restores their DOM state; progression is not altered.
An additional forced no-slot test verifies optional guidance is hidden and returns
when space becomes available. These bounds do not claim to measure every possible
decorative effect painted outside every pre-existing sibling box.

The Windline panel passes these checks. In the crowded 617×380 mounted case,
[optional guidance is suppressed](../windline-hud-crowded-617.png) while primary
instruments remain clear. Existing tutorial cards and the long
interaction prompt still crowd one another in the extreme portrait stress case;
this repair does not claim to redesign the entire pre-existing mobile HUD.

## Verification and release boundaries

- On the reviewed prior head `17df8a1`: CI full unit suite (1,142 tests / 109 files),
  typecheck/build, smoke and all browser integration stages passed.
- Review follow-up: 102 focused tests in four files passed. Final-head full CI is
  recorded in PR #6 before release.
- Typecheck and production build passed.
- Normal-game traversal, pause/interruption, repeated leap/boost/recall,
  simulated controller transitions and save/reload browser regression passed.
- Responsive HUD matrix, optional no-slot suppression/recovery and menu/photo
  checks passed; actual committed-build captures inspected.
- Sustained normal-world query-cost regression passed; five repeated attachments
  passed and both lines remained retained through extended swing/grazing.
- PR CI and deployment must run against the final committed repair before release.

New browser evidence carries the full tested commit/tree, runner commit and dirty
state, runtime build stamp, loaded script URLs, browser identity and capture time.
The runner rejects a runtime build stamp that differs from its explicitly tested
commit. The table and raw files above now come from clean source commit
`c1b8e37b0e6fb6b4d09ea8da2bda9a74ece2fc87` (runtime `Build c1b8e37`)
and baseline `a475c40cae0bfe6f806978d1e0b031e7744af2a4`
(runtime `Build a475c40`). The baseline tree is exactly the deployed main
`193e56f` tree; this is not a claim that the loaded baseline stamp was `193e56f`.
The subsequent evidence commit changes documentation/captures only.
[Before capture manifest](../windline-hud-before-manifest.json) and
[after matrix/manifest](../windline-hud-after-manifest.json) include capture
paths and SHA-256 hashes. Historical exploratory data is retained in Git history.

Both verification and Pages workflows now include the normal-world HUD and cost
checks. PR verification checks out the actual PR head and supplies that same SHA
to build and smoke, fixing the draft's merge-reference build-stamp mismatch.

No physical controller, iPhone, or physical GPU was tested. Chromium uses
SwiftShader in this cloud environment. Windhaven remains isolated from ordinary
gameplay, its unfinished prototype and the existing dock backdrop are preserved,
and art references, character assets, progression/save IDs and mounted flight
physics are unchanged.
