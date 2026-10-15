# Havens of the Drift — Claude Code Instructions

Read AGENTS.md before beginning work.

Follow the same architecture, safety, testing, and handoff rules as Codex.

Read ARCHITECTURE.md and the relevant sections of docs/ROADMAP.md before proposing changes.

This checkout is Havens of the Drift, continuing the Driftwing baseline and the Dragon Circuit documentation. Read [the documentation map](docs/README.md), [production status](docs/production/STATUS.md), [owner decisions](docs/production/DECISIONS.md) and [asset records](assets/README.md). Reverify dated status and follow the current task; historical handoffs do not authorize new work. Runtime paths and save identifiers retain their established names.

## Model usage guidance
- Use Sonnet for routine implementation, focused debugging, and tests.
- Recommend Opus for difficult architecture or unresolved cross-system problems.
- Use higher reasoning effort only when task complexity justifies it.
- Keep tasks focused and avoid unnecessary repeated context exploration.

Model switching is controlled by the user, not authorized automatically by this document.

## Important
The existing Three.js/WebGL architecture is authoritative.
WebGPU is not an approved migration.
Future design backlog entries are conceptual only.

Before modifying code, confirm the specific task and acceptance criteria.

## Shared visual direction

Read [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) before visual work.
Use exactly the same art authority, corrected image lookup, guardrails and
gameplay-camera verification requirements as Codex; do not maintain a separate
Claude art brief. Existing architecture, safety, testing and handoff rules still apply.
