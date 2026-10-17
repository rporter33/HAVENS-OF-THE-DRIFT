# G4 bond expression v1: captures

[QA index](README.md) · [First slice, gate G4](../design/FIRST_SLICE.md)

- **Captured:** 2026-10-17, cloud session (Linux container), headless Chromium 141.0.7390.37 with SwiftShader, Node 22.22.0.
- **Source:** branch `gate/g4-bond-v1`, commit `4f95085` (tree `d4d98ff`), on main `4647b27`. Captures ran on the uncommitted working tree whose `src/` is identical to that commit.
- **Server and command:** `npx vite --port 5173` (dev build), then `node scripts/shot.mjs --url "http://localhost:5173/?play=1&manual=1&tod=0.42" --steps <steps.json>`, 1280×720, quality preset as guessed on first launch, scripted input via `window.__dw.advance`.
- **Steps:** [lean-steps.mjs](g4-bond-v1/lean-steps.mjs) and [greet-steps.mjs](g4-bond-v1/greet-steps.mjs) generate the step files.
- **Kind:** automated, staged with debug teleports and scripted stick input. Not physical-device or controller testing; no human review yet.

The PNGs are in `shots/` (ignored) on the capture machine and were sent to Robert in the session. They are not committed. Hashes:

| File | SHA-256 |
|---|---|
| g4-lean-pass3.png | `b4c579eac30b3d893fac6bb6637e45bbee0c2abf3f2b576d93adc8c3274e669f` |
| g4-lean-pass4.png | `08b67d94790eecdeb6b09589daf08a557a983512fbef30f606441c85cca63f64` |
| g4-lean-pass3-before.png | `3c3e7a61d54bae9b8ebbd07811abf19a1864149c8087371dc72af0b9f20a28da` |
| g4-lean-pass4-before.png | `2c2dfd7b610b8cc4beaaccc6e5a88d9c674a0b75798191841112c5e649645cdc` |
| g4-greet-onFoot-baseline.png | `9a28dda169349a69cb49b0a1ea7211119fad1d87175aaa72c62dd643fa24527b` |
| g4-greet-onFoot-arrive.png | `6a2b3af2df84d92017f6c9aa702bbd5d2e5a68a94e83e63ebca90b1fdaee3671` |
| g4-greet-landed-baseline.png | `29c6fe13ff7c91f7275c3b108103640f5e2f0263a73e243f24b0ac5e9e0eada1` |
| g4-greet-landed-arrive.png | `6348b64e62d1ecc5736ff639a6a1c2b801549195df4022f9b1b37ef11f3b443d` |

## Anticipatory lean

Four passes through Windhaven's vicinity, each teleported to (−300, 380, −40) heading +x at 30 m/s. Each pass glides for 9 s, rolls right for 0.8 s, then glides out of the vicinity. The bond memory starts empty.

- Passes 1 to 3 recorded one right-bank site near (−54, 367, −36); it was seen 3 times, and the landmark had 3 passes.
- Pass 3, 0.1 s before the stick: no lean (`anticipate` 0). Pass 4, same moment: `anticipate` 1. The lean began 0.433 s before the stick went over (predicted 0.432 s).
- The flight model's body roll at those two frames was +0.19° and −0.23°, so the visible roll in pass 4 is the animator's channel and not the physics.
- The same steps run twice gave byte-identical PNGs.

## Windhaven greeting

- **On foot:** after 9 s flying away (out of the vicinity), a teleport back on foot beside the wyvern at the spawn. The greeting fired once (`count` 1, kind `foot`); the shot is 1.6 s into it. Baseline: the same teleport without the time away; no greeting.
- **Landed:** the same with the pair landed at the spawn. The greeting fired 0.6 s after landing (kind `landing`); the shot is 1.73 s into it, with the head come round to the rider in the saddle. Baseline: no greeting.

## Limits

- Teleports stand in for the flight home. The arrival rules (time away, the landing settle, waiting for the wyvern to come over, patience) are covered by `src/bond/bond.test.ts`, not by these captures.
- The lean capture uses the debug follow camera from behind. It does not yet compare against a target render.
