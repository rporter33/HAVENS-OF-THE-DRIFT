# G8a capability sites: playtest plan and evidence

[QA index](README.md) · [Capability spec, sites](../design/CAPABILITIES.md#capability-sites-for-g8) · [Decision log](../design/DECISION_LOG.md) (Q30, Q32–Q35, Q41–Q43)

Two sites built for the G5 capabilities: the **Cascade south perch** (steep-slope landing) and the **Archway Keyhole** (snap-roll). The sites are real terrain in every build. G5's capabilities don't exist yet, so the "after" side can only be felt through a debug-only preview.

## Playtest

### Setup

On the branch `gate/g8a-capability-sites`:

```
git fetch origin
git checkout gate/g8a-capability-sites
npm ci
npm run dev
```

Then open one of the URLs below at `http://localhost:5173`. Each starts in flight on a clean approach, heading at the site.

| Try | URL (append to `http://localhost:5173`) |
|---|---|
| Perch, today | `/?play=1&at=822,500,-990&yaw=0&mode=flying&speed=18` |
| Perch, with steep landing | `/?play=1&at=822,500,-990&yaw=0&mode=flying&speed=18&capPreview=steep` |
| Keyhole, today | `/?play=1&at=-729,336,-1232&yaw=-111.8&mode=flying&speed=18` |
| Keyhole, with snap-roll | `/?play=1&at=-729,336,-1232&yaw=-111.8&mode=flying&speed=18&capPreview=snap` |
| Free flight, both previews | `/?play=1&capPreview=steep,snap` (the perch is 380 m south of Cascade Isle; the Keyhole is the tall islet south of the Archway Reach) |

### Controls

| Action | Keyboard | Pad |
|---|---|---|
| Bank | A / D | left stick |
| Flap | Space | RT |
| Flare (brake and land) | C or right mouse | LT |
| Tuck (fold wings) | Shift | LB / RB |
| Snap-roll (preview only) | double-tap A or D within 0.3 s | flick the stick the same way twice |
| Recall your wyvern | hold F | as for interact |

A short rumble marks the snap-roll on a pad.

### Before you trust the preview

- **It saves nothing.** A toast says so when the session starts: progress, race records, ghosts and bond memory all stay as they were.
- **Steep preview:** every breed's landing limit is 53°.
- **Snap preview:** each double-tap gives 0.6 s of roll rate and roll authority ×1.6. These are G5's proposed values; G5 itself will tie them to bond milestones.

### What to look for: the QA questions

**Seeing the sites**
1. From normal flying distance, does each site catch your eye and read as "something to try", with no marker?
2. On the approach, does the Keyhole read as a way through (the X of its two cracks)?
3. Does the perch's pale tilted top read as a place to land, or as decoration?
4. Do both look like the same world as Cascade Isle and the Archway Reach (rock, palette, scale)?
5. Up close, does anything look procedural or placeholder? Check the crack lips, the Keyhole's flat front face and pointed underside, and the perch's rim. These are judged against the render brief now and against the target renders when they land.

**Perch, today**
6. When the wyvern skates off, does it read as "too steep for my wyvern" (fair), or as a bug (bounce, stick, jitter)?
7. Does anything tell you why it failed?
8. Can you find any way to stand on it today: the rim, a crash landing, landing beside it and walking over? The scripted search found none in 405 approaches per breed. You're the adversary here.

**Perch, with steep landing**
9. Does the landing feel planted? Watch the feet, the body's tilt and the rider's seat on 51.5°, and look for floating or sliding.
10. Taking off again from the slope: easy or awkward?
11. Dismounting there sets the rider on ground too steep to stand on. They slide off the downhill rim into freefall, and you have to hold F to recall the wyvern. Is that acceptable or funny, or should G5 block dismounting on the perch?
12. Does it feel like a new ability or a small tweak? (G5 will add an optional collectible on the perch.)

**Keyhole, today**
13. Is what it asks for (bank one way through the first crack, the other way through the second) readable before your first attempt, or only after you hit the rock?
14. Does hitting a crack wall feel fair, or punishing?
15. **The tuck (Q35):** fold the wings (Shift / bumper) and drop through. Folded wings pass, because wingtips only collide while spread. Does that feel like a cheat, or like a legitimate other line?

**Keyhole, with snap-roll**
16. **Q33:** does the double-tap trigger when you mean it and never when you don't, including bank corrections and normal turns? Compare keyboard and pad.
17. Can you see the burst in the wyvern's roll? Is the rumble enough, or does it need a visual or sound cue?
18. The scripted pilot only threads it at 14–16.5 m/s, just above the harrier's stall. Can you do it, and how many attempts did it take? Is it too hard, right, or too easy? Would you take a longer chamber (more forgiving with the snap-roll) if a perfect pilot could then occasionally squeak through without it?
19. Does threading it feel like flying skill or like an input test?

**Both**
20. Is there a hitch when a site first comes near? Its detailed mesh is built then, time-sliced. What's the frame rate near the Keyhole at your usual quality?
21. Does the follow camera behave in the cracks and the chamber, or does it clip into rock or lose the wyvern?
22. Is anything about Archway Thread or Cascade Run different? It should be unchanged.

## Playtest results (2026-10-18)

Robert's answers to the 22 questions above, quoted where short. Both a gamepad and the keyboard were used. Not recorded: the tested commit (main was `affe784` when the answers came in), whether the build was local or hosted, the quality setting and any frame rate. This is one person's first session, and questions 8 and 22 were marked as needing more time.

| # | Answer | Recorded as |
|---|---|---|
| 1 | Yes. More uniqueness on each island is important; work on it is going on. | Direction ([Q43](../design/DECISION_LOG.md)). |
| 2 | Yes; small variations would be ideal. | Direction (Q43): keep the Keyhole's read, add small variations between sites. |
| 3 | Decoration, and hard to distinguish. | Finding F1. |
| 4 | Yes, a little. Unique islands with verticality would be ideal, but they must stay possible to traverse. | Direction (Q43). |
| 5 | The perch's rim could use a better distinguisher. | Finding F1. |
| 6 | Closer to a bug, or a spot not meant for the mount to land. | Findings F1 and F2. |
| 7 | No. "I just slide off and the mount kind of freezes up." | Finding F2 (no explanation) and F3 (the freeze). |
| 8 | Not explored deeply enough; "seemingly no". | Inconclusive. The scripted search found no landing in 405 approaches per breed. |
| 9 | It does feel planted; a few more passes would take it to a gold standard. | Polish pass on the landing, no change of approach. |
| 10 | Almost easy, but the player should be able to gather energy by holding a button and launch off; this improves with bonding. | New direction (Q43). |
| 11 | Acceptable. | Decided: dismounting on the perch is not blocked (Q43). |
| 12 | A small tweak. | The steep landing alone is a thin capability (Q43). |
| 13 | Readable, but more effort is needed in what happens when mounts hit rocks. | [Q42](../design/DECISION_LOG.md), open. |
| 14 | Fair, "but not consequential to hitting a rock wall". | Q42. Read as: the hit is fair, but it has no real consequence. |
| 15 | Feels legitimate, and what Robert had in mind. | [Q35](../design/DECISION_LOG.md) answered: the tuck is accepted. |
| 16 | Gamepad is good, keyboard is hard. The snap-roll animation should have noticeable detail and look cool. | [Q33](../design/DECISION_LOG.md) answered; [Q41](../design/DECISION_LOG.md) opened for the keyboard input; animation direction in Q43. |
| 17 | Left blank. | Taken from Robert's earlier note: minor, subtle effects around the wings. Read together with 16 as subtle effects plus a clearly readable, well-made roll animation. |
| 18 | A little hard, and clunky. A more forgiving chamber would be ideal for most spots. | Direction (Q43). |
| 19 | A bit of both. A mechanic that gives more agility in a wind stream through part of it is wanted, "maybe". | An idea, not a decision (Q43). |
| 20 | Didn't notice a hitch. | No hitch seen. No frame rate given. |
| 21 | It clips into rock when the mount is falling. | Finding F4. |
| 22 | No, but needs more time with them. | No difference seen so far; inconclusive. |

### Findings

None of these is fixed or investigated yet. They need a named gate before any game code changes.

| ID | Finding | From | Status |
|---|---|---|---|
| F1 | The perch doesn't read as a place to land: its tilted top and rim are hard to tell from decoration. | 3, 5, 6 | Open. Needs a clearer distinguisher on the top plane and rim. |
| F2 | A failed landing on the perch reads as a bug, and nothing says why. | 6, 7 | Open. |
| F3 | After sliding off the perch, the mount "kind of freezes up". | 7 | Not reproduced. Which state it was in (flying, landing, falling) isn't known. |
| F4 | The follow camera clips into rock while the mount is falling. | 21 | Not reproduced. The camera is outside G8a. |
| F5 | The double-tap snap-roll is hard on a keyboard. | 16 | Tracked as Q41. |

### Where the answers went

- [Q33](../design/DECISION_LOG.md) and [Q35](../design/DECISION_LOG.md) are answered.
- [Q41](../design/DECISION_LOG.md) (keyboard snap-roll input) and [Q42](../design/DECISION_LOG.md) (what a rock hit costs) are open.
- [Q43](../design/DECISION_LOG.md) records the direction for the sites and the capabilities, and what it doesn't authorize.
- [CAPABILITIES.md](../design/CAPABILITIES.md) (sites as built) and the handoff point at these answers.

## Evidence

- **Captured:** 2026-10-18 in a cloud session, headless Chromium 141 with SwiftShader, dev build, 1280×720.
- **Source:** branch `gate/g8a-capability-sites`. The site code is in `5036ae6`; the preview and these docs are in the commit that follows it.
- **Command:** `node scripts/shot.mjs --url "http://localhost:5173/?play=1&manual=1&tod=0.42&..."` with pinned cameras (`cam` / `look`) or the follow camera.
- **What the frames are:**
  - The Keyhole approach, entry and exit frames are **staged poses** (the harrier placed and banked), not a flown pass.
  - The perch before, after and dismount frames are **real scripted flights** (flare held) and a real dismount.
- **Human playtest:** Robert, 2026-10-18, gamepad and keyboard; see [Playtest results](#playtest-results-2026-10-18). The commit, build, quality and frame rate were not recorded. The PNGs are not committed.

| File | SHA-256 |
|---|---|
| g8a-keyhole-axis.png | `64673416ed4c8d5a23cc676cdbe439a83aba5a00f723668f4eea510ca041721c` |
| g8a-keyhole-34.png | `0926cb201b24be128e9c629840878a72476bd7a8bedf618cc88dcc61dfc06c6d` |
| g8a-keyhole-wide.png | `2c3c85a974b9d2dda22c3e354883a311467be12c34de287fedd05635129d6c56` |
| g8a-keyhole-approach.png (staged) | `886eabbd76e3e2881a8b83220b8e2ac7b84ef55f21668030fddb9d3512a378d0` |
| g8a-keyhole-entry.png (staged) | `43725c4b7385855f2d6c95b4210774240853b200f7df66f7abbf903020033997` |
| g8a-keyhole-exit.png (staged) | `9b031db2a5a14e966e476a1b998833e64ec36183c6f0b76db79d256b69fda2fe` |
| g8a-perch.png | `a23852637a21bce7dd51fd7c2e5575b27ad581d13e28ec3e4dbd1c7d7cf9589a` |
| g8a-perch-side.png | `86ba76820504fc7ee7ad436e260550dcffacfca65d57048445646fc28f24754e` |
| g8a-perch-before.png (no landing) | `357a3b2f9939bc515229658e04d309db2e26109583665b1a56f39517edbf8e6f` |
| g8a-perch-after.png (landed, preview) | `eda80b5691fcf5cadd6b8551adf13cd2ca425776b9f62d4b86fa96de202b70a1` |
| g8a-perch-dismount.png | `dce280fc2669c2f6124afa25dcde2f6b7486f21a413249f7e43bc2979daeb66e` |

### Measured: perch

`src/world/rockForm.test.ts` runs a reduced version of each search below on every build.

- **Scripted flared approaches**, real `Player`: 5 positions along the fall line × 3 across × 3 heights × 3 speeds × 3 headings, per breed, no wind.

  | Land limit | Harrier | Skimmer | Galewing | Ironback |
  |---|---|---|---|---|
  | 0.65 (today) | 0 / 405 | 0 / 405 | 0 / 405 | 0 / 405 |
  | 0.602 (unlocked) | 196 / 405 | 170 / 405 | 197 / 405 | 204 / 405 |

  Every unlocked touchdown is still standing on the perch 6 s later.
- **In the running game**, 12 approaches including weather wind: 0 landings today; 8–9 with `capPreview=steep`, in both default and clear weather.

### Measured: Keyhole

All runs use the real `FlightModel` and `Terrain` with a scripted pilot. The search covers speed, when the reversal starts, how hard the roll is braked, the entry height along the crack and the entry climb.

| Case | Threads it |
|---|---|
| Harrier, normal roll | 0 of 37,260 settings (14–18 m/s, 0.5 m and 0.5 m/s steps) |
| Harrier, ×1.6 snap-roll | 180 of 53,820, at 14–16.5 m/s |
| Skimmer, normal roll | 39 of 5,184 (Q32: a skill site for the skimmer) |
| Galewing or ironback, either roll | 0 |
| Tucked (wings folded, no roll), all breeds | 1,082 of 14,040 (Q35) |

### Measured: meshes

Triangles per LOD:

| Form | LOD0 (1.25 m cells) | LOD1 (2.5 m) | LOD2 (7 m) |
|---|---|---|---|
| Perch | 10,216 | 2,568 | 300 |
| Keyhole | 36,368 | 8,892 | 996 |

- **Shape:** all closed (no open edges). LOD0 vertices sit within 0.35 m of the collision surface; most within 5 cm.
- **Build time:** the Keyhole's LOD0 takes about 0.6 s in total, built in 205 slices of about 3 ms each, inside the world's per-frame build budget. That's the source of question 20.
