# Current handoff

Keep this file short: one checkpoint, overwritten each session. Move the previous entry to [the handoff log](history/handoff/README.md) under its day before writing a new one. Nothing here authorizes new work on its own; the current task from Robert does.

## Checkpoint 2026-10-18 (evening): G3c look development

- **Objective:** gate G3c (Q40): close the measured gap to the Astra target renders in light, sky, haze and clouds; a slightly narrower default lens; a cloud boundary at the world's edge; deeper wings with the flight stats unchanged.
- **Branch:** `gate/g3c-look-dev` (PR #12, draft), stacked on `gate/g3-harrier-visual` (PR #11).
- **Completed:**
  - **Measurement:** `scripts/lookdev/` frames the game like targets 01, 02 and 10 (35 to 50 mm) plus the gameplay camera at tod 0.6 and 0.7, and `metrics.mjs` scores each against its target in CIELAB (no dependencies).
  - **Light:** `render/look.ts` holds the knobs. The painterly lift became a smaller, cooler fill plus a real fresnel rim (its old fresnel was 1 on every front face). The sun is 1.35 times brighter, the world toon ramp goes 0.13/0.3/0.78/1 (was 0.32/0.55/0.8/1) and the creature ramp's shadow 0.16 (was 0.28). The wyvern's baked AO, computed before but never read, now reaches its shader.
  - **Screen-space AO** on High and Ultra (`render/post/ssao.ts`), half resolution, in the custom post chain.
  - **Golden hour on a blue sky:** the golden key's horizon, fog and hemisphere are blue, the warmth stays on the sun's side and on what it lights, and the sky gradient is steeper. Lawns keep 74% of their chroma.
  - **Cloud sea:** less wrap, darker and cooler hollows, warm sunlit tops.
  - **Boundary:** a three-tier rampart of cumulus heads all round the horizon (`SkyDome.ts`), faded by mist, rain and overcast. The storm wall still takes over within 2 km.
  - **Lens:** the default FOV is 58° (was 62°); saves still on the old default move to it (`lensRev`).
  - **Deeper wings:** finger 1 is 1.2 times longer and the outer trailing edges sag a fifth as far. Harrier membranes went from 24.1 to 26.8 m² (visual only). The Meshy trial now takes the game's fingers and membranes as well as its head.
- **Measured (golden hour, views framed like targets 01, 02 and 10):**
  - Tonal range 59% to 74% of the targets'.
  - Shadow floor L* 38/38/47 to 25/28/39 (targets 25/32/21).
  - Local contrast 48% to 57% of the targets'.
  - Sky b* +16 to +20 to −12 to +9 (targets −34 to −17).
  - Gameplay chase at golden hour: range 32.6 to 44.2, sky +18.9 to −6.1.
- **Tests:** typecheck clean; vitest 129 files, 1,368 passed. Golden pose fixture regenerated (finger 1 is longer). Ramp test updated (0.28 to 0.16 shadow). Settings-menu test excludes the internal `lensRev`. New save test for the lens migration. All 44 clipping tests pass with the deeper wings. Smoke 15/15. Every time-of-day preset, the weathers and the Low tier were captured.
- **Evidence:** `shots/lookdev/` (ignored): baseline, final, `g3c-before-after.png`, and `final/metrics.json`.
- **Known issues:**
  - Detail and density are the remaining gap (edge detail is still 40 to 60% of the targets'); that is G8 content: limestone cliffs, cypress and olive, the Aegean kit, ivy.
  - Dawn and sundown keys are still pink-magenta (only golden hour was asked for).
  - Wings could be deeper only where the fold allows: lengthening finger 2 or the inner panel put the folded membrane 2 to 9 cm into the flank when kneeling.
  - AO GPU time on the RX 9070 XT is not measured.
- **Next authorized action:** Robert reviews G3c in game (golden hour, any weather; the FOV slider in Settings > Camera). Merging G3/G3b/G3c needs his review; G8 needs its own go.
