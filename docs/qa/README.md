# QA and evidence

[Documentation map](../README.md) · [Tools and reproduction](../tools/README.md) · [Release gates](../release/README.md)

Evidence applies to the named tested head/tree/build and environment. Historical passes, failed experiments and pre-commit images are not current-main certification. Retain those identities and limits when adding evidence.

| Report | Evidence role |
|---|---|
| [Region editor art review](REGION_EDITOR_ART_REVIEW.md) | Per-category source/image comparison and incomplete owner review; images remain in `editor-foundation/`. |
| [Audio QA](reports/AUDIO_QA_2026-10-11.md) | Dated interaction/audio evidence; original WAV locations are external/temporary, not committed assets. |
| [Neutral reticle scope](reports/WINDLINE_NEUTRAL_RETICLE_2026-10-11.md) | Selected neutral-dot behavior and required regressions at its historical checkpoint. |
| [Priority review](reports/WINDLINE_PRIORITY_REVIEW_2026-10-11.md) | Dated controller/freefall/HUD findings and limits. |
| [Repair QA](reports/WINDLINE_REPAIR_QA_2026-10-11.md) | Collision/HUD repair and original before/after evidence. |
| [Reticle performance](reports/WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md) | Superseded predictive experiment; retain original failures and measurements. |
| [Sweep spike](reports/WINDLINE_SWEEP_SPIKE_2026-10-11.md) | Earlier failed performance head, preserved for comparison. |
| [Reticle 0fcc709](WINDLINE_RETICLE_0FCC709.md) | Raw historical captures and exact source identity; later status is separate. |
| [Lantern Dash review](LANTERN_DASH_REVIEW.md) | Private review workflow, not human usability or release approval. |
| [G4 bond expression v1](G4_BOND_V1.md) | Staged headless captures of the Windhaven greeting and the anticipatory lean, with hashes; images not committed. |

## New evidence record

Record capture date, tested full commit/tree, runtime build stamp, runner identity/dirty state, browser/device/input/quality/viewport, exact command and server mode, artifact paths/hashes, outcome and coverage limits. Distinguish Blender stills, staged/debug views, normal gameplay, automated controller input and physical-device testing.

Committed PNG/JSON evidence remains at its existing paths; do not relabel it as freshly captured. Existing CI artifacts have 30-day retention, so they are not a permanent asset archive. Check retrieval before relying on an old artifact URL. New temporary output should be reviewed and indexed deliberately, with missing evidence explicitly marked.

For this organization, see [preservation and validation](../production/ORGANIZATION.md). The immutable reference pack retains twelve legacy PNG-link exceptions; the [shared visual guide](../ART_DIRECTION.md#verified-image-lookup) supplies corrected JPG paths.
