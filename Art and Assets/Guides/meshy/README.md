# Meshy — primary generation and Blender handoff

[Back to guide index](../README.md)

Robert selected Meshy as the primary 3D generator on 2026-10-14 because it was giving him better results. This records his workflow choice, not a comparative benchmark. Keep [historical Tripo guidance](../tripo/README.md), source filenames and study provenance intact.

Official sources below were checked on 2026-10-14. **Documented features** describe those sources; **project recommendations** describe how to use them for Dragon Circuit. Availability, labels and models can change. Record the actual UI or API route and model/version used; do not assume parity. For example, the UI tutorial names Meshy 7, while the [Multi-Image API](https://docs.meshy.ai/en/api/multi-image-to-3d) currently names `meshy-7.1` / `latest`. Preserve the resolved version where exposed; otherwise record that it was not exposed, rather than guessing what `latest` meant.

## Project workflow

Meshy generation → anatomy/silhouette review and any needed remesh → Blender cleanup, fit, rig/flight animation and material verification → editable `.blend` master plus a GLB handoff candidate when export is authorized.

Preserve broad smooth forms, matte color regions, soft three-band cel shading, selective outlines and separate customization pieces. Follow the [art style](../art-style/README.md), [base prompts](../base-model-prompts/README.md), [customization contracts](../customization/README.md) and [existing exploratory budgets](../model-budgets/README.md). No new numerical budget is established here.

The [female study lessons](../../Lessons%20Learned/LESSONS_LEARNED_BLENDER_ASSET_STUDIES.md) remain the practical Blender baseline. Reuse the studio and shading core, rebuild asset-specific masks, preserve originals, and reopen the saved master independently. That study supplied no rig or animation and did not verify export, LODs, clearance or runtime performance. Its world-space masks need a stable rest/local-coordinate or UV approach before reuse on moving assets; its repair coordinates are female-specific.

## References and generation

**Documented features:** the dedicated [Multi-View best practices](https://help.meshy.ai/en/articles/16102789-meshy-multi-view-best-practices-angles-and-images) describes up to four views of one subject and warns that inconsistent extra views can be worse than one good image. Keep subject, pose, scale, style, lighting and framing consistent.

The [general Image to 3D guide](https://docs.meshy.ai/en/webapp/image-to-3d) lists 2–8 images in its settings table, while the dedicated September tutorial below and the Multi-Image API describe up to four. These documents differ; they do not establish one universal cap across all modes/versions. This guide uses the conservative up-to-four-view workflow documented by the dedicated tutorial/API. Verify the selected UI mode/model or API endpoint's current limits and record them before an authorized generation task.

The [Multi-View tutorial](https://www.meshy.ai/tutorials/multi-view-image-to-3d) documents **High Detail + Multi-View, then Remesh** when lower-density topology is needed: Multi-View is unavailable in **Smart Topology** mode. It also supports a pre-composited turnaround as one main upload. Its September release describes **Multiview Texture as base-color only**, without PBR; this is not a blanket limitation on every Meshy texturing tool or API version.

**Project recommendations:**

- Use an approved, isolated full-body reference with a complete silhouette, visible wing roots, separated feet and a tail clear of the body. Avoid rider/tack, scenery, text, heavy shadows and effects for the base creature.
- Prefer separate consistent views for easier anatomy review. Follow the actual direction labels in the chosen UI; do not assume API image ordering rules are identical.
- Inspect any generated complementary views before using them. Optional image enhancement must preserve the approved proportions, anatomy, palette and identity.
- Confirm **wyvern = two hind legs plus two wing-arms**, and **dragon = four walking legs plus two separate wings**. Neither reference text nor a generator label guarantees the correct body plan.
- Keep the first accepted base version fixed while fitting accessories; regeneration can invalidate proportions and prior fits.

## Geometry and material review

**Documented features:** [Image to 3D help](https://help.meshy.ai/en/articles/9996860-how-to-use-meshy-image-to-3d) separates geometry generation from texturing. [Web Remesh](https://docs.meshy.ai/en/webapp/guides/3d-model/remesh) and the [Remesh API](https://docs.meshy.ai/en/api/remesh) offer triangle or quad-dominant output; a requested target is not proof of the resulting triangulated count. [AI Texturing](https://docs.meshy.ai/en/webapp/guides/3d-model/ai-texturing) documents Remove Lighting and optional PBR maps. Verify the actual maps delivered by the selected mode/version.

**Project recommendations:**

1. Inspect the white/clay mesh before textures: limb count, silhouette, wing membranes/roots, feet, face, tail, disconnected pieces and unwanted fused surfaces.
2. Preserve the raw download. Complete necessary remesh/topology work before texturing, skinning or fitting accessories; recheck thin membranes, joints and silhouette after every change. Prefer local repairs when a global remesh would damage accepted anatomy.
3. In an isolated Blender file, audit units/axes, evaluated triangles, normals, boundaries, UVs, material regions, textures, armatures, weights, actions, shape keys and modifiers. Preserve useful supplied data; never infer its presence from the export format.
4. Keep broad colors editable through stable masks/UVs or material regions. Remove Lighting is useful where offered, but inspect for remaining baked shadows/highlights. Extra PBR maps or large textures are optional inputs, not requirements for this matte cel-shaded direction.
5. Fit horns, crests, tail ornaments and tack as separate named pieces with deliberate Blender origins and attachment frames. Keep the underlying body closed. Meshy's [Auto Split](https://docs.meshy.ai/en/webapp/guides/3d-model/auto-split) targets printable parts; it does not establish game sockets, interchangeable fits or deformation contracts.

## Rigging and fantasy flight

**Documented features as checked on 2026-10-14:**

| Route | Documented scope | Limit relevant to this project |
|---|---|---|
| Web UI | Humanoid, Quadruped and Smart Rig (Beta) | Quadruped animation currently offers walking only. Smart Rig cannot use Meshy's animation library. |
| Rigging API | Standard textured humanoid bipeds with clearly separated limbs/body | Non-humanoid and untextured assets are listed as unsuitable; UI categories do not establish API support. |

Sources: [Auto Rigging UI help](https://help.meshy.ai/en/articles/16231707-how-to-create-3d-animation-with-auto-rigging), [Rigging API](https://docs.meshy.ai/en/api/rigging).

**Project recommendation:** custom Blender rigging, weights and flight animation remain required for the fantasy-flight handoff unless the actual required behavior is separately demonstrated. Smart Rig Beta can be an optional experimental input during an authorized asset task; it is not a wing-arm/six-limb or game-compatibility guarantee. Test neutral pose, wingbeat extremes, fold, bank, takeoff/landing, tail and saddle/rider clearance. Retain the raw rig and record edits.

The current [wyvern rig](../../../src/creatures/wyvern/rig.ts) has two hind-leg chains and two wing chains; the [animator](../../../src/creatures/wyvern/animator.ts) drives procedural flight, ground contacts and life motion. A generated skeleton or animation clip does not automatically replace these contracts. Four walking legs plus separate wings need their own integration assessment.

## Blender master and GLB candidate

**Documented formats:** Meshy supports GLB and FBX import into Blender; GLB embeds textures, while other exports may require companion files. See [Export & File Formats](https://docs.meshy.ai/en/webapp/guides/platform/export-formats).

**Project handoff recommendations:**

- Keep raw source files and companion textures, an ordinary editable `.blend` master, matched front/side/three-quarter previews, a provenance/QA record and unresolved issues. Reopen the master in a separate process and verify active scene, packed/relinked resources and a check render.
- When export is in scope, supply a GLB candidate and exact export settings. Reimport it independently to check geometry, normals, UVs/materials, skeleton/weights, clips, modular names and attachment transforms. Measure exported triangles/materials/textures/bones rather than relying on requested settings.
- Resolve scale and axis conversions explicitly. The [project body frame](../../../src/core/types.ts) is +Z forward, +Y up, +X left; verify Blender import/export orientation and units instead of copying a vendor axis preset blindly.
- EEVEE Shader to RGB and Line Art do not automatically become browser cel shading/outlines through GLB. Verify the material mapping against the existing painterly renderer in any separately approved integration.

The current creature implementation is procedural. A `.blend` or GLB delivery does not establish a runtime loader, compatible rig, saved cosmetics, flight behavior or hardware performance. Runtime adoption requires a separate approved task and representative gameplay-camera evidence.

## Provenance record for the next authorized asset task

Record approved reference paths/hashes and input rights; generation date; generator and UI/API route; actual model/version, task ID where available, prompts/settings; raw download paths/hashes and formats; Blender version/changes; master/export paths and settings; measured counts; QA evidence and outstanding limits. Keep earlier Tripo attribution unchanged.

Record the plan/license and sharing choice that applied when generating. The [Meshy terms](https://www.meshy.ai/terms-of-use) describe free output under CC BY 4.0 with attribution, paid output ownership to the extent permitted by law, and Community-published output under CC0. They also permit non-Enterprise input/output training use unless otherwise agreed; private visibility alone is not a no-training commitment. This source summary is not asset-specific rights clearance. Do not publish project assets to Community as part of a routine export.

This documentation update authorizes no generation, vendor upload, credit spend, account change, asset replacement or publication.
