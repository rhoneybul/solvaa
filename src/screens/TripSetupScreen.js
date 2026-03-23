import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { SectionHeader, PrimaryButton } from '../components/UI';
import { SKILL_LEVELS, getMockStravaProfile } from '../services/stravaService';

const TRIP_TYPES = [
  { id: 'day_paddle', label: 'Day Trip', sub: 'Back before dark', days: 1 },
  { id: 'multi_day',  label: 'Multi-Day', sub: '2+ days, camping', days: 3 },
];

export default function TripSetupScreen({ navigation }) {
  const [tripType, setTripType] = useState(TRIP_TYPES[0]);
  const [skillLevel, setSkillLevel] = useState(SKILL_LEVELS.INTERMEDIATE);

  const handleContinue = () => {
    navigation.navigate('Weather', { tripType, skillLevel, skillSource: 'manual' });
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
          <Text style={s.navTitle}>Your Profile</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionHeader>Trip type</SectionHeader>
          <View style={s.card}>
            {TRIP_TYPES.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <View style={s.sep} />}
                <TouchableOpacity style={s.row} onPress={() => setTripType(t)}>
                  <View style={s.rowMain}>
                    <Text style={[s.rowLabel, tripType.id === t.id && s.rowLabelSelected]}>{t.label}</Text>
                    <Text style={s.rowSub}>{t.sub}</Text>
                  </View>
                  {tripType.id === t.id && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <SectionHeader>Skill level</SectionHeader>
          {/* Strava option */}
          <View style={s.card} style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 9, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
            <TouchableOpacity style={s.row}>
              <View style={s.stravaLogo}><Text>🏃</Text></View>
              <View style={s.rowMain}>
                <Text style={s.rowLabel}>Connect Strava</Text>
                <Text style={s.rowSub}>Auto-detect from your paddle activities</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            {Object.values(SKILL_LEVELS).map((level, i, arr) => (
              <View key={level.key}>
                {i > 0 && <View style={s.sep} />}
                <TouchableOpacity style={[s.row, skillLevel.key === level.key && s.rowSelected]} onPress={() => setSkillLevel(level)}>
                  <View style={s.rowMain}>
                    <Text style={[s.rowLabel, skillLevel.key === level.key && s.rowLabelSelected]}>{level.label}</Text>
                    <Text style={s.rowSub}>{level.description} · max {level.maxWindKnots} kts · {level.maxDistKm} km/day</Text>
                  </View>
                  {skillLevel.key === level.key && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <PrimaryButton label="Check Weather & Routes →" onPress={handleContinue} style={{ marginTop: 4 }} />
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
  card: { marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 9, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.07, shadowRadius: 2, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingVertical: 11, gap: 10 },
  rowSelected: { backgroundColor: '#f8f7f3' },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: '400', color: colors.text, marginBottom: 1 },
  rowLabelSelected: { fontWeight: '600' },
  rowSub: { fontSize: 11, fontWeight: '300', color: colors.textMuted },
  sep: { height: 0.5, backgroundColor: colors.borderLight },
  check: { fontSize: 14, fontWeight: '600', color: colors.blue },
  chev: { fontSize: 18, color: '#c8c4bc' },
  stravaLogo: { width: 32, height: 32, borderRadius: 7, backgroundColor: '#FC4C0220', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
