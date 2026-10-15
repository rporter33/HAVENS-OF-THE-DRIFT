# Model budgets — count triangles

[Back to guide index](../README.md)

These are proposed authoring targets, not measured hardware limits. Count exported triangles, including visible accessories and clothing. A quad normally becomes two triangles.

| Asset | Close/gameplay | Medium distance | Far distance |
|---|---:|---:|---:|
| Complete wyvern including tack | 12,000–20,000 | 4,000–6,000 | 1,000–1,500 |
| Fully dressed rider including hair | 6,000–10,000 | 2,000–4,000 | 500–1,000 |
| Tree | 200–800 | 80–250 | Simple silhouette |
| Small prop or rock | 50–500 | Reduce by visibility | Often hide |
| Building or substantial ruin | 1,000–5,000 | Preserve silhouette | Simplified shell |

For a bare wyvern, start around 14,000–16,000 triangles and reserve 2,000–4,000 within the equipped budget for accessories. For the proposed six-limbed dragon, start around 16,000–20,000 **bare**, with an explicitly separate 2,000–4,000 accessory allowance: 18,000–24,000 equipped. This is an exploratory budget, not a change to runtime limits.

The inspected source's existing maximum budgets are Harrier/Skimmer/Galewing 24,000, Ironback 30,000 at LOD0, then 6,000 and 1,500 at LOD1/LOD2. These are ceilings in [res.ts](../../../src/creatures/wyvern/parts/res.ts), not measured counts of the Blender study or imported models.

## What matters beyond triangle count

Protect joint loops, face shapes and wing-edge curves. Do not reduce everything uniformly or decimate away attachment surfaces. Check the exported model, not only Blender's edit-mode face count.

For Meshy, inspect geometry before texturing or rigging and remesh only when needed. Triangle or quad-dominant output and requested counts do not guarantee the exported triangle count or deformation quality. The bare-wyvern and bare-dragon ranges above remain provisional project triangle targets to check by measurement, distinct from Meshy's requested polygon/face counts; quad-dominant output must be counted after triangulation. Measure the evaluated Blender mesh and reimported GLB; retain the exploratory targets above without treating a vendor preset as a new project requirement. See the [Meshy workflow and official Remesh sources](../meshy/README.md#geometry-and-material-review).

Also measure draw calls, texture residency, skinning, cloth, transparency, shadows and outline passes. Several small meshes can cost more draw overhead than a combined mesh, even at the same triangle count. Preserve required modularity while sharing materials where practical.

Start with vertex colors or modest textures; inspect 1K before assuming 2K is needed. 8K is not the default for this direction. Compression reduces transfer or memory costs; it does not make poor topology deform correctly.

## Export and acceptance

Record source version, triangles, vertices, materials, texture dimensions, bones, units and axes. Keep editable sources and export settings. Verify visual shape, normals, weights, wing fold, garment coverage and attachment clearance after export. Create distance models after the main mesh is accepted.

Performance acceptance requires matched scenes on intended hardware and the same browser/settings. Neither a still render nor software-rendered tests establish device performance.

[Three.js optimization guidance](https://threejs.org/manual/pages/optimize-lots-of-objects.html)
