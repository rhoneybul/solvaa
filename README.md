# 🛶 Paddle — Kayak Trip Planner

A cross-platform mobile app (iOS, Android, and desktop browser) built with Expo / React Native.

---

## Quick Start

### Requirements
- Node.js 18+ (https://nodejs.org)
- npm 9+
- Expo Go app on your phone (App Store / Play Store)

### 1. Unzip and install

```bash
cd ~/Downloads
unzip paddle-kayak-app.zip -d paddle
cd paddle
npm install
```

### 2. Add your Claude API key

```bash
cp .env.example .env
```

Open `.env` and paste your key:
```
EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-your-key-here
```

Get a free key at **console.anthropic.com** → API Keys → Create Key.

### 3. Run

**On your phone** (Expo Go app must be installed):
```bash
npx expo start
```
Scan the QR code with your phone camera (iOS) or the Expo Go app (Android).
Your phone and laptop must be on the same WiFi network.

**In your desktop browser:**
```bash
npx expo start --web
```
Opens at http://localhost:8081 — the app appears as a phone-width column centred on the page.

**iOS Simulator** (Mac + Xcode required):
```bash
npx expo start --ios
```

**Android Emulator** (Android Studio required):
```bash
npx expo start --android
```

---

## Screens

| Screen | How to reach it |
|--------|----------------|
| Sign In | App opens here |
| Home | After signing in — map + plan entry |
| Plan a Paddle (AI) | Home → "Ask AI to plan a paddle" |
| Trip Setup (manual) | Home → "Plan manually" |
| Conditions | After trip setup |
| Routes | After conditions |
| Campsites | Routes → "View campsites" (multi-day trips) |
| Live Tracking | Routes → Start Paddle |
| Emergency / SOS | Tracking → SOS button |
| History | Home → Past Trips |

---

## Optional API Keys

All optional — the app works without them but with reduced functionality.

### Strava (auto-detect skill level)

1. Go to https://www.strava.com/settings/api
2. Create an app — set **Authorization Callback Domain** to `localhost`
3. Add to `.env`:
```
EXPO_PUBLIC_STRAVA_CLIENT_ID=your_id
EXPO_PUBLIC_STRAVA_CLIENT_SECRET=your_secret
```
4. Install OAuth packages:
```bash
npx expo install expo-web-browser expo-auth-session expo-crypto
```

### Recreation.gov / RIDB (US campsite search)

1. Sign up at https://ridb.recreation.gov
2. Request an API key
3. Add to `.env`:
```
EXPO_PUBLIC_RIDB_API_KEY=your_key
```

International campsites use OpenStreetMap Overpass — no key needed.

---

## Build for distribution

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # free APK
eas build --platform ios --profile preview       # needs Apple Developer ($99/yr)
```

---

## Troubleshooting

**Phone can't connect / QR code doesn't work**
→ Make sure phone and laptop are on the same WiFi. Try pressing `e` to send a link by email instead.

**"Unable to resolve module"**
→ Run `npm install` again, then `npx expo start --clear`

**Web build fails**
→ Run `npm install react-native-web@~0.20.0 --legacy-peer-deps` then try again

**Claude API not responding**
→ Check `.env` has the `EXPO_PUBLIC_` prefix. Restart the server after editing `.env`.

**Location not working on iPhone**
→ Settings → Privacy & Security → Location Services → Expo Go → While Using

---

## Project structure

```
paddle/
├── App.js                           # Navigation + web wrapper
├── app.json                         # Expo config + permissions
├── .env                             # Your API keys (create this)
├── .env.example                     # Template
├── src/
│   ├── screens/
│   │   ├── SignInScreen.js          # Google + Apple auth
│   │   ├── HomeScreen.js            # Map + plan entry + nearby dots
│   │   ├── PlannerScreen.js         # AI natural language planner
│   │   ├── TripSetupScreen.js       # Manual skill + trip type
│   │   ├── WeatherScreen.js         # Layered conditions (wind/swell/rain/tide/temp)
│   │   ├── RoutesScreen.js          # Map + ranked route options
│   │   ├── CampsitesScreen.js       # RIDB + OSM campsite finder
│   │   ├── ActivePaddleScreen.js    # GPS tracking + nearby boats + SOS
│   │   ├── EmergencyScreen.js       # SOS + auto-trigger settings
│   │   └── HistoryScreen.js         # Past trips log
│   ├── components/
│   │   ├── MapSketch.js             # Reusable map component
│   │   ├── UI.js                    # Shared primitives (cards, buttons, etc.)
│   │   └── WebWrapper.js            # Desktop browser layout
│   ├── services/
│   │   ├── claudeService.js         # Claude API — AI trip planning
│   │   ├── weatherService.js        # Open-Meteo API + offline cache
│   │   ├── routeService.js          # Kayaking knowledge engine
│   │   ├── stravaService.js         # OAuth + skill inference
│   │   └── storageService.js        # AsyncStorage persistence
│   └── theme/
│       └── index.js                 # Colours, font weights, layout helpers
```

---

## What the AI planner understands

Type anything natural, for example:

- *"I'm in Axminster and want to go for a day paddle tomorrow for about 2 hours"*
- *"I'm in London with a car — where can I go for a day paddle?"*
- *"Planning a weekend trip, want to kayak and camp. Based in Bristol"*
- *"I want to plan a week-long kayak expedition from the Scottish Highlands"*
- *"I'm near Sydney, complete beginner, want a gentle 2-hour paddle"*

Claude returns: real place names, specific launch points, travel times, tide/wind advice, difficulty, packing list, campsite suggestions for multi-day trips, and safety notes.

