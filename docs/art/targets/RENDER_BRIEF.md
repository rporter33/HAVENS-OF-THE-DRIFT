# Render brief for Astra: Havens of the Drift visual targets

Written 2026-10-17. These renders become the acceptance reference for the visual upgrade gates (G3 characters, G8 terrain) in [the first slice](../../design/FIRST_SLICE.md). Drop finished images into this folder using the file names in the shot list; the decision log (Q24) names them as the visual authority once they land.

The brief is written to be pasted into an image model in two parts: the **master prompt** once, then one **shot prompt** per image. Everything in it comes from the repository's art direction, lore and source; nothing is invented here.

---

## Master prompt (paste first, keep in context for every shot)

> You are rendering target concept art for **Havens of the Drift**, a controller-first flight game about a rider and one intelligent wyvern in a sunlit Aegean sky-archipelago called the Drift. The game already exists in Three.js with a painterly, soft-toon look (flat-shaded low-poly trees, pastel sky, broad color fields). Your renders show what that same world looks like **upgraded**: smooth, continuous 3D surfaces instead of visible facets, richer and more vibrant color, real material response (matte linen, dry limestone, soft bronze, blue-gray scale), while keeping the painterly identity, the readable silhouettes and the gentle monumental scale. These are stylized game renders, not photorealism and not concept sketches: think a high-end stylized game cinematic still.
>
> **World.** Islands float over an endless white cloud sea under a wide sky. The civilization is Aegean antiquity rebuilt in the sky: limestone arcades, porticoes, terraces, broad columns, blue plaster, canvas shade sails, bronze bells and beacons, cisterns, rope-and-plank wind-bridges between islets. Prayer-flag-like banners in a faction palette hang from poles. No pagodas, no East Asian rooflines, no medieval European castles or knight imagery. Vegetation: olive and cypress silhouettes, wind-bent grass, pink-blossom and broadleaf trees on the greener islands, moss and hanging roots under the oldest islands.
>
> **Palette hierarchy** (visual guidance, not per-pixel): about 70% pale cloth and stone (Chalk Linen `#F2EADA`, Cloud White `#FAF8F3`, Limestone `#D8D1C2`), 20% sky-blue and slate (Sky Blue `#7FA8C4`, Scale Slate `#586875`), 10% accents (Aged Bronze `#AA8656`, Deep Cobalt `#315E9C`, warm sand). Push saturation and light rather than adding new hues: golden-hour warmth, saturated sky gradients, luminous cloud sea, deep cool shadows. Vibrant, never garish.
>
> **Materials.** Dry linen with visible weave at close range; matte blue-gray scales in 3 to 5 broad rows, never tiny realistic scales; worn sand leather; softened bronze with patina, never chrome; weathered limestone with warm bounce light; translucent amber wing membrane with backlight. Big roughness differences, small fine detail. No glossy armor, no dense embroidery, no ornate trims.
>
> **Wyverns** are two-legged: hind legs plus wing-arms, long neck, long balancing tail, swept horns, a dorsal frill of spines, a saddle with a low-profile X-back harness. Elegant and elongated, with an intelligent, trusting presence. Pale scale ridges, no excess barbs, no metal armor on the animal.
>
> **Dragons** (prospective, not yet in game) are four-legged plus two wings, sleeker and larger than wyverns, with swept branching horns and whiskers, ivory and powder-blue coloring. They belong to the clan elders; show them as rare and old.
>
> **The rider** wears an ivory chiton or wrap with an asymmetric shoulder drape, a blue sash, a modest slate-scale chest panel, leather calf wraps and sandals; riding cloth shortened and tucked; compact tapered bracers over wraps. One bracer is the Windline: a magical tether cast from the wrist. Carry the banner-lance only in standing portraits: a straight shaft, small leaf tip, a long banner attached near the head.
>
> **Camera and light.** Default to the game's third-person flight camera: slightly behind and above the rider, 35 to 50 mm equivalent, horizon in the upper third when flying. Golden hour or clear midday unless the shot says otherwise. Volumetric haze between island layers for depth. Always show scale cues: a rider, a banner, a bird, a bridge.
>
> **Hard exclusions.** No text, logos or UI. No photoreal skin. No chrome. No pagodas. No castles or knights. No tiny scales or chain mail. No neon. No motion blur. No lens flare streaks. One subject per frame unless the shot says otherwise.
>
> **Output.** 16:9 at the highest resolution available (3840x2160 preferred), plus one square 2048x2048 crop of the subject for shots marked (portrait). Consistent lighting and palette across the whole set so the images read as one game.

---

## Shot list

File each image as `NN-slug.png` in `docs/art/targets/`. Where a current in-game screenshot exists, it is listed so the render can be judged as "the same place, upgraded".

### Characters first (feeds gate G3)

| # | File | Prompt (append to the master) | Current reference |
|---|---|---|---|
| 01 | `01-harrier-portrait.png` (portrait) | The **Harrier**, the all-rounder wyvern every rider learns on: moss-green primary `#3f7d5a` with a dark green mantle `#23453b`, sand belly `#dfcea7`, amber wing membrane `#d89a5a`, gold eyes `#f0c040`. Standing on a limestone terrace at Windhaven, saddled, head turned toward the viewer with calm attention. Three-quarter view, golden hour, cloud sea behind. | title screen, `docs/qa/` captures |
| 02 | `02-harrier-flight.png` | The same Harrier in flight with its rider, mid-bank over the cloud sea, wings fully extended showing membrane backlight, harness and saddle visible, rider leaning into the turn. Game camera. | smoke captures |
| 03 | `03-skimmer.png` (portrait) | The **Skimmer**: small, quick-winged, nervous. Teal primary `#2f6f8f`, navy mantle `#23375a`, pale belly `#c0d0c8`, sea-green membrane `#5aa890`, cyan eyes `#60d0e0`. Perched on a rock spire at The Needles, wings half-open, alert. | |
| 04 | `04-galewing.png` (portrait) | The **Galewing**: enormous slender wings, patient temperament. Storm-slate primary `#4d6477`, deep blue mantle `#233148`, sand belly `#dbccb4`, amber sails `#cf8a3c`, blue eyes `#4080f0`. Soaring in a long glide beside the Lantern Spire, wingspan filling the frame. | |
| 05 | `05-ironback.png` (portrait) | The **Ironback**: thick-hided, heavy-boned, dives like a stone. Umber primary `#6a5d52`, near-black mantle `#2a2a30`, tan belly `#c8a878`, rust membrane `#b5562f`, orange eyes `#e87830`. Landing heavily on Highmoor's cold bright plateau, dust kicked up, wind-bent grass. | |
| 06 | `06-rider-wanderer.png` (portrait) | The **player rider** in the Wanderer look: ivory chiton with asymmetric drape, blue sash, slate-scale chest panel, leather calf wraps, sandals, tapered bracers, the Windline bracer faintly luminous. Standing on the Windhaven terrace, hair moving in wind, banner-lance planted beside them with its banner streaming. Full body, eye level. | `docs/rider-c02/README.md` |
| 07 | `07-rider-mounted.png` | The rider mounted on the Harrier at rest, showing how the shortened riding cloth, X-back harness and saddle fit together. Side-on at saddle height. | `docs/rider-c02/` mounted captures |
| 08 | `08-sleek-dragon-elder.png` (portrait) | A **prospective elder dragon**: four legs plus two wings, sleeker and longer than the wyverns, swept branching horns, whiskers, ivory and powder-blue scales with pale ridges. Resting on a tower-top platform beside a white clan banner, an elder in a broad white mantle standing at its shoulder for scale. | Driftwing PR #15 concept |
| 09 | `09-craghorn-concept.png` (portrait) | A **prospective fifth wyvern breed, the Craghorn**: crimson, rock-climbing build, heavier forelimb claws on the wing-arms, clinging to a vertical cliff face at Highmoor. Still two-legged. | roadmap |

### Sights (feeds gate G8)

| # | File | Prompt (append to the master) | Current reference |
|---|---|---|---|
| 10 | `10-windhaven-approach.png` | **Windhaven**, the starting haven (the game's Windward Roost rebuilt): a rookery on a broad green island with limestone stables and arcades, a bell tower with a bronze beacon, banner poles, a flagstone plaza, canvas shade, cypress and pink-blossom trees. Seen from the air on final approach, wyverns circling, the cloud sea below. | title screen, `04-dusk-mist.png` |
| 11 | `11-windhaven-plaza.png` | Windhaven's plaza at ground level: the flagstones, the stable arcade, a saddled Harrier waiting, a lantern post, the bell tower behind. Midday, long shadows from the columns. | on-foot capture |
| 12 | `12-the-drift-vista.png` | **The whole Drift** from high altitude at golden hour: the central Windhaven island, Gull's Rest meadow a short glide away, Cascade Isle pouring five falls into the cloud sea, Rootfall's hanging roots, Highmoor's cold plateau, the Lantern Spire's needle, the Archway Reach stepping west, the Eye of the Gale ring hanging in open air. Layered haze between islands. | |
| 13 | `13-cascade-isle.png` | **Cascade Isle**: five waterfalls pouring off a green rim into the cloud sea, mist and rainbows, a wyvern diving through the spray. | |
| 14 | `14-rootfall.png` | **Rootfall**: an old forest whose roots hang a hundred meters into the sky beneath the island; the rider flying under it among the roots, shafts of light. | |
| 15 | `15-old-observatory.png` | **The Old Observatory**: a Ventari dome left by the wind-charters who departed west, limestone and bronze, broken rings of an orrery, Greek-style capitals inscribed on a lintel (no readable text). Dusk. | `src/world/` Ventari sites |
| 16 | `16-lantern-spire.png` | **The Lantern Spire**: a needle of rock with a lantern that never goes out, at night in mist, a Galewing gliding past on thermals. | |
| 17 | `17-eye-of-the-gale.png` | **Eye of the Gale**: a ring of stone the size of a hill hanging in open air; the rider threading it in a race, ring gates glowing softly ahead. | race captures |
| 18 | `18-the-codex-airship.png` | **The Codex**, Quintus's flying library and the game's airship: 72 m hull, 28 m working deck, canvas sails responding to wind, cabin, shelter, four hitch mounts; a scholar's library visible through cabin windows. Moored off Windhaven at dawn. | `06-windhaven.png` art study |
| 19 | `19-glowcap-grove-night.png` | **Glowcap Grove**: mushroom woods lighting up after dusk, bioluminescent caps in cool cyan and warm amber, the rider on foot with the Windline tether cast to a high branch. | |
| 20 | `20-archway-reach.png` | **The Archway Reach**: stone arches stepping west from islet to islet, a Skimmer slaloming through them, late afternoon. | |

### Optional set extensions

- `21-weather-mist.png`, `22-weather-rain.png`: Windhaven approach under the game's mist and rain states.
- `23-clan-banners.png`: the five clan banners (red, green, blue, black, white) on a single terrace rail, the faction palette made physical.
- `24-ui-free-hud-reference.png`: a flight frame composed to leave the HUD zones clear (top center compass, right-side Windline card), for UI work.

---

## How the renders are judged

For each pair (render, current screenshot) the visual gate asks three questions, scored by Robert:

1. Is it recognizably the same place, creature or costume? (identity)
2. Is the upgrade in surface smoothness, color and material, not in a different design? (fidelity to the brief)
3. Could the Three.js renderer plausibly reach it with better textures, normal maps and material parameters, without a new engine? (reachability)

A render that fails 3 is still useful as mood, but the gate's acceptance test is built from the ones that pass all three.

---

## Additional context for Astra

### Attach these images with the master prompt

All in `docs/art/targets/reference/`. Attach the "current game" images so the model knows the before state and keeps the identity; attach the concepts so it matches the established style of people, banners and the dragon.

| File | What it is | Attach for shots |
|---|---|---|
| `current-game/title-screen.png` | The game today: rider, Harrier, Windhaven plaza, floating island, flat-shaded trees. The before state for the whole set. | all |
| `current-game/windhaven-plaza-on-foot.png` | Ground-level plaza, flagstones, bell tower, lantern post, saddled Harrier. | 01, 06, 07, 10, 11 |
| `current-game/windhaven-dusk-mist.png` | Same place in the game's mist weather at dusk; the fireflies and cool palette are intentional. | 16, 19, 21 |
| `current-game/airship-art-study.png` | The airship as it exists in the game (72 m hull, canvas sails, four hitches). Keep its proportions for the Codex. | 18 |
| `concepts/01_Wanderer.jpg` | Approved rider costume reference: chiton, drape, sash, scale panel, banner-lance. Match the costume, not the background. | 06, 07 |
| `concepts/04_Elder.jpg` | Clan elder in the broad white mantle; the figure beside the dragon in shot 08. | 08 |
| `concepts/05_Banner_Families.png` | The three banner cuts (tapered Wayfinder, swallowtail Rider, broad split Sanctuary). | 06, 10, 23 |
| `concepts/06_Faction_Palette.png` | The seven swatches with their roles. | all |
| `concepts/sleek-dragon-three-view-v1.png` | The only approved dragon concept: ivory and powder-blue, four legs, branching horns, whiskers. Shot 08 is this animal, older and at rest. | 08 |

Note on the Wanderer and Elder references: their backgrounds show pagoda rooflines and ornate serpentine dragons from an earlier direction. Those are explicitly rejected. Take the costume and the figure, replace the architecture with limestone and blue plaster.

### Tone and what the game is not

- Gentle, wry, non-hostile. Even the storm wall at the edge of the Drift is "visibility and wind, not an enemy." Nothing in a render should look like it wants to kill the rider.
- Islands are places to rest, not obstacles. Landing spots look inviting: flat terraces, grass, a cistern, shade.
- The feeling to hit is the one from the best flight games: height, wind you can see in cloth and grass, the long way round being worth it.
- Not grimdark, not high fantasy with glowing runes and spiky armor, not photoreal, not anime. Closest existing references in spirit: AER Memories of Old for silhouettes and light, Sky: Children of the Light for warmth, The Falconeer for scale over a sea, Studio Ghibli skies for cloud mass.

### World rules the renders should respect

- **Scale.** The Drift is about 2,900 m across. Windhaven's island is large enough for a plaza, stables and a bell tower. The Codex is 72 m long; a Galewing's wingspan is about 20 m; a Harrier's about 14 m; a rider is 1.7 m. Keep these ratios when they share a frame.
- **Time.** A full day lasts 24 real minutes, so sunrise and sunset are frequent; golden hour is the game's signature light. Night is navigable: lanterns, the Lantern Spire, Glowcap bioluminescence.
- **Weather states** in the game: clear, breezy, overcast, mist, rain. Thermals are visible as faint rising shimmer columns; ridge lift happens on the windward face of every island. Birds (Driftrays) circle where there is lift.
- **Wind is the Drift.** Cloth, banners, grass, cloud edges and wing membranes should all agree on a wind direction in every frame.
- **The Ventari** are the vanished wind-charters. Their ruins are limestone and bronze, with ring and counting motifs. The one inscription currently in the game, in provisional Ancient Greek epigraphic capitals (lunate sigma, no accents), reads:
  `ΠΡΟϹΕϹΠΕΡΑΝΖΗΤΕΙΤΟΥΨΗΛΟΝΠΕΔΙΟΝ / ΕΚΕΙΛΙΘΟΙΚΥΚΛΩΙΤΟΥϹΑΝΕΜΟΥϹΑΡΙΘΜΟΥϹΙΝ`
  ("Seek the high plateau toward the setting sun. There, stones in a circle count the winds.") If a model can carve legible capitals, shot 15 may use the first line on the lintel; otherwise keep the lettering as shapes.
- **Clans.** Five clans share one culture with regional accents: red, green, blue, black, white. Each haven has one dragon elder and one wyvern elder on tower-top platforms. The player culture is the Air Nomads, white. Clan color appears in banners, sashes and plaster trim, never as full-body color.
- **Mounts.** Wyverns are the ridden animals today: two legs, wing-arms, 58-bone rig. Dragons are four-legged and belong to elders. A render must never put a rider on a four-legged dragon.

### How the game actually renders, for reachability

Three.js WebGL 2, a custom toon ramp with rim light and shared height fog, procedural geometry for creatures and islands, texture budgets of 1K/2K/3K/4K per quality tier, bundled fonts, no post-process beyond bloom and a color grade. The upgrade path is better normal and roughness maps, higher-resolution procedural materials, smoother tessellation on creatures, and denser dressing, not ray tracing or volumetrics. Renders that lean on heavy global illumination or subsurface scattering are mood only.
