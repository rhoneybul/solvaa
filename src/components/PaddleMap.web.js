import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { colors } from '../theme';

// ── Coordinate parsers (shared with native) ───────────────────────────────────

export function parseGpx(gpx) {
  if (!gpx) return [];
  if (Array.isArray(gpx)) {
    return gpx
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => ({ latitude: parseFloat(p[0]), longitude: parseFloat(p[1]) }))
      .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
  }
  const matches = [...gpx.matchAll(/lat="([^"]+)"\s+lon="([^"]+)"/g)];
  return matches
    .map(m => ({ latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) }))
    .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
}

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

/** Haversine distance in metres between two {latitude, longitude} points. */
function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ── Map tile config ───────────────────────────────────────────────────────────

const TILE_SIZE = 256;
const PAD       = 0.30; // 30 % padding around route bounding box

function difficultyColor(difficulty) {
  const d = (difficulty || '').toLowerCase();
  if (d === 'beginner' || d === 'easy')           return '#16a34a'; // green
  if (d === 'intermediate' || d === 'moderate')   return '#2563EB'; // blue
  if (d === 'advanced' || d === 'challenging')    return '#d97706'; // orange
  if (d === 'expert')                             return '#dc2626'; // red
  return '#2563EB';
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const MAPBOX_STYLE = 'mapbox/light-v11';

function tileUrl(zoom, x, y) {
  if (MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/256/${zoom}/${x}/${y}@2x?access_token=${MAPBOX_TOKEN}`;
  }
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

function lonToWorld(lon, zoom) {
  return ((lon + 180) / 360) * TILE_SIZE * (1 << zoom);
}

function latToWorld(lat, zoom) {
  const r = lat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE_SIZE * (1 << zoom);
}

function calcZoom(bMinLon, bMaxLon, bMinLat, bMaxLat, vpW, vpH) {
  for (let z = 16; z >= 1; z--) {
    const pxW = lonToWorld(bMaxLon, z) - lonToWorld(bMinLon, z);
    const pxH = latToWorld(bMinLat, z) - latToWorld(bMaxLat, z);
    if (pxW <= vpW && pxH <= vpH) return z;
  }
  return 1;
}

// ── Web component ─────────────────────────────────────────────────────────────

export default function PaddleMap({
  height = 240,
  coords,
  routes = [],
  selectedIdx = 0,
  overlayTitle,
  overlayMeta,
}) {
  const [vpW, setVpW] = useState(390);
  const [zoomDelta, setZoomDelta] = useState(0);
  const mapRef = useRef(null);
  const lastTapRef = useRef(0);

  // Reset zoom + pan when selected route changes
  useEffect(() => { setZoomDelta(0); }, [selectedIdx]);

  const panOffset = useRef({ x: 0, y: 0 });
  const [panState, setPanState] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);

  useEffect(() => { panOffset.current = { x: 0, y: 0 }; setPanState({ x: 0, y: 0 }); }, [selectedIdx, coords?.lat, coords?.lon]);

  // Web: wheel-to-zoom + pinch-to-zoom via DOM events
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = mapRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      setZoomDelta(d => d - Math.sign(e.deltaY));
    };

    let pinchDist = null;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || pinchDist === null) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (Math.abs(dist - pinchDist) > 20) {
        setZoomDelta(d => d + (dist > pinchDist ? 1 : -1));
        pinchDist = dist;
      }
    };
    const onTouchEnd = () => { pinchDist = null; };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const allParsed = routes.map(r => parseGpx(r.waypoints || []));
  const allPts    = allParsed.flat();

  if (allPts.length === 0) {
    if (!coords) {
      return (
        <View style={{ height, backgroundColor: '#c8dce8', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Map will appear here</Text>
        </View>
      );
    }
    // Render a pinned map centred on coords (no routes)
    const pinZoom = Math.max(1, Math.min(18, 11 + zoomDelta));
    const pinLat  = coords.lat;
    const pinLon  = coords.lon;
    const pcx     = lonToWorld(pinLon, pinZoom);
    const pcy     = latToWorld(pinLat, pinZoom);
    const pvpX    = pcx - vpW / 2 - panState.x;
    const pvpY    = pcy - height / 2 - panState.y;
    const ptxStart = Math.floor(pvpX / TILE_SIZE);
    const ptyStart = Math.floor(pvpY / TILE_SIZE);
    const ptxEnd   = Math.ceil((pvpX + vpW)    / TILE_SIZE);
    const ptyEnd   = Math.ceil((pvpY + height) / TILE_SIZE);
    const pnTiles  = (1 << pinZoom);
    const pinTiles = [];
    for (let tx = ptxStart; tx < ptxEnd; tx++) {
      for (let ty = ptyStart; ty < ptyEnd; ty++) {
        if (ty < 0 || ty >= pnTiles) continue;
        const tileX = ((tx % pnTiles) + pnTiles) % pnTiles;
        pinTiles.push({ key: `${tx}-${ty}`, tileX, ty, left: tx * TILE_SIZE - pvpX, top: ty * TILE_SIZE - pvpY });
      }
    }
    const pinScreenX = lonToWorld(pinLon, pinZoom) - pvpX;
    const pinScreenY = latToWorld(pinLat, pinZoom) - pvpY;
    return (
      <View
        ref={mapRef}
        style={{ width: '100%', height, overflow: 'hidden', backgroundColor: '#c8dce8', cursor: 'grab' }}
        onLayout={e => setVpW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={e => {
          const now = Date.now();
          if (now - lastTapRef.current < 300) setZoomDelta(d => d + 1);
          lastTapRef.current = now;
          dragStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, panX: panOffset.current.x, panY: panOffset.current.y };
        }}
        onResponderMove={e => {
          if (!dragStart.current) return;
          const dx = e.nativeEvent.pageX - dragStart.current.x;
          const dy = e.nativeEvent.pageY - dragStart.current.y;
          const nx = dragStart.current.panX + dx;
          const ny = dragStart.current.panY + dy;
          panOffset.current = { x: nx, y: ny };
          setPanState({ x: nx, y: ny });
        }}
        onResponderRelease={() => { dragStart.current = null; }}
      >
        {pinTiles.map(({ key, tileX, ty, left, top }) => (
          <Image
            key={key}
            source={{ uri: tileUrl(pinZoom, tileX, ty) }}
            style={{ position: 'absolute', left, top, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Location pin */}
          <circle cx={pinScreenX} cy={pinScreenY} r={8} fill={colors.primary} stroke="#fff" strokeWidth={2.5} />
          <circle cx={pinScreenX} cy={pinScreenY} r={3} fill="#fff" />
          {overlayTitle && (
            <>
              <rect x={pinScreenX - 36} y={pinScreenY - 32} width={72} height={18} rx={5} fill="rgba(255,255,255,0.93)" />
              <text x={pinScreenX} y={pinScreenY - 19} textAnchor="middle" fontSize="9" fontWeight="600"
                fill={colors.primary} fontFamily="Inter, -apple-system, sans-serif">
                {overlayTitle.length > 18 ? overlayTitle.slice(0, 16) + '…' : overlayTitle}
              </text>
            </>
          )}
        </svg>
      </View>
    );
  }

  // Bounding box uses selected route's points so map zooms to fit it on selection change
  const selPts = allParsed[selectedIdx] || [];
  const boxPts = selPts.length >= 2 ? selPts : allPts;
  const lats   = boxPts.map(p => p.latitude);
  const lons   = boxPts.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const dLat   = Math.max(maxLat - minLat, 0.004);
  const dLon   = Math.max(maxLon - minLon, 0.004);
  const bMinLat = minLat - dLat * PAD,  bMaxLat = maxLat + dLat * PAD;
  const bMinLon = minLon - dLon * PAD,  bMaxLon = maxLon + dLon * PAD;

  // Zoom — auto-fit + manual delta, clamped 1–18
  const autoZoom  = calcZoom(bMinLon, bMaxLon, bMinLat, bMaxLat, vpW, height);
  const zoom      = Math.max(1, Math.min(18, autoZoom + zoomDelta));

  const centerLon = (bMinLon + bMaxLon) / 2;
  const centerLat = (bMinLat + bMaxLat) / 2;
  const cx        = lonToWorld(centerLon, zoom);
  const cy        = latToWorld(centerLat, zoom);

  const vpX = cx - vpW / 2 - panState.x;
  const vpY = cy - height / 2 - panState.y;

  const txStart = Math.floor(vpX / TILE_SIZE);
  const tyStart = Math.floor(vpY / TILE_SIZE);
  const txEnd   = Math.ceil((vpX + vpW)    / TILE_SIZE);
  const tyEnd   = Math.ceil((vpY + height) / TILE_SIZE);
  const nTiles  = (1 << zoom);

  const tiles = [];
  for (let tx = txStart; tx < txEnd; tx++) {
    for (let ty = tyStart; ty < tyEnd; ty++) {
      if (ty < 0 || ty >= nTiles) continue;
      const tileX = ((tx % nTiles) + nTiles) % nTiles;
      tiles.push({ key: `${tx}-${ty}`, tileX, ty, left: tx * TILE_SIZE - vpX, top: ty * TILE_SIZE - vpY });
    }
  }

  const toScreen = (lat, lon) => ({
    x: lonToWorld(lon, zoom) - vpX,
    y: latToWorld(lat, zoom) - vpY,
  });

  const svgRoutes = allParsed.map((pts, i) => {
    if (pts.length < 2) return null;
    const sp = pts.map(p => toScreen(p.latitude, p.longitude));
    const d  = 'M' + sp.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L');
    const r  = routes[i];
    return { d, selected: i === selectedIdx, color: difficultyColor(r?.difficulty_rating || r?.difficulty) };
  }).filter(Boolean);

  // Start / end markers for selected route
  const selLatLon  = allParsed[selectedIdx] || [];
  const selScreenPts = selLatLon.map(p => toScreen(p.latitude, p.longitude));

  // Detect out-and-back: start and end within 300 m of each other
  const isOutAndBack = selLatLon.length >= 2
    && haversineM(selLatLon[0], selLatLon[selLatLon.length - 1]) < 300;

  const startPt = selScreenPts[0];
  const endPt   = selScreenPts[selScreenPts.length - 1];
  const selRoute   = routes[selectedIdx];
  const routeColor = difficultyColor(selRoute?.difficulty_rating || selRoute?.difficulty);

  return (
    <View
      ref={mapRef}
      style={{ width: '100%', height, overflow: 'hidden', backgroundColor: '#c8dce8', cursor: 'grab' }}
      onLayout={e => setVpW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={e => {
        // Double-tap to zoom in
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          setZoomDelta(d => d + 1);
        }
        lastTapRef.current = now;
        dragStart.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
          panX: panOffset.current.x,
          panY: panOffset.current.y,
        };
      }}
      onResponderMove={e => {
        if (!dragStart.current) return;
        const dx = e.nativeEvent.pageX - dragStart.current.x;
        const dy = e.nativeEvent.pageY - dragStart.current.y;
        const nx = dragStart.current.panX + dx;
        const ny = dragStart.current.panY + dy;
        panOffset.current = { x: nx, y: ny };
        setPanState({ x: nx, y: ny });
      }}
      onResponderRelease={() => { dragStart.current = null; }}
    >
      {/* Tile images */}
      {tiles.map(({ key, tileX, ty, left, top }) => (
        <Image
          key={key}
          source={{ uri: tileUrl(zoom, tileX, ty) }}
          style={{ position: 'absolute', left, top, width: TILE_SIZE, height: TILE_SIZE }}
        />
      ))}

      {/* Route + marker SVG overlay */}
      {/* eslint-disable-next-line react-native/no-inline-styles */}
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          overflow: 'visible', pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Unselected routes — thin, semi-transparent */}
        {svgRoutes.filter(r => !r.selected).map((r, i) => (
          <path key={`u${i}`} d={r.d} stroke={r.color + '88'} strokeWidth={2}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Selected route — thick, solid */}
        {svgRoutes.filter(r => r.selected).map((r, i) => (
          <path key={`s${i}`} d={r.d} stroke={r.color} strokeWidth={4}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Start marker + label */}
        {selScreenPts.length >= 2 && (
          <>
            <circle cx={startPt.x} cy={startPt.y} r={7}
              fill={routeColor} stroke="#fff" strokeWidth={2} />
            {/* Label pill */}
            <rect x={startPt.x - 22} y={startPt.y - 26} width={44} height={16}
              rx={4} fill="rgba(255,255,255,0.92)" />
            <text x={startPt.x} y={startPt.y - 14}
              textAnchor="middle" fontSize="9" fontWeight="600" fill={routeColor}
              fontFamily="Inter, -apple-system, sans-serif">
              Launch
            </text>
          </>
        )}

        {/* End marker + label (hidden if out-and-back — same point as start) */}
        {selScreenPts.length >= 2 && !isOutAndBack && (
          <>
            <circle cx={endPt.x} cy={endPt.y} r={7}
              fill={colors.warn} stroke="#fff" strokeWidth={2} />
            <rect x={endPt.x - 27} y={endPt.y - 26} width={54} height={16}
              rx={4} fill="rgba(255,255,255,0.92)" />
            <text x={endPt.x} y={endPt.y - 14}
              textAnchor="middle" fontSize="9" fontWeight="600" fill={colors.warn}
              fontFamily="Inter, -apple-system, sans-serif">
              Take-out
            </text>
          </>
        )}

        {/* Out-and-back indicator at midpoint */}
        {selScreenPts.length >= 2 && isOutAndBack && (() => {
          const mid = selScreenPts[Math.floor(selScreenPts.length / 2)];
          return (
            <>
              <circle cx={mid.x} cy={mid.y} r={5}
                fill="#fff" stroke={routeColor} strokeWidth={2} />
              <rect x={mid.x - 28} y={mid.y - 26} width={56} height={16}
                rx={4} fill="rgba(255,255,255,0.92)" />
              <text x={mid.x} y={mid.y - 14}
                textAnchor="middle" fontSize="9" fontWeight="600" fill={colors.textMid}
                fontFamily="Inter, -apple-system, sans-serif">
                Turn point
              </text>
            </>
          );
        })()}
      </svg>

      {/* Zoom controls */}
      <View style={{
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(255,255,255,0.93)',
        borderRadius: 8, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
      }}>
        <TouchableOpacity
          onPress={() => setZoomDelta(d => Math.min(d + 1, 18 - autoZoom))}
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
            borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, color: colors.text, lineHeight: 20 }}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setZoomDelta(d => Math.max(d - 1, 1 - autoZoom))}
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, color: colors.text, lineHeight: 20 }}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Map attribution */}
      <View style={{
        position: 'absolute', bottom: 2, right: 2,
        backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 3,
        paddingHorizontal: 4, paddingVertical: 1,
      }}>
        <Text style={{ fontSize: 7, color: '#555' }}>
          {MAPBOX_TOKEN ? '© Mapbox  © OpenStreetMap' : '© OpenStreetMap contributors'}
        </Text>
      </View>

      {/* Title overlay */}
      {(overlayTitle || overlayMeta) && (
        <View style={{
          position: 'absolute', bottom: 12, left: 12, right: 60,
          backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 8,
        }}>
          {overlayTitle
            ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{overlayTitle}</Text>
            : null}
          {overlayMeta
            ? <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{overlayMeta}</Text>
            : null}
        </View>
      )}
    </View>
  );
}
