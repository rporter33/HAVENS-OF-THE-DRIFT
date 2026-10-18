# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18: G8b site polish built; waiting on a re-test

- **Objective:** gate G8b (Q45): after the G8a playtest, make the perch read as landable, explain a failed landing, and make the Keyhole more forgiving.
- **Branch:** `claude/loving-gates-7sydp9` (docs and code, pushed, no PR). G8a is on `main` (#9, `affe784`).
- **Completed:**
  - **Answers recorded:** Q33, Q35, Q41, Q42, Q12b, Q21b answered; Q43 (direction), Q44 (one rival per course) and Q45 (opens G8b) added. See [G8a QA](qa/G8A_CAPABILITY_SITES.md#playtest-results-2026-10-18).
  - **F1:** the perch's top is a bright ivory slab with a scrub-fringed rim and a shaded lip (paint only, `rockFormMesh.ts`).
  - **F2:** a flared approach into ground too steep for the breed shows "Too steep to land" with the slope and the breed's limit, at most every 8 s (`Player.ts`, presentation only; raised from the legs' check and from the body's contact).
  - **Keyhole chamber 9.5 m to 14 m** (`layout.ts`). A normal-roll harrier now threads 195 of 37,260 settings (0 before) and the snap-roll 1,996 of 53,820. The galewing and ironback still never do. 15 m would let the ironback through with the unlock, so 14 m is the longest that keeps Q32.
  - **F3 and F4 reproduced, not fixed:** F3 is a feel problem (a 0.6 s stun, then about 2.4 s under 8 m/s in the flare pose, and nothing says to release flare); F4 is the camera boom snapping in and ending inside the rock for 2 frames.
- **Tests:** typecheck clean; vitest 128 files, 1,366 tests passed; smoke 15/15 (the build stamp was `400bfa5`, before the G8b commit). New or changed: `rockForm.test.ts` (the failed-landing explanation and its conditions, the Keyhole search, pinned early and late lines, the heavy breeds).
- **Known issues and decisions for Robert:**
  - Re-test questions B1 to B7 are in the QA doc. Nothing from G8b has been played.
  - F3 and F4 need a named gate to fix. F4 is the camera boom; F3 is feedback during a failed landing.
  - Q42's physics half (a longer loss of control) needs its own gate and Robert's approval; Q41's longer keyboard window is built with G5.
  - Open PRs #10 and #11 (art targets, Harrier colour) use Q36 to Q40, so counts and the end of the decision log will need a small recount whichever merges second.
- **Next authorized action:** none opened by this checkpoint. G5, the F3 and F4 fixes and the Q42 physics each need a named gate from Robert.
