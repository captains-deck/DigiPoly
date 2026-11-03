# DigiPoly linked logo and markers

Portal v3 reconstructs the supplied interlocking-link artwork as vectors. `portal-logo.png` is the original supplied 800×800 PNG. `portal-marker.svg` is the scalable logo and DP-001 master, with the original dark background. `portal-print.svg` adds a white quiet border.

- `dp-001.svg` / `dp-001-print.svg`: the supplied design, assigned to DP-001.
- `dp-002.svg` / `dp-002-print.svg`: the same D and central links, with the inner link in every corner turned 180 degrees. This makes a separate physical identity.
- `digipoly.icns`: the Mac app icon generated from `portal-logo.png`.

The marker pair uses two complementary corner samples per corner (eight samples in total). Geometry and SVG generation share `src/marker.mjs`. Four rotations are recognised; the large central D establishes orientation, while the corner samples establish identity. Mixed/damaged codes and duplicate IDs are rejected. The detector also accepts the original v2 prints under their existing DP-001 / DP-002 IDs, including in mixed-version scenes.

The old uncoded v1 logo remains archived in the legacy SVGs and is not a supported tracking identity. New prints require DigiPoly Studio/Live 0.7 or later. GhostMarker picture targets and existing content assignments are unaffected.

Regenerate vector assets with `npm run assets`. On macOS, regenerate the app icon with `npm run assets:icon`. Tests use the original supplied PNG independently of the vector generator: the reconstruction matches over 99.9% of its thresholded black/white pixels, and the original PNG itself is recognised through rotation, perspective, dimming and blur.
