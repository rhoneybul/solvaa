import React, { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMapEvents,
  useMap,
} from "react-leaflet";
function Picker({ onChoose, children }) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useMapEvents({
    click(e) {
      const p = e.latlng.wrap();
      onChoose({
        lat: Number(p.lat.toFixed(2)),
        lon: Number(p.lng.toFixed(2)),
      });
    },
  });
  return children;
}
export default function HomeMap({ place, onChoose }) {
  const [point, setPoint] = useState(place || null);
  function choose(p) {
    setPoint(p);
    onChoose(p);
  }
  return (
    <>
      <div className="home-map">
        <MapContainer
          center={point ? [point.lat, point.lon] : [55, -4]}
          zoom={point ? 10 : 5}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          />
          <Picker onChoose={choose}>
            {point && (
              <CircleMarker center={[point.lat, point.lon]} radius={8} />
            )}
          </Picker>
        </MapContainer>
      </div>
      <p className="helper">
        Tap your approximate home area. Coordinates are rounded; an exact
        address is not needed.
      </p>
      <div className="coordinate-fields">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={point?.lat ?? ""}
            onChange={(e) => {
              if (e.target.value && Math.abs(Number(e.target.value)) <= 90)
                choose({ lat: Number(e.target.value), lon: point?.lon ?? 0 });
            }}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={point?.lon ?? ""}
            onChange={(e) => {
              if (e.target.value && Math.abs(Number(e.target.value)) <= 180)
                choose({ lat: point?.lat ?? 0, lon: Number(e.target.value) });
            }}
          />
        </label>
      </div>
    </>
  );
}
