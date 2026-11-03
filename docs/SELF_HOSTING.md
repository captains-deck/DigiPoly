# Hosting your own DigiPoly cloud workspace

Cloud hosting is optional for the desktop sample demo and local browser Studio. It is needed for the current custom-workspace handoff from an online Studio into DigiPoly Live.

The service uses a Cloudflare Worker for the API, D1 for versioned workspace documents, private R2 for uploaded files, and Cloudflare Access for sign-in. Live camera footage stays on the Mac; explicit cloud saves upload media and background stills as well as settings.

## 1. Prepare your Cloudflare resources

Use your own account and a hostname on a Cloudflare-managed domain, such as `studio.example.com`. Enable Workers, D1 and R2 as required for that account.

In the Cloudflare dashboard, create a D1 database called `digipoly-cloud` and record its database ID. Create an R2 bucket called `digipoly-media`; keep its public access disabled. Those names match the repository's scripts and example configuration. Follow the official [D1 setup](https://developers.cloudflare.com/d1/get-started/) and [R2 bucket creation](https://developers.cloudflare.com/r2/buckets/create-buckets/) instructions.

The Worker bindings must be named **DB**, **MEDIA** and **ASSETS**, even if you choose different resource names. Using different database or bucket names also requires updating the configuration and relevant commands below.

## 2. Set up sign-in before publishing the portal

Create a Cloudflare Access **self-hosted application** covering the chosen hostname and all its paths, including `/api/*` and `/live-setup`. Configure an identity provider or email one-time PIN and an Allow policy for your intended users. Follow [Cloudflare's self-hosted application instructions](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

Record the Access team issuer, for example `https://YOUR_TEAM.cloudflareaccess.com`, and the application's **AUD** value. The issuer must match the token's issuer exactly, with no trailing slash. The Worker validates the signed token's issuer, application audience and expiry; it does not trust a plain email header.

The desktop app opens sign-in in an isolated window. Use a normal browser-compatible login flow and test it in that window. This POC does not implement public registration, invitations, team workspaces or role management.

## 3. Create your local deployment configuration

From the repository root, copy the template if you do not already have a configuration:

```sh
cp -n wrangler.example.jsonc wrangler.jsonc
```

`wrangler.jsonc` is ignored by Git. `cp -n` preserves an existing configuration; inspect that existing file rather than assuming the template replaced it.

Fill in these fields:

| Field | Your value |
| --- | --- |
| `account_id` | Your Cloudflare account ID |
| `vars.ACCESS_ISSUER` | The exact Access team issuer URL |
| `vars.ACCESS_AUD` | The Access application's audience value |
| `d1_databases[0].database_id` | Your D1 database ID |
| `d1_databases[0].database_name` | `digipoly-cloud`, or your chosen name |
| `r2_buckets[0].bucket_name` | `digipoly-media`, or your chosen name |
| `routes[0].pattern` | Your hostname, without `https://` or a path |

Keep `workers_dev` and preview URLs disabled for this setup, so they do not introduce another hostname outside the chosen Access application. Keep `run_worker_first: ["/api/*"]` so API requests reach the Worker. The static output directory is `dist/`. See [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) for these settings.

Account IDs and Access AUD values are configuration identifiers, not login credentials. They are kept local here to avoid accidentally deploying a fork into the reference account. OAuth tokens, API tokens and login sessions must also remain outside Git.

## 4. Apply the database migration and deploy

With Node 24 installed, run:

```sh
npm ci
npx --yes wrangler@4.20.3 login
npm run cloud:migrate
npm run deploy
```

The migration command applies `cloud/migrations/0001_cloud.sql` to the remote `digipoly-cloud` database. If you renamed it, use `npx --yes wrangler@4.20.3 d1 migrations apply YOUR_DATABASE_NAME --remote` instead. The deploy script builds the website and publishes the Worker using your local configuration.

Wrangler 4.20.3 is pinned for the existing deployment scripts. Review and test upgrades separately. This guide does not provision resources automatically, and `python3 serve.py` is not an emulator for the cloud API.

## 5. Point your desktop build at your portal

The preview currently fixes its portal origin in `live/main.mjs`:

```js
const PORTAL='https://digipoly.co.uk';
```

For your fork, change that value to your own HTTPS origin, for example `https://studio.example.com`, with no trailing slash or `/studio` path. This controls sign-in, downloads and the **Open portal** button. There is no portal-address setting in the desktop UI yet.

Quit any running Live app, then test your change with `npm run live`. To avoid mixing development state with a previously used deployment, start with a separate, absolute data-directory path:

```sh
DIGIPOLY_DATA_DIR="$PWD/.live-data/self-hosted" npm run live
```

That override is supported for development runs only. The packaged app uses its normal DigiPoly Live application-data directory. Keep using the same development data directory if you want its OBS links to remain stable.

Once tested, build with `npm run live:package`. For a publicly distributed fork, choose its own app name, bundle identifier, custom URL scheme and cache location as part of release work; do not promise side-by-side installations of unmodified builds that share DigiPoly's identity and fixed port.

## 6. Verify the whole path

1. Open a private browser window at your hostname. Confirm Access asks for sign-in.
2. Sign in, open `/studio`, change a marker assignment and upload a small test image.
3. Choose **Save to cloud** and confirm the revision increases.
4. Open Live configured for this origin. Sign in with the same identity and download the cloud copy.
5. Load the environment, confirm both channel previews and the uploaded artwork, then connect the local OBS links.
6. Restart Live and check the cached environment still loads. Cloud edits should require another download and explicit load.
7. Confirm the bucket is still private and the deployed website contains no local configuration or reference images.

The API's automated tests cover separate-owner access, revision conflicts, incomplete uploads and token validation. Run `npm test` before publishing changes. A fresh deployment should still be exercised through its actual Access policy and desktop login.

## Storage and operational limits

Each verified identity has one workspace containing all its environments. The owner key depends on the Access issuer and subject; changing identity configuration may produce a different workspace. The preview has no admin migration UI.

The current limits are 12 environments, four channels each, 50 uploaded media items, 512 MB referenced files per workspace and 1 GB stored uploads per identity. Historical/unreferenced R2 uploads are retained; automatic cleanup is not implemented. There is no cloud backup/restore UI or account deletion workflow. Plan storage retention and backups before using this with important production data.

Do not expose the desktop port to your network. Cloud credentials belong in your deployment tooling; OBS receives only local channel links, not cloud credentials.
