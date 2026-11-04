# Streaming with DigiPoly on a Mac

This guide takes you from a fresh checkout to a webcam feed with two tracked placements, separate UK and Spanish editions, and OBS preview/recording. Start with the included demo before connecting any streaming account.

## What needs to be open?

| What you are doing | Keep open |
| --- | --- |
| Testing the demo or printed markers | DigiPoly Live |
| Recording, streaming or using OBS Virtual Camera | DigiPoly Live + OBS |
| Editing an environment or uploading artwork | Studio in your browser |
| Using local Studio or printing from localhost | The Python server + your browser |

A packaged DigiPoly Live app contains its own local video engine. It does not need a browser tab, the Python server or a Terminal window running. Previously downloaded environments work offline. Cloud downloads and online editing require an internet connection.

## 1. Install and start Live

### If you already have the app

Open **DigiPoly Live.app**. A locally built Apple Silicon copy is in `releases/DigiPoly Live-darwin-arm64/` inside the project folder. You may copy it into Applications for convenient access. Open only one copy at a time.

### Build it from this repository

You need an Apple Silicon Mac, [Node.js 24](https://nodejs.org/en/download), and an internet connection for the initial dependency download. Clone or download the repository and open Terminal in its root folder:

```sh
npm ci
npm run live
```

This launches the desktop app from source. Keep that Terminal process running while testing. Quit the app before building a replacement standalone copy:

```sh
npm run live:package
```

Open `releases/DigiPoly Live-darwin-arm64/DigiPoly Live.app`. The first packaging run may download Electron. Build output is excluded from Git.

The current app is an ad-hoc signed preview, not a notarised public release. Building locally is the documented route for a fresh checkout. Do not disable macOS security protections to run an unfamiliar downloaded binary. Maintainers should sign and notarise binaries before offering a public installer.

Only Apple Silicon packaging has been verified. The script follows the host architecture; a successful Intel build would still need its own camera and OBS testing.

## 2. Run the included demo

1. Choose **Bedroom stream** or **Creator studio**.
2. Click **Load environment**, then **Demo scene** if necessary.
3. Look for **2/2 markers** and separate UK / English and Spain / Spanish previews.
4. Confirm each audience has its own artwork on the same physical placements. Creator studio demonstrates moving prints; Bedroom stream demonstrates a wall poster and a sticker on a box.

A fresh install has sample environments and needs no account for this test. An existing install uses its downloaded workspace, so names and assignments may differ from the samples.

## 3. Print the actual markers

The detector recognises **DP-001** and **DP-002**, including their coded borders. The plain DigiPoly logo and the original concept illustrations are not detection targets.

To print locally, install [Python 3](https://www.python.org/downloads/macos/), then run this from the project root:

```sh
python3 serve.py
```

Open [the marker pair](http://127.0.0.1:5177/print.html) and click **Print / Save as PDF**. An authorised hosted Studio also has a **Print markers** link.

Use these settings:

- A4, portrait, one marker per page, single-sided.
- 100% scale; browser headers and footers off.
- Matte white paper with a complete white border and all four corner links intact.
- Mount each page on flat card. Avoid folds, glare and glossy lamination.

Use the updated Studio and Live 0.7 or later with the new linked-corner prints. DP-001 matches the logo; DP-002 turns the inner link in each corner. Older v2 prints remain recognised under their existing IDs.

Print one of each ID. Two copies of the same ID in view are deliberately suppressed rather than treated as separate placements. SVG masters are in `assets/brand/dp-001-print.svg` and `assets/brand/dp-002-print.svg`.

## 4. Test your webcam

1. In Live, click **Start webcam**.
2. Allow the macOS camera prompt. For a packaged build, the permission belongs to **DigiPoly Live**; source runs may be identified as **Electron**.
3. Select the intended webcam from **Webcam device** if more than one is available.
4. Hold both complete markers in view, with even light and minimal motion blur. Start close enough for each marker to occupy roughly 200 pixels of the 1280-pixel-wide frame; this is a starting guideline, not a validated detection limit.
5. Check the counter reaches **2/2 markers**. Move, rotate and swap the markers' positions. Each should retain the content assigned to its ID.
6. Remove one marker. Its overlay should disappear; the other should remain. Bring it back and confirm its assignment returns.

To compare a stationary poster with a moving sticker:

1. Mount DP-001 flat and keep the camera still. In Studio the placement should read **Tracking**. Briefly pass a hand across it: the status may show **Brief hold** while the artwork stays, then return to **Tracking**. Cover it for a full second and the artwork should leave.
2. Hold DP-002 and move it, or pan the camera across the fixed poster. The hold should be shorter. When the print leaves the frame, the artwork should go with it rather than remaining on the empty wall.
3. Put two copies of the same ID in view. That placement should clear instead of jumping between them.
4. Compare the UK and Spanish outputs. They should share the marker’s position and show different assigned media, with no tracking-status text in the picture.

With no recognised marker, both editions show the same raw camera scene. Different output only becomes visible where a recognised marker has different assignments. An empty assignment leaves the original marker visible.

**Stop camera** ends camera capture and sends black video. **Demo scene** explicitly switches back to the generated scene. These controls do not start or stop an OBS broadcast.

## 5. Load your own environment and artwork

For local browser experiments, open [Studio](http://127.0.0.1:5177/studio.html). It saves to that browser only. Those edits do not automatically appear in Live.

To move custom configurations into Live, use an authorised cloud portal, either the reference deployment or [your own deployment](SELF_HOSTING.md):

1. In Studio, create or select an environment.
2. Add your media in **Media library → Add media**.
3. Assign artwork to DP-001 and DP-002 independently in each campaign channel. Supply Spanish artwork yourself for a Spanish edition.
4. Click **Save to cloud** and wait for confirmation.
5. In Live, click **Sign in** and use the same identity as the portal. This is a separate login session from Safari or Chrome.
6. Click **Download cloud copy**. This downloads the complete workspace and its uploaded files.
7. Select the environment and click **Load environment** to apply it.

Downloading a new cloud version does not replace the active stream. Loading is an explicit action. Downloaded files are cached on the Mac, so the portal can be closed afterwards.

The reference portal at [digipoly.co.uk/studio](https://digipoly.co.uk/studio) is access-controlled; there is no public self-service account signup. If you do not have access, use the samples or follow the self-hosting guide. There is currently no local workspace-file import into Live.

## 6. Add both audience feeds to OBS

Install [OBS Studio for macOS](https://obsproject.com/download) and keep DigiPoly Live running on the **same Mac**. The integration was checked with OBS 33.0.1. Your scene list starts empty on a fresh OBS installation; scenes used on another computer are not included in the repository.

For the UK feed:

1. In OBS, create a scene named **DigiPoly UK**.
2. In Live's UK / English card, click **Copy OBS link**.
3. In OBS's **Sources** panel, choose **+ → Browser** and create a new source named **DigiPoly UK video**. In newer versions, choose **Add a new Browser**.
4. Leave **Local file** off and paste the copied link into **URL**.
5. Set **Width: 1280**, **Height: 720**. Leave **Shutdown source when not visible** off if you want both feeds to remain connected.
6. Click **OK**. Select the source and use **Edit → Transform → Fit to screen** if it does not fill the canvas.

Repeat in a scene named **DigiPoly Spain**, using the Spain / Spanish card's link. Each link belongs to one audience channel. The underlying Browser Source controls are described in [OBS's guide](https://obsproject.com/kb/browser-source).

The links start with `http://127.0.0.1:18777/` and contain a private channel key. Copy the complete link from Live; do not construct it by hand, substitute the portal URL, or use the browser Studio's `output.html`. Do not publish these links in screenshots or issues.

Each source is a full 16:9 picture. Putting both full-size sources into one scene would cover one with the other. Use two scenes to switch editions, or resize and position both sources side by side for a comparison recording.

### Audio and screen/game capture

DigiPoly feeds contain **video only**. Configure your microphone in OBS, confirm its meter moves, and add game/system audio separately. Avoid capturing the same microphone twice. OBS may request macOS microphone permission; screen/window capture requires screen-recording permission. See [OBS's macOS permissions guide](https://obsproject.com/kb/macos-permissions-guide).

Live owns the webcam. Use its Browser Source feed in OBS instead of opening that same camera again as a Video Capture Device source. Game or desktop capture can be arranged elsewhere in your OBS scene.

### Make a test recording, then go live

1. Check the UK and Spanish scenes show the expected edition.
2. Record a short local test in OBS while moving both markers and speaking.
3. Stop recording and play it back. Check marker identity, picture quality, audio and delay.
4. Use OBS's Auto-Configuration Wizard and streaming settings for your chosen service. Connect the destination yourself and verify the intended scene before choosing **Start Streaming**. See the [OBS quick-start guide](https://obsproject.com/kb/quick-start-guide).

A normal OBS setup broadcasts its selected program scene. Switching from UK to Spain changes that program feed for everyone receiving it. **Two scenes do not create two independent broadcasts.** Simultaneous UK and Spanish broadcasts require a separately configured system capable of routing and encoding each scene/feed independently; that setup is outside this POC.

For a video call, start **OBS Virtual Camera** and select it in the calling application. It supplies the configured OBS view; participants receiving that camera see the same edition. See [OBS's Virtual Camera guide](https://obsproject.com/kb/virtual-camera-guide).

## 7. Open it again tomorrow

1. Open the packaged **DigiPoly Live.app** (or run `npm run live` for development).
2. Confirm the environment and click **Load environment** if needed.
3. Click **Start webcam**. Camera capture does not resume automatically at launch.
4. Open OBS and select your saved scene collection and audience scene.
5. Existing Browser Sources reconnect when their channel is available. Keep Live open throughout the recording or stream.

You only need the portal when editing or saving. If you have changed the online workspace, use **Save to cloud → Download cloud copy → Load environment** before testing the update.

Links remain stable on the same installation for the same channel IDs. A new Mac, deleted Live data, duplicated environment or recreated channel needs newly copied links. Switching to a different environment leaves the old channels waiting until their original environment is active again.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Camera permission is waiting | Find the macOS prompt. In System Settings → Privacy & Security → Camera, enable the app that requested access. Quit and reopen it if macOS asks. **Stop camera** cancels a pending attempt. |
| No webcam or camera busy | Choose the correct device and close other apps using that physical camera. Do not add it directly to OBS at the same time. |
| 0/2 markers | Use the coded print masters; show the entire border; improve light, move closer, keep the paper flat and reduce blur. The logo alone will not work. |
| Overlay blinks, or sticks after the print moves | Studio shows **Brief hold** for a fraction of a second, then **Tracking** or **Out of view**. A wall poster with a still camera holds longer than a sticker or a panning camera. The artwork should not remain after the print has clearly left. |
| One marker disappears when a second appears | Check they have different IDs. Two copies of DP-001 are not two independent placements. |
| Both editions look identical | Confirm a marker is detected and each channel has different media assigned. Save, download and load any changes. |
| OBS waits or shows black | Keep Live open, load the environment that owns the copied channel, and start webcam or Demo scene. Check the complete URL and 1280 × 720 size; refresh the Browser Source if needed. |
| Compatibility stream appears | Live is using the local JPEG fallback. It is expected to run at up to 20 fps rather than WebRTC's target of 30 fps. |
| OBS picture is small or cropped | Check source width/height, then Fit to screen. The output aspect ratio is 16:9. |
| Sign-in closes or cloud download fails | Reopen **Sign in** in Live and use the same identity as Studio. Confirm the portal has a saved cloud workspace. Cached environments remain usable. |
| Cloud save conflict | Another browser saved a newer revision. Load the cloud copy and review it before saving again. Studio retains a local recovery workspace. |
| Local Studio edits are missing | Use the same browser profile and exact origin/port. Browser data is separate from Live and the hosted portal. |
| Port 18777 is in use | Quit another Live instance or the other app using that port, then reopen Live. Port 5177 belongs to the optional Python Studio server. |
| npm install or tests fail on old Node | Use Node 24. The older Node 20 requirement did not cover the current desktop tooling and SQLite tests. |

The app's cache and sign-in session live under `~/Library/Application Support/DigiPoly Live/` for the packaged app. Do not share that directory or delete it as a first troubleshooting step: it contains downloaded media, account state and the key used by your OBS links.

## GhostMarker picture targets (0.6)

Use **Environment markers → + GhostMarker** to create or import an image target. Save to cloud and load it in the updated Live app; reference images travel with the workspace. Existing coded markers and OBS channel links keep working. See the [GhostMarker guide](GHOSTMARKER.md) for printing, tracking states and experimental limitations.
