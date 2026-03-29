import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily } from '../theme';
import { HomeIcon, TrashIcon, BackIcon } from '../components/Icons';
import { deleteFromHistory } from '../services/storageService';
import PaddleMap from '../components/PaddleMap';

const FF = fontFamily;
const P = 20;

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtSpeed(distKm, seconds) {
  if (!distKm || !seconds) return null;
  return `${(distKm / (seconds / 3600)).toFixed(1)} km/h`;
}

function confirm(message, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function PaddleDetailScreen({ navigation, route: navRoute }) {
  const paddle = navRoute?.params?.paddle;
  const { height: screenHeight } = useWindowDimensions();
  const mapHeight = Math.round(screenHeight * 0.45);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    confirm('Delete this paddle? This cannot be undone.', async () => {
      setDeleting(true);
      try {
        const id = paddle?.id || paddle?.serverId;
        if (id) await deleteFromHistory(id);
        navigation.goBack();
      } finally {
        setDeleting(false);
      }
    });
  }, [paddle, navigation]);

  if (!paddle) {
    return (
      <View style={s.container}>
        <SafeAreaView style={s.safe}>
          <View style={s.nav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn}>
              <BackIcon size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={s.centered}>
            <Text style={s.emptyTitle}>Paddle not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const name     = paddle.name || paddle.route?.name || 'Paddle';
  const location = paddle.route?.location || paddle.route?.launchPoint || paddle.location || null;
  const wt       = paddle.weather?.current?.windSpeed ?? null;
  const wv       = paddle.weather?.current?.waveHeight ?? null;
  const spd      = fmtSpeed(paddle.distancePaddled, paddle.durationSeconds);

  // Build GPS track for map: prefer recorded gpsTrack, fall back to route waypoints
  const gpsTrack = (paddle.gpsTrack && paddle.gpsTrack.length > 0)
    ? paddle.gpsTrack
    : (paddle.route?.waypoints || []).map(w => ({ lat: w.lat || w.latitude, lon: w.lon || w.longitude }));

  // Build a synthetic "route" for the map to show if no GPS track
  const mapRoute = gpsTrack.length === 0 && paddle.route
    ? paddle.route
    : null;

  const stats = [
    ['Distance',  `${(paddle.distancePaddled || 0).toFixed(1)} km`],
    ['Duration',  fmtDuration(paddle.durationSeconds)],
    spd ? ['Avg speed', spd] : null,
    wt != null ? ['Wind', `${Math.round(wt)} kt`] : null,
    wv != null ? ['Swell', `${wv.toFixed(1)} m`] : null,
  ].filter(Boolean);

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        {/* Nav */}
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn}>
            <BackIcon size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>{name}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.navBtn}>
            <HomeIcon size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={{ height: mapHeight }}>
          <PaddleMap
            routes={mapRoute ? [mapRoute] : []}
            selectedRoute={mapRoute || null}
            liveTrack={gpsTrack}
            coords={gpsTrack.length > 0 ? gpsTrack[gpsTrack.length - 1] : null}
            followUser={false}
            showZoomControls
          />
        </View>

        {/* Content */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.title}>{name}</Text>
              {location ? <Text style={s.location}>{location}</Text> : null}
              <Text style={s.date}>{fmtDate(paddle.completedAt)}</Text>
            </View>

            {/* Stats grid */}
            <View style={s.statsCard}>
              {stats.map(([lbl, val], i) => (
                <View key={lbl} style={[s.statCell, i > 0 && s.statCellBorder]}>
                  <Text style={s.statLbl}>{lbl}</Text>
                  <Text style={s.statVal}>{val}</Text>
                </View>
              ))}
            </View>

            {/* Notes */}
            {paddle.notes ? (
              <View style={s.notesCard}>
                <Text style={s.notesLabel}>Notes</Text>
                <Text style={s.notesText}>{paddle.notes}</Text>
              </View>
            ) : null}

            {/* Delete */}
            <TouchableOpacity
              style={[s.deleteBtn, deleting && s.deleteBtnDisabled]}
              onPress={handleDelete}
              activeOpacity={0.8}
              disabled={deleting}
            >
              <TrashIcon size={18} color={colors.warn} />
              <Text style={s.deleteBtnText}>{deleting ? 'Deleting…' : 'Delete paddle'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe:      { flex: 1 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: FF.regular, color: colors.textMuted },

  nav:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  navBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '600', fontFamily: FF.semibold, color: colors.text, marginHorizontal: 8 },

  content: { padding: P, gap: 12 },

  header: { gap: 3 },
  title:    { fontSize: 22, fontWeight: '600', fontFamily: FF.semibold, color: colors.text },
  location: { fontSize: 14, fontWeight: '400', fontFamily: FF.regular, color: colors.textMuted },
  date:     { fontSize: 13, fontWeight: '300', fontFamily: FF.light, color: colors.textMuted },

  statsCard: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: colors.white, borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  statCell:       { flex: 1, minWidth: '33%', paddingVertical: 14, alignItems: 'center', borderTopWidth: 0 },
  statCellBorder: { borderLeftWidth: 0.5, borderLeftColor: colors.borderLight },
  statLbl: { fontSize: 9, fontWeight: '400', fontFamily: FF.regular, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  statVal: { fontSize: 18, fontWeight: '500', fontFamily: FF.medium, color: colors.text },

  notesCard: {
    backgroundColor: colors.white, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  notesLabel: { fontSize: 11, fontWeight: '600', fontFamily: FF.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  notesText:  { fontSize: 14, fontWeight: '300', fontFamily: FF.light, color: colors.text, lineHeight: 20 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.warn, borderRadius: 14,
    paddingVertical: 14, marginTop: 4, marginBottom: 16,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontSize: 15, fontWeight: '500', fontFamily: FF.medium, color: colors.warn },
});
