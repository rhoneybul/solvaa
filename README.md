# Solvaa web

A mobile-friendly paddling map built with React, Vite and Leaflet. Discover launch areas and useful stops, plot each leg yourself, and save a day out or a multi-day trip. Production uses Supabase email/password authentication; Google login is unnecessary.

## Run locally

Requires Node 22 and npm.

```sh
npm run setup
npm run dev
```

Open http://127.0.0.1:5173. The API runs on port 3008. Local development works without cloud credentials; production always requires sign-in. `SOLVAA_API_PORT` changes both development server and proxy ports.

```sh
npm test
npm run build
NODE_ENV=production npm start
```

## Current experience

- Two-step onboarding: home town/approximate map area, experience, optional screenshot or typed session figures. The resulting profile sets estimated paddling pace and comfortable daily distance.
- Explore launch areas, food, camping and places to stay. Map points cite their source. Supplied launch areas are approximate; live places use Overpass/OpenStreetMap. If the provider fails, launch suggestions and Skye operator-directory links remain available.
- Plot by tapping the map, dragging points, or moving the map and adding its centre. Zoom controls never add points. A coordinate editor supports keyboard changes. Undo and individual-point removal are available.
- Add up to 14 days, each with its own points, stops and notes. Separate days never create artificial connecting lines. Every day needs at least two points before saving or exporting.
- Save, reopen, rename, edit and delete routes. The first save traces the actual route shape. Drafts save on-device; explicit saves synchronize to the account, with revision conflict protection.
- Import GPX, TCX or Strava activities.csv; add photographs and skill notes. Files stay on the device and photos are re-encoded to remove location metadata. FIT and direct Strava OAuth synchronization are not implemented.

## Route confidence and cost controls

A manually plotted GPX is valid XML, **not proof of a paddleable route**. Straight segments join chosen points and may cross land. Export explicitly states that no water/access/tide validation took place and requires the user to acknowledge this. Earlier generated outlines remain blocked from GPX export; saved outline notes are preserved. The legacy AI coordinate-generation endpoint is disabled. See [water-routing research](docs/water-routing-services.md).

Plotting, map discovery and manual onboarding make no AI calls. Optional screenshot reading sends a resized image to Anthropic only with explicit consent and a verified email. AI is off by default. When enabled, all paid endpoints share durable PostgreSQL limits: 3 calls/user/day, 10/user/month, a 60-second cooldown, 10/IP/day, 20/site/day and 100/site/month. Failed calls count; quota errors block paid calls. Output is capped at 768 tokens and paid calls do not retry automatically.

Account profiles and saved plans sync. Drafts, photos and imported activity records remain in account-separated IndexedDB on the device. Clearing browser data deletes local files. Export profile/session data for a portable copy; image files are not included. Conflicting account changes remain local until the user explicitly resolves them.

Town search is optional and disabled by default. Home can be pinned on a map or set from rounded device location. Do not enable public Nominatim on serverless Vercel: its application-wide request limit requires shared coordination that the local development geocoder does not provide.

## Deploy on Vercel + Supabase

Follow [the deployment guide](docs/deployment.md). `vercel.json` builds the Vite site and one Express API function. Add Supabase runtime variables, add its PostgreSQL `DATABASE_URL` for automatic startup migrations, configure authentication email/redirects, and keep AI disabled initially. No separate Railway or Render backend is required for this deployment.

The old live app was found at https://paddle-kayak.vercel.app. Its bundled Supabase reference is `kseznjbmxhpdogrhyjfb`; that hostname did not resolve during the September 28 check. Dashboard access is required to determine whether the project can be restored or must be replaced. No remote migration or environment-variable changes have been applied yet.

The API applies pending web migrations before serving requests, using a transaction lock and a private checksum ledger. Startup failures block the API; existing data and historical native-app migrations are preserved. The [deployment guide](docs/deployment.md#automatic-database-migrations) explains the connection URI, TLS and adding future migrations.

Leave `VITE_API_URL` empty for the single-origin deployment. `/api/config` returns public settings only. Server keys must never use `VITE_` or `EXPO_PUBLIC_` prefixes. The former Expo public Supabase variable names are accepted as migration aliases.

To verify startup migrations and durable quotas against isolated PostgreSQL:

```sh
npm run test:db
# Or use a local Docker context:
SOLVAA_TEST_DOCKER=desktop-linux npm run test:db
```

## Structure

- `web/src/App.jsx` — navigation, local workspace and account synchronization
- `web/src/components/MapPlanner.jsx`, `PlotMap.jsx` — map discovery and manual editing
- `web/src/lib/plotting.mjs` — manual route/day model, validation and GPX
- `web/src/components/Onboarding.jsx`, `Profile.jsx` — experience and personal evidence
- `web/src/lib/activities.mjs` — GPX/TCX/CSV normalization
- `api/index.js` — Vercel function entry point
- `server/src/routes/mapPoints.js` — sourced place discovery
- `server/src/routes/account.js`, `server/src/lib/ai.js` — authenticated storage and AI controls

The old Expo entry points and `src/` remain historical source outside the active build. Retained legacy APIs require authentication in production. The visual reference is [Slopes on Mobbin](https://mobbin.com/screens/0ddf1eea-3635-4650-bb1b-2c20aefe8460).
