import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import MapSketch from '../components/MapSketch';
import { SheetHandle, SectionHeader, AlertBanner, PrimaryButton } from '../components/UI';
import { generateRoutes } from '../services/routeService';
import { saveActiveTrip } from '../services/storageService';

export default function RoutesScreen({ navigation, route }) {
  const { tripType, skillLevel, weather, location } = route?.params || {};
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const r = generateRoutes({ tripType, skillLevel, weather: weather || { current: { windSpeed: 12, waveHeight: 0.4, condition: { label: 'Partly Cloudy', severity: 'none' }, windDirLabel: 'WSW', temp: 14, precipitation: 0, weatherCode: 1 }, hourly: [], daily: [], safetyScore: 78, safetyLabel: 'Good', safetyColor: colors.good, weatherWindow: { label: 'Best: 8:00 AM', color: colors.good } }, location, durationDays: tripType?.days || 1 });
    setRoutes(r);
  }, []);

  const sel = routes[selected] || {};
  const isMultiDay = (tripType?.days || 1) > 1;

  const handleStart = async () => {
    const trip = { id: `trip_${Date.now()}`, tripType, skillLevel, weather, location, route: sel, startedAt: Date.now(), status: 'active', log: [] };
    await saveActiveTrip(trip);
    navigation.navigate('ActivePaddle', { trip });
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
          <Text style={s.navTitle}>Routes</Text>
          <Text style={s.navRight}>{routes.length} options</Text>
        </View>

        <MapSketch
          height={222}
          routes={[
            { type: 'solid', d: 'M89 180 C89 143,71 114,97 85 C120 60,156 52,172 66 C187 80,181 108,168 127' },
            { type: 'dashed', d: 'M89 180 C101 155,126 143,140 151 C153 158,151 173,143 180', color: colors.mapRouteAlt },
          ]}
          waypoints={[
            { x: 89, y: 180, type: 'start' },
            { x: 168, y: 127, type: 'end' },
            ...(isMultiDay ? [{ x: 132, y: 96, type: 'camp' }, { x: 152, y: 108, type: 'camp', faded: true }] : []),
          ]}
          showLegend={{
            routes: [
              { label: 'Coastal Out & Back', color: colors.mapRoute },
              { label: 'Lake Circuit', color: colors.mapRouteAlt, faint: true },
            ],
            ...(isMultiDay ? { campsites: 'Campsites' } : {}),
          }}
        />

        <ScrollView style={s.sheet} showsVerticalScrollIndicator={false}>
          <SheetHandle />

          {routes.map((r, i) => (
            <TouchableOpacity key={r.id} style={[s.routeCard, selected === i && s.routeCardSel]} onPress={() => setSelected(i)} activeOpacity={0.8}>
              <View style={s.routeHeader}>
                <View style={[s.rankBadge, { backgroundColor: i === 0 ? colors.goodLight : colors.blueLight }]}>
                  <Text style={[s.rankText, { color: i === 0 ? colors.good : colors.blue }]}>{i + 1}</Text>
                </View>
                <Text style={s.routeName}>{r.name}</Text>
                <View style={[s.diffBadge, { backgroundColor: r.difficulty.color + '20' }]}>
                  <Text style={[s.diffText, { color: r.difficulty.color }]}>{r.difficulty.label}</Text>
                </View>
              </View>
              <View style={s.routeStats}>
                {[['Distance', `${r.distanceKm} km`], ['Time', `~${r.durationHours}h`], ['Match', `${r.suitability}%`]].map(([l, v]) => (
                  <View key={l} style={s.routeStat}>
                    <Text style={s.routeStatL}>{l}</Text>
                    <Text style={s.routeStatV}>{v}</Text>
                  </View>
                ))}
              </View>
              {selected === i && (
                <View style={s.routeDetail}>
                  <Text style={s.routeWhy}>{r.tips[0]}</Text>
                  {r.template?.terrain === 'sea' && <Text style={s.routeTip}>{r.tideConsideration?.advice}</Text>}
                </View>
              )}
            </TouchableOpacity>
          ))}

          {isMultiDay && routes.length > 0 && (
            <>
              <SectionHeader>Campsites</SectionHeader>
              <TouchableOpacity style={s.campsiteLink} onPress={() => navigation.navigate('Campsites', { route: sel, location })}>
                <Text style={s.campsiteLinkText}>View campsites along this route →</Text>
              </TouchableOpacity>
            </>
          )}

          <PrimaryButton label="Start Paddle →" onPress={handleStart} style={{ marginTop: 8 }} />
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
  navRight: { fontSize: 10.5, fontWeight: '300', color: colors.textMuted },
  sheet: { flex: 1 },
  routeCard: { marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 9, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.07, shadowRadius: 2, elevation: 1 },
  routeCardSel: { borderWidth: 1.5, borderColor: colors.text },
  routeHeader: { flexDirection: 'row', alignItems: 'center', padding: 11, gap: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0ede8' },
  rankBadge: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankText: { fontSize: 9, fontWeight: '600' },
  routeName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  diffBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  diffText: { fontSize: 9.5, fontWeight: '500' },
  routeStats: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0ede8' },
  routeStat: { flex: 1, padding: 9, borderRightWidth: 0.5, borderRightColor: '#f0ede8' },
  routeStatL: { fontSize: 7.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 },
  routeStatV: { fontSize: 14, fontWeight: '500', color: colors.text },
  routeDetail: { padding: 11 },
  routeWhy: { fontSize: 11.5, color: colors.textMid, lineHeight: 18, fontWeight: '300', marginBottom: 4 },
  routeTip: { fontSize: 10.5, color: colors.caution, fontWeight: '300', lineHeight: 16 },
  campsiteLink: { marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 9, padding: 12, borderWidth: 1, borderColor: colors.borderLight },
  campsiteLinkText: { fontSize: 13, fontWeight: '400', color: colors.blue },
});
