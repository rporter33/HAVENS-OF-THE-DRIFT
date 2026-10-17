# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-17: G4 bond expression v1

- **Objective:** gate G4 from the [first slice](design/FIRST_SLICE.md). The wyvern greets its rider on arriving at Windhaven (landmark `roost`) on foot or landing there. It leans into a known bank 0.3 to 0.5 s early at any landmark flown through 3 or more times. Presentation only.
- **Branch:** `gate/g4-bond-v1` from main `4647b27`; the code is in `4f95085`, with QA and handoff docs on top.
- **Completed:**
  - `src/bond/`: `memory.ts` (passes and bank sites per landmark; its own `driftwing.bond.v1` localStorage document, sanitized on load), `anticipation.ts` (pass tracking, bank onsets, the lean), `greeting.ts` (arrival after 8 s away, landing settle, waiting for the wyvern), `Bond.ts` (wiring between `Player.update` and `Wyvern.update`).
  - `WyvernPose.anticipate` is a new optional presentation channel. The wyvern flight layer turns it into spine roll (0.12 rad) and head lead. When it is absent the output is unchanged (tested bit-exact).
  - Game wires the bond on the play screen only; `resetProgress` resets it. No changes to `src/flight`, the save schema, HUD or controls.
- **Tests:** typecheck clean; vitest 126 files, 1,342 tests (20 new in `src/bond/bond.test.ts`); smoke 15/15. Captures and hashes are in [QA: G4 bond v1](qa/G4_BOND_V1.md).
- **Known issues and decisions for Robert:** bond memory persists in a new key beside the save (`driftwing.save.v1` untouched); say if it should be session-only or move into the save in a later schema version. Thresholds are first guesses: known after 3 passes, a bank known after 2, lean 0.12 rad. The discovery banner still reads "Windward Roost" (outside G4).
- **Next authorized action:** review and merge the G4 PR. Other gates wait for Robert.
