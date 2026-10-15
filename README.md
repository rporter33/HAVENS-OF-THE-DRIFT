# Havens of the Drift

Race and explore on wyvernback across a floating archipelago. Havens of the Drift continues the published Driftwing baseline and the Dragon Circuit documentation organization with TypeScript, Vite and Three.js/WebGL 2. Existing runtime names and saved-data identifiers still use Driftwing.

## Run and check the game

Use Node.js 22, as configured in the existing CI workflows. In a development checkout with dependencies prepared:

```sh
npm run dev -- --host 127.0.0.1
npm run typecheck
npm test -- --maxWorkers=2
npm run build
npm run preview -- --host 127.0.0.1
```

A fresh development setup uses `npm ci` to restore the locked dependencies. Browser checks also require a usable Playwright Chromium binary; see [tooling](docs/tools/README.md) before running captures. The commands are setup guidance, not evidence that checks passed on the current commit.

The game opens at `/`. The [region workshop](docs/tools/REGION_EDITOR.md) opens at `/editor.html`, with a separate `/editor-playtest.html` sandbox. These entry points and the existing relative deployment base remain unchanged.

## Find the work you need

| Work | Start here |
|---|---|
| Current state and owner decisions | [Production status](docs/production/STATUS.md) and [decisions](docs/production/DECISIONS.md) |
| Game implementation | [Architecture](ARCHITECTURE.md), [development rules](AGENTS.md) and [source](src/) |
| Design and lore | [Design index](docs/design/README.md) and [roadmap](docs/ROADMAP.md) |
| Art authoring and references | [Art and Assets](Art%20and%20Assets/README.md) and [asset ownership/register](assets/README.md) |
| Editor and automation | [Tools](docs/tools/README.md) |
| Tests and rendered evidence | [QA](docs/qa/README.md) |
| Browser release and eventual Steam preparation | [Release checklist](docs/release/README.md) |
| Comic website | [Website planning](docs/website/README.md), kept in this repository for a later coordinated release |
| Earlier work and recovery | [History](docs/history/README.md) |

[Documentation map](docs/README.md) lists the canonical documents. Large editable masters and raw generator downloads are intended for a separate backed-up archive; its destination is pending. The repository currently contains references and a bundled title-music file, not a stored collection of production Blender masters or imported creature meshes.
