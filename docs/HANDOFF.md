# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19: the white dragon, planned (design lane)

- **Objective:** Robert: "Begin work on the white dragon". Read as the white clan's elder dragon in render 08: four legs plus two wings, ivory toward powder blue (Q36). No gate covers dragon implementation, so this session plans it and changes no game code.
- **Branch:** `design/white-elder-dragon` from main `ae839d9`.
- **Completed:**
  - [The white dragon](design/WHITE_DRAGON.md) covers:
    - what exists, what's approved and what's future;
    - the dragon's form, read from render 08;
    - a map of the wyvern system: what can be reused, what must be generalised, what must be new;
    - the recommended route: its own creature module, a game-owned six-limb skeleton, a Meshy body fitted in Blender, separate parts, rest first;
    - a bone-budget draft (66 to 68 against the 64 budget);
    - three roles, from an elder you meet to a mount;
    - proposed gate G12 in three steps: G12a skeleton and body, G12b resting showcase, G12c on its tower.
  - The [white dragon model kit](../Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) has Robert's Astra reference-sheet prompts and Meshy steps, plus an optional sheet for the horns, whiskers and fins.
  - Q47 (open) is in the [decision log](design/DECISION_LOG.md), with parts a to f. The design index, the creatures index, the first slice's "not scheduled" line and the open-question counts all point to it.
- **Tests:** none run; no source changed. The source claims are from reading main at `ae839d9`, and the cited lines were spot-checked.
- **Known issues:**
  - The wyvern breed tables are closed (`BreedId`), so the dragon is planned as its own module. A dragon *mount* later needs a creature-type key.
  - No imported creature loader exists on main. The Harrier's Meshy trial on PR #11 is the pattern G12 reuses, so #11 should land first.
  - At Windhaven, a tower big enough for the dragon changes the haven's silhouette, which ties G12c to the Aegean kit.
  - The decision log is still forked across branches: Q37 to Q46 live on PR #12, `claude/loving-gates-7sydp9` and `claude/pensive-pasteur-hgbhg0`. This checkpoint's move of the 2026-10-18 entry matches the copy on those branches.
- **Next authorized action:**
  - Robert answers Q47.
  - If he wants to start the asset side, he can make the Astra three-quarter view from the model kit now; that needs no gate.
  - Nothing in the game is opened by this checkpoint.
