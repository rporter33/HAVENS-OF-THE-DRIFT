# Havens of the Drift — architecture

## Shape

Havens of the Drift continues this Driftwing implementation (previously organized as Dragon Circuit). See [current production status](docs/production/STATUS.md), [the design index](docs/design/README.md) and [tool instructions](docs/tools/README.md) for project navigation. Existing runtime paths, page URLs and saved-data identifiers remain stable.

```
src/core/        pure helpers and the shared contracts (types.ts) — no three.js scene code
src/game/        Game.ts builds and wires every system; contracts.ts defines their interfaces
src/render/      renderer + post chain, quality presets, shared uniforms, the painterly material patch
src/world/       layout (the archipelago as data), analytic island/spire/arch shapes, terrain queries,
                 island meshing; world/dressing/ holds vegetation, water and structures
src/sky/         sky dome, day/night lighting, clouds and cloud sea; weather and the wind field
src/flight/      breeds and the flight model (pure, unit-tested)
src/player/      the player state machine: flying, landed, on foot, falling, respawning
src/camera/      camera rig
src/input/       gamepad + keyboard/mouse → InputFrame; the control scheme as data
src/creatures/   procedural wyvern and rider models and animation
src/race/        courses, rings, timing, medals, ghosts
src/progression/ save data, collectibles, unlocks
src/cosmetics/   the cosmetic catalog (what exists and how it unlocks)
src/ui/          HTML overlay: title, HUD, menus, the stable
src/audio/       procedural WebAudio
src/fx/          particles, trails and screen effects
src/debug/       URL params, window.__dw automation handle, showcases
src/editor/      region documents, workshop preview and isolated playtest
```

## Rules

- **One world model.** Islands, spires and arches are analytic shapes (`world/islandShape.ts`).
  Collision, landing, walking, ring validation, collectible placement and meshing all evaluate
  the same functions, so what you see is what you hit.
- **Fixed-step simulation.** Physics runs at 120 Hz (`Game.FIXED_DT`); presentation interpolates
  with `alpha`. The flight model is deterministic for a given input stream.
- **Systems talk through contracts and events.** `game/contracts.ts` defines every system's
  interface; `core/types.ts` defines shared data and the event map. Presentation (audio, fx,
  HUD, rumble) reacts to events; gameplay never imports presentation.
- **Body frame:** forward +Z, up +Y, left +X (right wing along −X). See `core/types.ts`.
- **Painterly look:** lit materials go through `render/painterly.ts` (`toonMaterial`,
  `applyPainterly`) for the soft toon ramp, rim light and the shared height fog. Custom shaders
  include `FOG_PARS_GLSL` and apply `dwApplyFog`. Shared lighting/fog/wind/time uniforms live in
  `render/uniforms.ts`; the sky writes them, everyone reads them.
- **Procedural scene assets, bundled dependencies.** Creature/world geometry and much of the
  audio are generated from source. The title music is a committed MP3 under `src/audio/assets/`,
  and `src/ui/fonts.ts` imports bundled font packages rather than a font CDN. Vite packages the
  imported assets into the build; no imported Meshy creature loader is established. Self-contained
  asset packaging is not a claim of a service worker or verified offline installation.
- **Self-contained delivery.** The normal rider/world providers are procedural. The explicit
  `?riderTrial=blender` development selection loads a bundled uncompressed rider GLB;
  it uses the existing painterly materials, rig, wardrobe and live cloth. No external
  model, texture or decoder service is required at runtime.

## Bounded asset authoring trial

Robert authorized one hybrid Blender rider trial after the October 11 planning
proposal; see [the shared asset plan](docs/BLENDER_ASSET_PLAN.md) and
[trial integration](docs/rider-blender-trial/INTEGRATION.md). Its provider remains an
explicit development selection, preserving renderer, animator/IK authority,
deterministic simulation, shared geometry, save IDs and self-contained delivery.
The trial does not authorize wider asset production or a normal-build rollout.

[Asset ownership and provenance](assets/README.md) describe existing references, future accepted
exports and the separate master/raw archive whose destination remains pending. Art references and
website storyboards do not become runtime assets by being indexed.

## Automation

`?manual=1` stops the render loop so a headless browser can drive time with
`window.__dw.advance(seconds)` and capture with `scripts/shot.mjs`. `?view=<name>` runs a
showcase from `src/debug/showcases/` (any module can add one). See `src/debug/params.ts` for
the other URL switches. `window.__dw` exists in dev builds, and in production builds only with
`?manual=1` or `?debug=1`.

`npm run smoke` builds the game, serves `dist/` under a subpath and plays it in headless
Chromium with the real frame loop: boot, title, flight, pause/resume, runtime quality switches,
a plain production boot, and no console errors allowed (`scripts/smoke.mjs`; CI runs it before
every deploy).
