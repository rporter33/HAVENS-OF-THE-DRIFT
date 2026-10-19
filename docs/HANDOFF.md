# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19 (second session): G12a, the sheet measured and the Meshy body fitted

- **Objective:** continue gate G12a (Q47) with Robert's approved Astra sheet and Meshy body. Check them against the model kit, re-measure the skeleton from side view C and tighten the rig tests, archive the raw files with SHA-256, export the bind skeleton and fit the body in Blender. Nothing visible before G12b.
- **Branch:** `gate/g12a-white-dragon`, continuing from `194aa2c` (the first G12a session, merged to main as PR #14). Archive branch `archive/g12a-white-dragon` (`4725479`, pushed).
- **Completed:**
  - **Checked:** the four sheet views and the Meshy body pass the kit's checklist: six limbs, wing roots mid-back, membranes clear of the legs, no horns or whiskers. There are three departures. Sheet C ties the membrane behind the hip. The Meshy wings root further forward and its tail curves left, both corrected by the fit. Side view C's raised wing is out of scale with the front view. Details are in [the white dragon](design/WHITE_DRAGON.md#the-approved-sheet-and-the-meshy-body).
  - **Archived:** 12 raw files (the Meshy raw and textured GLB, the four views, an earlier three-quarter view, the parts sheet and four variant sheets) on the orphan branch, with README and MANIFEST. Each blob's SHA-256 matches its source. The Meshy model, version and task ID weren't recorded at hand-over.
  - **Measured:** three readers measured side view C blind and a fourth reconciled them. `proportions.ts` and `rig.ts` now follow the sheet:
    - the neck in its S, one rise per segment, and the head pitched 17.6° nose-down;
    - the sheet's leg joints, standing 3.42 m at the body center;
    - the size from render 08's body readings, which makes it 20.3 m nose to tail along the skeleton;
    - the tail in the sheet's sag and curl, joint by joint;
    - the wing's bones from the Meshy body, 21.8 m spread flat.

    `rig.test.ts` now holds side view C within ±5% on lengths and 0.15 m on joints, where it used to hold render 08 within ±15%.
  - **Bind skeleton:** `creatures/dragon/skeleton.ts` and `scripts/dragon-export-skeleton.mjs` write the skeleton as JSON for Blender: pivots, ends, named points and each weighted bone's span.
  - **Fit:** `scripts/blender/dragon_meshy_fit.py`, generalised from PR #11's Harrier fit, was run through the Blender MCP:
    - the wings split off at the root and the cut closed;
    - bone-heat weights on the body and distance weights on the wings, with at most four bones per vertex;
    - each Meshy segment mapped onto the game bone's, with the regions baked from the textured download.

    The result, `src/assets/dragon/white-dragon.glb` (17,999 triangles, 1.13 MB, dev-only data), has a parser (`creatures/dragon/asset.ts`) and tests. It is recorded in the register as `white-dragon-meshy-body`. The master is `havens-blender-pilot/white-dragon-pilot.blend` on Robert's PC.
  - **Reviewed:** four reviewers each covered one area (rig and tests, skeleton export, fit script, docs), and each finding went to a skeptic. All 15 findings were confirmed and fixed:
    - the tail's sag and the body plan's fold at the neck;
    - tests that only checked a parameter against itself;
    - the baked attributes: arc length stepped at stations, tube values on limbs and head, the wing panel coordinate, shared vertices, stray claws;
    - doc errors: a wrong sign, overstated checklist, wingtip overshoot, missing open-question counts.
  - **Decisions:** Q50 (open) asks Robert to confirm the size, the wing's source and the membrane's root; each is built as recommended.
- **Tests,** run on the working tree before commit:
  - typecheck clean;
  - vitest 133 files, 1,412 tests, against 131 and 1,391 before; the dragon's 51 include 21 new;
  - the production build succeeds;
  - smoke 15/15. `npm run smoke` can't build on this PC because `scripts/smoke.mjs` passes the folder path, which has spaces, to Vite unquoted. It ran as `vite build` then `node scripts/smoke.mjs --no-build` with `CHROMIUM_PATH` set to Edge, since Playwright's Chromium isn't installed here.
  - No visual check in the game: nothing draws the dragon yet. The fit was checked in Blender renders only.
- **Known issues:**
  - G12a still needs the parts' geometry (horns, whiskers, cheek fins, spines, tail fin), its LODs, and Robert's answers to Q50.
  - Fit limits: stubs of the wing root stay on the body under the wing's root, the flank under the membrane's root is filled flatter than the body around it, and the fit is checked in the bind pose only.
  - PR #11 merged into `art/astra-targets-2026-10-17` after that branch had already reached main, so the Harrier trial isn't on main. The dragon doesn't depend on it.
  - The decision log is still forked across branches (Q37 to Q46).
  - This session first tried to build the archive branch in a worktree. Creating it failed on Windows long paths, and the commands after it (`git checkout --orphan`, `git rm`) ran in the main checkout instead. Nothing was lost, since there were no uncommitted changes, and the checkout was restored to `194aa2c` before any further work. The archive was then built with git plumbing, which needs no checkout.
- **Next authorized action:**
  - Robert answers Q50, or lets the recommendations stand, and reviews the PR from this branch.
  - G12a's parts geometry and LODs, then G12b's resting showcase.
