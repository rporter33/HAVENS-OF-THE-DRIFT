# White dragon model kit: Astra turnaround and Meshy generation

[Back to Creatures and Customization](README.md)

Written 2026-10-19 for the proposed gate G12a ([white dragon design](../../docs/design/WHITE_DRAGON.md), open question Q47). Steps 1 and 2 of the same route the Harrier took (Q38): Robert makes a reference sheet in Astra, then generates the base mesh in Meshy. Claude takes it from the Meshy download. Making the images and the Meshy model is Robert's call and needs no gate; bringing the result into the game does. Grounded in the Harrier model kit (`HARRIER_MODEL_KIT.md` in this folder, on PR #11 until it merges), the [Meshy guide](../Guides/meshy/README.md), the [base-model prompts](../Guides/base-model-prompts/README.md), the [model budgets](../Guides/model-budgets/README.md) and [target render 08](../../docs/art/targets/08-sleek-dragon-elder.png).

## What we are making

One **base body**: the white clan's elder dragon with render 08's form, as an unadorned body in a neutral standing pose. Four walking legs plus two separate wings that grow from the back. The front legs are legs, not wings. Nothing fitted.

Everything thin or ornamental comes later as separate parts, so it can be built cleanly and swapped: the branching horns, the long whiskers, the cheek fins, the dorsal spines and the tail fin. Meshy handles thin strands and antler tines badly, and in the Harrier's case separate parts kept the stable's customization working.

The colors in the sheet are flat and only mark regions. Meshy's texture is not used in the game; the game shader paints the hide. The boundaries help Claude mark the belly, back and hide regions in Blender. The values are a proposal for the white flight (Q36: ivory toward powder blue) and are settled as palette data with the other dragonflight colors.

| Region | Sheet color | Notes |
|---|---|---|
| Hide (sides, legs, head) | ivory `#EFE6D6` | near Chalk Linen `#F2EADA` |
| Belly and throat plates | cloud white `#F7F0E1` | broad shallow plates, throat to tail base |
| Back, top of the neck, top of the tail | powder blue `#9DB6D3` | broad plates in three to five rows, as in the render |
| Wing bones | powder blue `#9DB6D3` | |
| Wing membranes | ivory `#F2E6D0` | translucent in the game, opaque here |
| Claws | slate `#4A5260` | near Scale Slate `#586875` |
| Eyes | pale blue `#B8D4E8` | |

## Step 1: Astra reference sheet

Generate the **three-quarter view first**. Approve it against the checklist below before making the other three, then make the front, left side and back views of the same creature. Attach `docs/art/targets/08-sleek-dragon-elder.png` as an image reference if Astra accepts one. The render shows the dragon lying down with horns and whiskers; the sheet asks for it standing and bare, so expect to steer the pose and the parts away from the reference.

### Paste first (shared block)

```text
Reference sheet for a 3D model, for image-to-3D conversion: clarity over drama. One creature: the white elder dragon from the game Havens of the Drift, the same creature as the attached target render, shown standing as an unadorned base body.

Body plan: exactly SIX limbs. Four walking legs plus two separate wings. The wings grow from the upper back, above and slightly behind the front-leg shoulders; the front legs are independent legs with their own shoulders and are not part of the wings. Each wing has a clawed thumb at the wrist and three long finger bones supporting a bat-like membrane. The membrane runs from the last finger back to the flank just in front of the hind legs; it never joins a leg.

Proportions (from the target render): sleek, long and old, larger and longer than a wyvern. A long, refined, intelligent head with a gentle brow, a long tapering muzzle and a closed mouth; slightly horse-like in its length, not a crocodile or lizard snout. A long elegant neck in a gentle S, about as long as the body from shoulders to hips. A deep rounded chest, a long body and a slimmer waist. Slender front legs and stronger hind legs, each foot with four toes and short blunt claws. A very long tapering tail, about one and a half times the length from head to hips. Large wings, span about twice the length from chest to hips.

Surface: smooth, broad, continuous stylized forms. Ivory hide #EFE6D6. Cloud-white belly #F7F0E1 with broad shallow belly plates from throat to tail base. Powder-blue back #9DB6D3 in broad plates along the top of the neck, the back and the top of the tail, three to five rows wide. Ivory wing membranes #F2E6D0 with powder-blue wing bones #9DB6D3. Slate claws #4A5260. Pale blue eyes. Flat matte color. No small modeled scales, no texture noise.

Leave off: horns, antlers, whiskers, barbels, cheek fins, frills, mane, dorsal spines, tail fin, tail ornament, saddle, harness, rider, armor, jewelry. The skull, cheeks, neck ridge and tail tip are smooth so separate pieces can be added later.

Pose: neutral and symmetrical. Standing on all four legs, the four feet flat on the ground and well apart, legs straight under the body, body level. Neck raised in a gentle S, head level and facing straight ahead, mouth closed. Wings fully extended straight out to the sides from the back, a slight downward bend at the wrist, membranes flat and fully visible, the membranes clear of all four legs. Tail straight back, slightly raised, clear of the hind legs.

Image: orthographic-looking camera, soft even studio light from the front, no cast shadows, no rim light, no fog or haze. Plain flat light-gray background #d9d9d9. The whole creature in frame with a margin on every side, wingtips and tail tip included. No ground detail, no scenery, no text, no labels. 16:9.
```

### Then one shot per image

| # | Save as | Paste after the shared block |
|---|---|---|
| A | `white-dragon-ref-34.png` | `View: front three-quarter from the creature's left, camera slightly above the back, both wings and all four legs fully visible. This is the approval image.` |
| B | `white-dragon-ref-front.png` | `View: straight front, camera at chest height, perfectly centered and symmetrical. Same creature, proportions, colors and light as the approved image; only the camera changes.` |
| C | `white-dragon-ref-left.png` | `View: exact left side profile, camera at chest height and perpendicular to the body, both wings still extended (the near wing in front), all four legs visible. Same creature, proportions, colors and light as the approved image; only the camera changes.` |
| D | `white-dragon-ref-back.png` | `View: straight back, camera at chest height, perfectly centered and symmetrical. Same creature, proportions, colors and light as the approved image; only the camera changes.` |

### Approve before Meshy

- [ ] Four legs on the ground and two wings on the back: six limbs, no more, no fewer
- [ ] The wing roots sit on the back above the front shoulders, clearly separate from the front legs
- [ ] Membranes clear of every leg; feet apart; tail clear of the hind legs
- [ ] No horns, whiskers, cheek fins, spines, tail fin, saddle or rider
- [ ] Head long and refined like render 08, mouth closed, not a lizard or crocodile snout
- [ ] A clear stretch of back between the wing roots (where a saddle could go if dragons become mounts)
- [ ] The four views agree on proportions, wing span, neck and tail length and colors (one inconsistent view hurts Meshy more than a missing one)

Drop the approved PNGs in `C:\Users\Robert\Projects\havens-blender-pilot\refs\white-dragon\`.

### Step 1b (optional, for the parts): head and ornaments sheet

Meshy does not see this sheet. It is the reference Claude builds the separate parts from: horns, whiskers, cheek fins, dorsal spines and tail fin. Make it after A is approved, with A attached.

```text
Design sheet for game accessory parts, same creature as the attached image, same colors and flat studio light on a plain light-gray background #d9d9d9, no text or labels. Show the dragon's head in exact left profile and exact front view, now WITH its ornaments, matching the attached target render: swept-back branching antler-like horns in pale bone ivory, two long thin whiskers from the upper lip, swept-back ivory cheek fins, and a short row of swept-back ivory dorsal spines behind the skull. Beside the head, a left side view of the last third of the tail with a low ivory tail fin along its top. Mouth closed. 16:9.
```

Save as `white-dragon-parts.png` in the same folder.

## Step 2: Meshy generation

Labels below follow the Harrier kit and Meshy's documentation as checked on 2026-10-14; follow what the UI actually shows and note any difference.

1. **Image to 3D, Multi-View.** Upload front (B), left (C) and back (D) into the matching slots. Leave the right slot empty rather than mirroring an image. If Multi-View rejects the set or the result looks wrong, try single-image mode with the three-quarter view (A).
2. **Mode: High Detail.** Turn **Symmetry** on if offered.
3. **Geometry first.** Skip texturing on the first pass. Inspect the white clay model against the checklist above, above all the limb count and the wing roots: Meshy can fuse a wing to a front leg or grow a third leg pair. Regenerate only if it fails, since each run costs credits.
4. **Download the raw GLB, no remesh:** `C:\Users\Robert\Projects\havens-blender-pilot\meshy\white-dragon-raw.glb`. Claude remeshes in Blender toward the exploratory bare-dragon range of 16,000 to 20,000 triangles from the [model budgets](../Guides/model-budgets/README.md). Also download a **Remesh, triangle, 30,000** version as `white-dragon-remesh-30k.glb`, as a fallback if the raw mesh is too dense to work with.
5. **Optional:** texture it with **Remove Lighting** on and download as `white-dragon-textured.glb`. Useful only as a color reference.
6. **Skip Meshy's auto-rig.** None of its rig routes promises a six-limb body, and its quadruped animation is walking only ([Meshy guide](../Guides/meshy/README.md)). The game supplies the skeleton.
7. **Keep it private.** Do not publish to Community.

### Record (paste into chat when you hand it over)

```text
Meshy route: web UI, Image to 3D, Multi-View (or single image)
Model/version shown in the UI:
Task ID or model URL:
Mode and settings: High Detail, symmetry on/off, texture on/off
Views used: front / left / back (and any changes)
Date generated:
Plan tier: free or paid
```

The plan tier matters for rights: Meshy's terms (as summarized in the Meshy guide) give free-tier output under CC BY 4.0 with attribution and paid output to you as owner. Private visibility alone is not a no-training commitment.

## What happens next (Claude, once G12 is opened)

Not started; each step needs the gate. The design doc has the full plan.

1. **The skeleton first, in code.** The game owns the skeleton, as it does for the wyverns: a six-limb rig definition written to the approved sheet's proportions, exported to Blender the way G3b exported the Harrier.
2. **Blender fit.** Audit and remesh the Meshy body, cut the wings at the root, fit it to the game skeleton (generalising `harrier_meshy_fit.py` from G3b), skin weights, and bake the region, belly and back attributes the game shader reads. LODs below the bare body, at budgets set in the gate.
3. **Game, dev-only.** A `?view=` showcase of the white dragon resting, as in render 08, with idle life motion. Captures beside render 08. Normal builds don't change until Robert accepts the captures.
