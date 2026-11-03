# DigiPoly Studio + Live

**One physical marker. Different stories for different audiences.**

DigiPoly replaces printed markers in a camera feed with images or looping videos. Put a poster on a wall and a sticker on a box, assign content to each, and keep that content attached as the markers move. Campaign channels produce different editions of the same scene—for example, UK / English and Spain / Spanish.

This repository contains a browser studio, an optional Cloudflare workspace service, and a local desktop app that supplies separate video feeds to OBS.

**Start here: [Streaming on a Mac](docs/MAC_STREAMING.md).**

## What you can do

- Create environments with their own placements, backgrounds and campaign channels.
- Track two distinct printed marker IDs: **DP-001** and **DP-002**. The border identifies the marker; the central D is the brand.
- Assign images or muted looping videos independently to each marker in each channel.
- Try the moving-marker demo or a fictional bedroom with a wall poster and desk-box sticker.
- Upload media, upload a background, or capture a still background with a camera.
- Save a workspace and its uploads to your own cloud deployment, then download it into DigiPoly Live.
- Capture one webcam locally and deliver a separate **1280 × 720** video feed per audience to OBS.

Audience and language labels organise your content. DigiPoly does not translate artwork, geolocate viewers or choose a broadcast destination. Two feeds require downstream delivery if you want two simultaneous broadcasts.

## Choose your starting point

| Goal | What to run | Account required? |
| --- | --- | --- |
| Explore environments and upload your own artwork locally | Browser Studio | No |
| Try the desktop demo, webcam and OBS feeds | DigiPoly Live, plus OBS when needed | No, for the included sample workspace |
| Configure online and load custom environments into Live | Hosted Studio + DigiPoly Live | Yes, on the same cloud deployment |
| Run your own cloud service | Cloudflare Worker + D1 + private R2 + Access | Your own Cloudflare account |

The reference portal at [digipoly.co.uk/studio](https://digipoly.co.uk/studio) requires an authorised Cloudflare Access identity. Cloning this repository does not grant access. You can try the included desktop samples without signing in or [self-host the service](docs/SELF_HOSTING.md).

**Local Studio storage and Live's cache are separate.** Editing the local browser studio does not automatically update the desktop app. The current supported handoff for custom workspaces is **Save to cloud → Download cloud copy → Load environment**. File import/export between them is not implemented.

## Quick start: desktop demo on a Mac

Use an Apple Silicon Mac and [Node.js 24](https://nodejs.org/en/download). Node 24 is the tested development version; `.nvmrc` is included for users of nvm. Clone the repository and start Live:

```sh
git clone https://github.com/captains-deck/DigiPoly.git
cd DigiPoly
npm ci
npm run live
```

If you downloaded the source ZIP instead, open Terminal in its extracted folder and run the last two commands.

Live starts with sample environments, or the last downloaded cloud workspace if one already exists. Select an environment, click **Load environment**, and use **Demo scene** first. Click **Start webcam** when ready to test printed markers. Camera permission is required.

To build a standalone Mac app:

```sh
npm run live:package
```

On Apple Silicon, open `releases/DigiPoly Live-darwin-arm64/DigiPoly Live.app`. After building, the app runs without a Terminal server. Packaging uses the current machine's platform and architecture; only the Apple Silicon Mac build has been tested.

The preview is locally ad-hoc signed. A notarised public download is not supplied by this repository. See the [Mac guide](docs/MAC_STREAMING.md) for packaging, permissions and OBS setup.

## Quick start: browser Studio and printable markers

Install [Python 3](https://www.python.org/downloads/macos/), then run:

```sh
python3 serve.py
```

- [Local Studio](http://127.0.0.1:5177/studio.html)
- [Print DP-001 and DP-002](http://127.0.0.1:5177/print.html)

The Python server is local only. It has no cloud API, and no npm installation is needed for this browser-only demo. Keep it running while using those local pages. The hosted equivalent uses `/studio` rather than `/studio.html`.

Print one A4 page per marker, at 100% scale, with browser headers and footers disabled. Use matte white paper, retain the complete white border, and mount the sheets flat. Use the canonical print files, not the uncoded logo or a concept-board screenshot.

## How streaming works

```text
Studio: environments + uploads + channel assignments
                     │ explicit cloud save / download
                     ▼
DigiPoly Live: one webcam → one marker detector
                             ├─ UK assignments    → UK video feed
                             └─ Spain assignments → Spanish video feed
                                                    │
                                            OBS Browser Sources
```

Video processing stays on the streaming computer. Cloud saves upload configuration, campaign files and saved background images—not live webcam footage. Live's output bridge listens on `127.0.0.1:18777`, so OBS must run on the same Mac. Use the per-channel **Copy OBS link** buttons and keep those links private.

Live normally uses local WebRTC, with a local JPEG compatibility stream if needed. Outputs are video only; add microphone and other audio in OBS. The browser Studio's older **Clean output** windows use window capture; its `output.html` is not a substitute for a Live Browser Source link.

## Documentation

- [Mac streaming guide](docs/MAC_STREAMING.md): installation, printing, webcam, OBS, restarting and troubleshooting.
- [Studio guide](docs/STUDIO_GUIDE.md): environments, media, backgrounds, channels and saving.
- [Self-hosting](docs/SELF_HOSTING.md): your Cloudflare deployment and connecting a fork's desktop app.
- [Live architecture](docs/LIVE.md): local transport, cloud storage, offline operation and limits.
- [Contributing and publishing](CONTRIBUTING.md): development checks, reporting problems and preparing a GitHub release.
- [Physical trial notes](docs/POC.md): marker acceptance checks and historical results.

## Development

```sh
npm ci
npm test
npm run build
```

`npm test` runs 27 Node test groups covering marker detection, identity tracking, workspace behaviour, cloud authorisation and the local output bridge. Tests use local fixtures; they do not need a Cloudflare account. Bridge tests need permission to bind a local loopback port.

With `python3 serve.py` running, browser checks are available at:

| Page | Coverage |
| --- | --- |
| `/tests/browser.html` | Marker rendering, worker detection and video streams |
| `/tests/campaign.html` | Audience-specific pixels, assignments, media and persistence |
| `/tests/scenes.html` | Room scenes, placements, backgrounds and camera-still lifecycle |
| `/tests/live.html` | Two video receivers, moving marker footage and black output on pause |

`npm run build` creates a public asset allowlist in `dist/`. Cloud and desktop source, tests, local configuration and reference images are excluded from that website build. Deployment requires a separately configured `wrangler.jsonc`; follow the self-hosting guide before using `npm run deploy`.

| Folder | Purpose |
| --- | --- |
| `src/` | Shared tracking, compositing, workspace model and Studio UI |
| `live/` | Electron desktop app and authenticated loopback OBS bridge |
| `cloud/` | Cloudflare API, Access validation and D1 migrations |
| `assets/` | Canonical markers, fictional campaign artwork and demo background |
| `vendor/` | Local OpenCV runtime and its licence |
| `tests/` | Node and browser verification |
| `scripts/` | Artwork generation, website build and desktop packaging |

## Current status and limits

Version **0.5.0** is a proof of concept. Apple Silicon Mac camera capture and local delivery to OBS 33.0.1 were checked on 3 November 2026. Automated checks exercise moving markers and distinct audience content. Physical printed-marker performance across different rooms, cameras and distances still needs wider evaluation. Intel Mac, Windows and Linux releases are not validated.

There are two canonical IDs, up to 12 environments and up to four channels in the active environment. Markers need readable borders and a reasonably flat surface. Tracking does not infer depth, segment a hand passing in front, or predict through a fully hidden marker. Video audio, native virtual-camera drivers and automatic broadcast routing are outside this preview.

## Licence and credits

DigiPoly's original source and included project assets are provided under the [MIT licence](LICENSE). Third-party components retain their own licences; see [third-party notices](THIRD_PARTY_NOTICES.md). The bundled OpenCV runtime is Apache-2.0 licensed. The bedroom image is an AI-generated fictional scene, and sample campaign brands/products are fictional.
