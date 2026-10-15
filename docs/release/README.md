# Release preparation

[Current checkpoint](../production/STATUS.md) · [QA](../qa/README.md) · [Owner decisions](../production/DECISIONS.md)

This is an evidence checklist. No gate is marked passed by repository organization. The game and later comic website share this repository for coordinated release; Steam is an eventual goal and multiplayer is later work.

| Gate | Current evidence / next requirement |
|---|---|
| Exact build identity | Existing build stamp records SHA/time. Record final tested commit, tree, package version and release notes. Package baseline remains `0.1.0`. |
| Regression validation | Existing type/unit/build/browser workflows exist. Obtain exact candidate CI and relevant runtime evidence; old named-head passes are not current certification. |
| Assets and rights | [Register](../../assets/catalog/register.json) identifies known files and gaps. Confirm source/creator/rights/attribution for each shipping asset, including title music and bundled dependencies. Root MIT is not an asset-specific rights review. |
| Archive recovery | Destination pending. Preserve raw/master dependencies and verify an independent restore; accepted committed exports must build without archive access. |
| Supported platforms and performance | Select targets; test representative scenes on actual intended hardware, controller/input, accessibility and save/reload behavior. Software-rendered smoke alone does not establish these. |
| Browser publishing | Existing main pushes trigger Pages deployment. Verify actual URL/build, root/subpath assets and save-origin implications before separately approved publishing. |
| Comic website | Planning only; eight storyboard originals are not committed. Choose scoped app/routes/content and verify coordinated release without breaking game/editor URLs. |
| Steam delivery | No tracked desktop wrapper or Steam configuration established. Decide packaging/platforms and gather relevant launch, input, saves, update and distribution evidence in a separate task. |
| Multiplayer | Future scoped architecture and networking work; no implementation or release readiness inferred. |

Historical [backup releases](../history/README.md) and private localhost review ZIPs are preservation/review material, not shipping certification. Publication of an organization draft PR does not authorize merging, deployment or asset-archive setup.
