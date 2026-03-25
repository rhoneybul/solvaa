import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, Callout } from 'react-native-maps';
import { colors } from '../theme';

export function parseGpx(gpx) {
  if (!gpx) return [];
  // Array of [lat, lon] pairs (preferred format from Claude)
  if (Array.isArray(gpx)) {
    return gpx
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => ({ latitude: parseFloat(p[0]), longitude: parseFloat(p[1]) }))
      .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
  }
  // Legacy GPX XML string fallback
  const matches = [...gpx.matchAll(/lat="([^"]+)"\s+lon="([^"]+)"/g)];
  return matches
    .map(m => ({ latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) }))
    .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
}

/**
 * Compute the bearing (degrees) from the first to last point of a GPX route.
 * Returns null if fewer than 2 points.
 */
export function gpxRouteBearing(gpx) {
  const pts = parseGpx(gpx);
  if (pts.length < 2) return null;
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const dLon  = (last.longitude - first.longitude) * Math.PI / 180;
  const lat1  = first.latitude  * Math.PI / 180;
  const lat2  = last.latitude   * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function fitRegion(coordSets) {
  const all = coordSets.flat();
  if (all.length === 0) return null;
  const lats = all.map(c => c.latitude);
  const lons = all.map(c => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLon + maxLon) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLon - minLon) * 1.6, 0.02),
  };
}

const ROUTE_COLORS = [colors.primary, colors.caution, colors.textMid];

// Greyscale / muted Google Maps style (Android)
const GREY_MAP_STYLE = [
  { elementType: 'geometry',        stylers: [{ saturation: -100 }, { lightness: 5  }] },
  { elementType: 'labels.text.fill',stylers: [{ color: '#9e9e9e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8e0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7a9aac' }] },
  { featureType: 'road',  elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',  elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'poi',   elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4e4d8' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f2f1ed' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d0cec8' }] },
];

/**
 * PaddleMap (native) — shows GPX routes as polylines on real map tiles.
 * The route at `selectedIdx` is drawn thick + solid; others are thin + dashed.
 */
export default function PaddleMap({
  height = 240,
  coords,
  routes = [],
  selectedIdx = 0,
  overlayTitle,
  overlayMeta,
}) {
  const parsed = useMemo(
    () => routes.map((r, i) => ({
      points: parseGpx(r.waypoints || ''),
      color:  ROUTE_COLORS[i] || ROUTE_COLORS[0],
      idx: i,
    })),
    [routes],
  );

  // Only consider the selected route for map fit; fall back to all routes
  const fitPoints = useMemo(() => {
    const sel = parsed[selectedIdx];
    if (sel && sel.points.length > 0) return [sel.points];
    return parsed.filter(r => r.points.length > 0).map(r => r.points);
  }, [parsed, selectedIdx]);

  const region = useMemo(() => {
    if (fitPoints.length > 0) return fitRegion(fitPoints);
    if (coords) return { latitude: coords.lat, longitude: coords.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    return null;
  }, [fitPoints, coords]);

  const selectedRoute = parsed[selectedIdx];

  // Detect out-and-back: start and end within 300 m of each other
  const selRaw = selectedRoute?.points || [];
  const isOutAndBack = selRaw.length >= 2 && (() => {
    const a = selRaw[0], b = selRaw[selRaw.length - 1];
    const R = 6371000;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180)
      * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) < 300;
  })();

  const midPoint = selRaw.length >= 2 ? selRaw[Math.floor(selRaw.length / 2)] : null;

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        key={selectedIdx}
        style={StyleSheet.absoluteFill}
        initialRegion={region ?? undefined}
        customMapStyle={GREY_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
      >
        {/* Location pin when no routes yet */}
        {parsed.every(r => r.points.length === 0) && coords && (
          <Marker coordinate={{ latitude: coords.lat, longitude: coords.lon }}>
            <View style={styles.markerWrap}>
              {overlayTitle ? (
                <View style={styles.markerLabel}>
                  <Text style={[styles.markerLabelText, { color: colors.primary }]} numberOfLines={1}>
                    {overlayTitle}
                  </Text>
                </View>
              ) : null}
              <View style={styles.markerStart} />
            </View>
          </Marker>
        )}

        {/* Unselected routes — thin dashed */}
        {parsed.map(r => r.idx !== selectedIdx && r.points.length > 0 ? (
          <Polyline
            key={r.idx}
            coordinates={r.points}
            strokeColor={r.color + '55'}
            strokeWidth={1.5}
            lineDashPattern={[6, 6]}
          />
        ) : null)}

        {/* Selected route — thick solid, drawn on top */}
        {selectedRoute && selectedRoute.points.length > 0 && (
          <Polyline
            key={`sel_${selectedIdx}`}
            coordinates={selectedRoute.points}
            strokeColor={selectedRoute.color}
            strokeWidth={4}
          />
        )}

        {/* Start marker */}
        {selectedRoute?.points?.length > 0 && (
          <Marker coordinate={selectedRoute.points[0]} anchor={{ x: 0.5, y: 1.2 }}>
            <View style={styles.markerWrap}>
              <View style={styles.markerLabel}>
                <Text style={[styles.markerLabelText, { color: selectedRoute.color }]}>Launch</Text>
              </View>
              <View style={styles.markerStart} />
            </View>
          </Marker>
        )}

        {/* End marker — only shown for non-out-and-back routes */}
        {selectedRoute?.points?.length > 0 && !isOutAndBack && (
          <Marker
            coordinate={selectedRoute.points[selectedRoute.points.length - 1]}
            anchor={{ x: 0.5, y: 1.2 }}
          >
            <View style={styles.markerWrap}>
              <View style={styles.markerLabel}>
                <Text style={[styles.markerLabelText, { color: colors.warn }]}>Take-out</Text>
              </View>
              <View style={styles.markerEnd} />
            </View>
          </Marker>
        )}

        {/* Turnaround marker for out-and-back routes */}
        {isOutAndBack && midPoint && (
          <Marker coordinate={midPoint} anchor={{ x: 0.5, y: 1.2 }}>
            <View style={styles.markerWrap}>
              <View style={styles.markerLabel}>
                <Text style={[styles.markerLabelText, { color: colors.textMid }]}>Turn point</Text>
              </View>
              <View style={styles.markerMid} />
            </View>
          </Marker>
        )}
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
  markerWrap:   { alignItems: 'center' },
  markerLabel:  { backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 3 },
  markerLabelText: { fontSize: 9, fontWeight: '600' },
  markerStart:  { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
  markerEnd:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warn, borderWidth: 2, borderColor: '#fff' },
  markerMid:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.textMid },
});
