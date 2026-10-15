# Tripo — historical geometry-first settings

[Back to guide index](../README.md)

**Historical guidance:** Robert switched to [Meshy as the primary generator](../meshy/README.md) on 2026-10-14. Keep this page and original Tripo filenames/source records for provenance and earlier assets. Do not translate these control names or settings into Meshy defaults.

The recommendations below are preserved from the user-supplied Tripo screenshot and official guidance checked during the 2026-10-13 discussion. Labels, available models and plan features may change.

| Control | Recommended first trial |
|---|---|
| Mode | Smart Mesh with an approved isolated reference image |
| HD alternative | H3.1 if the low-poly result loses important anatomy |
| Ultra Mesh Quality | Off where available |
| Texture | Off until anatomy is accepted |
| Topology | Triangle for an explicit game triangle budget |
| Polycount | Wyvern base 14k–16k; six-limbed dragon base 16k–20k; dressed rider 8k starting point |
| Generate in Parts | Off for the first connected creature body |
| 8K Texture | Off |
| Pose | Neutral, symmetrical and suitable for inspecting attachments |
| Privacy | Inspect the actual sharing option; “Sharing Only” is not proof of private visibility |

These controls may differ in Smart Mesh. Use the polygon control rather than relying on a number in the prompt. Verify the actual export count. Quad output can support editing, but does not guarantee clean joint deformation and must be counted after triangulation.

## Reference preparation

Use one creature alone, full body, clear tail and separated feet, with wings open enough to show roots and membranes. No rider, saddle, scenery, captions, heavy shadows or ink outlines. Keep broad colors and minimal surface texture.

Use multiple views only if they depict the same proportions and anatomy. Generated turnarounds may contradict one another. The mounted Harrier-and-rider beauty render is a style reference, not an ideal generation input.

## First-pass review

1. Check exact limb count and body plan.
2. Inspect wing-root separation, continuous membranes, feet, face and tail.
3. Reject fused limbs or missing surfaces before texturing.
4. Bring the accepted mesh into a separate Blender study.
5. Check bends and accessory clearances before rig approval.
6. Add restrained colors and a shader after geometry approval.

Do not repeatedly regenerate an accepted base while fitting accessories: proportion changes invalidate prior fits. Keep the chosen version and iterate locally.

Tripo's “game-ready” language is not evidence that a mesh matches this game's rig, cloth, customization, IDs or animation contracts. Auto-rigging does not establish that compatibility.

Sources: [Smart Mesh tutorial](https://www.tripo3d.ai/blog/smart-mesh-tutorial), [H3 generation parameters](https://docs.tripo3d.ai/model-generation/text-to-model-v3-0-v3-1.html).
