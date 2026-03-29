import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily } from '../theme';
import { SheetHandle, SectionHeader, Toggle } from '../components/UI';

export default function EmergencyScreen({ navigation }) {
  const [noMovement, setNoMovement] = useState(true);
  const [capsize, setCapsize] = useState(true);
  const [offRoute, setOffRoute] = useState(false);

  const handleSOS = () => {
    Alert.alert(
      '🆘 Send SOS Alert?',
      'This will send your GPS position, current conditions, and route plan to your emergency contacts and Coastguard. Hold to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => Alert.alert('SOS Sent', 'Your emergency contacts and Coastguard have been alerted with your GPS position.'),
        },
      ]
    );
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>‹</Text></TouchableOpacity>
          <Text style={s.navTitle}>Emergency</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Big SOS */}
          <TouchableOpacity style={s.sosHero} onPress={handleSOS} activeOpacity={0.85}>
            <View style={s.sosCircle}>
              <Text style={s.sosCircleText}>!</Text>
            </View>
            <Text style={s.sosTitle}>SOS Alert</Text>
            <Text style={s.sosSub}>Hold 3 seconds to send distress signal{'\n'}to Coastguard with your GPS position</Text>
          </TouchableOpacity>

          <SectionHeader>Auto-trigger</SectionHeader>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowMain}>
                <Text style={s.rowLabel}>No movement detected</Text>
                <Text style={s.rowSub}>Sends alert after 5 min of no GPS movement</Text>
              </View>
              <TouchableOpacity onPress={() => setNoMovement(v => !v)}>
                <Toggle value={noMovement} />
              </TouchableOpacity>
            </View>
            <View style={s.sep} />
            <View style={s.row}>
              <View style={s.rowMain}>
                <Text style={s.rowLabel}>Capsize detection</Text>
                <Text style={s.rowSub}>Uses accelerometer — alerts after 30s in water</Text>
              </View>
              <TouchableOpacity onPress={() => setCapsize(v => !v)}>
                <Toggle value={capsize} />
              </TouchableOpacity>
            </View>
            <View style={s.sep} />
            <View style={s.row}>
              <View style={s.rowMain}>
                <Text style={s.rowLabel}>Off-route alert</Text>
                <Text style={s.rowSub}>Notify if more than 500m from planned route</Text>
              </View>
              <TouchableOpacity onPress={() => setOffRoute(v => !v)}>
                <Toggle value={offRoute} />
              </TouchableOpacity>
            </View>
          </View>

          <SectionHeader>Alert contacts</SectionHeader>
          <View style={s.card}>
            {[
              { name: 'Sarah (partner)', num: '+44 7•• ••• 892' },
              { name: 'Coastguard', num: 'VHF Ch 16 · Auto-broadcast' },
            ].map((c, i) => (
              <View key={i}>
                {i > 0 && <View style={s.sep} />}
                <View style={s.row}>
                  <View style={s.contactDot} />
                  <View style={s.rowMain}>
                    <Text style={s.rowLabel}>{c.name}</Text>
                    <Text style={s.rowSub}>{c.num}</Text>
                  </View>
                  <View style={[s.activeDot]} />
                </View>
              </View>
            ))}
            <View style={s.sep} />
            <TouchableOpacity style={s.row}>
              <Text style={s.addText}>+ Add emergency contact</Text>
            </TouchableOpacity>
          </View>

          <SectionHeader>SOS message includes</SectionHeader>
          <View style={s.card}>
            {['GPS coordinates', 'Current conditions (wind, swell)', 'Route plan and paddler profile', 'Last known heading and speed'].map((item, i, arr) => (
              <View key={i}>
                {i > 0 && <View style={s.sep} />}
                <View style={s.row}>
                  <View style={s.checkDot} />
                  <Text style={s.rowLabel}>{item}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const FF = fontFamily;
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: colors.primary },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '600', fontFamily: FF.semibold, color: colors.text, marginLeft: 4 },
  sosHero: { margin: 20, backgroundColor: colors.sos, borderRadius: 18, padding: 28, alignItems: 'center', shadowColor: colors.sos, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  sosCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  sosCircleText: { fontSize: 26, fontWeight: '700', fontFamily: FF.semibold, color: 'white' },
  sosTitle: { fontSize: 22, fontWeight: '600', fontFamily: FF.semibold, color: 'white', marginBottom: 6 },
  sosSub: { fontSize: 13, fontWeight: '300', fontFamily: FF.light, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingVertical: 14, gap: 12 },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '400', fontFamily: FF.regular, color: colors.text, marginBottom: 1 },
  rowSub: { fontSize: 13, fontWeight: '300', fontFamily: FF.light, color: colors.textMuted },
  sep: { height: 0.5, backgroundColor: colors.borderLight },
  contactDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textFaint },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.good },
  checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.good },
  addText: { fontSize: 15, fontWeight: '400', fontFamily: FF.regular, color: colors.blue },
});
