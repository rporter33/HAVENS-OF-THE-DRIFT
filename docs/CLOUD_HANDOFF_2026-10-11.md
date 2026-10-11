# Cloud development checkpoint — 2026-10-11 UTC

The owner authorized inventory, backups, coherent commits, reviewed integration, GitHub publication and a cloud handoff. This checkpoint combines existing work; it does not complete new gameplay milestones or authorize future scope automatically. Integration PR: [#3](https://github.com/rporter33/Driftwing/pull/3). The owner's completion report supplies the exact final main commit; an existing cloud checkout does not update automatically.

## Subsequent normal-game integration — PR #4

Robert subsequently authorized the completed Windline systems in normal play, with merge and the existing latest-build Pages deployment. [PR #4](https://github.com/rporter33/Driftwing/pull/4) starts from merged main `f9fc707d55cea36f62307d8a58ba9c00361be253`. Its current source makes Windline standard rider equipment on `/`; the historical prototype-only status below describes the earlier consolidation checkpoint.

Start through the normal title → Fly flow. On foot or in freefall, aim with mouse/right stick, press Q/RT to cast at existing solid surfaces within 65 m, hold to retain and release to detach. Space/A jumps on the ground, pulls inward while linked, or boosts while freely airborne; boost recharges in 1.75 simulation seconds. WASD/left stick steers freefall (forward dives, back brakes). Hold F/Y to leap from a flying wyvern; release, then hold again to recall while free. An attached line, including a slack line, prevents rescue. Ground mounting, Stable and inscription interactions retain their priority. Pause → Controls lists these actions; Settings → Gameplay → Toggle Windline exposes the existing accessibility interaction and survives reload.

Normal play uses only the existing shared static world and preserves the introductory tutorial, research/save IDs, collectibles and static dock construction. World streaming and pickups follow the independent rider. Leaving the saddle ends a mounted race before a riderless dragon can cross its next gate. No progression unlock, practice platforms, ship functionality or updated character model was added. Windhaven remains accessible only in its separate unfinished `?view=windhaven` study; `?view=skyLance&play=1` remains available as practice.

`scripts/windline-gameplay-check.mjs` verifies normal launch, DOM cast/leap/boost/recall, real-world tether/pull, release during pause, repeated interruptions, save/reload, simulated controller roles, Controls discovery and ship exclusion. Both PR verification and Pages deployment run it against the production build. See the current AI_HANDOFF entry and PR for exact final check results and release SHA. Software-rendered browser checks do not establish physical iPhone/controller/GPU performance or complete art compliance.

## Source and feature status

| Work | Preserved source | Status and boundaries |
| --- | --- | --- |
| Existing game | `844e5c25860aab4c596116df4ffb19fa4e98fd1e` | Earlier shrine tutorial, terrain visibility, rider/landing corrections, approved flight braking and looping title music already on main. Retained unchanged by this integration. Formal remaining M1 review gates are not declared complete here. |
| Windhaven | `feat/windhaven` at `59dc52c4bff5f3991830866ac22b33e359d35864` | Stationary opt-in study: smooth shared render/collision hull, open windows, four terrace hitch sockets, wind-driven presentation cloth, usable deck and four-breed checks. Travel, ship steering, occupied moving ground, crafting, stable services and functional multi-dragon hitching remain unimplemented. |
| Windline / historical Sky Lance | `exp/sky-lance-v1` at `0bb2498` | Committed formerly dirty prototype. Opt-in practice scene, not a default-game progression unlock. Bracer-fired magical line, fixed maximum length with slack, deliberate A/Space pull, momentum release, recovery, freefall/boost, deliberate wyvern recall and reset arbitration. No moving anchors, wrapping, automatic pulling, networking or wardrobes. |
| Shared direction | `dev/codex-wsl` at `30756b2` | Shared AGENTS/CLAUDE visual instructions and `docs/ART_DIRECTION.md`; reconciled without dropping the pack's reference-only rules. |
| Art and design | `docs/art-reference-pack` at `f3ef231`, `docs/windline-bracer-concept` at `0d3ca54`, `dev/claude` at `4490a59`, `docs/game-development-resources` at `a3345b7` | Complete supplied art ZIP/extracted pack, Windline concepts, M1 planning brief and resource directory included. Concept art is not a production rig/model. Embedded old prompts are historical context. Ancient Greek remains provisional/unverified. |

The owner's later direction supersedes the old thrown-lance/no-powered-pull design **within the Windline experiment**: a bracer fires the line, and A/Space deliberately pulses inward. There is no automatic winch. The old concept brief remains intact as design history. Existing flight physics/breeds, renderer, dependencies, deterministic 120 Hz simulation and golden tolerances/fixtures are unchanged by consolidation.

### Prototype entry points and controls

- Normal game: `/` (existing title music loops until gameplay; settings remain authoritative).
- Windhaven: `/?view=windhaven&quality=low`; choose **Walk deck** or **Ride / take off**. WASD movement, F mount/dismount, Space jump/launch. Inspection buttons pause player movement; cloth still responds to wind.
- Windline: `/?view=skyLance&play=1&quality=low`. Q/RT fresh press casts; hold retains; release detaches. Practice checkbox enables toggle accessibility. WASD/left stick steers; forward dives, back brakes. A/Space pulls while attached and bursts upward while free. Boost recharges in **1.75 simulation seconds**. Hold F/Y deliberately jumps off or recalls the dragon; release between actions. R/View resets practice.
- Attached lines, including slack lines, block rescue. Animation/equipment sockets do not own movement. Player dispatches one movement integrator and RiderFoot remains the rider's physical authority.

## Cloud setup

Use Node 22 (the GitHub workflow target; local integration also checked with Node 24.21.0). Lockfile versions include Three.js 0.186.1, TypeScript 6.0.2, Vite 8.3.4, Vitest 5.0.3 and Playwright 1.56.1. This repository is private: authenticate with an account that can read it.

```sh
gh repo clone rporter33/Driftwing Driftwing
cd Driftwing
git fetch origin
# Substitute the exact final main SHA from the owner's completion report.
git switch -c cloud/development FINAL_MAIN_SHA
npm ci
npx playwright install --with-deps chromium
npm run dev -- --host 0.0.0.0 --port 5173
```

Forward the cloud environment's port 5173; localhost URLs from the old computer are not cloud links. No Windows checkout, dependency symlink, downloaded runtime model, or uncommitted local source is needed. The intro MP3 is tracked in `src/audio/assets/`; supplied design assets are tracked under `docs/art/` and `assets/concepts/`. Required art-reference documentation now lives in this checkout.

### Checks and production preview

```sh
npm run typecheck
npm test -- --maxWorkers=2
npm run build
node scripts/smoke.mjs --no-build --port 5390
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort
```

With that preview running, use another terminal:

```sh
npm run test:windhaven
node scripts/sky-lance-check.mjs http://127.0.0.1:5174
node scripts/sky-lance-check.mjs http://127.0.0.1:5174 --motion-only
node scripts/sky-lance-check.mjs http://127.0.0.1:5174 --control-only
node scripts/sky-lance-check.mjs http://127.0.0.1:5174 --input-only
node scripts/sky-lance-check.mjs http://127.0.0.1:5174 --spin-only --expect-retained --evidence=cloud
node scripts/sky-lance-check.mjs http://127.0.0.1:5174 --performance-only --evidence=cloud
```

`npm test` runs the same complete suite with default concurrency; `--maxWorkers=2` bounds resource usage without skipping tests. Existing `scripts/dragon-capture.mjs` and manifest remain the visual capture system. `scripts/windhaven-art.mjs` captures the stationary study. Playwright/SwiftShader checks are automated browser evidence, not physical-controller, hardware-GPU or owner visual approval.

## Preservation and original checkouts

Verified dated local backup:
`/home/robert/Projects/Driftwing-Preservation/cloud-consolidation-20261011T000747Z`.
It contains both verified complete-history bundles, five SHA256-verified source/evidence archives, original index copies, staged/unstaged patches, refs and inventories. Staged changes were absent. Windows snapshots retained original CRLF bytes. All project files were checked again for stability before integration; original Windows source files and branches were not edited, despite open Windows Codex/server processes.

Durable private backup: [draft recovery release](https://github.com/rporter33/Driftwing/releases/tag/untagged-69aca8c9ffa5c937a75d), tag `cloud-recovery-20261011`. Its 148,466,452-byte sanitized archive was downloaded independently and verified against its checksum and **all 2,088 archived file hashes**. It includes the supplied Windhaven concept and latest Windhaven/Windline historical captures and review evidence. The release is a backup, not a gameplay deployment. Authenticate to download:

```sh
gh release download cloud-recovery-20261011 --repo rporter33/Driftwing --dir recovery
cd recovery
sha256sum -c driftwing-cloud-recovery-20261011.sha256
tar -xzf driftwing-cloud-recovery-20261011.tar.gz
# For history recovery, git bundle verify windows.bundle (or ubuntu.bundle).
# Clone a bundle into a NEW recovery directory; never overwrite an existing checkout.
```

No secrets, dependencies, caches or generated builds were uploaded. Claude's `.claude/settings.local.json` stays in the private local backup only; it is machine-local tooling configuration, not required game source. Historical backup collections also remain at `/home/robert/Projects/Driftwing-Preservation/` and `C:\Users\Robert\Projects\Windhaven-Backups`.

| Original checkout | Branch / preserved HEAD | Remaining local state |
| --- | --- | --- |
| Windows `Projects/Driftwing` | `dev/ai-setup` / `1d718e9` | Semantically clean; Linux Git without Windows CRLF normalization reports line-ending differences. Exact bytes archived. |
| Windows `Projects/Driftwing-Claude` | `dev/claude` / `4490a59` | AGENTS/CLAUDE edits and untracked visual guide retained. Their exact logical snapshot is committed/pushed as `recovery/cloud-20261011/driftwing-claude-guidance` (`39d5268`). `.claude/settings.local.json` remains local only. |
| Windows `Projects/Driftwing-Codex` | `feat/windhaven` / `59dc52c` | Duplicate guidance edits/guide retained; committed/pushed snapshot `recovery/cloud-20261011/driftwing-codex-guidance` (`c63abb9`). Windhaven code itself committed and remote. |
| Ubuntu `Driftwing-Codex` | `dev/codex-wsl` / `30756b2` | Clean after guidance commit. |
| Ubuntu `Driftwing-SkyLance` | `exp/sky-lance-v1` / `0bb2498` | Clean after full prototype commit. |

All original local branch tips were also pushed under `recovery/cloud-20261011/windows/*` and `recovery/cloud-20261011/ubuntu/*`. No reset, clean, stash, force-push, source discard or branch deletion was used. Windows duplicate edits remain intentionally untouched; they are no longer unique/unpublished work.

## Work deliberately not merged wholesale

- `windhaven/checkpoint-2026-10-10` (`974bb32`): original old-baseline blockout; superseded by the reviewed current-main Windhaven sequence. Pushed unchanged for recovery.
- `dragon2/a` (`4d68d42`), `dragon2/c` (`4782492`), `dragon2/l` (`cd5d8b3`): older, divergent fidelity/LOD/landing/life experiments; not substitutes for the current tested rider/flight baseline. Remaining branch-only work requires separate compatibility/visual review. Already on GitHub; retained unchanged.
- `wip/handoff` (`5aefc4e`): historical divergent snapshot with eight branch-only commits, not a current integration candidate. Already remote; retained.
- `experiment/aerial-sport` (`844e5c2`): currently identical to the starting main, no implemented sport changes. Preserved, no feature inferred.
- Other historical `feat/*`, `fix/*`, `dragon/int`, `dragon2/b`, `integ/b8*` tips are already ancestors of the starting main. They add no unique commits to this consolidation.
- Recovery guidance branches retain each checkout's original instruction context; main receives the reconciled shared instructions rather than replacing them with Claude's older gameplay-backlog wording.

## Validation and remaining risks

Combined source before handoff/browser-harness completion: focused **282/282**, full **1,129/1,129 across 108 files**, typecheck and production build passed; existing production smoke **15/15** passed. Additional combined-feature browser results and final GitHub CI are recorded in the latest AI_HANDOFF entry and PR evidence. Do not read historical pass counts elsewhere as fresh validation.

Known limitations: static-only anchors and no rope wrapping; an obstructed line can stop the rider at its preceding clear endpoint rather than cut unexpectedly. Invalid anchors/impossible recovery still detach safely. Long grazing/underside queries can be expensive despite bounded work. No physical GPU/controller certification, no exhaustive clothing/wing/hitch clearance approval, and no networking. Very brief launch taps can be lost on a render frame with no fixed step; the live test uses held flap input. The existing first-discovery tutorial can overlay experimental inspection on a fresh save. Windhaven and Windline remain separate experimental scenes. Future shared scene placement and moving-ship traversal need explicit design/implementation scope.

Deployment remains `.github/workflows/deploy.yml`: pushing main runs tests, build, production smoke, then GitHub Pages. `.github/workflows/verify.yml` validates PRs, including both experimental scenes, without deploying them. Repository rules/required checks must be respected; publication does not imply every older feature branch is approved.

The live Windhaven browser harness uses a 120-second wall-clock allowance, matching its capture pass, because software-rendered CI advances simulation below real time. Climb height, deck support and all physical assertions remain unchanged; launch failures record actual simulation time and player/input state.
