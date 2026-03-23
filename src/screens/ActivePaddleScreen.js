import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../theme';
import MapSketch from '../components/MapSketch';
import { SheetHandle, MetricStrip, ProgressBar, AlertBanner, SOSButton, StopButton, SectionHeader } from '../components/UI';
import { getActiveTrip, clearActiveTrip, saveToHistory, addPaddleLogEntry } from '../services/storageService';
import { getWeatherWithCache } from '../services/weatherService';

const pad = n => (n < 10 ? `0${n}` : `${n}`);
const fmt = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`; };

export default function ActivePaddleScreen({ navigation, route }) {
  const [trip, setTrip] = useState(route?.params?.trip || null);
  const [elapsed, setElapsed] = useState(0);
  const [distKm, setDistKm] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [weather, setWeather] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [positions, setPositions] = useState([]);
  const timerRef = useRef(null);
  const locRef = useRef(null);

  useEffect(() => {
    if (!trip) getActiveTrip().then(t => t && setTrip(t));
    return () => { clearInterval(timerRef.current); locRef.current?.remove(); };
  }, []);

  const start = async () => {
    setIsTracking(true);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      locRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10 },
        loc => {
          const pos = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          setSpeed(loc.coords.speed ? +(loc.coords.speed * 1.944).toFixed(1) : 0);
          setPositions(prev => {
            const next = [...prev, pos];
            if (next.length > 1) setDistKm(calcDist(next));
            return next;
          });
          addPaddleLogEntry(pos);
          // Refresh weather
          getWeatherWithCache(pos.lat, pos.lon)
            .then(w => { setWeather(w); setIsOffline(!!w.fromCache); })
            .catch(() => setIsOffline(true));
        }
      );
    }
  };

  const finish = () => {
    Alert.alert('Finish Paddle?', `You've paddled ${distKm.toFixed(1)} km in ${fmt(elapsed)}.`, [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: async () => {
        clearInterval(timerRef.current);
        locRef.current?.remove();
        if (trip) { await saveToHistory({ ...trip, distancePaddled: distKm, durationSeconds: elapsed, positions, completedAt: Date.now() }); await clearActiveTrip(); }
        navigation.navigate('Home');
      }},
    ]);
  };

  const handleSOS = () => {
    navigation.navigate('Emergency');
  };

  const calcDist = pts => {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      const R = 6371, dLat = (pts[i].lat - pts[i-1].lat) * Math.PI/180, dLon = (pts[i].lon - pts[i-1].lon) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(pts[i-1].lat * Math.PI/180) * Math.cos(pts[i].lat * Math.PI/180) * Math.sin(dLon/2)**2;
      d += R * 2 * Math.asin(Math.sqrt(a));
    }
    return d;
  };

  const pct = trip?.route?.distanceKm ? Math.min(100, (distKm / trip.route.distanceKm) * 100) : 0;
  const currentWeather = weather?.current || trip?.weather?.current;
  const windHigh = currentWeather && currentWeather.windSpeed > 14;
  const nearbyPaddlers = 3, nearbyVessels = 2;

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
          <Text style={s.navTitle}>{isTracking ? '● Tracking' : 'Ready'}</Text>
          {isOffline && <Text style={s.offline}>Offline</Text>}
        </View>

        <MapSketch
          height={285}
          routes={[
            { type: 'faint', d: 'M94 232 C94 185,75 144,104 108 C130 74,167 63,184 79 C200 95,193 128,179 149' },
            { type: 'solid', d: 'M94 232 C94 202,86 183,88 165 C90 149,97 137,108 126' },
          ]}
          waypoints={[
            { x: 94, y: 232, type: 'start' },
            { x: 179, y: 149, type: 'end' },
            { x: 132, y: 152, type: 'paddler' },
            { x: 88, y: 170, type: 'paddler' },
            { x: 145, y: 188, type: 'paddler' },
            { x: 160, y: 110, type: 'vessel' },
            { x: 70, y: 140, type: 'vessel' },
          ]}
          myPos={{ x: 108, y: 124 }}
          windChip={currentWeather ? { main: `Wind ${currentWeather.windSpeed} kts — ${windHigh ? 'building' : 'steady'}`, sub: windHigh ? `Limit at 18 kts` : 'Good conditions' } : null}
          etaChip={{ value: '52', label: 'min ETA' }}
          showLegend={{ paddlers: `Paddlers (${nearbyPaddlers})`, vessels: `Vessels (${nearbyVessels})` }}
        />

        <ScrollView style={s.sheet} showsVerticalScrollIndicator={false}>
          <SheetHandle />

          {/* Stats */}
          <View style={s.statsCard}>
            <View style={s.statsRow}>
              {[
                [fmt(elapsed), 'TIME'],
                [distKm.toFixed(2), 'KM'],
                [String(speed), 'KNOTS'],
              ].map(([v, l], i) => (
                <React.Fragment key={l}>
                  <View style={s.statCell}>
                    <Text style={s.statValue}>{v}</Text>
                    <Text style={s.statLabel}>{l}</Text>
                  </View>
                  {i < 2 && <View style={s.statDivider} />}
                </React.Fragment>
              ))}
            </View>
            {trip?.route && (
              <ProgressBar
                startLabel={trip.route.waypoints?.[0]?.name || 'Launch'}
                endLabel={trip.route.waypoints?.[trip.route.waypoints.length - 1]?.name || 'Finish'}
                pct={pct}
                color={colors.blue}
              />
            )}
          </View>

          {windHigh && <AlertBanner title="Wind building" body={`${currentWeather.windSpeed} kts — approaching your 18 kt limit. Consider heading back early.`} type="caution" />}

          {/* Live conditions */}
          {currentWeather && (
            <>
              <SectionHeader>Live conditions {isOffline ? '· cached' : ''}</SectionHeader>
              <MetricStrip cells={[
                { label: 'Wind', value: `${currentWeather.windSpeed}`, sub: 'kts', color: windHigh ? colors.caution : colors.good },
                { label: 'Swell', value: `${(currentWeather.waveHeight || 0.5).toFixed(1)}`, sub: 'm' },
                { label: 'Score', value: String(weather?.safetyScore || '—'), sub: '/ 100', color: windHigh ? colors.caution : colors.good },
                { label: 'Nearby', value: `${nearbyPaddlers}+${nearbyVessels}`, sub: 'pad·vessel', color: colors.blue },
              ]} />
            </>
          )}

          {!isTracking ? (
            <TouchableOpacity style={s.startBtn} onPress={start} activeOpacity={0.85}>
              <Text style={s.startBtnText}>▶  Start Tracking</Text>
            </TouchableOpacity>
          ) : (
            <>
              <SOSButton onPress={handleSOS} />
              <StopButton onPress={finish} />
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: colors.good },
  navTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginLeft: 4 },
  offline: { fontSize: 10.5, fontWeight: '300', color: colors.textMuted },
  sheet: { flex: 1 },
  statsCard: { marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 9, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.07, shadowRadius: 2, elevation: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', padding: 12, justifyContent: 'space-around' },
  statCell: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: '400', color: colors.text, lineHeight: 26 },
  statLabel: { fontSize: 8, fontWeight: '400', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 0.5, height: 36, backgroundColor: colors.borderLight },
  startBtn: { marginHorizontal: 12, marginBottom: 9, backgroundColor: colors.text, borderRadius: 9, padding: 14, alignItems: 'center' },
  startBtnText: { fontSize: 14, fontWeight: '500', color: colors.bg },
});
