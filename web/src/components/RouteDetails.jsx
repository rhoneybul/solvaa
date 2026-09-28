import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Download,
  MapPin,
  ShieldCheck,
  Waves,
  Wind,
  CloudRain,
  Thermometer,
  Image,
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api.mjs";
import { download } from "../lib/storage.mjs";
import { exportGpx, canExportGpx } from "../lib/planner.mjs";
import { formatHours } from "../lib/geo.mjs";

const photoCache = new Map();
export function RoutePhotos({ route }) {
  const [result, setResult] = useState(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    const key = JSON.stringify([route.name, route.waypoints]);
    const promise =
      photoCache.get(key) ||
      api("/api/planning/photos", {
        method: "POST",
        body: JSON.stringify({ route }),
      });
    photoCache.set(key, promise);
    promise
      .then((data) => {
        if (active) setResult(data);
        if (data.status === "unavailable") photoCache.delete(key);
      })
      .catch(() => {
        photoCache.delete(key);
        if (active) setResult({ photos: [], status: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, [route.id, attempt]);
  return (
    <section className="route-photo-section">
      <h3>A feel for the place</h3>
      {!result ? (
        <div className="photo-placeholder" role="status">
          <Image size={22} />
          <span>Finding photos near the route…</span>
        </div>
      ) : result.photos.length ? (
        <>
          <div className="route-gallery">
            {result.photos.slice(0, 2).map((photo) => (
              <figure key={photo.id}>
                <img
                  src={photo.url}
                  alt={photo.title}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
                <figcaption>
                  <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                    {photo.title}
                  </a>
                  <span>
                    {photo.author} ·{" "}
                    {photo.licenseUrl ? (
                      <a
                        href={photo.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {photo.license}
                      </a>
                    ) : (
                      photo.license
                    )}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="helper">
            Nearby photographs, not a record of current conditions.
          </p>
        </>
      ) : (
        <div className="photo-placeholder">
          <Image size={22} />
          <span>
            {result.status === "unavailable"
              ? "Photos could not be loaded."
              : "No relevant, credited photos found nearby."}
          </span>
          {result.status === "unavailable" && (
            <button className="text-button" onClick={() => retry(attempt + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Conditions({ route, date }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let active = true;
    setState(null);
    const [lat, lon] = route.waypoints[0];
    api(`/api/explore/conditions?lat=${lat}&lon=${lon}`)
      .then((data) => {
        if (active) setState(data);
      })
      .catch(() => {
        if (active) setState({ unavailable: true });
      });
    return () => {
      active = false;
    };
  }, [route.id]);
  const index = state?.daily?.time?.indexOf(date) ?? -1;
  return (
    <section className="conditions">
      <h3>Before you go</h3>
      {!state ? (
        <p className="helper" role="status">
          Checking the forecast…
        </p>
      ) : index >= 0 ? (
        <>
          <div className="forecast-values">
            <span>
              <Wind size={18} />
              <strong>{state.daily.wind_speed_10m_max[index]} kn</strong>
              <small>Max wind</small>
            </span>
            <span>
              <Thermometer size={18} />
              <strong>{state.daily.temperature_2m_max[index]}°C</strong>
              <small>High</small>
            </span>
            <span>
              <CloudRain size={18} />
              <strong>
                {state.daily.precipitation_probability_max[index]}%
              </strong>
              <small>Rain chance</small>
            </span>
          </div>
          <p className="helper">
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{" "}
            · {date} · updated{" "}
            {new Date(state.fetchedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Land forecast; tides and sea state are not included.
          </p>
        </>
      ) : (
        <p className="note">
          {state.unavailable
            ? "Forecast unavailable right now."
            : "This date is outside the available forecast."}{" "}
          Check a local forecast before you launch.
        </p>
      )}
      <ul className="safety-list">
        {route.hazards.map((hazard) => (
          <li key={hazard}>{hazard}</li>
        ))}
      </ul>
      <a
        className="text-link"
        href="https://weather.metoffice.gov.uk/specialist-forecasts/coast-and-sea"
        target="_blank"
        rel="noreferrer"
      >
        Check marine conditions <ArrowUpRight size={15} />
      </a>
    </section>
  );
}

export default function RouteDetails({ route, plan, onBack, onSave, saved }) {
  return (
    <div className="route-details">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} /> All routes
      </button>
      <div className="detail-title">
        <h1>{route.name}</h1>
        <span className={`difficulty ${route.difficulty}`}>
          {route.difficulty} effort
        </span>
        <p>
          <MapPin size={15} />
          {route.launch} · {route.area}
        </p>
      </div>
      <div className="detail-metrics">
        <span>
          <strong>
            {route.distanceKm} <small>km</small>
          </strong>
          Distance
        </span>
        <span>
          <strong>{formatHours(route.durationHours)}</strong>Estimated time
        </span>
        <span>
          <strong className="capitalize">{route.terrain}</strong>Water
        </span>
      </div>
      <p className="detail-description">{route.description}</p>
      <div className="tag-row">
        {route.highlights.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="action-row">
        <button className="primary-button" onClick={() => onSave(route)}>
          {saved ? <Check size={17} /> : <Bookmark size={17} />}{" "}
          {saved ? "Saved to My trips" : "Save this route"}
        </button>
        <button
          className="secondary-button"
          disabled={!canExportGpx(route)}
          aria-describedby="gpx-status"
          onClick={() =>
            download(
              exportGpx(plan, route),
              `${route.id}.gpx`,
              "application/gpx+xml",
            )
          }
        >
          <Download size={16} /> Download GPX
        </button>
      </div>
      {!canExportGpx(route) && (
        <p className="helper" id="gpx-status">
          GPX download is locked until this outline has been checked against
          water geometry. It must not be used for navigation.
        </p>
      )}
      <p className="note">
        <ShieldCheck size={18} />
        <span>
          This is a planning outline. Launch access, water depth and the line
          between points need local verification. Easy effort does not mean safe
          sea conditions.
        </span>
      </p>
      <Conditions route={route} date={plan.request.startDate} />
      <RoutePhotos route={route} />
      <a
        href={route.source}
        className="text-link"
        target="_blank"
        rel="noreferrer"
      >
        Read about paddling in this area <ArrowUpRight size={15} />
      </a>
    </div>
  );
}
