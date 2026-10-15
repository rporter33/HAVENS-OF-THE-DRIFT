# Dragon Circuit — asset authoring guides

[Back to Art and Assets](../README.md)

Updated 2026-10-14. These guides capture Robert's selected cel-shaded visual direction and the proposed workflow for one customizable wyvern and one six-limbed dragon. **Meshy is now the primary 3D generator**, following Robert's switch from Tripo; existing Tripo assets and study records retain their provenance.

## Read the guide you need

1. [Art style and visual acceptance](art-style/README.md)
2. [Triangle budgets and export checks](model-budgets/README.md)
3. [Meshy generation and Blender handoff](meshy/README.md) — current workflow
4. [Wyvern and dragon base-model prompts](base-model-prompts/README.md)
5. [Modular customization and compatibility](customization/README.md)
6. [Sol and Blender workflow, including a reusable prompt](sol-blender/README.md)

[Historical Tripo settings](tripo/README.md) remain available for earlier sources, not as Meshy settings.

## Current authoring workflow

Meshy generation → geometry review and any required remesh → Blender cleanup, modular fit, custom rig/flight animation and material verification → editable `.blend` master plus GLB handoff candidate. Preserve raw downloads and record actual UI/API model versions and settings. The [Meshy guide](meshy/README.md) separates documented vendor features from project recommendations.

The existing [female Blender study lessons](../Lessons%20Learned/LESSONS_LEARNED_BLENDER_ASSET_STUDIES.md) remain applicable: reuse the shading core and studio, rebuild asset-specific masks, and preserve the completed study. That static study has no verified rig, animation, export or runtime performance.

## Status and boundaries

- **Selected visual direction:** broad, readable forms; matte colors; soft three-band cel shading; selective outlines; simple coordinated environments.
- **Proposed authoring scope:** one reusable wyvern body and one reusable four-legged dragon body, with separate accessories.
- **Provisional:** triangle budgets, material counts, attachment designs and exact shader tuning.
- **Not established:** production-ready replacement meshes, six-limb runtime support, automatic reuse of the wyvern rig, or measured browser performance.
- Prior Blender stills used actual Harrier geometry and a mounted PR11 rider snapshot from revision `8e055069703c83308d5508ee72e5ad1d15ef348e`. They were separate studies, not live gameplay verification. Those local render files and .blend binaries are not uploaded by this documentation change.

Read [AGENTS.md](../../AGENTS.md), [architecture](../../ARCHITECTURE.md) and the [shared visual guide](../../docs/ART_DIRECTION.md) before implementation. Existing documents still use the Driftwing project name; this package does not rename the game or rewrite its canon. This documentation grants no authority to replace assets, alter gameplay, merge or deploy.

## Source baseline

Original guide inspection: `81761be3a4ce53ee1c90cdd9957a3171fe704a8a`. Meshy documentation update inspected Dragon Circuit main `e0badf624409c64590e4faa4562d4ca328d18d55` on 2026-10-14: [cosmetic catalog](../../src/cosmetics/catalog.ts), [original triangle budgets](../../src/creatures/wyvern/parts/res.ts), [wyvern rig](../../src/creatures/wyvern/rig.ts), [animator](../../src/creatures/wyvern/animator.ts), architecture and art references. The current creature path is procedural; a GLB candidate is not a verified runtime replacement. Recheck the implementation before integration.
