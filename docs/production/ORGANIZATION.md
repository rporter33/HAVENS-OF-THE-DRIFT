# Documentation organization and preservation

Baseline: `88764f93e4c54e7b28ff8d0951c963e8b12c6db0`, tree `8e740d9f8f38de3c9c585fd481440576cf815d93`. Organization branch: `codex/production-organization-20261014`.

## Authorized scope

The owner's request to reorganize the project for producing an indie game, followed by the same-repository website and separate-master-archive choices, authorizes this bounded organization. Commit/push and a separate draft PR were approved after validation. Merge, deployment, external asset relocation, archive setup and LFS/history/settings changes remain outside scope.

Added nine navigation/status files: documentation map, production status/decisions, design/tools/QA/release/history indexes and asset ownership. Added an initial six-entry asset register and record template. Root README/development/architecture navigation now acknowledges the Dragon Circuit fork and existing bundled music/fonts.

## Current-to-canonical path map

Each old path is a compatibility page. Its title and explicit section anchors point to the complete document, retaining original headings and historical claims. Canonical content changes are limited to necessary document-path/relative-link updates.

| Former path | Canonical path |
|---|---|
| `docs/M1_FIRST_LEAD_BRIEF.md` | [docs/design/M1_FIRST_LEAD_BRIEF.md](../design/M1_FIRST_LEAD_BRIEF.md) |
| `docs/WINDHAVEN.md` | [docs/design/WINDHAVEN.md](../design/WINDHAVEN.md) |
| `docs/REGION_EDITOR.md` | [docs/tools/REGION_EDITOR.md](../tools/REGION_EDITOR.md) |
| `docs/REGION_EDITOR_ART_REVIEW.md` | [docs/qa/REGION_EDITOR_ART_REVIEW.md](../qa/REGION_EDITOR_ART_REVIEW.md) |
| `docs/AUDIO_QA_2026-10-11.md` | [docs/qa/reports/AUDIO_QA_2026-10-11.md](../qa/reports/AUDIO_QA_2026-10-11.md) |
| `docs/WINDLINE_NEUTRAL_RETICLE_2026-10-11.md` | [docs/qa/reports/WINDLINE_NEUTRAL_RETICLE_2026-10-11.md](../qa/reports/WINDLINE_NEUTRAL_RETICLE_2026-10-11.md) |
| `docs/WINDLINE_PRIORITY_REVIEW_2026-10-11.md` | [docs/qa/reports/WINDLINE_PRIORITY_REVIEW_2026-10-11.md](../qa/reports/WINDLINE_PRIORITY_REVIEW_2026-10-11.md) |
| `docs/WINDLINE_REPAIR_QA_2026-10-11.md` | [docs/qa/reports/WINDLINE_REPAIR_QA_2026-10-11.md](../qa/reports/WINDLINE_REPAIR_QA_2026-10-11.md) |
| `docs/WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md` | [docs/qa/reports/WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md](../qa/reports/WINDLINE_RETICLE_PERFORMANCE_2026-10-11.md) |
| `docs/WINDLINE_SWEEP_SPIKE_2026-10-11.md` | [docs/qa/reports/WINDLINE_SWEEP_SPIKE_2026-10-11.md](../qa/reports/WINDLINE_SWEEP_SPIKE_2026-10-11.md) |
| `docs/CLOUD_HANDOFF_2026-10-11.md` | [docs/history/CLOUD_HANDOFF_2026-10-11.md](../history/CLOUD_HANDOFF_2026-10-11.md) |

## Preservation contracts

- Keep `src/**`, tests/golden fixtures, `scripts/**`, HTML entry points, package/lock/config and workflows unchanged. No gameplay or runtime path changes are required by this documentation grouping.
- Keep all asset/evidence binaries, JSON captures and the supplied ZIP/extracted pack at their original paths. Keep `docs/art/.gitattributes` and the source pack's own stale text intact.
- Preserve all historical tested SHAs, pinned Driftwing URLs, failures, device limits and approval boundaries. Former “next actions” do not describe the current task.
- Twelve pre-existing wardrobe PNG links inside the immutable pack remain documented exceptions; [the corrected lookup](../ART_DIRECTION.md#verified-image-lookup) maps them to actual JPGs. Add no new broken references.
- The separate archive is pending. Asset records do not move files, verify outside-repository resources or introduce private/local build dependencies.

## Validation record

Local content/path validation passed: all eleven moved bodies match their original content after only recorded path/link edits; headings, legacy anchors, historical commit identifiers and external links are retained. No new missing local paths or anchors were found; 1,777 code-reference targets resolve and 531 other baseline files retain their Git identity (normal Windows text conversion accounted for). The ZIP CRC, all 32 extracted-byte comparisons and all 31 manifest hashes pass. Six initial asset records parse, and four committed-file hashes match baseline Git bytes; external verification and rights remain pending.

The existing package has no documentation test command. Runtime type/unit/build/browser checks were not run: this isolated worktree has no `node_modules` or local TypeScript/Vitest/Vite executables, and installing dependencies is outside this task. Source, runtime paths, tests, build configuration and scripts are unchanged. Historical test counts remain attached to their original source heads. The publication review also checks the complete staged file allowlist and Git whitespace diff.

## Review and rollback

Review the complete document destinations alongside old-path compatibility pages and the baseline diff; Git may display these as modified stubs plus new documents rather than renames. Verify source/art/evidence identities before publication. A later merged organization change can be reverted with its reviewed commit or the inverse map above; do not hard-reset a dirty/shared checkout. Keep compatibility pages, originals, external studies and backups through review. No asset movement or backup pruning is needed.
