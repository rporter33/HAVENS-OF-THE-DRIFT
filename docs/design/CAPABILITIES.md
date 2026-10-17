# G5 capabilities: specification

Written 2026-10-17 against main `4647b27` for gate G5 in the [first slice](FIRST_SLICE.md), from [decision log](DECISION_LOG.md) Q4 (four capabilities, each tied to one bond milestone and one route it changes) and Q5 (bond gives dragon capabilities). This is a planning document: it authorizes nothing, and every number below is a proposal until Robert opens G5.

Sources are cited as `path:line` on `4647b27`. "Measured" means the existing flight, terrain and wind code was run in a scratch harness (not committed; the methods are under each table). "Estimated" means arithmetic on measured inputs. For example, the soaring reach below combines each breed's measured circling sink and best glide ratio with the analytic thermal profile in `windField.ts`.

## The finding that shapes this gate

Q4 and pillar 1 ask for capabilities that "open a route that was closed before". Measured against the current layout, **none of the four opens a place that is physically closed today**:

- **Thermal climb (estimated).** Soaring alone already reaches every island top and spire top in the Drift for every breed, in clear weather and in rain. A stronger climb raises the thermal ceilings by 3 to 10 m, because each column's lift fades to nothing at its `topY` (`src/sky/windField.ts:35-37`, `:176-178`).
- **Steep-slope landing (measured).** No ground between 49.5° and 53° is more than 9 m from ground a wyvern can already land on at the same height (2 m on Cascade Isle, sampled finer). That holds for every named island, spire top and rugged scatter island.
- **Snap-roll (measured).** The layout has no solid-to-solid gap narrower than a wingspan. Only the Archway Reach arches' bounding shapes come within 30 m of other rock, and the narrow readings there are wedges where arch feet meet islet rock.
- **Windline from the saddle.** Every Windline target is already reachable today by the hold-to-leap, freefall-cast and hold-to-recall sequence.

So, as specified, each capability makes a route **faster or more forgiving**; it does not unlock access. Each section below names the layout route where the difference shows, states the test contract under which it fails before and succeeds after, and says how strong that gate is.

**Decided 2026-10-17 ([Q30](DECISION_LOG.md)):**
- **Steep-slope landing and snap-roll:** G8 authors one capability site each, closed by physics until the unlock. The requirements are in [Capability sites](#capability-sites-for-g8).
- **Thermal climb and Windline from the saddle:** keep their timed contracts.

## Summary

| Capability | Parameter (source) | Current | Unlocked | Clamp | Bond milestone | Route | Gate |
|---|---|---|---|---|---|---|---|
| Stronger thermal climb | New per-instance `FlightModel.liftGain` on rising air at `FlightModel.ts:718` (same pattern as `regenMultiplier` `:461` and `capacity` `:466`) | 1 (air used as sampled) | 1.25 | ≤ 1.3; thermal `topY`; still-air polar unchanged | Highmoor known | Highmoor climb-out in thermal 3 | Timed, no wingbeats |
| Steep-slope landing | `GaitProfile.landNormalY` (`src/core/gait.ts:40-44`) over `PLAYER_TUNING.landNormalY` (`src/player/tuning.ts:18`), read by `slopeLimitY` (`src/player/ground.ts:27-30`) | 0.65 (49.5°) | 0.602 (53°) | > cos 56° = 0.559 (the Craghorn); required content ≤ 49.5° | 4 landmarks known, incl. Cascade Isle | Cascade south perch (G8 site), near (800, 457, −692) | Authored site, closed by physics |
| Snap-roll | `BreedStats.maxRollRate` and `rollAuthority` (`src/flight/breeds.ts:83,87,111,115,139,143,167,171`) during a short burst | per breed (below) | × 1.6 for 0.6 s | ≤ 1.6 (× 2 breaks the skimmer's roll-out) | 6 known banks, ≥ 1 at the Archway Reach | The Archway Keyhole (G8 site), between arch 1 and arch 2 | Authored site, closed by physics |
| Windline from the saddle | `Player.windlineHoldAction` (`src/player/Player.ts:145-148`) and `LANCE.callHold` (`src/traversal/tuning.ts:4`) | cast only after a 0.4 s hold-to-leap | cast from flight, one press; caught on release | `LANCE.maxLength` 65 m / `chargedLength` 95 m; only below `boostMaxSpeed` 36 m/s | 8 landmarks known, incl. the Eye | Through the Eye of the Gale | Timed; open sky makes it the strongest |

## Bond milestones

Milestones read the G4 bond memory (`src/bond/memory.ts` in [rporter33/HAVENS-OF-THE-DRIFT#6](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/6), not yet merged), so G5 depends on G4 landing first:

- **Known landmark:** `LandmarkBond.passes ≥ BOND.knownPasses` (3).
- **Known bank:** a site returned by `knownSites()`, meaning seen in at least 2 passes at a known landmark.

The order is thermal climb, then steep landing and snap-roll, then Windline from the saddle. Each capability's own route landmark must be among the known ones, so the dragon learns the place before it learns the trick there.

The persistence question from G4 (its own `driftwing.bond.v1` key, or session-only) decides whether a capability survives a reload. If the bond stays session-only, unlocks would reset every session, so G5 needs that answer first.

How the unlocks reach the physics: the Player sets the per-instance value on the model at mode changes, the way Rested sets `regenMultiplier` and `capacity` today. The flight model's numbers for a player without the unlock stay exactly as they are, so their replays and ghosts are unchanged. Records and ghosts flown with a capability need the capability tier in their key (Q7; G6).

---

## 1. Stronger thermal climb

**Parameter.** There is no thermal-specific knob in `src/flight` or `src/player`. A thermal reaches the flight model only as vertical air: `env.windAt` at `src/flight/FlightModel.ts:718`, smoothed into `updraft` at `:719`. Proposed: one new per-instance multiplier, `liftGain`, applied to the vertical component of the sampled air when it is positive. It follows the pattern the Rested bonus already uses, set by the Player on the model (`regenMultiplier` `:461`, `capacity` `:466`).

| | Value |
|---|---|
| Current | 1 (`FlightModel.ts:718` uses the sampled air as is) |
| Unlocked | 1.25 |

**Why not the breed numbers.** The alternative was a lower circling sink: `BreedStats.inducedK` × 0.8 while in rising air. Measured, that cuts circling sink by about 11% (harrier 2.35 → 2.08 m/s), which is only +3% climb in a 12 m/s thermal: too small to feel. Lift gain is the lever that changes the climb.

**Clamps.**
- **Ceiling.** Lift fades to zero over the top 18% of each column (`windField.ts:35-37`, `:176-178`), so no gain lifts a dragon above `topY`. The highest is thermal 3's 1,050 m. Estimated: the gain moves each thermal-only ceiling by 3 to 10 m.
- **Still air.** The gain multiplies rising air only, so the glide polar, the per-breed ratings tests (`src/flight/breeds.test.ts:23` and following), the circling-sink bound (`breeds.test.ts:111`, under 3 m/s) and the courses' pace model are untouched without lift.
- **Weather.** The weather multiplier never falls below 0.62 (`src/sky/weatherModel.ts:25-38`). Keep `liftGain` ≤ 1.3, so an unlocked dragon in rain (0.62 × 1.3 = 0.81) still climbs slower than a locked one on a clear day.
- **Ridge lift.** It is rising air too, so it gets the same gain. That's intended (the dragon works any lift), but it must be in the test.

**Route: Highmoor climb-out in thermal 3** (`src/world/layout.ts`, `thermals[3]` at (−260, 330), core 12 m/s, top 1,050 m, hugging Highmoor's cliff; Highmoor's top is 760 m).

Contract: clear weather, start circling at 300 m in the core, no wingbeats; reach Highmoor's top + 10 m (770 m) within 42 s.

| Breed | Circling sink (measured) | Before: climb, time | After (× 1.25): climb, time |
|---|---|---|---|
| Harrier | 2.35 m/s | 9.65 m/s, 48.7 s, fails | 12.65 m/s, 37.2 s, succeeds |
| Skimmer | 2.57 | 9.43, 49.8 s, fails | 12.43, 37.8 s, succeeds |
| Galewing | 1.56 | 10.44, 45.0 s, fails | 13.44, 35.0 s, succeeds |
| Ironback | 2.87 | 9.13, 51.5 s, fails | 12.13, 38.7 s, succeeds |

Method:
- **Sink:** `measureCircling` (`src/flight/telemetry.ts:237`) at 35° bank. Every breed's circle (45 to 68 m radius) sits inside thermal 3's full-strength core (77 m).
- **Times:** estimated as 470 m ÷ (12 × gain − sink).
- **Cross-check:** a scratch run of the real `FlightModel` in the game's `WindField` (no wind or gusts) gave 52 to 54 s before and 35 to 38 s after where the circle held. The circle held for the skimmer and galewing; in the other runs the open-loop circle drifted out of the column, because the edge's gust-roll pushes the wing out.
- **For the G5 test:** the route needs the race autopilot's thermal centering, not an open circle.

**Gate strength: weak.** It is a timed climb, and wingbeats would beat it, so it only holds under the no-wingbeat contract. It changes how fast you get up, not where you can go.

## 2. Steep-slope landing

**Parameter.** The landing slope limit is the least ground normal y a wyvern can land on:
- `PLAYER_TUNING.landNormalY` (`src/player/tuning.ts:18`) is the global value.
- `GaitProfile.landNormalY` (`src/core/gait.ts:40-44`) is the per-breed override that already exists.
- `slopeLimitY(breed, 'land')` (`src/player/ground.ts:27-30`) reads them, at the touchdown test (`src/player/Player.ts:855`: steeper ground skates the legs off) and as the floor limit in the walker's wall resolution (`ground.ts:185`, `:215`; `Player.ts:383`).

The unlock sets the bond-unlocked breed's effective land limit, through the same read.

| | Value |
|---|---|
| Current | 0.65 = cos 49.5° (every breed) |
| Unlocked | 0.602 = cos 53° |
| Unchanged | walk limit `maxSlopeY` = cos 40° (`tuning.ts:32`); `landSpeed`, `landSink`, `landSinkFlared` |

**Clamps.**
- **The Craghorn.** Stay steeper-than-current but short of 56°: `landNormalY` > cos 56° = 0.559. 56° is the Craghorn's signature footing (`docs/ROADMAP.md:80`); an unlocked wyvern must not take it.
- **Required content** never sits on ground steeper than 49.5° (`docs/ROADMAP.md:113`), so every perch this opens stays optional.
- **The rest pose on a 53° slope needs a check.** The standing body takes 0.35 of the slope (`gait.ts:64`), so G5 needs a gameplay-camera capture of the four breeds standing at 53°, with no foot sliding and the rider seated. The roadmap asks the same of the Craghorn at 56°.

**Route: Cascade Isle south crag** (`src/world/layout.ts`, island `cascade` at (820, 430, −520), hills 38 m, the most rugged named island). The aim point is (800, 456.7, −692), where the ground slopes 52.7° (normal y 0.607).

Contract: a flared landing aimed at that point holds.
- **Before:** normal y 0.607 < 0.65, so the legs skate off at `Player.ts:855`. Fails.
- **After:** 0.607 ≥ 0.602, so it touches down. Succeeds.

Measured: Cascade Isle's top has 537 sampled points in the 49.5° to 53° band (2 m grid). Every one is within 2 m of ground already landable at the same height.

**Gate strength: real, but small.** The physics differs at that exact point, but the destination is not new. In play this reads as fewer skate-offs on Cascade Isle's and the rocky islets' hill flanks. **Superseded by Q30:** the G5 route test uses the authored [Cascade south perch](#steep-landing-site-cascade-south-perch). This point stays as a regression check.

## 3. Snap-roll through gaps

**Parameter.** The roll rate the stick commands is `BreedStats.maxRollRate` (`src/flight/FlightModel.ts:1093`), and the muscle to reach it is `BreedStats.rollAuthority` (`:1122`). The snap-roll is an input combo (proposal: a double-tap of roll within 0.25 s) that multiplies both for a 0.6 s burst. The combo itself lives in `src/input` (outside this document's three directories); control mappings stay unchanged.

| Breed | maxRollRate (rad/s) | rollAuthority | Time to 90° bank, measured: before → after (× 1.6) |
|---|---|---|---|
| Harrier | 1.8 (`breeds.ts:87`) | 5.6 (`:83`) | 1.08 → 0.74 s |
| Skimmer | 2.6 (`:115`) | 8.5 (`:111`) | 0.81 → 0.58 s |
| Galewing | 1.05 (`:143`) | 1.9 (`:139`) | 1.93 → 1.32 s |
| Ironback | 1.2 (`:171`) | 2.3 (`:167`) | 1.61 → 1.08 s |

Method: `measureRoll` (`src/flight/telemetry.ts:134`) on the breed with both numbers scaled.

**Clamps.**
- **Multiplier ≤ 1.6.** Measured at × 2: the skimmer's roll-out goes from 0.15 s to 2.7 s, so the roll runs on past the stick.
- **Authority:** `FLIGHT_TUNING.authorityMax` 1.5 (`FlightModel.ts:156`) and the dynamic-pressure scaling stay as they are, so the burst is still mushy near the stall.
- **Collision response:** stays capped at ±3 rad/s (`FlightModel.ts:1201`).
- **Ratings:** the base stats keep the agility ranking (`breeds.test.ts:23`), since the burst applies equally to all breeds.

**Route: Archway Reach, arch 1 → arch 2 reversal** (`src/world/layout.ts`, the three standing arches built from the `reach` islets, threaded in order by the Archway Thread course).

Contract: from wings level through arch 1, reach 90° of opposite bank within 0.8 s.
- Harrier (1.08 → 0.74 s) and skimmer (0.81 → 0.58 s): fail before, succeed after.
- Galewing and ironback: fail both before and after, so their contract needs its own threshold (1.4 s and 1.2 s would do).

**Gate strength: weak, and not the capability Q4 names.** "Through a tight gap" has no gap to go through. Measured: only the Archway Reach arches (and the Observatory with scatter island 49) have bounding shapes within 30 m of other rock. The narrow readings there are wedges where arch feet meet islet undersides, not passages a flight line can use. The real openings, the arches' insides at 219 to 236 m, are far wider than any wingspan (13 to 20.5 m). Wingtips collide only while spread (`FlightModel.ts:1180-1203`), so a gap narrower than the wings is a knife-edge problem, and the layout has none. Rootfall's hanging roots look like gaps, but they don't collide: `planRoots` strands (`src/world/dressing/roots/rootPlan.ts`) feed rendering and the course clearance test, and Game registers no collider source for them.

**Superseded by Q30:** the G5 route test uses the authored [Archway Keyhole](#snap-roll-site-the-archway-keyhole).

## 4. Windline from the saddle

**Parameter.** Today the Windline casts only on foot, falling or traversing:
- Game enables traversal input only in those modes (`src/game/Game.ts:286`).
- In flight the hold action is `leap` (`src/player/Player.ts:145-148`): hold call for `LANCE.callHold` 0.4 s (`src/traversal/tuning.ts:4`) to jump from the saddle (`Player.ts:699-716`), then cast in freefall.
- After release over open air, holding call again for 0.4 s starts the catch (`Player.ts:691`, `startFall` `:1160`), and the wyvern takes `catchDelay` 0.8 s (`src/player/tuning.ts:115`) to reach the rider.

Unlocked: a lance press in flight casts from the harness (`LANCE.harnessHeight`) with the existing throw. On attach, the rider leaves the saddle onto the line (the existing jump, keeping the wyvern's velocity). On release, the catch starts at once, with no recall hold.

| | Current | Unlocked |
|---|---|---|
| Press to line, from flight | 0.4 s hold + jump + cast (`castTime` 0.22 s) | cast (`castTime` 0.22 s) |
| Release to caught | 0.4 s hold + `catchDelay` 0.8 s | `catchDelay` 0.8 s |

**Clamps.**
- **Line length:** `LANCE.maxLength` 65 m and `chargedLength` 95 m (`tuning.ts:3-4`).
- **Speed:** casting from the saddle is allowed only below `LANCE.boostMaxSpeed` 36 m/s (`tuning.ts:8`), so a tether never starts faster than the traversal model already handles.
- **Catch:** `catchDelay` and `catchGrace` (`src/player/tuning.ts:115-116`) unchanged.
- **Cloud floor:** the respawn floor stays the backstop (`Player.ts:693`).
- **Q15:** whether Windline is core or unlocked is still open. This capability fits either answer, because on-foot casting is untouched and only the saddle cast is the unlock.

**Route: through the Eye of the Gale** (`src/world/layout.ts`, arch `eye` at (1350, 560, 650), a full ring of radius 95 m, tube 17 m, in open sky). Measured: the nearest island bound is 461 m from the ring's outer edge, so no on-foot Windline reaches it.

Contract: from mounted flight, anchor on the ring's upper tube, swing through, and be back in the saddle within 2 s of release.
- **Before:** about 0.4 s hold plus 0.8 s catch delay plus the swoop. The swing itself also starts about 0.6 s later, so it needs more height. Fails.
- **After:** the 0.8 s catch delay plus the swoop. Succeeds.

These times are estimated from the tuning constants. The swoop's duration needs a run of the real catch in G5.

**Gate strength: the strongest of the four.** The Eye can be swung through only from the air, and the capability turns a two-hold, separate-cast manoeuvre into one press with an automatic catch. It's still a timed gate: a skilled rider can do it today with the holds.

---

## Capability sites for G8

Decided in [Q30](DECISION_LOG.md). These are requirements, not geometry: G8 places and sizes each site, measures it with the real flight and terrain code, and adds it to `src/world/layout.ts`. Both sites need shape support the analytic shapes don't have yet (see each site). Per ARCHITECTURE's one-world-model rule, collision, landing, walking and meshing must read the same new function. Neither site may carry required content (`docs/ROADMAP.md:113`), and neither may move a race line: `src/race/courses.test.ts` stays green unchanged.

### Steep-landing site: Cascade south perch

- **Where:** Cascade Isle's south flank, near the current route point (800, 457, −692).
- **Surface:** a landing shelf sloping 50° to 53° (normal y 0.602 to 0.643). It must be at least as large as the biggest breed's standing footprint plus a margin; G8 sizes it from the walker's foot positions (`src/player/ground.ts`, `GAIT`).
- **Isolation:** no ground at normal y ≥ 0.65 within 12 m at a similar height (±6 m). The shelf can't be reached by landing beside it and walking over: the walk limit stays 40° (`src/player/tuning.ts:32`).
- **Ceiling:** ≤ 53°, so 53° to 56° stays the Craghorn's (`docs/ROADMAP.md:80`).
- **Content:** one optional collectible on the shelf, so the place is worth reaching.
- **Shape support:** no current shape makes a tilted shelf; island tops are hills on a flat center, and spire tops are flat. G8 adds one, for example a `topTilt` on `SpireDef` for a leaning crag, or a crag term in Cascade Isle's relief.
- **Rider check:** the rider can't stand on 50°: on-foot ground needs normal y ≥ 0.766 (`Player.ts:683`). The dismount looks for such ground beside the wyvern, but if it finds none it sets the rider down there anyway (`Player.ts:1003-1009`). G5 must either block dismounting on the shelf or show that a dismount there ends in the existing catch, never stuck.
- **Acceptance:** before the unlock, a flared landing on the shelf skates off (`Player.ts:855`); after it, the landing holds. Gameplay-camera capture of all four breeds standing on it, with no foot sliding and the rider seated.

### Snap-roll site: the Archway Keyhole

A narrow vertical slot on its own doesn't need a snap-roll, because a pilot can roll to knife-edge well before it. The Keyhole pairs two openings a short distance apart:

1. **The letterbox:** wider than the largest wingspan plus margin (> 24 m) and lower than the smallest wingspan (< 12 m tall), so the wyvern must cross it wings-level.
2. **The slot:** at most 9 m wide and at least 26 m tall, D metres beyond the letterbox.

How the dimensions work:
- **Bank needed in a 9 m slot.** The wingtip probes sit at 0.92 × half-span (`FLIGHT_TUNING.tipSpanFactor`, `FlightModel.ts:310`), radius 0.55 m, and must fit inside ±4.5 m. That needs a bank of at least 49° (skimmer), 56° (harrier), 58° (ironback) or 65° (galewing). The body (radius `standHeight` × 0.55, 1.4 to 1.6 m) leaves about ±2.9 m of lateral error.
- **The spacing D sets the window.** D = approach speed × the time allowed to reach that bank. Set D between each gated breed's measured time-to-bank with and without the × 1.6 burst, at race pace, so the slot is closed before the unlock and open after. Which breeds are gated is [Q32](DECISION_LOG.md), still open. The times to 90° in §3 are an upper bound; G8 measures time to the needed bank.
- **Height loss.** Banked past about 60° the wyvern sinks; G8 sizes the slot's height and the line's entry height so the measured sink fits with margin.
- **Where:** off the Archway Thread line, between arch 1 and arch 2 of the Archway Reach.
- **Shape support:** the letterbox can be an existing `ArchDef` segment (a shallow arc of a large ring: wide and low). The slot needs either two spires set close (the gap is narrowest at their bellies) or a new rock-fin shape.
- **Acceptance:** a scripted flight at race pace through the letterbox, then the slot. Before the unlock, a wingtip hits the slot (or the line has to miss it). After it, there is a clean pass, for every breed Q32 gates.

## Decision record

Robert's answer is [Q30](DECISION_LOG.md) (2026-10-17): option 2 for the steep landing and the snap-roll, option 1 for the thermal climb and the Windline. The options as written before that answer:

1. **Accept timed and precision gates for G5.** The four contracts above become the route tests, each failing before and succeeding after under its stated rules. The capabilities read as "the dragon makes this quicker or surer", which fits pillar 2 better than pillar 1.
2. **Or have G8 author one capability site each** in `src/world/layout.ts`, each a few lines of data, so every route is closed by physics before the unlock:
   - **Thermal climb:** a weak thermal (core about 2.2 m/s) under an optional perch. Before, the harrier can't climb in it (sink 2.35). After, × 1.25 gives 2.75, so it climbs. Thresholds are per breed: the galewing (sink 1.56) climbs either way and the ironback (2.87) climbs in neither.
   - **Steep landing:** a crag perch sloping 50° to 53° with no flatter ground within a wing's length, holding optional content (ROADMAP's 49.5° rule).
   - **Snap-roll:** a split arch at the Archway Reach whose slot is narrower than the smallest wingspan (13 m) and taller than the largest (20.5 m), so only a knife-edge passes.
   - **Windline from the saddle:** none needed; the Eye already works.

Recommendation: option 2 for the steep landing and the snap-roll (both cheap layout data, and both turn a weak gate into a real one), and option 1 for the thermal climb and the Windline. A faster climb and a one-press swing are honest as "quicker", and a gating weak thermal that some breeds pass without the unlock would muddle the per-breed records.

Status of the items that were open before G5:
- **G4:** merged ([rporter33/HAVENS-OF-THE-DRIFT#6](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/6)). Bond memory is persisted in `driftwing.bond.v1` ([Q31](DECISION_LOG.md)).
- **Snap-roll breeds:** which breeds the Keyhole gates is open ([Q32](DECISION_LOG.md)).
- **Snap-roll keyboard input:** the double-tap on keyboard is open ([Q33](DECISION_LOG.md)).
