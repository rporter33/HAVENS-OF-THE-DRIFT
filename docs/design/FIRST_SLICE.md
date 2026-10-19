# Havens of the Drift: pillars and first-slice scope

Written 2026-10-17 from the [decision log](DECISION_LOG.md) (29 answered, 2 open) against main `b9d9403`. Every row below says what exists in source today, what changes, and how the change is accepted. Each gate is a separate branch and PR with the acceptance test run in CI. Order is a proposal; Robert opens gates one at a time.

## Pillars

1. **Learning to fly well changes how you explore.** Four earned capabilities (thermal climb, steep-slope landing, snap-roll, Windline from the saddle) each open a route that was closed before. Nothing is gated by a menu.
2. **Your dragon is a companion, not a vehicle.** Bond grows from what you do together; it shows in behavior first (greeting, anticipatory lean), capabilities second, never as a meter.
3. **Races prove it on the same terrain.** No race-only physics. Per-breed records, variants on known courses, rivals you can collide with.
4. **The Drift stays, re-dressed.** One archipelago, one starting haven (Windhaven), characters upgraded before terrain. Smooth surfaces, vibrant color, the painterly identity kept.
5. **The world is older than you.** Ventari ruins, inscriptions, clans introduced in the comic. The mystery does not resolve in release one.
6. **Solo first.** No networking until the loop is proven; then a feasibility test with zero co-op content. Combat secondary, never the loop.

## Gates in proposed order

| # | Gate | Exists in source | Changes | Acceptance | Size |
|---|---|---|---|---|---|
| G1 | Archive housekeeping | 19 unreferenced review scripts in `scripts/`; `assets/rider-blender/source/` 34 MB | Move both to `havens-archive`; register entries; restore check | Full CI green; `git ls-files` count drops by 19 scripts and 7 source files; register records archived status with hashes | XS |
| G2 | Title and naming | Title screen says Driftwing; `Windward Roost` is the landmark id and label | Display title "Havens of the Drift" with a designed wordmark; label `Windward Roost` becomes "Windhaven" where shown to the player; ids, save keys and course ids unchanged | Smoke 15/15; no change to `driftwing.save.v1`; screenshot review of title and discovery banner | S |
| G3 | Rider and wyvern visual upgrade | Procedural toon materials; wardrobe 8 slots; opt-in Blender rider trial | Material and texture pass on wyvern and rider toward the target renders (smooth shading, richer color ramps, specular where the renders show it); keep toon ramp and fog contract | Gameplay-camera captures per `ART_DIRECTION.md`, side by side with the target render; `rider-qa` and `rider-blender` suites green; 60 fps at Medium on the reference GPU | M |
| G3b | Modeled Harrier trial (opened 2026-10-18, Q38; first trial in game 2026-10-18; game head and head slot, Q39) | Procedural wyvern only; the rider's `?riderTrial=blender` loader as the pattern | Meshy base body from an Astra turnaround, fitted in Blender to the 60-joint skeleton with region/belly/back attributes and LODs; procedural wings kept and lengthened; self-collision proxies from the new body; dev-only `?wyvernTrial=blender` | Captures beside targets 01 and 02 and at the gameplay camera; full vitest and smoke green; flight, saves and controls unchanged; triangles measured within 14,000 to 16,000 bare and the 24,000 LOD0 ceiling | L |
| G3c | Look development (opened 2026-10-18, Q40) | Painterly toon ramp and flat sun-side lift, no AO on screen, one shadow box, gradient sky that turns sand at golden hour, relief-marched cloud sea, storm-wall boundary | Real rim and deeper shade, the wyvern's baked AO and screen-space AO on High/Ultra, blue-sky golden hour with a cool aerial fade, a higher-contrast cloud sea, a layered cloud boundary at the world edge, a slightly narrower default lens, deeper wing membranes (visual; flight stats unchanged) | `scripts/lookdev/` scores matched views against targets 01, 02 and 10 before and after; full vitest and smoke green; flight, saves and controls unchanged; gameplay-camera captures on High and Medium | M |
| G4 | Bond expression v1 | Nothing | Roost greeting on arrival; anticipatory lean 0.3 to 0.5 s before a known maneuver at a landmark the player has flown 3+ times | New unit tests on the bond state; capture of greeting and lean; no flight-model change (lean is presentation) | S |
| G5 | Capability unlocks | All unlocks cosmetic | Four capabilities as data in `progression/`; each tied to one bond milestone; stronger thermal climb and steep-slope landing change physics parameters inside existing clamps; snap-roll is an input combo; Windline from the saddle reuses `traversal/` | Each capability has a route test: a course or landmark approach that fails before and succeeds after; deterministic replay unchanged for players without the unlock. Parameters, clamps, milestones and route contracts in [CAPABILITIES.md](CAPABILITIES.md) | L |
| G6 | Race variants and records | Seven courses, per-breed ghosts, pace-model medals | Reverse and one Challenge variant on two courses as `courses.ts` data; record screen shows breed and capability tier | Autopilot medals every variant on every breed (existing test pattern); ghosts keyed by variant | M |
| G7 | AI rivals | Autopilot exists for tests | One rival per course driven by the autopilot with a personality offset; collision between rider bodies using the shared geometry contract | Rival finishes within medal window; collision test; 120 Hz determinism preserved with rivals seeded | L |
| G8 | Terrain and dressing upgrade | Procedural islands, painterly dressing; Region Workshop; courtyard asset kit on a Driftwing branch (#9) | Windhaven quadrant first: materials, dressing density, Aegean kit from #9 if accepted. The two capability sites moved to G8a | Gameplay-camera captures vs target renders; editor-verify green; draw-call budget unchanged at Medium | L |
| G8a | Capability sites (opened 2026-10-17, Q34; lands before G5) | The steep-landing and snap-roll routes have nothing to gate (CAPABILITIES.md) | Cascade south perch and Archway Keyhole as sculpted rock forms (`RockFormShape`), at the render brief's fidelity; a debug-only `?capPreview` for playtesting | Real-physics before/after tests per site; race lines and other rock clear; captures; playtest ([plan](../qa/G8A_CAPABILITY_SITES.md)) | M |
| G9 | Quintus | Speaker id only | Quintus present at Windhaven with 3 to 5 lines tied to M1 First Lead; no dialogue system beyond the existing tips/banner UI | Lines appear at the right triggers; no save schema change | S |
| G10 | Secondary combat prototype | Nothing | One optional pursuer encounter off the race path; no damage model, evasion only | Prototype behind a debug flag until reviewed | M |
| G11 | Networking feasibility | Nothing | Two clients see each other's position at 10 Hz on a test server; no gameplay | Latency and determinism report; no runtime dependency added to the game build | M |

Not scheduled: dragon rig (waits on Meshy or Blender output), Craghorn (name open), aerial ball sport (after shared airship), comic website (separate release track), Codex ship gameplay (after G5).

## Open items that block a gate

- G3 and G8 need the target renders in `docs/art/targets/`. Until they arrive, the art pack in `docs/art/` is the fallback authority.
- G5's parameter ranges are proposed in [CAPABILITIES.md](CAPABILITIES.md) (2026-10-17). Its steep-landing and snap-roll route tests use the G8a capability sites. Q35 (the Keyhole's tuck bypass) and Q33 (keyboard double-tap) are open; both are playtest questions.
- G7 needs a decision on rival count per course (proposal: one).
- Q12b (Vellum) only affects G9's line count.

## What this does not change

Flight physics constants, the 120 Hz step, `driftwing.save.v1`, course ids, control mappings, the Three.js WebGL 2 renderer.
