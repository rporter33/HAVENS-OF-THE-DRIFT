# Base-model prompts — one wyvern, one dragon

[Back to guide index](../README.md)

Generate two separate assets. A wyvern has two hind legs plus two wing-arms. The proposed dragon has four walking legs plus two separate dorsal wings. This does not assert six-limb support in the current game.

Keep the base unadorned. Horns, crests, cheek fans, tail ornaments and tack are fitted later. Model-generation text describes intent; it cannot guarantee topology or rig compatibility.

## Wyvern — copy into the prompt field

```text
Create one unadorned stylized wyvern base for a cel-shaded exploration game. Exactly two hind legs and two wing-arms; no separate front legs. Elegant athletic proportions, expressive intelligent face, long flexible neck, strong chest, broad continuous wing membranes and a long plain tapered tail. Friendly, weighty and believable. Smooth broad forms, clean silhouette and restrained low-poly detail. Neutral symmetrical pose, wings extended with a slight bend, feet separated, tail clear of the body. Leave smooth uninterrupted skin on the skull, cheeks, neck ridge and tail tip for interchangeable accessories added later. Keep a clear saddle area on the upper back without obstructing wing roots. No horns, crest, spines, mane, tail ornament, saddle, harness, rider, armor, modeled scales or scenery. Simple matte neutral color, no baked shadows or outlines. Prioritize connected anatomy and geometry suitable for joint bending.
```

## Six-limbed dragon — copy into the prompt field

```text
Create one unadorned stylized dragon base for a cel-shaded exploration game. Exactly SIX limbs: four walking legs plus two separate dorsal wings. Front legs are independent of the wings. Elegant athletic body, expressive intelligent face, long flexible neck, strong chest, broad continuous wing membranes and a long plain tapered tail. Friendly, weighty and believable. Smooth broad forms, clean silhouette and restrained low-poly detail. Neutral symmetrical standing pose, four feet separated, wings extended with a slight bend, tail clear of the legs. Show distinct wing roots above and behind the foreleg shoulders. Leave a clear upper-back saddle area between the wing roots. Smooth skull, cheeks, neck ridge and plain tail tip for interchangeable accessories added later. No horns, crest, spines, mane, tail ornament, saddle, harness, rider, armor, modeled scales or scenery. Simple matte neutral color; no baked shadows or outlines.
```

## Iteration order

Approve anatomy and silhouette first, then neutral geometry, then one accessory from each slot, then deformation. Keep a fixed reference/model version and record each change.

For image references, request one full-body three-quarter view against a plain background first. Approve it before making consistent front/side/back views. Do not put multiple creatures or alternate designs in a single 3D-generation input. For Meshy Multi-View, use consistent views of that same approved subject and follow the actual slot labels; review generated complementary views for altered anatomy. Separate views make project review easier; Meshy also documents support for a composited turnaround sheet. One strong image is preferable to contradictory views.

Use the current [Meshy workflow](../meshy/README.md) and [customization contracts](../customization/README.md) alongside these prompts. Prompt text does not set a guaranteed triangle count or establish wing-arm/six-limb auto-rig support. [Tripo settings](../tripo/README.md) are historical guidance for earlier sources.
