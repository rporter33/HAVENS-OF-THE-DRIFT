# Lessons learned: Dragon Circuit Blender asset studies

Written 2026-10-14 after the female wyvern tail-cleanup study. Read this before the male wyvern, the two dragons, or accessories. This is a practical handoff, not authorization to begin those assets or integrate them into the game.

## Start from the completed work

Workspace: `C:\Users\Robert\Documents\ChatGPT\Dragon Circuit`.

The study resources below are workstation files, not files included with this documentation upload. Their paths are relative to that workspace. For repository art authority, also read the [shared visual guide](https://github.com/rporter33/Dragon-Circuit/blob/main/docs/ART_DIRECTION.md); this handoff records an offline study and does not replace that guide.

| Resource | Location relative to this workspace | Use |
|---|---|---|
| Saved editable female study | `ArtStudies/Wyvern_TailCleanup_v01/DragonCircuit_FemaleWyvern_TailStudy.blend` | Reuse the studio, palette organization and toon group. |
| Visual review | `ArtStudies/Wyvern_TailCleanup_v01/REVIEW.html` | Matched views, original extra tail, repaired root and beauty render. |
| Artist notes | `ArtStudies/Wyvern_TailCleanup_v01/STUDY_README.txt` | Controls, provenance and unresolved issues. |
| Measurements and changes | `ArtStudies/Wyvern_TailCleanup_v01/reports/inspection_and_changes.json` | Source and final geometry facts; exact reference paths and hashes. |
| Saved-file check | `ArtStudies/Wyvern_TailCleanup_v01/reports/saved_file_verification.json` | Separate-process reopen, actual evaluated triangle counts and packed images. |
| Authoring history | `ArtStudies/Wyvern_TailCleanup_v01/scripts/` | Examples of the repair and inspection techniques; **not generic scripts to replay on new models**. |

The user responded positively to the female study. It is a useful working lookdev baseline. It has no rig or game-readiness verification. The approved Harrier-and-rider study was **not supplied** during this work; do not claim that it was matched.

## The quickest reliable workflow

1. **Identify the exact source and references first.** Record the path, extension, hash and a quick visual check. Confirm conflicts before editing. Inspect headers and file inventories before loading several unrelated candidates into the live Blender session.
2. **Preserve the source and establish an isolated working file.** Record the live Blender file and active scene. Keep a source copy and an untouched baseline. Use a new study folder per asset; preserve the completed female study.
3. **Audit before editing.** Report dimensions and units, evaluated triangles, disconnected sections, boundaries/nonmanifold edges, materials/textures, UVs, armatures, weights, actions, shape keys, modifiers and any attachment/customization contracts. Inspect the geometry as well as the numbers.
4. **Resolve anatomy and silhouette in neutral clay.** Verify limbs, tails, wing attachment and proportions before spending time on eyes, color masks or lighting. Repair the local defect before considering a global topology operation.
5. **Reuse the existing studio and toon group.** Append those data blocks into the new isolated study. Start from the supplied asset's proportions and colors. Build or adapt that asset's region masks separately.
6. **Render matched front, side and three-quarter views early.** Use inexpensive resolution for iteration. Inspect actual images, correct visible problems, then render the final matched set and beauty. Add focused root/joint/accessory views where needed.
7. **Save an ordinary `.blend` and reopen it independently.** Confirm the intended active scene, camera, references, material and evaluated counts. Render a small check from the reopened file.
8. **Deliver an understandable handoff.** Include the editable file, previews, provenance, counts and unresolved issues. Say whether the live Blender window is showing that saved file or a separate unsaved working session.

## Source selection: a filename or extension is not enough

The initial request referred to a GLB, but the user ultimately confirmed this matching FBX:

```text
C:\Users\Robert\Pictures\Dragon Circuit\Wyvern\Models\Female+Wyvern+Model+-+extra+tail\tripo_convert_6b4e1203-1ad1-4f27-8d8d-2f173c0db17f.fbx
```

Other GLBs in Downloads were different designs. The matching FBX had **no materials, textures, UVs, rig, weights or animation**. Its taupe/cream palette therefore had to be proposed from the supplied PNGs. Do not assume the next asset has the same omissions; preserve whatever its source actually supplies.

Blender MCP initially could not connect, then connected successfully. Check add-on status and the live scene before deciding that installation or configuration changes are needed. The successful study used Blender **5.2.2 LTS**; this is recorded evidence, not a guarantee about the next session's environment.

## Local geometry repairs preserve more than global remeshing

The female had a trailing rear tail and an erroneous downward tail between the legs. The front concept also showed the downward shape, while the side concepts established the desired rear tail. The user's explicit removal instruction resolved that reference conflict.

The successful repair isolated the unwanted connected branch below a **29-edge section**, removed **231 vertices**, and closed the root with two inset rings and a rounded center patch. The rear tail, legs and wing surfaces were preserved. A named vertex group records the patch.

The cut height, spatial limits, vertex counts and assertions in `build_study.py` are **specific to this female mesh**. Derive a fresh section on the male or either dragon. Do not reuse these coordinates as a universal tail-removal tool.

Use global voxel remeshing or decimation only when the asset and authorized objective justify their effects. Thin wing membranes and deformation surfaces can be damaged before a round polygon target is reached. Preserve the original rig, weights and shape keys when supplied; topology-changing repairs require a deliberate preservation strategy.

The female's reversible smoothing modifier uses factor **0.15**, **2 iterations**, and a vertex group excluding sensitive surfaces and open boundaries. Maximum measured displacement was **0.001970 source units**. This is a starting example, not a universal setting. Measure changes and disclose them; source units were not confirmed as real-world scale.

## Material lessons that avoided repeated visual fixes

**Keep the shared shading core; rebuild asset-specific masks.**

The reusable node group is `DC | Soft three-band toon - controls`. The asset material is `DC | BASE - editable broad-region masks`. Palette nodes along the top control the broad regions; the group exposes the three values, two thresholds and softness.

| Control | Female study value |
|---|---:|
| Shadow value | 0.68 |
| Middle value | 0.85 |
| Light value | 1.00 |
| Shadow threshold | 0.16 |
| Light threshold | 0.35 |
| Band softness | 0.035 |

Binary material assignment by face produced jagged chest, cheek and tail borders. Interpolated vertex masks also broke the iris into visible triangles. Continuous shader masks produced clean boundaries without adding dense geometry. The eye coloring follows the supplied recessed eye surfaces; no additional eyeball anatomy was constructed.

**Coordinate caveat:** the final region-building script uses `Geometry.Position` and `Geometry.Normal`. Those are study-space/world-space inputs, despite earlier notes loosely calling the masks “object-coordinate” masks. The female is a static lookdev study. Moving, scaling or deforming a new asset can misalign this approach. For reusable moving assets, choose stable local/rest coordinates or an appropriate UV/mask workflow and verify it. Baking/export/deformation of these materials has not been validated.

The female wing-spar paths, eye locations and toe-tip thresholds are anatomical coordinates specific to that source. Reuse the method, not those literal numbers. Start new assets with a neutral body material, then add broad regions and eyes after the silhouette is sound.

Keep outlines selective. This study uses thin eye-material accents, with no global hull or line pass. Inspect head close-ups and wing boundaries for broken strokes, clutter and intersections.

## Lighting: separate a pale backdrop from illumination

A bright world washed out the three bands and made the model look flat. A diagnostic diffuse/Shader-to-RGB render showed that much of the lighting response was above the thresholds. The fix was to separate the camera background from ambient lighting and recalibrate the lamps.

The saved female studio uses a `Light Path / Is Camera Ray` world mix, a pale camera background, ambient strength **0.10**, and area-light powers **24 / 4.5 / 8** for key/fill/rim. These values were checked for the approximately one-unit female asset and this Blender version. Recalibrate for a different size or studio layout; do not copy the settings and assume the bands will read correctly.

The matched cameras use **1.22-unit orthographic scale** with consistent lighting. For a larger dragon, derive framing from its actual projected bounds, include all wing and tail tips, then keep the review settings consistent. A common camera scale is meaningful across different creatures only when their relative scale is established.

## Separate accessories without opening the base

The two small source brow crests were extracted into `DC_Source_BrowCrest.L` and `.R`. Each retained **67 source exterior triangles** and gained a small interface closure, for **80 triangles each**. They were not redesigned into new horns.

The first extraction revealed two avoidable defects: the generic hole-fill operation skipped a non-planar left interface, and seven orphan wire edges remained on the base. The fix explicitly ordered and closed the skipped loop, removed wire edges, and checked the result numerically and in renders.

**BMesh ordering matters:** removing smoothing weights on the mesh before a later `bm.to_mesh()` can be undone by the BMesh's older deform data. Pin shared interfaces after the final mesh write, or edit the BMesh deform layer directly. Otherwise, a smoothing modifier can pull the base away from a detachable part.

For new horns, crests, tail ornaments and saddle equipment:

- Keep them as separate named objects/collections with useful pivots and material controls.
- Close the base independently so hiding an accessory does not reveal a hole.
- Inspect the visible seam and both attachment surfaces. Avoid coincident shells and cap faces that poke through the exterior.
- Preserve supplied socket names, transforms and rig contracts. Proposed new attachment points must be identified as proposed, not claimed as compatible.
- Check joints, membranes, saddle/rider contacts and wing-fold clearance where the required rig and equipment exist. A still render cannot verify motion clearance.

## Saving: avoid the “Unsaved” window confusion

`bpy.data.libraries.write(...)` was useful for writing an isolated set of scene data without including unrelated inspection scenes. **It writes a library file, not a normal startup document.** Reopening it initially created an empty active scene even though the study data was present.

The delivered file was subsequently converted in a **separate background process**: select the study scene, remove that isolated process's empty/unrelated scene data, and use `bpy.ops.wm.save_as_mainfile(...)`. A second independent reopen verified that it opened directly on the intended study and rendered correctly.

`materialize_saved_files.py` demonstrates this conversion, but it removes other scenes and unused objects. **Do not run it in the user's live Blender session.** It also contains female-specific paths and scene names. `verify_saved.py` contains female-specific count/reference/rig assertions and must be adapted for each new asset, especially a rigged source.

The live authoring window remained unsaved while the separate deliverable was correctly saved. This confused the user. Next time, explain the distinction at handoff or open the final saved study after preserving any live work that needs to survive. Do not discard the user's current unsaved edits to make the window title look correct. Do not overwrite the clean deliverable by saving a cluttered inspection session over it.

## Verified female baseline and its limits

| Measurement | Verified result |
|---|---:|
| Original source triangles | 15,748 |
| Final base triangles | 15,354 |
| Removable crests, combined | 160 |
| Final asset triangles, excluding studio | **15,514** |
| Evaluated bounds, approximately | 0.969238 × 0.999510 × 0.749512 units |
| Original/reference images packed into final study | 3 |
| Rig/animation supplied | None |

The repaired root and both crest interfaces are closed. The source's **351 boundary edges plus 13 other non-manifold edges** elsewhere remain; the report's total `nonmanifold_edges = 364` includes those boundary edges. Do not add the boundary count to 364 again. These inherited head/jaw/membrane constructions were not claimed as production topology.

A final saved-file check evaluated the modifiers, counted actual triangles, verified the packed references and correct active scene, and rendered a small preview. The source FBX hash matched before and after. ZIP CRC and a delivery manifest were also checked. None of this verifies animation, game export, attachment clearance, LODs or runtime performance.

## Apply these lessons to the next assets

| Asset | Reuse immediately | Inspect or establish separately |
|---|---|---|
| Male wyvern | Studio, toon group, review sequence, reporting structure | Exact male source, supplied proportions and colors, anatomy, rig and references. Do not invent sex-specific proportions or ornament. |
| Dragon 1 and Dragon 2 | Shared palette controls, shading core, camera workflow and delivery checks | Each source independently: limb count, wing roots, silhouette, joints, scale and customization. Do not treat a dragon as the wyvern with extra legs added. |
| Accessories | Material core, modular collection pattern, interface checks | Exact design, host asset, placement, pivots/sockets, rig attachment and clearance. |

The female wyvern has **two hind legs and two wing forelimbs**. Establish the intended dragon anatomy from each supplied brief and reference before editing. For a six-limb dragon brief, verify **four walking legs plus two separate wings**; preserve distinct wing roots and saddle clearance. Do not silently transfer the wyvern's anatomical or rig assumptions.

Give each new asset its own source baseline, editable study, preview set and report. Share the validated material core instead of rebuilding it for every creature, but keep palettes and masks independently editable. If geometry is shared across variants, first establish that the sources and rig contracts actually support that sharing.

Keep the same priority order: anatomy/proportions → connected silhouette → rig/deformation/clearance → broad colors/shading → presentation. Preserve originals. No game edits, original overwrites, commits or publication without the user's authorization for that work.
