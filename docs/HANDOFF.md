# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19 (fourth session): G12b, the white dragon's resting showcase and its first fidelity pass

- **Objective:** gate G12b (Q47). Build `?view=white-dragon`, dev-only:
  - render 08's pose on a stand-in platform;
  - the dragon's own driver and idle life;
  - a camera matched to render 08 and a capture manifest;
  - a lineup across the ±8° hue shift;
  - a look at LOD2's wing trailing edge and the parts on the thinner LODs.

  Then Robert's notes on the first captures: "Good work... I think we're pretty close."
  - the eyes need more definition;
  - a pass on the wings' and the claws' static mesh;
  - the tail moving more;
  - "continue with fidelity and animation."
- **Branch:** `gate/g12b-white-dragon`, cut from `g12a-parts-lods` (`e4de879`, which `gate/g12a-white-dragon` now has too), and pushed. [PR #16](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/16) is open into `gate/g12a-white-dragon` until [PR #15](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/15) merges. CI runs only on PRs into `main`, so #16 has no checks until it's retargeted. This session's app can't follow #16: there's no `gh` on this PC.
- **Completed:** all of it is in [the white dragon's G12b status](design/WHITE_DRAGON.md#g12b-status-2026-10-19-fourth-session).
  - **The showcase:** `debug/showcases/whiteDragon.ts` loads the body, the LODs and the parts from the dev server only. No dragon file reaches `dist`, and in a production build the lazy chunk refuses with a warning. It offers cameras (`camTarget=` aims them anywhere), the render 08 match, a bind pose, a LOD switch, the hue lineup, the rider for scale, and `features=fitted` for before-and-after views.
  - **The dragon:** `creatures/dragon/`:
    - `mesh.ts` binds by name to one 64-bone skeleton for every LOD;
    - `features.ts` builds the wings, claws and eyes;
    - `materials.ts` is the wyvern hide shader in the white palette, with small patches in the dragon's own program: the plates, slate claws and the eye's lid line;
    - `pose.ts` is render 08's sphinx;
    - `idle.ts` is the driver: breathing, blinks, the look cone, wing settles, and the tail's wave and flicks;
    - `whiskers.ts` hangs the whiskers as verlet strands, with no bones;
    - `Dragon.ts` holds them together, and `load.ts` loads the files.
  - **The fidelity pass,** built at load from the game's own skeleton (the G12a files are unchanged):
    - one clean membrane per wing in three panels, as the wyverns' are built, which stays on its bones and runs taut to the flank when folded;
    - powder-blue finger bones with tip claws and render 08's thumb hook at the wrist;
    - 16 curved slate claws on the fitted claw sites;
    - an almond eyeball with a dark lid line;
    - the tail's wave and flicks, with the tip sweeping up to 1.6 m.
  - **Hue:** Robert liked 0° or +4° of the lineup, then narrowed the white flight's shift to 0° to +4° (Q48). `look.ts` gives each flight its own range inside the ±8° bound (`FLIGHT_HUE_RANGE`; the other flights keep ±8° until judged). The lineup was re-shot at 0°, +1°, +2°, +3° and +4°, and the elder stays at 0°.
  - **Horn colour:** `look.ts` gains `horns: '#e4d8be'`. It's provisional, for Robert to settle; the kit names "pale bone ivory" with no value.
  - **Found and fixed at load, not in the G12a files:**
    - zero-length normals at the wing-root cut and on the cheek fins, which made a NaN hot spot in the bloom;
    - the fitted membrane's mis-wound triangles, the cause of LOD2's trailing edge. The fitted membrane is now replaced, and kept only for `features=fitted`.
    - The fit script should fix both at the source the next time it runs.
  - **Captures:** `scripts/white-dragon-capture.mjs` runs `scripts/white-dragon-capture.manifest.json`, 38 items and 83 files, among them before-and-after pairs and a tail strip. They are in `shots/white-dragon/` in this worktree (ignored), with their SHA-256 in `docs/qa/white-dragon-g12b-captures.json`.
- **Tests,** run on the working tree before commit:
  - typecheck clean;
  - vitest 139 files and 1,465 tests (134 and 1,431 before G12b). The 34 new ones are in five files:
    - `mesh.test.ts`: binding, skin, breath weights, parts, the repairs, the skeleton and the budgets;
    - `pose.test.ts`: the pose on the skinned body and the built pieces;
    - `idle.test.ts`: the idle at 30 to 165 Hz against a 120 Hz run, as the wyvern tail test checks, plus a three-minute hitch run, blinks and the cone;
    - `materials.test.ts`: the patches and the palette;
    - `features.test.ts`: the membrane on its bones and flank when posed, the finger bones, the wing claws, the claw sites, no fitted claw left, and the eyeball.
  - `vite build` passes, with no dragon GLB in `dist`.
  - smoke 15/15 (`vite build`, then `node scripts/smoke.mjs --no-build` with `CHROMIUM_PATH` set to Edge).
  - The capture run logged no console errors.
  - The wyvern suites and the pose golden pass unchanged, and no wyvern module was edited.
- **Known issues (for Robert's scoring):**
  - Slimmer body, neck and forelegs than render 08's, from the approved sheet (Q50).
  - The hide's luminance cap greys the ivory a little.
  - The whiskers end 0.8 m above the platform; reaching it needs about 4.5 m whiskers (a parts change).
  - The forepaws carry the fitted body's two or three toes, where render 08 has four.
  - A stub of the fitted wing root shows on the back beneath each wing.
  - At LOD2 the plates blur into a wash.
  - At tod 0.7 the low sun ahead of render 08's camera hazes everything orange, so the showcase defaults to 0.66.
  - The stand-in tower stands on an island south of the Roost.
- **Decisions:** the white flight's hue range is 0° to +4° (Robert, 2026-10-19; Q48). The horn colour is still Robert's to settle.
- **Next authorized action:**
  - Robert scores the second set of captures (the 0° to +4° lineup among them), settles the horn colour, and times Medium on his GPU.
  - Robert reviews [PR #16](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/pull/16), retargeted to `main` once PR #15 merges, and says whether to push the captures to an archive branch. After that, G12c.
