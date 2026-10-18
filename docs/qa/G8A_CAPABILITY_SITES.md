# G8a capability sites: playtest plan and evidence

[QA index](README.md) · [Capability spec, sites](../design/CAPABILITIES.md#capability-sites-for-g8) · [Decision log](../design/DECISION_LOG.md) (Q30, Q32–Q35, Q41–Q45)

Two sites built for the G5 capabilities: the **Cascade south perch** (steep-slope landing) and the **Archway Keyhole** (snap-roll). The sites are real terrain in every build. G5's capabilities don't exist yet, so the "after" side can only be felt through a debug-only preview.

## Playtest

### Setup

The sites are on `main` (G8a merged as #9). The G8b polish (the repainted perch, the "Too steep to land" message and the longer Keyhole chamber) is on the branch `claude/loving-gates-7sydp9` until it is merged:

```
git fetch origin
git checkout claude/loving-gates-7sydp9
git pull
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
| 13 | Readable, but more effort is needed in what happens when mounts hit rocks. | [Q42](../design/DECISION_LOG.md) answered: stagger and recover. |
| 14 | Fair, "but not consequential to hitting a rock wall". | Q42. Read as: the hit is fair, but it has no real consequence (confirmed). |
| 15 | Feels legitimate, and what Robert had in mind. | [Q35](../design/DECISION_LOG.md) answered: the tuck is accepted. |
| 16 | Gamepad is good, keyboard is hard. The snap-roll animation should have noticeable detail and look cool. | [Q33](../design/DECISION_LOG.md) answered; [Q41](../design/DECISION_LOG.md) answered (a longer keyboard window); animation direction in Q43. |
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
| F1 | The perch doesn't read as a place to land: its tilted top and rim are hard to tell from decoration. | 3, 5, 6 | Addressed in [G8b](#g8b-site-polish-2026-10-18) (an ivory slab, a scrub-fringed rim, a shaded lip); awaiting a re-test. |
| F2 | A failed landing on the perch reads as a bug, and nothing says why. | 6, 7 | Addressed in G8b (a "Too steep to land" toast with the slope and the breed's limit); awaiting a re-test. |
| F3 | After sliding off the perch, the mount "kind of freezes up". | 7 | Reproduced as a feel problem, not a stuck state (scripted, flare held, 2026-10-18). The mode stays `flying` and the pose keeps animating. The controls are stunned for 0.6 s after the hit, then the mount spends about 2.4 s under 8 m/s in the flare pose, sliding down the face, and is back above stall speed 3.7 s after the hit. Releasing flare 0.7 s after the hit and flapping or diving recovers in 1.8 to 2.4 s, so input works. Nothing tells the player to let go of flare. Robert's own input isn't known. |
| F4 | The follow camera clips into rock while the mount is falling. | 21 | Reproduced on the perch (scripted, flare held, sampled at 30 Hz). When the crag comes between the camera and the mount, the boom snaps in from about 29 m to 12.5 m in one frame. The camera ends 0.87 m inside the rock for 2 frames and within 0.6 m for 5, about 0.17 s. Variants that release flare also come within 0.6 m. Not tested against other rock; the cause isn't identified. The camera is outside G8a, and a fix needs its own gate. |
| F5 | The double-tap snap-roll is hard on a keyboard. | 16 | Decided in Q41: a longer keyboard window, built with G5. |

### Where the answers went

- [Q33](../design/DECISION_LOG.md) and [Q35](../design/DECISION_LOG.md) are answered.
- [Q41](../design/DECISION_LOG.md) (keyboard snap-roll input) and [Q42](../design/DECISION_LOG.md) (what a rock hit costs) are answered.
- [Q45](../design/DECISION_LOG.md) opens the site-polish gate ([G8b](#g8b-site-polish-2026-10-18)) and the read-only reproduction of F3 and F4.
- [Q43](../design/DECISION_LOG.md) records the direction for the sites and the capabilities, and what it doesn't authorize.
- [CAPABILITIES.md](../design/CAPABILITIES.md) (sites as built) and the handoff point at these answers.

## G8b: site polish (2026-10-18)

Opened by [Q45](../design/DECISION_LOG.md) after the playtest. Built on the same branch as the answers; not yet played.

**What changed**

- **The perch's top reads as a landing slab (F1).** Its landing plane is now a bright ivory slab with faint streaks down the fall line, framed by a fringe of scrub along its rim and a shaded lip on the flank just under the edge, so the plane and its outline read against the warmer cliff. It is paint only: no geometry or collision changed. The palette follows the Archway Reach render's ivory limestone with scrub along its ledges.
- **A failed landing says why (F2).** When a flared approach meets ground too steep for the breed, a toast reads "Too steep to land. A Harrier lands on slopes up to 49°. This one is 52°." It shows at most once every 8 s, never for ground steeper than about 70°, and not at all when the wyvern can land. It is presentation only: no flight or landing change. On a steep slope the body touches before the legs do (the legs' reach is measured straight down), so the message is also raised from the body's contact, not only from the legs' own check.
- **The Keyhole's chamber is 14 m, from 9.5 m.** The target (Q43): a good unassisted pilot can sometimes thread it, and the snap-roll makes it reliable.

**Why 14 m.** A scan of chamber length with the scripted harrier (a 3,024-setting grid, 14–20 m/s). The heavy breeds were checked at 14, 15 and 16 m, and at 9.5 m in G8a:

| Chamber | Normal roll threads | ×1.6 snap-roll threads | Ironback with the unlock |
|---|---|---|---|
| 9.5 m (G8a) | 0 | 15 | 0 |
| 12 m | 5 | 76 | not measured |
| **14 m (G8b)** | **19** | **156** | **0** |
| 15 m | 34 | 197 | 3 of 5,184 |
| 16 m | 54 | 231 | 6 of 5,184 |

At 15 m the ironback starts to thread it with the unlock, which would break Q32 (the galewing and ironback stay out), so 14 m is the longest chamber that keeps it. At 14 m the best timing window (how far the start of the reversal can vary and still thread it) is about 2.5 m (0.15 s at 16 m/s) at normal roll and about 6 m (0.37 s) with the snap-roll. A normal-roll pilot threads it by starting the reversal early, at the front of the first crack, rather than inside the chamber.

**Not changed:** `src/flight`, the courses (Archway Thread and Cascade Run tests unchanged and green), the tuck (Q35), the keyboard input (Q41), rock-hit consequences (Q42) and the F3 and F4 fixes. "Small variations between sites" has nothing to vary yet: one site of each kind.

### Re-test questions

Same URLs and controls as above.

B1. From the approach, does the perch's slab now read as a place to land? Does the scrub fringe outline the rim well, or is it too much or too little?
B2. Up close and from above, does the slab belong in the world (colour, the shaded lip under the edge)? Anything odd?
B3. Fly into the perch with no preview. Does the "Too steep to land" message appear when you flare into it, and does the wording say what you need? Did it ever appear somewhere it shouldn't, such as a cliff scrape or an island rim?
B4. After the message, is it clear what to do next (let go of flare and fly away)?
B5. Keyhole with no preview: can you thread it sometimes now? Did you find that starting the roll early works? Does it feel fair?
B6. Keyhole with the snap-roll: how many tries did it take now, and is it still clunky?
B7. Does the Keyhole still read as a way through from a distance, with the longer chamber?

## Evidence

- **Captured:** 2026-10-18 in a cloud session, headless Chromium 141 with SwiftShader, dev build, 1280×720.
- **Source:** branch `gate/g8a-capability-sites`. The site code is in `5036ae6`; the preview and these docs are in the commit that follows it. The G8b captures (below) are from `claude/loving-gates-7sydp9`, in the G8b commit.
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

G8b captures (2026-10-18, headless Chromium with SwiftShader, dev build, 1280×720, `tod=0.42`). The three perch frames are real scripted flights on the follow camera, except the top view, which is a pinned camera over a real flight. The Keyhole frames are staged poses on the new geometry. No human has seen these yet.

| File | SHA-256 |
|---|---|
| g8b-perch-far-v2.png (the slab from about 70 m, follow camera) | `53a632d768890f6a9641a9d630c9de3ce84ac4196596a302452092af344b7e38` |
| g8b-perch-near-v2.png (about 35 m) | `dc122919f830d761854c15350cfe2fa9a7b4dfdcdda09adde0276207da5c9874` |
| g8b-perch-top-v2.png (from above, pinned camera) | `68143a422658f357eb4dba8cdd973f6be602004199dd4a1700962c4397612e3c` |
| g8b-toast-b.png (the "Too steep to land" toast, real flight) | `f2d0cb9caf2373b134b9e1cf5caa0725414f59ed6c4095e1a97457ab3c1ba56a` |
| g8b-keyhole-approach.png (staged) | `5c8e853a864f370b66c836a8e5490e21f12e8c847b31661f8376db1a2c5a72c5` |
| g8b-keyhole-entry.png (staged) | `b347afa6bbd1fa5fc0bcee6c203c2efa6245d597c6caae92e7dc0fffa0fe5e50` |
| g8b-keyhole-exit.png (staged) | `e03a194df73a7890a1cfd513a87493367b5217abdfad610f05701e05e68c482e` |

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

| Case | G8a, 9.5 m chamber | G8b, 14 m chamber |
|---|---|---|
| Harrier, normal roll | 0 of 37,260 settings (14–18 m/s, 0.5 m and 0.5 m/s steps) | 195 of 37,260 (0.5%), at 14–18 m/s |
| Harrier, ×1.6 snap-roll | 180 of 53,820, at 14–16.5 m/s | 1,996 of 53,820 (3.7%), at 14–20 m/s |
| Skimmer, normal roll | 39 of 5,184 (Q32: a skill site for the skimmer) | 272 of 5,184 |
| Skimmer, ×1.6 | not recorded | 699 of 5,184 |
| Galewing or ironback, either roll | 0 | 0 of 5,184 each |
| Tucked (wings folded, no roll), all breeds | 1,082 of 14,040 (Q35) | 1,109 of 14,040 |

`src/world/rockForm.test.ts` runs a reduced search (a 3,024-setting grid) and pinned lines on every build: the normal-roll harrier threads a few settings (at least 5, under 3%), the snap-roll threads at least four times as many, pinned early-reversal lines thread at normal roll, the same entry lines with a late reversal thread only with the snap-roll, and the galewing and ironback never thread it.

### Measured: meshes

Triangles per LOD:

| Form | LOD0 (1.25 m cells) | LOD1 (2.5 m) | LOD2 (7 m) |
|---|---|---|---|
| Perch | 10,216 | 2,568 | 300 |
| Keyhole | 39,048 | 9,456 | 1,092 |

- **Shape:** all closed (no open edges). LOD0 vertices sit within 0.35 m of the collision surface; most within 5 cm.
- **Build time:** the Keyhole's LOD0 takes about 0.6 s in total, built in 223 slices of about 3 ms each, inside the world's per-frame build budget. That's the source of question 20.
