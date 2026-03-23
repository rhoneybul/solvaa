import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';

// react-native-maps has no web support — import only on native
let MapView, Polyline;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
}

/** Parse a GPX XML string into { latitude, longitude }[] */
function parseGpx(gpx) {
  if (!gpx) return [];
  const matches = [...gpx.matchAll(/lat="([^"]+)"\s+lon="([^"]+)"/g)];
  return matches
    .map(m => ({ latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) }))
    .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
}

/** Compute a MapView region that tightly fits all coordinate sets. */
function fitRegion(coordSets) {
  const all = coordSets.flat();
  if (all.length === 0) return null;
  const lats = all.map(c => c.latitude);
  const lons = all.map(c => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLon + maxLon) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.02),
  };
}

const STROKE_COLORS = [colors.mapRoute, colors.mapRouteAlt, colors.blue];

/**
 * PaddleMap — real map tile on iOS/Android, MapSketch fallback on web.
 *
 * Props:
 *   height        number           required
 *   coords        { lat, lon }     map centre + user location dot
 *   routes        array            objects with .waypoints (GPX XML string)
 *   overlayTitle  string
 *   overlayMeta   string
 */
export default function PaddleMap({
  height = 240,
  coords,
  routes = [],
  overlayTitle,
  overlayMeta,
}) {
  const polylines = useMemo(
    () =>
      routes
        .map((r, i) => ({ points: parseGpx(r.waypoints || ''), color: STROKE_COLORS[i] || STROKE_COLORS[0], idx: i }))
        .filter(r => r.points.length > 0),
    [routes],
  );

  const region = useMemo(() => {
    if (polylines.length > 0) return fitRegion(polylines.map(r => r.points));
    if (coords) {
      return { latitude: coords.lat, longitude: coords.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    return null;
  }, [polylines, coords]);

  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MapSketch = require('./MapSketch').default;
    return <MapSketch height={height} overlayTitle={overlayTitle} overlayMeta={overlayMeta} />;
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region ?? undefined}
        region={region ?? undefined}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
      >
        {polylines.map(r => (
          <Polyline
            key={r.idx}
            coordinates={r.points}
            strokeColor={r.color}
            strokeWidth={r.idx === 0 ? 3.5 : 2.5}
            lineDashPattern={r.idx > 0 ? [8, 5] : undefined}
          />
        ))}
      </MapView>

      {(overlayTitle || overlayMeta) && (
        <View style={styles.overlay}>
          {overlayTitle ? <Text style={styles.overlayTitle} numberOfLines={1}>{overlayTitle}</Text> : null}
          {overlayMeta  ? <Text style={styles.overlayMeta}  numberOfLines={1}>{overlayMeta}</Text>  : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { overflow: 'hidden', backgroundColor: colors.mapWater },
  overlay: {
    position: 'absolute', bottom: 12, left: 12, right: 60,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  overlayTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  overlayMeta:  { fontSize: 11, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
});
