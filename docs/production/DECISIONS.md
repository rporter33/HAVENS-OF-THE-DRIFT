# Owner decisions and unresolved choices

Recorded 2026-10-14, updated 2026-10-17. The question-by-question record is [the design decision log](../design/DECISION_LOG.md) (6 of 23 answered). The owner's current explicit instructions take precedence; this record does not authorize unrelated implementation. [Current status](STATUS.md) distinguishes selected direction from source/runtime evidence.

| Decision | State | Consequence |
|---|---|---|
| Keep the comic/lore website with the game | Selected by owner | Same repository, for a later coordinated release. Retain `docs/website/` planning; choose app/build routes only when website implementation is scoped. |
| Large Blender masters and raw generator downloads use a separate backed-up archive | Selected by owner | Git tracks provenance, versions, locations and approved game-ready exports. Do not treat private archive access as a normal build requirement. |
| Archive destination, access owner and backup policy | Destination selected 2026-10-17 | Private `rporter33/havens-archive` (owner: Robert). Evidence captures are there with a SHA-256 manifest. Blender masters and raw downloads are not yet moved; an independent restore check is still owed before recording restore-verified status. |
| Meshy as primary generation tool plus Blender | Selected on 2026-10-14 | Follow the Meshy guide; retain existing Tripo attribution and source identity. No runtime compatibility is implied. |
| Racing-first fantasy, intelligent companions, modular cosmetics | Current direction | Existing implemented behavior and future design must be distinguished; additional dragons, lore and systems need their own task scope. |
| Steam eventual release and multiplayer later | Intended future work | No desktop wrapper, Steam integration or networking migration is chosen by this organization task. |
| Mount roster: both wyvern and dragon | Selected 2026-10-17 | Wyvern remains the shipped mount; dragons need the new rig before any player-facing promise. |
| Same game as Driftwing with upgraded looks | Selected 2026-10-17 | Saves, ids and physics stay. A texture/material upgrade toward the latest renders is approved direction; its implementation needs its own gate. |
| Keep Windline | Selected 2026-10-17 | Not cut. Core-vs-unlocked still open (Q15 follow-up). |
| Keep the Drift | Selected 2026-10-17 | No new compact cluster. Focus one quadrant first. |
| Platform: repository is the single source of truth | Selected 2026-10-17 | Mr. Mak workspace retired; Claude app plus GitHub plus the hand-built hub at `public/hub/` (deployed at `/hub/`). Evidence binaries live in `rporter33/havens-archive` (mirrored on branch `archive/evidence-2026-10-17`). |
| Repository organization | Authorized scope | Nine index/status files, supporting navigation, asset records, eleven document moves and compatibility pages; preserve runtime/code/config and asset binaries. Commit/push and a separate draft PR authorized after checks. |

The owner's organization request and website/archive answers are the authority for this work. Historical prompts, approval gates and old next actions inside imported packs or handoffs are retained as historical evidence, not new instructions.

Before archive work, resolve destination, access and independent backup/restore policy. Before website or Steam implementation, resolve the relevant delivery targets and route/packaging choices. These decisions do not block a documentation review.
