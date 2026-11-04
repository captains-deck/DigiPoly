# Configuring Studio environments and campaigns

Studio is the browser editor. DigiPoly Live is the local camera and OBS app. For streaming setup, see [the Mac guide](MAC_STREAMING.md).

## Environments and placements

Choose **New environment** to create a scene with DP-001, DP-002 and starter UK / English and Spain / Spanish channels. New marker assignments start empty. Use **Edit environment** to change its name/description or **Duplicate** to copy the setup with independent assignments.

Under **Environment markers**, give the physical placements useful names such as “Wall poster” and “Desk box”. Removing a marker clears its assignments in that environment. Adding the ID back starts with empty assignments. Use one print per ID in the camera view; the same prints can be reused in another environment.

Only one environment is active at a time. The preview supports up to 12 environments, two marker identities and four campaign channels per environment.

## Campaign channels

Each channel stores its own assignment for each marker. Choose an image or video for DP-001 and DP-002 in the UK card, then choose different items in the Spanish card. Rename or add a channel to represent another audience, language or sponsor edition. At least one channel remains in each environment.

Country and language are labels. Supply translated content yourself. Channels do not automatically route viewers or create broadcasts.

## Media library

Use **Media library → Add media** to upload files:

| Type | Formats | Limit | Display |
| --- | --- | --- | --- |
| Image | PNG, JPEG, WebP | 10 MB; 40 megapixels | Still image |
| Video | Browser-decodable MP4 or WebM | 100 MB; 40 megapixels per frame | Muted loop |

Uploaded items can be reused across markers, channels and environments. Media is centre-cropped to a square and projected onto the marker; transparent areas have a dark backing. Unsupported codecs fail validation. Video sound is not sent to Live or OBS.

You can search the library and see usage counts. Removing an uploaded item clears its assignments everywhere. Keep original media files separately. Seven fictional sample assets are included, and the preview accepts up to 50 uploaded media items.

## Backgrounds and the bedroom example

**Bedroom stream** contains a fictional room with a wall poster and desk-box sticker. Its demo markers go through the same detector as real camera footage. Gentle camera drift moves the room and prints together.

Each environment has a separate **Environment background** panel:

1. **Upload background** accepts PNG, JPEG or WebP up to 10 MB / 40 megapixels. It creates a centre-cropped 1280 × 720 still.
2. **Capture from camera** lets you frame a room and save a still. Cancel closes a camera opened by the dialog; an existing Studio camera can be reused.
3. With **Place demo markers on background**, use **Adjust placements** to move the poster/sticker or drag their perspective corners. Smaller/Larger and arrow keys also work; Shift increases the arrow-key step. Save placements applies the layout to all channels.
4. If the photo already contains real printed codes, select **Detect markers already in photo** instead.
5. **Reset scene** restores the starter layout while retaining campaign assignments.

A saved background is a demo scene, not live background replacement or person segmentation. Webcam mode uses the real camera view. Background images are stored separately from media-library campaign artwork.

## Saving and moving to Live

Local edits autosave to IndexedDB in the current browser. Wait for **Saved on this device**. Browser profile, hostname and port all matter: `localhost`, `127.0.0.1` and the hosted domain have different storage. Clearing site data removes local files and settings.

On an authenticated cloud deployment, click **Save to cloud** to publish the complete workspace and its uploaded files to your private cloud copy. In Live, use **Sign in → Download cloud copy → Load environment**. Use the same identity in both apps. Loading is explicit so an online edit does not change a running stream.

**Load cloud** replaces the browser's current workspace after confirmation and keeps a local recovery workspace, accessible with **Recover local copy**. Recovery is not a durable backup of every historical uploaded file; retain originals. A revision conflict means another browser saved a newer copy. Load and review that copy before saving again.

The simple Python server has no cloud service. Local Studio edits cannot currently be imported into Live as a file. For custom desktop environments, use [a cloud deployment](SELF_HOSTING.md). One cloud workspace belongs to one verified identity; team collaboration and merging simultaneous edits are not implemented.

## Browser-only output alternative

Studio's **Clean output** opens a separate window for a channel. Keep Studio and its output windows open, then capture the desired window in OBS. Loading `output.html` directly as an OBS Browser Source cannot obtain the parent Studio's video stream.

For the desktop route, use Live's **Copy OBS link** instead. That supplies a standalone local receiver suitable for OBS Browser Sources and survives app restarts for the same channel and installation.

## GhostMarker picture targets (0.6)

Use **Environment markers → + GhostMarker** to create or import an image target. Save to cloud and load it in the updated Live app; reference images travel with the workspace. Existing coded markers and OBS channel links keep working. See the [GhostMarker guide](GHOSTMARKER.md) for printing, tracking states and experimental limitations.

## Readable linked-corner markers (0.8)

The logo and DP-001 use the interlocking-link artwork, with larger corner blocks and a slightly wider central arrow so the mark reads at small sizes. DP-002 shares the central D and turns each inner corner link by 180 degrees. Download the updated sheets from **Print markers**. Existing v3 and v2 prints retain their original IDs and content assignments. Use one copy of each ID in view, including when mixing print versions. New v4 prints require Studio/Live 0.8 or later; GhostMarker targets are unaffected.

Each placement shows **Tracking**, **Brief hold** or **Reacquiring**. Brief hold means the marker was confirmed and the overlay is bridging a short gap; assigned video keeps playing. A steady marker in the image can hold for about a third of a second. A moving sticker, or a fixed poster while the camera itself is moving, holds for about a seventh of a second. If the border is still visible but the ID cannot be read, the overlay can follow that border for a little over a second since the last clear read, then it lets go. Two copies of one ID, a conflicting ID, or a marker that leaves the frame clear the overlay instead of leaving artwork parked. OBS and clean outputs do not show these status words.
