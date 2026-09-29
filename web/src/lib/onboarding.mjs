import { distanceKm as haversine, validPoint } from "./geo.mjs";
import { ROUTES } from "../data/routes.mjs";
import { prepareRoute } from "./planner.mjs";

export function assessExperience({
  frequency = "new",
  water = "sheltered",
  rescue = false,
  navigation = false,
}) {
  if (frequency === "regular" && water === "coastal" && rescue && navigation)
    return {
      level: "advanced",
      reason:
        "Regular coastal experience, rescue confidence and navigation experience.",
    };
  if (frequency !== "new" && rescue)
    return {
      level: "intermediate",
      reason: "Some paddling experience and confidence in a rescue.",
    };
  return {
    level: "beginner",
    reason:
      "Start with easy outings while you build experience and rescue confidence.",
  };
}
export function recommendNearby(profile, catalog = ROUTES) {
  const coords = profile.homeCoords;
  if (!coords || !validPoint([coords.lat, coords.lon]))
    return { nearby: [], further: [], hasLocation: false };
  const rank = { beginner: 0, intermediate: 1, advanced: 2, expert: 2 };
  const radius = Number(profile.travelRadiusKm) || 75;
  const options = catalog
    .filter(
      (route) =>
        ({ easy: 0, moderate: 1, challenging: 2 })[route.difficulty] <=
        (rank[profile.level] ?? 0),
    )
    .map((route) => ({
      ...prepareRoute(route, profile),
      distanceFromHomeKm: Math.round(
        haversine([coords.lat, coords.lon], route.waypoints[0]),
      ),
    }))
    .filter(
      (route) => route.distanceKm <= (Number(profile.dailyDistanceKm) || 8),
    )
    .sort(
      (a, b) =>
        a.distanceFromHomeKm - b.distanceFromHomeKm ||
        a.distanceKm - b.distanceKm,
    );
  return {
    nearby: options
      .filter((route) => route.distanceFromHomeKm <= radius)
      .slice(0, 3),
    further: options
      .filter((route) => route.distanceFromHomeKm > radius)
      .slice(0, 3),
    hasLocation: true,
  };
}
export async function prepareScreenshot(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP screenshot.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose a screenshot smaller than 12 MB.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const data = canvas.toDataURL("image/jpeg", 0.72);
  if (data.length > 950000)
    throw new Error(
      "Crop the screenshot to the activity details and try again.",
    );
  return data;
}
