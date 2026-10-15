# DRIFTWING — M1 "THE FIRST LEAD": PLANNING BRIEF FOR CODEX

**Status:** Planning only. Do not modify source until the owner approves Gate A.
**Checkout:** `/home/robert/Projects/Driftwing-Codex` · **Branch:** `dev/codex-wsl` · **Baseline:** `1d718e9`
**Roles:** Codex (the OpenAI coding agent) implements. Claude Code reviews independently from its own worktree. The project owner has final authority.

Naming note: "Codex" in this brief means the coding agent. The in-game airship that the research registry also calls the Codex is referred to here as "the airship".

Read `AGENTS.md`, `ARCHITECTURE.md` and the "Next: a living Drift" section of `docs/ROADMAP.md` first. Source is authoritative where documents disagree. Never edit another agent's worktree, never touch `main`, commit only with permission.

This brief is informational. It does not itself authorize implementation.

## 1. Objective

Build Driftwing's first complete environmental-discovery encounter:

**Spot → Approach → Land → Read → Follow**

The player notices something from the air, lands, dismounts, reads an inscription, and uses it to find a second site unaided. The second site teaches something true and useful about the existing wind.

Design principle: *Read it from the air. Earn it with the approach. Let what you learn change how you fly.*

The encounter is the feature. The knowledge record exists only to support it.

## 2. Findings to re-verify (from Claude's read-only inspection at `1d718e9`)

- `SaveData.research` is declared (`src/game/contracts.ts`, ~line 311) but `sanitize()` in `src/progression/save.ts` (~line 212) drops it. `SAVE_VERSION` is 1.
- The interactables registry is wired into `src/game/Game.ts` for prompts and input, but nothing in non-test source registers an interactable.
- The `researchEntry` event type exists in `src/core/types.ts` with no emitter or listener found.
- `src/research/registry.ts` holds 7 species, 6 Ventari sites, point values and 6 airship build stages. Its ids are save keys and must never be renamed.
- All six site inscriptions are flavour text. None points to another site.
- `src/world/dressing/ventari/plan.ts` places sites. The Observatory and Wind-Counters reuse existing structures; the other four come from a terrain search that omits a site if no flat spot fits.
- `thermalEnter` identifies a thermal by layout index (`src/sky/Weather.ts`, ~line 168). Ridge lift is also simulated there. No "rode a thermal to its top" event exists.
- `src/world/colliders.ts` has no velocity concept.

Not verified: whether the Ventari site meshes are actually built, whether airship dock visuals exist, and whether a save-reset function exists.

## 3. Owner decisions (binding)

**Sites.** First site: Shrine of the First Wind (`gullrest-shrine`). Second site: Highmoor. Choose between the Temple of the Gale and the Wind-Counters from evidence, and confirm every breed can reach it without exceptional manoeuvres. If Highmoor fails that test, say so and propose an alternative.

**Navigation.** Visible world features and written clues only. No quest markers. The player can re-read the clue after first reading it.

**Wind reward.** The second site teaches a natural sign the player learns to read: a real, existing tell for lift near the site, such as ridge lift on a windward face. It is text. It must describe something the simulation already does and the player can see and then fly. It must not change flight performance or reveal uncharted thermals. Any location-specific wind information is surfaced only after the player has flown it personally. Do not build a thermal chart in M1.

**Language.** In-world writing is Ancient Greek, carved as epigraphic capitals: no accents or breathings, minimal word spacing, with a few archaic letterforms (suggested: lunate sigma Ϲ, digamma Ϝ, koppa Ϙ). The English translation appears when the player reads it. No decipherment mechanic in M1. "Ventari" stays as the modern scholars' name for the builders. `ARCHITECTURE.md` forbids downloaded fonts, so carved glyphs must be procedural; do not rely on system fonts for archaic letters.

The Greek is provisional. The owner may later develop it into the game's own language, so keep inscription text as data that can be replaced without touching save keys, glyph code or site logic.

**Inscription text.** The lead is new authored content. You draft the Greek and the translation for both sites and present them at Gate A, marked provisional and unverified. State whether you replace the registry's `inscription` text or add a field.

**Airship.** M1 shows build stage 1 only, as the visible reward for the first survey. Proposed rule for confirmation at Gate A: stage 1 unlocks on reading the first-site inscription, and the displayed stage is capped at 1 regardless of derived points, so existing saves cannot skip ahead. Research points are recorded correctly underneath. A static stage change is in scope; construction animations are not. If the dock visuals do not exist, report the cost at Gate A before building anything.

**Existing finds.** Feathers, relics and landmark discoveries stay authoritative in their current save fields. Derive from them; never copy them into duplicate counters.

**Difficulty.** All required content is reachable by all four breeds. Harder perches may carry optional extras only.

**Quintus.** He stays out of M1. The owner wants him in the game later, so do not remove or rename anything that refers to him, and do not build dialogue now.

**Later gates.** The fifth breed is evaluated after this encounter plus one meaningful ambient species ship. Co-operative aerial sport is a committed long-term direction and must not delay M1.

**Project documents.** `AGENTS.md` and `docs/ROADMAP.md` predate two decisions: co-op aerial sport is now committed long-term, and the world language is Ancient Greek (provisional). Propose the exact wording changes at Gate A. Do not edit those files before approval.

## 4. Scope

**In:** the two sites; one aerial tell; one deliberate landing approach; one on-foot read interaction per site; the lead text; the wind sign; a small research runtime on existing contracts and events; persistent once-only research state; a minimal knowledge record; the capped stage-1 airship reward; old-save compatibility; keyboard/mouse and controller parity; tests.

**Out:** flight physics or breed tuning; new breeds; new regions or terrain generation changes; moving ships or decks; networking or multiplayer; companion AI; befriending; Quintus dialogue; research trees or a full journal; combat; grappling, banner lance or ball sports; destruction; new runtime dependencies; renderer changes; broad refactors.

Races, collectibles, cosmetics, ghosts, weather, audio, camera and customization must keep working.

## 5. Work packages and gates

- **WP0 (read-only):** verify section 2, confirm the sites, produce the plan. → **Gate A:** owner approves sites, clue, Greek text, wind sign, airship rule and document wording.
- **WP1:** research state model and save integrity. Pure and unit-tested. Decide deliberately whether `SAVE_VERSION` changes. Define reset behaviour. If anything thermal is persisted, use a stable key, not a layout index. → **Gate B:** review persistence tests and data contracts.
- **WP2:** first-site encounter. The read prompt must not conflict with mount, call or stable prompts. → **Gate C:** owner plays it in the browser.
- **WP3:** second-site discovery and the wind sign.
- **WP4:** minimal knowledge record: re-read the clue, see what is known, review the second finding, open and close with both input methods, respect reduced motion and pause behaviour. → **Gate D:** owner reviews the full loop.
- **WP5:** full regression, owner playtest, handoff in `docs/AI_HANDOFF.md`.

At each package: confirm scope, inspect, implement only what is approved, run focused tests, report diff and results, stop at the gate.

## 6. Acceptance criteria

**Gameplay**
- The first-site clue is recognisable in normal flight.
- Every breed can land at both sites with existing mechanics.
- The clue leads to the second site with no marker and no knowledge of coordinates.
- The second finding is true of the simulation and useful in flight.
- Mounting and take-off remain seamless.

**Progression**
- Rewards apply exactly once; research survives save and reload.
- Older saves load correctly; malformed research data is handled safely.
- Existing finds are not double-counted.
- Displayed airship stage never exceeds 1.
- Reset behaviour is correct and tested.

**Presentation**
- Both input methods work; prompts do not conflict; reduced motion is respected.
- Carved Greek and site dressing fit the painterly style.

**Regression**
- Flight tuning, breed parameters, golden fixtures, race times and ghosts are unchanged.
- No new dependencies or engine changes; no unexpected tracked files.

**Experience (owner playtest only)**
- The player can explain how the first clue led to the second site.
- It feels like discovery, not following UI.
- Free flight does not become a checklist.

## 7. Testing

Unit tests: first and repeat discovery, reward idempotence, event emission, migration of existing saves, round trips, malformed data, reset, the stage cap, and that both chosen sites have anchors.

Interaction tests: eligibility, proximity selection, on-foot versus mounted, prompt conflicts, both input methods, opening and closing the record.

Regression: `npm run typecheck`, `npm test`, `npm run build`, then the documented smoke test. Never change a test to hide a failure. Report exactly what ran and what passed, and distinguish source inspection from runtime verification.

A brief stutter after repeated dives was seen once before this work and could not be reproduced. Record it as an observation, not a regression.

## 8. Separate track: co-op aerial sport

After Gate D, write a planning-only architecture note for a future co-operative and competitive aerial ball sport with its own identity. Cover team objectives, ball contact and ownership, authority and synchronisation, input versus state replication, limits of the deterministic simulation, latency fairness, and whether a single-player practice mode could validate it first. For M1, list only unavoidable compatibility constraints. Add no speculative networking abstractions.

## 9. Required first response

Do not implement anything. Reply with:

1. Branch, commit and clean-tree confirmation.
2. Verification of section 2, including the three unverified items.
3. The confirmed site pair with source evidence of safe access for all four breeds.
4. The aerial clue and why it is visible in flight.
5. The specific wind sign and the existing simulation behaviour it describes.
6. Draft Greek inscriptions with translations, marked provisional.
7. The airship stage-1 plan and its cost.
8. Proposed wording changes for `AGENTS.md` and `docs/ROADMAP.md`.
9. Affected source files and expected test files.
10. Conflicts with the registry or roadmap, and remaining owner decisions.
11. The implementation sequence against the gates above.

Then stop and wait for Gate A approval.
