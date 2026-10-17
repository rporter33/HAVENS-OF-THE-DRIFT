# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-17: platform cleanup, no gameplay changes

- **Objective:** make the repository the single source of truth for Claude Code and Codex, small enough to clone from a phone-driven cloud session, with documentation organized into the tabs Robert asked for (production, design, systems, assets, QA, history).
- **Branch:** `platform/cleanup-2026-10-17` from main `18a7aab`.
- **Completed:**
  - 811 review-capture files (762 MB) moved from `docs/rider-c02/evidence` and `docs/rider-blender-trial/evidence` to the orphan branch `archive/evidence-2026-10-17` (`eff904a`); stubs and a SHA-256 manifest left behind. Working tree 829 MB to 99 MB.
  - The 245 KB `docs/AI_HANDOFF.md` split into `docs/history/handoff/<day>.md`; this file replaces it as the current checkpoint; the old path is a compatibility stub.
  - `docs/` reorganized into six folders; loose dated reports moved to `docs/history/`; compatibility stubs at every old path.
  - Design material consolidated from `havens-workspace` (decision log, catch-up, comparative review, lore meanings) into `docs/design/`; Robert's 2026-10-17 answers recorded.
  - `AGENTS.md` is the single contract; `CLAUDE.md` points at it. `.agents/skills/havens-session-start` and its `.claude/skills` copy added.
  - `docs/hub/index.html`: a hand-built tabbed hub that reads this repository's markdown from GitHub.
  - `docs/production/SOURCE_AUDIT.md`: keep/flag/remove proposals for source tied to shelved directions. Proposals only.
- **Tests:** see the PR description for the typecheck, vitest and build results on this branch.
- **Known issues:** full Git history still carries the evidence blobs (no history rewrite, per the no-force-push rule); only shallow clones benefit. A separate `havens-archive` repository is the intended final home for the archive branch and needs Robert's GitHub token to create.
- **Next authorized action:** Robert reviews and merges the PR. The first implementation gate after merge is his call; the source audit lists candidates.
