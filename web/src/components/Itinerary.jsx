import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Download,
  CalendarDays,
  MapPin,
  Car,
  Tent,
  BedDouble,
  Utensils,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import { api } from "../lib/api.mjs";
import { distanceKm, formatHours } from "../lib/geo.mjs";
import { download } from "../lib/storage.mjs";
import { exportGpx, canExportGpx } from "../lib/planner.mjs";
import { Conditions } from "./RouteDetails.jsx";
import { placesForRoute } from "../data/places.mjs";

const categories = {
  stay: { label: "Stay", Icon: BedDouble },
  food: { label: "Eat", Icon: Utensils },
  camp: { label: "Camp", Icon: Tent },
};
const placesCache = new Map();
function Stops({ day, request, onChange }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("food");
  useEffect(() => {
    let active = true;
    setResult(null);
    const [lat, lon] = day.route.waypoints[0];
    const key = `${lat},${lon}`;
    const promise =
      placesCache.get(key) || api(`/api/explore/places?lat=${lat}&lon=${lon}`);
    placesCache.set(key, promise);
    promise
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        placesCache.delete(key);
        if (active) setResult({ error: true, places: [] });
      });
    return () => {
      active = false;
    };
  }, [day.route.id, attempt]);
  const types = Object.keys(categories).filter((type) =>
    type === "food"
      ? request.food
      : day.overnight && (type === "stay" ? request.stays : request.camp),
  );
  const change = (type, place) =>
    onChange({ ...day, stops: { ...day.stops, [type]: place } });
  if (!types.length) return null;
  return (
    <section className="stop-section">
      <div className="section-title">
        <h3>Make a day of it</h3>
        <span>Near the launch</span>
      </div>
      {!result && (
        <p role="status" className="helper">
          Finding places to stay, eat and camp…
        </p>
      )}
      {result?.error && (
        <p className="helper">
          Live map search is unavailable. Showing local directory suggestions
          where available.{" "}
          <button
            className="text-button"
            onClick={() => setAttempt(attempt + 1)}
          >
            Retry map search
          </button>
        </p>
      )}
      {types.map((type) => {
        const { label, Icon } = categories[type];
        const directory = placesForRoute(day.route.id).filter(
          (place) => place.type === type,
        );
        const mapped = (result?.places || [])
          .filter(
            (place) =>
              place.type === type &&
              !directory.some(
                (entry) =>
                  entry.name.toLowerCase() === place.name.toLowerCase(),
              ),
          )
          .map((place) => ({
            ...place,
            distance: distanceKm(day.route.waypoints[0], [
              place.lat,
              place.lon,
            ]),
          }))
          .sort((a, b) => a.distance - b.distance);
        const options = [...directory, ...mapped].slice(0, 12);
        const selected = day.stops?.[type];
        return (
          <div className="stop-row" key={type}>
            <span className={`stop-icon ${type}`}>
              <Icon size={20} />
            </span>
            <div className="stop-content">
              <label htmlFor={`stop-${day.day}-${type}`}>
                {label}
                {type === "camp" && <span> · alternative to a stay</span>}
              </label>
              {selected ? (
                <div className="chosen-stop">
                  <span>
                    {selected.name}
                    {selected.url && (
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${selected.name}`}
                      >
                        <ArrowUpRight size={15} />
                      </a>
                    )}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${label.toLowerCase()} stop`}
                    onClick={() => change(type, null)}
                  >
                    <X size={15} />
                  </button>
                  <small>Added · confirm availability and access</small>
                </div>
              ) : (
                <>
                  {options.length > 0 && (
                    <div className="suggested-stop">
                      <a href={options[0].url} target="_blank" rel="noreferrer">
                        {options[0].name}
                        <ArrowUpRight size={13} />
                      </a>
                      <button
                        className="text-button"
                        aria-label={`Add ${options[0].name}`}
                        onClick={() => change(type, options[0])}
                      >
                        <Plus size={14} />
                        Add
                      </button>
                      <small>
                        {options[0].source === "Operator directory"
                          ? "Local directory · check with the operator"
                          : `${options[0].distance.toFixed(1)} km from launch`}
                      </small>
                    </div>
                  )}
                  {(options.length > 1 || !options.length) && (
                    <select
                      id={`stop-${day.day}-${type}`}
                      aria-label={`Choose a place to ${label.toLowerCase()}`}
                      value=""
                      disabled={!options.length}
                      onChange={(event) =>
                        change(
                          type,
                          options.find(
                            (place) => place.id === event.target.value,
                          ),
                        )
                      }
                    >
                      <option value="">
                        {!result && !options.length
                          ? "Loading places…"
                          : !options.length
                            ? "No mapped places found — add your own below"
                            : `Or choose another place (${options.length})`}
                      </option>
                      {options.map((place) => (
                        <option value={place.id} key={place.id}>
                          {place.name}
                          {Number.isFinite(place.distance)
                            ? ` · ${place.distance.toFixed(1)} km away`
                            : " · local directory"}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      <details className="custom-stop">
        <summary>
          <Plus size={15} /> Add your own stop
        </summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!customName.trim()) return;
            const type = types.includes(customType) ? customType : types[0];
            change(type, {
              id: crypto.randomUUID(),
              name: customName.trim(),
              type,
              source: "personal",
            });
            setCustomName("");
          }}
        >
          <label>
            Place name
            <input
              maxLength={160}
              required
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="A campsite, café or place to stay"
            />
          </label>
          <label>
            Type
            <select
              value={types.includes(customType) ? customType : types[0]}
              onChange={(event) => setCustomType(event.target.value)}
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {categories[type].label}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">
            Add stop
          </button>
        </form>
      </details>
      <p className="helper">
        Directory suggestions link to the operator; listings checked September
        2026. Additional map results come from OpenStreetMap within 12 km.
        Distances are straight-line; access may need a drive. Check opening
        times, availability and camping access directly.
      </p>
    </section>
  );
}

export default function Itinerary({
  plan,
  onChange,
  activeDay,
  onDay,
  onBack,
  onSave,
  saved,
  alternatives,
}) {
  const day = plan.days[activeDay] || plan.days[0];
  function updateDay(updated) {
    const days = plan.days.map((item, index) =>
      index === activeDay ? updated : item,
    );
    onChange({
      ...plan,
      days,
      routes: days.map((item) => item.route),
      totalDistanceKm:
        Math.round(
          days.reduce((sum, item) => sum + item.route.distanceKm, 0) * 10,
        ) / 10,
      totalHours:
        Math.round(
          days.reduce((sum, item) => sum + item.route.durationHours, 0) * 10,
        ) / 10,
    });
  }
  return (
    <div className="itinerary">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} /> Edit your search
      </button>
      <div className="detail-title">
        <h1>{plan.title}</h1>
        <p>
          <CalendarDays size={16} />
          {new Date(`${plan.request.startDate}T12:00`).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short" },
          )}{" "}
          –{" "}
          {new Date(`${plan.days.at(-1).date}T12:00`).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" },
          )}
        </p>
      </div>
      <div className="trip-totals">
        <span>
          <strong>{plan.days.length}</strong>days outside
        </span>
        <span>
          <strong>
            {plan.totalDistanceKm}
            <small> km</small>
          </strong>
          total paddling
        </span>
        <span>
          <strong>{formatHours(plan.totalHours)}</strong>on the water
        </span>
      </div>
      <p className="helper transfer-note">
        <Car size={16} />
        Separate day paddles, with road transfers between launch points.
      </p>
      <div className="action-row">
        <button className="primary-button" onClick={onSave}>
          {saved ? <Check size={17} /> : <Bookmark size={17} />}{" "}
          {saved ? "Update saved trip" : "Save this trip"}
        </button>
        <button
          className="secondary-button"
          disabled={!plan.days.every((day) => canExportGpx(day.route))}
          aria-describedby="trip-gpx-status"
          onClick={() =>
            download(
              exportGpx(plan),
              `solvaa-${plan.days.length}-day-outline.gpx`,
              "application/gpx+xml",
            )
          }
        >
          <Download size={16} /> GPX
        </button>
      </div>
      {!plan.days.every((day) => canExportGpx(day.route)) && (
        <p className="helper" id="trip-gpx-status">
          GPX download is locked until every day’s route has passed
          water-geometry validation.
        </p>
      )}
      <div className="day-tabs" role="tablist" aria-label="Trip days">
        {plan.days.map((item, index) => (
          <button
            role="tab"
            aria-selected={index === activeDay}
            id={`day-tab-${index}`}
            aria-controls="active-day"
            key={item.day}
            onClick={() => onDay(index)}
            onKeyDown={(event) => {
              if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
                event.preventDefault();
                const next =
                  (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    plan.days.length) %
                  plan.days.length;
                onDay(next);
                document.getElementById(`day-tab-${next}`)?.focus();
              }
            }}
            tabIndex={index === activeDay ? 0 : -1}
          >
            Day {item.day}
            <small>
              {new Date(`${item.date}T12:00`).toLocaleDateString("en-GB", {
                weekday: "short",
              })}
            </small>
          </button>
        ))}
      </div>
      <section
        id="active-day"
        role="tabpanel"
        aria-labelledby={`day-tab-${activeDay}`}
        className="day-content"
      >
        {activeDay > 0 && (
          <p className="transfer-detail">
            <Car size={17} />
            <span>
              Transfer from {plan.days[activeDay - 1].route.launch} to{" "}
              {day.route.launch}. Allow extra travel time.
            </span>
          </p>
        )}
        <div className="day-route-title">
          <h2>{day.route.name}</h2>
          <span className={`difficulty ${day.route.difficulty}`}>
            {day.route.difficulty} effort
          </span>
          <p>
            <MapPin size={15} />
            {day.route.launch}
            <span>·</span>
            {day.route.distanceKm} km<span>·</span>
            {formatHours(day.route.durationHours)}
          </p>
        </div>
        {!day.route.timeMatch && (
          <p className="helper">
            This day differs from your target of{" "}
            {formatHours(plan.request.hours)}. Review the estimate above.
          </p>
        )}
        <p className="day-description">{day.route.description}</p>
        <details className="change-route">
          <summary>
            Change this day’s route <ChevronDown size={16} />
          </summary>
          <label>
            Choose a different outing
            <select
              aria-label="Day route"
              value={day.route.id}
              onChange={(event) => {
                const route = alternatives.find(
                  (item) => item.id === event.target.value,
                );
                if (route) updateDay({ ...day, route, stops: {} });
              }}
            >
              {alternatives.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name} · {route.distanceKm} km
                </option>
              ))}
            </select>
          </label>
          <p className="helper">
            Changing the launch resets this day’s stops. You can repeat an
            outing deliberately.
          </p>
        </details>
        <Stops
          key={day.day}
          day={day}
          request={plan.request}
          onChange={updateDay}
        />
        <label className="day-notes">
          Your notes
          <textarea
            rows={2}
            value={day.notes || ""}
            onChange={(event) =>
              updateDay({ ...day, notes: event.target.value })
            }
            maxLength={2000}
            placeholder="Booking details, kit to bring, a spot to stop…"
          />
        </label>
        <Conditions route={day.route} date={day.date} />
        <p className="helper">
          All route lines are planning outlines, not verified navigation tracks.
          Check access, tides, weather and landings locally.
        </p>
        {activeDay < plan.days.length - 1 && (
          <button className="next-day" onClick={() => onDay(activeDay + 1)}>
            Next: day {activeDay + 2}
            <ArrowRight size={18} />
          </button>
        )}
      </section>
    </div>
  );
}
