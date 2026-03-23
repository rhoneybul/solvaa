import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import MapSketch from '../components/MapSketch';
import { SheetHandle, SectionHeader, CampsiteCard } from '../components/UI';
import api from '../services/api';

export default function CampsitesScreen({ navigation, route }) {
  const params = route?.params || {};
  const [campsites, setCampsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const lat = params.location?.lat || 51.5;
      const lon = params.location?.lon || -0.1;
      const data = await api.campsites.search(lat, lon, 30);
      setCampsites(data);
    } catch (e) {
      setError('Could not load campsites. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>Campsites</Text>
          <Text style={s.navRight}>Day {params.day || 1} of {params.days || 2}</Text>
        </View>

        <MapSketch
          height={230}
          routes={[
            { type: 'solid', d: 'M82 195 C82 165,66 135,72 105 C78 78,95 62,112 58' },
            { type: 'dashed', d: 'M112 58 C130 52,152 60,160 80 C168 100,158 125,148 142' },
          ]}
          waypoints={[
            { x: 82,  y: 195, type: 'start' },
            { x: 148, y: 142, type: 'end' },
            { x: 112, y: 58,  type: 'camp' },
            { x: 96,  y: 80,  type: 'camp', faded: true },
            { x: 130, y: 68,  type: 'camp', faded: true },
          ]}
          myPos={{ x: 88, y: 178 }}
          showLegend={{
            routes: [
              { label: 'Day 1', color: colors.mapRoute },
              { label: 'Day 2', color: colors.mapRoute, faint: true },
            ],
            campsites: `Campsites (${campsites.length})`,
          }}
        />

        <View style={s.sheet}>
          <SheetHandle />
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.good} />
              <Text style={s.loadText}>Finding campsites nearby…</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={load}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : campsites.length === 0 ? (
            <View style={s.center}>
              <Text style={s.loadText}>No campsites found in this area</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <SectionHeader>Tonight's options</SectionHeader>
              {campsites.slice(0, 6).map((c, i) => (
                <TouchableOpacity key={c.id || i} onPress={() => setSelected(i)} activeOpacity={0.8}>
                  <CampsiteCard
                    name={c.name}
                    nearRoute={params.routeName || 'Your route'}
                    distKm={c.distanceFromWaterKm || '—'}
                    type={c.type}
                    beach={c.beach_access}
                    water={c.water}
                    source={c.source}
                    selected={selected === i}
                  />
                </TouchableOpacity>
              ))}
              <Text style={s.dataSource}>
                Data: Recreation.gov (RIDB) + OpenStreetMap
              </Text>
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  safe:       { flex: 1 },
  nav:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  back:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:   { fontSize: 22, color: colors.good },
  navTitle:   { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginLeft: 4 },
  navRight:   { fontSize: 10.5, fontWeight: '300', color: colors.textMuted },
  sheet:      { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadText:   { fontSize: 12, fontWeight: '300', color: colors.textMuted, textAlign: 'center' },
  errorText:  { fontSize: 12, color: colors.warn, textAlign: 'center' },
  retryBtn:   { backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:  { fontSize: 12, fontWeight: '500', color: colors.bg },
  dataSource: { fontSize: 9.5, fontWeight: '300', color: colors.textFaint, textAlign: 'center', marginTop: 4, marginBottom: 8 },
});
