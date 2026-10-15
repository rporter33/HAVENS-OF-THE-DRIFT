# Windline priority visual review — 2026-10-11

These four completed PNGs support review of the HUD obstruction repair and the
approved fixed centre dot/controller prompts. They are full browser captures,
not motion clips, physical controller tests, or proof of rider animation quality.

| Capture | Actual captured source | File |
| --- | --- | --- |
| Before HUD, 1280 × 720 | `a475c40` (same tree as deployed main `193e56f`) | [PNG](../windline-hud-before-1280.png) |
| Repaired HUD, 1280 × 720 | `c1b8e37` | [PNG](../windline-hud-after-1280.png) |
| Valid centre dot and Xbox controls, 1280 × 720 | `43439d8` | [PNG](../Driftwing-valid-dot-controller-720p-43439d8.png) |
| Freefall status and Xbox controls, 1280 × 720 | `7fde07c` | [PNG](../Driftwing-controller-freefall-720p-7fde07c.png) |

The existing before/after images match the review copies byte for byte. The new
captures have [SHA-256 hashes](../windline-priority-review-manifest.json),
[reticle/source metadata](../windline-priority-review-reticle.json), and the
[24-case controller HUD matrix](../windline-priority-review-controller-hud.json).
The controller matrix activates the simulated standard Xbox controller, asserts
actual gamepad device/glyph selection, and checks viewport containment, primary
HUD/central-view clearance and status visibility. Green/ring checks inspect the
painted computed style and a real RT cast's matching static anchor/impact.

The dot uses light blue for neutral and green plus a ring for a currently valid
centre-ray attachment. It stays at the screen centre. Changed aim clears stale
green feedback until the next bounded forecast; pressing cast solves afresh.
The under-Roost fixture's close rock background is intentional collision/aim
test context. These images do not demonstrate the deferred updated character.

The requested Library retry failed before creation with
`hosted apps tools/list request failed: network`. No Library files were created.
The completed evidence is instead preserved in the authorized draft branch.

## Focused practice-route retry

The retry ran only a fresh prototype boot, a reload after a distant airborne
fixture, and the existing unpowered swing/landing sample. It did not rerun full
suites or change runtime code. [Diagnostics](../windline-priority-review-practice-retry.json)
record a 2.26 s fresh boot, 92 ms reload document, 1.67 s reload-to-ready, and no
browser/network errors. Release at step 200 lands physically on the far platform
at y = 400, z = −51.68 without pull or boost. The matching pillar pass reaches
17.26 m/s; the camera-roll and recenter bounds pass. The previous timeout's cause
was not established.

The retry loaded the same production asset as the clean `7fde07c` controller
capture. The prototype has no pause build stamp; this identity limitation is
recorded explicitly alongside the production script hash. The subsequent
`5d30bb9` commit changes only its presentation regression test.

Full enhancement CI and user/parent release review remain the merge gates.
Windhaven gameplay, character model updates and separate audio PR #7 are excluded.

Source CI `38113451419` subsequently failed the ready-preview average CPU cost
assertion in `windline-reticle-check.mjs`, after normal gameplay/save/reload and
controller flow passed. It did not reach the prototype practice reload. The
follow-up schedules each forecast cooldown from completion and yields additional
time after an expensive query, capped at 250 ms. Changed-pose eligibility still
clears immediately and a physical cast still solves afresh. The 2.5 ms average
cost assertion and all collision/behaviour assertions remain unchanged. A slow
query regression verifies that the next gameplay frames do not repeat it
immediately. New exact-head CI remains required before release.

Independent review found that the former 0.008 rad / 15 cm / 0.5 m/s pose
tolerances could keep green after crossing a thin target, range limit or
intervening obstruction. Freshness now requires identical camera position,
camera-centre direction, harness position and inherited velocity, plus a still
valid static anchor. No nonzero pose tolerance is claimed as a clearance proof.
Deterministic real-collision regressions cover a 0.007 rad thin-target turn,
3 cm range crossing, 12 cm camera shift, 14 cm harness obstruction shift and
0.49 m/s velocity change. Unchanged proven poses retain green; removed anchors
clear it immediately; a subsequent fresh forecast restores valid feedback.

Responsiveness remains a review consideration: a changed pose is neutral/checking
until the next bounded forecast. During continuous motion, green can appear on
fresh forecast frames and clear on intervening frames. The moving-camera browser
evidence now records valid/checking frame counts so this tradeoff is visible.
Continuous green through changed poses would require an actual conservative
clearance certificate or current-query validation, rather than another tolerance.
The strict patch is not presented as solving that interaction/performance tradeoff.

The local strict-pose moving-camera sample recorded 3 valid frames and 117 checking
frames out of 120, at 0.289 ms reticle CPU per step. This is an accelerated manual
CPU sample, not a real-time frame-rate or usability result.

CI `38114322480` on the prior `d3e36b2` head passed the retained reticle CPU
assertion at 1.005 ms per step (three real forecasts), with 17.5 ms swing p95.
It later failed `617×380 freefall critical status visible` in the keyboard HUD
matrix. The matching local Chromium 154 eight-case 617×380 check passed; the CI
Chromium 141 failure is unresolved. Critical-visibility assertions stay intact,
and the harness now prints full placement/blocker diagnostics on failure.

The follow-up additionally records the collider index's geometry revision as
part of the snapshot, so adding a new first-solid obstruction invalidates green
even with an unchanged pose and a still-valid old anchor. This metadata changes
no geometry, candidate queries or collision/physics decisions.

The resource-only HUD fallback now omits passive recall guidance while retaining
held-action progress and active rescue feedback. Full/compact guidance remains
available when it fits. This keeps the documented minimal fallback focused on
critical status/resources. The existing critical visibility/overlap gates remain
unchanged; exact-head CI must verify the reported 617×380 failure after this fix.

## Underside prototype CI follow-up

CI `38115478811` passed 1,171 tests, normal/controller flow, fixed-dot/fresh RT
casts, the unchanged reticle CPU guard and both HUD matrices (40 keyboard / 24
simulated Xbox). It then failed the isolated control prototype's underside cue.
The failure reproduces: the compensated projectile contacts an earlier ledge on
the same island 1.542 m off the camera-centre ray. A green cue would violate the
first-solid/centre-ray contract. Settling interpolation does not change that result.

The control regression now retains this obstructed view as a required blue case,
then deliberately turns to a clear face for the original green-and-attachment
checks. The actual cast exactly matches the clear-face forecast point at 23.22 m
and retains its line. Air steering, bounded boost, solid wall and no-surface
assertions remain intact. A deterministic real-island unit test also rejects the
earlier ledge even though its physical anchor ID matches the selected island.
No runtime targeting, collision, range, input or forecasting budget was relaxed.

The focused run passed 42 presentation/target/collider tests, typecheck and the
complete isolated control check against the unchanged `3ec59eed` runtime. New
exact-head CI and actual rendered movement-cue evidence remain required. Main
is the independently released repair `bc86843`; this follow-up remains draft.
