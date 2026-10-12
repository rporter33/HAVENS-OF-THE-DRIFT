# Driftwing rider design review

Prepared October 10, 2026 for Robert. **C02 + M01 + P1 approved. Implementation awaits the current source upload and target selection.**

Recommend **C02 Travel Drape**, using **M01 materials**, for a deliberately small **P1 preview prototype**. C02 makes the rider recognizable through a pale asymmetrical drape, a quiet slate scale panel, a blue sash, and wrapped sandals. Its short flight conversion can be tested on the existing dragon without replacing the rig or flight system. The supplied human identity is one study character, not a new default identity imposed on players.

Open [the visual review](index.html) for all four linked plates and current-engine captures. The original request is preserved in [USER_REQUEST.txt](USER_REQUEST.txt). This brief, the approved scope record when completed, and the plates belong together.

## Recorded decision

Robert approved the following three items: "absolutely - its a good combination - i approve". His subsequent message confirms that the source is still being uploaded. The approval remains valid; source selection is pending.

1. **C02 Travel Drape** as the direction for the playable rider, with AN-01 Cloudpath Wanderer as the baseline and AN-04 Aerie Rider as its mounted proof.
2. **M01**, a restrained painted/toon material direction: dry linen, matte slate scales, worn leather, and softened bronze. Start at 1K; retain vertex-color dye control. Normal detail is conditional on the in-engine comparison. No general PBR conversion.
3. **P1**, one medium-build, existing-ponytail Wanderer preview, an early shortened Aerie mounted variant, and a small 1K material proof on the existing rig. Keep this behind development/showcase selection until reviewed. Include checks that existing builds, cosmetics, recoloring, and movement are unaffected. Do not add saved customization fields or replace players' selected outfits.

The approval covers C02, M01 and P1 together. It does not authorize production catalog changes, all eight outfits, all twelve armor pieces, new bodies or age controls, other characters, a renderer rewrite, merge, publication, or deployment. [APPROVAL_RECORD.json](APPROVAL_RECORD.json) records the exact scope and the outstanding source prerequisite.

Post-approval source note: the shared `docs/ART_DIRECTION.md` has now been found and read in the Windows Codex worktree. Its hierarchy and visual guardrails agree with this design. WSL source candidates are `dev/codex-wsl` at `30756b23079c56d5d033762d4cdcc58b8d123173` and `exp/sky-lance-v1` at `0bb2498eecb5ea3c49ef4599e3078da77c103198`. Neither is selected for implementation yet. The evidence table below records the original review baseline; it does not describe the uploading source as settled.

Before P1 starts, identify the intended integration branch and its Sky Lance implementation. The inspected checkout is older than the implementation described by the request. Resolve that source mismatch before editing code; do not reconstruct or remove lance functionality based on this snapshot.

## Evidence and reference precedence

| Item | Verified evidence and limits |
|---|---|
| Checkout | `C:/Users/Robert/Projects/Driftwing`, branch `dev/ai-setup`, commit `1d718e943aa4e960cd39f2ff3bf82eca362d7cfe`; clean at entry and after capture work. |
| Reference snapshot | Extracted with `git archive` from local `origin/docs/art-reference-pack`, commit `f3ef231c6a12ed5865cd73562447f6d94a1730bf`, into this review folder. No checkout switch or repository write. |
| Revised master | Revision 2.0; introductory content also read through the GitHub connector, blob SHA `8f98b5bc3738c62343afa21eba9f93347ebb0880`. Local snapshot remains the version used for the complete pack. |
| Shared art guide | `docs/ART_DIRECTION.md` is absent locally and in the local reference branch. GitHub file requests returned 404 on the repository default branch and `docs/art-reference-pack`. Its contents and precedence rules were not inspected. |
| Governing interpretation | The user's explicit corrections, then revised master and individual component specifications, then imagery as visual evidence. Earlier atlas labels and handoff text are subordinate where they conflict. This is a provisional reconciliation of the missing shared guide, not a claim to have read it. |
| Project guidance | AGENTS.md, ARCHITECTURE.md, relevant ROADMAP sections, and CLAUDE.md inspected. No project SKILL.md appeared in the tracked checkout tree. |
| Implementation mismatch | This checkout's source has no Sky Lance/grapple implementation. The reference README describes that gameplay assignment historically; it does not authorize implementation in this task. Preserve the approved throwing, anchoring, tether/swing, release, and recovery behavior on the eventual target branch. |
| Hardware | Robert confirmed desktop/laptop, including integrated graphics. Existing tiers are Low, Medium, High, Ultra. Exact GPUs and frame-time targets remain to be measured/agreed before production budgets are fixed. |

All **23 image references** were visually opened via inspection sheets or directly: Wanderer, Scout, Standard Bearer, Elder, Banner Families, Faction Palette, all four Concept Atlases, Armor Component Overview, and all twelve Armor Cards. The two requested manifests, Individual Armor Specifications, master, and README were read. No requested image was missing from the extracted snapshot. Some Markdown links within the pack point to obsolete `assets/` or `Individual_PNG_Design_Cards/` names; the actual supplied JPG/PNG files are preserved under `References/` and `Armor_Cards/`.

Reference interpretation:

- The four character paintings provide height, generosity of drape, wind, companionship, and the top-mounted banner. They do not validate anatomy from every angle, rear fastening, pole placement, or cloth clearance.
- Banner diagrams establish A Wayfinder, B Rider swallowtail, and C Sanctuary families. Their older ceremonial wording does not remove the lance's gameplay function.
- The palette diagram establishes the cloth/scale/accent hierarchy. Its approximately 70/20/10 distribution does not constrain skin, hair, or every saved dye selection.
- Atlases provide part families and layering cues. Their legacy Zephyr Ranger name, archery equipment, staff/orb shapes, boot emphasis, tiny scales, and elaborate trims are not carried forward.
- Numbered armor cards are simple component briefs, not validated front/side/back meshes. The specification corrects tiny-mail interpretations to 3–5 broad scale rows.
- Mediterranean limestone arcades, terraces and awnings guide concept backgrounds. Background architecture and the painted dragon treatment are not authorized environment or creature redesigns.

## Current rider baseline

Seven actual engine captures were produced from a byte-identical source snapshot of the inspected HEAD, served from the review folder. Existing installed Three.js 0.186.1 and Vite 8.3.4 packages were read from the Codex checkout; nothing was installed. The temporary server used an external resolver configuration and cache location. Capture automation follows the existing manual/showcase interfaces in `scripts/shot.mjs` and `src/debug/showcases/rider.ts`.

The browser was a fresh, nonpersistent headless Edge context using SwiftShader. No existing user profile or saved game was opened or modified. Only ephemeral test-browser storage was used. Captures are **real engine output**, not paintovers; they are **not GPU performance benchmarks**, a production build test, or validation of a new design. All images are 1440×900, Low quality, default seed/scene. Day uses `tod=0.42`; night uses `tod=0.03`. [capture-manifest.json](capture-manifest.json) records queries, mesh counts, renderer statistics and errors.

| Capture | What it establishes |
|---|---|
| [Full body](baseline-full.png) | Current default medium/flight/ponytail/goggles/long-scarf silhouette. Showcase camera distance 2.7. |
| [Face and hair](baseline-face.png) | Same rider with headgear temporarily omitted in the showcase; camera distance 0.68. |
| [Mounted distance](baseline-mounted.png) | Actual rider and actual dragon held in a showcase flight pose; distance 8. This is posed engine output, not a recorded takeoff sequence. |
| [Ordinary gameplay](baseline-gameplay.png) | Normal on-foot gameplay camera and HUD after eight seconds, with the dragon in view. |
| [Three builds](baseline-builds.png) | Slight, medium, broad lineup. The showcase automatically varies skin/hair colors; these are independent controls, not build restrictions. |
| [Six outfits](baseline-outfits.png) | Current catalog lineup with headgear/scarf removed for comparison. |
| [Low light](baseline-night.png) | The default silhouette and material separation in the actual night lighting. |

The first capture attempt could not launch Edge within the sandbox; an isolated browser/server run succeeded with tool-reviewed execution permission. A duplicate time parameter in the initial night query was corrected before the final capture set. The final seven captures recorded **zero page errors, zero console errors, and empty `__dw.errors`**. These are capture observations only.

### Most important visual gaps

| Area | Observed in the captures | Proposed improvement |
|---|---|---|
| Silhouette | Default jacket, narrow trousers and tall boots; different outfits share a similar upright tube-like torso/leg read. | A diagonal drape, clear waist mass and split chiton hem, with calf wraps and sandals. Change geometry and layer construction, not just palette. |
| Anatomy | Narrow shoulder transitions, tube-like arms and very simplified glove silhouettes; builds already differ. | Reshape deltoid-to-arm transition, elbows, pelvis-to-thigh flow and palms within current joint locations. Preserve overall height/contact anchors initially. |
| Face | Large dark oval eyes and simple protruding nose dominate the closeup. | Broader brow/cheek planes, eyelid rims, restrained iris/sclera separation, integrated nose bridge, readable mouth corners. Retain warmth and distance readability. |
| Hair | Grouped clumps exist, but many pointed locks compete around the forehead. | Fewer primary masses with a deliberate hairline; small secondary locks near face only. Keep all six style identities. |
| Drape | Default cloth is primarily scarf/tails; body garments read as fitted surfaces and bands. | Construct shoulder pin, fold origin, overlap, hem thickness and split panels explicitly. Reuse existing garment and cloth machinery. |
| Materials | Cloth, gloves and fittings largely share a smooth toon response; color conveys most distinction. | Broad form first, quiet painted variation, controlled normals and a local material-response proof. Avoid noisy weave or metallic scale armor. |
| Distance | Orange scarf and blue torso carry the current rider read; the mounted rider is small. | Prioritize the pale shoulder triangle and blue waist. Keep face detail as a close-camera reward, not the gameplay identifier. |
| Low light | Default dark torso and trousers merge in shade, while eyes and goggles remain prominent. | Test value separation on all skin tones; adjust rider-local fill only if necessary, without washing out dark skin or changing global world lighting. |

### Existing implementation worth keeping

`model.ts` assembles body, outfit, hair, headgear and neckwear into one skinned geometry and a shared vertex-colored `MeshToonMaterial`. `rig.ts` defines **27 bones**, including grouped finger/thumb and toe bones. `animator.ts` supplies procedural movement, limb IK, mount posture and gaze; `Rider.ts` blends foot/saddle anchors and contact frames. The snapshot already has Verlet cloth, collision capsules, quality-dependent cloth detail, procedural patterns and hair motion.

Measured default showcased mesh: **6,567 vertices / 12,170 triangles**, excluding two cloth meshes (ponytail and scarf). Removing goggles yields 6,241 vertices / 11,642 triangles. The six bare-head/no-scarf outfit meshes range from **10,990 to 12,606 triangles**, plus outfit-dependent cloth. These counts are not the whole scene. Renderer totals in the manifest include world, dragon, effects and rendering passes.

The body builder emits `position`, `normal`, `color`, `glow`, `skinIndex`, `skinWeight`; **no UV attribute**. Cloth emits its own `dwUv` for procedural patterns, not a general validated atlas layout. No new rig is justified by the study. Skinning, shared geometry, deterministic 120 Hz movement, saddle/IK contacts, cloth stability and current camera behavior remain constraints.

## Concept register

| ID | Variation | Value and tradeoff | Status |
|---|---|---|---|
| C01 | Light Wrap | Short crossed cloth and minimal scale exposure; easiest clearance, least distinctive rear silhouette. | Alternative |
| **C02** | **Travel Drape** | One shoulder anchor, diagonal back mass, quiet scale bib and blue sash; strongest balance of reference character and practical conversion. | **Selected and approved for P1** |
| C03 | High Mantle | Larger shoulder mass and cobalt lining; reads more formally, increases neck/scarf/headgear overlap risk. | Alternative |
| M01 | Four-material family | Dry linen, matte slate scales, leather, softened bronze; close detail subordinate to large forms. | Recommended, not approved |
| P1 | First preview slice | Representative body/outfit, early mounted conversion, small material proof. | Awaiting explicit implementation approval |

Plate 01 v2 shows controlled variations on the same person plus front, left-side, back and three-quarter studies and face/hair closeups. Plate 02 v2 is the authoritative wardrobe sheet. Plate 03 is illustrative material/lighting intent. Plate 04 v2 is a painted mounted/camera mockup based on the existing green Harrier's anatomy and palette. All generated plates use the built-in imagegen tool; prompts are included beside them.

### C02 construction decisions

- Preserve the existing approximately 1.75 m medium-body scale and joint/contact locations for P1. Treat the painted roughly 7–7.5-head proportion as a silhouette target to reconcile with that rig, not a mandate to stretch limbs or shrink the head immediately.
- Keep a chalk chiton with overlapping split panels and knee-length inner wrap trousers. Use a generous shoulder fold secured by one flat bronze pin. The visible chest has 3–5 broad rows; the reusable bib target is four.
- The ground drape is allowed a hip-to-upper-thigh fall. AN-04 shortens it above the saddle seat and secures the free mass at the outer ribs. Mounted sash tails tuck at the outer hip; no loose central back or inner-thigh hardware.
- Preserve a quiet scale surface and readable hands. Reinforced palm wraps should not cover the finger silhouette or change the hand grip. Sandals need a heel/sole construction compatible with existing stirrup and foot anchors.
- The long top-mounted banner identifies the equipped Sky Lance. A small leaf tip remains visually restrained but must preserve the actual thrown/anchored prop and collision contracts. Do not change reach, throwing origin, anchor offset, tether length or recovery because a painted pole looks different.

**Newly proposed construction:** rear chlamys fold and rib tie, bib rear/side closure integration, precise seam and inner hem layout, harness layering on this rider, and optional outboard saddle holder. The crossback harness family itself is reference-backed by AN-AR-02; the way it fits this rider is new. These views are consistent concept studies, not measured orthographic turnarounds. Commission/author actual construction drawings after the silhouette proof.

Generated details do not override the brief: tiny differences in folds, scale count, sandal straps or pins are illustrative. The final plates remove incidental slogans and align the mounted sash with the secured version in Plate 02 v2. The chase-camera flight-route line is an explanatory overlay, not a new gameplay feature. No clearance is proven by the mounted painting.

## Player options and compatibility

The current rider record has **12 fields**: `build`, `skin`, `hair`, `hairColor`, `outfit`, `outfitPrimary`, `outfitSecondary`, `headgear`, `scarf`, `scarfColor`, `cape`, `capeColor`. There are three builds, 27 shape choices across five cosmetic slots, eight skin swatches, twelve hair swatches and sixteen cloth swatches. Save sanitization accepts valid custom hex colors beyond the curated swatches. No eye-color, face-shape, age or independent armor-slot fields were found.

### Option matrix

| Area | Existing and preserved | Visually redesigned in a later approved expansion | Newly proposed | Deferred |
|---|---|---|---|---|
| Build | `slight`, `medium`, `broad` | Distinct width, girth and height with coherent shoulder, hand and face fitting. | Additional body proportions only after coverage/collision review; high cost. | Height slider, new skeletons and full body-morph system. |
| Skin | Eight swatches; valid custom hex saves | Face plane definition and material response across light through deep values. | No mandatory new control. | Photoreal skin, subsurface pipeline. |
| Hair | `short`, `ponytail`, `braids`, `curls`, `shaved`, `long`; all colors | Grouped silhouettes, roots, crown fitting and cloth attachment. P1 proves the existing ponytail only. | Optional additional tied style, roughly 1–2 artist/tech days plus headgear/cloth matrix; separate approval. | Full new hair catalog. |
| Face | Current face follows the body; no face selector | Clear lids, cheek/jaw planes, nose and mouth. First prove one face, then validate all builds/skin values. | Two or three face-shape presets, roughly 3–5 days plus fitting/save/UI work; age-presentation presets roughly 2–4 more days. Estimates, not a schedule. | Facial animation rig, detailed wrinkles, beard library. |
| Outfit | `flight`, `scout`, `courier`, `racer`, `cartographer`, `skyknight`; all unlock conditions | Any future reinterpretation must retain each option's recognizable role and earned identity. Do not turn every choice into the Wanderer. | Additive AN-01/AN-04 preset IDs after P1; prices/unlocks separately agreed. | Six other role outfits as production work; automatic legacy replacements. |
| Headgear | `goggles`, `none`, `cap`, `hood`, `helm`, `circlet` | Fit to refined face/hair; subdued hardware where approved. | Internal fit profiles. | Removal of earned helm/circlet or forced bare head. |
| Scarf | `long`, `none`, `short`, `twin`; selected color | Same options with stable anchors and controlled flow. | Contextual stowed presentation that leaves saved choice intact. | New scarf catalog. |
| Cape | `none`, `half`, `full`, `tattered`, `feathered`; selected color | Maintain option distinction; visible mounted fold/secured variant requires review. | Internal overlap rules with shoulder drape. | Silent cape suppression or forced reset. |
| Dyes | Skin, hair, main, trim, scarf, cape fields | Neutral texture modulation supports existing recipe-based recolor. | Internal cloth/scale/leather/bronze material classification, not new UI slots. | Extra dye controls until a clear player need exists. |
| Gear | Existing equipment behavior on actual integration branch | Presentation only; preserve lance functional sockets and timings. | Optional holder and modular garment internals. | Twelve individual player-facing armor controls; new gameplay stats. |

For face/body expansion, changes must preserve saved selections and remain available independently of wardrobe, build and complexion. Do not encode age, gender presentation, skin tone or hairstyle into a costume ID. The example in the concept plate is not a restriction on player identity.

### Mixing pieces without an unbounded wardrobe UI

Use internal component recipes to build presets from chiton, bib, drape, sash, footwrap/sandal, and bracer/palm pieces. Resolve them into the existing combined skinned mesh where rigid/skinned; keep truly dynamic cloth separate. Start with presets; later expose only a few combinations that pass fitting tests. Reference socket names are authoring categories, not requirements for nine or twelve new UI controls.

| Combination | Proposed rule |
|---|---|
| Hair and headgear | Retain existing `coversCrown` logic for cap/hood/helm. Supply matching crown and exposed-lock geometry for each existing hair ID. Long hair/braids exit below the cover; never change the saved hairstyle to short. |
| Shoulder drape and scarf | Reserve a clear neck envelope. Attach scarf under collar, drape to shoulder/rib anchors; test head turn and dive. Use a reviewed folded drape variant if overlapping, without deleting either saved option. |
| Cape and drape | A preset uses either a compact shoulder wrap compatible with the selected cape, or a clearly shown cape-safe fold. `cape=none` must remain none; an outfit's shoulder fabric must not masquerade as a forced cape selection. |
| Waist and utility gear | At most one strong accessory near the belt. Keep pouches on the outer hip, no rigid geometry in seat, crotch or thigh hinge. |
| Mounted cloth | Move free ends away from saddle, rein grip, neck and wing sweep; use existing cloth anchors/capsules and bounded cloth lengths. Presentation folding must not modify flight physics. |
| Lance and banner | Preserve existing hand/anchor sockets and functional envelopes first. Proposed saddle holder is optional pending inspection. Banner stays outside face, dragon eyes, central route and HUD through both banks. |

Suggested dye mapping: `outfitPrimary` controls the base cloth; `outfitSecondary` controls sash/selected lining; `scarfColor` and `capeColor` retain their own components. Skin and hair remain independent. Scales, leather and bronze initially use coherent internal constants; reference palette chips are recommended swatches, never a forced remap of existing saved colors. Multiplying a blue-painted albedo by arbitrary player colors would muddy the result; paint neutral modulation for dyeable areas and separate fixed-material regions.

### Twelve armor designs as a library

| Component | Proposed use and scope |
|---|---|
| AN-AR-01 Windscale cuirass | P1 simplified front bib: four broad rows; fit open armholes. |
| AN-AR-02 Crossback flight harness | Early AN-04 proof only where needed for the mounted construction; low-profile rear/hip tabs. |
| AN-AR-03 Windline scale collar | Later Pathfinder/Channeler/Elder; omitted from Wanderer. |
| AN-AR-04 Aerie shoulder scales | Later optional one cap on exposed side; avoid simultaneous drape/pauldron bulk. |
| AN-AR-05 Upper-arm sail cuff | Deferred; not needed to sell the first silhouette. |
| AN-AR-06 Stormward bracers | P1 cloth-wrap treatment; reinforced version after fit proof. |
| AN-AR-07 Lance-grip hand guards | Early AN-04 palm-wrap proposal; preserve bare fingertips and grip. |
| AN-AR-08 Bronze-sash waist guard | Plain sash for Wanderer; defer armor slips. Do not add a second dominant medallion. |
| AN-AR-09 Split hip tassets | Deferred; no inner-thigh or seat armor in P1. |
| AN-AR-10 Cloudstep knee cups | Deferred; need deep-crouch and saddle tests first. |
| AN-AR-11 Skywrap greaves | Deferred rigid shells; use existing-style calf wraps in P1. |
| AN-AR-12 Rider-sole sandals | P1 clear straps/sole; AN-04 heel/toe reinforcement fitted to existing contacts. |

Later role extensions remain compact directions: Windward Scout short crossed wrap and map pouch (A banner); Zephyr Pathfinder diagonal drapes and message cylinder (B); Skybridge Warden short square mantle and heavier broad bib (C); Drake Tender tied apron and soft care pouch (A); Cloudsong Channeler tall ground shawl with flight fold (A); High Aerie Elder broad pale mantle and one flat status medallion (C). They share families, not identical full silhouettes. All six are deferred production scope.

## Material and texture route for this renderer

M01 is a visual target, not an assertion that the paintings are obtainable by swapping four maps. The installed Three.js material and [official MeshToonMaterial documentation](https://threejs.org/docs/pages/MeshToonMaterial.html) support color and normal maps; the material has no standard roughness/metalness inputs. The current rider sets neither surface map nor UVs. Stock map support does not mean the local mesh or custom shader hooks are already ready.

| Detail | Representation and reason |
|---|---|
| Face planes, eyelids, nose, hands, primary hair masses | Geometry: affect silhouette and expression. Retain current bones; use grouped fingers rather than a new hand rig. |
| Chiton silhouette, shoulder fold, overlap, hems, sandal straps | Geometry for visible edges and thickness; large folds receive lighting rather than painted directional shadows. |
| Scale panel | Three to five broad geometric/normal-defined rows where exposed; simplify hidden rows. No dense individual micro-scales. |
| Dyes and broad value grouping | Existing vertex-color recipes, with neutral texture modulation. Color-only changes must not rebuild geometry or reset cloth. |
| Linen weave, leather variation, quiet wear, insignia | Low-contrast painted base color; no baked directional sun or permanently painted saddle shadow. Fixed-color materials use separate atlas regions. |
| Weave relief, scale bevel, broad leather crease, pin emboss | Small normal detail only when it survives real camera scale. Geometry handles silhouette; do not normal-map everything. |
| Cloth/scale/metal response | P1 starts with current toon response plus maps. A rider-local material-class attribute may gate a small broad highlight/fill adjustment if needed. This is a scoped shader experiment, not physically based metalness. |
| AO | Optional later static cavity detail only, with a valid supported UV channel. Never bake moving garment/skin or saddle contact shadows into albedo. Omit from first proof. |
| Roughness and metalness | Do not deliver unused maps as though supported. Author/export only if a later approved material actually consumes them. A full MeshStandardMaterial migration is not in this plan. |

Minimal implementation path: extend `SkinBuilder` with stable UV data, preserve vertex recipes and skin attributes, add local atlas references to `riderMaterial`, and add a conventional UV attribute to cloth only where stock map sampling is used. Preserve `dwUv` for existing patterns. Avoid global changes to `applyPainterly`; chain existing glow, creature-light and fog hooks, with distinct program cache keys for added shader variants. Verify derivative/tangent-space normal behavior on skinned and double-sided moving cloth before enabling it broadly. Disable normals when the cost or shimmer outweighs the improvement.

### UV and authoring specification

Use deterministic component atlas regions with a neutral reserved tile for legacy geometry. Do not project one atlas over the entire procedurally assembled character. Allocate regions for cloth panels, skin/head/hands, scales, leather and small bronze details; exact packing follows measured surface area. Share panel conventions across builds and modular parts. Deformation comes from skinning; UVs are stable in bind construction and should not crawl during animation.

Propose approximately **256–384 texels per meter at 1K** for visible garment/gear surfaces, within about 20% across interchangeable parts; prioritize the face/hands at up to 2× only if the Stable camera demonstrates need. These are trial densities, not a promise that all geometry fits before an unwrap. Compare a checker on all builds and matched screenshots of 1K versus 2K with identical shading.

Put seams at inner arms/legs, under wraps, behind ears and along real garment seams. Keep the face centerline and hero shoulder fold clean. Share/mirror only truly symmetric blank regions; keep insignia, asymmetric sash/drape, deliberate wear and readable text unique. Preserve mirrored tangent handedness or use unique UVs for the normal-mapped region. Pad islands by **8–16 pixels at 1K**, scaled proportionally at higher resolution; dilate border colors/normals through mip levels. Very small distant mip levels still need testing and conservative color neighbors.

Base-color images use sRGB; normal/mask data remain linear/non-color. Author base color without directional lighting. Start with one 1K shared base-color atlas and an optional shared normal atlas; use a vertex material-class attribute before spending a third texture on masks. Stable atlas addresses and shared immutable textures let many looks reuse memory. Package source art, generated atlas recipe if procedural, exports and conversion settings locally; never download runtime textures or models from a third party.

### Texture cost comparison

Calculated RGBA8 GPU storage, square maps with full mip chains; rounded MiB, excludes geometry, framebuffers, decode copies and driver overhead. Formula: width × height × 4 bytes × approximately 4/3. PNG/JPEG download size does not equal GPU storage.

| Atlas size | One RGBA8 map | Two maps | Three maps | Decision |
|---|---:|---:|---:|---|
| 1024² | 5.33 MiB | 10.67 MiB | 16 MiB | First proof; Low can use base color alone. |
| 2048² | 21.33 MiB | 42.67 MiB | 64 MiB | Compare for close Stable views only; four times 1K storage. |
| 4096² | 85.33 MiB | 170.67 MiB | 256 MiB | Not justified for the current camera or integrated-graphics target. |

After acceptance, KTX2/Basis compression can reduce resident texture cost. At an illustrative **8 bits per pixel**, one full-mip 1K map is about 1.33 MiB, so three are about 4 MiB; 2K triples are about 16 MiB. Actual format, normal quality, fallback and decode memory depend on device support. The [official KTX2 loader](https://threejs.org/docs/pages/KTX2Loader.html) requires capability detection and a transcoder. Bundle any approved JS/WASM locally for offline use; no CDN dependency. Compression tooling and loader integration are deferred until the first image-quality proof, and need no new package during this phase.

Use mipmaps on surface maps; test anisotropy conservatively on integrated graphics. Keep the existing toon ramp's deliberately smoothed filtering. At distance, suppress fine normal amplitude and secondary wear before altering the pale-drape/banner silhouette. Body geometry LOD is a possible later measured optimization; the existing quality-based cloth detail does not establish a general body LOD system.

### Provisional proof budgets

| Resource | Starting target, subject to measurement |
|---|---|
| Rig | Keep the existing 27-bone structure and contact anchors. No auxiliary bones unless a specific validated need remains. |
| Skinned body plus static clothing | Aim at or below ~16k triangles for the near proof versus 12,170 in the current default. Redistribute detail to face/hands/folds before adding more. |
| Dynamic cloth | Aim at ≤1k visible triangles for the simple near proof, ≤500 in Low, excluding any existing lance banner until its actual branch is inspected. Preserve existing simulation bounds. |
| Draw submissions | One shared skinned body material; target two cloth meshes for the simple look. An equipped lance/banner may add two more. Target ≤6 rider/gear submissions per main pass for P1, excluding shadow/post passes. Rich legacy combinations need their own comparison, not forced removal. |
| Textures | 1K base only on Low (~5.33 MiB RGBA8); base+normal proof on Medium/High/Ultra (~10.67 MiB). Do not allocate separate full atlases per body or dye choice. |
| Frame cost | Trial incremental ceiling of 0.3 ms CPU and 0.75 ms GPU for the rider change on the agreed integrated-GPU reference machine, measured against identical baseline frames. Proposed guardrails, not measured results. |
| Presentation | Evaluate at 720p Low and 1080p Medium, then High/Ultra. Agree frame-rate targets on actual hardware; fixed simulation remains 120 Hz regardless. |

The art pack's clothing/equipment 3k–6k estimate excludes the shared body; it cannot be compared directly to the measured combined rider mesh. Do not promise production limits from either number. Software-browser captures provide appearance and geometry evidence only.

## Save and catalog preservation

The inspected save version is **1**, key `driftwing.save.v1`; the legacy key is `driftwing.save`. The sanitizer validates cosmetic IDs per slot, colors and builds. Unlock handling accepts existing records including slot-qualified keys. `Stable.ts` previews changes, commits with **Save & leave**, and restores entry looks on **Revert** or disposal without commit. These are the current Apply/Cancel equivalents, not an opportunity to redesign the flow.

P1 requires **no save migration** and no public catalog writes. Use an internal development preview selection that does not enter persisted `RiderLook`; verify ordinary boot still resolves the unchanged catalog/defaults. Do not write new preview IDs through `Game.setRiderLook` or the save store.

For a later approved catalog expansion, keep every existing `(slot,id)` mapping identical. Explicit identity mapping: `flight→flight`, `scout→scout`, `courier→courier`, `racer→racer`, `cartographer→cartographer`, `skyknight→skyknight`; all hair/headgear/scarf/cape IDs and earned conditions remain unchanged. Add AN-01/AN-04 IDs only after names and unlock rules are approved. Internal recipe changes are not save-ID renames.

If new face/age/material fields are eventually approved, introduce a separately reviewed versioned migration: absent fields map to `legacy` or neutral values matching the pre-change appearance; all valid old fields and unlocks copy unchanged; unknown new choices fall back to a valid option in their own slot without resetting the player. Keep a recoverable raw pre-migration document before replacing persistent data, plan backward-version handling explicitly, and test corrupt/partial/newer saves. Never map unknown input to the Wanderer merely because it is the new art default. The current sanitizer's behavior must be reviewed before attempting forward compatibility; do not assume it preserves unknown fields.

## Staged implementation and ownership

All stages below are future proposals. Codex owns the consolidated design and feasibility brief. No Claude availability is required. Once authorized, assign one implementing owner per file; another tool may review only after a checkpoint, not edit the same files concurrently.

| Stage | Work and likely affected systems | Checkpoint |
|---|---|---|
| P0 rebaseline | Verify intended Codex worktree, current commit/dirty files, shared guide, and actual lance/attachment branch. Reconcile changes since this snapshot. | Stop on scope conflict; preserve all existing work. Establish non-main branch such as `codex/rider-c02-proof`. |
| P1a representative form | `body.ts`, `garments.ts`, `outfits.ts`, `hair.ts`, local assembly selection and `debug/showcases/rider.ts`; one medium-body Wanderer and ponytail. Keep `rig.ts` dimensions/contact contract unless a demonstrated issue requires review. | Untextured silhouette, face/hands, walk/run and first mounted sit reviewed before surface polish. |
| P1b early mounted proof | AN-04 compact drape/palm wrap/sandal fit in `accessories.ts`, garment construction and existing cloth specs. Touch `Rider.ts`/animator only for a demonstrated fitting issue, not movement redesign. Existing lance is inspected, not rebuilt. | Rein, saddle, thigh, foot, neck and wing clearance across action matrix; no body or gear intersections accepted because the painting looks good. |
| P1c material proof | `meshKit.ts`, `model.ts`, `palette.ts`, narrowly scoped rider material code and possibly `clothRig.ts`; locally bundled 1K surface maps or generated atlas. | Neutral/day/night comparison, dye stability, shader compilation, GPU/CPU/memory measurement; compare normal on/off. No world lighting rewrite. |
| P2 approved customization | Extend verified construction across slight/broad and all existing choices. Catalog/UI/save changes only when their specific new options are approved. | Full combination sample, unlock preservation, preview/revert/save/reload, efficient recolor and disposal. |
| P3 wardrobe expansion | Reviewed internal component recipes, selective mix controls and chosen later roles. | Budget and compatibility signoff per family. Not all eight automatically. |
| P4 cast and companions | Separate brief and scope. | Separate authorization. |

P1 planning allowance: roughly **5–9 focused artist/technical-art days plus 1–2 verification days**, highly dependent on procedural topology/UV effort and integration-branch differences. This is a scoping estimate, not a delivery commitment. New dependencies, imported models or a broad renderer change are not needed to begin the proof and are outside P1.

Before integration, review the checkpoint diff and actual captures on the target commit; record owner, commit and passed/failed/blocked checks in the repository's `docs/AI_HANDOFF.md` once implementation is authorized. This phase's handoff remains outside the repository to respect the no-change instruction. No unreviewed merge into main.

## Future verification plan

| Check | Acceptance and evidence |
|---|---|
| Movement/pose | Idle, walk, run, jump, fall/catch, landing, wave, mount/dismount, takeoff, bank left/right, dive, hard braking and grounded turn. Add reach/throw/anchor/swing/release/recover from actual lance branch. Add climb/kneel only if supported there; atlas QA names do not create gameplay requirements. |
| Contacts | Record near and gameplay views; no regressions in foot placement, saddle sitting, thigh contact, rein grips or mounting arcs. Test slopes against shared analytic geometry. |
| Clearance | Cloth/gear versus hands, face, shoulder, saddle/pommel, inner thighs, dragon neck/eyes and complete wing sweep. Check banner/rope separately and central route/HUD occlusion in both banks. |
| Build/appearance | All three builds; light/medium/deep skin and representative hair colors; all six hair/headgear IDs individually; especially long hair with hood/cap/helm. No scarf/cape/headgear combinations must remain valid. |
| Stress combinations | Long+twin/full/courier-style tails; curls with headbands; braids with hood; cape/drape overlap; plain lowest-cost look; repeated shape changes followed by repeated color-only changes. |
| Persistence | Existing unlocked/locked slots, all saved selections, custom valid colors; Apply/Cancel equivalents, reopening Stable, page reload, partial/corrupt/legacy saves. No preview-only design IDs in persisted data. |
| Rendering | 720p Low, 1080p Medium and representative High/Ultra; near face/full body/gameplay/mounted distance; day/night; 1K/2K same-camera comparison. Inspect mip shimmer, UV seams, aliasing, double-sided cloth normals, compile stalls and material leaks. |
| Performance | Match source commit, camera, viewport, tier, action and warmup; record frame-time distributions, draw calls, triangles, texture bytes and recolor time on actual integrated graphics. Verify stable performance through repeated customization. |

Use the project's commands on the chosen implementation branch. Focused planned command:

```text
npm test -- src/creatures/rider/model.test.ts src/creatures/rider/cloth.test.ts src/creatures/rider/ik.test.ts src/creatures/rider/gait.test.ts src/creatures/mounted.test.ts src/ui/stableModel.test.ts src/ui/unlocks.test.ts src/progression/save.test.ts src/progression/unlocks.test.ts
```

Add target-branch lance/attachment tests when located. Existing rider model tests cover every catalog option's geometry, cloth anchors, in-place recolor equivalence, cloth retinting, build speed and medium height. Mounted tests cover seating, legs and wing sweep across breeds. Cloth tests cover flow, hitches, inertia, colliders and reset. UI/save tests cover fields, slot unlocks, round-tripping and migrations. Add only meaningful new checks for actual changed contracts, UV validity and preview persistence; do not mirror implementation with redundant tests.

Then run `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` as appropriate before integration. Smoke builds the game and exercises the actual loop; the capture run in this review does not substitute for it.

### Checks performed in this phase

| Status | Check |
|---|---|
| Passed | Read repository guidance, architecture, relevant rider/render/UI/save source and test definitions. |
| Passed | Visually inspected all 23 reference images and read requested manifests/specifications. |
| Passed | Seven final unchanged-engine baseline captures; zero recorded browser/console/game errors. |
| Passed | Visually reviewed generated plates; corrected wardrobe hair variants, reusable scale bib and mounted sash in Plate 02 v2; aligned mounted sash/contact wording and removed decorative slogans in final Plates 01/04. |
| Blocked reference | Shared `docs/ART_DIRECTION.md` unavailable at checked locations. User corrections and master used provisionally. |
| Unverified integration | Current lance/grapple branch and its runtime behavior were not present in this checkout. Rebaseline before P1. |
| Untested | Unit suite, typecheck, production build, smoke, offline production boot, real GPU performance, new maps/shader, new model deformation and all motion/option combinations. No implementation was made to test. |
| Not produced | Production mesh, rig replacement, validated technical turnarounds, UV-ready maps or a new renderer proof. Generated images are concepts only. |

## Source map for continuing work

All repository paths below refer to the inspected commit, not a guarantee about a future checkout.

| System | Files and observed anchor |
|---|---|
| Mesh/material/recolor | `src/creatures/rider/model.ts:34`, `:60`, `:87`; `meshKit.ts:341`; `palette.ts:148`; `Rider.ts:162`. |
| Body/rig | `src/creatures/rider/body.ts:206`, `:223`; `rig.ts:109`, `:173`; `animator.ts`, `ik.ts`, `gait.ts`. |
| Wardrobe/hair | `src/creatures/rider/outfits.ts:22`, `garments.ts`, `accessories.ts`, `hair.ts:61`, `headgear.ts:16`. |
| Cloth | `src/creatures/rider/cloth.ts`, `clothRig.ts:89`, `Rider.ts` collider/quality handling. |
| Catalog/schema | `src/core/types.ts` RiderLook; `src/cosmetics/catalog.ts:30`, `:115`, `:162`. |
| Stable | `src/ui/stableModel.ts:33`, `:120`; `src/ui/Stable.ts:134`, `:151`, `:158`. |
| Saves/unlocks | `src/progression/save.ts:18`, `:21`, `:144`; `src/progression/unlocks.ts`; `src/ui/unlocks.ts`. |
| Renderer | `src/render/painterly.ts`, `quality.ts`, `renderer.ts:92`; `src/creatures/wyvern/shading/light.ts` shared rider lighting hooks. |
| Runtime contracts | `src/game/Game.ts:37`, `:230`, `:342`; `src/game/contracts.ts`; `src/player/poses.ts`, `tuning.ts`. |
| Capture tools | `scripts/shot.mjs`, `scripts/smoke.mjs`, `src/debug/params.ts`, `src/debug/showcases/rider.ts`. |

The next authorized action at handoff is **user review**. Implementation remains paused at the user's explicit concept gate.
