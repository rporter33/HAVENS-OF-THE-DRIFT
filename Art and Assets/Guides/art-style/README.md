# Art style — soft cel-shaded adventure

[Back to guide index](../README.md)

## Target

Stylized low-to-mid-poly 3D with broad smooth character forms, three readable lighting bands, matte colors and restrained outlines. Dragon, rider and world must share the same visual language.

Keep the Aegean direction: cream linen, slate and sky blue, worn leather, softened bronze, limestone ruins, floating islands and dragon companionship. Preserve player-selected dyes; these colors are a starting palette, not forced replacements.

## Shape and detail

- Spend triangles on expressive faces, silhouette, curved wing edges and bending joints.
- Use smooth shading on organic forms. Low polygon counts do not require every character surface to appear faceted.
- Use deliberate larger planes on cliffs, ruins, horns and equipment.
- Suggest scales through broad groups or color regions; avoid hundreds of modeled scales.
- Use simple foliage masses, restrained ornament and large readable cloth folds.
- Keep head, back and tail customization areas uncluttered.

## Materials and lighting

Use lit, middle and shadow tones with controlled transitions. Favor warm sunlight and cool shadows. Keep rim light subtle and atmosphere consistent across the scene.

Thin outlines are optional accents. Do not outline every triangle, strap or leaf. Inspect tiny disconnected strokes, doubled seams and contour clutter at the actual viewing size.

A Blender EEVEE study can use:
`Diffuse BSDF → Shader to RGB → Color Ramp → Emission → Material Output / Surface`.

Use a Constant ramp for crisp bands, or softened transitions for the selected gentler look. Material Output has a Surface socket, not a Base Color socket. For colored assets, multiply the lighting ramp by the original base color or vertex color before Emission.

Shader to RGB and Grease Pencil Line Art are Blender techniques, not shaders that automatically transfer through GLB to Three.js. The game already has a painterly/toon foundation; any runtime adaptation requires a separate approved task.

## Visual acceptance

Compare front, side and three-quarter views, then mounted and flight-camera views. Check neutral lighting as well as sun and shadow. Where animated, inspect banking, wing folding, landing and rider contacts. A beauty render alone does not establish readiness.

Do not use baked black outlines or directional lighting in the base-color texture. Keep texture noise low enough that broad shapes carry the image.

References: [shared visual guide](../../../docs/ART_DIRECTION.md), [art pack](../../../docs/art/README.md), [Three.js toon material](https://threejs.org/docs/pages/MeshToonMaterial.html).
