# CI and CPU resolution — 12 October 2026

Robert authorized resolving PR #14's remaining CI/performance issues and preparing
it for merge, with no deployment. The starting published commit is
`25faa147f5b70f207f6bd92132bfe89866b49e9e`. This update changes only the fit QA
harness and evidence/documentation. Every game runtime and authored asset byte
remains unchanged. Existing release work and the separate session guide are preserved.

## Screenshot failure and bounded fix

Original authored CI run 38224942842 failed on its first `page.screenshot`, at the
unchanged 30-second timeout. Garment/contact audit, build, gameplay/lifecycle,
Stable, rear-link motion and delivery succeeded. Its complete 47-entry artifact
is preserved locally with CRC/readback and SHA-256
`f2234f068f1c4814c79f47c3c8214b478573cfbb3da29c08dd5ee3db351cf51c`.
The unchanged local reproduction passed all eight high-quality Medium Stable
views; screenshots took 2.6–5.8 seconds. The initial timeout is retained as evidence.

Inspection found duplicate render submissions before each capture: the first
Stable view could queue three GPU draws. Setup and camera/motion steps now call
`frame(0, false)` instead of drawing. They preserve exactly the same zero-dt
simulation/presentation updates; `capture()` still renders the final real frame.
There is no added retry, raised timeout, quality reduction or altered assertion.
This reduces avoidable queued software-rendering work; it does not prove the
historical timeout's sole cause. Capture timings are recorded for future diagnosis.

The revised local full fit passed four cases and 32 captures, with zero errors,
including actual takeoff, landing and dismount in every case. The maximum
screenshot time was 3.087 seconds. Eight comparable Stable views have exactly
matching component, shoulder, socket, outfit, mode, camera and region measurements.
The Stable front and both mounted-side PNGs were visually inspected; no new
visible fit defect appeared. Mounted distance and obstructed on-foot frames do
not certify fine clearance. High quality, 1440×1080, 30-second screenshot timeout,
12 mm static clearance and zero rear-link crossings remain unchanged.

## CPU gate

The original integration CI run 38224942987 passed all existing checks, including
the original CPU gate. Its 104-entry artifact is preserved locally with SHA-256
`9f5eb4f745baff451eb0d5386b3e38b53cb43feba9a4107b7d7cc2097c0211ad`.
Three additional unchanged local checks ran sequentially, candidate/baseline/
candidate, each in a fresh browser context, with no parallel local QA workload.
All passed. Neither collision code, flight behavior nor performance assertions
were changed. Previously failed distributions remain in the earlier review record.

| Run | Swing p95 at depth 18 (ms) | Swing p95 at depth 55 (ms) |
| --- | --- | --- |
| Candidate A | 4.6 | 12.0 |
| Preserved baseline | 4.5 | 11.1 |
| Candidate B | 11.8 | 8.8 |
| Original integration CI | 5.9 | 5.3 |

The original limit is <20 ms. Each run uses 474/1,439 rock queries per swing step;
the <1,800 moving-line and <100 hanging-query gates also pass. The reported local
timing variance remains real; these passes do not prove its historical cause.
These are generated-provider opt-out tests, not authored-rider/GPU performance
certification. Integrated graphics, GPU time and total VRAM remain unverified.

## Preservation and final gate

All 14 recorded released-main file blobs match. `src/`, `assets/`, dependency
files and deployment workflow have no changes against 25faa147 in this update.
The original rider, playtested trial, owner checkout, services, saves and verified
recovery archives remain intact. The original package manifest describes the
25faa147 publication; this update's evidence manifest describes the supplemental
QA changes. Final PR-head CI must pass before marking this ready for review.
The diagnostic retry of the old head may be superseded by the new commit and is
not counted as a successful corrected-head result. Current CI status belongs in
PR #14; no merge/deployment action is authorized by this document. The existing
main-push Pages workflow is unchanged and would require release authorization
before a future merge is performed.

## Follow-up: browser selection and retained failures

Head `346e233` did not clear final CI. Authored run 38229652284 completed
23 fit captures before a 30-second screenshot timeout, then 11 lifecycle checks
before another screenshot timeout. Stable, motion and delivery passed. Its
52-entry artifact is retained with SHA-256
`f413d81eb421d90d6626d549235e768cc76677e699b3ea8b3e56679fae10435e`.
The completed CI screenshots took 8.37�28.68 seconds. Removing duplicate draws
alone did not resolve this runner's capture bottleneck.

The authored browser helper now explicitly selects full Chromium on Linux,
matching the existing integration RAF check and the full-browser local Edge
path. Playwright's default headless selection instead uses its separate
chromium-headless-shell executable (verified in the installed Playwright source).
This is a browser-environment alignment, not proof that shell choice alone
caused the failures. Three adjacent gameplay capture setups also stop submitting
duplicate GPU draws; their zero-dt presentation updates and the final actual
capture remain. All other motion, quality, disposal and sustained draws remain.
No assertions, screenshot deadlines, quality, viewport or runtime code changed.

Full installed Chromium locally passed all four fit cases and 32 captures with
zero errors. The supplemental summary records per-capture timing, source report
hash and transition evidence. Linux CI must independently pass this configuration.

Integration run 38229652228 also failed the unchanged >=45 callbacks/s painted-UI
gate: 32.39/s, a 228 ms first callback and one 727.9 ms gap, while median/p95
intervals were 16.7/21 ms and mean reticle CPU was 0.0246 ms. The prior passing
run measured 59.92/s. This does not prove the host or compositor caused the gap.
The original 2-second window, 500 ms settling, >=45 rate and <=2.5 ms CPU
assertions are unchanged. One unchanged diagnostic retry was requested; its
result must be reported separately. The failed 29-entry artifact has SHA-256
`c24f3c88a636b49a8b1183dc907bbfb31cf905dace2b8d67fad53b951f39232e`.
Both complete archives and job logs are retained in the external recovery folder.

The local full-Chromium lifecycle follow-up passed 26 checks and 23 captures, including failed-load fallback, late-load Revert, offline changes and sustained replacements, with no unexpected browser errors (the intentional failed-load 404 is retained). Full fit screenshots peaked at 3.357 seconds. Stable measurement fields matched the prior Edge run; dynamic floating-point samples are not claimed byte-identical across browser versions.

## Follow-up: independent real-RAF scenarios

Integration run 38233027057 at f1d98fd reproduced the unchanged painted-UI
failure (32.393 callbacks/s; mean reticle CPU 0.0185 ms). Typecheck, all units,
legacy garment audit, build, smoke and the preceding Windline checks passed.
The later integration checks did not run. The complete failure archive is
preserved with SHA-256
`e844b2b57c0ba26e16bcf03774d0a882b7cf6603e20c6f5bd2085d2ed821e1f9`.
A separate local diagnostic under 4x CPU throttling still passed at 59.996/s;
this does not explain or dismiss the Linux failure.

The reticle QA now gives each of the same three scenarios its own fresh full
Chromium process. Each still boots the normal game, runs its actual RAF/input/
physics/camera/DOM path, and collects all existing rendered and UI evidence.
The UI scenario therefore no longer inherits GPU/compositor queues or adaptive
resolution history from the two preceding slow software-3D benchmarks. This
removes cross-scenario state as a measurement confounder; it does not establish
the precise cause of either historical scheduling gap. Whole Game.frame CPU
durations, dynamic resolution and dressing readiness are recorded for diagnosis.

All assertions and the 500 ms settling / 2-second UI window are unchanged:
>=45 callbacks/s, <=2.5 ms reticle CPU, native pad movement, neutral centred dot,
zero forecast queries, visible document and no 3D submissions during UI timing.
Full-3D scenarios retain >10 rendered samples, >=4 seconds and the 120-second
collection deadline. Startup GL drain and two native RAF transition checks also
remain. Each context checks its browser errors before disposal.

The isolated local run passed all scenarios: painted UI 58.131 callbacks/s,
0.0111 ms mean reticle CPU. Its raw evidence is included. This QA-only change
does not modify the reticle implementation, flight, geometry, wardrobe or assets.
Final-head CI remains required; no historical failure is removed or called passed.
