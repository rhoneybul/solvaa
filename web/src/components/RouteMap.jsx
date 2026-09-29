import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  LocateFixed,
  Layers,
  Map as MapIcon,
  Mountain,
  Plus,
  Minus,
  Waves,
  ArrowUpRight,
} from "lucide-react";
import { formatHours } from "../lib/geo.mjs";

function Controls({ routes, selected, region, layer, setLayer, focused }) {
  const map = useMap();
  function fit() {
    const points = (focused && selected ? [selected] : routes).flatMap(
      (route) => route.waypoints || [],
    );
    if (points.length)
      map.fitBounds(points, {
        paddingTopLeft: [55, 100],
        paddingBottomRight: [55, map.getSize().y > 500 ? 295 : 245],
        maxZoom: 12,
        animate: false,
      });
    else map.setView(region.center, 9, { animate: false });
  }
  useEffect(fit, [
    selected?.id,
    routes.map((route) => route.id).join(","),
    region.name,
    focused,
  ]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return (
    <>
      <div className="map-location">
        <span className="location-dot" />
        {region.name}
        <span className="map-location-country">United Kingdom</span>
      </div>
      <div className="map-control-stack">
        <button
          className="map-button"
          aria-label="Zoom in"
          onClick={() => map.zoomIn()}
        >
          <Plus size={20} />
        </button>
        <button
          className="map-button"
          aria-label="Zoom out"
          onClick={() => map.zoomOut()}
        >
          <Minus size={20} />
        </button>
        <button
          className="map-button separate"
          aria-label="Fit routes on map"
          onClick={fit}
        >
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="map-layer-control" aria-label="Map style">
        <Layers size={17} />
        <button
          aria-pressed={layer === "terrain"}
          onClick={() => setLayer("terrain")}
        >
          Terrain
        </button>
        <button
          aria-pressed={layer === "satellite"}
          onClick={() => setLayer("satellite")}
        >
          Satellite
        </button>
      </div>
    </>
  );
}

export default function RouteMap({
  routes,
  selected,
  onSelect,
  region,
  focused,
  days = [],
  activeDay,
  onDay,
}) {
  const [layer, setLayer] = useState("terrain");
  const [tileError, setTileError] = useState(false);
  const [fallback, setFallback] = useState(false);
  const mapped = days.length ? days.map((day) => day.route) : routes;
  const layerUrl = fallback
    ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    : layer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
  return (
    <section className="map-panel" aria-label="Route overview map">
      <MapContainer
        center={region.center}
        zoom={9}
        zoomControl={false}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          key={`${layer}-${fallback}`}
          url={layerUrl}
          maxZoom={17}
          attribution={
            fallback
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              : "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA, &copy; OpenStreetMap contributors"
          }
          eventHandlers={{
            tileerror: () => {
              if (!fallback) setFallback(true);
              else setTileError(true);
            },
            tileload: () => setTileError(false),
          }}
        />
        {mapped.map((route, index) => (
          <React.Fragment
            key={`${days.length ? "trip" : "browse"}-${route.id}-${index}`}
          >
            <Polyline
              positions={route.waypoints}
              pathOptions={{
                color: route.id === selected?.id ? "#2465d8" : "#6c8baf",
                weight: route.id === selected?.id ? 4 : 3,
                opacity: 0.9,
                dashArray: "7 6",
              }}
              eventHandlers={{
                click: () => (days.length ? onDay(index) : onSelect(route)),
              }}
            />
            <CircleMarker
              center={route.waypoints[0]}
              radius={route.id === selected?.id ? 9 : 7}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: route.id === selected?.id ? "#2465d8" : "#486887",
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => (days.length ? onDay(index) : onSelect(route)),
              }}
            >
              <Tooltip permanent={!!days.length} direction="top">
                {days.length ? `Day ${index + 1}` : route.launch}
              </Tooltip>
            </CircleMarker>
          </React.Fragment>
        ))}
        <Controls
          routes={mapped}
          selected={selected}
          region={region}
          layer={layer}
          setLayer={(value) => {
            setLayer(value);
            setFallback(false);
          }}
          focused={focused}
        />
      </MapContainer>
      {tileError && (
        <p className="map-error" role="status">
          Map tiles are unavailable. Route details are still accessible in the
          list.
        </p>
      )}
      {selected && (
        <div className="map-summary">
          <div className="map-summary-heading">
            <span className="map-route-icon">
              <Waves size={23} />
            </span>
            <div>
              <h2>{selected.name}</h2>
              {days.length > 0 && (
                <span className="map-summary-context">
                  Day {activeDay + 1} of {days.length}
                </span>
              )}
            </div>
          </div>
          <div className="map-stats">
            <div>
              <strong>
                {selected.distanceKm}
                <small> km</small>
              </strong>
              <span>Distance</span>
            </div>
            <div>
              <strong>{formatHours(selected.durationHours)}</strong>
              <span>Est. time</span>
            </div>
            <div>
              <strong className="capitalize">{selected.difficulty}</strong>
              <span>Effort</span>
            </div>
          </div>
          <div className="map-summary-foot">
            <span className="outline-key" />
            Planning outline · not verified for navigation
          </div>
        </div>
      )}
      {!selected && (
        <div className="map-empty-label">
          <Mountain size={26} />
          <span>
            A little more outside.
            <br />
            <strong>A little more you.</strong>
          </span>
        </div>
      )}
    </section>
  );
}
