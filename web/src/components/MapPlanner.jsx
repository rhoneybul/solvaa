import React, { useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Plus,
  Search,
  Trash2,
  X,
  Utensils,
  Tent,
  BedDouble,
  Download,
  Pencil,
  Undo2,
} from "lucide-react";
import PlotMap from "./PlotMap.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { api } from "../lib/api.mjs";
import { PLACES } from "../data/places.mjs";
import { REGIONS } from "../data/routes.mjs";
import {
  addDay,
  addPoint,
  dayStats,
  exportPlottedGpx,
  homeRegion,
  LAUNCH_POINTS,
  newDraft,
  POINT_TYPES,
  preparePlottedPlan,
  routePreview,
  updateDay,
} from "../lib/plotting.mjs";
import { addDays, distanceKm, formatHours } from "../lib/geo.mjs";
import { download } from "../lib/storage.mjs";
const nearbyCache = new Map();
const ICONS = { launch: Anchor, food: Utensils, camp: Tent, stay: BedDouble };
export function RouteTrace({ plan, animate = false }) {
  return (
    <svg
      className={`route-trace ${animate ? "trace-in" : ""}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {routePreview(plan).map((points, i) => (
        <polyline
          key={i}
          points={points}
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
export default function MapPlanner({
  initialDraft,
  profile,
  onDraft,
  onSave,
  onSavedRoutes,
  onNew,
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState(
    () => initialDraft || newDraft(homeRegion(profile)),
  );
  const current = useRef(draft),
    requestId = useRef(0),
    mounted = useRef(true);
  const [plotting, setPlotting] = useState(Boolean(initialDraft?.savedAt)),
    [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState(null),
    [type, setType] = useState("launch");
  const [places, setPlaces] = useState([]),
    [loading, setLoading] = useState(false),
    [placeError, setPlaceError] = useState("");
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(null),
    [reviewed, setReviewed] = useState(false);
  const [search, setSearch] = useState(""),
    [areaError, setAreaError] = useState("");
  const [searchCenter, setSearchCenter] = useState(draft.region.center);
  const [locationResults, setLocationResults] = useState([]);
  const day = draft.days[dayIndex],
    stats = dayStats(day, profile);
  const apiCall = auth.user ? auth.accountApi : api;
  useEffect(() => {
    if ((plotting || saved) && window.matchMedia("(max-width:800px)").matches)
      document
        .querySelector(saved ? ".first-save" : ".plot-map")
        ?.scrollIntoView({ block: "start" });
  }, [plotting, saved, dayIndex]);
  useEffect(
    () => () => {
      mounted.current = false;
      requestId.current++;
    },
    [],
  );
  async function loadPlaces(center) {
    const id = ++requestId.current;
    setLoading(true);
    setPlaceError("");
    setSearchCenter(center);
    // Drop previous-area results immediately so failures cannot show stale places.
    setPlaces([]);
    const key = center.map((n) => n.toFixed(2)).join(",");
    const cached = nearbyCache.get(key);
    if (cached && Date.now() - cached.at < 3600000) {
      setPlaces(cached.places);
      setLoading(false);
      return;
    }
    try {
      const result = await apiCall(
        `/api/explore/points?lat=${center[0]}&lon=${center[1]}`,
      );
      if (mounted.current && id === requestId.current) {
        setPlaces(result.places);
        if (nearbyCache.size > 30) nearbyCache.clear();
        nearbyCache.set(key, { places: result.places, at: Date.now() });
      }
    } catch (e) {
      if (mounted.current && id === requestId.current) setPlaceError(e.message);
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    loadPlaces(draft.region.center);
  }, [draft.region.center[0], draft.region.center[1]]);
  function commit(next) {
    current.current = next;
    setDraft(next);
    setSaved(null);
    setReviewed(false);
    setError("");
    onDraft(next).catch(() =>
      setError(
        "Your draft could not be saved on this device. Keep this page open and try saving again.",
      ),
    );
  }
  function changeDay(changes) {
    commit(updateDay(current.current, dayIndex, changes));
  }
  function insert(point) {
    try {
      commit(addPoint(current.current, dayIndex, point));
    } catch (e) {
      setError(e.message);
    }
  }
  function chooseArea(region) {
    commit({ ...current.current, region });
    setSelected(null);
    setSearch("");
    setLocationResults([]);
    setAreaError("");
  }
  async function findArea(e) {
    e.preventDefault();
    setAreaError("");
    const query = search.trim().toLowerCase();
    const match = REGIONS.find(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.aliases?.some((a) => query.includes(a)),
    );
    if (query && match) return chooseArea(match);
    try {
      const result = await apiCall(
        `/api/onboarding/locations?q=${encodeURIComponent(search)}`,
      );
      setLocationResults(result.places);
      if (!result.places.length)
        setAreaError(
          "No place found. Try a town and country, or move the map and search this area.",
        );
    } catch (e) {
      setAreaError(e.message);
    }
  }
  const launches = LAUNCH_POINTS.filter(
    (p) => distanceKm([p.lat, p.lon], searchCenter) <= 35,
  );
  const directory = PLACES.filter(
    (p) =>
      p.type === type && launches.some((l) => l.id === `launch-${p.routeId}`),
  );
  const visible = [...launches, ...places].filter((p) => p.type === type);
  async function save() {
    setError("");
    setSaving(true);
    try {
      const plan = preparePlottedPlan(current.current, profile);
      const result = await onSave(plan);
      setDraft(plan);
      current.current = plan;
      setPlotting(false);
      setSaved({ plan, ...result });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function exportGpx() {
    try {
      download(
        exportPlottedGpx(draft),
        `${draft.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.gpx`,
        "application/gpx+xml",
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <main className="map-planner">
      <div className="planner-toolbar">
        <div>
          <h1>
            {plotting ? "Make it your own." : "Where will the water take you?"}
          </h1>
          <p>
            {plotting
              ? "Tap the map to add points. Drag them to fine-tune."
              : `Find a launch, explore what’s nearby, then plot your paddle.`}
          </p>
        </div>
        <button
          className={plotting ? "secondary-button" : "primary-button"}
          onClick={() => {
            setPlotting(!plotting);
            setSaved(null);
          }}
        >
          <Pencil size={17} />
          {plotting
            ? "Browse places"
            : draft.days.some((d) => d.points.length)
              ? "Continue plotting"
              : "Plot a route"}
        </button>
      </div>
      <div className="planner-layout">
        <aside
          className="planner-panel"
          aria-label={plotting ? "Your route" : "Explore places"}
        >
          {saved ? (
            <section className="first-save" role="status">
              <RouteTrace plan={saved.plan} animate />
              <span className="saved-tick">
                <Check size={19} />
              </span>
              <h2>
                {saved.first
                  ? "Your first route. All yours."
                  : "Ready when you are."}
              </h2>
              <p>
                {saved.plan.title} is saved{" "}
                {saved.synced ? "to your account" : "on this device"}.
              </p>
              <button className="primary-button" onClick={onSavedRoutes}>
                View saved routes
                <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setSaved(null);
                  setPlotting(true);
                }}
              >
                Keep editing
              </button>
            </section>
          ) : null}
          {!plotting && !saved && (
            <>
              <form className="area-search" onSubmit={findArea}>
                <label htmlFor="map-area">Explore an area</label>
                <div>
                  <input
                    id="map-area"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={draft.region.name}
                    maxLength={100}
                  />
                  <button
                    className="icon-button"
                    aria-label="Find area"
                    disabled={search.trim().length < 2}
                  >
                    <Search size={19} />
                  </button>
                </div>
              </form>
              {areaError && (
                <p className="helper" role="status">
                  {areaError}
                </p>
              )}
              {locationResults.length > 0 && (
                <ul className="place-results">
                  {locationResults.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() =>
                          chooseArea({ name: p.name, center: [p.lat, p.lon] })
                        }
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="area-shortcuts">
                <button
                  className="text-button"
                  onClick={() => chooseArea(homeRegion(profile))}
                >
                  Near home
                </button>
                <details>
                  <summary>
                    Go somewhere else <ChevronDown size={14} />
                  </summary>
                  <div>
                    {REGIONS.map((r) => (
                      <button key={r.name} onClick={() => chooseArea(r)}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <div className="point-filters" aria-label="Place types">
                {Object.entries(POINT_TYPES).map(([key, label]) => {
                  const Icon = ICONS[key];
                  return (
                    <button
                      key={key}
                      aria-pressed={type === key}
                      onClick={() => {
                        setType(key);
                        setSelected(null);
                      }}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  );
                })}
              </div>
              {selected && (
                <section className="place-detail">
                  <button
                    className="icon-button place-close"
                    aria-label="Close place"
                    onClick={() => setSelected(null)}
                  >
                    <X size={18} />
                  </button>
                  <span className="place-source">{selected.source}</span>
                  <h2>{selected.name}</h2>
                  <p>
                    {selected.note ||
                      "Check current access, opening times and availability with the operator."}
                  </p>
                  {selected.hours && <p>{selected.hours}</p>}
                  <a href={selected.url} target="_blank" rel="noreferrer">
                    View source <ArrowUpRight size={14} />
                  </a>
                  <button
                    className="primary-button"
                    disabled={
                      selected.type !== "launch" &&
                      day.stops.some((p) => p.id === selected.id)
                    }
                    onClick={() => {
                      if (selected.type === "launch") {
                        insert(selected);
                        setPlotting(true);
                      } else {
                        if (day.stops.length >= 50) {
                          setError("Each day can have up to 50 stops.");
                          return;
                        }
                        changeDay({ stops: [...day.stops, selected] });
                        setSelected(null);
                        setPlotting(true);
                      }
                    }}
                  >
                    {selected.type === "launch"
                      ? "Start here"
                      : day.stops.some((p) => p.id === selected.id)
                        ? "Added to this day"
                        : `Add stop to day ${dayIndex + 1}`}
                    <Plus size={17} />
                  </button>
                </section>
              )}
              <div className="place-list-heading">
                <h2>{POINT_TYPES[type]}</h2>
                <span>{visible.length}</span>
              </div>
              {loading && (
                <p className="helper" role="status">
                  Looking around the water…
                </p>
              )}
              {placeError && (
                <div className="place-error" role="status">
                  <p>{placeError}</p>
                  <button
                    className="text-button"
                    onClick={() => loadPlaces(searchCenter)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {!visible.length && !loading && (
                <p className="helper">
                  No {POINT_TYPES[type].toLowerCase()} found here. Move the map
                  and choose “Search this area”, or plot your own starting
                  point.
                </p>
              )}
              <div className="map-place-list">
                {visible.slice(0, 60).map((p) => {
                  const Icon = ICONS[p.type];
                  return (
                    <button
                      className={selected?.id === p.id ? "selected" : ""}
                      key={p.id}
                      onClick={() => setSelected(p)}
                    >
                      <Icon size={19} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.area || p.source}</small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
              </div>
              {!visible.length && directory.length > 0 && (
                <div className="operator-directory">
                  <h3>Local places to look into</h3>
                  <p className="helper">
                    Operator links. These locations have not been pinned on the
                    map.
                  </p>
                  {directory.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      {p.name} <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              )}
              <p className="map-source-note">
                Places from OpenStreetMap; launch suggestions are approximate.
                Check shore access before setting off.
              </p>
            </>
          )}
          {(plotting || saved) && (
            <section className="plot-editor">
              <div className="route-title-field">
                <label htmlFor="route-title">Your route</label>
                <input
                  id="route-title"
                  value={draft.title}
                  maxLength={100}
                  onChange={(e) =>
                    commit({ ...current.current, title: e.target.value })
                  }
                />
              </div>
              <div className="day-tabs" aria-label="Trip days">
                {draft.days.map((d, i) => (
                  <button
                    key={d.id}
                    aria-pressed={dayIndex === i}
                    onClick={() => {
                      setDayIndex(i);
                      setSelected(null);
                    }}
                  >
                    Day {i + 1}
                  </button>
                ))}
                <button
                  aria-label="Add another day"
                  disabled={draft.days.length >= 14}
                  onClick={() => {
                    const next = addDay(current.current);
                    commit(next);
                    setDayIndex(next.days.length - 1);
                    setPlotting(true);
                  }}
                >
                  <Plus size={17} />
                </button>
              </div>
              <div className="plotted-stats">
                <strong>
                  {stats.distanceKm}
                  <small> km</small>
                </strong>
                <span>
                  About {formatHours(stats.hours)}
                  <small>
                    {draft.startDate
                      ? addDays(draft.startDate, dayIndex)
                      : "Choose a start date"}
                  </small>
                </span>
              </div>
              {stats.distanceKm > profile.dailyDistanceKm && (
                <p className="note">
                  This is beyond your comfortable daily distance of{" "}
                  {profile.dailyDistanceKm} km.
                </p>
              )}
              {!day.points.length && (
                <div className="plot-hint">
                  <Anchor size={22} />
                  <p>
                    Place your launch point on the water, then trace your way
                    along the shore.
                  </p>
                </div>
              )}
              <p className="plot-integrity">
                Points join with straight lines. Zoom in and check every leg
                stays on suitable water. This line is not water-validated.
              </p>
              <details className="plot-details">
                <summary>
                  {day.points.length} route{" "}
                  {day.points.length === 1 ? "point" : "points"}{" "}
                  <span>Edit points</span>
                  <ChevronDown className="disclosure-chevron" size={16} />
                </summary>
                <ol className="editable-points">
                  {day.points.map((p, i) => (
                    <li key={p.id}>
                      <span>{i + 1}</span>
                      <div>
                        <label className="sr-only" htmlFor={`name-${p.id}`}>
                          Point {i + 1} name
                        </label>
                        <input
                          id={`name-${p.id}`}
                          maxLength={200}
                          value={p.name}
                          onChange={(e) =>
                            changeDay({
                              points: day.points.map((point, n) =>
                                n === i
                                  ? { ...point, name: e.target.value }
                                  : point,
                              ),
                            })
                          }
                        />
                        <details>
                          <summary>Edit coordinates</summary>
                          <div className="coordinate-fields">
                            {["lat", "lon"].map((axis) => (
                              <label key={axis}>
                                {axis === "lat" ? "Latitude" : "Longitude"}
                                <input
                                  type="number"
                                  step="any"
                                  min={axis === "lat" ? -90 : -180}
                                  max={axis === "lat" ? 90 : 180}
                                  defaultValue={p[axis]}
                                  key={`${axis}-${p[axis]}`}
                                  onBlur={(e) => {
                                    const value = Number(e.target.value),
                                      max = axis === "lat" ? 90 : 180;
                                    if (
                                      e.target.value &&
                                      Number.isFinite(value) &&
                                      Math.abs(value) <= max
                                    )
                                      changeDay({
                                        points: day.points.map((point, n) =>
                                          n === i
                                            ? { ...point, [axis]: value }
                                            : point,
                                        ),
                                      });
                                    else
                                      setError("Enter valid map coordinates.");
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        </details>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Remove point ${i + 1}`}
                        onClick={() =>
                          changeDay({
                            points: day.points.filter((_, n) => n !== i),
                          })
                        }
                      >
                        <X size={17} />
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  className="text-button"
                  disabled={!day.points.length}
                  onClick={() => changeDay({ points: day.points.slice(0, -1) })}
                >
                  <Undo2 size={16} />
                  Undo last point
                </button>
              </details>
              <div className="day-stops">
                <h3>Stops along the way</h3>
                {day.stops.map((p) => (
                  <div key={p.id}>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.name}
                    </a>
                    <button
                      className="icon-button"
                      aria-label={`Remove stop ${p.name}`}
                      onClick={() =>
                        changeDay({
                          stops: day.stops.filter((s) => s.id !== p.id),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() => {
                    setPlotting(false);
                    setSaved(null);
                    setType("camp");
                  }}
                >
                  <Plus size={16} />
                  Find food, camping & stays
                </button>
              </div>
              <details className="plot-details">
                <summary>
                  Dates & notes
                  <ChevronDown size={16} />
                </summary>
                <label>
                  Start date
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) =>
                      commit({ ...current.current, startDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  Day {dayIndex + 1} notes
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={day.notes}
                    onChange={(e) => changeDay({ notes: e.target.value })}
                    placeholder="Tide times, shuttle plans, a place for lunch…"
                  />
                </label>
                {draft.days.length > 1 && (
                  <button
                    className="text-button danger"
                    onClick={() => {
                      if (
                        day.points.length &&
                        !window.confirm(
                          `Remove day ${dayIndex + 1} and its points?`,
                        )
                      )
                        return;
                      const next = {
                        ...current.current,
                        days: draft.days.filter((_, i) => i !== dayIndex),
                      };
                      setDayIndex(Math.max(0, dayIndex - 1));
                      commit(next);
                    }}
                  >
                    <Trash2 size={16} />
                    Remove this day
                  </button>
                )}
              </details>
              {!saved && (
                <button
                  className="primary-button save-route-button"
                  disabled={saving}
                  onClick={save}
                >
                  <Bookmark size={17} />
                  {saving
                    ? "Saving…"
                    : draft.savedAt
                      ? "Save changes"
                      : "Save route"}
                </button>
              )}
              <details className="plot-details gpx-export">
                <summary>
                  <Download size={16} />
                  Export GPX
                  <ChevronDown className="disclosure-chevron" size={16} />
                </summary>
                <p className="helper">
                  Exports your plotted line, with a separate track for each day.
                  A valid GPX file does not guarantee a paddleable route.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  I have reviewed the line and understand that it has not been
                  checked for land crossings or conditions.
                </label>
                <button
                  className="secondary-button"
                  disabled={!reviewed}
                  onClick={exportGpx}
                >
                  Download my plotted GPX
                </button>
              </details>
            </section>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {draft.days.some((d) => d.points.length > 0) && (
            <button className="text-button new-route-link" onClick={onNew}>
              Start a new route
            </button>
          )}
        </aside>
        <PlotMap
          region={draft.region}
          places={visible}
          selected={selected}
          onSelect={(p) => {
            setSelected(p);
            setPlotting(false);
            setSaved(null);
          }}
          days={draft.days}
          activeDay={dayIndex}
          plotting={plotting}
          showRoute={plotting || !!saved}
          onAdd={insert}
          onSearch={(p) => loadPlaces([p.lat, p.lon])}
          onMovePoint={(di, pi, p) =>
            commit(
              updateDay(current.current, di, {
                points: current.current.days[di].points.map((point, i) =>
                  i === pi ? { ...point, ...p } : point,
                ),
              }),
            )
          }
          onUndo={() => changeDay({ points: day.points.slice(0, -1) })}
        />
      </div>
    </main>
  );
}
