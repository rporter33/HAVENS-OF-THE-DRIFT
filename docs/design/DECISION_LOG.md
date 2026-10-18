# Havens of the Drift — decision log

Canonical copy as of 2026-10-17 (moved here from `havens-workspace`). Full reasoning and recommendations: [catch-up and questions](CATCH_UP_2026-10-15.md).

One entry per question. Add a dated answer under the question; never delete an earlier answer, mark it superseded. The full reasoning and recommendations are in the "Catch-up and questions" tab.

Status key: **open**, **answered**, **superseded**.

## Identity

### Q1 · Mount: wyvern or dragon? — answered 2026-10-17
Both. Wyvern stays the proven player mount; four-legged dragons join the roster when the new rig exists. (Recommendation was: wyvern for the slice, both as the roster plan.)

### Q2 · Same game as Driftwing, or a new game on the same engine? — answered 2026-10-17
Same game, same saves, new looks: upgrade textures and materials to match the most recent renders. Visual direction change, not a restart. Scope for the texture pass is a separate gate.

### Q3 · What does "Havens" mean in-fiction? — answered 2026-10-15
Havens are the island monasteries, temples and cities. The Drift is the wind; it is also what the cataclysm left behind: things of old drifting slowly into the ground, islands, buildings and landscapes drifting apart over time and sometimes suddenly in a cataclysmic event. People drift away and migrate.

## Flight and progression

### Q4 · Which three to five capability unlocks? — answered 2026-10-17
Four: stronger thermal climb, steep-slope landing, snap-roll through a tight gap, Windline from the saddle. Each ties to one bond milestone and one route it changes.
### Q5 · Capabilities from bond, research, or both? — answered 2026-10-17
Both, split: bond gives dragon capabilities; research gives ship and world reach; cosmetics come from everything.
### Q6 · Keep stamina, or move to charges? — answered 2026-10-17
Keep stamina as is; it is tuned and tested. Additional charges may be layered on later as a separate design item.

## Racing

### Q7 · Per-breed record categories, or one normalized race breed? — answered 2026-10-17
Per-breed record categories, with capability tier shown on the record.
### Q8 · Which course variants first? — answered 2026-10-17
Reverse plus one Challenge variant, on two existing courses.
### Q9 · AI rivals in the first release? — answered 2026-10-17
Yes. Rivals should be physical enough to collide with.

## Bonding and story

### Q10 · Smallest bond expression to build first? — answered 2026-10-17
Greeting at the Roost plus an anticipatory lean before a known maneuver. No meters. Build up from there.
### Q11 · Does the Ventari mystery resolve in release one? — answered 2026-10-17
No. It stays open past release one.
### Q12 · Quintus and Vellum in or out of release one? — answered 2026-10-17
Quintus in. Vellum undecided (still open as Q12b).

### Q12b · Vellum in release one? — open
### Q13 · Five clans and ten elders: game canon or comic-only for now? — answered 2026-10-17
Game canon, presented in the comic first. Comic rendering and much of its art will be produced with ChatGPT image generation.

## Scope

### Q14 · Combat: none, a pursuer, or secondary combat? — answered 2026-10-17
Secondary combat. Never the primary loop.
### Q15 · Windline: core, optional, or unlocked? — answered 2026-10-17
Keep Windline. Whether it is core or unlocked is still open; it is not being cut.
### Q16 · Multiplayer order? — answered 2026-10-17
Prove the solo loop first, then an early networking feasibility test with zero co-op content.
### Q17 · Aerial ball sport: still committed, or paused? — answered 2026-10-17
Still committed.

## Production

### Q18 · Which repository seeds Havens? — answered 2026-10-15
Driftwing main `9d30223` merged with Dragon-Circuit main `375b59d`, pushed as `rporter33/HAVENS-OF-THE-DRIFT` main `18a7aab`. Titles renamed only; runtime names, save ids, package name and paths unchanged. Local clone: `C:\Users\Robert\Projects\HAVENS OF THE DRIFT`.
### Q19 · Keep the Drift and focus one cluster, or author a new compact cluster? — answered 2026-10-17
Keep the Drift. Focus one cluster first per the recommendation (Roost quadrant re-dressed first).
### Q20 · Meshy dragon body in release one, or ship the procedural wyvern? — answered 2026-10-17
Goal is the best-looking wyvern achievable. Meshy is available and acceptable if it gets there; whichever route is chosen, Claude must be able to edit the Blender source to fit game mechanics (rig, saddle, collision, animation events).

## Inherited from the Codex handoffs

### Q21 · The Craghorn's name; free from day one or earned? — answered 2026-10-17
Earned. Name still open (Q21b).

### Q21b · The Craghorn's in-world name — open
### Q22 · Windhaven and the Codex: one ship or two? — answered 2026-10-17
Resolved by reassignment: Windhaven becomes the starting zone (it takes over the place currently called Windward Roost); the Codex is the ship. The current Windhaven airship art study becomes Codex reference.
### Q23 · Air Nomads: the player culture, one clan, or a starting outfit family? — answered 2026-10-17
The player culture, associated with the white dragonflight color.

## Added 2026-10-17 (from the platform and QA pass)

### Q24 · Visual target for the texture and material upgrade — answered 2026-10-17
The recent Codex renders of the Harrier, Windward Roost and Windhaven improvements. Direction: smooth 3D surfaces, vibrant colors, an improvement on the current painterly look rather than a replacement of it. The render files are not yet in any repository; they go to `docs/art/targets/` when supplied and become the acceptance reference for Q25.

### Q25 · Scope of the first visual gate — answered 2026-10-17
The whole Drift eventually; characters first (wyvern, rider), terrain and dressing second.

### Q26 · Title screen text — answered 2026-10-17
Change the displayed title to Havens of the Drift with real artistic effort on the wordmark. Runtime identifiers, package name and save ids stay `driftwing`.

### Q27 · Orphan review scripts — answered 2026-10-17
Approved: move the 19 unreferenced review scripts to the archive.

### Q28 · Blender masters and the GLB test fixture — answered 2026-10-17
Robert delegated the call. Decision taken: move the editable masters (`assets/rider-blender/source/`, 34 MB) to `havens-archive` with register entries and a restore check; keep the 18 MB GLB on main until an accepted export replaces it, because two tests inline it as a fixture.

### Q29 · Git history rewrite — answered 2026-10-17
Robert delegated the call. Decision taken: no rewrite. Shallow clones are already 99 MB, a force-push would invalidate every existing clone and PR, and the archive branch mirrors the blobs anyway.

## Added 2026-10-17 (from the G4 and G5 work)

### Q30 · G5 capability gates: timed contracts, or authored sites? — answered 2026-10-17
The [capability spec](CAPABILITIES.md) found that none of the four capabilities opens a place that is closed in today's layout. Robert took the recommendation:
- **Steep-slope landing and snap-roll:** G8 authors one capability site each in `src/world/layout.ts`, closed by physics until the unlock.
- **Stronger thermal climb and Windline from the saddle:** keep the timed route contracts (Highmoor climb-out, through the Eye of the Gale).

The site requirements are in the spec. Neither G5 nor G8 is opened by this answer.

### Q31 · Bond memory: persisted or session-only? — answered 2026-10-17
Persisted, in its own `driftwing.bond.v1` localStorage document beside the save; `driftwing.save.v1` is unchanged. This is recorded from Robert merging [rporter33/HAVENS-OF-THE-DRIFT#6](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/6) as built, not from an explicit answer: revise here if session-only, or folding it into a later save version, was meant.

### Q32 · Snap-roll site: which breeds thread it? — answered 2026-10-17
Robert: the harrier site. The Keyhole is sized so the harrier can't thread it before the snap-roll and can after; the galewing and ironback stay out. Measured once built: the skimmer threads it without the unlock (its normal roll is about the harrier's boosted one), so for the skimmer the Keyhole is a skill site, not a gate. The question as it was posed:

One site can't gate every breed the same way. Measured time to 90° of bank: harrier 1.08 → 0.74 s, skimmer 0.81 → 0.58, galewing 1.93 → 1.32, ironback 1.61 → 1.08 (× 1.6 burst). A site tuned for the harrier gates the harrier and skimmer, and stays closed to the galewing and ironback even after the unlock, much as the Craghorn owns the rock. Options:
- **Harrier site:** accept that the galewing and ironback can't thread it.
- **Two spacings:** a second, longer site for the heavy breeds.
- **Per-breed burst:** a larger multiplier for the heavy breeds. Their roll-outs stay stable at × 2, unlike the skimmer's.

*Recommendation: the harrier site, so the gap stays a light-breed line.*

### Q33 · Snap-roll input on keyboard — open
The proposed combo is a double-tap of roll within 0.25 s. Keyboard roll is all-or-nothing, so a double-tap reads cleanly there; the question is whether it collides with tapping to trim the bank in normal flight. Decide before G5's input work.

### Q34 · Open the capability-sites gate? — answered 2026-10-17
Yes. Robert opened the sites gate (G8a): build the Cascade south perch and the Archway Keyhole ahead of G5, then playtest how they feel. Same day, as the target renders start arriving: the new terrain solids' geometry and visual effort must match the fidelity those renders set (smooth, continuous surfaces; the painterly identity kept). Until the renders are in `docs/art/targets/`, the [render brief](../art/targets/RENDER_BRIEF.md) and the art pack are the bar.

### Q35 · The Keyhole's tuck bypass: change the flight model, or accept it? — open
Built and measured in G8a: with wings folded, a wyvern collides as its body alone (wingtips only collide while spread, `FlightModel.ts:1181`), so it can drop through the Keyhole's cracks without any roll; 1,082 of 14,040 tucked entries pass, every breed. No crack geometry prevents it. Options:
- **Accept it:** folding through is the honest physical answer, and the snap-roll becomes the way through that keeps your height and speed. The Keyhole is then a skill site, not a gate.
- **Give folded wings a collision extent:** probes at the folded wings' real reach. This is a flight-model change that affects tucked flight near any rock, so it needs its own gate, and it only blocks the tuck if the cracks are narrower than the folded wyvern.
- **Rethink the fourth capability:** "snap-roll through a gap" may not be a gate in this physics at all.

*Recommendation: decide after the playtest, once the tuck has been tried by hand.*
