# DigiPoly linked logo and markers

Portal v4 keeps the black square, the bold white D and the interlocking L blocks. The four corner clusters are 28% larger than Portal v3, with 36px strokes and 16px gaps. The central arrow is still built from the same four component blocks, shifted left towards the older logo's optical centre, with the gaps between those blocks opened. `portal-marker.svg` is the scalable logo and DP-001 master. `portal-print.svg` adds a white quiet border. `portal-logo.png` is the 800×800 render of that vector.

- `dp-001.svg` / `dp-001-print.svg`: the logo, assigned to DP-001.
- `dp-002.svg` / `dp-002-print.svg`: the same D and central arrow, with the inner link in every corner turned 180 degrees.
- `favicon.svg` and `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-64.png`: a separate optical variant with heavier corner strokes and wider gaps. It is not a tracking marker.
- `digipoly.icns`: the Mac app icon. Slots up to 64px use the favicon; larger slots use `portal-logo.png`.
- `portal-logo-v3.png`: the supplied Portal v3 raster, kept so older prints can be compared and recognised.
- `logo-readability.png`: legacy, v3 and v4 compared at large size and at 16, 24, 32, 48 and 64 pixels.
- `github-social.png`: 1280×640 repository social preview.

The marker pair uses two complementary corner samples per corner. Geometry and SVG generation share `src/marker.mjs`. Four rotations are recognised. The large central D establishes orientation and the corner samples establish identity. Mixed, damaged and duplicate IDs are rejected. The detector still accepts printed v3 and v2 markers under their existing DP-001 / DP-002 IDs. Recognition thresholds are unchanged.

The old uncoded v1 logo remains archived in the legacy SVGs and is not a supported tracking identity. New v4 prints require DigiPoly Studio/Live 0.8 or later. GhostMarker picture targets and existing content assignments are unaffected.

Regenerate vector assets with `npm run assets`. On macOS, regenerate the app icon with `npm run assets:icon`. Tests check the v3 reconstruction against the supplied PNG independently of the v4 generator.
