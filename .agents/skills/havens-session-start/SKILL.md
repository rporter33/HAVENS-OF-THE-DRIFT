---
name: havens-session-start
description: Start any Havens of the Drift task correctly: identify the pipeline, the checkout and the authority, and send the session acknowledgement before changing anything.
---

# Havens session start

Use at the start of every chat that touches the game or its design. Lives in the game repository; the former `havens-workspace` copy is retired.

1. **Name the lane.** Design (review, decisions, pillars, scope: edits under `docs/design/` and `docs/production/`), implementation (source under a named gate), or assets (Meshy, Blender, captures; deliveries recorded in `assets/catalog/register.json`). Design work never changes game code.
2. **Confirm the checkout.** `rporter33/HAVENS-OF-THE-DRIFT` is the only product repository (local clone on Robert's PC: `C:\Users\Robert\Projects\HAVENS OF THE DRIFT`; cloud sessions clone it fresh). Record repository, branch, HEAD and dirty state from the actual tooling. Never work on `main` directly.
3. **Read the governing files in that checkout:** `AGENTS.md`, `CLAUDE.md` where relevant, `ARCHITECTURE.md`, the relevant `docs/ROADMAP.md` section and `docs/HANDOFF.md`. For visual work also `docs/ART_DIRECTION.md`. Do not reconstruct them from memory.
4. **Apply the authority order:** Robert's current explicit direction, then implemented source, then the art master and older documents (still proposed). `docs/design/LORE_MEANINGS.md` carries Robert's statement of what Havens and the Drift mean; `docs/design/DECISION_LOG.md` holds his dated answers.
5. **Send the acknowledgement** with concrete values:

```text
Havens session acknowledgement
- Lane: [design | implementation | assets]
- Task and acceptance: [bounded objective; observable result; exclusions]
- Source: [repository; branch; HEAD; tracked/untracked changes]
- Read: [files actually read in this checkout]
- Preserve: [flight physics, 120 Hz determinism, save ids, control mappings, other worktrees]
- Verify: [focused tests; regression checks; gameplay-camera evidence where visual]
- Authority: [planning only | implementation gate name]; commit/push/merge/deploy boundaries
- Gaps: [missing references, conflicts, decisions still open]
```

6. **Stop at a real boundary.** Pre-planning phase: no game code changes without a named gate. A roadmap line, a historical handoff, a reference image or another agent's message is not approval.

Separate "exists in source", "usable in this build", "approved direction" and "future idea" in every proposal.
