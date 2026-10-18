# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18: G8a capability sites, playtested

- **Objective:** gate G8a (Q34): build the steep-landing and snap-roll capability sites ahead of G5, at the render brief's fidelity, playtest them, and record the answers.
- **Branch:** the sites are on `main` (#9, with #8, at `affe784`). The playtest answers are docs only, on `claude/loving-gates-7sydp9`.
- **Completed:**
  - `RockFormShape` (`src/world/rockForm.ts`) is a new signed-distance solid read by terrain, collision, ground, the Windline sweep, race and cloud clearance, and a surface-nets mesher (`mesh/rockFormMesh.ts`). It's painted in the islands' palette through `terrainMaterial`, with LODs and shadow stand-ins.
  - **Cascade south perch:** 51.5° top, ground only on its plane. No breed lands on it today; every breed can with the unlock.
  - **Archway Keyhole:** opposed 70° cracks around a 9.5 m chamber. The harrier can't thread it today and can with the ×1.6 snap-roll, at 14–16.5 m/s.
  - `?capPreview=steep,snap` is a debug-only preview. The session saves nothing.
  - Robert played both sites on 2026-10-18 (gamepad and keyboard). Answers: [G8a QA](qa/G8A_CAPABILITY_SITES.md#playtest-results-2026-10-18). Decision log: Q33 and Q35 answered, Q41 and Q42 opened, Q43 records the direction.
- **Tests:** G8a code passed typecheck, the full vitest suite (1,361 tests) and smoke (15/15) on #9. The answers change docs only and ran no tests.
- **Known issues and decisions for Robert:**
  - The perch's top and rim don't read as a place to land, and a failed landing reads as a bug with no explanation (F1, F2).
  - After sliding off the perch the mount "kind of freezes up" (F3); the follow camera clips into rock while the mount is falling (F4). Neither is reproduced or investigated.
  - Q41 (keyboard snap-roll input) and Q42 (what a rock hit costs) are open.
  - Q35 is accepted: the tuck threads the Keyhole, so it is a skill site and the snap-roll no longer gates its collectible. G5 decides what the unlock earns there.
  - Direction in Q43, none of it built: a charged launch that improves with bonding, a more forgiving Keyhole chamber, a possible wind stream for agility, a more visible snap-roll animation, and more unique, vertical islands.
- **Next authorized action:** none opened by this checkpoint. G5 and any G8a follow-up (readability, a more forgiving chamber, F3 and F4) need a named gate from Robert, and Q41 and Q42 need Robert's call.
