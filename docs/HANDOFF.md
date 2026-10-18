# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18: G3b Meshy Harrier in game (dev-only trial)

- **Objective:** gate G3b (Q38): the Harrier's body from Robert's Meshy model, altered to fit the existing rig, 75% Meshy shape and 25% the old Harrier (his call), looking natural.
- **Branch:** `gate/g3-harrier-visual` (PR #11, draft), stacked on PR #10.
- **Completed:**
  - `scripts/blender/harrier_meshy_fit.py` (runs in Blender 5.2 on Robert's PC): cleans the raw Meshy mesh (wings cut at the body, closed, 10,500 triangles), weights it to a landmark copy of the game skeleton, conforms it bone by bone to the game rig's lengths with girth 75% Meshy / 25% game envelope, copies the shader's region and pattern attributes from the game skin, keeps the game's wings, tack, horns, spines and eyes and reseats them on the new surface, seats the eyes in the Meshy sockets, and exports a GLB in the game's bind space.
  - `src/creatures/wyvern/trial.ts` + `?wyvernTrial=meshy`: the trial GLB binds by bone name to the procedural rig (animator, IK, sockets and collision unchanged); seat, holds and eye uniforms follow the fit. `geometry.ts` shares its AO setup (`finishGeometry`) with the trial; procedural output unchanged.
  - Asset `src/assets/wyvern-trial/harrier-meshy.glb` (1.4 MB, 23,510 triangles with membranes, under the 24,000 LOD0 ceiling); raw Meshy GLB, Astra views and Blender renders on branch `archive/g3b-meshy-trial`; register entry `harrier-meshy-trial`.
- **Tests:** typecheck clean; vitest 129 files, 1,363 passed (new `trial.test.ts`); smoke 15/15. Reference-GPU fps not measured.
- **Evidence:** `shots/g3/trial/` and `shots/g3/g3b-harrier-compare.png` (ignored), from `scripts/g3b-capture.manifest.json`.
- **Known issues:** shape cosmetics (horns, frill, tail tip, saddle variants) are baked at their defaults in the trial; the headstall strap floats slightly over the slimmer skull; the saddle sits 0.29 m higher with the deeper back; the target's large wings and deep chest are not addressed (the wings stay procedural).
- **Next authorized action:** Robert reviews the trial (`?wyvernTrial=meshy`) against targets 01 and 02 and says what to change; promoting it past a dev-only trial needs his acceptance.
