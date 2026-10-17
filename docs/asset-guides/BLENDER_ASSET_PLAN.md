# Blender asset workflow — shared planning direction

Recorded 2026-10-11 at Robert's request. **Planning direction accepted; asset creation,
pipeline implementation, installation, runtime changes, commits, pushes, merges and
deployment are not authorized by this document.** Robert requested project guidance
and a prompt for a new planning chat only. Historical implementation approvals do not
authorize this new pipeline. This document applies to both Claude and Codex when present
in their checkout; it is not evidence that another agent has read it.

## Direction and current boundary

Use Blender as the proposed primary authoring tool for hero riders, clothing, dragons
and selected props. Retain procedural world generation and Driftwing's TypeScript,
Three.js WebGLRenderer, painterly presentation, deterministic 120 Hz simulation,
animation authority and shared analytic geometry contracts.

Proposed delivery: editable `.blend` sources -> optimized GLB meshes and authored maps
-> an explicit Driftwing import/material/rig/cloth integration layer. Package runtime
assets and any decoders with the game to preserve self-contained delivery. Blender
renders are intermediate art evidence; actual gameplay cameras determine acceptance.

At inspected rider branch `codex/rider-c02-proof`, HEAD
`8e055069703c83308d5508ee72e5ad1d15ef348e`, models and clothing are generated in code;
no GLTFLoader/GLTFExporter integration was found in src or scripts. Recheck live source
before work. ARCHITECTURE.md's procedural-only rule describes the current system;
this plan records a future hybrid direction, not an implemented exception.

## Artistic authority and readiness

Read [the shared art guide](../ART_DIRECTION.md) first. Current explicit user decisions
take precedence over historical pack instructions and concept imagery. In particular,
the reviewed bracer-fired Windline behavior supersedes old thrown-lance descriptions.
Do not revive old traversal tasks or add a banner weapon because a reference depicts one.

Required sources:

- [Master v2](../art/Driftwing_Codex_Handoff/01_Sky_Lance/Art_Direction_Master.md),
  [pack introduction](../art/Driftwing_Codex_Handoff/README_START_HERE.md) and
  [art index](../art/README.md). Use corrected image paths in ART_DIRECTION.md.
- [Individual component specifications](../art/Driftwing_Codex_Handoff/02_Wardrobe/Individual_Armor_Specifications.md)
  and the indexed component cards and costume atlases; subordinate conflicting older designs.
- [Current rider review](../rider-c02/QA_REVIEW.md),
  [integrated engine captures](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/archive/evidence-2026-10-17/docs/rider-c02/evidence/qa/integration/index.html),
  [wardrobe contracts](../systems/WARDROBE_CUSTOMIZATION.md),
  [texture policy](../systems/TEXTURE_QUALITY.md) and [graphics policy](../systems/GRAPHICS_QUALITY.md).
- Original C02/M01 review folder on Robert's computer:
  `C:/Users/Robert/.codex/visualizations/2026/10/11/01a12849-3937-7751-9312-e47a7490a343/rider-review/`.
  Read `DESIGN_BRIEF.md` and `APPROVAL_RECORD.json`; visually inspect
  `01-rider-design-v2.png`, `02-wardrobe-v2.png`, `03-materials.png` and
  `04-mounted-v2.png`. These exact paths are local, not remote/mobile links.
  The original P1 source-pending status and limited rollout scope are historical:
  subsequent user-approved shared bodies, seven-outfit mixing and quality changes
  are recorded in current repository guidance. Do not roll them back.

Artistic target: Aegean sky travelers, companionship, readable draped silhouettes,
dry pale linen, broad matte slate scales, worn leather and softened bronze. Keep
rounded anatomy, intentional garment overlaps, restrained detail and distinct material
response. Preserve skin/hair identity and player dyes independently of outfit palette.
Increase fidelity through shape, topology, deformation and surface authorship; avoid
indiscriminate subdivision, gloss, embroidery or photo-realistic detail.

| Category | Enough context for | Remaining decisions before production |
| --- | --- | --- |
| C02 rider + M01 | Planning one medium-build Travel Drape trial with existing ponytail, reference silhouette and material studies | Consistent measured body proportions, validated front/side/back construction, face/hand/foot detail and joint deformation targets. The illustrated views are not guaranteed orthographic or mutually consistent. |
| Modular clothing | Preserving all seven presets/eight existing mix categories and material families | Seam/attachment map, hidden back/underarm construction, shared waist/ankle boundaries, thickness, coverage rules, approved overlaps and mounted conversion. |
| Dragons | Companion character, graceful silhouette, current breed/rig baseline | Select first breed; reconcile mood art with current anatomy; front/side/top and wing-open/folded construction; membrane attachment, proportions, saddle/contact envelope and surface zones. No new dragon design is approved here. |
| Props/buildings | Mediterranean material and shape language | Choose a first asset, dimensions, reuse/instancing and collision expectations. Existing world contact geometry remains authoritative. |

Verdict: sufficient to begin a precise rider planning brief, not enough to silently
invent a complete production library. Record each unresolved detail as a proposed
interpretation with a source and confidence; bring material silhouette/identity
decisions to Robert. Do not demand new reference uploads before inspecting the available
sources. If local review plates are unavailable in another environment, report the gap
and use repository references for independent planning; do not claim to have seen them.

## Proposed technical contract

- Export or reconstruct the current mesh/rig baseline for comparison only after a trial
  is authorized. Preserve bone hierarchy, bind transforms, axes (+Z forward/+Y up),
  scale, skin weights, sockets, animation ownership, planted feet and mounted contacts.
  Bone names alone do not establish compatibility. Do not replace the rig with a
  generic autorig without a separate decision.
- Author modular pieces against shared fitting boundaries. Preserve cosmetic/unlock
  IDs, all existing outfits and mixing, saves, preview/Revert and efficient recoloring.
  Use neutral detail plus dye masks and explicit linen/leather/scale/metal identities.
- Map exported material data into the existing painterly shaders. Blender node graphs,
  lighting and color management do not automatically reproduce the engine appearance.
  Reference plates are inspiration, not UV-ready textures or approved runtime files.
- Use Blender to design cloth construction and resting folds. Interactive wind/contact
  remains an engine responsibility. Investigate a coarse simulation surface driving
  the detailed garment through a binding adapter; the existing procedural cloth topology
  is not a drop-in solver for arbitrary imported meshes. Preserve bounded motion,
  pinned seams and contact behavior. Linen, heavy cloth, fitted leather and articulated
  metal need different responses; do not simulate every vertex or metal plate as cloth.
- Keep `.blend` source, exported assets, material metadata and repeatable validation
  distinct. Decide source storage/versioning and export conventions before adding large
  binaries. Validate exported vertex counts, weights, texture dimensions, material/draw
  counts, attachments and missing resources, not only Blender scene statistics.
- Low remains accessible to integrated graphics; Medium/High/Ultra target dedicated
  graphics. Existing rider 1K/2K/3K/4K tiers are a starting point, not mandatory sizes
  for every map/asset. Future dragon bitmap budgets remain proposals. Evaluate KTX2,
  mesh compression and authored LODs against measured memory, loading and frame time.
  Do not infer an overall budget from one fast scene or from software-rendered captures.

## Proposed staged trial and acceptance

1. Planning only: reconcile references, audit installed tools without installing or
   launching them, define art gaps, rig/material/cloth/export contracts and measurable
   budgets. Present the concrete trial for implementation approval.
2. If separately authorized, one medium rider + Travel Drape trial; preserve the existing
   ponytail and validate compatibility with the entire current wardrobe. Keep the
   existing implementation available for comparison and rollback.
3. Four QA passes: (a) silhouette/anatomy/materials in gameplay and Stable;
   (b) seams, mixing, deformation and both mounted sides;
   (c) wind/gusts, cloth recovery, armor rigidity, walking, flight and Windline;
   (d) saves/unlocks/dyes/Revert, all quality tiers, loading, memory and sustained hardware
   performance. Record exact cases, captures, failures and fixes. Sampled clearance
   cannot prove zero clipping for every continuous pose and combination.
4. Review the in-engine improvement and cost with Robert. Only after success and new
   scope authorization, trial one dragon breed, then expand selected assets.

## Tool references

- [Blender modeling](https://www.blender.org/features/modeling/)
- [Blender Python API](https://docs.blender.org/api/current/info_overview.html)
- [Blender glTF export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)

Capabilities were researched during planning. The installed Blender version, export
settings and compatibility must be verified before implementation; no working Blender
pipeline or imported runtime asset is claimed by this document.
