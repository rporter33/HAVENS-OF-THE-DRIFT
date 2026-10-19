# G12a white dragon: Astra sheet and Meshy downloads

Orphan archive branch (AGENTS.md: binaries stay off main). These are the raw inputs for gate G12a, copied byte for byte on 2026-10-19 from Robert's PC (`C:\Users\Robert\Projects\havens-blender-pilot\`). Nothing here is loaded by the game. The fitted body and its register entry live on the gate branch (`gate/g12a-white-dragon`); `MANIFEST.json` has the same facts in machine-readable form.

## Provenance

| | |
|---|---|
| Route | Astra reference sheet, then Meshy Image to 3D, as in the [model kit](https://github.com/rporter33/HAVENS-OF-THE-DRIFT/blob/gate/g12a-white-dragon/Art%20and%20Assets/Creatures%20and%20Customization/WHITE_DRAGON_MODEL_KIT.md) |
| Made by | Robert Porter (Astra images and Meshy generation) |
| Date | 2026-10-19. Image files 10:24 to 10:41 and Meshy downloads 10:43 and 10:45, all -06:00, from the files' modified times |
| Meshy plan | Pro (paid). Robert's statement, recorded as Q49 on 2026-10-19 and repeated with this hand-over. Meshy's terms give paid-plan output to the subscriber as owner (Meshy guide's summary; not legal clearance) |
| Meshy model and version | not recorded |
| Meshy task ID | not recorded |
| Meshy mode and settings | not recorded (the kit asks for Multi-View with views B, C and D, High Detail, symmetry on) |
| GLB generator strings | raw: `xpostprocessing`; textured: `pygltflib@v1.16.5` |

The "not recorded" rows are the kit's hand-over record that wasn't filled in. Robert can add them from his Meshy history if he wants them kept.

## Files

SHA-256 of the exact bytes (equal to the source files' hashes).

| Path | Bytes | SHA-256 | Role |
|---|---:|---|---|
| `meshy/white-dragon-raw.glb` | 7,617,200 | `45afc967ae23c44392687f5b8e41c15e4cb13838a7e66167d76a972aaa21f562` | Meshy geometry, no texture: the body the fit starts from |
| `meshy/white-dragon-textured.glb` | 20,972,000 | `812c8f289c15a2953612493e15b3d40d8e639cbec8679b4be8ab7f943003e447` | The same triangles with a 4096x4096 JPEG base colour: region reference only |
| `refs/white-dragon-ref-34.png` | 1,312,135 | `d4baac4475ce281f487278b44c9fc9b71bd1c5b24f2dc8267afaee8f4b398b23` | Sheet A, three-quarter view (the approval image) |
| `refs/white-dragon-ref-front.png` | 1,286,092 | `6ef8eb1e09252d20384192c6f43d919f190e83462236f5d19bcb050e601465dd` | Sheet B, front |
| `refs/white-dragon-ref-left.png` | 1,324,700 | `a67d22e023fbb5bef31751d9e1fb00bfc6f54fa7381641ec547846a32199526f` | Sheet C, left side: the proportions are measured from it |
| `refs/white-dragon-ref-back.png` | 1,322,959 | `55df96d6649737e9dfd7b8aba5a28b075f960bf2da103b0e897299fbb4552010` | Sheet D, back |
| `refs/White elder dragon anatomy reference.png` | 1,338,852 | `9903aafa4736bd2978cb8120b28286a960e74d53506c069cdf631a6447fde3d1` | An earlier three-quarter view (10:24), same creature |
| `refs/white-dragon-parts.png` | 1,423,405 | `0d116811065e22bace348e6a7b09b523349355abbc49f63759a6c88099c7c143` | Step 1b: head ornaments and tail fin, for the parts |
| `refs/white-dragon-variants-horns.png` | 1,602,348 | `d5b0a093d565859050a126b526afeafec3db00ba9ab8cb151a10053a9f5ece49` | Step 1c: horn variants |
| `refs/white-dragon-variants-whiskers.png` | 1,481,517 | `11a47ad17e44c4bdc5f50f167226908906695d9107f813e66baf2e4d89ca0c9f` | Step 1c: whisker variants |
| `refs/white-dragon-variants-frill.png` | 1,490,486 | `4baf2224cdd42bae1eebf92575743059128b19e03fa6dfedb3b2cefd7592c546` | Step 1c: frill variants |
| `refs/white-dragon-variants-tail.png` | 1,460,423 | `04695c61741b9b657de26a48ab819599ede0b326ef1dc0676e22518d01932408` | Step 1c: tail tip variants |

## The Meshy body as received

- One closed, manifold mesh: 158,671 vertices and 317,346 triangles, with no loose pieces and no open edges. The textured file has the same triangles and bounding box (172,891 vertices, split at UV seams).
- glTF frame: +Z forward, +Y up, +X the creature's left, which is the game's body frame. Bounding box: 1.90 wide (wingtips), 0.64 tall and 1.51 long, in Meshy's units.
- Against the kit's checklist (2026-10-19): six limbs, with four feet on the ground and two wings. No horns, whiskers, cheek fins, spines or tail fin, and the mouth is closed. The membranes meet the flank ahead of the hind legs and touch no leg. Two departures from the sheet: the wing roots sit further forward than in side view C, and the tail curves to the creature's left over its back half. The fit corrects both by fitting the body to the game skeleton.

## Not archived

- `refs/White Dragon/WHITE_DRAGON_MODEL_KIT.md` on the PC (13,661 bytes, `eabb924eb752b92aa4e1b920a7fc18c3cde0edece17af29f00d3b453ab002877`) is an older copy of the repository's kit that doesn't have Q49's plan-tier lines. The repository holds the current kit.
- `white-dragon-remesh-30k.glb` (the kit's optional fallback) wasn't downloaded. The empty folder `meshy/white dragon/` holds nothing.
