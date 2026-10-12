# Rider/Windkeel PR preparation — October 12, 2026

Latest CI/performance follow-up: [12 October resolution](CI_RESOLUTION_2026-10-12.md).
The earlier failure records below remain historical evidence.

Robert requested a separate PR and explicitly selected **prepare PR; stop before
merge**. This supersedes the trial's earlier no-commit/no-push boundary only for
preparing this review branch. No merge, deployment or production-default change
is authorized. PR #13's documentation-only session guide stays separate.

## Candidate and preservation

Branch `codex/rider-windkeel-review`, isolated checkout
`C:/Users/Robert/.codex/worktrees/rider-merge-review/Driftwing`.
The candidate starts from released main `81761be3a4ce53ee1c90cdd9957a3171fe704a8a`
and includes the required rider baseline `8e055069703c83308d5508ee72e5ad1d15ef348e`.
Only the handoff conflicted; both the complete main-only Lantern notes and the
trial's history were retained. All 14 other main-only files have identical Git
blob identities after the merge/overlay. The initial preservation guard compared
LF Git bytes with a CRLF checkout; its corrected Git-clean-filter comparison
confirmed no released Lantern content had changed.

The authored runtime and both GLBs SHA-256 match the physically playtested local
trial. Independent source review found no actionable runtime defect in opt-in,
shared skeleton, coverage, current-look async adoption, stale/disposal guards,
candidate-before-release fallback, shader dyes or once-only cloth motion. That is
source inspection, not a substitute for the validation results below.

Original rider, owner checkout, playtested trial, planning files, ignored source,
earlier releases, recovery ZIPs, saves and ports 5210/5211/5214 remain preserved.
The review candidate uses its own dependency copy and ports 5216/5217 with fresh
nonpersistent QA contexts. No global tool, dependency, LFS or system change.

## Publication boundaries

The PR includes the saved native .blend, fitting/bind/construction inputs,
uncompressed runtime GLBs, reproducible exporter, selected motion-fit JSONs and
their recorded provenance, fresh fit captures and small historical QA reports.
The package manifest records exactly what is published. Complete raw references,
older evidence, portable Blender, backup `.blend1` files and recovery archives
remain in the preserved local trial; old manifests describe those larger packs.

Historical audit/wrapper scripts requiring excluded reference GLBs or unpublished
runner dependencies are kept in the original trial rather than advertised as
runnable PR tools. The existing .blend exporter needs only its hash-checked fitting
inputs and Blender; it does not need the excluded raw reference packs.

The local `README_SESSION.md` is an unstaged session reference. Neither that file
nor PR #13's AGENTS/CLAUDE reminder changes belongs in this rider PR. PR #10's
whole branch and PR #9's island asset kit are not integrated. No dragons, ships,
environment assets, new mechanics or cosmetic-platform work is included.

## Validation

Candidate typecheck, full-unit retry **1,322 tests /125files**, separate existing
and authored garment/contact audits (2tests each), and production build passed.
The first full unit run timed out on one unchanged legacy atlas test (1,321pass /
1fail); isolated unchanged retry passed15/15, then the full retry passed. No
timeout/tolerance was enlarged. Both initial and retry logs are retained.

Actual-engine fit passed4cases /32captures with actual takeoff/landing/dismount
in each. Gameplay/lifecycle26checks, Stable14checks, all3build motion
regressions, production/offline delivery4checks and smoke15/15 passed. The
gameplay failure fixture deliberately logs a404 and verifies recovery; it is not
an unexpected-error-free run. The intentional missing-browser probe exited1,
wrote its report and released its owned port after the QA cleanup fix.

The full existing browser batch passed **14/15**; only the original CPU cost gate
failed. The automatic baseline attempt initially stopped at a build-identity
assertion before measuringCPU. Its corrected baseline-only run explicitly tested
8e05506 and exited1. Original attempts and exact timings are retained.
These are generated-provider opt-out tests on both builds, not an authored rider
comparison. The cause remains unresolved; historical isolated baselinePASS /
trialFAIL and batchbaselineFAIL records are not discarded.

| Run | Depth | Swingp50ms | Swingp95ms | Swingp99ms | Queries/step |
| --- | --- | --- | --- | --- | --- |
| candidate | 18 | 2.90 | 7.20 | 10.50 | 474 |
| candidate | 55 | 4.80 | 23.00 | 55.50 | 1439 |
| corrected baseline | 18 | 4.20 | 65.50 | 867.10 | 474 |
| corrected baseline | 55 | 6.90 | 34.30 | 84.20 | 1439 |

All14non-handoff released-main files retain their Gitblob identities. Runtime
and GLB hashes match the playtested trial. The candidate exporter (only a trailing
blank line removed) independently re-exported79regions byte-for-byte; originals
remained unchanged. Threecurrent candidate images and20independently reviewed
side/back/mounted images support bounded visible fit. Mounted distance does not
certify fine clearance; obstructed on-foot frames are not counted.

[PR_VALIDATION.json](PR_VALIDATION.json) identifies source hashes, results,
qualifications and copied raw reports/logs. This is a precommit working/index
source record; the tested dirty build shows81761be. The final PR head and its
exact-head CI provide publication identity. New Linux authored CI remains to be
observed after publication; no all-green readiness is claimed.

The unchanged software CPU gate remains an open merge-readiness issue. No
assertion/tolerance was loosened. DedicatedGPU measurements do not cancel it.
A draft PR is a review artifact, not a merge recommendation.

## Next boundary

Commit and push only `codex/rider-windkeel-review`, open a separate draft PR and
record exact-head checks. Stop before merge. The main deployment workflow runs
on pushes to main and manual dispatch; this task performs neither and does not
edit that workflow. Any future approved merge must reconcile the no-deployment
instruction before execution. Pages continues to serve the previously approved
Lantern Dash release.
