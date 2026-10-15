# Customization — reusable bodies and separate options

[Back to guide index](../README.md)

The inspected [catalog](../../../src/cosmetics/catalog.ts) has these existing wyvern option IDs. Preserve IDs, unlocks and saves during any future integration; this document does not authorize replacing them.

| Slot | Existing IDs |
|---|---|
| Pattern | plain, saddleback, stripes, dapple, ember, starfield, gilded |
| Horns | swept, none, ram, crown, antler, unicorn |
| Frill/crest | none, spines, sail, mane, fan |
| Tail tip | spade, blade, plume, club, ribbon |
| Saddle | rider, racing, nomad, royal |

## Asset organization

Keep anatomy in the base: head, neck, torso, limbs, wings and a plain tapered tail. Keep smooth underlying surfaces so removing an accessory does not expose a hole.

Build horn sets, crests, cheek fans, tail ornaments, saddles and harnesses as separate pieces. Do not create empty sockets or cut holes into the first generated body. Define attachment frames deliberately in Blender after its proportions are accepted.

Colors and markings should remain editable through material regions or masks. Avoid permanently painting all pattern choices into one texture. Existing effects such as ember emission need an explicit runtime mapping.

## Fit and deformation

Record each component's attachment location, orientation, scale, surface clearance and deforming bones. Test both sides. Neck/back ornament must clear the saddle, rider and moving wings. Tail ornaments must follow tail motion; a static parent alone may not be sufficient.

A new six-limbed body requires its own rig/animation and integration assessment. It is not a drop-in wyvern replacement simply because its cosmetics use familiar names.

Preserve rider wardrobe mixing, dyes, preview/revert, saves, live cloth and mounted contacts wherever the current implementation supports them. Do not replace live cloth with static geometry as an unnoticed shortcut.

## Review checklist

- Every option can be equipped and removed without holes or duplicates.
- Representative mixes fit together and remain readable at the flight camera.
- Dyes and pattern regions stay separate and predictable.
- Saddle, reins and stirrups align with the actual rider.
- Wing folding, banks, landing and dismount do not reveal severe clipping.
- Existing IDs, unlocks and saved appearances remain compatible.
- Evidence distinguishes a posed Blender render from actual gameplay.
