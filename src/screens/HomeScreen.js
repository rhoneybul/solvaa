import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../theme';
import MapSketch from '../components/MapSketch';
import { getCurrentUser, signOut } from '../services/authService';
import {
  connectStrava, disconnectStrava, getStravaTokens, getStravaAthlete,
  handleStravaWebCallback, isStravaConfigured,
} from '../services/stravaService';

export default function HomeScreen({ navigation }) {
  const [name, setName]                   = useState(null);
  const [location, setLocation]           = useState(null);   // { label, coords }
  const [stravaAthlete, setStravaAthlete] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaError, setStravaError]     = useState(null);

  // Load display name from auth
  useEffect(() => {
    getCurrentUser().then(user => {
      const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name      ||
        user?.email?.split('@')[0]     || null;
      setName(displayName);
    });
  }, []);

  // Get GPS location + reverse-geocode to place name
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocation({ label: 'Location unavailable', coords: null });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude: lat, longitude: lon } = pos.coords;

        // Reverse geocode via Nominatim (free, no key)
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'User-Agent': 'PaddleApp/1.0' } },
          );
          const data = await res.json();
          const label =
            data.address?.city    ||
            data.address?.town    ||
            data.address?.village ||
            data.address?.county  ||
            'Your location';
          setLocation({ label, coords: { lat, lon } });
        } catch {
          setLocation({ label: 'Your location', coords: { lat, lon } });
        }
      } catch {
        setLocation({ label: 'Location unavailable', coords: null });
      }
    })();
  }, []);

  // Load Strava connection state
  const loadStrava = useCallback(async () => {
    const tokens = await getStravaTokens();
    if (tokens) {
      setStravaConnected(true);
      const athlete = await getStravaAthlete();
      setStravaAthlete(athlete);
    } else {
      setStravaConnected(false);
      setStravaAthlete(null);
    }
  }, []);

  useEffect(() => {
    loadStrava();

    // Web: handle Strava OAuth return (Strava appends ?code=&scope= to the redirect URL)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');
      const scope  = params.get('scope'); // scope is Strava-specific; Supabase doesn't send it
      if (code && scope) {
        window.history.replaceState({}, '', window.location.pathname); // clean URL
        setStravaLoading(true);
        handleStravaWebCallback(code)
          .then(athlete => {
            setStravaConnected(true);
            setStravaAthlete(athlete);
          })
          .catch(err => setStravaError(err.message))
          .finally(() => setStravaLoading(false));
      }
    }
  }, []);

  const handleConnectStrava = async () => {
    setStravaLoading(true);
    setStravaError(null);
    try {
      const athlete = await connectStrava();
      if (athlete) {
        // Mobile path: connectStrava() resolves with the athlete
        setStravaConnected(true);
        setStravaAthlete(athlete);
      }
      // Web path: connectStrava() redirects the page — nothing more to do here
    } catch (err) {
      setStravaError(err.message);
    } finally {
      if (Platform.OS !== 'web') setStravaLoading(false);
    }
  };

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    setStravaConnected(false);
    setStravaAthlete(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigation.replace('SignIn');
  };

  const firstName = name?.split(' ')[0] ?? null;

  // Coordinate label for map overlay
  const coordLabel = (() => {
    if (!location?.coords) return null;
    const { lat, lon } = location.coords;
    return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
  })();

  return (
    <View style={s.container}>

      {/* Map — position dot centred in the sketch (sketch map is not geo-referenced) */}
      <MapSketch
        height={300}
        myPos={{ x: 138, y: 155 }}
        overlayTitle={location ? location.label : 'Locating…'}
        overlayMeta={coordLabel}
      />

      <SafeAreaView style={s.sheet} edges={['bottom']}>

        {/* Header row */}
        <View style={s.header}>
          <Text style={s.welcome}>
            Welcome back{firstName ? `, ${firstName}` : ''}.
          </Text>
          <TouchableOpacity onPress={handleSignOut} hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}>
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Plan a paddle */}
        <TouchableOpacity
          style={s.planBtn}
          onPress={() => navigation.navigate('Planner')}
          activeOpacity={0.85}
        >
          <Text style={s.planBtnText}>Plan a paddle</Text>
          <Text style={s.planChev}>›</Text>
        </TouchableOpacity>

        {/* Strava row */}
        <View style={s.stravaRow}>
          <View style={s.stravaLeft}>
            <View style={[s.statusDot, { backgroundColor: stravaConnected ? colors.good : colors.border }]} />
            <View>
              <Text style={s.stravaLabel}>Strava</Text>
              {stravaConnected && stravaAthlete ? (
                <Text style={s.stravaSub}>
                  {stravaAthlete.firstname} {stravaAthlete.lastname} · connected
                </Text>
              ) : (
                <Text style={s.stravaSub}>
                  {isStravaConfigured() ? 'Not connected' : 'Credentials not set in .env'}
                </Text>
              )}
              {stravaError ? <Text style={s.stravaErr}>{stravaError}</Text> : null}
            </View>
          </View>

          {isStravaConfigured() && (
            stravaLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : stravaConnected ? (
              <TouchableOpacity onPress={handleDisconnectStrava} hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}>
                <Text style={s.stravaActionMuted}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleConnectStrava} hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}>
                <Text style={s.stravaActionOrange}>Connect</Text>
              </TouchableOpacity>
            )
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sheet:     { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 16,
  },
  welcome:     { fontSize: 20, fontWeight: '600', color: colors.text },
  signOutText: { fontSize: 12, fontWeight: '400', color: colors.textFaint },

  planBtn: {
    backgroundColor: colors.good,
    borderRadius: 11,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: colors.good,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  planBtnText: { fontSize: 15, fontWeight: '500', color: '#fff' },
  planChev:    { fontSize: 20, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },

  stravaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 13,
  },
  stravaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stravaLabel:      { fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 1 },
  stravaSub:        { fontSize: 11, fontWeight: '300', color: colors.textMuted },
  stravaErr:        { fontSize: 10, fontWeight: '300', color: colors.warn, marginTop: 2 },
  stravaActionOrange: { fontSize: 12.5, fontWeight: '500', color: '#fc4c02' },
  stravaActionMuted:  { fontSize: 12.5, fontWeight: '400', color: colors.textMuted },
});
