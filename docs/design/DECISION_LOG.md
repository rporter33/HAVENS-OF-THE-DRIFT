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

### Q36 · How closely the game follows the target renders, and dragonflight color — answered 2026-10-18
Robert, on the renders in [`docs/art/targets/`](../art/targets/MANIFEST.md): the game's rendering should closely match them, including the look of the dragons and wyverns. Each dragonflight is restricted to its own color but blends into the neighboring hues on the color wheel: the blue flight toward purple, the red flight across orange and yellow. The Codex airship should end up more detailed than its render; that work comes later. This is direction for G3 and G8, not an implementation gate.
Follow-up answered the same night: green blends toward teal and yellow-green; black, being off the wheel, takes a tint toward deep violet or ember; white toward ivory and powder blue, as the elder dragon render (08) shows.

## Added 2026-10-19 (the white dragon)

Numbering continues at Q47; Q37 to Q46 were recorded on parallel branches (PR #12, `claude/loving-gates-7sydp9`, `claude/pensive-pasteur-hgbhg0`).

### Q47 · Open the white dragon gate (G12), and on what terms? — answered 2026-10-19
Robert, 2026-10-19: "Begin work on the white dragon." That is read as the white clan's elder dragon in [render 08](../art/targets/08-sleek-dragon-elder.png): four legs plus two wings, ivory toward powder blue (Q36). Nothing four-legged exists in source; the wyvern rig, animator and flight model are two-legged throughout. The [white dragon design](WHITE_DRAGON.md) sets out the route and proposes gate G12 in three steps: G12a the six-limb skeleton and the fitted body (dev-only), G12b a dev-only resting showcase judged against render 08, G12c the dragon on its tower in the world. The [model kit](../../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) holds Robert's Astra and Meshy steps, which need no gate. Each part below is a separate answer:
- **a. Open G12a now,** ahead of the fidelity plan's order (which leaves the elder dragon for after the Harrier, rider, mounts and islands)? *Recommendation: yes for G12a, which touches no shipped creature; G12b after PR #11 lands, since it reuses #11's trial loading pattern.*
- **b. Its role:** an elder you meet, resting on its tower (R1); also flying over the haven (R2); or a mount you ride (R3, which Q1 promises once the rig exists). *Recommendation: build R1, with the skeleton made to R3's standard (full leg chains, a saddle socket between the wing roots) so a mount never needs a second rig. R2 and R3 each need their own gate.*
- **c. Body route:** a Meshy body fitted in Blender to a skeleton the game owns, as the Harrier trial did (Q38); or a procedural body grown from the wyvern builder. *Recommendation: Meshy. For the Harrier, the code pass closed the color gap but not the form gap (Q38), and render 08's form is further from anything in code.*
- **d. Where its tower stands:** at Windhaven, as the player culture's own elder (Q23); on an island of its own; or not placed until the world pass. *Recommendation: Windhaven, built with the Aegean kit (fidelity plan 4.1), since a tower-top platform big enough for it changes the haven's silhouette.*
- **e. Its elder:** the figure in the white mantle at its shoulder in G12c as a still figure, or later with the speaking characters (G9). *Recommendation: later; G12c shows the dragon and the banner.*
- **f. Its name,** and whether the dragon has a voice of its own.

**Answered 2026-10-19.** Robert: "47 and it does go are unshaven. Go ahead with accuracy." Read as dictated speech for "47 as recommended, and it does go at Windhaven"; say if that reading is wrong. So:
- **a.** G12 is open. Its steps go in order, G12a then G12b then G12c, each its own PR. G12c reaches the normal build only after Robert accepts G12b's captures.
- **b.** R1, an elder you meet, with the skeleton built to the mount standard.
- **c.** A Meshy body fitted in Blender to a skeleton the game owns.
- **d.** The tower stands at Windhaven.
- **e.** The elder figure waits; G12c shows the dragon and the banner.
- **f.** Still open, as Q47f.

"With accuracy" is applied as: numbers come from a named source (render 08 now, the approved reference sheet when it exists), provisional ones are marked as such, and every claim about the build is backed by a test or a capture.

### Q47f · The white elder dragon's name, and whether it speaks — open

### Q48 · Dragon customization, and colour within a flight — answered 2026-10-19
Robert, on the white dragon plan: "each of these colors and dragons need customization with parks. Their colors are a small hue change for variation within flight." Read as *parts*: every flight's dragons are customized with interchangeable parts, and dragons of the same flight differ from one another by a small hue change. Say if "parks" meant something else.

Read with Q36. Q36 sets the hues a flight's dragon carries, which can be more than one on the same animal: render 08's white dragon is ivory with powder-blue plates. This answer sets how far individuals of one flight differ: a small hue change, not a free colour. Black has two tints under Q36 (deep violet or ember), so its small change applies within the chosen tint.

What follows in the [white dragon design](WHITE_DRAGON.md#customization-parts-and-flight-colour): a dragon's look is its flight, a bounded hue shift and one part per slot; its colours are derived, not picked. This is direction for G12 and opens no gate. Wyvern colours, free today (`core/types.ts:481`), are not changed by it.

Follow-ups, with recommendations:
- **48a. Parts across flights:** every part fits every flight's dragon, or each flight has its own parts. *Recommendation: every part fits every flight; colour carries the flight.*
- **48b. Size of the hue change:** *proposed ±8° of hue around the flight's palette, the whole palette turning together, lightness and saturation held; tuned in G12b's lineup.*
- **48c. Who customizes:** authored looks for the elders' dragons now; the player customizes a dragon once dragons are mounts (R3, Q47b). *Recommendation: build the look data once, so the elders and a later stable use the same thing.*

**Follow-ups answered 2026-10-19.** Robert: "Parts - across flights, hue shift is good, we customize the elders they're characters." The "parts" reading is confirmed. 48a: every part fits every flight's dragon. 48b: ±8°, as proposed. 48c: the elders' dragons are characters whose looks we author; this answer gives the player no dragon customization.

**From G12b's lineup, 2026-10-19.** Of the five white dragons at −8°, −4°, 0°, +4° and +8°, Robert said: "for the hue shift, left to right, kind of like either +4 or 0." Recorded as his preference: the white elder stays at 0°, and +4° is the other shift he likes. The ±8° bound (48b) stands unless he narrows it; narrowing the white flight to 0° to +4° is the obvious option.

### Q49 · Meshy plan: who owns the generated models? — answered 2026-10-19
Robert: "mark it down that i have meshy pro plan so we own these models for blender and game use."

Recorded:
- Robert's Meshy account is on the **Pro plan**, which is paid.
- Under Meshy's terms as the [Meshy guide](../../Art%20and%20Assets/Guides/meshy/README.md#provenance-record-for-the-next-authorized-asset-task) summarizes them (checked 2026-10-14), paid-plan output belongs to the subscriber to the extent the law allows. So models Robert generates on this plan are his to edit in Blender and to ship in the game.
- This covers the Harrier trial's body, made on his paid plan (Q38), and the white dragon's (G12).

What still applies:
- **Ownership follows the plan in force when a model is generated.** Each asset's provenance still records the plan tier and the date.
- **Training use.** Pro isn't Enterprise. Meshy's terms allow it to use non-Enterprise inputs and outputs for training unless otherwise agreed. That doesn't change who owns the output.
- **Community.** Nothing goes to Meshy's Community, where published output becomes CC0.

This is Robert's statement plus the guide's summary of the terms, not a legal review of any one asset.

### Q50 · The white dragon's size, wing and membrane root — answered 2026-10-19
Measuring Robert's approved sheet and Meshy body for G12a, 2026-10-19 ([the white dragon](WHITE_DRAGON.md#the-approved-sheet-and-the-meshy-body)), turned up three things the sheet can't settle by itself. Each is built as recommended until Robert answers; changing one is a change to `proportions.ts` and a re-run of the fit.
- **a. Size.** The sheet has no scale. *Built: render 08's five body readings (head, neck, torso, tail, back height), their geometric mean. The dragon is 20.3 m from nose to tail tip along the skeleton (the provisional rig from render 08: 20.6 m), its body center 3.4 m off the ground, its wings 21.8 m spread flat at the fingers' ends.* Other choices: the head alone (about the same), or render 08's leg readings too, which would make it about 7% smaller. Those were taken lying down.
- **b. The wing.** Side view C's raised wing is too large for the other views: its leading finger alone would spread the wings to about 25 m, where the front view shows about 16.5 m. *Built: the Meshy body's wing bones, which span 20.7 m as modelled and 21.8 m spread flat; the wing's root stays where C puts it.* Other choice: C's wing, about 25 m.
- **c. The membrane's root.** C ties the membrane's trailing edge to the top of the rump, about 0.5 m behind the hip. That's clear of the leg, but it isn't the kit's "flank just in front of the hind legs". *Built: as the design and the Meshy body have it, 0.65 m ahead of the hip.*
- **d. Noted, not asked.** The approved sheet's tail is 2.1 times nose to hips and its neck 0.65 times shoulder to hips, where the kit asked for about 1.33 and 0.75. The skeleton follows the approved sheet.

**Answered 2026-10-19.** Robert, after the recommendations were set out to him: "im okay with reccomendations, continue". So all three stand as built, and nothing is rebuilt:
- **a.** The size comes from render 08's five body readings: 20.3 m from nose to tail tip along the skeleton, the body center 3.4 m off the ground.
- **b.** The wing comes from the Meshy body, 21.8 m spread flat, rooted where side view C roots it.
- **c.** The membrane meets the flank 0.65 m ahead of the hip.
- **d.** Unchanged: the skeleton follows the approved sheet's tail and neck.
