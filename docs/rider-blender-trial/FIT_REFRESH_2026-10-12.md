# Rider fit refresh — October 12, 2026

> **PR publication note (October 12):** This document records the full preserved
> local trial at `codex/rider-blender-trial`, including historical restrictions,
> local paths and larger source/evidence inventories. The current separate PR
> preparation stage, included files and fresh candidate results are recorded in
> [MERGE_REVIEW.md](MERGE_REVIEW.md) and [README.md](README.md). Earlier no-commit
> wording remains historical; the current instruction permits PR preparation and
> explicitly stops before merge/deployment. Excluded artifacts remain preserved
> locally rather than being silently represented as included in this package.

The current Windkeel rests close to the rider in the inspected Stable and gameplay views. The Travel shoulder cloth remains a thin connected wrap across both shoulders, with a narrow leather keeper on the right. This continuation verified the already-completed fit; it made no additional geometry, runtime, editable-source or export changes.

Branch `codex/rider-blender-trial`, HEAD `8e055069703c83308d5508ee72e5ad1d15ef348e`, with the existing uncommitted trial overlay. No commit, push, merge or deployment. The guide was reread and the continuation acknowledged. Blender 4.5.14 LTS remains the existing portable installation; no software or dependency was added.

## Fresh evidence

| Evidence | Result and limits |
| --- | --- |
| Full fit, 06:27–06:30 UTC | 32 captures / four cases / zero errors: Medium Travel; Slight and Broad mixed Travel pieces; Medium Flight. Each completes actual takeoff, landing and dismount. Active Windkeel, one shared skeleton, four sockets and finite surfaces retained throughout. |
| Stable and mounted visual review | 16 Stable front/left/right/back plus eight gameplay mounted-side views inspected. Both shoulders and both mounted sides covered. No gross detached cloth or suspended main straps in these views. Mounted distance cannot certify millimetre clearance or hidden surfaces. |
| Original on-foot frames | Eight retained for technical/state provenance, excluded from visible-fit acceptance because the companion obstructs framing. |
| Clear on-foot supplement, 06:35–06:36 UTC | Eight Medium Travel/Flight walk/run front/back views inspected and accepted for bounded visible-fit evidence. Actual foot follow rig, normal collisions, no camera override, explicit scripted input and fresh nonpersistent Edge contexts. Zero errors; source hashes unchanged. |

The supplement uses an existing terrain staging point and normal Player teleport, then real grounded locomotion/animation/live cloth. Walk moves 1.6381 m and run 2.4493 m over 0.45 s. It supplements the full-fit takeoff/landing/dismount proof. The Travel shoulder stays one connected component in all sampled poses; maximum duplicated-seam numerical separation is below 0.00014 mm. This measures seam connectivity, not fabric thickness or total body clearance. The intended authored linen thickness remains 2 mm. Four live Travel skirt panels remain active. Flight does not contain the Travel shoulder wrap.

These captures use Edge/ANGLE SwiftShader. They establish bounded appearance and scripted gameplay-state evidence, not physical-controller acceptance or hardware performance. Final concept likeness, arbitrary-world/self collision, exhaustive layer intersections, integrated-GPU Low, GPU time and total VRAM remain unverified.

## Preservation and checks

The original rider worktree's 1,851 preserved file hashes and Git status remain unchanged. All 1,112 archived trial checkpoint files matched before and after fresh QA, before these deliberate documentation/evidence additions. Owner worktree/services/saves were preserved. Selected GLB: 19,110,536 bytes, SHA-256 `d6f2ffa790d43e8217ab6d64bdfdf994b424d1d5cb1d1b8685403b2001d40dc8`. Editable `.blend` SHA-256 `0b69bcbb74153a0f0bc993ee756f59048db22e5fc0d5e7a7990c39465b9fa9c4`.

Historical checks for this unchanged implementation remain typecheck, 1,310 tests/124 files, existing/authored garment audits and build PASS. They were not rerun without source changes. The original full-browser workflow remains 14/15; the software CPU gate remains baseline-reproduced and unresolved. This refresh does not turn it into an all-green release candidate. See [QA.md](QA.md) for exact failures and measured costs.

All 40 capture bytes were readback verified. [The JSON record](FIT_REFRESH_2026-10-12.json) contains original paths, source/output hashes, copied-evidence paths and qualified visual review. Original reports and rejected frames remain retained. The recovery receipt retained in the original trial (`FIT_REFRESH_RECOVERY_2026-10-12.json`) identifies the verified full overlay plus this additive QA/documentation backup and review delta; no original archive was replaced.

## Review

Open the fresh gallery retained on the [preserved trial service](http://127.0.0.1:5210/docs/rider-blender-trial/fit-refresh-2026-10-12.html), [earlier matched old/new comparison on the preserved trial](http://127.0.0.1:5210/docs/rider-blender-trial/review.html), or [normal-menu trial](http://127.0.0.1:5210/?riderTrial=blender&quality=low). In Edge InPrivate, open Stable → Outfit → Travel Drape and mix normally. [Preserved current presentation](http://127.0.0.1:5211/?quality=low) remains separate. [README.md](README.md#windows-launch) has Windows restart commands. Keep the rider/harness unmerged and local.

The fresh gallery delivery check passes all five checks: four local entry links and all 40 full-size evidence images decode, with zero browser/resource errors. The first attempt caught a missing gallery favicon; the gallery now reuses the existing embedded game icon. Both attempts and the small documentation-only correction are preserved in `FIT_REFRESH_DELIVERY_2026-10-12.json` retained in the original trial.
