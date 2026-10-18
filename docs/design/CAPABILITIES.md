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

Decided in [Q30](DECISION_LOG.md) and built in gate G8a ([Q34](DECISION_LOG.md); evidence in [the G8a QA record](../qa/G8A_CAPABILITY_SITES.md)). Both sites are `RockFormDef` entries in `src/world/layout.ts` (`rocks`), made by one new solid, `RockFormShape` (`src/world/rockForm.ts`): a signed distance field that collision, ground, distance, raycasts and the mesh all read. Neither carries required content (`docs/ROADMAP.md:113`), neither moves a race line (`src/race/courses.test.ts` unchanged, and both are more than 40 m from every line), and both sit more than 30 m from other rock. The optional collectible on each goes in with G5: a collectible only the unlock can reach would leave the collection unfinishable until G5 ships.

### Steep-landing site: Cascade south perch

As built: a leaning crag 380 m south of Cascade Isle's axis, top center (820, 478, −900). Its whole top is one plane sloping **51.5°** (normal y 0.622), falling south.

- **Between the limits:** 0.622 is below today's land limit (0.65) and above the unlock's (cos 53° = 0.602). At ≤ 53°, 53°–56° stays the Craghorn's (`docs/ROADMAP.md:80`).
- **Only the plane is ground.** It's reported with its exact normal, inside its rounded rim. The flanks and rim are collision only, like the arches. Any smooth crest has a line where the surface turns flat, so that would have been a way on today.
- **Isolation:** no other ground within 12 m at a similar height. The perch floats free, and the walk limit stays 40°.
- **Reads as a landing slab (G8b, [Q45](DECISION_LOG.md)):** the plane is painted as a bright ivory slab with a scrub-fringed rim and a shaded lip under its edge, and a flared approach that meets ground too steep for the breed gets a "Too steep to land" toast naming the slope and the breed's limit. Paint and presentation only: the geometry, the collision and the landing rule are unchanged.
- **Measured:** no breed lands on it today (0 of 405 scripted approaches each). With the unlock, the harrier lands on 196 of 405, the skimmer 170, the galewing 197 and the ironback 204, and every landing stays standing. In the running game, 0 of 12 approaches land today and 8–9 of 12 land with the preview.
- **Rider check (for G5):** dismounting on the perch sets the rider down on 51.5°, where they can't stand. They slide off the downhill rim into Windline freefall, and normal play never summons the wyvern automatically, so they must hold recall or fall to the cloud sea. Decided 2026-10-18 ([Q43](DECISION_LOG.md)): keep it. Dismounting on the perch is acceptable and is not blocked.

### Snap-roll site: the Archway Keyhole

As built: an islet off the Archway Reach, chamber center (−850, 330, −1280), its passage along the chain's line (`yaw` = atan2(−800, −320)). Two **opposed 70° cracks**, 8 m wide and 36 m long, one through each 8 m wall, open into a **14 m** chamber (9.5 m in G8a; lengthened in G8b, [Q43](DECISION_LOG.md)).

- **Why a reversal, not the letterbox and slot written above:**
  - In open sky a gap gates nothing unless what's behind it is enclosed, so the passage is the only way into the chamber, where G5's collectible will sit.
  - A low "letterbox" still lets a pilot pre-roll about 20°.
  - Opposed cracks demand a reversal of at least 2 × (70° − the crack's bank tolerance) in and around the chamber. The ×1.6 burst shortens that reversal by the same 1.6× at any speed. The G8a chamber (9.5 m) left the base harrier no way through; after the playtest ([Q43](DECISION_LOG.md)) it is 14 m, so a well-aimed harrier at its normal roll can sometimes thread it, by starting the reversal early, and the snap-roll makes it reliable. 14 m is the longest chamber that still keeps the ironback out ([Q32](DECISION_LOG.md)).
- **Measured (harrier, real `FlightModel` and terrain, scripted pilot search):**
  - At normal roll, 195 of 37,260 approach settings thread it (0.5%; 0 at the 9.5 m chamber).
  - With the ×1.6 snap-roll, 1,996 of 53,820 do (3.7%; 180 at 9.5 m), at 14–20 m/s.
  - The skimmer threads it without the unlock (272 of 5,184 settings); the galewing and ironback can't even with it ([Q32](DECISION_LOG.md)).
- **Known bypass ([Q35](DECISION_LOG.md), accepted 2026-10-18):** folded wings thread it. Wingtips collide only while spread (`FlightModel.ts:1181`), so a tucked wyvern collides as its body alone. 1,109 of 14,040 tucked entries pass, across all breeds and speeds. No crack geometry can stop this: a folded wyvern is always more compact than a spread one, and the fall across this passage is a few metres. Robert accepted the tuck as the other way through, so the Keyhole is a skill site for everyone, and the snap-roll no longer gates the chamber's collectible. G5 decides what the unlock earns here.

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
- **Snap-roll keyboard input:** the double-tap is good on a gamepad and hard on a keyboard ([Q33](DECISION_LOG.md)), so the keyboard input is open ([Q41](DECISION_LOG.md)).
- **Playtest direction (2026-10-18, [Q43](DECISION_LOG.md)):** a charged launch off the steep slope that improves with bonding, a more forgiving Keyhole chamber, and a possible wind stream for agility. None is built or specified here yet; G5 stays closed.
