# Fidelity plan: the Harrier to gold standard, then rider, mounts and islands

Written 2026-10-19 on `claude/pensive-pasteur-hgbhg0` from main `ae839d9`. Design lane: a plan for the executing agent to carry out gate by gate, with Robert opening each gate. No game code changed in writing it. Everything below is source inspection of main, the remote branches and the open PRs on 2026-10-19; no captures were taken this session, and every "measured" number is quoted from the handoff that measured it.

Robert's ask: bring the game's fidelity (islands, assets, rider, creatures) up to the target renders, with the Harrier as the first gold standard. Robert said Opus 5.5 will enact the plan; model choice stays his call (AGENTS.md).

## 0. How to use this plan

For the agent carrying it out:

1. Start every session with the acknowledgement in `.claude/skills/havens-session-start/SKILL.md`. One gate per branch and PR. Branch names below are proposals.
2. Authority order: Robert's current message; implemented source; the target renders in `docs/art/targets/` (Q24, Q36) and [the render brief](../art/targets/RENDER_BRIEF.md); [ART_DIRECTION.md](../ART_DIRECTION.md); older documents.
3. Never change without a named gate from Robert: flight physics (`src/flight/`), the 120 Hz step, the `driftwing.save.v1` schema (a sanitizer migration such as `lensRev` is allowed), course ids, control mappings, the WebGL 2 renderer, the painterly contract (toon ramp plus the fog hooks).
4. Evidence: captures go to `shots/` (ignored) and to `rporter33/havens-archive` with a SHA-256 manifest; never PNGs over a few hundred KB on main. Visual claims are made per ART_DIRECTION category with gameplay-camera evidence; SwiftShader captures establish look, never performance.
5. Every PR: `npm run typecheck`, `npm test`, `npm run smoke` (15/15), plus the focused suites each phase names. Performance numbers come only from Robert's RX 9070 XT.
6. Stop at the decision points in section 10. Do not stop earlier to ask what this plan already answers.

## 1. Where things stand (verified 2026-10-19)

| What | State | Where |
|---|---|---|
| Target renders | 21 Astra files for 19 of 20 shots, 1672x941; shot 11 (Windhaven plaza) not rendered. Q36: the game should closely match them. | main, `docs/art/targets/` (PR #10 merged 2026-10-19) |
| G3 Harrier colour pass (Q37) | Olive-moss `#586e46`, dark olive mantle `#2d3a28`, amber `#e89a40`; lit hide keeps 70% of its chroma; brown leather tack `#7a5232`, linen pad. | PR #11 (draft), `gate/g3-harrier-visual` `4bb7ff1`. Its base branch has merged, so the PR must be retargeted to main. |
| G3b Meshy Harrier trial (Q38, Q39) | `?wyvernTrial=meshy` loads a Meshy body fitted in Blender to the 60-joint rig (`scripts/blender/harrier_meshy_fit.py`, `src/creatures/wyvern/trial.ts`); 23,825 triangles with the game's head and membranes; new `wyvernHead` cosmetic slot with five head styles; folded wings kept off the hind legs. Robert's direction: 75% Meshy girth, keep the game head, more pronounced. | same PR #11; raw files on `archive/g3b-meshy-trial` |
| G3c look development (Q40) | `render/look.ts` knobs; brighter sun, smaller cooler fill, real fresnel rim, darker ramps; baked AO reaches the wyvern shader; SSAO on High/Ultra; blue-sky golden hour; deeper cloud sea; cloud rampart at the boundary; 58° default lens with `lensRev`; membranes 11% deeper (flight unchanged); `scripts/lookdev/` scores captures against targets 01, 02 and 10 in CIELAB. Measured: tonal range 59% to 74% of the targets', local contrast 48% to 57%, edge detail 40% to 60%. | PR #12 (draft), `gate/g3c-look-dev` `fff09f5`, stacked on #11 |
| Harrier gold-standard plan | A twelve-line checklist (H1 to H12) and a five-step gate G3a, written from main `affe784` before the renders landed and without knowledge of G3, G3b or G3c. Its "Q36" collides with main's answered Q36. Section 2 below absorbs it. | `design/harrier-gold-standard` `19490b6`, no PR |
| G8a capability sites | Merged. `RockFormShape` solids painted through the terrain material. | main (PR #9) |
| G8b site polish, Q41 to Q45 | Perch slab, "Too steep to land", 14 m Keyhole, wingtip ribbons; the playtest answers. Pushed, no PR. | `claude/loving-gates-7sydp9` `a80b4a7` |
| QA pass 2026-10-18 | Open findings: existing saves keep the pre-G3 Harrier colours and the oxblood saddle (needs a `lookRev` migration before #11 merges); the grade keeps a disposed depth texture after High to Medium. | main, [QA pass](../qa/QA_PASS_2026-10-18.md) |
| Rider | Seven outfits, eight mixable slots, shared 1K to 4K atlas, optional `?riderTrial=blender` GLB provider. Default look is the Flight Leathers, not the ivory Wanderer of renders 06 and 07. | `src/creatures/rider/` |
| World | Windhaven is a timber-frame, plaster and shingle stable with three conical rookery towers (`structures/Roost.ts`, `kit.ts`); terrain paint is ochre, terracotta, cream and grey strata; tree species are broadleaf, giant, blossom, conifer, windbent and glowcap. No cypress or olive, no limestone arcades, bell tower or shade sails. | `src/world/` |
| Decision log | Forked: main ends at Q36; #12 adds Q37 to Q40; `claude/loving-gates-7sydp9` adds Q41 to Q45; the design branch reuses Q36. | three branches |

**Gap to the renders, by what the viewer sees first** (from the G3, G3b and G3c captures described in the 2026-10-18 handoffs; not retaken):

1. World detail and density: the game has 40% to 60% of the targets' edge detail; the stable and towers are the wrong architecture; cliffs are not limestone; no cypress, olive or ivy. Renders 10, 12, 13, 14, 20.
2. Harrier form: head now the pronounced game head (Q39); horns, deep chest and the large wings remain short of render 01; hide reads as a fine honeycomb instead of 3 to 5 broad rows; tack is not the brief's low-profile harness.
3. Materials: one matte response for hide, leather and cloth; bronze unreadable; membrane backlight not staged.
4. Rider costume: Flight Leathers against the ivory chiton, blue sash and slate chest panel of renders 06 and 07.
5. Light and sky: largely closed by G3c at golden hour; dawn and dusk keys still pink-magenta.

## 2. The bar: "gold standard", made checkable

Per shot, Robert answers the brief's three questions: same place, creature or costume (identity); the upgrade is in surface, colour and material, not a different design (fidelity); reachable in Three.js without a new engine (reachability). The plan adds a measured scoreboard so "up to speed" is a number that moves gate by gate.

**Scoreboard.** `scripts/lookdev/metrics.mjs` already scores a capture against its target (tonal range, floor, top, local contrast, edge detail, chroma, warm/cool split, sky b*). Phase 0 extends its `PAIRS` from three targets to every rendered shot. Proposed pass thresholds, to be accepted or changed by Robert (decision D2): tonal range at least 85% of the target's; local contrast at least 70%; edge detail at least 70%; sky b* within 10 of the target at golden hour; mean chroma within 15% of the target. The renders are AI images at 1672 px, so the thresholds track the character of the numbers, not the pixels.

**Harrier checklist (HG).** Adapted from H1 to H12 on the design branch, now that the renders and G3 to G3c exist. Judged at the shots the brief names: 01 (standing portrait), 02 (flight with rider), 07 (mounted at rest), plus the real chase camera.

| # | Category | Pass when |
|---|---|---|
| HG-1 | Identity | Robert says the capture and render 01 are the same animal. |
| HG-2 | Surfaces | No visible facets on head, neck, legs or tail at the chase camera or in the Stable; silhouettes read as continuous curves. |
| HG-3 | Hide | 3 to 5 broad scale rows read across the flank at gameplay distance; no honeycomb of small scales; paravertebral scutes and the pale dorsal ridge remain. |
| HG-4 | Colour | At golden hour the hide reads as the G3 olive-moss `#586e46` over `#2d3a28`, sand belly, amber membrane `#e89a40`, gold eyes; no drift to emerald or orange under the sun. (Supersedes the older plan's `#3f7d5a`.) |
| HG-5 | Materials | Visible roughness difference between hide, leather, bronze and membrane; bronze reads as soft metal with patina; no chrome, no glossy armour. |
| HG-6 | Membrane | Backlight transmission visible when the sun is behind the wing, as in render 02; veins and darker trailing edge survive. |
| HG-7 | Tack | Low-profile X-back harness in sand leather and softened bronze, as in 01 and 07; the pad does not dominate the silhouette; rig anchors (`SEAT_Z`, stirrups, ropes, grab) unchanged so the rider fit holds. |
| HG-8 | Form | Render 01's long swept horns, deep chest, long S neck, frill of spines and large wings read in the three-quarter portrait; no added barbs. |
| HG-9 | Mounted | Render 07's fit: rider seated behind the withers, harness clear of the wing root in every flight frame (`d-rider-*`, `c-turn-*` captures). |
| HG-10 | Head | The pronounced game head with glowing eyes (Q39); the `wyvernHead` slot works on whichever body ships. |
| HG-11 | Budget | LOD0 at most 24,000 triangles, LOD1 about 6,000, LOD2 about 1,500 (`parts/res.ts`); 60 fps at Medium on Robert's RX 9070 XT in the chase scene. |
| HG-12 | Contracts | Pose golden regenerated only with a stated reason; flight stats, 120 Hz step, save ids, cosmetic ids untouched; ghost material still translucent and shadowless. |
| HG-13 | Other breeds | Skimmer, Galewing and Ironback lineups show no regression from the shared shader, light and tack changes. |
| HG-14 | Scoreboard | The m01, m02 and g-chase rows meet the D2 thresholds. |

Exit: every line verified, or waived by Robert in writing, recorded in `docs/qa/G3D_HARRIER_GOLD.md` with the capture hashes.

## 3. Phase 0: land the stack and take the baseline (S; first)

Nothing else is honest until the three in-flight branches are on main or explicitly parked, and a "before" exists.

- **0.1 Retarget and finish PR #11.** Its base branch has merged, so retarget it to main and merge main in (no rebase on a shared branch). Carry the QA pass's finding 1: a one-time `lookRev` migration in the save sanitizer that moves saves still exactly on the old Harrier defaults (`#3f7d5a`, `#23453b`, `#d89a5a`, saddle `#7a3a2a`) to the G3 values; and finding 3 (reset `grade.tDepth` and `grade.tAO` when AO turns off). Robert reviews #11 and then #12 in game and merges, or says what to change.
- **0.2 One decision log.** On the first branch that touches it after the merges: keep Q36 as answered on main; Q37 to Q40 from #12; Q41 to Q45 from `claude/loving-gates-7sydp9`; the design branch's open question is folded into Q46 (this plan). Update the counts in `production/DECISIONS.md`, add the G8b row to FIRST_SLICE.md (G3b and G3c rows come with #12), and list this plan in the design index. Archive `design/harrier-gold-standard` once section 2 here is on main.
- **0.3 Open the G8b PR** from `claude/loving-gates-7sydp9` so the work and the Q41 to Q45 answers are not lost. Its re-test (B1 to B8 in the G8a QA doc) is Robert's.
- **0.4 Baseline captures on the merged head.** Run `scripts/dragon-capture.mjs` filtered to the Harrier (`--only harrier`), the lookdev manifest with `scripts/lookdev/metrics.mjs`, and `scripts/g3b-capture.manifest.json` with and without `wyvernTrial=meshy`. Record LOD0/1/2 triangle counts for the procedural Harrier and the trial. Robert runs the GPU timing item (`--gpu`) locally. Archive the frames to `havens-archive` with a SHA-256 manifest; write `docs/qa/FIDELITY_BASELINE_2026-10.md` with a contact sheet and the metrics table. This is the "before" for every later claim.
- **0.5 Scoreboard for every shot.** A new `scripts/lookdev/fidelity.manifest.json` stages one matched game view per rendered target (03 to 07 on the showcase and the real game; 12 to 20 at each landmark's position from `layout.ts`), and `metrics.mjs` gets a `PAIRS` entry per target. Output is one table, `docs/qa/FIDELITY_SCOREBOARD.md`, rewritten at the end of every phase with before and after columns.

Acceptance: #11 and #12 merged or parked with a reason; one decision log and index; baseline archived; the scoreboard runs against all 19 rendered shots and its first row set is committed.

## 4. Phase 1: the Harrier to gold standard (proposed gate G3d; M to L)

Each step is its own PR with its own captures. None changes flight physics. Order is by what render 01 shows first.

- **1.1 Body route (decision D3).** Present Robert one sheet: the procedural LOD0 Harrier and the Meshy trial, same staging, beside renders 01 and 02, with the HG checklist pre-scored for each. Options:
  - **A, promote the trial** to the default Harrier body. Work: LOD1 and LOD2 decimated from the trial body in the fit script, on the same skeleton; AO baked for the trial; self-collision proxies rebuilt from the new surface; shape cosmetics (horns, frill, tail tip, saddle variants) attached as parts instead of baked at defaults; the headstall float and the 0.29 m higher seat fixed; a provenance record and register entry (Meshy paid plan, task id not recorded: say so); the normal build fetches the GLB (about 1.4 MB) and falls back to the procedural body if it fails.
  - **B, procedural.** Raise LOD0 ring counts on head, jaw, neck underside, thighs and tail (`parts/res.ts`); smooth the part seams the captures show; deepen the chest keel and lengthen the horns in `proportions.ts` and `parts/`; the Meshy work stays a study.
  - Recommendation: A if Robert's in-game review of the trial says it is render 01's animal (Q38 chose a new model and Q39 kept the game head on it); B if he does not. Steps 1.2 to 1.6 apply to either.
- **1.2 Hide language** (`materials.ts`, shared by all breeds). Rework the detail ladder so the close-up layer is the brief's broad rows: scale size derived from the body's circumference so 3 to 5 rows span the flank, keels kept but larger, the detail-1 rings becoming the same rows seen farther away; scutes and the pale dorsal ridge kept; `DW_DETAIL` still drops layers for LODs. Tests: `wyvern.hide.test.ts`; HG-13 lineups for the other breeds.
- **1.3 Materials** (`shading/light.ts`, `materials.ts`, `render/look.ts`). A roughness split: hide matte; leather semi-matte with edge burnish along the existing across-strap coordinate (`aExtra.w`); bronze a soft specular lobe with patina, never chrome; membrane translucent. Values exposed as `LOOK` knobs so `?lookdev=` can sweep them in captures.
- **1.4 Membrane.** Add sun-behind-the-wing stagings to the capture manifest; tune transmission, veins and trailing-edge darkening against render 02's backlit sails.
- **1.5 Tack to the brief** (`parts/saddle.ts`). Keep the expert's topology (front yoke, sternum plate, breeching, no belly girth) because it is the fit that keeps the planform whole, restyled to the brief: lower frame, narrower pad, thinner straps, sand leather default, bronze rings and buckles sized to read. Anchors, stirrups, ropes and the seat stay put. Tests: `mountedFit`, `restingHarness`, `windkeelHarness`, `attachment`; captures `d-rider-*`, `c-turn-*`, and the render 07 framing. Decision D4 if Robert wants a literal X-back instead.
- **1.6 Form against render 01.** One item per PR, each judged against HG-8 with Robert: horn length and sweep, frill height, neck carriage, chest depth. `BreedStats.wingspan` and `standHeight` stay honoured, so flight is untouched; the pose golden is regenerated with the reason in the commit.
- **1.7 Performance and LOD.** Robert measures Medium at 1440p in the chase scene; the SwiftShader timing item is the proxy in the cloud. Any body over budget is cut at LOD0 before detail is added anywhere else.
- **1.8 Exit review.** `docs/qa/G3D_HARRIER_GOLD.md`: the HG table with status words, the scoreboard row before and after, capture hashes, Robert's three answers for 01, 02 and 07.

## 5. Phase 2: the rider to the Wanderer (renders 06, 07; M)

- **2.1 Wanderer preset.** Ivory chiton with the asymmetric shoulder drape, blue sash, modest slate-scale chest panel in 3 to 5 broad rows, leather calf wraps, sandals, tapered bracers, the Windline bracer faintly luminous (the existing emissive path). Build from the pieces that exist (the chiton and drape panels, wraps and sandals from the rider-c02 wardrobe) and add only what is missing; it is one more entry in `outfits.ts` under the eight-slot contract, so mixing, dyes and unlocks keep working. Default for new saves; existing saves keep their look (decision D5).
- **2.2 Skin and hair under the G3c light.** A chroma hold like the hide's so skin does not go orange at golden hour; hair as render 06 (dark, moved by the wind field through `hair.ts`).
- **2.3 Mounted fit on the new tack** (render 07): seat, leg line, calf wraps clear of the stirrups, both sides, through takeoff, bank, dive, brake and dismount.
- **2.4 No banner-lance in gameplay.** ART_DIRECTION forbids adding a banner weapon because a reference shows one; the brief itself limits it to standing portraits. A Stable or title pose prop is a separate ask (D5).

Acceptance: `npm run test:rider-qa`, the rider-blender suite and the mixed-wardrobe check green; captures beside 06 (full body, eye level, on the terrace, through the `rider` showcase) and 07; scoreboard rows m06 and m07.

## 6. Phase 3: the other mounts (renders 03, 04, 05; M)

The hide, light, materials, tack and membrane work from Phase 1 lands on all four breeds at once, so each breed is a short PR of captures plus breed-specific fixes, in the brief's order:

| Breed | Breed-specific work | Target |
|---|---|---|
| Skimmer | Teal and navy colours held under the sun; the quick hand-wing read; a rock-perch staging at The Needles | 03 |
| Galewing | Membrane at full span; slate value against the cloud sea (the luminance caps stay) | 04 |
| Ironback | Osteoderm plates in the broad-row language; the 30,000 LOD0 ceiling; the heavy landing capture with dust | 05 |

If D3 chose route A, each breed needs its own Astra turnaround and Meshy base through the Harrier model kit (`Art and Assets/Creatures and Customization/HARRIER_MODEL_KIT.md`, on PR #11 until it merges), and `harrier_meshy_fit.py` is generalised by breed; budget three generations on Robert's plan and record each per the Meshy guide.

**Dragonflight colour (Q36, decision D6).** Each flight is held to its own colour plus the neighbouring hues (green toward teal and yellow-green; blue toward purple; red across orange and yellow; black toward deep violet or ember; white toward ivory and powder blue). This is palette data: a per-flight hue range on the stable's colour swatches in `cosmetics/catalog.ts` and the stable picker, with free colours otherwise unchanged. Robert decides whether the rule constrains the player's picker or only the breed defaults and NPC mounts.

## 7. Phase 4: islands, Windhaven and dressing (G8; renders 10 to 20; L, in sub-gates)

The largest gap and the largest work. Windhaven first (Q19, Q25), then the landmarks in the brief's order. Every sub-gate keeps the one-world-model rule: a changed solid changes collision, landing and the Windline sweep together.

- **4.1 Windhaven Aegean kit** (renders 10, 11; decision D7 because the home island's silhouette changes). Replace the timber stable and the three conical towers with the brief's language: an arcaded limestone rookery with canvas shade over the stalls, a bell tower with a bronze beacon, blue plaster panels, banner poles, shade sails over the plaza, a fountain, planters, cypress, olive and pink-blossom planting. `roostPlan.ts` keeps the protected routes (spawn, the wyvern's spot, the stable door, the walk to the launch deck) and every piece carries its collider; `kit.ts` gains the master swatches (Chalk Linen, Limestone, Sky Blue, Deep Cobalt, Aged Bronze). The courtyard kit on Driftwing branch #9, if Robert accepts it, is the starting point.
- **4.2 Terrain and cliff material** (`mesh/terrainMaterial.ts`, `mesh/strata.ts`; renders 12, 13, 14, 20). Limestone strata (pale, warm bounce light, vertical joints on cliffs) in place of ochre and terracotta; grass to olive and sage (the `grassChroma` knob exists); ivy and hanging vegetation under rims on the moss channel; Rootfall's roots and Cascade's mist and rainbows as dressing passes.
- **4.3 Vegetation species** (`trees/species.ts`, `placement.ts`). Cypress and olive species with LOD ladders like the conifer and broadleaf; blossom tuned to the renders' pink; placement rules per island kind so Windhaven and Gull's Rest read Aegean and Rootfall stays old forest.
- **4.4 Island character and verticality** (Q43). One pass per landmark against its render, in brief order: Cascade Isle (13), Rootfall (14), the Old Observatory (15), the Lantern Spire (16), Eye of the Gale (17), the Archway Reach (20), Glowcap Grove (19), Highmoor (05), The Needles (03). Traversal is preserved: race lines, cloud clearance and the Windline sweep are checked by the existing tests and `scripts/editor-check.mjs`; the autopilot still medals every course.
- **4.5 Sky, haze and the vista** (render 12). G3c did golden hour; remaining: the dawn and dusk keys, layered haze between island tiers, and the vista composition from the `12` camera. Ambient life (birds as scale cues) is roadmap, not this phase.

Acceptance per sub-gate: draw calls at Medium unchanged or justified, measured; `editor-check` green; captures beside the target; scoreboard rows m10 to m20; course and clearance tests unchanged where geometry moved.

## 8. Phase 5: later, not scheduled by this plan

The Codex airship (18; Q36 says more detailed than its render, later), the elder dragon (08; needs the four-legged rig), the Craghorn (09; after the slice), the optional shots 21 to 24, shot 11 still owed by Astra, and the UI-free HUD reference. Listed so they are not re-planned by accident.

## 9. Cross-cutting pipeline

- **Captures and the scoreboard.** The manifests under `scripts/` are the staging authority; `metrics.mjs` the scorer; `docs/qa/FIDELITY_SCOREBOARD.md` the record. Same lighting contract every time: `sky=native`, `quality=high`, clear, `tod=0.7`, `fresh=1`, `blink=999`.
- **Blender and Meshy.** Scripts live in `scripts/blender/`; Robert runs Blender 5.2 on his PC and drops outputs in `C:\Users\Robert\Projects\havens-blender-pilot\` (the agent writes and reads scripts, never claims to have run Blender). Raw downloads and reference sheets go to an archive orphan branch; accepted runtime GLBs are committed under `src/assets/` with a register entry and the provenance the [Meshy guide](../../Art%20and%20Assets/Guides/meshy/README.md) lists (route, model and version as shown, task id or "not exposed", plan tier, date).
- **Save compatibility.** Colour and default changes use a sanitizer migration keyed on the exact old defaults (the `lensRev` pattern); the schema version does not move.
- **Performance protocol.** Robert measures Medium and High at 1440p in the chase scene after each phase; the agent records it in `docs/systems/GRAPHICS_QUALITY.md`. The cloud's SwiftShader timing item is only a proxy.
- **Tests that stay green on every PR.** Typecheck; the full vitest suite; smoke 15/15; the wyvern suites (`wyvern.*.test.ts`, `trial.test.ts`); `rider-qa` and `rider-blender` when the rider or tack moves; `editor-check` when the world moves; the pose golden, regenerated only with a reason in the commit.

## 10. Decisions for Robert, in the order they block

| # | Decision | Blocks |
|---|---|---|
| D1 | Adopt this plan and open the Harrier gate (G3d) after Phase 0; merge or park PRs #11 and #12 after reviewing them in game. Recorded as Q46. | everything |
| D2 | Accept or change the scoreboard thresholds in section 2. | Phase 0.5 and every exit review |
| D3 | Body route: promote the Meshy trial (A) or stay procedural (B), from the Phase 1.1 comparison sheet. | Phase 1.2 onward |
| D4 | Tack: the expert's yoke topology restyled to the brief (recommended), or a literal X-back redesign. | Phase 1.5 |
| D5 | The Wanderer as the default look for new saves; existing saves untouched. Any lance prop in the Stable or title. | Phase 2 |
| D6 | Dragonflight colour: constrain the player's picker, or only defaults and NPC mounts. | Phase 3 |
| D7 | Windhaven's silhouette changes to the Aegean kit; accept the Driftwing #9 courtyard kit as the base or not. | Phase 4.1 |
| D8 | Order of the landmark passes in 4.4 if different from the brief's. | Phase 4.4 |

## 11. Sequence and sizes

| Order | Work | Size | Depends on | Suggested lane |
|---|---|---|---|---|
| 1 | Phase 0: land #11 and #12, one decision log, baseline, scoreboard | S | Robert's in-game review | implementation (tooling), design (log) |
| 2 | Phase 1.1: body route sheet | S | baseline | design |
| 3 | Phase 1.2 to 1.4: hide, materials, membrane | S each | D3 | implementation |
| 4 | Phase 1.5: tack | M | D4 | implementation |
| 5 | Phase 1.6 to 1.8: form, performance, exit | S each, exit XS | the above | implementation, Robert's GPU |
| 6 | Phase 2: Wanderer rider | M | D5, Phase 1.5 | implementation |
| 7 | Phase 3: three breeds and the flight colours | M | Phase 1 exit, D6 | implementation, assets if route A |
| 8 | Phase 4.1: Windhaven kit | L | D7 | implementation |
| 9 | Phase 4.2 to 4.3: terrain material, species | M | 4.1 | implementation |
| 10 | Phase 4.4 to 4.5: landmarks, sky | L | 4.2 | implementation |

Model use, per AGENTS.md and Robert's instruction: Opus for Phase 0's reconciliation, the body-route decision sheet, the Blender script changes and the Windhaven kit; Sonnet is enough for the shader tuning passes, captures and scoreboard runs. Model switching remains Robert's call.

## 12. Opening brief for the executing agent (paste-ready)

```text
You are continuing Havens of the Drift (rporter33/HAVENS-OF-THE-DRIFT). Read AGENTS.md, docs/HANDOFF.md, docs/design/FIDELITY_PLAN.md and the session-start skill, then send the Havens session acknowledgement before changing anything.

Your task is Phase N of docs/design/FIDELITY_PLAN.md: [name the phase and steps]. Robert has opened gate [name] for it on [date]; decisions D[..] are answered as: [answers]. Anything the plan lists under a later decision is out of scope.

Work on branch [gate/...] from main. Keep flight physics, the 120 Hz step, the save schema, course ids, control mappings and the renderer untouched. Run typecheck, the full vitest suite and smoke before every push, plus the suites the phase names. Captures go to shots/ and havens-archive with a SHA-256 manifest; update docs/qa/FIDELITY_SCOREBOARD.md with before and after rows. Finish by overwriting docs/HANDOFF.md (move the previous checkpoint to docs/history/handoff/<day>.md) and stating exactly which checks passed, which did not, and what needs Robert.
```
