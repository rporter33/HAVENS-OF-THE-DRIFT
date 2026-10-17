# History and recovery references

[Documentation map](../README.md) · [Current status](../production/STATUS.md)

Historical records retain their original tested commits, repository names, URLs, failures and approval boundaries. Use the short current-status record for a checkpoint, then reverify the live checkout. Embedded prompts and “next action” text are not fresh authorization.

| Record | Scope |
|---|---|
| [Handoff log](handoff/README.md) | Dated development/organization entries, 2026-10-09 to 2026-10-14, one file per day. The current checkpoint is [docs/HANDOFF.md](../HANDOFF.md). |
| [Evidence archive manifest](EVIDENCE_ARCHIVE_MANIFEST.json) | SHA-256 of the 811 capture files moved on 2026-10-17 to `rporter33/havens-archive` (mirrored on branch `archive/evidence-2026-10-17`). |
| [Cloud handoff](CLOUD_HANDOFF_2026-10-11.md) | Historical consolidation, exact source/recovery identities, backup locations and limits. |
| [Windhaven history](../design/WINDHAVEN.md#version-and-saved-copies) | Dated art passes and external Windows backup index. |
| [Supplied art pack](../art/README.md) | Original ZIP/extracted sources retained byte-for-byte, including historical snapshots and stale references. |
| [QA index](../qa/README.md) | Historical experiments and named-head evidence with outcomes/limitations. |
| [Blender lessons](../../Art%20and%20Assets/Lessons%20Learned/LESSONS_LEARNED_BLENDER_ASSET_STUDIES.md) | Separate external Tripo female study; documentation is not the binary delivery. |

## Recovery boundaries

The cloud handoff reports complete-history bundles, source/evidence archives and a private recovery release in `rporter33/Driftwing`. Windhaven reports five external dated backup folders. Those reported backups are not newly created or restore-verified by this organization change. Keep pinned upstream links as lineage; do not rewrite them to the new repository.

Recover into a new directory. A Git bundle alone does not preserve dirty/untracked/ignored work. Verify archive/hash manifests before claiming recovery and preserve originals through review. Do not reset, prune, delete backups, overwrite worktrees or move external studies as part of documentation cleanup.
