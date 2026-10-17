# Game systems

[Documentation map](../README.md) · [Architecture](../../ARCHITECTURE.md) · [Tools](../tools/README.md)

One row per runtime system: where the source is, what the tests cover, and the document that governs it. Line counts are from main `18a7aab` (94,884 TypeScript lines, 125 test files, 1,322 tests). The "exists in source" column says what runs today; approved direction and future ideas live in [the decision log](../design/DECISION_LOG.md) and [the roadmap](../ROADMAP.md).

| System | Source | Lines | What exists in source | Governing docs |
|---|---|---|---|---|
| Flight model | `src/flight/` | 2,895 | Deterministic 120 Hz lift/drag model; four breeds (Harrier, Skimmer, Galewing, Ironback); stamina, stall protection, thermals, ridge lift, gusts. | [Architecture](../../ARCHITECTURE.md), [Roadmap](../ROADMAP.md) |
| Player states | `src/player/` | 4,375 | flying, landed, onFoot, mounting, dismounting, traversing, falling, respawning; wyvern catch; Rested buff. | Architecture |
| Windline (code name Sky Lance) | `src/traversal/` | 2,413 | Bracer tether on foot and in freefall: cast, swing, pull, release, boost, recall. Kept per Q15. | [Windline concept](../design/concepts/WINDLINE_BRACER_SWINGING.md), QA reports in [qa/reports](../qa/reports/) |
| Creatures and rider | `src/creatures/` | 28,323 | Procedural two-leg wyvern (58 bones) and rider; wardrobe with 8 garment slots; opt-in authored Blender rider behind `?riderTrial=blender`. | [Wardrobe](WARDROBE_CUSTOMIZATION.md), [Texture policy](TEXTURE_QUALITY.md), [Blender trial](../rider-blender-trial/INTEGRATION.md) |
| World | `src/world/` | 15,307 | The Drift: 2,900 m archipelago, 12 landmarks, ~50 islands, analytic shapes shared by render, collision, landing and walking; six Ventari ruin sites. Kept per Q19. | Architecture, [Lore meanings](../design/LORE_MEANINGS.md) |
| Sky and weather | `src/sky/` | 5,240 | Day/night (24 real minutes), seeded Markov weather, 8 thermals, wind field. | Architecture |
| Racing | `src/race/` | 4,705 | Seven courses on save-stable ids, in-order rings, splits, ghosts in IndexedDB, pace-model medals, Lantern Dash coach. | [Lantern Dash review](../qa/LANTERN_DASH_REVIEW.md) |
| Progression and saves | `src/progression/`, `src/research/`, `src/cosmetics/` | 3,138 | Save v1 (`driftwing.save.v1`), 48 feathers, 7 relics, cosmetic unlocks only; three research branches funding Codex stages (display capped at 1). | Roadmap, [M1 brief](../design/M1_FIRST_LEAD_BRIEF.md) |
| Rendering | `src/render/`, `src/fx/` | 5,714 | Three.js WebGL 2 renderer, painterly toon ramp, post chain, quality presets, particles. Texture/material upgrade toward the latest renders is approved direction (Q2), not yet scoped. | [Graphics quality](GRAPHICS_QUALITY.md), [Texture policy](TEXTURE_QUALITY.md), [Art direction](../ART_DIRECTION.md) |
| Camera | `src/camera/` | 3,289 | Camera rig; no user-selectable camera modes. | Architecture |
| Input | `src/input/` | 2,658 | Controller-first mapping, keyboard/mouse, haptics, accessibility toggles. | Architecture |
| UI | `src/ui/` | 7,331 | HTML overlay: title, HUD, menus, the stable. | Architecture |
| Audio | `src/audio/` | 3,200 | Procedural WebAudio plus bundled title MP3. | [Audio QA](../qa/reports/AUDIO_QA_2026-10-11.md) |
| Editor | `src/editor/` | 1,011 | Region Workshop at `/editor.html`, sandbox playtest at `/editor-playtest.html`. | [Region editor](../tools/REGION_EDITOR.md) |
| Debug and showcases | `src/debug/` | 2,714 | URL params, `window.__dw` automation handle, Windhaven stationary showcase. | [Windhaven](../design/WINDHAVEN.md) |
| Game wiring | `src/game/`, `src/core/` | 2,465 | `Game.ts` builds every system; `contracts.ts` and `core/types.ts` define interfaces and events. | Architecture |

Not in source at all: networking, AI rivals, bonding, non-cosmetic capability unlocks, course variants, dialogue, four-legged dragon rig, the Craghorn, region travel, moving decks. See [the source audit](../production/SOURCE_AUDIT.md) for what in the tree is tied to shelved or unscoped directions.
