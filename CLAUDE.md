# Solvaa web

The active product is a responsive paddling-planning website in `web/src`, built with React, Vite and Leaflet. Root scripts build and serve this website. The old Expo `App.js` and `src/` are historical source, outside the active build.

## Working on the website

- Read `PRODUCT.md` for product scope and `README.md` for run/deployment instructions and data handling.
- For UI work, read `DESIGN.md`; its tokens and `.impeccable/design.json` describe the implemented Slopes-inspired web interface. Use Inter, consistent SVG line icons, functional color and responsive map/planning sheets.
- Production requires Supabase email/password auth without Google. Only local development may preview without credentials. Account-separated browser data lives in IndexedDB.
- Map discovery and manual plotting are the active workflow. Use `web/src/lib/plotting.mjs` for day models, validation and manual GPX. Every day is a separate track; never insert inferred water geometry. Clearly label manual exports unvalidated, and retain the older catalog-export validation gate.
- Keep provenance for approximate launch suggestions and mapped places. Never manufacture coordinates for operator directory links or treat effort estimates as marine-safety claims.
- Keep imported activities and profile photographs local. Technical skills are self-assessed; distance and photos cannot certify them. Import normalisation lives in `web/src/lib/activities.mjs`.
- Select route photos geographically through `server/src/lib/routePhotos.js`, retaining photographer, licence and source links. Show provider failures honestly.

## Server and validation

Vercel runs the Express server through `api/index.js`; all application API routes require authentication in production. Only health and public configuration remain unauthenticated. Express can also serve `dist/` when run as a standalone server. The website uses JWT-protected `/api/account/workspace` for profile/trip synchronization when Supabase is configured; guest/account IndexedDB namespaces are separate. Optional screenshot reading requires explicit consent and verified email. Every paid AI route must reserve the shared durable SQL quota before calling the provider and fail closed on quota errors. Keep privileged credentials server-side; `/api/config` exposes only public settings. See `docs/deployment.md` for configuration.

Use the root package scripts for setup, development, tests and production builds. `npm run test:db` exercises the quota migration against isolated PostgreSQL; `SOLVAA_TEST_DOCKER` selects a local Docker context instead of host binaries. `web/VERIFICATION.md` records the conversion's automated and browser checks; it is historical evidence, not a substitute for validating new changes.
