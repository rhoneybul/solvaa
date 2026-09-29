import { ROUTES, REGIONS } from "../data/routes.mjs";
import { addDays, localDate, trackDistance } from "./geo.mjs";

const words = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
};
const number = (value) => words[value] ?? Number(value);
const ranks = { easy: 0, moderate: 1, challenging: 2 };
const skillRanks = { beginner: 0, intermediate: 1, advanced: 2, expert: 2 };

export function parseRequest(
  prompt = "",
  options = {},
  today = localDate(),
  overrides = {},
) {
  const text = prompt.toLowerCase().replace(/[–-]/g, " ");
  const daysMatch = text.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\s*days?\b/,
  );
  const hourMatch = text.match(
    /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight)\s*(?:hours?|hrs?|h)\b/,
  );
  const minutesMatch = text.match(/\b(\d+)\s*(?:minutes?|mins?)\b/);
  const requestedDays = Number(
    overrides.days ??
      (daysMatch
        ? number(daysMatch[1])
        : /\bweekend\b/.test(text)
          ? 2
          : /\b(?:a|one|1) week\b/.test(text)
            ? 7
            : Number(options.days ?? 1)),
  );
  const region = REGIONS.find((region) =>
    region.aliases.some((alias) => text.includes(alias)),
  );
  const locationPhrase = prompt
    .match(
      /\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s'-]*?)(?=\s+(?:for|today|tomorrow|which|with|including|that|and|on)\b|[,.;]|$)/i,
    )?.[1]
    ?.trim();
  const location =
    overrides.location ??
    (region?.name || locationPhrase || options.location || "");
  const dateMatch = prompt.match(/\b\d{4}-\d{2}-\d{2}\b/);
  let startDate =
    overrides.startDate ?? (dateMatch?.[0] || options.startDate || today);
  if (overrides.startDate === undefined) {
    if (/\btomorrow\b/.test(text)) startDate = addDays(today, 1);
    else if (/\btoday\b/.test(text)) startDate = today;
  }
  const parsedDate = new Date(`${startDate}T12:00:00Z`);
  if (
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== startDate
  )
    throw new Error("Choose a valid start date.");
  if (
    !Number.isInteger(requestedDays) ||
    requestedDays < 1 ||
    requestedDays > 14
  )
    throw new Error("Choose a trip between 1 and 14 days.");
  const hours = Number(
    overrides.hours ??
      (hourMatch
        ? number(hourMatch[1])
        : minutesMatch
          ? Number(minutesMatch[1]) / 60
          : Number(options.hours ?? 2)),
  );
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 10)
    throw new Error(
      "Choose between 30 minutes and 10 hours of paddling per day.",
    );
  return {
    prompt,
    location,
    days: requestedDays,
    hours,
    startDate,
    difficulty:
      overrides.difficulty ??
      (/\b(easy|gentle|beginner|relaxed)\b/.test(text)
        ? "easy"
        : options.difficulty || "any"),
    stays:
      overrides.stays ??
      (options.stays !== false || /\b(stay|hotel|accommodation)\b/.test(text)),
    food:
      overrides.food ??
      (options.food !== false || /\b(eat|food|cafe|restaurant)\b/.test(text)),
    camp:
      overrides.camp ??
      (options.camp !== false || /\b(camp|camping)\b/.test(text)),
    continuous: /\b(continuous|point to point|expedition)\b/.test(text),
  };
}

export function prepareRoute(route, profile = {}) {
  const distance = trackDistance(route.waypoints);
  const pace = Math.max(2.5, Math.min(5, Number(profile.paceKmh) || 3.5));
  const hours = distance / pace + 0.25;
  return {
    ...route,
    distanceKm: Math.round(distance * 10) / 10,
    durationHours: Math.round(hours * 10) / 10,
  };
}

export function planRoutes(request, profile = {}, catalog = ROUTES) {
  if (!request.location)
    return {
      status: "needs_location",
      message: "Add a place so we can find a route nearby.",
      routes: [],
      request,
    };
  if (request.continuous && request.days > 1)
    return {
      status: "unsupported",
      message:
        "These plans use separate day paddles with transfers. A continuous expedition needs a verified water route and overnight landing access; try a trip with day paddles instead.",
      routes: [],
      request,
    };
  const region = REGIONS.find(
    (region) =>
      region.name.toLowerCase() === request.location.toLowerCase() ||
      region.aliases.some((alias) =>
        request.location.toLowerCase().includes(alias),
      ),
  );
  const level = skillRanks[profile.level] ?? 0;
  const dailyLimit =
    Number(profile.dailyDistanceKm) > 0
      ? Number(profile.dailyDistanceKm)
      : [8, 16, 28][level];
  const routes = catalog
    .filter((route) =>
      region
        ? route.area === region.name
        : route.area.toLowerCase().includes(request.location.toLowerCase()),
    )
    .filter(
      (route) =>
        ranks[route.difficulty] <= level &&
        (request.difficulty === "any" ||
          route.difficulty === request.difficulty),
    )
    .map((route) => prepareRoute(route, profile))
    .filter((route) => route.distanceKm <= dailyLimit)
    .map((route) => ({
      ...route,
      timeMatch:
        Math.abs(route.durationHours - request.hours) <=
        Math.max(0.5, request.hours * 0.25),
      score:
        Math.abs(route.durationHours - request.hours) +
        ranks[route.difficulty] * 0.1,
    }))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  if (!routes.length)
    return {
      status: "no_matches",
      message: region
        ? "No outlines match those limits. Try more time, or review your profile preferences."
        : "We do not have route outlines for this place yet. Try Skye, the Lake District, Cairngorms or Loch Lomond.",
      routes: [],
      request,
    };
  if (request.days > 1 && routes.length < request.days)
    return {
      status: "not_enough_days",
      message: `There are ${routes.length} distinct matching outings here. Choose up to ${routes.length} days, or broaden your difficulty preference. We will not invent extra routes.`,
      routes,
      request,
    };
  const exact = routes.filter((route) => route.timeMatch);
  const selected =
    request.days > 1
      ? routes.slice(0, request.days)
      : (exact.length ? exact : routes).slice(0, 3);
  const days =
    request.days > 1
      ? selected.map((route, index) => ({
          day: index + 1,
          date: addDays(request.startDate, index),
          route,
          transfer:
            index > 0
              ? `Transfer from ${selected[index - 1].launch} to ${route.launch} by road before paddling.`
              : "Start at the launch point.",
          stops: {},
          notes: "",
          overnight: index < selected.length - 1,
        }))
      : [];
  return {
    id: `plan-${Date.now()}`,
    status: "ready",
    source: "catalog",
    request,
    routes: selected,
    days,
    title:
      request.days > 1
        ? `${request.days} days around ${region?.name || request.location}`
        : `Your paddle in ${region?.name || request.location}`,
    totalDistanceKm:
      Math.round(
        selected.reduce((sum, route) => sum + route.distanceKm, 0) * 10,
      ) / 10,
    totalHours:
      Math.round(
        selected.reduce((sum, route) => sum + route.durationHours, 0) * 10,
      ) / 10,
    message:
      request.days > 1
        ? "A flexible trip of separate day paddles. Road transfers are required between launch points."
        : exact.length
          ? "Routes closest to your time and experience."
          : "No exact time match. These are the closest options; review their estimated duration.",
  };
}

export function canExportGpx(route) {
  return (
    route?.geometryStatus === "water-validated" &&
    !!route.waterValidation?.source &&
    !!route.waterValidation?.checkedAt &&
    route.waypoints?.length >= 2 &&
    route.waypoints.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(Number.isFinite) &&
        Math.abs(point[0]) <= 90 &&
        Math.abs(point[1]) <= 180,
    )
  );
}
export function exportGpx(plan, route) {
  const escape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const routes = route
    ? [route]
    : plan.days?.length
      ? plan.days.map((day) => day.route)
      : plan.routes;
  if (!routes?.length || !routes.every(canExportGpx))
    throw new Error(
      "GPX export is unavailable until every route has passed water-geometry validation.",
    );
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Solvaa" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escape(plan.title)}</name><desc>Water geometry checked against the stated source. Access, depth, tides and conditions still require local verification. Separate tracks may require road transfers.</desc></metadata>${routes.map((item, index) => `<trk><name>${escape(plan.days?.length ? `Day ${index + 1}: ${item.name}` : item.name)}</name><trkseg>${item.waypoints.map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join("")}</trkseg></trk>`).join("")}</gpx>`;
}
