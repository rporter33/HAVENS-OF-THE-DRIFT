# The Harrier to gold standard, then the rest

Written 2026-10-19 on `design/harrier-gold-standard`. Design lane: this is a proposal and a plan, no game code changed. Robert asked for the Harrier mount to be understood and planned to a gold standard first, with the other breeds to follow. Nothing here opens a gate; the gate names below are proposed.

## 1. What "gold standard" has to mean

No written bar exists in this repository. The roadmap's Craghorn gate cites "the fidelity bar (Q1–Q18)" ([ROADMAP](../ROADMAP.md)), but that bar was a Driftwing review document and did not come across in the seed. What does exist, in authority order:

1. **Robert's direction (Q20, Q24, Q25, 2026-10-17):** "the best-looking wyvern achievable"; the visual target is the Codex renders of the Harrier, smooth 3D surfaces and vibrant colour, "an improvement on the current painterly look rather than a replacement of it"; characters first.
2. **The render brief** ([RENDER_BRIEF.md](../art/targets/RENDER_BRIEF.md)): shots 01 (Harrier portrait), 02 (Harrier flight) and 07 (rider mounted on the Harrier) are the Harrier's acceptance images. Its master prompt is the written form of the standard: matte blue-gray scales in **3 to 5 broad rows, never tiny realistic scales**; translucent amber membrane with backlight; real material response (sand leather, soft bronze with patina, never chrome); a **low-profile X-back harness**; elegant, elongated, intelligent and trusting; pale scale ridges; no excess barbs, no metal armour on the animal; smooth continuous surfaces instead of visible facets.
3. **The art direction guide** ([ART_DIRECTION.md](../ART_DIRECTION.md)): the dragons line, and the rule that compliance is claimed only per category with gameplay-camera evidence.
4. **Gate G3** ([FIRST_SLICE.md](FIRST_SLICE.md)): material and texture pass toward the target renders, keep the toon ramp and fog contract, `rider-qa` and `rider-blender` suites green, 60 fps at Medium on the reference GPU.

The target render files are **not in the repository yet** (`docs/art/targets/` holds only the brief and a README). Until they land, the brief's master prompt plus the art pack is the authority, and every judgement below is against the written brief.

### Proposed acceptance checklist (the gold standard, made checkable)

Each line is judged from a gameplay-camera capture at the shots the brief names, side by side with the target render once it exists. Status words per ART_DIRECTION: verified, partial, not verified.

| # | Category | Pass when |
|---|---|---|
| H1 | Identity | Robert says the capture and render 01 are the same animal (brief question 1). |
| H2 | Surfaces | No visible facets on head, neck, legs or tail at the chase camera or in the Stable; silhouettes read as continuous curves. |
| H3 | Hide | 3 to 5 broad scale rows read at gameplay distance; no honeycomb of small scales; paravertebral scutes and the pale dorsal ridge remain. |
| H4 | Colour | On screen at golden hour the hide reads as the authored moss green `#3f7d5a` with the dark mantle `#23453b`, not a brighter emerald; sand belly, amber membrane, gold eyes as authored. |
| H5 | Materials | Visible roughness difference between hide, leather, bronze and membrane; no chrome, no glossy armour. |
| H6 | Membrane | Backlight transmission visible when the sun is behind the wing; veins and darker trailing edge survive the upgrade. |
| H7 | Tack | Low-profile harness in sand leather and softened bronze; the blanket does not dominate the silhouette; rig anchors (`SEAT_Z`, ropes, stirrups, grab) unchanged. |
| H8 | Elegance | The brief's "elegant and elongated" reads in the three-quarter portrait; horns swept, frill of spines, no added barbs. |
| H9 | Mounted | Render 07's fit: rider seated behind the withers, harness clear of the wing root in every flight frame (reuse `d-rider-*` and `c-turn-*` captures). |
| H10 | Budget | LOD0 within the 24,000-triangle ceiling (`parts/res.ts`), LOD1 6,000, LOD2 1,500; 60 fps at Medium on Robert's PC in the `f-chase-*` scene. |
| H11 | Contracts | Pose golden (`__golden__/pose.golden.json`) bit-exact; flight model, 120 Hz step, save ids and cosmetics catalogue ids untouched; ghost material still translucent and shadowless. |
| H12 | Other breeds | Skimmer, Galewing and Ironback captures show no regression while the shared shader changes (their own upgrade is the next phase). |

## 2. Where the Harrier is today

Separated as the session skill asks.

**Exists in source.** The Harrier is one row of the fully procedural wyvern: `flight/breeds.ts` (physics), `creatures/wyvern/proportions.ts` (body plan), the part builders under `creatures/wyvern/parts/`, three LODs on one skeleton (`parts/res.ts`), and `creatures/wyvern/materials.ts`, where the body and membrane are `MeshToonMaterial` patched with the creature light, an analytic four-step toon ramp, baked AO, and a per-fragment hide: keeled scales with relief at detail 2, rings of scale rows and paravertebral scutes at detail 1, mottling, countershading and per-breed markings. Colours are uniforms, so a palette change is not a rebuild. The tack is the dragon expert's Y-yoke and breeching with a blanket, neck rope, grab strap and stirrups (`parts/saddle.ts`). The capture harness (`scripts/dragon-capture.mjs` and its manifest) already stages every shot the brief needs. No texture maps are used anywhere on the creature; the one texture is the toon ramp.

**Usable in this build (verified today).** Typecheck clean; `src/creatures/wyvern` and `src/flight/breeds.test.ts`: 8 files, 155 tests passing on main `affe784`. Six captures taken this session with the harness (`shots/dragon/`, ignored by Git): `a-harrier-three-1080`, `a-harrier-side`, `a-harrier-head`, `b-harrier-glide-three`, `d-rider-back-harrier`, `f-chase-glide`.

**What the captures show against the brief** (source inspection plus rendered-game evidence, SwiftShader, quality high, golden hour):

- Facets are visible on the jaw, the underside of the neck, the thighs and the tail at portrait distance (fails H2). The builder gives each part its own smooth normals, so the facets are a resolution and seam matter, not a shading one.
- The hide reads as a fine, even honeycomb of small scales over the whole body: the brief's "never tiny realistic scales" (fails H3). The broad rows the brief asks for exist in the shader as the detail-1 "rings" layer but are hidden under the detail-2 keeled layer up close.
- On screen the hide is a brighter, more saturated emerald than the authored `#3f7d5a`; the lift comes from the creature light and ramp, not the palette (H4 partial). Belly, membrane and eyes read as authored.
- Hide, leather and cloth share one matte response; the bronze buckles are too small to read (H5 partial).
- The membrane is a flat amber plane in the glide capture; the backlight only shows with the sun behind the wing, which these shots did not stage (H6 not verified).
- The tack is a high red saddle with a large blanket and thick red straps: readable and expert-approved for fit, but not the brief's low-profile sand-leather X-back harness in soft bronze (fails H7). The default saddle colour is `#7a3a2a`.
- Proportions are close to the brief's "elegant, elongated": long neck and tail, swept pale horns, spine frill, no barbs (H8 partial, pending the render).
- The rider is wearing the blue-and-red Flight Leathers, not the ivory chiton of render 06/07; that is the rider half of G3, not the mount.
- Budget: the anatomy test holds LOD0 between 9,000 and 24,000 triangles; the exact count is to be measured in the gate.

**Approved direction.** Q20: best-looking wyvern, Meshy acceptable, Blender source must stay editable by Claude for rig, saddle, collision and animation events. Q24/Q25: Codex renders are the target; characters first. G3 is defined but **not opened**; G8a's playtest is the current next action.

**Future idea, not in scope.** The four-legged dragon rig, the Craghorn, the GLB loader for an authored wyvern. The Windhaven buildings in the captures (slate conical towers, half-timbered stable) are G8's problem and outside this plan.

## 3. Gaps, ranked by what the renders will show first

1. Fine honeycomb hide instead of 3 to 5 broad rows (H3).
2. Faceted head, neck, legs and tail up close (H2).
3. Tack silhouette and material (H7).
4. Colour and material response: lift on the green, one roughness for everything, bronze unreadable (H4, H5).
5. Membrane transmission staged and tuned (H6).
6. Elegance details only the render can settle: head shape, neck carriage, frill height (H8).

## 4. The plan: proposed gate G3a, the Harrier

Scoped as the Harrier half of G3, so the work is bounded and the first before/after against render 01 arrives early. Each step is a separate PR with its own captures; none changes flight physics.

**Step 0, baseline (half a day, can start now).** Run the full `dragon-capture` manifest filtered to the Harrier on main; archive the frames to `havens-archive` with a SHA-256 manifest; publish a contact sheet as `docs/qa/G3A_HARRIER_BASELINE.md`. Measure LOD0/1/2 triangles and the GPU timing item. This is the "before" for every later comparison. Blocked on nothing.

**Step 1, hide language (shader only, S).** Rework the body shader's detail ladder so the close-up layer is the brief's broad rows: scale size set from the body's circumference so 3 to 5 rows span the flank, keels kept but larger, the detail-1 rings becoming the same rows seen farther away. Keep the paravertebral scutes and the pale dorsal ridge. Rebalance the creature light so the authored moss green survives golden hour. Add a roughness split: hide matte, leather semi-matte with edge burnish (the across-strap coordinate already exists), bronze a soft specular lobe, never chrome. Verify H3, H4, H5 on the portrait and chase shots; H12 lineups for the other three breeds, since the shader is shared. Tests: `wyvern.hide.test.ts` (ramp values, relief on albedo only, program declarations), pose golden unchanged.

**Step 2, surfaces (geometry resolution, S to M).** Raise LOD0 ring counts on the head, jaw, neck underside, thighs and tail where the facets show, and smooth the part seams the captures reveal. Stay under 24,000 triangles; LOD1 and LOD2 untouched. Verify H2 and H10 with the head close-up, side and chase captures and the LOD distance sheet. Tests: `wyvern.anatomy.test.ts` budgets, golden pose.

**Step 3, tack to the brief (M).** Keep the expert's topology (front yoke, sternum plate, breeching, no belly girth) because it is the only fit that keeps the bat-like planform whole, but re-proportion it to the brief: lower frame, narrower blanket, thinner straps, sand leather default (`saddleColor` default moves from `#7a3a2a` toward a sand leather), bronze rings and buckles sized to read. Rig anchors, stirrups, ropes and the seat stay where they are so the rider fit and `mountedFit` tests hold. Verify H7 and H9 with `d-rider-*`, `c-turn-*` and render 07.

**Step 4, membrane (S).** Stage the backlit shots (sun behind the wing) in the manifest; tune transmission strength, veins and trailing-edge darkening against render 02. Verify H6.

**Step 5, render-driven refinements (size unknown until the renders land).** Head shape, neck carriage, frill height and anything else render 01 shows that steps 1 to 4 do not. Decided one item at a time against H8 with Robert.

**Exit.** All twelve lines verified or explicitly waived by Robert; the handoff records the captures; G3's remaining half (the rider) is scoped from the same evidence.

### Route: procedural first, Meshy as a study

Q20 allows Meshy. Recommendation: do steps 1 to 4 on the procedural wyvern and only open a Meshy/Blender study if render 01 shows forms the builder cannot reach. Reasons: the procedural wyvern already carries the rig, animator (flight, gait, life, tail), ground contacts, three LODs on one skeleton, cosmetics as uniforms, ghost material, baked AO and 155 tests; a generated body would need a loader, re-skinning, re-fitting of the tack and cosmetics, and its own LODs before it could be compared, and the Meshy guide records that custom Blender rigging and flight animation remain required. The shader and resolution work in steps 1 and 2 are exactly where the brief's upgrade (smooth surfaces, broad scales, materials) lives. A Meshy study, if opened, is its own task with the provenance record the guide specifies.

## 5. Then the rest

Because the hide shader, the creature light, the tack builder and the resolution profiles are shared, steps 1 to 4 land on all four breeds at once; the per-breed work is what remains after the Harrier passes:

| Breed | Shared from the Harrier | Breed-specific work | Target |
|---|---|---|---|
| Skimmer | hide, light, materials, tack, membrane | its own markings and bat-like hand-wing read; rock-perch portrait staging | render 03 |
| Galewing | same | the long-wing membrane at span, slate value against the cloud sea (VIS-06 cap stays) | render 04 |
| Ironback | same, plus the 30,000 LOD0 ceiling | osteoderm plates with the broad-row language, the heavy landing capture | render 05 |

Order: Skimmer, Galewing, Ironback, matching the brief's shot order; each is a short PR of captures plus breed-specific fixes, with the Harrier's captures re-run as the regression check (H12).

## 6. Verification and what is preserved

- Flight physics (`flight/`), the 120 Hz step, `driftwing.save.v1`, cosmetics ids, control mappings: untouched. The golden pose test stays bit-exact in every step.
- Each step: typecheck, the wyvern suites, `rider-qa` and `rider-blender` suites (G3's acceptance), smoke 15/15, the filtered capture manifest, and the GPU timing item. SwiftShader captures establish look, not performance; the 60 fps line needs Robert's PC.
- Captures go to `shots/` and the archive branch, never to `main`.

## 7. Decisions for Robert

- **Q36 (new, open):** open G3a, the Harrier half of G3, in the order above, with the procedural route first and Meshy as a study only if the renders demand it?
- Supply renders 01, 02 and 07 to `docs/art/targets/` (Q24). Step 0 and step 1 can start on the written brief; steps 3 and 5 should wait for them.
- Confirm the tack direction: keep the expert's yoke-and-breeching topology, restyled to the brief (recommended), or redesign toward a literal X-back.
- The G8a playtest remains the current next action; this plan does not displace it.
