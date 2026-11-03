# OpenCV runtime

Vendored to keep camera frames, marker detection and startup on the user's machine after checkout. No CDN is contacted at runtime.

- Package: `@techstark/opencv-js@4.11.0-release.1`
- Source: https://registry.npmjs.org/@techstark/opencv-js/-/opencv-js-4.11.0-release.1.tgz
- Upstream packaging: https://github.com/TechStark/opencv-js
- License: Apache-2.0, retained in `LICENSE-OpenCV.txt`.
- Registry SHA-512 integrity, verified before extraction:
  `sha512-d5h8cMiSbbnme5+I1ta4++EJ3mkca1zkVNh0A4+5ASJYOmO5OhVPRX3oPnNzs9I3KyGVX7QeFU8gVoI7I0w8RQ==`

`opencv.js` is the unmodified `package/dist/opencv.js` file from that archive. Its embedded WebAssembly is loaded in a dedicated worker.
