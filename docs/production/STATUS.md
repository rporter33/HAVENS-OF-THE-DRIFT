# Dragon Circuit production status

Checkpoint: 2026-10-14 UTC. This file is a dated source inspection, not a release certification. Reverify remote main, branch status and open PRs before new work. [Owner decisions](DECISIONS.md) and [organization map](ORGANIZATION.md) explain this documentation scope.

## Verified repository baseline

- Repository: `rporter33/Dragon-Circuit`; main inspected at `88764f93e4c54e7b28ff8d0951c963e8b12c6db0`, tree `8e740d9f8f38de3c9c585fd481440576cf815d93`.
- [Meshy documentation PR #5](https://github.com/rporter33/Dragon-Circuit/pull/5) was merged on 2026-10-14 at 19:56:02 UTC. Its head was `40759d0e96c236c023f798ce2cdd9a35e8f8727c`. No open PRs were returned at the organization baseline check.
- The source remains TypeScript/Vite/Three.js WebGL 2, with deterministic 120 Hz flight and shared analytic world geometry. Game/editor entry points, script paths, saves and build configuration are retained.
- Baseline tracked inventory: 553 files, 33,249,002 Git-blob bytes; 112 test files. The supplied reference ZIP and 32 extracted files are preserved, with 31 entries in its SHA-256 manifest.

## Selected direction and current implementation

The owner's current direction is a racing-first exploratory fantasy game with intelligent dragons/wyverns and modular rider/creature cosmetics. Meshy is the primary generator, with Blender cleanup and authoring. Existing Tripo studies retain their provenance. See [design](../design/README.md) and [art guides](../../Art%20and%20Assets/Guides/README.md).

Current creatures/world remain procedural. Existing code includes wyvern/rider customization, flight/races, research and editor systems; imported generated bodies and six-limbed dragon rig compatibility are not established by this documentation. Windhaven remains a stationary study; broader ship gameplay and multiplayer remain future scoped work.

## Availability and readiness gaps

- No tracked `.blend`, `.fbx`, `.glb` or `.gltf` master/model exists at this baseline. The female study is reported outside the repository; no new local-asset or backup verification is claimed here.
- The separate master/raw archive destination is pending. Its existence, independent backup and restore verification are not established.
- The eight chapter-01 storyboard PNGs are referenced through a private Library package, not committed. The website section is planning; no website application has been implemented.
- [Asset records](../../assets/README.md) distinguish known committed files from external/missing material and unknown rights. Title-MP3 source/rights need evidence; root MIT licensing is not an asset-specific rights audit.
- Current-main CI, physical GPU/controller testing, current live deployment and Steam packaging/readiness are not certified here. The baseline Actions query returned no runs for the inspected main SHA. Older reports retain their original tested commits.

## Next scoped work

Review this documentation organization and its validation record. Commit/push and a separate draft PR for this bounded scope were authorized; merging, deployment, archive setup, asset relocation, website implementation and gameplay changes remain outside the scope. Choose archive destination/access/backup policy before a separate preservation task. Use the [release checklist](../release/README.md) to collect evidence without marking untested gates complete.
