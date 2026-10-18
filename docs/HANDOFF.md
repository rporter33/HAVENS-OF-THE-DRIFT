# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18: G3 Harrier, first code pass and Blender pilot

- **Objective:** gate G3 (Q37): move the Harrier toward target renders 01 and 02 by two methods at once, a code pass on materials and shading and a Blender pilot kept out of the game.
- **Branch:** `gate/g3-harrier-visual`, stacked on `art/astra-targets-2026-10-17` (PR #10, not yet merged).
- **Completed (code pass, `src/creatures/wyvern/`, `src/cosmetics/catalog.ts`):**
  - Harrier palette olive-moss `#586e46` over a dark olive mantle `#2d3a28`, amber sails `#e89a40` (was emerald `#3f7d5a`, `#23453b`, `#d89a5a`).
  - Lit hide and tack keep 70% and 78% of their chroma (`CREATURE_LIGHT.hideChroma`, `tackChroma`): golden-hour light had pushed the coat to emerald and the leather to orange.
  - The saddleback mantle stays on the back (30% on limbs) and is a step lighter (0.75 of the primary); the wing-arm no longer reads as a black slab from the side. Harrier chevrons are softer.
  - Brown leather tack `#7a5232` with an undyed linen pad, paler horns and spines, a faint daytime eye glow, warmer upper wing faces and shallower folded-wing pleats.
- **Completed (Blender pilot, Robert's machine):** the in-game Harrier exported to GLB (`scripts/wyvern-export-glb.mjs`), carried over on the orphan branch `archive/g3-blender-pilot`, imported into Blender 5.2 with node materials (scale cells, cream belly, translucent amber membrane), one subdivision level, a golden sun and a limestone terrace. Files: `C:\Users\Robert\Projects\havens-blender-pilot\` (`harrier-pilot.blend`, `pilot-01-harrier-portrait.png`). Not in the game.
- **Finding:** both methods close the color and material gap; neither closes the form gap. The render's Harrier has a shorter, finer head than the game's long snout, long swept horns, a deep chest and much larger wings whose membranes stay visible when folded. Matching it means reshaping the creature (proportions and parts), which the code pass and the Blender re-shade of the game mesh both leave unchanged.
- **Tests:** typecheck clean; vitest 128 files, 1,361 tests passed; smoke 15 of 15 checks passed. Performance on the reference GPU not measured (SwiftShader only); the shader change is a handful of ALU ops.
- **Evidence:** `shots/g3/` (ignored): before/after captures from `scripts/g3-capture.manifest.json`, palette trials, `g3-harrier-compare.png`.
- **Next authorized action:** Robert chose a new model (Q38) and opened G3b. He makes the Astra turnaround and the Meshy generation with the [Harrier model kit](../Art%20and%20Assets/Creatures%20and%20Customization/HARRIER_MODEL_KIT.md) and drops the files in `havens-blender-pilot`. Claude then fits the body in Blender and builds the dev-only `?wyvernTrial=blender` loader.
