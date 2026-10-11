# Region workshop foundation

This is a new, bounded authoring slice on `feat/region-editor-foundation`, based on main `bc86843a494c64bed347ca6cdca7c52e3ef1ee66`. It is not a recovered Claude editor. Historical release sources remain uninspected because authenticated binary release downloads were denied; that gap does not establish whether the older editor existed.

## Staged scope

The plan published before coding was: (1) an isolated region document and editor for island parameters, curated props, checkpoint ordering, undo and JSON validation; (2) a sandbox retaining the canonical archipelago and required anchors with progress held in memory; (3) repeated browser workflows, normal-game regression checks and rendered review in a draft PR. Puzzle authoring is the next separately reviewed stage. No puzzle graph, unrestricted sculpting, ship work, character updates, RPG systems or multiplayer are included.

## Start and use

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/editor.html`. The regular game remains at `/`. Production builds include `editor.html` and `editor-playtest.html`, with relative asset URLs for subpath hosting.

1. Choose a terrace, meadow or rock island and add it. Select its contents entry to edit position, height, radius, hill relief, underside depth, outline, flat centre, rim and seed. Drag the coloured translation handles; the snap button alternates between 1 m and 5 m.
2. Choose limestone column, blue terrace block or supply crate, then click an island's upper surface. Edit the owning island, local X/Z, facing and uniform size. Height follows the same analytic surface used for rendering and collision. Moving the island carries its attached props; deleting it removes those props in one undoable operation.
3. Select the race / flight start and add ordered checkpoints. Set position, opening radius and facing. Earlier/Later changes order; Face checkpoints along route sets their approach directions. An empty checkpoint list creates a free-flight sandbox.
4. Review blockers and cautions. Click a message to focus its object. Blockers prevent Playtest; incomplete regions can still be saved or exported. Clearance checks are conservative and do not certify that every route is flyable.
5. Save keeps one region on this browser. Export JSON makes a portable copy. Load and Import are undoable. Closing a tab loses its undo history; export before changing computers or clearing browser storage.
6. Playtest opens the regular game controller in a separate iframe using a region snapshot. Repeated activation during boot reuses the one sandbox; the button stays disabled until Return. Fly route restarts the authored course. Walk island starts on the first authored island. Capture mouse enables flight camera input; Escape releases it. Return to editor retains the current draft and undo history.

Drag empty space to orbit, use the wheel to zoom, and Focus selection / F to inspect. Ctrl/Command Z undoes; Shift Z or Ctrl/Command Y redoes. Delete removes the selected item outside text fields. The UI is intended for desktop mouse and keyboard; touch and narrow-screen authoring are not verified.

## Document and geometry contract

`src/editor/region.ts` whitelists version 1 JSON. It bounds finite numbers, unique IDs, owners and counts: 12 islands, 80 props, 20 checkpoints, 200 KB. Unknown versions and invalid documents are rejected atomically. Extra fields, scripts, automatic dressing densities and imported canonical landmarks are stripped. Documents contain data only; import never executes code.

Preview and playtest both use `World`, `Terrain`, existing analytic island shapes and `buildAssets`. Column collisions include the shaft, base and capital. Terrace/crate boxes come from their generated geometry bounds. Uniform scale and yaw apply to rendering and collision together. Arbitrary imported meshes and vertical prop offsets are outside this slice.

The sandbox appends authored islands at X + 8,000 m and expands its own world boundary. It preserves the original islands, Roost/spawn/stable, shrine, dock and dressing terrain; it does not replace canonical island IDs or anchor definitions. Automatic dressing remains restricted to the original terrain so authored islands contain only editor-visible manual props. Returning from playtest destroys the iframe and its game instance. Respawn still leads to the canonical Roost; use Fly route to return to the authored region.

The ordinary game has only opt-in constructor defaults in `Game.ts` / `World.ts`; movement, reticle, input, save implementation and shared collision algorithms are unchanged. `vite.config.ts` adds the two separate HTML entrypoints. No runtime dependencies were added.

## Persistence and limits

Authoring uses `driftwing.authored-region.v1` in local storage, `driftwing.editor-session.v1` for the tab draft, and `driftwing.editor-playtest.v1` for the validated snapshot. The sandbox injects `LocalSaveStore` with no persistent storage and `MemoryGhostStore`; it skips first-launch player-save detection. It neither loads nor writes ordinary player progress or IndexedDB ghosts. One saved region per browser is supported; use JSON files for multiple regions. The editor does not publish regions into the regular campaign.

Undo/redo retains 60 whole-document transactions, including import, order changes and cascading deletion. Editor terrain rebuilds after committed edits, not on every drag event. The small caps are deliberate; large-region performance, long sessions and physical GPU/controller behavior are not certified.

## Verification and review

```sh
npm test -- src/editor/region.test.ts
npm test -- --maxWorkers=2
npm run build
CHROMIUM_PATH=/usr/bin/chromium node scripts/smoke.mjs --no-build
npm run preview -- --host 127.0.0.1 --port 5399 --strictPort
CHROMIUM_PATH=/usr/bin/chromium node scripts/editor-check.mjs http://127.0.0.1:5399/
```

Omit `CHROMIUM_PATH` to use Playwright's installed Chromium. The editor harness records its exact Git head, dirty status, browser, captures and result in `/tmp/driftwing-editor-evidence/browser-report.json`; `EDITOR_EVIDENCE_DIR` selects another output directory. It exercises three edit/undo/redo/save/load/playtest/return cycles, repeated Enter and pointer double-click during delayed boot with exactly one iframe, actual gizmo dragging and prop placement, checkpoint reordering, mouse capture/release, blocked playtest, export/import/reload, escaped text and save/ghost isolation. The focused unit suite also flies the starter course through the existing deterministic flight/race geometry and checks rendered/collision prop support.

The draft PR records the final tested head and outcomes. A separate authoring verification workflow builds the production entries, repeats this browser harness and uploads evidence. Existing integration verification remains unchanged. Software Chromium evidence is not a physical-device or owner visual approval.

See [rendered comparison and outstanding art review](REGION_EDITOR_ART_REVIEW.md). Please review the desktop workflow by moving and shaping an island, placing a prop, editing a route, then completing Playtest / Return / Undo / Save / Load. Review the column width, terrace scale, blue accent and bases from the on-foot camera before expanding the palette. Puzzle design should begin only after this foundation has meaningful workflow feedback.
