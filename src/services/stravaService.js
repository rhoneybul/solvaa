import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const CLIENT_ID     = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET || '';

const TOKENS_KEY  = 'STRAVA_TOKENS';
const ATHLETE_KEY = 'STRAVA_ATHLETE';

const MOBILE_REDIRECT = 'paddle://auth/strava';
// Web redirect must also be registered in your Strava API settings at
// https://www.strava.com/settings/api → Authorization Callback Domain
const WEB_REDIRECT = typeof window !== 'undefined' ? window.location.origin : '';

const REDIRECT_URI = Platform.OS === 'web' ? WEB_REDIRECT : MOBILE_REDIRECT;
const SCOPE = 'read,activity:read';

// ── Public helpers ─────────────────────────────────────────────────────────────

export function isStravaConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export async function getStravaTokens() {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function disconnectStrava() {
  await AsyncStorage.multiRemove([TOKENS_KEY, ATHLETE_KEY]);
}

// ── OAuth flow ─────────────────────────────────────────────────────────────────

function buildAuthURL() {
  const params = new URLSearchParams({
    client_id:        CLIENT_ID,
    response_type:    'code',
    redirect_uri:     REDIRECT_URI,
    approval_prompt:  'auto',
    scope:            SCOPE,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed: ${text}`);
  }
  return res.json();
}

async function saveTokenData(data) {
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
  }));
  if (data.athlete) {
    await AsyncStorage.setItem(ATHLETE_KEY, JSON.stringify(data.athlete));
  }
  return data.athlete ?? null;
}

/**
 * Mobile + web entry point.
 * Mobile:  opens an in-app browser, waits for the deep-link callback, exchanges the code.
 * Web:     redirects the page to Strava; call handleStravaWebCallback() on return.
 */
export async function connectStrava() {
  if (!isStravaConfigured()) throw new Error('Strava client credentials not set in .env');

  const authURL = buildAuthURL();

  if (Platform.OS !== 'web') {
    const result = await WebBrowser.openAuthSessionAsync(authURL, MOBILE_REDIRECT);
    if (result.type !== 'success') throw new Error('Strava auth was cancelled');

    const params = new URLSearchParams(result.url.split('?')[1] || '');
    const code   = params.get('code');
    if (!code) throw new Error('No code returned from Strava');

    const data = await exchangeCode(code);
    return saveTokenData(data);
  } else {
    // Web: full-page redirect to Strava; HomeScreen handles the return via handleStravaWebCallback
    window.location.href = authURL;
    return null; // page will reload
  }
}

/**
 * Call this on web when the page loads and window.location has ?code=&scope= params.
 * Returns the athlete object.
 */
export async function handleStravaWebCallback(code) {
  const data = await exchangeCode(code);
  return saveTokenData(data);
}

// ── Token management ───────────────────────────────────────────────────────────

async function refreshTokens(refreshToken) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Strava token refresh failed');
  return res.json();
}

export async function getValidAccessToken() {
  const tokens = await getStravaTokens();
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at > now + 60) return tokens.access_token;

  const refreshed = await refreshTokens(tokens.refresh_token);
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify({
    access_token:  refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at:    refreshed.expires_at,
  }));
  return refreshed.access_token;
}

// ── Strava API calls ───────────────────────────────────────────────────────────

export async function getStravaAthlete() {
  try {
    // Return cached athlete first, then refresh in background
    const cached = await AsyncStorage.getItem(ATHLETE_KEY);
    if (cached) return JSON.parse(cached);

    const token = await getValidAccessToken();
    if (!token) return null;

    const res = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const athlete = await res.json();
    await AsyncStorage.setItem(ATHLETE_KEY, JSON.stringify(athlete));
    return athlete;
  } catch { return null; }
}

export async function fetchStravaActivities(perPage = 30) {
  const token = await getValidAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── Skill inference (unchanged) ────────────────────────────────────────────────

export const SKILL_LEVELS = {
  BEGINNER: {
    key: 'beginner', label: 'Beginner',
    description: 'New to kayaking, calm water only',
    maxWindKnots: 10, maxWaveM: 0.3, maxDistKm: 8,
    preferredRouteTypes: ['flat_water', 'sheltered_bay'],
  },
  INTERMEDIATE: {
    key: 'intermediate', label: 'Intermediate',
    description: 'Comfortable in moderate conditions',
    maxWindKnots: 18, maxWaveM: 0.8, maxDistKm: 20,
    preferredRouteTypes: ['coastal', 'river', 'lake_crossing'],
  },
  ADVANCED: {
    key: 'advanced', label: 'Advanced',
    description: 'Experienced in challenging conditions',
    maxWindKnots: 25, maxWaveM: 1.5, maxDistKm: 40,
    preferredRouteTypes: ['open_water', 'coastal', 'sea_kayak'],
  },
  EXPERT: {
    key: 'expert', label: 'Expert',
    description: 'Elite paddler, all conditions',
    maxWindKnots: 35, maxWaveM: 3, maxDistKm: 80,
    preferredRouteTypes: ['open_water', 'expedition', 'surf_zone'],
  },
};

export function inferSkillFromStrava(activities) {
  const paddling = activities.filter(a =>
    ['Kayaking', 'Canoeing', 'Rowing', 'StandUpPaddling', 'Surfing'].includes(a.type)
  );
  if (paddling.length === 0) return SKILL_LEVELS.BEGINNER;

  const totalKm  = paddling.reduce((s, a) => s + a.distance / 1000, 0);
  const avgDistKm = totalKm / paddling.length;
  const longestKm = Math.max(...paddling.map(a => a.distance / 1000));

  let score = 0;
  if (paddling.length >= 50) score += 3;
  else if (paddling.length >= 20) score += 2;
  else if (paddling.length >= 5)  score += 1;

  if (longestKm >= 40) score += 3;
  else if (longestKm >= 20) score += 2;
  else if (longestKm >= 10) score += 1;

  if (avgDistKm >= 20) score += 2;
  else if (avgDistKm >= 10) score += 1;

  if (score >= 7) return SKILL_LEVELS.EXPERT;
  if (score >= 4) return SKILL_LEVELS.ADVANCED;
  if (score >= 2) return SKILL_LEVELS.INTERMEDIATE;
  return SKILL_LEVELS.BEGINNER;
}
