# Codex instruction — Driftwing Windline Bracer (Phase 0 only)

You are working in the existing Driftwing repository at `/home/robert/Projects/Driftwing-Codex` on `dev/codex-wsl`. This is a **read-only planning/reconciliation task**. Do not modify, create, delete, reset, stash, merge, rebase, cherry-pick, commit, or push any files. Do not make changes in Claude's worktree.

1. Run `pwd`, `git branch --show-current`, `git rev-parse HEAD`, and `git status --short`. Report the actual values, and preserve all dirty/untracked work. An earlier checkpoint reported `1d718e9` with 37 modified and 13 untracked files; this may now differ.
2. Fetch the independently committed concept branch **without merging**:

   ```bash
   git fetch origin docs/windline-bracer-concept
   git show origin/docs/windline-bracer-concept:docs/concepts/WINDLINE_BRACER_SWINGING.md
   ```

   If the fetch or file retrieval fails, stop and explain; do not guess about document contents.
3. Read the brief and the visual references at `assets/concepts/windline_bracer_mechanics.svg` and `assets/concepts/navigators_grapple_poster_preview.webp` on the same remote branch (via `git show`/safe inspection). The WebP is **only a 256 × 171 preview**, not the high-res source art. The original 1536 × 1024 PNG is available from the owner separately. Follow the brief's important correction: the **Sky Lance is thrown as the anchor**; the wrist-mounted **bracer controls the line/release**. Do not replace it with a wrist-fired laser/web-shooter simply because the mood board illustrates one.
4. Read current `AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/AI_HANDOFF.md`, `src/player/foot.ts`, `src/player/Player.ts`, input mappings, camera and terrain/collision interfaces, existing grapple-related files if any, and relevant tests. Reconcile existing implementation before drafting any replacement.
5. Propose a minimal, deterministic 120 Hz, static-anchor swing slice: state/lifecycle, projectile/swept collision, anchor eligibility, slack/taut fixed-length tether and constraint, world-velocity-preserving release, rider versus auto-wyvern catch ownership, remount/respawn reset, camera/input safety and test instrumentation.
6. Provide a **Markdown proposal in your response** containing:
   - Existing code pathways with exact file paths and whether the functionality already exists.
   - V1 player input flow, state diagram and pseudocode for constrained motion.
   - Required code changes (smallest safe file set), architecture risk table and mitigation.
   - Unit/integration/playtest matrix including energy non-injection, tunneling, world collision, invalid anchors, auto-catch and exact release momentum.
   - Proposed visual integration of Sky Lance/banner, low-profile wrist bracer and crossback harness with three camera legibility tests.
   - 2–4 implementation gates with explicit stop points, a list of unresolved owner decisions, and a short recommended next prompt for an **isolated prototype only once authorized**.
   - Report verification actually performed, not imagined tests.

**Hard constraints:** No automatic tether shortening, powered reeling/pulling, teleporting, moving anchors, gameplay cloth constraints, replacement flight physics, unrelated art overhaul, or M1 progression work. M1 remains open and this is an isolated concept. Make **no changes or commits**, even to create the proposal file; return Markdown inline for owner approval. If you cannot read the preview image reliably, say so, use the full text brief and SVG diagram, and request the original instead of guessing.
