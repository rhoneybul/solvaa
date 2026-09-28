import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  PlusCircle,
  Undo2,
} from "lucide-react";
// Lucide icons (ISC licence); static markup avoids shipping React's server renderer.
const ICONS = {
  launch:
    '<path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  camp: '<path d="M3.5 21 14 3M20.5 21 10 3M15.5 21 12 15l-3.5 6M2 21h20"/>',
  stay: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>',
};
const placeIcon = (type) =>
  L.divIcon({
    className: `point-marker point-${type}`,
    html: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[type] || ICONS.launch}</svg>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
const routeIcon = (index, active) =>
  L.divIcon({
    className: `route-point-marker ${active ? "current" : ""}`,
    html: `<span>${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
function MapTools({
  places,
  showRoute,
  region,
  focus,
  days,
  plotting,
  onAdd,
  onSearch,
  onUndo,
  canUndo,
}) {
  const map = useMap();
  const controls = useRef(null);
  useEffect(() => {
    L.DomEvent.disableClickPropagation(controls.current);
    L.DomEvent.disableScrollPropagation(controls.current);
  }, []);
  useMapEvents({
    click(event) {
      if (plotting) {
        const p = event.latlng.wrap();
        onAdd({ lat: p.lat, lon: p.lng });
      }
    },
  });
  const latest = useRef({ days, places, showRoute, region });
  latest.current = { days, places, showRoute, region };
  function frameOverview() {
    const view = latest.current;
    const points = view.showRoute
      ? view.days.flatMap((day) => day.points.map((p) => [p.lat, p.lon]))
      : view.places.map((p) => [p.lat, p.lon]);
    if (points.length > 1)
      map.fitBounds(points, { padding: [48, 72], maxZoom: 15, animate: false });
    else if (points.length === 1)
      map.setView(points[0], 13, { animate: false });
    else map.setView(view.region.center, 11, { animate: false });
  }
  const placeKey = places.map((p) => p.id).join(",");
  useEffect(() => {
    frameOverview();
  }, [showRoute, region.center[0], region.center[1]]);
  useEffect(() => {
    if (!showRoute) frameOverview();
  }, [placeKey]);
  useEffect(() => {
    if (focus) {
      map.setView([focus.lat, focus.lon], Math.max(map.getZoom(), 13), {
        animate: false,
      });
      if (window.matchMedia("(max-width:800px)").matches)
        map.getContainer().scrollIntoView({ block: "center" });
    }
  }, [focus?.id]);
  useEffect(() => {
    let size = "";
    const observer = new ResizeObserver(([entry]) => {
      const next = `${entry.contentRect.width},${entry.contentRect.height}`;
      map.invalidateSize();
      if (size && size !== next) frameOverview();
      size = next;
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  function fit() {
    const points = days.flatMap((day) => day.points.map((p) => [p.lat, p.lon]));
    if (points.length > 1)
      map.fitBounds(points, { padding: [45, 65], maxZoom: 15 });
    else map.setView(region.center, 11);
  }
  return (
    <div ref={controls}>
      <div className="plot-map-controls">
        <button aria-label="Zoom in" onClick={() => map.zoomIn()}>
          <Plus size={20} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.zoomOut()}>
          <Minus size={20} />
        </button>
        <button aria-label="Fit my route" onClick={fit}>
          <LocateFixed size={19} />
        </button>
      </div>
      {!plotting && (
        <button
          className="search-map-button"
          onClick={() => {
            const p = map.getCenter().wrap();
            onSearch({ lat: p.lat, lon: p.lng });
          }}
        >
          Search this area
        </button>
      )}
      {plotting && (
        <>
          <span className="map-crosshair" aria-hidden="true" />
          <div className="map-drawing-bar">
            <button
              className="map-undo"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo last point"
            >
              <Undo2 size={19} />
            </button>
            <button
              className="primary-button"
              onClick={() => {
                const p = map.getCenter().wrap();
                onAdd({ lat: p.lat, lon: p.lng });
              }}
            >
              <PlusCircle size={18} />
              Add point at centre
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export default function PlotMap({
  region,
  places,
  selected,
  onSelect,
  days,
  activeDay,
  plotting,
  showRoute,
  onAdd,
  onSearch,
  onMovePoint,
  onUndo,
}) {
  const [satellite, setSatellite] = useState(false),
    [error, setError] = useState(false);
  const icons = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(ICONS).map((type) => [type, placeIcon(type)]),
      ),
    [],
  );
  return (
    <section
      className={`plot-map ${plotting ? "drawing" : ""}`}
      aria-label="Paddling map"
    >
      <MapContainer
        center={region.center}
        zoom={11}
        zoomControl={false}
        doubleClickZoom={!plotting}
        scrollWheelZoom
        keyboard
        attributionControl
      >
        <TileLayer
          key={String(satellite)}
          url={
            satellite
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          maxZoom={19}
          attribution={
            satellite
              ? "Imagery © Esri, Maxar, Earthstar Geographics"
              : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          }
          eventHandlers={{
            tileerror: () => setError(true),
            tileload: () => setError(false),
          }}
        />
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lon]}
            icon={icons[place.type] || icons.launch}
            title={place.name}
            alt={place.name}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onSelect(place) }}
          >
            <Tooltip
              key={String(showRoute)}
              permanent={place.type === "launch" && !showRoute}
              direction="top"
              offset={[0, -17]}
            >
              {place.name}
            </Tooltip>
          </Marker>
        ))}
        {showRoute &&
          days.map((day, dayIndex) => (
            <React.Fragment key={day.id}>
              {day.points.length > 1 && (
                <Polyline
                  positions={day.points.map((p) => [p.lat, p.lon])}
                  pathOptions={{
                    color: dayIndex === activeDay ? "#2465d8" : "#7d8c9c",
                    weight: 4,
                    opacity: dayIndex === activeDay ? 1 : 0.65,
                  }}
                />
              )}
              {day.points.map((point, index) => (
                <Marker
                  key={point.id}
                  position={[point.lat, point.lon]}
                  icon={routeIcon(index, dayIndex === activeDay)}
                  draggable={plotting && dayIndex === activeDay}
                  bubblingMouseEvents={false}
                  title={`Day ${dayIndex + 1}, point ${index + 1}: ${point.name}`}
                  eventHandlers={{
                    dragend: (event) => {
                      const p = event.target.getLatLng().wrap();
                      onMovePoint(dayIndex, index, { lat: p.lat, lon: p.lng });
                    },
                  }}
                >
                  <Tooltip>{point.name}</Tooltip>
                </Marker>
              ))}
            </React.Fragment>
          ))}
        <MapTools
          region={region}
          places={places}
          showRoute={showRoute}
          focus={selected}
          days={days}
          activeDay={activeDay}
          plotting={plotting}
          onAdd={onAdd}
          onSearch={onSearch}
          onUndo={onUndo}
          canUndo={days[activeDay]?.points.length > 0}
        />
      </MapContainer>
      <button
        className="map-basemap"
        aria-pressed={satellite}
        onClick={() => {
          setSatellite(!satellite);
          setError(false);
        }}
      >
        <Layers size={17} />
        {satellite ? "Show map" : "Satellite"}
      </button>
      {error && (
        <p className="plot-map-error" role="status">
          Map tiles unavailable. Try another map layer.
        </p>
      )}
      <p className="sr-only">
        Select a place from the list, or start plotting. Use the map’s arrow
        keys to move, then Add point at centre. Route points can also be edited
        in the points list.
      </p>
    </section>
  );
}
