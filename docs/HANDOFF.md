# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18 (late): game head on the trial, head slot, folded wings off the hind legs

- **Objective:** Robert's review of the first trial (Q39): keep the game's head (glowing eyes, charm) on the Meshy body and make it more pronounced; heads interchangeable across mounts as a cosmetic (Dragonflight as inspiration for mix-and-match slots); folded wings must not clip or flip through the hind legs.
- **Branch:** `gate/g3-harrier-visual` (PR #11, draft), stacked on PR #10.
- **Completed:**
  - **Head slot:** new cosmetic slot `wyvernHead` (`native`, harrier, skimmer, galewing, ironback, drake; drake costs 25 feathers). `HEAD_STYLES` in `proportions.ts` sets each head's size, width, height, eye, and its profile (blunt snout, brow, cheek, crown, peg teeth); `rigFor(breed, head)` builds the head joints for the chosen style. Saves, stable picker (Head & Horns), unlocks and the showcase carry it.
  - **Pronounced Harrier head:** larger skull with a heavier brow, fuller cheeks and a raised crown. Eyes glow by day as well as by night (`0.3 + 0.7 * uNight`).
  - **Trial uses the game head:** the fit script cuts the Meshy skull and eases the neck to the game's girth at the head (`NECK_EASE`); `trial.ts` merges the procedural head (every triangle riding the head bones) into the trial body, so head and horn cosmetics and the eyes work on it. Body cut to 7,500 triangles: trial total 23,825 with the head and membranes (LOD0 ceiling 24,000).
  - **Wings off the hind legs on the move:** legs now solve before the wings; the folded elbow swings out of the thigh and shin capsules (`clearElbow`), the finger segments lean out while striding, and the forefeet track outside the hind feet while moving (20% of that offset kept when standing). A tucked forefoot steps out first when setting off. Measured: wing-leg penetration 0.24 to 0.48 m in 40 to 96% of walking frames before; 0.000 m for every breed at walk, brisk and run after.
- **Tests:** typecheck clean; vitest 129 files, 1,367 passed; new ground test (wings off the hind legs at three speeds, every breed); golden pose fixture regenerated (intended: head joints, legs before wings, elbow swing); horn reference re-recorded for the new head; smoke 15/15.
- **Evidence:** `shots/g3/review/` (ignored): portrait, head lineup sheet, fold while walking and running.
- **Known issues:** the folded membrane still brushes the flank while walking (wing-body, pre-existing, about 0.2 m for the Harrier at a brisk walk); head styles are proportion and profile variations of one lofted skull, not separately modeled heads; trial is at 23,825 of 24,000 triangles, so further detail needs LODs or a lower body budget; shape cosmetics other than the head are still baked at their defaults in the trial.
- **Next authorized action:** Robert reviews the trial (`?wyvernTrial=meshy`, stable Head picker) and says what to change; promoting the trial past dev-only still needs his acceptance.
