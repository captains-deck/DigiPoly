# Contributing to DigiPoly

DigiPoly is an MIT-licensed proof of concept. Useful contributions include physical-marker testing, camera compatibility, tracking improvements, accessibility, desktop packaging and clearer setup instructions.

## Local development

Use Node 24 and run commands from the repository root:

```sh
npm ci
npm test
npm run build
```

For browser work, run `python3 serve.py` and open `http://127.0.0.1:5177/studio.html`. For desktop work, run `npm run live`. Cloud fixtures in the Node tests do not require a live Cloudflare account. Integration with an actual portal is described in [self-hosting](docs/SELF_HOSTING.md).

For an isolated desktop development workspace:

```sh
DIGIPOLY_DATA_DIR="$PWD/.live-data/development" npm run live
```

Only one Live instance uses port 18777 at a time. Quit the existing app before starting a separate development run.

Run the relevant browser verification pages listed in the README when changing detection, video handling, scene backgrounds or audience compositing. Test camera start/stop, app restart and OBS reconnection for desktop changes. Do not update canonical marker geometry casually: existing printed sheets must continue to work, or the change must explicitly introduce a new marker version.

## Reporting a problem

Include macOS version, Mac model/chip, camera model, Live version, OBS version, active environment and whether the issue occurs in Demo scene or webcam mode. Explain the expected result and the shortest steps that reproduce the problem.

For tracking issues, include print size, lighting, distance, marker count, movement/angle and whether the border is fully visible. Share a synthetic example or your own non-sensitive test scene if possible. Do not post stream keys, full OBS receiver URLs, sign-in cookies, cloud tokens, private camera footage or the Live application-data folder.

## Pull requests

Describe the user-visible change, how you checked it and any limits. Keep generated build output, dependencies, personal deployment settings and user media out of commits. Preserve third-party notices and update the guides if the setup flow changes. New original contributions should be provided under the project's MIT licence.

## Preparing the first GitHub publication

The following applies when publishing this folder for the first time. Create an empty GitHub repository under the intended owner, without asking GitHub to generate another README or licence. Then, from this project's root:

```sh
git init -b main
git add .
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Review the staged files before committing. The supplied `.gitignore` excludes `node_modules/`, `dist/`, `releases/`, local cloud settings, the account-specific deployment record, reference images, credentials and common recording files. It does not remove files already committed to an existing repository. Commit `package-lock.json`, the canonical assets, and the vendored OpenCV runtime plus its licence.

Confirm the important exclusions with:

```sh
git check-ignore wrangler.jsonc docs/DEPLOYMENT.md references/digipoly-concept-board.png
```

After the review:

```sh
git commit -m "Open-source DigiPoly Studio and Live"
git remote add origin 'YOUR_GITHUB_REPOSITORY_URL'
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the actual GitHub clone URL. If the folder is already a repository, inspect its branch/remotes first instead of repeating initialisation or adding a second `origin`. Choose the repository's visibility in GitHub; publishing documentation locally does not make the hosted portal public.

The upstream repository is [captains-deck/DigiPoly](https://github.com/captains-deck/DigiPoly). For a fork, update the repository link in `website/home.html` and the repository metadata in `package.json`. Do not add a release download link before an artifact exists.

## Release checks

- Run `npm test`, `npm run build`, and the relevant browser tests.
- Build desktop artifacts from a reviewed checkout with `npm run live:package` on the target platform. Test the resulting app, not only `npm run live`.
- Check included licence files and upstream runtime notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- For public Mac binaries, complete Apple Developer signing and notarisation. The current script only provides an ad-hoc local signature.
- Verify camera permission, two physical marker IDs, two audience feeds, stop/black output and OBS reconnection after restart.
- Confirm a source archive excludes private deployment configuration, account/cache data, user uploads and design references. Package source from Git, rather than zipping an entire working folder with ignored files.
- Publish platform-specific artifacts and checksums as release attachments, with tested platform/version details. The repository itself should contain source, not packaged apps.

No GitHub Actions deployment or automatic release upload is configured. Cloud publishing uses the maintainer's local ignored Wrangler configuration.
