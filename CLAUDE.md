# Paddle — Kayak Trip Planner

## What this is
A cross-platform mobile app (iOS, Android, web) built with Expo / React Native. It helps kayakers plan trips, track paddles, and stay safe on the water.

## Design language
- **Font**: Inter only, weights 300/400/500/600. Never bold except headings (600).
- **Palette**: Light background `#f2f1ed`, white cards, functional colour only — `#3a6a4a` good, `#8a6a2a` caution, `#8a4a3a` warn/stop. No decorative colour.
- **Layout**: Map dominates the top half of main screens. Data sheet slides up from below. iOS-native table rows.
- **Icons**: Monochrome SVG line drawings at consistent stroke weight. No emoji in UI.
- **Reference screens**: See `/docs/screens.png` for the full visual design.

## Key screens
| Screen | File | Notes |
|--------|------|-------|
| Sign In | `SignInScreen.js` | Google + Apple auth, subtle map bg |
| Home | `HomeScreen.js` | Map + nearby paddler/vessel dots + plan entry |
| AI Planner | `PlannerScreen.js` | Natural language → Claude API → routes |
| Trip Setup | `TripSetupScreen.js` | Manual skill + trip type |
| Conditions | `WeatherScreen.js` | Layered: wind, swell, rain, tide, water temp |
| Routes | `RoutesScreen.js` | Map top, ranked route cards |
| Campsites | `CampsitesScreen.js` | RIDB + OpenStreetMap, brown dots on map |
| Tracking | `ActivePaddleScreen.js` | GPS, nearby boats, SOS button |
| Emergency | `EmergencyScreen.js` | SOS hero, auto-trigger toggles |
| History | `HistoryScreen.js` | Grouped by month, summary strip |

## Shared components
- `src/components/MapSketch.js` — reusable CSS/SVG map used across all screens
- `src/components/UI.js` — all primitives: MetricStrip, ConditionLayer, SOSButton, CampsiteCard, TabBar, Toggle, AlertBanner, ProgressBar, PrimaryButton etc.
- `src/components/WebWrapper.js` — centres app at 390px on desktop browsers
- `src/theme/index.js` — all colours, font weights, layout helpers

## Services
- `claudeService.js` — Claude API for AI trip planning (reads `EXPO_PUBLIC_CLAUDE_API_KEY`)
- `weatherService.js` — Open-Meteo API (free, no key) + AsyncStorage offline cache
- `routeService.js` — Kayaking knowledge engine (wind strategy, tides, skill gates)
- `stravaService.js` — OAuth + skill inference from activities
- `storageService.js` — AsyncStorage persistence for trips, history, paddle log

## APIs used
| Service | Key env var | Used for |
|---------|------------|---------|
| Claude (Anthropic) | `EXPO_PUBLIC_CLAUDE_API_KEY` | Natural language trip planning |
| Open-Meteo | none | Live weather + forecasts |
| OpenStreetMap Overpass | none | Campsites worldwide |
| Recreation.gov RIDB | `EXPO_PUBLIC_RIDB_API_KEY` | US campsite search |
| Strava | `EXPO_PUBLIC_STRAVA_CLIENT_ID` + `_SECRET` | Skill detection |

## Running locally
```bash
npm install
npx expo start          # phone via QR
npx expo start --web    # browser at localhost:8081
```

## Things still to build / improve
- Wire up real MapLibre or MapTiler map tiles to replace the CSS sketch maps
- Strava OAuth full flow (currently mocked)
- Real RIDB + Overpass API calls in CampsitesScreen (currently returns mock data)
- Tide API (WorldTides or NOAA) for accurate tide predictions
- Push notifications for wind changes during active paddle
- AIS / VHF data feed for real nearby vessel dots
- Paddle stroke rate detection via accelerometer
- Share / export trip summary as PDF

---

## Backend (server/)

Express API + Supabase (Postgres). Lives in `/server`.

### Stack
- **Express** — REST API at `localhost:3001`
- **Supabase** — Postgres + Auth + Row Level Security
- **Auth** — Supabase JWTs, verified in `server/src/middleware/auth.js`

### API routes
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | no | Health check |
| GET | /api/users/me | yes | Get/create profile |
| PATCH | /api/users/me | yes | Update profile |
| GET | /api/trips | yes | List user's trips |
| POST | /api/trips | yes | Save a planned trip |
| PATCH | /api/trips/:id | yes | Update trip status |
| DELETE | /api/trips/:id | yes | Delete trip |
| GET | /api/paddles | yes | Paddle history |
| GET | /api/paddles/stats | yes | Aggregate stats |
| POST | /api/paddles | yes | Save completed paddle |
| GET | /api/campsites?lat&lon&radius | no | RIDB + OSM campsites |
| GET | /api/weather?lat&lon | no | Open-Meteo proxy (30m cache) |

### App API client
`src/services/api.js` — use this in screens:
```js
import api from '../services/api';
const trips = await api.trips.list();
await api.paddles.create({ distance_km: 7.2, duration_seconds: 5040, ... });
```

### Database tables
- `profiles` — one per user, skill level, preferences
- `trips` — planned trips with route_data + weather_snapshot JSON
- `paddles` — completed sessions with GPS track + weather log
- `sos_events` — safety audit trail
- `saved_routes` — bookmarked routes

### Running locally
```bash
cd server && cp .env.example .env   # fill in Supabase keys
cd server && npm install && npm run dev
```

### Deploy (free)
- **Railway**: push to GitHub → connect repo → set env vars → deploy
- **Render**: push to GitHub → New Web Service → connect repo → set env vars

ENV vars needed on the server: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

---

## Running everything together

```bash
npm run setup        # installs all deps + creates .env files
npm run dev          # starts server (port 3001) + expo (port 8081) together
npm run dev:web      # expo web only
npm run dev:server   # server only
```

## Auth flow (app side)
- `src/services/authService.js` — Supabase auth client
- Sign in → get JWT → stored in AsyncStorage
- `src/services/api.js` — reads JWT and attaches as `Authorization: Bearer ...` to every request
- Server `middleware/auth.js` — verifies JWT via Supabase

## Data flow (local-first)
1. All writes → AsyncStorage immediately (works offline)
2. Background sync → POST/PATCH to API server
3. Reads → try API first, fall back to AsyncStorage cache
- Active GPS log writes only to local storage (too frequent for server)
- On paddle finish → bulk upload GPS track + stats to server

## State to add next
- `src/context/AuthContext.js` — React context wrapping authService for screens
- Profile screen — show/edit skill level, home location
- Settings screen — units, notifications, emergency contacts
