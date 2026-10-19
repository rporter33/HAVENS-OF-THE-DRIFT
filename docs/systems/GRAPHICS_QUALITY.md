# Graphics quality targets

Robert revised the hardware target after the October 10, 2026 local P1 playtest: Low supports
integrated graphics; Medium, High and Ultra prioritize players with a dedicated graphics card.
The first increase remains a local review build, not a production rollout or minimum-spec promise.

| Setting | Low, unchanged | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Pixel-ratio cap | 1 | 1.5 (was 1.25) | 1.75 (was 1.5) | 2, unchanged |
| MSAA samples | 0, FXAA | 2 | 4 | 4 |
| Shadow map | Off | 2048 (was 1024) | 3072 (was 2048) | 4096 (was 3072) |
| Shadow half-extent | 80 m | 80 m | 110 m | 140 m |
| Grass density multiplier | 0.25 | 0.8 (was 0.6) | 1.25 (was 1) | 1.75 (was 1.5) |
| Grass radius | 70 m | 130 m (was 110) | 180 m (was 150) | 220 m (was 200) |
| C02 color atlas | 1K | 2K | 3K; optional 4K comparison | 4K |
| Atlas anisotropy request | 2 | 4 | 8; 16 for 4K comparison | 16 |
| Cloth visual detail multiplier | 0.5 | 1 (was 0.75) | 4/3 (was 1) | 2 (was 1) |
| Screen-space AO (G3c, 2026-10-18) | Off | Off | On, half resolution | On, half resolution |

Pixel ratio is capped by the display's device-pixel ratio; this does not force supersampling on
a 1× screen. Existing resolution controls and automatic resolution reduction remain. Three.js
caps requested anisotropy to driver support. Device texture-dimension fallback is unchanged.

The extra shadow texels keep the existing coverage and improve definition instead of extending
the camera. Shadow maps alone are approximately 16/36/64 MiB at 2K/3K/4K for a four-byte texel,
before driver-specific attachments or overhead. Higher resolution screens, MSAA and postprocessing
allocate additional memory. Grass covers more ground at greater density; streaming and chunk
budgets still apply. This is a deliberate cost increase to measure on lower dedicated GPUs too.

Cloth gains drawn interpolation samples, not solver particles, steps, contacts or new physics.
Quality switches retain C02 cloth state. Body silhouette, approved costume, rig and mounted fit
remain the reviewed P1. Prop placement density, shared geometry, flight, movement, saves, bloom,
clouds, view distance and particle budgets are unchanged. Dragon runtime source is unchanged;
see [texture policy](TEXTURE_QUALITY.md) for its procedural materials and future bitmap budgets.

## Look development (G3c, 2026-10-18)

Gate G3c (Q40) changed how hard the light is on every tier, at no per-pixel cost beyond the AO:
a brighter sun over a smaller, cooler painterly fill and a real fresnel rim (`render/look.ts`),
a darker toon-ramp floor, the wyvern's baked AO wired into its shader, a blue-sky golden hour, a
deeper cloud sea and the boundary's cloud rampart on the horizon. High and Ultra add one
half-resolution screen-space AO pass (`render/post/ssao.ts`: 12 depth samples per half-res pixel,
two 9-tap depth-aware blurs, a 4-tap upsample in the grade). Its scene target now carries a float
depth texture, resolved from the MSAA buffer. Medium and Low allocate nothing new. GPU time on the
RX 9070 XT was not measured from the cloud workspace; at 2560×1440 the pass reads about 50 million
texels a frame. Before and after scores against the target renders: `scripts/lookdev/`.

## Current evidence and limits

Local adapter inspection and browser WebGL both identify AMD Radeon RX 9070 XT; the display is
2560×1440. A short actual-GPU Roost sample at that size rendered all four updated tiers with no
page/game/console errors and automatic resolution factor 1. Medium/High/Ultra sampled mean
frame cadence around 16.7 ms. This includes browser scheduling/vsync and CPU/GPU work; it is not
isolated GPU time. Before/after draws vary with asynchronous world streaming. Do not infer a
speedup, exact frame budget, long-flight stability, peak VRAM or support for all dedicated GPUs
from this short one-scene sample. The prior good owner playtest applies to the earlier build.

The local launcher distinguishes normal game-menu links from rotating model viewers. The earlier
experimental 4K link opened a turntable intentionally; Robert's screenshot reported that flow,
not a floating-cloth defect. New Ultra and High-with-4K gameplay links open the normal menu.

Next: owner playtest of this local increment, then longer representative flight/weather/landmark
measurements and a lower dedicated-GPU target before further increases. No new hardware minimum
or renderer migration is implied.
