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
