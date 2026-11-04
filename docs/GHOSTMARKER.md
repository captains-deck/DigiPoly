# GhostMarker image targets

DigiPoly 0.6 and later support two experimental GhostMarkers per environment alongside DP-001 and DP-002. A GhostMarker hides an ID in a detailed picture. Its reference picture locates the surface; the hidden ID confirms which campaign placement it represents.

## Create and use a target

1. Open Studio and choose an environment.
2. Under **Environment markers**, choose **+ GhostMarker**.
3. Choose a photograph, **Try example picture**, or import a `.ghostmarker.json` target from the sibling GhostMarker project. Start with **Balanced** strength. Choose different pictures for different targets.
4. Compare the images. **Download PNG** gives you the exact encoded picture to print or display. **Target file** preserves the ID, reference and encoding parameters for import elsewhere.
5. Click **Add to environment**. The new placement initially copies the DP-001 campaign assignments, or uses the UK/Spanish samples. Change each channel's media selector independently.
6. Use **Adjust placements** to arrange the demo picture. Keep targets apart. The source monitor shows the physical image; audience previews show their assigned content after verification.
7. For a real test, select **Live camera** and show the encoded image, with all edges in view. Start large: roughly 400–600 pixels across the 1280-wide source, or about a third to half its width. The plain original image should not start casting.
8. Choose **Save to cloud**, open **DigiPoly Live 0.6 or later**, download the cloud copy and load that environment. Its reference PNG is downloaded and verified with the other assets. OBS channel links work as before; no extra OBS plugin is needed.

The sibling project lives in `../GhostMarker`. Run `python3 serve.py` there and open [localhost:5189](http://127.0.0.1:5189) for the standalone encoder. DigiPoly's repository includes the library snapshot, so it does not require that sibling folder to run.

## What the status means

- **Out of view:** no acceptable image geometry was found, the target is too small/obscured, or a detectable duplicate is ambiguous.
- **Confirming identity…:** the image is located, but the hidden ID has not yet passed two consecutive confirmations. No overlay is cast yet.
- **Hidden ID verified:** the hidden ID matches and casting is active.
- **Following image · brief hold:** the image is still matched and moving geometry is available, but the ID is temporarily unreadable. Casting stops after 1.5 seconds from the last verified ID unless it is read again.

Loss of image geometry stops casting immediately on the next processed frame. If the worker stops returning fresh geometry for 600 ms, the preview loop clears the overlays. Source/environment changes clear confirmation. A conflicting decoded ID or a large jump also removes the old lock. The hold is deliberately bounded; a similar-looking object cannot keep an old overlay indefinitely.

## Limits of this experiment

This is GhostMarker's original GM1 DCT codec, **not a trained StegaStamp model**. Reference upload is required for localisation. Plain areas are left untouched, but artifacts can remain visible in texture, especially at stronger settings. Detailed matte photographs are a better starting point than flat logos or glossy prints. Small images, motion blur, steep angles, cropping, glare and print processing may prevent decoding.

Synthetic and actual browser pipeline tests pass. Physical print-to-webcam recovery still needs hands-on validation. Detection is slower than coded-border tracking; expect frame rate to depend on target count and hardware. The worker analyses up to 960 pixels of source width for coded markers and GhostMarkers. That width keeps the linked corner cells from aliasing away on a 1280-pixel frame.

Use one physical copy per ID. Two visually near-identical references are rejected within an environment. Search narrows around located pictures and scans the full frame periodically; a newly appearing duplicate outside that region is not necessarily detected immediately. A hidden ID is not proof of ownership or a security feature.

Current campaign media is rasterised to a square before being mapped to the target; on a rectangular image it stretches to fill that plane. Prepare artwork accordingly for this POC.

## Data and compatibility

Encoded reference PNGs are stored as separate local media records and included in cloud saves and Live downloads. They retain the existing per-account access controls and file hashes. An environment copy shares its reference file while keeping independent campaign assignments. Removing a placement does not remove targets in another environment.

Use an updated Studio and Live together. Older clients do not understand GhostMarker placements. Existing version-2 workspaces with only DP-001/DP-002 remain compatible with the updated application; there is no destructive migration.

## Development

GhostMarker's independent MIT source lives in the sibling project. Refresh the vendored copy using `npm run ghostmarker:sync`; the snapshot records its version and source hashes. The worker decodes only rectified matched regions, and narrows feature extraction around tracked images between periodic full-frame searches. Recognised DP-001/DP-002 regions are excluded from picture feature searches so their detailed borders cannot crowd out image matches. The decoder always reads the original source frame before overlays.

Run `npm test` for workspace, cloud, tracking and OBS bridge regressions. With the local Studio server running, open `/tests/ghost-browser.html` and click **Run checks** for the actual worker → LiveRuntime → UK/Spanish compositor test. Append `?id=GM-AABBCCDD` to repeat with a different reproducible payload. Test pages are excluded from the website build and desktop package.

Research references: [StegaStamp paper](https://openaccess.thecvf.com/content_CVPR_2020/papers/Tancik_StegaStamp_Invisible_Hyperlinks_in_Physical_Photographs_CVPR_2020_paper.pdf), [official StegaStamp code](https://github.com/tancik/StegaStamp), [TrustMark](https://github.com/adobe/trustmark). GhostMarker's `docs/RESEARCH.md` records the codec design, measured synthetic results and a physical validation checklist.
