# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-19: the Harrier planned to a gold standard

- **Objective:** understand the Harrier mount as it stands and plan its upgrade to a gold standard, then the other breeds. Design lane; no game code changed.
- **Branch:** `design/harrier-gold-standard` from main `affe784`.
- **Completed:**
  - [The Harrier plan](design/HARRIER_GOLD_STANDARD.md): what "gold standard" means (no written bar exists here; built from Q20, Q24, the render brief and G3), a twelve-line acceptance checklist, where the Harrier is today with gameplay-camera evidence, ranked gaps, a five-step proposed gate G3a (baseline, hide language, surfaces, tack, membrane, then render-driven refinements), the procedural-first route with Meshy as a study, and the Skimmer/Galewing/Ironback follow-on.
  - Q36 (open) added to the [decision log](design/DECISION_LOG.md); the design index lists the plan.
- **Evidence:** six Harrier captures taken with `scripts/dragon-capture.mjs` on main (`shots/dragon/`, ignored; not archived yet). Findings: fine honeycomb hide where the brief wants 3 to 5 broad rows; facets on jaw, neck, thighs and tail up close; red high saddle and large blanket against the brief's low-profile sand-leather harness; on-screen green brighter than the authored moss.
- **Tests:** typecheck clean; `src/creatures/wyvern` and `src/flight/breeds.test.ts`: 8 files, 155 tests passing. No code changed, so the full suite was not re-run.
- **Known issues and decisions for Robert:** Q36 (open G3a as proposed?); target renders 01, 02 and 07 still absent from `docs/art/targets/`; Q33 and Q35 from G8a remain open.
- **Next authorized action:** Robert's G8a playtest, unchanged. Then answer Q36; if opened, G3a step 0 (baseline captures to the archive) can start without the renders.
