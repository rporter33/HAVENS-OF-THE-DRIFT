# Harrier model kit: Astra turnaround and Meshy generation

[Back to Creatures and Customization](README.md)

Written 2026-10-18 for gate G3b (Q38). Steps 1 and 2 of the new-model route: Robert makes a reference sheet in Astra, then generates the base mesh in Meshy. Claude takes it from the Meshy download (Blender fit, then the dev-only loader). Grounded in the [Meshy guide](../Guides/meshy/README.md), the [base-model prompts](../Guides/base-model-prompts/README.md), the [model budgets](../Guides/model-budgets/README.md) and [target render 01](../../docs/art/targets/01-harrier-portrait.png).

## What we are making

One **base body**: the Harrier with the render's form (shorter fine head, long neck, deep chest, big wings), two hind legs plus two wing-arms, and nothing fitted. Horns, spines, frill, tail tip and tack come later as separate pieces, so the stable's customization keeps working. The game keeps its own wing membranes for now; Meshy's wings only need to be cleanly separate from the body.

Colors in the sheet are the Harrier's, flat. Meshy's texture is not used in the game (the game shader paints the hide), but the color boundaries help Claude mark belly, back and hide regions in Blender.

## Step 1: Astra reference sheet

Generate the **three-quarter view first**. Approve it against the checklist below before making the other three, then make front, left side and back with the same creature. Attach `docs/art/targets/01-harrier-portrait.png` as an image reference if Astra accepts one.

### Paste first (shared block)

```text
Reference sheet for a 3D model, for image-to-3D conversion: clarity over drama. One creature: the Harrier, a moss-green wyvern from the game Havens of the Drift, the same creature as the attached target render, shown as an unadorned base body.

Body plan: exactly two hind legs and two wing-arms. No separate front legs. Wing-arms end in a small clawed thumb at the wrist, with three long finger bones supporting the membrane.

Proportions (from the target render): a short, fine, intelligent head with a gentle brow and slender jaw, not a long crocodile snout; a long elegant neck in a gentle S; a deep rounded chest; a slimmer waist; strong thighs and bird-like feet with three forward toes; a long tapering tail about as long as head to hips; large wings, span about two and a half times the body length from chest to hips.

Surface: smooth, broad, continuous stylized forms. Olive-moss hide #586e46, a darker olive back #2d3a28, cream belly #dfcea7 with broad shallow belly plates from throat to tail base, amber wing membranes #e89a40 with olive wing bones. Flat matte color. No small modeled scales, no texture noise.

Leave off: horns, spines, crest, frill, mane, tail ornament, saddle, harness, rider, armor, jewelry.

Pose: neutral and symmetrical. Standing on both hind legs, feet apart and flat on the ground, body level. Neck raised in a gentle S, head level and facing straight ahead, mouth closed. Wings fully extended straight out to the sides, a slight downward bend at the wrist, membranes flat and fully visible, nothing touching the body below the shoulder. Tail straight back, slightly raised, clear of the legs.

Image: orthographic-looking camera, soft even studio light from the front, no cast shadows, no rim light, no fog or haze. Plain flat light-gray background #d9d9d9. The whole creature in frame with a margin on every side, wingtips included. No ground detail, no scenery, no text, no labels. 16:9.
```

### Then one shot per image

| # | Save as | Paste after the shared block |
|---|---|---|
| A | `harrier-ref-34.png` | `View: front three-quarter from the creature's left, camera slightly above the back, both wings fully visible. This is the approval image.` |
| B | `harrier-ref-front.png` | `View: straight front, camera at chest height, perfectly centered and symmetrical. Same creature, proportions, colors and light as the approved image; only the camera changes.` |
| C | `harrier-ref-left.png` | `View: exact left side profile, camera at chest height and perpendicular to the body, both wings still extended (the near wing in front). Same creature, proportions, colors and light as the approved image; only the camera changes.` |
| D | `harrier-ref-back.png` | `View: straight back, camera at chest height, perfectly centered and symmetrical. Same creature, proportions, colors and light as the approved image; only the camera changes.` |

### Approve before Meshy

- [ ] Two hind legs and two wing-arms; no third pair of limbs anywhere
- [ ] Wings separate from the body below the shoulder; membranes not fused to flanks or legs
- [ ] Feet apart; tail clear of the legs
- [ ] No horns, spines, frill, saddle or rider
- [ ] Head short and fine like target 01, not a long snout
- [ ] The four views agree on proportions, wing span, neck length and colors (one inconsistent view hurts Meshy more than a missing one)

Drop the approved PNGs in `C:\Users\Robert\Projects\havens-blender-pilot\refs\`.

## Step 2: Meshy generation

Labels below come from Meshy's documentation as checked on 2026-10-14; follow what the UI actually shows and note any difference.

1. **Image to 3D → Multi-View.** Upload front (B), left (C) and back (D) into the matching slots. Leave the right slot empty rather than mirroring an image. If Multi-View rejects the set or the result looks wrong, try single-image mode with the three-quarter view (A).
2. **Mode: High Detail.** Multi-View is not available in Smart Topology. Turn **Symmetry** on if offered.
3. **Geometry first.** Skip texturing on the first pass. Inspect the white clay model against the checklist above: limb count, wings separate, feet separate, tail clear, no fused surfaces, head shape. Regenerate only if it fails (each run costs credits).
4. **Download the raw GLB, no remesh:** `C:\Users\Robert\Projects\havens-blender-pilot\meshy\harrier-raw.glb`. Claude remeshes in Blender to the 14,000 to 16,000 triangle bare target (the Harrier's runtime ceiling is 24,000 at LOD0). Also download a **Remesh, triangle, 30,000** version as `harrier-remesh-30k.glb`, a fallback if the raw mesh is too dense to work with.
5. **Optional:** texture it with **Remove Lighting** on and download as `harrier-textured.glb`. Useful only as a color reference.
6. **Keep it private.** Do not publish to Community.

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

## What happens next (Claude, G3b)

1. Blender: audit and remesh to 14,000 to 16,000 triangles, cut the body at the shoulders, scale and fit it to the game's 60-joint skeleton, skin weights, and bake the region, belly and back attributes the game shader reads. LODs at 6,000 and 1,500 triangles.
2. Game: a dev-only `?wyvernTrial=blender` loader mirroring the rider trial, with the procedural wings attached and the self-collision proxies rebuilt from the new body.
3. Captures beside targets 01 and 02, plus the gameplay camera. Normal builds keep the procedural Harrier until Robert accepts the captures.
