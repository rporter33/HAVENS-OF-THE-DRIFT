# Windhaven traveling home — playable art study

Windhaven is a traveling home that carries the player between levels/regions, with sheltered crafting and storage space and room for several riders. The owner approved the current scale as the working baseline. Destination selection and anchored exploration take priority over constant manual steering; multiplayer is not implemented or implied by the available room. The current milestone is a stationary, walkable art study in a dedicated review scene.

## Version and saved copies

As of October 10, 2026, development is on `feat/windhaven`, based on GitHub `main` commit `844e5c25860aab4c596116df4ffb19fa4e98fd1e` (shrine tutorial, rider motion, flight braking and title music). Windhaven was applied as `9b9964c0f85bac9dc781e8ac2ce20a9b1830640c`; its code was carried across unchanged. The package version is still 0.1.0, so use the Git commit to distinguish builds.

The separate recovery index is `C:\Users\Robert\Projects\Windhaven-Backups\README.md`. The latest snapshot is `2026-10-10-art-pass-3`; both earlier art passes, `2026-10-10-latest-main` and the original `2026-10-10-before-update` remain available. Each has source, captures and a Git recovery bundle. The original is also retained locally at `windhaven/checkpoint-2026-10-10`, commit `974bb32e7e11a0bfd58d9210429c057dfa4da164`. Restore into a new directory; do not overwrite another checkout's work.

The earlier combined blockout passed 957 unit tests across 93 files, the production build, 15/15 production smoke checks, and both deterministic and live-keyboard Windhaven browser checks across all four breeds, including reload/recovery. Its logs and captures are preserved in the earlier snapshot. Art-pass results appear below. Physical controller and embedded-browser checks remain separate.

## Open the review

Run `npm run windhaven` from the repository. It serves only on `127.0.0.1:5174`, opens `http://127.0.0.1:5174/?view=windhaven`, and refuses to silently change ports. Keep that terminal running while testing; closing the server makes the browser show a connection error. If port 5174 is already serving this project, use the existing preview. This scene is selected explicitly; it does not add the ship to ordinary play.

Use **Overview**, **Top**, **Side**, **Cabin**, **Windows**, **Hitches** and **Hull** to inspect the art. These views freeze player movement while wind and sail cloth remain live. **Clear wind** and **Breezy wind** select existing world weather presets (4 and 9.5 m/s prevailing wind, plus gusts). **Walk deck** resets the rider and wyvern onto the aft terrace and resumes play, including from the pause menu. **Ride / take off** seats the rider facing the open stern. WASD moves, F mounts or dismounts, Space jumps on foot or launches when mounted, and Esc pauses both gameplay and cloth. Drag the view to look around. The breed selector previews all four existing breeds without changing the saved breed choice.

The review uses the normal game session and save infrastructure; other ordinary progression/settings behavior still applies. It is not a separate save slot.

## Layout under review

The deck remains 72 metres long with a 28-metre-wide working area. The owner approved this scale for the art pass, including room for several riders. Art pass 2 rounds the outer stern corners and reshapes the forward taper into an elliptical bow; the terrace's central landing envelope, shelter, cabin, workshop footprints and routes remain protected. The largest current breed, Galewing, has a 20.5-metre spread wingspan; exhaustive animated clearance remains part of further review.

| Area | Current arrangement |
| --- | --- |
| Aft landing terrace | 28 by 26 metres, with open stern and side approaches. Four low hitch mounts occupy its outer side margins; the central landing route stays open. |
| Central dragon shelter | 14 by 16 metres, open aft, with a roof underside 9.6 metres above the deck. Side paths let the rider pass a resting dragon. |
| Workshops | Two 5 by 10 metre reserved areas forward and outboard of the shelter, with placeholder benches and storage. |
| Living cabin | An 8 by 10 metre room forward of the shelter; an aft doorway and outside paths keep access straightforward. |
| Chart deck | A forward navigation area with a placeholder chart table. |

The working furnishing proposal is movable benches, storage and decorations inside designated buildable areas. Landing, shelter entry and circulation remain protected. Placement controls, recipes, inventory and furniture persistence are future implementation work.

## Implementation boundaries

`src/world/airship/windhavenPlan.ts` supplies the same solid geometry to rendering and terrain collision for the hull, deck, rails, roof, cabin, masts and furniture. An optional horizontal corner radius supports rounded footprints in both top-support and signed-distance queries; ordinary box behavior remains unchanged. `roundedPrism.ts` tessellates that footprint for rendering. `Windhaven.ts` builds the procedural view using the existing painterly material. `src/debug/showcases/windhaven.ts` adds the review scene through the existing lazy showcase loader. No flight physics or shared player behavior was changed.

The four main sails, four lower steering sails and travel pennon use the existing Verlet cloth solver, driven by the same world wind field as the dragon. Pinned spar attachments, stretch/bend constraints, damping and bounded travel preserve the silhouette. Linen seams, blue hems and the spiral move with the cloth through procedural UV textures. They are presentation physics: no propulsion, player cloth collision or cloth self-collision is implemented. Shelter and cabin covers remain fixed architectural surfaces. The underbody is now a continuous smoothly shaded convex shell; its rendered triangle surface is also the collision solid. Cabin windows are real glassless openings with decorative frames. Four rounded timber/bronze hitch mounts expose named attachment sockets on the open terrace, each reserving capacity for one future dragon/player; no tether, occupancy or multiplayer system is implied.

The shelter has no stable service interaction yet. The ship cannot move, steer, become the home/respawn anchor, or retain furniture changes. The Codex research airship remains unchanged; its story relationship to Windhaven is unresolved.

## Verification

The 27 focused tests in `windhaven.test.ts` exercise actual player simulation for all four breeds: flared landing and stopping from the stern and both sides, standing, dismounting, remounting, takeoff, and entering the shelter. They also check the rider's side walkway, landing airspace, overall deck/door/headroom dimensions, open windows, four reserved hitch sockets, agreement between rendering and collision surfaces, finite bounded art geometry and decorative clearance over the terrace. `SailCloth.test.ts` adds three tests for wind response/pins, frame partition/pause and extreme gust stability. These do not certify exhaustive animated wing clearance, arbitrary landing angles or a moving platform.

With the preview server running, `npm run test:windhaven` checks two browser paths: deterministic stepping with scripted inputs, then normal live rendering with keyboard events. The live pass tests WASD walking, F mount/dismount, Space launch, Escape pause, reset/resume and page reload. It captures overview, top, side and walking views into ignored `shots/`. Set `CHROMIUM_PATH` to an installed Chromium/Edge executable if Playwright's browser is unavailable. Physical controller hardware and the embedded app browser require their own interactive checks.

## Art pass 1 — October 10, 2026

This pass adds a finer rounded strake hull, connected tapered handrails, plank caulking, two tiers of fuller crescent sails with shared-shape spars/seams, curved stabilizer cloth, a tensioned shelter shade, arched opaque cabin window panels, a shallow blue canvas roof and a travel pennon. The original deck rectangles, cabin footprint/doorway, workshop footprints, landing terrace and shelter headroom remain unchanged. Reduced material rim lighting preserves the pale/blue color separation in bright daylight.

Implementation: `src/world/airship/Windhaven.ts` and `windhavenPlan.ts`; review cameras: `src/debug/showcases/windhaven.ts`. The ship uses 13 render meshes, 983 solid box instances and 50,367 triangles before shadow passes. These are geometry counts, not a frame-rate claim. No new dependencies, runtime image imports, renderer changes or flight changes.

Sources read together: [shared guide](../ART_DIRECTION.md); `Art_Direction_Master.md` v2 and `README_START_HERE.md` under `docs/art/Driftwing_Codex_Handoff/` on `origin/docs/art-reference-pack` at verified commit `f3ef231c6a12ed5865cd73562447f6d94a1730bf`; supplied Windhaven concept plate (preserved as `windhaven-concept-reference.jpg` in the external backups). The master is proposed art direction, not a production mesh specification.

Reproduce evidence with `node scripts/windhaven-art.mjs` while the preview is running. It saves 11 high-quality 1440×900 captures and metrics under `shots/windhaven-art/`. Browser: Playwright with Microsoft Edge and SwiftShader; no physical-GPU performance certification. Gameplay-camera images are `on-foot.png`, `mounted.png`, `takeoff.png`, `bank.png`, `dive.png`, `brake.png` and `dismount.png`; `overview.png`, `side.png`, `top.png` and `cabin.png` are inspection cameras. Flight labels describe short scripted inputs, not certification of a sustained full dive or exhaustive animation coverage. The art-pass recovery snapshot includes these images.

| Guide category | Source / implementation | Observed evidence and status |
| --- | --- | --- |
| Costume / silhouette | Master sections 01–03; Windhaven concept; `Windhaven.ts` | **Partial** for ship silhouette: `overview.png`, `side.png` and `on-foot.png` show the tiered canopy and broad open terrace. Original bow steps and square masts remain. Costume changes are **not applicable** to this ship pass. |
| Palette / materials | Master section 05 swatches; `Windhaven.ts` material palette | **Verified in sampled daylight views**: `on-foot.png` and `cabin.png` show pale surfaces, blue accents, brown timber and restrained bronze. No chrome/gloss added. Fine woven/wood surface treatment and other lighting conditions remain unverified. |
| Armor / detail | Master sections 01, 05; `Windhaven.ts` fittings | Armor is **not applicable**; no armor edits. Ship detail is **partial**: broad trim/seams and inset panels read in `on-foot.png` and `cabin.png`; worktables/storage remain simple forms. |
| Lance / banner | Master sections 03–04; `Windhaven.ts` travel pennon | **Partial**: a long pale/blue top-mounted ship pennon appears in `cabin.png`. This is a ship signal, not a rider lance; no lance gameplay or final insignia approval claimed. Cloth is static. |
| Bracer / tether / harness | Pack introduction; no implementation changes | **Not applicable**: equipment, tether and harness systems are outside this pass. Their appearance in captures is not a compliance claim. |
| Architecture | Master sections 02, 07; `windhavenPlan.ts`, `Windhaven.ts` | **Partial**: pale cabin, arched panels, blue roof and linen shade follow the Mediterranean language in `cabin.png` / `on-foot.png`. Cabin interior and fully sculpted hull remain unfinished. Panels are solid decorative shutters. |
| Dragons | Master section 07; existing creature implementation retained | **Not applicable** to art changes. Existing Galewing is the gameplay scale cue in captures; all four breeds retain landing/walking/launch test coverage. No creature visual compliance claimed. |
| Animation / camera clearance | Master sections 04, 08; existing game camera/player plus Windhaven scene | **Partial**: sampled on-foot, mounted, takeoff, bank, tuck/pitch, flare and dismount views keep the dragon and forward route readable. Shelter underside enters the upper frame during early takeoff/bank. Review panel covers some left-side scenery/dragon at close range. Exhaustive wing turns, sustained full dives, all camera angles and controller hardware remain unverified. |

This is an art progression beyond the blockout, not final production-art approval. Cloth/fittings remain decorative and require collision review before free flight through the canopy. The approved deck space and primary dragon routes remain protected.

Validation: full suite passed 959 tests in 93 files before the final visual refinements; final focused suite passed 25/25 and the final production build passed. Both Windhaven browser paths passed; after the final rail/material adjustment the live four-breed path and reload were rerun successfully. Final standard production smoke passed 15/15. Eleven final high-quality art captures produced no reported browser errors. No physical-GPU frame-rate or controller certification claimed.

## Art pass 2 — windows, rounded edges, hitches and wind cloth

Starting point: art-pass-1 commit `35b7931870ab60a9311cb1ecef218f0b1b97d483`, still on `feat/windhaven` above game main `844e5c2`. This pass implements the owner's request for open cabin windows, softer edges, four future hitch mounts and physical wind response. The new commit is recorded in the separate snapshot README.

- Eleven arched windows are glassless openings with interior/exterior frames. Masonry and collision both leave the apertures empty; no transparency sorting is needed.
- Rounded stern corners, an elliptical bow with finer solid strakes, rounded rail ends, mast/post cross-sections, bench/storage corners and cabin roof corners soften the structure. Overall length/beam remain 72 by 28 m. The perimeter changes slightly; this is not a claim of identical old deck rectangles.
- Four timber/bronze hitch mounts sit at local x = +/-13.35 m, z = -4 and 10 m. Named `hitch-socket-port-1`, `port-2`, `starboard-1` and `starboard-2` nodes sit outboard at x = +/-13.78 m. Each reserves one attachment. Only the mounts and sockets exist; anchoring, ropes, interaction, occupancy and replication remain future systems.
- `SailCloth.ts` reuses the existing rider `Cloth` solver at 120 Hz for four main sails, four steering sails and the pennon: 2,925 particles total. Wind samples come from `Weather.windAt` at each panel centre. Frames over 0.1 s drop excess cloth time to bound catch-up cost. Bounded displacement (1.2 m on framed sails, 2.5 m on the pennon) keeps large gusts from destroying the authored shape. This is stylized presentation cloth, not calibrated aerodynamic sail propulsion.
- Fabric marks now use generated linen textures attached to mesh UVs. Spars stay rigid; sewn markings follow deforming fabric. Normals and bounds update with the vertices. No dependencies, downloaded assets, renderer migration or flight-force changes.

Final capture geometry: 26 meshes, 2,374 instanced box solids plus merged rounded solids, and 97,920 triangles before shadow passes. Increased geometry/CPU cloth cost needs physical-GPU profiling before production deployment. Ordinary game scenes do not instantiate this opt-in showcase.

`node scripts/windhaven-art.mjs` now saves 15 high-quality images and metrics in `shots/windhaven-art-2/`. Its runtime assertions verify motion in every cloth panel, zero anchor drift, correct pause behavior and no reported browser errors. `wind-a.png` / `wind-b.png` are one simulated second apart in breezy world weather; cloth motion is measured from vertices, not inferred from screenshots. High-quality review uses Edge/Playwright with SwiftShader, not hardware performance certification.

| Guide category | Pass-2 evidence / status |
| --- | --- |
| Costume / silhouette | **Partial**: `overview.png`, `side.png` retain the tiered crescent silhouette and broad landing terrace; finer strakes and elliptical bow soften the perimeter. Sculpted final hull remains pending. Rider costume unchanged. |
| Palette / materials | **Verified in sampled daylight views**: `windows.png`, `hitches.png`, `on-foot.png` show pale masonry/linen, blue accents, timber and bronze; no chrome. Fine weave is procedural, not a final material-authoring pass. |
| Armor / detail | Armor unchanged. **Partial** ship detail: rounded mounts/rails and arched frames; furnishings/interior remain simple. |
| Lance / banner | **Partial**: ship pennon now simulates wind-driven cloth. No lance changes; insignia remains provisional. |
| Bracer / tether / harness | Rider equipment unchanged. **Partial** future ship attachment provision: four named hitch mounts in `hitches.png`; no functional tether/harness system. |
| Architecture | **Partial**: `windows.png` visibly shows through near and far windows; finer arches, pale cabin and blue roof. Interior fittings and final hull sculpture remain pending. |
| Dragons | Art unchanged. All four existing breeds retain gameplay regression coverage; no new creature fidelity/compliance claim. |
| Animation / camera | **Partial**: measured live cloth with fixed anchors and pause check, plus the same sampled walking/mount/launch/bank/tuck/flare/dismount views. Shelter underside still enters the upper launch frame and the review panel occludes some left-side scenery. Exhaustive wing clearance, cloth self/contact collision, physical controllers and sustained dives remain unverified. |

Verification: the full suite passed 965 tests across 94 files before the final bow-overlap adjustment. Final focused geometry/cloth/collision/player checks passed 40/40, and the final production build passed. Browser results are recorded in the pass-2 handoff and saved test logs. One intermediate build caught a test-only BufferAttribute typing error; it was corrected before the final passing build.

## Art pass 3 — continuous hull and terrace hitches

Starting point: `92d66901f16cd32830d5ea9a736543b8ad640abb` on `feat/windhaven`. The owner requested a smoother hull closer to the supplied concept, unchanged ship scale/deck space, and hitches closer to the open deck with some obstruction acceptable.

`windhavenHull.ts` replaces 1,728 stacked hull boxes with one closed curved shell. Smooth shared vertex normals remove the strip seams. A procedural material provides longitudinal plank lines, pale timber, a continuous blue band, restrained bronze borders and a darker swept keel. The hull stays inside the 72 by 28 m plan envelope and almost the same underside depth (7.18 m); every deck part, its collision shape and the workshop/cabin/shelter footprint are unchanged from pass 2. The broad stern remains necessary to preserve the approved terrace; this is closer to the concept's curved underbody, not a literal reconstruction of its narrow hull.

The same closed triangle surface drives exact convex collision. Optional convex data on bounded box colliders supplies supporting planes for interior distances/top support and closest-triangle distances outside, including corners. Debug wireframes display the actual solid. Existing ordinary boxes and rounded boxes retain their prior behavior. No flight/player changes, new dependencies or renderer changes.

Hitch post centres moved from x = +/-13.35 m, z = -4/10 m to x = +/-11.9 m, z = -29/-13 m. The four mounts now stand 2.1 m inboard of the terrace edges, beside the aft and forward ends of the open deck. Their one-metre bases occupy deck space deliberately. Socket IDs/capacity remain unchanged; socket centres follow the posts at x = +/-12.33 m. The central approach and z = -23 m side-landing corridor remain clear in the existing tests. Arbitrary approaches and simultaneous use by four dragons are not certified.

`scripts/windhaven-art.mjs` saves 16 high-quality views in `shots/windhaven-art-3/`, including the new **Hull** camera and relocated **Hitches** view, plus the prior gameplay and wind checks. Geometry: 26 meshes, 646 instanced box solids plus merged rounded solids and the hull shell, 82,950 triangles before shadows (previous pass: 97,920). This count reduction is not a hardware frame-rate claim.

| Guide category | Source, implementation and pass-3 observation |
| --- | --- |
| Costume / silhouette | **Partial**. Supplied Windhaven concept; master v2 sections 01–03. `windhavenHull.ts`; `hull.png`, `side.png` and `on-foot.png`: smooth swept underbody with retained wide terrace. Narrow reference stern/raised prow are not copied into the approved usable deck. Costume unchanged. |
| Palette / materials | **Verified in sampled daylight views**. Master section 05; `hullTexture()` / `Windhaven.ts`; `hull.png`, `hitches.png`: cream, sky blue, timber and restrained bronze. Final material wear/other lighting conditions unverified. |
| Armor / detail | Armor **not applicable**, unchanged. Ship detail **partial**: longitudinal seams and painted bands replace box joints; `hull.png`. Furnishings remain simple. |
| Lance / banner | **Not applicable** to this pass, unchanged. Existing pennon/cloth motion checks retained. |
| Bracer / tether / harness | **Partial** future ship provision only. Pack introduction and owner's hitch request; `windhavenPlan.ts` / `Windhaven.ts`; `hitches.png` shows relocated mounts. No tether/occupancy/harness gameplay. |
| Architecture | **Partial**. Master sections 02/07 and supplied hull concept; `windhavenHull.ts`; hull surface improved while cabin and deck remain unchanged. Final production fittings/interior pending. |
| Dragons | **Not applicable** to art changes. Existing creature art and four-breed gameplay regression retained. |
| Animation / camera | **Partial**. Master sections 04/08; 16 captures include normal walking, mounted, launch, short bank/tuck/flare and dismount inputs. Hull underside ray/contact tests added. Previous shelter-overhead and review-panel occlusion remain; exhaustive wing/hitch interaction, full dives and controller/GPU hardware remain unverified. |

Validation and recovery details are recorded in the pass-3 handoff and separate snapshot. The work remains a stationary art study; travel, crafting, stable services and functional hitching remain future milestones.

## Next development steps

1. Review deck proportions, cabin placement and shelter clearance in the blockout. Check full turns, folded wings, landing flare, launch strokes and camera framing before detailed art.
2. Refine the swept hull, sail spars and fittings while preserving the tested routes. Finish cloth collision and resolve the Codex relationship before production integration.
3. Connect home/stable/respawn behavior, ship persistence and a small complete crafting loop. Keep the landing terrace and circulation protected during placement.
4. Add destination-based region travel. If the journey moves the occupied ship continuously, first implement deterministic support identity/velocity and moving collision bounds for walking, mounting, launch and landing. The current static collider index cannot support this merely by mutating boxes. Continuous manual steering is not the primary loop.

The user's request authorizes continued Windhaven development. These steps remain scoped implementation milestones, not approval for renderer replacement, unrelated backlog features or changes to dragon flight feel.
