# DigiPoly Live architecture and behaviour

For first-time setup, use [Streaming on a Mac](MAC_STREAMING.md). The included desktop samples run without an account. Custom cloud workspaces require an authorised portal; see [self-hosting](SELF_HOSTING.md) for your own instance.

The portal at https://digipoly.co.uk/studio configures environments, placements, media and audience channels. DigiPoly Live downloads those settings and files, captures one local webcam, detects the two coded marker identities, and renders a separate 1280 × 720 video for each channel. Video never passes through Cloudflare.

## Use it

1. In the portal, configure your environment and click **Save to cloud**. Local edits still autosave to this browser; publishing to cloud is explicit.
2. Open the Mac application in `releases/DigiPoly Live-darwin-arm64/DigiPoly Live.app`.
3. Click **Sign in**, complete the existing Cloudflare Access login, then **Download cloud copy**. Use the same identity as the portal. The login window belongs to DigiPoly Live; signing into a separate browser does not sign in the desktop app.
4. Choose an environment and click **Load environment**. The saved demo background is available immediately. Click **Start webcam** to use your camera instead. Print one of each coded marker from the portal.
5. Click **Copy OBS link** on the UK channel. In OBS, add a **Browser Source**, paste the link, and set width **1280**, height **720**. Repeat for the Spanish channel. Give the sources distinct names.
6. Keep Live open during your session. Sources reconnect when Live restarts or the environment reloads. If you switch to an unrelated environment, its channels have different links; the previous sources wait for their original channel.

These are full-frame, video-only outputs. Configure microphone/audio in OBS. Keep the raw webcam out of OBS's Video Capture Device sources while Live owns it. Stop camera produces black output; switching to Demo scene is an explicit choice. Separate sources do not automatically create two broadcasts or route viewers by country.

## Cloud and offline behaviour

- One private workspace per verified Cloudflare Access identity, containing all environments and uploads. Existing Access protections remain enabled. This preview has no public registration or team sharing.
- D1 stores the workspace and revision; private R2 stores uploaded media/backgrounds. Built-in artwork ships with the desktop application.
- File hashes are verified before publication and after download. A failed upload does not publish a partial workspace. A failed desktop download retains the previous complete cached manifest.
- Simultaneous saves use revision checks. A conflict asks you to load the newer cloud copy. Loading a cloud copy keeps a local recovery workspace, available through **Recover local copy**.
- Downloads and loading are separate actions. Cloud edits do not change an active stream. Previously downloaded environments work offline, including uploaded media.
- POC limits: 12 environments, 4 channels each, 50 uploaded media items, 10 MB images, 100 MB videos, 512 MB referenced files per workspace, 1 GB stored uploads per identity. Historical/unreferenced uploads are retained in this preview; automatic storage cleanup is not implemented.
- Cache: macOS `~/Library/Application Support/DigiPoly Live/cloud-cache`. Cloud sign-in uses an isolated persistent Electron session. The portal's authentication cookies are never passed into the local renderer or OBS.

## Local output bridge

Live listens on `127.0.0.1:18777` only. Each channel has a persistent, unguessable link. The receiver exchanges a WebRTC offer/answer over that local server; both media peers are on the same computer, with no external STUN/TURN service. Origin/Host checks prevent cross-origin access and DNS rebinding. Links are scoped to channel IDs. Keep them private to your streaming setup.

If WebRTC cannot connect within ten seconds, the receiver switches to an authenticated local JPEG stream at up to 20 fps. This compatibility mode also clears stale pictures when Live stops. JPEG encoding only runs for channels that need it; normal WebRTC outputs run at up to 30 fps.

The renderer reuses the studio's OpenCV worker, track manager and compositor. All channels consume the same detected source frame. Raw video is captured once. The OpenCV worker alone permits the generated loader's eval requirement; the desktop UI retains a strict script policy, sandbox and context isolation. The remote sign-in window has no native bridge and no device permissions.

## Development and release

Use Node 24. Cloud deployment is a separate step requiring your own configuration; follow [self-hosting](SELF_HOSTING.md).

```sh
npm ci
npm run live
npm run live:package
npm test
npm run build
```

The local build is an Apple Silicon Mac preview with a local ad-hoc signature. Public distribution still needs Apple Developer signing and notarisation. Windows and Intel Mac binaries have not been built or tested. Do not advertise it as a notarised public installer.

`tests/live.html` exercises both receivers, actual video input with generated marker footage, audience differences and black output on stop. The automated cloud tests cover signature validation, tenant isolation, immutable file hashes, incomplete uploads and concurrent save conflicts. `tests/live-server.test.mjs` covers loopback source access, per-channel tokens and reconnection state. Camera capture and separate local outputs were verified on Apple Silicon with OBS 33.0.1. The account-specific deployment log stays local and is excluded from the public repository.

Sources: [OBS Browser Source](https://obsproject.com/kb/browser-source), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## GhostMarker picture targets (0.6)

Use **Environment markers → + GhostMarker** to create or import an image target. Save to cloud and load it in the updated Live app; reference images travel with the workspace. Existing coded markers and OBS channel links keep working. See the [GhostMarker guide](GHOSTMARKER.md) for printing, tracking states and experimental limitations.
