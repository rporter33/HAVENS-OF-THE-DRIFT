# Rendering and Review

- [Painterly material pipeline](../../src/render/painterly.ts) — existing toon ramp and rim-light implementation.
- [Renderer source](../../src/render/renderer.ts).
- [Architecture overview](../../ARCHITECTURE.md) — shared uniforms, fog and rendering boundaries.
- [Region editor art review](../../docs/qa/REGION_EDITOR_ART_REVIEW.md) — scene and world art findings.
- [Blender asset study lessons](../Lessons%20Learned/LESSONS_LEARNED_BLENDER_ASSET_STUDIES.md) — EEVEE study setup and the limits of static masks and outlines.
- [Art style guide](../Guides/art-style/README.md) — visual acceptance cues.

Blender EEVEE studies are useful for look development; the game's renderer uses Three.js/WebGL 2. Check runtime behavior in the game before treating Blender results as evidence of browser output.
