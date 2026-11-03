# Multi-audience physical proof of concept

This document retains historical verification notes from earlier iterations. For current desktop and OBS setup, use [Streaming on a Mac](MAC_STREAMING.md). Version 0.5 adds cloud saving and the local Live output bridge; camera capture and local OBS delivery have since been checked. Broader physical print trials remain useful.

## Product decision

Preserve the Portal D and corner brackets. Add a distinct 16-cell border code for DP-001 and DP-002, based on the supplied two-marker concept. The D establishes orientation; the code establishes identity. Content follows the ID, regardless of position or detection order. No hidden ArUco marker is substituted.

Use the generated v2 SVGs. The original uncoded print does not identify either v2 marker. Keep the canonical masters fixed during the trial.

## Room scenes verification — 3 November 2026, v4

- 21 Node test groups passed, including migration of existing saved workspaces, independent environment layouts, shared background references and camera ownership/cancellation/error cleanup.
- All 83 browser assertions passed in Safari: 28 new room/background checks, 34 campaign checks and 21 marker/rendering checks.
- Bedroom source uses actual DP-001 / DP-002 SVGs over a generated fictional room. The worker detects their image pixels; placements are not passed to the detector as answers. Both audience outputs carry their assigned media during whole-scene drift.
- New room checks verify uploaded/captured still persistence, stored image pixels, preserved campaign assignments, photo-mode detection and absence of synthetic markers in photo mode.
- Chrome UI verified both bedroom placements tracking, different UK/Spanish content, and placement resizing/saving/resetting. Safari UI verified background upload, reload persistence, environment isolation and reset.
- Camera tests use a simulated video stream plus lifecycle mocks. A physical webcam still, permissions flow, real printed marker quality and OBS output remain hands-on trial items.
- Each environment stores one still background and its marker quadrilaterals. This is not foreground segmentation or a virtual background behind a live person.

## Campaign studio verification — 3 November 2026, v3

- 15 Node test groups passed: the eight marker tests plus seven workspace/media tests.
- 34 campaign browser assertions passed using actual decoded marker frames, UK and Spanish artwork pixels, independent canvas streams, saved image/video Blobs, changing video frames, environment switching and removal cleanup.
- All 21 original browser rendering assertions still pass after the shared texture renderer update.
- Inspected the live two-channel UI: the same marker poses show different fictional products and language-specific copy.
- Created a Gaming stream environment through the UI, assigned On air to its UK marker and uploaded the supplied DigiPoly concept board. The environment, assignment and media library entry were retained after reload.
- Opened both audience clean outputs through the actual UI and visually verified their distinct products, language-specific copy and environment/channel window titles. Studio controls and tracking guides were absent.
- Physical camera quality, broadcast destinations, audio mixing and viewer-side geography selection remain outside this verification.

## Acceptance targets (physical trial pending)

- Select Bedroom stream and compare both audience editions on its poster and desk-box sticker.
- Upload a room image, adjust both placements and reload. Confirm its background/layout remain separate from another environment.
- Capture a camera still, cancel/reopen capture and check camera release. Try a still with actual printed markers using Detect markers already in photo.
- Print one A4 sheet per ID and mount both on rigid card.
- Recognise both using a normal webcam, without manual corner placement.
- Assign different built-in or uploaded images to the two IDs.
- Move both simultaneously; cross their paths and swap left/right positions without content swapping.
- Test modest tilt and all 90° rotations. Check that artwork orientation follows each marker.
- Remove DP-001 while DP-002 stays visible; only DP-001 should lose its overlay. Reintroduce it in a different position and confirm the same assignment returns. Repeat for DP-002.
- Partially cover code cells and test duplicate copies of the same ID. Record missed detections or any mistaken identities.
- Change one ID's content while both move; confirm only that placement changes in that campaign channel.
- Set up UK / English and Spain / Spanish with different products and languages on both IDs. Verify matching marker positions in both outputs.
- Upload an image and a short video. Reuse them across environments, reload and confirm their assignments and playback.
- Open both named output windows. Switch away from their environment and confirm they pause; return and confirm the original channel content resumes.
- Rename a channel and verify its output title updates. Remove one channel and verify only its output stops.
- Record at 720p with a target of 30 rendered frames/second; measure achieved FPS and camera-to-output delay.
- Verify OBS captures both placements without studio controls/tracking guides.
- Verify another Teams participant receives that same output via OBS Virtual Camera.

## Trial log

Record computer/browser/camera, print dimensions, lighting, distance, each marker's pixel width, angles, observed FPS, dropped detections, mistaken identities and edge jitter. Start with each marker about 200 px wide in the 1280 px output, then reduce size and measure performance. Compare the clean recording with raw camera footage. Include unrelated squares and logos in the background.

## Development verification — 3 November 2026, v2

- Eight Node test groups passed: both IDs/all rotations, simultaneous perspective/brightness/blur, code corruption, distractors/occlusion, duplicate IDs, crossing/disappearance/re-entry, independent assignment state and projection geometry.
- Twenty-one browser assertions passed in Chrome using actual SVGs, WebGL demo frames, the OpenCV worker, separate projected-artwork colour checks through a left/right swap, and one video-only MediaStream.
- Active two-marker demo observed around 25–27 fps with roughly 97–99% structural template similarity and 18–19 ms worker processing. These are demo observations, not physical-camera benchmarks or guaranteed performance.
- Changed DP-002 to The next wave in the actual studio, then selected DP-001 and verified its One marker. Many stories. assignment remained selected.
- Opened the actual Clean output window and visually verified both distinct perspective artworks, without studio controls or tracking guides.
- Inspected Chrome's print preview: exactly two A4 pages, each with its complete coded marker, ID and instructions, no clipping.
- Physical prints, webcam conditions, end-to-end latency, an OBS recording and a Teams recipient's view still need a hands-on trial.

## Known trade-offs

- Small border cells increase the required image detail compared with the old uncoded design. Distance, blur, glare and occlusion need physical evaluation.
- Identity decoding permits at most one incorrect and one uncertain cell, with a large margin between codewords. This is a conservative two-code classifier, not a standard QR/error-correcting-code implementation or a guarantee against all false positives.
- Separate recognised copies of one ID are suppressed. Print one of each for independent placements.
- Occlusion handling rejects poor matches; it does not infer foreground depth or segment hands.
- Each ID is reacquired frame by frame with small positional smoothing. Lost overlays disappear immediately. Assignments survive disappearance and reload in v3 through local browser storage.
- A tiny gaming facecam may not contain enough marker detail. Start with a full-camera creator/tabletop scene.
- Camera input and user images remain local. Any later server control plane should distribute content/settings rather than upload raw camera frames by default.

## Integration references

- OBS virtual camera: https://obsproject.com/kb/virtual-camera-guide
- OBS source/filter APIs: https://docs.obsproject.com/reference-sources
- OpenCV browser runtime packaging: https://github.com/TechStark/opencv-js
- Teams videoEffects API: https://learn.microsoft.com/en-us/javascript/api/@microsoft/teams-js/videoeffects?view=msteams-client-js-latest

Native OBS integration is a later packaging step. This POC tests whether the coded Portal pair is practical in physical scenes and whether creators value independent placements.
