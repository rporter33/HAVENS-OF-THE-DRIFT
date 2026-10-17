# Source audit: keep, flag, remove

Prepared 2026-10-17 from read-only inspection of main `18a7aab` (typecheck clean, 125 test files, 1,322 tests passing, build not yet re-run on this branch at writing). **Every row is a proposal.** Nothing here changes code; each "remove" needs its own named gate and its own PR with the focused tests listed. Decisions applied: Q1 both mounts, Q2 same game with upgraded looks, Q15 keep Windline, Q19 keep the Drift.

Rule of thumb used: code that is reachable from normal play, or that a selected direction depends on, is **keep**. Code reachable only through a debug URL or a one-off review script is **flag** (keep, but label it and stop extending it) unless a decision has shelved the direction, in which case it is **remove candidate**. Removal is never proposed where a test still exercises shared contracts.

## Runtime source (`src/`)

| Area | Lines | Reachable from | Verdict | Reason and gate |
|---|---|---|---|---|
| `src/flight/`, `src/player/`, `src/world/` (except airship), `src/sky/`, `src/race/`, `src/progression/`, `src/cosmetics/`, `src/ui/`, `src/input/`, `src/camera/`, `src/audio/`, `src/fx/`, `src/render/`, `src/game/`, `src/core/` | ~60,000 | Normal play | **Keep** | The shipped game. Q2 keeps it. |
| `src/traversal/` (Windline / Sky Lance) | 2,413 | Normal play, on foot and in freefall | **Keep** | Q15. Open follow-up: core vs unlocked. 12 test files, 6 CI check scripts depend on it. |
| `src/creatures/` procedural wyvern and rider | ~27,000 | Normal play | **Keep** | Q1: wyvern remains the player mount. |
| `src/creatures/` authored Blender rider provider (`?riderTrial=blender` / `compatibility`) | part of above | Debug URL only | **Flag** | Opt-in trial, not default. Keep while the Meshy-and-Blender pipeline (DECISIONS 2026-10-14) is the selected asset route; it is the only integration proof that route has. Label as trial in code comments; do not extend without a gate. |
| `src/assets/rider-blender/rider-trial.glb` | 18.2 MB | Imported by `Rider.ts` (trial path) and two tests via `?inline` | **Flag** | Largest file on `main` after the evidence move. Two tests inline it as a fixture. Candidate for the archive branch plus a smaller test fixture once an accepted runtime rider export exists; needs a gate because tests change. |
| `assets/rider-blender/source/rider-trial.blend` + JSON cages | 34 MB | Nothing at runtime; Blender scripts | **Flag** | Editable master. Owner decision says masters go to the separate archive; keep until `havens-archive` exists and restore is verified, then move with the register updated. |
| `src/world/airship/` (Windhaven hull, plan, showcase) | 830 | `?showcase=windhaven` debug URL; `npm run windhaven` | **Flag** | Stationary art study only. Airship is "intended future work" (DECISIONS) and Q22 (one ship or two) is open. Keep as the reference implementation; do not grow it. `scripts/windhaven-smoke.mjs` runs in CI `verify.yml`; keep that check while the code stays. |
| `src/research/` (three branches, Codex stages 0-5, display capped at 1) | 328 | Normal play (one live site) | **Keep** | M1 First Lead is implemented up to the first site; Q5 (capabilities from bond, research or both) is open and the recommendation routes research to ship and world reach. Small. |
| `src/debug/showcases/` (rider, windhaven and others) | part of 2,714 | Debug URLs | **Keep** | Used by the capture scripts and CI evidence; cheap. |
| `src/editor/` (Region Workshop) | 1,011 | `/editor.html` | **Keep** | Q19 keeps the Drift, and re-dressing the Roost quadrant (recommendation) is editor work. `editor-verify.yml` covers it. |

## Scripts (`scripts/`, 58 files)

| Group | Count | Verdict | Reason |
|---|---|---|---|
| Referenced by `package.json` or a workflow (`smoke`, `windhaven-smoke`, `editor-check`, `audio-qa`, `sky-lance-check`, `windline-*-check` x7, `lantern-*` x4, `rider-blender-{delivery-check,fit-qa,gameplay-qa,stable-qa,windkeel-qa,qa.config}`, `rider-qa.config`, `review-windows.ps1`, `browser-evidence`, `dragon-capture*`) | 35 | **Keep** | Live checks. |
| Rider authoring and export: `rider-blender-author.py`, `rider-blender-export.py`, `rider-blender-windkeel.py`, `rider-blender-source.mjs` | 4 | **Keep, relocate** | The only reproducible path from `.blend` to the trial GLB. Propose `tools/rider-blender/` with a README so they stop reading as QA scripts. Gate: path-only move, run `test:rider-qa`. |
| One-off review captures with no caller: `rider-blender-{final-checks,final-visuals,full-browser,hardware-qa,performance-summary,probe,proof,shoulder-qa,views}`, `rider-{cloth-hd,clothing-pass,fidelity-pass,layering,mounted-fit,proof,qa-capture,shared-body,wardrobe}-check/pass`, `windhaven-art.mjs`, `shot.mjs` | 19 | **Remove candidate** | Each produced one dated evidence set now on the archive branch. None is called by CI, `package.json` or another script. Their outputs are preserved with hashes. Propose moving them to the archive branch under `scripts/` in one PR so they remain recoverable, then deleting from `main`. Gate: run full `npm test` and all five workflows after removal. |

## Documentation and evidence still on `main`

| Item | Size | Verdict | Reason |
|---|---|---|---|
| `docs/art/` supplied reference pack (ZIP plus extracted) | 14 MB | **Keep** | Art authority; `ART_DIRECTION.md` depends on corrected paths inside it. AGENTS.md says it stays at its original path. |
| `docs/qa/` captures and JSON | 9 MB | **Keep** | Small; the QA index cites them by tested commit. |
| `docs/rider-c02/*.md`, `docs/rider-blender-trial/*.md` and manifests | under 1 MB | **Keep** | Review text and the manifests that `rider-blender-*` scripts read. |
| `docs/history/handoff/` | 272 KB | **Keep** | Historical record, now out of the agents' required reading. |

## Workflows (`.github/workflows/`, 5)

| Workflow | Verdict | Note |
|---|---|---|
| `verify.yml` | **Keep** | The integration gate: typecheck, tests, rider QA, build, smoke, Windline and Windhaven checks. |
| `deploy.yml` | **Keep** | GitHub Pages deploy; the only live build Robert can open from a phone. |
| `editor-verify.yml` | **Keep** | |
| `lantern-review.yml`, `rider-authored-review.yml` | **Flag** | Feature-specific review packages from October 10-12. They each install Chromium and upload evidence artifacts on every PR that touches their paths. Fine to keep while cheap; fold their checks into `verify.yml` if PR CI time becomes a problem. |

## Not in source, and therefore nothing to remove

Networking, AI rivals, bonding, non-cosmetic capability unlocks, course variants, dialogue, four-legged dragon rig, the Craghorn, region travel, moving decks, aerial ball sport. The backlog list in AGENTS.md is accurate against `src/`.

## Suggested order if Robert opens gates

1. Move the 19 orphan review scripts to the archive branch (no runtime effect, CI proves it).
2. Relocate the 4 authoring scripts to `tools/rider-blender/` with a README.
3. `havens-archive` exists as of 2026-10-17; move `rider-trial.blend` and its JSON (34 MB) with register entries and a verified restore.
4. Replace the 18 MB GLB test fixture with a minimal one, then move the GLB to the archive or to an accepted `assets/runtime/` export, whichever the Meshy pipeline produces first.

Nothing above touches flight physics, the 120 Hz step, save identifiers or control mappings.
