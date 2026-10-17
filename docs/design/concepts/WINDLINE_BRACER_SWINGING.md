# Driftwing — Windline Bracer / Sky Lance Swing Traversal

**Status:** Design proposal / Codex planning reference only  
**Priority:** Isolated post-M1 experiment; **not** an authorization to implement or modify the active M1 worktree  
**Prepared:** 2026-10-10  
**Related:** Air Nomad/Sky Lance art reference pack supplied by the owner; `AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/AI_HANDOFF.md`

## 1. Creative goal

Make traversal between floating islands and monumental ancient ruins feel like a practiced Air Nomad skill: read the architecture, cast the ceremonial Sky Lance, engage a wrist-mounted windline regulator, arc under gravity, and release with real momentum into another climb or landing. The tool is an **aerial navigation instrument**, not a modern gun, powered zipline, or web shooter. Dragon flight remains Driftwing's central long-distance traversal fantasy; this adds precise, personal movement through close architectural spaces.

**Working name:** Windline Bracer (a.k.a. Navigator's Grapple). Names are provisional.

## 2. Source-of-truth and concept-art correction

The companion generated concept poster titled *The Navigator's Grapple* is a **visual mood board, not mechanical/asset canon**. It depicts a glowing beam fired directly from the wrist, ornate European-fantasy towers, and an elaborate cloak; those details **must not override** the approved Mediterranean Air Nomad art direction.

The existing Sky Lance handoff identifies the lance as a long, restrained ceremonial **banner-lance**, carried or mounted on the saddle, that also functions as a **throwable javelin/grappling anchor**. The first approved gameplay experiment is:

`THROW LANCE → STATIC ANCHOR → FIXED-LENGTH SLACK/TAUT TETHER → PHYSICAL SWING → VELOCITY-PRESERVING RELEASE → RECOVER LANCE`.

**Reconciliation:** Treat the bracer as a wrist-side **line controller, safety catch, aiming/feedback instrument, and release actuator**. The Sky Lance itself is thrown and embeds. The tether line is visually attached to its anchor; its principal load path goes through the already-referenced **crossback flight harness**. Do not have a tiny wrist cuff bear a full-speed rider's weight, and do not add a separate wrist-fired projectile unless specifically approved in a later design review. Treat luminous blue line as optional readability/VFX, not a requirement for magical propulsion.

The earlier art pack's purely ceremonial lance language is superseded *for function* by the later throwing/grappling directive; preserve its restrained sky-nomad silhouette and material palette.

## 3. Form, materials, animation

- **Form:** Compact, low-profile left or right forearm bracer over cloth/leather wraps. Slim bronze retaining plates, a small exposed mechanical reel/guide, thumb-operated release tab, ring/spiral inlay indicating wind direction. It must read at third-person gameplay camera distance.
- **Palette:** Chalk linen `#F2EADA`, aged bronze `#AA8656`, deep coastal/ultramarine blues and subdued leather; avoid sci-fi displays, chunky gun barrels, electric-orange machinery, and overdesigned Victorian clockwork.
- **Anchor:** Sky Lance maintains narrow ceremonial leaf tip/open-loop silhouette, visible banner/pennon, and meaningful embedding orientation. Cloth and pennon are **presentation only**, never part of physics.
- **Load:** Bracer registers tension and release; strap/crossback harness takes most of it. Optional short hand-grip pose signals bracing. This also prevents forearm and shoulder animations from looking anatomically impossible.
- **Readability:** In range: subtle bracer indicator; on valid surface: small in-world anchor cue; while taut: readable rope, restrained line tension/audio and leaning pose; on release: quick slack/reel reset. Avoid HUD spam.
- **Style:** Sun-bleached monumental Greco-Mediterranean ruins, broken colonnades/aqueducts, pale stone, bronze wind rings, sea-blue sky and cloth. Air Nomad banners and the lance remain recognizable.

## 4. Player experience and control contract (proposal)

1. **Equip / target:** On foot or during the later authorized rider leap/fall system, aim a lance at a clearly eligible **static** anchorable surface. Initial prototype can use deliberately placed bronze mooring rings and known solid masonry; no moving targets.
2. **Throw:** A deliberate input launches the visible Sky Lance as a projectile, with swept hit detection so fast shots cannot tunnel. Misses have a bounded recovery/reset path.
3. **Latch:** After a valid hit the line connects and stores a fixed maximum radius `L = distance(harnessAttach, anchor)`. It can be slack within this sphere. Invalid materials, occlusion, unreachable anchors, or forbidden player modes reject cleanly.
4. **Swing:** Gravity and preserved movement velocity produce the pendulum arc. When distance reaches `L`, remove only the outward radial component of relative velocity and constrain outward displacement; retain tangential and inward velocity. **Do not** shrink `L`, teleport to anchor, auto-pull, or add energy by constraint correction.
5. **Steer:** Let movement inputs apply modest physically plausible air control, preferably reusing an existing available air-control contract. Test that steering cannot create unbounded energy or turn the swing into flight. Do not introduce boost/pump in V1.
6. **Release / vault:** An explicit release detaches the rope **without changing instantaneous player velocity**. A release near the upswing sends the rider forward/up naturally; one near the nadir trades little height. A jump from solid ground remains governed by the existing walker.
7. **Recover:** Lance is recovered/reset visibly after dismount/release/landing or a failed cast, through a bounded animation/state transition; never leave the player permanently without required equipment.

**Controller first, keyboard/mouse also:** Inspect existing control bindings and tutorial prompts before assigning buttons. Do not collide with interact, mount/call, camera, jump, combat, or photo controls. Propose bindings as a review item, not a decree.

## 5. Physics and integration rules

- Preserve the project's **deterministic 120 Hz fixed-step** simulation and its existing world/terrain collider contract.
- Identify exact movement authority before touching physics. The checked-out project defines `RiderFoot` at `src/player/foot.ts`, and `Player` at `src/player/Player.ts` orchestrates `flying / landed / onFoot / falling / respawning` and automatic wyvern catch. Do **not** simultaneously let normal foot/fall integration and the grapple integrator move the rider.
- Recommended **design** is a narrowly scoped airborne foot/grapple substate or explicit grapple ownership of rider integration during tension. Codex must inspect actual current source and propose the least disruptive state-machine change, including exact transition guards.
- When taut, `n = normalize(playerHarnessPosition - anchor)`; for `dot(v, n) > 0`, `v := v - n * dot(v, n)`. Then perform non-penetrating positional correction only to restore the length bound, preserving velocity tangential to the tether. Consider using substeps/sweeps and reconcile rope with nearby solid world collisions; do not blindly apply this formula without collision tests.
- Tether originates from a physically plausible harness attachment point. The rendered line can visually pass through a bracer guide while the gameplay constraint is owned by the harness point.
- Anchor positions are **world-static** for V1. No other dragon, moving platform/airship, hostile entity, or destructible target.
- During grapple/swing, explicitly arbitrate the existing automatic wyvern rescue/catch. Ensure a release returns to a safe normal fall/catch route; never let a delayed catch fire while actively taut.
- Detach and recover cleanly on respawn, teleport, re-mount, reset, world reload, or scene teardown.
- Maintain collision consistency with terrain geometry and solid props. Do not permit tunneling through cliff rims, masonry, or floors by rope correction.
- Rope VFX, banner cloth, sounds, and camera motion are derived presentation, **not movement authority**; never depend on frame rate.
- Proposed camera: widen FOV slightly at speed, keep player + projected movement legible, avoid sickness-inducing automatic rolls; validate controller usability and silhouette.

## 6. Prototype limits and success criteria

**V1 slice:** One known static anchor within an unambiguous Greco-Mediterranean test archway or broken aqueduct, short walk-up, throw, latch, pendulum swing, release to another walkable platform, recover. Avoid broad content passes and no rewriting flight physics.

**Acceptance tests (Codex to locate or implement when explicitly authorized):**
- Valid static materials latch; invalid/soft or out-of-range objects reject.
- Fast lance never tunnels; first solid eligible impact resolves unambiguously.
- Rope radius is bounded at fixed length with permitted slack.
- Tangential speed is conserved up to expected loss from modeled gravity, input and collision; radial constraint does not inject energy.
- Release retains exact pre-release world velocity (within numerical tolerance) and correctly resumes normal fall/landing.
- One attempt can progress through `idle / projectile / anchored / swinging / released / recovery` without orphaned tether.
- Collision with cliffs and architectural pillars is safe even at high swing speed.
- Auto-wyvern catch, remount, respawn, teleport, save/reset, controller input, and fixed-frame deterministic replay have explicit passing tests.
- Visual check: line, Sky Lance, banner and crossback harness do not intersect rider/dragon in representative camera poses.

## 7. Safe implementation phases (not yet approved)

**Phase 0 — Read-only technical reconnaissance:** Confirm branch/HEAD/dirty state; inspect `AGENTS.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/AI_HANDOFF.md`, `src/player/foot.ts`, `src/player/Player.ts`, collision/terrain interfaces, input and camera, current grapple code/tests if any, and this brief. Report conflicts, affected files, proposed minimal interfaces, collision/physics algorithm and tests. **No changes, no commits.**

**Phase 1 — Isolated deterministic graybox prototype, only after owner approval:** Implement strictly static anchors, a constrained rope solver, lifecycle and input integration behind a controlled opt-in; focused tests. Do not advance M1 gates implicitly.

**Phase 2 — Art and readability, only after additional approval:** Replace graybox visual with authentic lance/banner/bracer/harness assets; rope, guide rings, VFX, poses, readability/audio and camera tuning. The owner's images are **references**, not mesh/animation source assets.

**Phase 3 — Content and progression, only after additional approval:** Design world anchor placement, mastery encounters, and tutorial gating. No moving-object grappling in this milestone.

## 8. Open design calls

- Is the bracer standard rider gear or an exploration unlock?
- Is lance throwing possible only on foot, only while falling, or also from dragon saddle? The first safe recommendation is **on foot/freefall only**, not while mounted.
- Do we expose a reticle only on valid surfaces, or show a limited hand-crafted anchor cue?
- Is recovery an instant reset off-camera for V1 or an animated reel-and-return sequence?
- What maximum reach/length, steer authority, and rope collision complexity feel right under actual playtest?

## 9. Agent handoff / branch discipline

The project's `dev/codex-wsl` was previously reported as **dirty** (37 modified and 13 untracked files at earlier checkpoint `1d718e9`); recheck the live state. Do not reset, stash, merge, cherry-pick, commit, or overwrite local changes. This brief lives on a separate documentation branch `docs/windline-bracer-concept`; **read it by fetching the branch and using `git show` rather than merging**.

```bash
git fetch origin docs/windline-bracer-concept
git show origin/docs/windline-bracer-concept:docs/concepts/WINDLINE_BRACER_SWINGING.md
```

The earlier supplied complete Air Nomad/Sky Lance reference pack remains authoritative for fine art decisions; if it is not actually present in Codex's filesystem/repo, request it rather than inventing its contents. The poster is optional supplementary visual evidence and must be labeled concept art, not approved game design.

**Requested next action from Codex:** Phase 0 only: review feasibility, dependencies, controls, specific code entry points, physics risks and a gate-by-gate implementation proposal. Await explicit implementation authorization.

## 10. GitHub visual references

**Mechanics diagram (SVG; repo-native, scalable):** [Windline Bracer / Sky Lance mechanics](../../assets/concepts/windline_bracer_mechanics.svg). This is a new simplified technical schematic showing static anchor, harness load path, bracer, swing arc and release.

**Original generated poster — compressed preview only:** [Navigator's Grapple concept poster preview](../../assets/concepts/navigators_grapple_poster_preview.webp). This is a **256 × 171 WebP preview**, not the full-resolution poster; small captions will not be readable. The original 1536 × 1024 PNG remains available as a conversation attachment from the owner. For full art critique, acquire/commit that original file explicitly. Codex should not claim the reduced thumbnail preserves the art's fine details.

![Concept poster preview](../../assets/concepts/navigators_grapple_poster_preview.webp)

![Mechanics diagram](../../assets/concepts/windline_bracer_mechanics.svg)
