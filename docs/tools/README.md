# Editor and project tools

[Documentation map](../README.md) · [QA evidence](../qa/README.md)

## Region workshop

Read [region workshop instructions](REGION_EDITOR.md) and [rendered review](../qa/REGION_EDITOR_ART_REVIEW.md). The game remains at `/`, the editor at `/editor.html`, and its iframe sandbox at `/editor-playtest.html`. Production builds include all three pages with Vite's relative base.

Authoring stores one region in the browser; export JSON for portable copies or multiple regions. The sandbox holds player progress/ghosts in memory. Preserve existing player/editor save identifiers and page relationships. No arbitrary mesh import or campaign publishing is established by this editor.

## Automation entry points

Run from repository root with dependencies and a usable Chromium binary already available. `CHROMIUM_PATH` selects a supported existing binary where the script accepts it. Check each script's usage header; defaults differ and output is generated evidence.

| Tool | Purpose / path assumption |
|---|---|
| `npm run typecheck`, `npm test`, `npm run build` | Existing package commands; tests remain under `src/**/*.test.ts`. |
| [smoke.mjs](../../scripts/smoke.mjs) | Builds by default; `--no-build` reuses `dist/`. Serves a subpath and checks production boot/play/pause/quality. |
| [editor-check.mjs](../../scripts/editor-check.mjs) | Production workshop/playtest lifecycle and save isolation. |
| [dragon-capture.mjs](../../scripts/dragon-capture.mjs) | Art/motion capture; root-relative manifest, sibling page helper and `/src/cosmetics/catalog.ts` source import. |
| [audio-qa.mjs](../../scripts/audio-qa.mjs) | Actual audio evidence plus `/src/audio/offline.ts` import; requires the Vite source server. |
| [shot.mjs](../../scripts/shot.mjs) | Deterministic manual-mode screenshot capture. |
| [package-lantern-review.mjs](../../scripts/package-lantern-review.mjs) | Local review package from `dist/` and the Windows launcher; not a release. |

The existing [.github/workflows](../../.github/workflows/) define integration, editor, review-package and Pages checks. Captures may write `shots/`, temporary directories or a selected output path. Do not enable `UPDATE_GOLDEN` for organization checks. A successful headless run does not verify physical controller/haptics or real-device GPU performance.
