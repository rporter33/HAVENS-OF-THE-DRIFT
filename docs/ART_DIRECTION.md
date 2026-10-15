# Driftwing shared visual guide

Claude and Codex must use this same guide for art direction, costumes, themes, colors, props, architecture, dragons, and asset work. It is a reading guide to one canonical visual authority: the revised `Art_Direction_Master.md` v2 and the pack introduction, subject to Robert's explicit current direction. Do not maintain a separate Claude art brief.

## Current Windline override — 2026-10-11

Robert approved a bracer-fired magical tether in place of the thrown lance, plus deliberate A/Space inward pulls, and subsequently requested integration of the completed Windline systems into normal gameplay. The older lance/anchor and no-powered-pull references below remain historical design context; they do not override those explicit requests. The harness still carries the load, animation never drives physics, and there is no automatic winch. Updated character models, wardrobes, moving anchors and broader production art remain deferred. See [the cloud handoff](history/CLOUD_HANDOFF_2026-10-11.md) for the implemented scope.

## Authority and scope

### Blender authoring direction — planning only

Read [the shared Blender asset plan](BLENDER_ASSET_PLAN.md) before proposing authored
riders, garments, dragons or props. It records Robert's accepted workflow direction,
the C02/M01 reference index, missing production decisions and trial acceptance criteria.
It does not authorize asset creation/import or supersede the visual source hierarchy.
Current explicit rider/wardrobe and quality decisions take precedence over the older
pack's P1-only scope and provisional 1K estimates. Blender renders are intermediate
evidence; final acceptance requires actual-engine views and preserved customization.

1. Robert's explicit current direction takes precedence.
2. Read the revised master and pack introduction together. The introduction updates the lance's function to a thrown javelin/grappling anchor; the master defines its visual language.
3. Apply specific armor/prop specifications and imagery only where compatible with those sources. Older wardrobe text about different colors, bow/staff equipment or boots does not override the revised direction. Concept images also contain details the written master explicitly corrects.

The master remains labeled proposed, not final game canon. Its open lore, faction roles, dimensions, production budgets, asset names, animation techniques and unapproved gameplay decisions remain proposals. These rules establish visual direction; they do not authorize implementation, new mechanics, engine changes, asset imports or approval-gate completion. Historical status snapshots and embedded handoff prompts are context, not current instructions.

## Canonical sources and access

Repository: `rporter33/Driftwing`. Art branch: `docs/art-reference-pack`, [PR #1](https://github.com/rporter33/Driftwing/pull/1). Verified reference commit: `f3ef231c6a12ed5865cd73562447f6d94a1730bf` (2026-10-10).

All paths below are repository-relative:

- [Art direction master v2](https://github.com/rporter33/Driftwing/blob/f3ef231c6a12ed5865cd73562447f6d94a1730bf/docs/art/Driftwing_Codex_Handoff/01_Sky_Lance/Art_Direction_Master.md): `docs/art/Driftwing_Codex_Handoff/01_Sky_Lance/Art_Direction_Master.md`.
- [Pack introduction and index](https://github.com/rporter33/Driftwing/blob/f3ef231c6a12ed5865cd73562447f6d94a1730bf/docs/art/Driftwing_Codex_Handoff/README_START_HERE.md): `docs/art/Driftwing_Codex_Handoff/README_START_HERE.md`.
- Pack overview: `docs/art/README.md`.
- Compatible component details: `docs/art/Driftwing_Codex_Handoff/02_Wardrobe/Individual_Armor_Specifications.md`.
- Bracer functional reconciliation: `docs/concepts/WINDLINE_BRACER_SWINGING.md` on `docs/windline-bracer-concept`, verified commit `0d3ca54895a080371ad74d7614b198cebea110ac`.

Some development checkouts do not contain the pack. Read it from the documentation branch without switching branches or merging it:

```sh
git show origin/docs/art-reference-pack:docs/art/Driftwing_Codex_Handoff/README_START_HERE.md
git show origin/docs/art-reference-pack:docs/art/Driftwing_Codex_Handoff/01_Sky_Lance/Art_Direction_Master.md
git ls-tree -r --name-only origin/docs/art-reference-pack -- docs/art/Driftwing_Codex_Handoff
git show origin/docs/windline-bracer-concept:docs/concepts/WINDLINE_BRACER_SWINGING.md
```

If a reference is unavailable, report the access gap; do not invent it or merge branches to obtain it. A read-only fetch of the named reference branch can make it available. Check its revision before using a newer version. Keep the original ZIP and extracted source pack intact; the corrected lookup below resolves its stale instruction paths.

## Verified image lookup

Paths in this section are relative to `docs/art/Driftwing_Codex_Handoff/` on the art branch. Use the actual indexed files, not the master's stale `assets/AN_REF_*.png` paths:

| Reference | Actual image path |
|---|---|
| Wanderer / REF 01 | `01_Sky_Lance/References/01_Wanderer.jpg` |
| Scout / REF 02 | `01_Sky_Lance/References/02_Scout.jpg` |
| Standard Bearer / REF 03 | `01_Sky_Lance/References/03_Standard_Bearer.jpg` |
| Elder / REF 04 | `01_Sky_Lance/References/04_Elder.jpg` |
| Banner families | `01_Sky_Lance/References/05_Banner_Families.png` |
| Faction palette | `01_Sky_Lance/References/06_Faction_Palette.png` |
| Component overview | `02_Wardrobe/Armor_Component_Overview.jpg` |
| Cuirass / AN-AR-01 | `02_Wardrobe/Armor_Cards/AN-AR-01_Windscale_cuirass.jpg` |
| Harness / AN-AR-02 | `02_Wardrobe/Armor_Cards/AN-AR-02_Crossback_flight_harness.jpg` |
| Collar / AN-AR-03 | `02_Wardrobe/Armor_Cards/AN-AR-03_Windline_scale_collar.jpg` |
| Shoulders / AN-AR-04 | `02_Wardrobe/Armor_Cards/AN-AR-04_Aerie_shoulder_scales.jpg` |
| Upper arm / AN-AR-05 | `02_Wardrobe/Armor_Cards/AN-AR-05_Upper-arm_sail_cuff.jpg` |
| Bracers / AN-AR-06 | `02_Wardrobe/Armor_Cards/AN-AR-06_Stormward_bracers.jpg` |
| Hand guards / AN-AR-07 | `02_Wardrobe/Armor_Cards/AN-AR-07_Lance-grip_hand_guards.jpg` |
| Waist / AN-AR-08 | `02_Wardrobe/Armor_Cards/AN-AR-08_Bronze-sash_waist_guard.jpg` |
| Hips / AN-AR-09 | `02_Wardrobe/Armor_Cards/AN-AR-09_Split_hip_tassets.jpg` |
| Knees / AN-AR-10 | `02_Wardrobe/Armor_Cards/AN-AR-10_Cloudstep_knee_cups.jpg` |
| Greaves / AN-AR-11 | `02_Wardrobe/Armor_Cards/AN-AR-11_Skywrap_greaves.jpg` |
| Sandals / AN-AR-12 | `02_Wardrobe/Armor_Cards/AN-AR-12_Rider-sole_sandals.jpg` |

The component specification's old `Individual_PNG_Design_Cards/*.png` links resolve to the corresponding JPG cards above. Costume atlases are `02_Wardrobe/Concept_Atlases/AN_Concept_Atlas_01.jpg` through `AN_Concept_Atlas_04.jpg`; they are mood/material references, subordinate to the written corrections.

## Visual guardrails

- **Theme:** sunlit Aegean antiquity, travel, craftsmanship, aerial navigation and dragon companionship. Preserve gentle monumental scale and a readable silhouette.
- **Costume:** ivory chiton/wraps, asymmetric shoulder drape, blue sash, modest slate-scale chest panel, leather calf wraps and sandals. Use shortened/tucked riding cloth, a low-profile X-back harness and compact tapered bracers over wraps. Respect joint, grip, saddle and camera clearance.
- **Materials and detail:** dry linen, matte blue-gray scales, weathered leather and softened bronze. Use 3-5 broad scale rows and restrained decoration even where images are busier. Avoid chrome, glossy armor, dense embroidery, tiny scales, ornate trims and western knight plate.
- **Palette:** roughly 70% pale cloth, 20% sky-blue/slate and 10% bronze/accent, as a visual hierarchy rather than a per-pixel quota. Keep cobalt and bronze restrained.
- **Lance and banner:** a straight restrained shaft, small leaf/open-spiral tip and long visible banner attached near the head. Wayfinder uses a tapered tail, Rider a swallowtail, Sanctuary a rectangular/broad split cut. Bow/staff or bare-spear silhouettes do not replace this signature.
- **Tether equipment:** the thrown Sky Lance anchors the tether; the bracer controls line/release; the harness bears the load. Preserve this functional distinction without authorizing new traversal work. The small Navigator's Grapple poster is supplemental: its wrist-fired beam, ornate European towers and elaborate cloak are not art authority.
- **Architecture:** limestone arcades, porticoes, terraces, broad columns, blue plaster, canvas shade, bronze bells/beacons, cisterns and wind-bridges. Replace the images' pagoda rooflines with this Mediterranean language.
- **Dragons:** elegant elongated winged companions with pale scale ridges and an intelligent, trusting presence. Avoid excess barbs, ornate clutter and metal armor; preserve established gameplay and flight behavior.

| Master swatch | Hex |
|---|---|
| Chalk Linen | `#F2EADA` |
| Cloud White | `#FAF8F3` |
| Sky Blue | `#7FA8C4` |
| Deep Cobalt | `#315E9C` |
| Scale Slate | `#586875` |
| Aged Bronze | `#AA8656` |
| Limestone | `#D8D1C2` |

## Asset and verification requirements

The pack contains concept references, not production meshes, rigs or validated orthographic blueprints. Do not treat it as a runtime asset bundle or copy reference imagery into runtime assets without authorization. Preserve the repository's procedural, self-contained runtime architecture.

Before calling runtime art compliant, report each category separately: costume/silhouette; palette/materials; armor/detail; lance/banner; bracer/tether/harness; architecture; dragons; and animation/camera clearance. For each, include the exact source reference, implementation path, gameplay-camera screenshot or clip, observed match, gap and status (verified, partial, not verified, or not applicable with a reason).

Use actual gameplay camera distance and representative on-foot, mounted, takeoff, bank, dive, brake and dismount views where applicable. Check cloth/prop interference with joints, saddle, dragon eyes, rider face, route and UI; record missing coverage. A concept comparison, code inspection or successful build alone is not rendered-game evidence.

Current rendered-game compliance has not been verified by this documentation update. Both agents have the same rules when these files are present; file installation is not evidence that a running assistant has read them.
