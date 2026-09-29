import {
  addDays,
  distanceKm,
  localDate,
  trackDistance,
  validPoint,
} from "./geo.mjs";
import { ROUTES, REGIONS } from "../data/routes.mjs";

export const POINT_TYPES = {
  launch: "Launch areas",
  food: "Food & drink",
  camp: "Camping",
  stay: "Places to stay",
};
export const LAUNCH_POINTS = ROUTES.map((route) => ({
  id: `launch-${route.id}`,
  name: route.launch,
  type: "launch",
  lat: route.waypoints[0][0],
  lon: route.waypoints[0][1],
  area: route.area,
  url: route.source,
  source: "Suggested launch area",
  note: "Approximate shore location. Check access and choose your exact launch on the map.",
}));
export function homeRegion(profile) {
  if (
    profile.homeCoords &&
    validPoint([profile.homeCoords.lat, profile.homeCoords.lon])
  )
    return {
      name: profile.home || "Near home",
      center: [profile.homeCoords.lat, profile.homeCoords.lon],
    };
  return REGIONS[0];
}
export function newDraft(region = REGIONS[0], startDate = localDate()) {
  return {
    id: crypto.randomUUID(),
    kind: "plotted",
    title: "My next paddle",
    region,
    startDate,
    days: [{ id: crypto.randomUUID(), points: [], stops: [], notes: "" }],
    updatedAt: new Date().toISOString(),
  };
}
export function addPoint(draft, dayIndex, point) {
  if (!validPoint([point.lat, point.lon]))
    throw new Error("Choose a point on the map.");
  const day = draft.days[dayIndex];
  if (day.points.length >= 500)
    throw new Error("Each day can contain up to 500 points.");
  const last = day.points.at(-1);
  if (last && distanceKm([last.lat, last.lon], [point.lat, point.lon]) < 0.005)
    return draft;
  return updateDay(draft, dayIndex, {
    points: [
      ...day.points,
      {
        id: crypto.randomUUID(),
        name: point.name || `Map point ${day.points.length + 1}`,
        lat: Number(point.lat.toFixed(6)),
        lon: Number(point.lon.toFixed(6)),
      },
    ],
  });
}
export function updateDay(draft, index, changes) {
  return {
    ...draft,
    days: draft.days.map((day, i) =>
      i === index ? { ...day, ...changes } : day,
    ),
    updatedAt: new Date().toISOString(),
  };
}
export function addDay(draft) {
  if (draft.days.length >= 14)
    throw new Error("Plan up to 14 days in one trip.");
  return {
    ...draft,
    days: [
      ...draft.days,
      { id: crypto.randomUUID(), points: [], stops: [], notes: "" },
    ],
    updatedAt: new Date().toISOString(),
  };
}
export function dayStats(day, profile = {}) {
  const km = trackDistance(day.points.map((p) => [p.lat, p.lon]));
  const pace = Math.min(5, Math.max(2.5, Number(profile.paceKmh) || 3.5));
  return { distanceKm: Math.round(km * 10) / 10, hours: km / pace };
}
export function validateDraft(draft, { complete = false } = {}) {
  if (
    !draft ||
    draft.kind !== "plotted" ||
    typeof draft.id !== "string" ||
    typeof draft.title !== "string" ||
    !draft.title.trim() ||
    draft.title.length > 100 ||
    !draft.region ||
    typeof draft.region.name !== "string" ||
    draft.region.name.length > 200 ||
    !validPoint(draft.region.center) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)
  )
    throw new Error("Give your route a name, area and valid start date.");
  if (
    !Number.isFinite(Date.parse(draft.startDate)) ||
    new Date(draft.startDate).toISOString().slice(0, 10) !== draft.startDate
  )
    throw new Error("Choose a valid start date.");
  if (
    !Array.isArray(draft.days) ||
    draft.days.length < 1 ||
    draft.days.length > 14
  )
    throw new Error("A trip can have between 1 and 14 days.");
  for (let i = 0; i < draft.days.length; i++) {
    const day = draft.days[i];
    if (!day || typeof day.id !== "string")
      throw new Error("A trip day is invalid.");
    if (
      !Array.isArray(day.points) ||
      day.points.length > 500 ||
      (complete && day.points.length < 2)
    )
      throw new Error(
        `Add at least two points to day ${i + 1}, or remove the empty day.`,
      );
    if (
      day.points.some(
        (p) =>
          !p ||
          !validPoint([p.lat, p.lon]) ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          p.name.length > 200,
      )
    )
      throw new Error("A route point is invalid.");
    if (
      !Array.isArray(day.stops) ||
      day.stops.length > 50 ||
      day.stops.some(
        (p) =>
          !p ||
          !validPoint([p.lat, p.lon]) ||
          typeof p.name !== "string" ||
          p.name.length > 200 ||
          typeof p.id !== "string" ||
          !Object.hasOwn(POINT_TYPES, p.type) ||
          !/^https?:\/\//.test(p.url || ""),
      )
    )
      throw new Error("A stop is invalid.");
    if (typeof day.notes !== "string" || day.notes.length > 2000)
      throw new Error("Keep each day’s notes under 2,000 characters.");
  }
  return draft;
}
export function preparePlottedPlan(draft, profile = {}) {
  validateDraft(draft, { complete: true });
  const stats = draft.days.map((day) => dayStats(day, profile));
  return {
    ...draft,
    title: draft.title.trim(),
    savedAt: new Date().toISOString(),
    totalDistanceKm:
      Math.round(stats.reduce((n, s) => n + s.distanceKm, 0) * 10) / 10,
    totalHours: stats.reduce((n, s) => n + s.hours, 0),
  };
}
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function exportPlottedGpx(plan) {
  validateDraft(plan, { complete: true });
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Solvaa — user plotted" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escape(plan.title)}</name><desc>User-plotted line. Segments connect chosen points directly; water access, land crossings, tides and conditions have not been validated. Separate tracks represent separate days, without connecting transfers.</desc></metadata>${plan.days.map((day, i) => `<trk><name>${escape(`Day ${i + 1} — ${addDays(plan.startDate, i)}`)}</name><type>user-plotted, unvalidated</type><trkseg>${day.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><name>${escape(p.name)}</name></trkpt>`).join("")}</trkseg></trk>`).join("")}</gpx>`;
}
export function routePreview(plan) {
  const days =
    plan.kind === "plotted"
      ? plan.days.map((day) => day.points.map((p) => [p.lat, p.lon]))
      : (plan.days?.length
          ? plan.days.map((day) => day.route.waypoints)
          : plan.routes?.map((route) => route.waypoints)) || [];
  const points = days.flat();
  if (!points.length) return [];
  const xs = points.map((p) => p[1] * Math.cos((points[0][0] * Math.PI) / 180)),
    ys = points.map((p) => -p[0]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    spanX = Math.max(...xs) - minX,
    spanY = Math.max(...ys) - minY,
    scale = 80 / Math.max(spanX, spanY, 0.00001);
  return days.map((day) =>
    day
      .map(
        (p) =>
          `${10 + (80 - spanX * scale) / 2 + (p[1] * Math.cos((points[0][0] * Math.PI) / 180) - minX) * scale},${10 + (80 - spanY * scale) / 2 + (-p[0] - minY) * scale}`,
      )
      .join(" "),
  );
}
