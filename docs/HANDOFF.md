# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19 (fourth session): G12b, the white dragon's resting showcase

- **Objective:** gate G12b (Q47). Build `?view=white-dragon`, dev-only:
  - render 08's pose on a stand-in platform;
  - the dragon's own driver and idle life;
  - a camera matched to render 08 and a capture manifest;
  - a lineup across the ±8° hue shift;
  - a look at LOD2's wing trailing edge and the parts on the thinner LODs.
- **Branch:** `gate/g12b-white-dragon`, a worktree branch cut from `g12a-parts-lods` (`e4de879`). That branch is one commit ahead of `gate/g12a-white-dragon` and fast-forwards it. Nothing has been pushed, and no PR is open; its base would be `gate/g12a-white-dragon` until [PR #15](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/15) merges.
- **Completed:** all of it is in [the white dragon's G12b status](design/WHITE_DRAGON.md#g12b-status-2026-10-19-fourth-session).
  - **The showcase:** `debug/showcases/whiteDragon.ts` loads the body, the LODs and the parts from the dev server only. No dragon file reaches `dist`, and in a production build the lazy chunk refuses with a warning. It offers cameras, the render 08 match, a bind pose, a LOD switch, the hue lineup and the rider for scale.
  - **The dragon:** `creatures/dragon/`:
    - `mesh.ts` binds by name to one 64-bone skeleton for every LOD, and merges the rigid parts;
    - `materials.ts` is the wyvern hide shader in the white palette, with two small patches in the dragon's own program;
    - `pose.ts` is render 08's sphinx;
    - `idle.ts` is the driver: breathing, blinks, the look cone, wing settles and the tail tip;
    - `whiskers.ts` hangs the whiskers as verlet strands, with no bones;
    - `Dragon.ts` holds them together, and `load.ts` loads the files.
  - **Horn colour:** `look.ts` gains `horns: '#e4d8be'`. It's provisional, for Robert to settle; the kit names "pale bone ivory" with no value.
  - **Found and fixed at load, not in the G12a files:**
    - three zero-length normals at the wing-root cut at every LOD, and six on the cheek fins, which made a NaN hot spot in the bloom;
    - membrane triangles wound against their normals, LOD2's 9 of 314 among them. That is the cause of the trailing edge showing its underside.
    - The fit script should fix both at the source the next time it runs.
  - **Captures:** `scripts/white-dragon-capture.mjs` runs `scripts/white-dragon-capture.manifest.json`, 29 items and 66 files. They are in `shots/white-dragon/` in this worktree (ignored), with their SHA-256 in `docs/qa/white-dragon-g12b-captures.json`. Five are side-by-sides with render 08 (`*.compare.png`): the bare pose, the live idle, the rider for scale, and LOD1 and LOD2.
- **Tests,** run on the working tree before commit:
  - typecheck clean;
  - vitest 138 files and 1,457 tests (134 and 1,431 before). The 26 new ones are in four files:
    - `mesh.test.ts`: binding, skin, breath weights, parts, the repairs, the skeleton and the budgets;
    - `pose.test.ts`: the pose on the skinned body;
    - `idle.test.ts`: the idle at 30 to 165 Hz against a 120 Hz run, as the wyvern tail test checks, plus a three-minute hitch run, blinks and the cone;
    - `materials.test.ts`: the patches and the palette.
  - A deliberately broken interpolation fails the frame-rate test.
  - `vite build` passes, with no dragon GLB in `dist`.
  - smoke 15/15 (`vite build`, then `node scripts/smoke.mjs --no-build` with `CHROMIUM_PATH` set to Edge).
  - The capture run logged no console errors.
  - The wyvern suites and the pose golden pass unchanged, and no wyvern module was edited.
- **Known issues (for Robert's scoring):**
  - Slimmer body, neck and forelegs than render 08's, from the approved sheet (Q50).
  - The membranes crumple near the wing root where the folded wing bunches.
  - The hide's luminance cap greys the ivory a little.
  - The whiskers end 0.8 m above the platform; reaching it needs about 4.5 m whiskers (a parts change).
  - The eye is a four-vertex patch and reads as a small dark pupil.
  - At LOD2 the plates blur into a wash.
  - At tod 0.7 the low sun ahead of render 08's camera hazes everything orange, so the showcase defaults to 0.66.
  - The stand-in tower stands on an island south of the Roost.
- **Decisions:** none new. The horn colour and the hue range are Robert's to settle from the captures.
- **Next authorized action:**
  - Robert scores the captures beside render 08 on identity, fidelity and reachability. He judges the hue lineup and the parts at gameplay distance, settles the horn colour, and times Medium on his GPU.
  - Then Robert says whether to open G12b's PR (its base is `gate/g12a-white-dragon`) and whether to push the captures to an archive branch. After that, G12c.
