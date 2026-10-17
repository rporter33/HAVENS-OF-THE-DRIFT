# Asset ownership and provenance

[Art authoring hub](../Art%20and%20Assets/README.md) · [Owner decisions](../docs/production/DECISIONS.md) · [Release evidence](../docs/release/README.md)

Use [the asset register](catalog/register.json) for availability, locations, provenance and verification gaps. [The record template](catalog/template.json) supplies fields for future authorized asset work. `null` means unknown/not recorded; pending/unverified status is not a negative rights determination or proof of missing external files.

## Current ownership

| Material | Authority and location |
|---|---|
| Procedural runtime geometry | `src/creatures/`, `src/world/` and related source/contracts; there is no stored generated-creature pipeline at this checkpoint. |
| Bundled runtime title music | `src/audio/assets/driftwing-intro.mp3`, imported by `src/audio/Audio.ts`; keep that runtime path. Asset-specific creator/source/rights need evidence. |
| Concept references | `assets/concepts/` contains a mechanics SVG and small supplemental WebP; neither is a runtime asset. |
| Supplied reference pack | `docs/art/` retains original ZIP, extracted pack, manifest and text-preservation attributes. Shared visual guide supplies corrected lookup/authority. |
| External female study | Reported in Blender lessons; workstation files are not committed or a portable build dependency. Original Tripo provenance remains intact. |
| Website storyboard | Eight original PNGs reported in a private Library ZIP; no committed originals, download/restore/rights verification pending. |

## Register rules

Committed-file hashes in the initial register are SHA-256 of exact Git-blob bytes at the recorded baseline commit. They do not certify input rights or external/master integrity. Record source/creator, asset-specific terms/attribution evidence and unresolved issues before shipping. Never invent a hash, model version, license or QA result. Never put credentials or expiring signed URLs into the register.

For generation, record actual Meshy UI/API route/model/version, prompts/settings/task ID, generation date, approved input paths/hashes/rights and raw downloads. Retain original Tripo records. For authoring/export, record Blender/tool versions, master/dependency hashes, settings, measured geometry/material/texture/bone counts, units/axes, accepted export hash and QA evidence.

## Separate master/raw archive

The owner selected a separate backed-up archive for large editable masters and raw downloads. **Destination: the private repository `rporter33/havens-archive` (selected 2026-10-17).** It holds the rider Blender masters (`assets/rider-blender/source/`, restore verified 2026-10-17) and the review-capture evidence; see the register entries `rider-trial-blender-master` and `review-scripts-2026-10`. Use a stable archive ID and versioned relative keys once selected. Local workstation paths are optional reported locators, never portable build dependencies.

Distinguish `destination_pending`, `not_archived`, `archived_restore_unverified`, `restore_verified` and `missing`. A vendor or Library link is not a backup. First copy originals, verify all hashes/companion resources, establish independent backups, then restore into a new directory and reopen/re-export before recording restore verification. Keep originals until retention is explicitly settled.

Accepted game-ready exports can later be committed under `assets/runtime/<asset-id>/<version>/` with their register record and explicit Vite import, only within an approved integration task. Unreviewed candidates can remain in the archive; naming a GLB does not make it game-ready. Existing runtime assets keep their current paths.

Normal builds must use committed source/accepted exports without private archive access. Regeneration should stop with explicit missing-file/hash/version diagnostics if archive resources are unavailable; never silently substitute `latest`, a regenerated body or a placeholder. Preserve raw outputs because AI prompts do not guarantee identical regeneration. Downstream export reproducibility needs pinned tools/settings and disclosed limits.
