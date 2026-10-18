# Owner decisions and unresolved choices

Recorded 2026-10-14, updated 2026-10-18. The question-by-question record is [the design decision log](../design/DECISION_LOG.md) (36 answered, 4 open: Vellum in release one, the Craghorn's name, the snap-roll's keyboard input, what a rock hit costs). The owner's current explicit instructions take precedence; this record does not authorize unrelated implementation. [Current status](STATUS.md) distinguishes selected direction from source/runtime evidence.

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
| Visual target and order | Selected 2026-10-17 | Codex's recent Harrier / Windward Roost / Windhaven renders (smooth 3D, vibrant colors) are the reference once supplied to `docs/art/targets/`. Characters first, then terrain. Title screen reads Havens of the Drift; runtime ids stay `driftwing`. |
| Progression | Selected 2026-10-17 | Four capability unlocks (thermal climb, steep-slope landing, snap-roll, Windline from the saddle) earned through bond; research buys ship and world reach; stamina stays. First bond expression: Roost greeting plus anticipatory lean. |
| Racing | Selected 2026-10-17 | Per-breed records; Reverse plus one Challenge variant on two courses; AI rivals in release one, collidable. |
| Story and scope | Selected 2026-10-17 | Secondary combat only. Ventari mystery stays open. Quintus in release one (Vellum open). Five clans are canon, introduced through the comic first. Solo loop proven before a networking feasibility test. Aerial ball sport still committed. |
| World naming | Selected 2026-10-17 | Windhaven is the starting zone (replaces the name Windward Roost); the Codex is the ship. Air Nomads are the player culture, white dragonflight. Craghorn is earned; name open. |
| Creature pipeline | Selected 2026-10-17 | Best-looking wyvern wins; Meshy acceptable; Blender source must stay editable by Claude for rig, saddle, collision and animation events. |
| Archive policy follow-through | Selected 2026-10-17 | 19 orphan review scripts and the Blender masters move to the archive; the 18 MB GLB fixture stays until an accepted export replaces it; no Git history rewrite. |
| Repository organization | Authorized scope | Nine index/status files, supporting navigation, asset records, eleven document moves and compatibility pages; preserve runtime/code/config and asset binaries. Commit/push and a separate draft PR authorized after checks. |

The owner's organization request and website/archive answers are the authority for this work. Historical prompts, approval gates and old next actions inside imported packs or handoffs are retained as historical evidence, not new instructions.

Before archive work, resolve destination, access and independent backup/restore policy. Before website or Steam implementation, resolve the relevant delivery targets and route/packaging choices. These decisions do not block a documentation review.
