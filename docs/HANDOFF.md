# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19 (third session): G12a's parts and distance models

- **Objective:** finish gate G12a (Q47). Build the white elder's five parts on the fitted body, inside the 2,000 to 4,000 triangle allowance, each riding existing bones. Then build the LODs below the bare body, at budgets set in the gate. Nothing visible before G12b.
- **Branch:** `gate/g12a-white-dragon`, continuing from `223e5fd`, which adds to [PR #15](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/15). The gate branch is checked out in the main checkout, so this session committed on `g12a-parts-lods`, a worktree branch that fast-forwards it.
- **Completed:**
  - **Parts:** `scripts/blender/dragon_parts.py` builds the white elder's set from the archived `white-dragon-parts.png`. It was run through the Blender MCP and wrote `src/assets/dragon/white-dragon-parts.glb` (230 KB), one mesh per piece and LOD. The pieces:
    - branching horns (the head);
    - two 3.6 m whiskers (the head; strand coordinates and rest nodes for G12b's verlet hang, no bones);
    - swept cheek fins (`fanL` / `fanR`);
    - seven dorsal spines down the nape and a nine-tooth tail fin, both weighted as the hide beneath them.

    LOD0 is 2,314 triangles and LOD1 698. LOD2 keeps the horns only, at 68. `creatures/dragon/parts.ts` parses the file. Each catalog option now names its pieces (`catalog.ts`).
  - **LODs:** the budgets come from the model budgets guide and are recorded in the gate. LOD1 is 4,000 to 5,000 bare and up to 6,000 with parts; LOD2 is 1,000 to 1,300 bare and up to 1,500. They're in `DRAGON_LOD_BUDGETS` (`asset.ts`). The fit script's new `make_lod` and `export_lods` decimate the fitted body and wings and copy the shader attributes from the nearest LOD0 vertex. They wrote `white-dragon-lod1.glb` (4,500 triangles, 305 KB) and `-lod2.glb` (1,270, 94 KB).
  - **Register:** `white-dragon-meshy-body` lists the LODs, and there's a new `white-dragon-parts` entry. The master `white-dragon-pilot.blend` now holds the parts and LOD copies; it was re-saved, and its new SHA-256 is in the register.
  - **Docs:** [the white dragon](design/WHITE_DRAGON.md) has the G12a status, [the parts](design/WHITE_DRAGON.md#the-parts) and [the distance models](design/WHITE_DRAGON.md#the-distance-models). The gate's acceptance names the LOD budgets.
- **Tests,** run on the working tree before commit:
  - typecheck clean;
  - vitest 134 files, 1,431 tests, against 133 and 1,412 before. The dragon's 70 include 19 new: the parts tests (`parts.test.ts`), per-LOD body tests in `asset.test.ts`, and a catalog test;
  - the production build succeeds, and nothing from `src/assets/dragon/` reaches `dist`;
  - smoke 15/15, run as `vite build` then `node scripts/smoke.mjs --no-build` with `CHROMIUM_PATH` set to Edge, as last session.
  - The final parts script was re-run to a scratch file, and its output matches the committed GLB byte for byte.
- **Visual checks,** all in Blender solid-shaded renders, bind pose only:
  - the parts against the parts sheet, side and front;
  - the parts from above and three-quarter, and with back-face culling (no inward faces);
  - LOD1's parts on LOD1's body;
  - both LODs beside LOD0, side and top.

  Not checked: LOD2's horns on LOD2's body, any posed or animated frame, the game's shaders, and anything at gameplay distance. Nothing draws the dragon yet.
- **Known issues:**
  - At LOD2 the wings' trailing edge shows the membrane's underside from above in places.
  - The flight palette has no horn colour. The parts use the hide shader's horn region and fin membrane, and the kit names "pale bone ivory" without a value, so G12b maps it.
  - The parts sit on LOD0's surface, and on the thinner LODs they aren't measured against the body.
  - The variant sheets aren't built; each is a later builder and catalog option.
  - Carried over: the fit's limits (wing-root stubs, a flatter flank under the membrane's root, bind pose only). PR #11's Harrier trial isn't on main. The decision log is still forked across branches (Q37 to Q46).
- **Decisions:** Robert accepted Q50's recommendations the same day ("im okay with reccomendations, continue"). The size, the wing's source and the membrane's root stand as built, so nothing was rebuilt.
- **Next authorized action:**
  - Robert reviews [PR #15](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/15), the parts and LODs included. `gate/g12a-white-dragon` was fast-forwarded to this session's commit and pushed.
  - Then G12b's resting showcase, which loads the body, the LODs and the parts.
