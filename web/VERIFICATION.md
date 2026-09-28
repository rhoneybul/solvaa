# Web application verification

Verified locally on 28 September 2026 with Node 22 and the Codex in-app browser.

## Automated checks

- `npm test`: 30 passing tests covering planning, multi-day dates/overnights, explicit control overrides, imported activity formats, photo selection, home-based recommendations, experience assessment, cloud conflict reconciliation, GPX export gates, account payload validation, AI authorization and failure handling.
- `SOLVAA_TEST_DOCKER=desktop-linux npm run test:db`: passes against an isolated PostgreSQL 16 container. Applies migration 003 to a minimal Auth schema; tests concurrent global reservations, same-user cooldown, user/IP/global day/month limits, persistence through database restart, role restrictions and stale workspace revisions. The temporary database/container is removed after the test. The host PostgreSQL 14 installation could not run because its ICU library is missing; the Docker run is the successful integration result.
- `npm run build`: production build succeeds. Express serves the compiled page and `/health`.
- `git diff --check`: passes.
- The earlier dependency audits reported zero vulnerabilities in root and server dependencies; adding Supabase to the frontend also completed without reported vulnerabilities.

## Browser checks

- Mobile setup at 360–390 px: choose an approximate home area, enter activity figures and experience answers, review/edit the suggested level and complete setup. The profile persists after navigation/reload.
- Completion shows appropriate nearby outlines before the search composer on phones. Unsupported homes are covered by the recommendation tests: no distant route is labelled nearby.
- Screenshot upload shows a resized local preview and manual-entry fallback while AI is disabled. No screenshot was sent to Anthropic during verification. Skipping the reopened flow did not persist the temporary upload.
- Mobile account access remains visible in the four-destination navigation; missing cloud configuration is explained and guest continuation works.
- Four-day Skye planning works with an 8 km/day beginner profile, with four dated tabs and separate outings, stays, food and camping. A more restrictive 6 km/day profile correctly offers only three matching outings instead of inventing a fourth.
- Unvalidated single-day and multi-day GPX exports are disabled in UI and rejected by the export function. Mobile search opens its results at the top of the page; document width equals the 390 px viewport.
- Existing desktop map/itinerary layout remains intact at 1440×1000. Phone controls and setup fields use touch-friendly sizes; browser viewport overrides were reset after testing.
- The earlier web-conversion checks covered plan save/reload, changing daily routes and stops, GPX/TCX/Strava CSV imports, deduplication and photo notes. This turn's generated test session was removed and test name cleared. No test trip or screenshot was saved.

## External setup and limits

Supabase is not configured locally. Real signup email, confirmation, password recovery, live account switching and two-device sync still need verification after the operator creates a project, applies migrations 001–003 and configures SMTP/redirects. Tests do not claim these external flows ran. AI provider response handling is tested with controlled responses; no paid live AI call was made.

Town search is deliberately disabled until a provider is selected/configured. Approximate browser location and bundled area choices are available; actual device location permission was not requested during tests. Public Nominatim use requires the operator's informed choice and compliance with its usage policy.

Routes are authored outlines in four regions. No water-routing service is connected, and none of these outlines is certified for navigation. The four-day example uses road transfers, not a continuous expedition. See the routing research for provider options and the full-segment validation requirement.

Earlier live Wikimedia/Open-Meteo requests succeeded; in the final session, weather and Overpass requests returned unavailable states, correctly shown in UI. Linked Skye operator-directory suggestions remain usable. No availability, access or booking claim is made.

These checks cover one browser engine and viewport simulation, not a physical-device keyboard, full accessibility or cross-browser certification. No public deployment was performed. See `docs/deployment.md` for the remaining external setup.

## September 28 — map-first manual planning refinement

- `npm test`: 36 passing tests including exact manual coordinates, malformed input, four separate GPX day tracks, no transfer distances, local-only drafts, POI source/private-access filtering and mandatory production API authentication.
- `npm run build`: passes. The main client chunk is approximately 424 KB / 132 KB gzip; removed the React server renderer from map-icon generation.
- Browser walkthrough at 1440px and 390px: launch selection, map clicks, zoom without accidental points, empty second-day validation, adding a second-day line, first save, saved-list reload/reopen, two-step home/experience onboarding and returning to the map. No captured browser console errors.
- Map entry and viewport resize fit the complete plotted route. Discovery hides draft geometry and labels suggested launch markers. Free panning and point edits do not recenter the map.
- Impeccable finish reviewer cleared all six material fixes. Documentation regenerated from current source; built blue token verified by DOM (`rgb(36, 101, 216)`).
- Hosted Supabase sign-in/signup/recovery and account sync remain unverified: Vercel and Supabase dashboards require user login, and the previous bundled Supabase project hostname does not resolve. No remote migration was applied.
- Public Overpass returned 406/504/timeouts. UI errors and retry work; existing launch suggestions and unpinned operator-directory links remain. No invented POI coordinates or navigability claims.

- Published draft PR #10 on `codex/web-map-planner`; Vercel reports a Ready preview. Existing Vercel account protection redirects preview/API access to sign-in, so remote runtime smoke tests are blocked until dashboard access. GitHub Web checks passed.
