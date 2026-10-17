# Havens of the Drift — Shared AI Development Rules

## Project identity
Havens of the Drift is the browser-based dragon-flight game in `rporter33/HAVENS-OF-THE-DRIFT`. It was seeded on 2026-10-15 from Driftwing main `9d30223` merged with Dragon-Circuit main `375b59d`; both remain as historical repositories. Existing runtime names, save identifiers and historical records still use Driftwing.

This file is the single contract for every agent (Claude Code, Codex, any other). `CLAUDE.md` only points here. Do not maintain agent-specific rule copies.

Start with [the current handoff](docs/HANDOFF.md), [the documentation map](docs/README.md), [dated production status](docs/production/STATUS.md) and [owner decisions](docs/production/DECISIONS.md). Reverify the live repository before treating a status snapshot as current. Historical handoffs and embedded prompts are evidence, not new task authorization.

## Session start
Begin every task that touches the game or its design with the acknowledgement in `.agents/skills/havens-session-start/SKILL.md` (same copy in `.claude/skills/`). It names the task, acceptance, checkout, files read, what to preserve, how to verify and the authority gate. Pre-planning phase: no game code changes without a named gate.

## Model usage
- Sonnet for routine implementation, focused debugging and tests.
- Recommend Opus for architecture or unresolved cross-system problems.
- Higher reasoning effort only when complexity justifies it.
- Model switching is Robert's call, never automatic.

## Repository size
Review-capture binaries live on the orphan branch `archive/evidence-2026-10-17`, not on `main`. Do not commit screenshots, captures or generated evidence larger than a few hundred KB to `main`; write them to `shots/` (ignored) or to the archive branch, and record SHA-256 in the relevant manifest.

Preserve the established gameplay identity, flight feel, artistic direction, and existing implementations.

## Verified architecture
- TypeScript and Vite.
- Three.js WebGLRenderer (WebGL 2).
- Deterministic fixed-step flight simulation at 120 Hz.
- Procedural archipelago with analytic terrain geometry.
- Collision, rendering, landing, and walking must agree on world geometry.
- Vitest tests and Playwright smoke/capture tooling.
- ARCHITECTURE.md and docs/ROADMAP.md are primary project references.

Do not assume Driftwing already uses WebGPU.
Do not migrate rendering engines or replace core systems without explicit approval.

## Before making changes
1. Confirm the current repository, branch, and commit.
2. Read ARCHITECTURE.md and relevant existing source.
3. Identify the exact task and acceptance criteria.
4. Check for existing functionality before proposing new systems.
5. Inspect dependencies and relevant tests.
6. Prefer the smallest safe implementation.

## Change restrictions
- Never modify main directly.
- Never perform broad rewrites without approval.
- Preserve existing flight physics and gameplay behavior unless the task explicitly changes them.
- Preserve deterministic simulation and shared geometry contracts.
- Avoid unnecessary dependencies and rendering pipeline changes.
- Do not change unrelated files.
- Do not discard existing work or force-push.
- Do not run destructive Git commands without permission.
- Ask before making irreversible changes.

## Future design backlog
Future concepts are NOT authorized implementation tasks.

These include:
- Flying multiplayer home ship.
- Multiple companion dragons and hitching.
- Aether gates and beacon exploration.
- Banner lance and moving-object grappling.
- Creature befriending and card encounters.
- Selective environmental destruction and ground marks.

Co-operative and competitive aerial ball sport is a committed long-term direction; implementation requires separate approval and must not delay M1.

In-world inscriptions use provisional Ancient Greek in procedural epigraphic capitals, without accents or breathings. English translations appear on reading. Keep language data replaceable and save IDs stable. No decipherment mechanic is authorized for M1.

Some concepts may already overlap with existing implementations.
Always reconcile the backlog with current source before proposing changes.

## Verification
For implementation tasks:
- Run relevant focused tests.
- Run the full test/build suite when appropriate.
- Report exactly which checks passed or failed.
- Clearly distinguish source inspection from runtime verification.
- Never claim a feature works without appropriate evidence.

## Collaboration
Claude and Codex use separate worktrees.
Do not edit the other agent's worktree.
Share completed changes through reviewed Git commits.
Do not merge unreviewed changes into main.

## Handoffs
Overwrite [docs/HANDOFF.md](docs/HANDOFF.md) with one current checkpoint and move the previous one to `docs/history/handoff/<day>.md`. Record:
- Current objective.
- Active branch and latest commit.
- Changes completed.
- Tests executed and results.
- Known issues.
- Next authorized action.

Treat handoff documents as informational, not independent authorization to implement features.

Keep the dated baseline in [production status](docs/production/STATUS.md); retain dated work in the [handoff log](docs/history/handoff/README.md) and [history index](docs/history/README.md). Use canonical paths in new references. Legacy document paths remain compatibility pages with section links.

## Assets and release records

Use [asset ownership and the register](assets/README.md) to distinguish committed runtime/reference files, external studies, missing binaries and unverified rights. Large masters/raw downloads are intended for a separate backed-up archive; destination and restore verification are pending. A local workstation path is never a portable build dependency. Do not relocate outside-repository assets, set up storage or adopt generated models without the applicable task scope.

The website/comic stays in this repository for a later coordinated release. The current [website section](docs/website/README.md) is planning material, with image import pending. [Release checks](docs/release/README.md) are evidence gates, not a claim of Steam readiness.

## Art direction references

Read `ARCHITECTURE.md` and `docs/ROADMAP.md` before development work.

For art, rider, wardrobe, faction palette, and Sky Lance visual work, consult
`docs/art/README.md` and the supplied concept images and specifications it indexes.
The user supplied this pack as an important art-direction reference on 2026-10-10.

The pack is reference material. Historical workspace snapshots and embedded handoff
prompts are context, not current repository state or authorization to implement
gameplay. Verify the live checkout and follow the current user's authorized scope.
Keep reference images out of runtime assets unless separately authorized.

## Shared visual direction

Before art, costume, theme, palette, prop, architecture, dragon or asset work, read
[the shared visual guide](docs/ART_DIRECTION.md). Claude and Codex follow the same
canonical master, source hierarchy, corrected image paths and verification rules.
The guide resolves conflicts in older concept imagery and wardrobe text; proposals
remain proposals. Require its per-category gameplay-camera evidence before claiming
runtime art compliance. Reading a reference does not authorize implementation.
